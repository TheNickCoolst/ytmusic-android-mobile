import os
import sys
import re
import json
import asyncio
import subprocess
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Request, Response, Query, BackgroundTasks, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from ytmusicapi import YTMusic
from ytmusicapi.auth.browser import initialize_headers, sapisid_from_cookie, get_authorization

BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = BASE_DIR / "cache"
AUTH_FILE = BASE_DIR / "user_auth.json"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="YT Music Mobile Backend (Ad-Free & Android Background Audio)", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active YTMusic instance (authenticated or guest)
yt: Optional[YTMusic] = None
user_profile: Optional[Dict[str, Any]] = None

def init_yt_client():
    global yt, user_profile
    if AUTH_FILE.exists():
        try:
            with open(AUTH_FILE, "r") as f:
                auth_data = json.load(f)
            yt = YTMusic(auth=auth_data)
            try:
                acc = yt.get_account_info()
                user_profile = {
                    "isLoggedIn": True,
                    "name": acc.get("accountName", "Google User"),
                    "handle": acc.get("channelHandle"),
                    "avatar": acc.get("accountPhotoUrl", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150")
                }
                print(f"Logged in as: {user_profile['name']}")
                return
            except Exception as e:
                print(f"Auth file expired or invalid: {e}")
                user_profile = None
        except Exception as e:
            print(f"Error loading auth file: {e}")
            user_profile = None

    # Fallback to guest client
    try:
        yt = YTMusic()
        user_profile = None
    except Exception as e:
        print(f"Error initializing guest YTMusic: {e}")
        yt = None
        user_profile = None

init_yt_client()

# Active download locks to prevent duplicate downloads
download_locks: Dict[str, asyncio.Lock] = {}
download_status: Dict[str, str] = {}
CACHE_META_FILE = CACHE_DIR / "metadata.json"

def get_cache_metadata() -> Dict[str, Any]:
    if CACHE_META_FILE.exists():
        try:
            with open(CACHE_META_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_cache_metadata(meta: Dict[str, Any]):
    try:
        with open(CACHE_META_FILE, "w") as f:
            json.dump(meta, f, indent=2)
    except Exception as e:
        print(f"Error saving cache metadata: {e}")

def get_lock(video_id: str) -> asyncio.Lock:
    if video_id not in download_locks:
        download_locks[video_id] = asyncio.Lock()
    return download_locks[video_id]

def get_cached_file(video_id: str) -> Optional[Path]:
    for ext in ["m4a", "webm", "mp3", "opus"]:
        p = CACHE_DIR / f"{video_id}.{ext}"
        if p.exists() and p.stat().st_size > 10000:
            return p
    return None

async def download_audio(video_id: str, track_meta: Optional[Dict[str, Any]] = None) -> Optional[Path]:
    cached = get_cached_file(video_id)
    if cached:
        if track_meta:
            all_meta = get_cache_metadata()
            all_meta[video_id] = track_meta
            save_cache_metadata(all_meta)
        return cached

    lock = get_lock(video_id)
    async with lock:
        cached = get_cached_file(video_id)
        if cached:
            if track_meta:
                all_meta = get_cache_metadata()
                all_meta[video_id] = track_meta
                save_cache_metadata(all_meta)
            return cached

        download_status[video_id] = "downloading"
        output_template = str(CACHE_DIR / f"{video_id}.%(ext)s")
        url = f"https://www.youtube.com/watch?v={video_id}"

        # Clean ad-free audio stream extraction
        cmd = [
            sys.executable, "-m", "yt_dlp",
            "-f", "ba[ext=m4a]/ba/b",
            "--extract-audio",
            "--audio-format", "m4a",
            "--audio-quality", "0",
            "--no-playlist",
            "--no-warnings",
            "-o", output_template,
            url
        ]

        print(f"Starting ad-free stream download for {video_id}...")
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                print(f"yt-dlp error ({proc.returncode}): {stderr.decode()[:200]}")
                download_status[video_id] = "error"
                return None

            download_status[video_id] = "ready"
            if track_meta:
                all_meta = get_cache_metadata()
                all_meta[video_id] = track_meta
                save_cache_metadata(all_meta)

            return get_cached_file(video_id)
        except Exception as ex:
            print(f"Error during audio download {video_id}: {ex}")
            download_status[video_id] = "error"
            return None


def format_duration(seconds: Optional[int]) -> str:
    if not seconds:
        return "0:00"
    m = seconds // 60
    s = seconds % 60
    return f"{m}:{s:02d}"

def extract_thumbnail(thumbnails: List[Dict[str, Any]]) -> str:
    if not thumbnails:
        return "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60"
    sorted_thumbs = sorted(thumbnails, key=lambda x: x.get("width", 0), reverse=True)
    url = sorted_thumbs[0].get("url", "")
    if url.startswith("//"):
        url = "https:" + url
    return url


# ==========================================
# AUTH & ACCOUNT MANAGEMENT
# ==========================================

@app.get("/api/auth/status")
async def get_auth_status():
    """Check current authentication status and user profile"""
    global user_profile
    if user_profile and user_profile.get("isLoggedIn"):
        return user_profile
    return {
        "isLoggedIn": False,
        "name": "Gast (Nicht angemeldet)",
        "handle": None,
        "avatar": None
    }


@app.post("/api/auth/login")
async def login_with_headers_or_cookie(payload: Dict[str, str] = Body(...)):
    """
    Log in using YouTube Music browser request headers or cookie string.
    Generates SAPISIDHASH and verifies against YouTube Music API.
    """
    global yt, user_profile
    raw_input = payload.get("auth", "").strip()
    if not raw_input:
        raise HTTPException(status_code=400, detail="Keine Anmeldedaten angegeben")

    lines = raw_input.splitlines()
    parsed_headers = {}
    is_cookie_only = True

    for line in lines:
        if ": " in line:
            k, v = line.split(": ", 1)
            parsed_headers[k.strip().lower()] = v.strip()
            is_cookie_only = False

    if is_cookie_only:
        cookie_val = raw_input
        if cookie_val.lower().startswith("cookie:"):
            cookie_val = cookie_val[7:].strip()
        parsed_headers["cookie"] = cookie_val
        parsed_headers["x-goog-authuser"] = "0"

    init = initialize_headers()
    parsed_headers.update(init)

    if "cookie" in parsed_headers:
        cookie_str = parsed_headers["cookie"]
        # Ensure __Secure-3PAPISID is present if SAPISID is present, and vice-versa
        import re
        if "__Secure-3PAPISID" not in cookie_str and "SAPISID=" in cookie_str:
            m = re.search(r'SAPISID=([^;]+)', cookie_str)
            if m:
                cookie_str += f"; __Secure-3PAPISID={m.group(1).strip()}"
        elif "SAPISID" not in cookie_str and "__Secure-3PAPISID=" in cookie_str:
            m = re.search(r'__Secure-3PAPISID=([^;]+)', cookie_str)
            if m:
                cookie_str += f"; SAPISID={m.group(1).strip()}"
        parsed_headers["cookie"] = cookie_str

        if "origin" not in parsed_headers:
            parsed_headers["origin"] = "https://music.youtube.com"
        if "x-origin" not in parsed_headers:
            parsed_headers["x-origin"] = "https://music.youtube.com"

        try:
            sapisid = sapisid_from_cookie(parsed_headers["cookie"])
            parsed_headers["authorization"] = get_authorization(f"{sapisid} https://music.youtube.com")
        except Exception as e:
            print(f"Warning: could not calculate sapisidhash: {e}")

    try:
        test_client = YTMusic(auth=parsed_headers)
        name = "Google Benutzer"
        handle = "@youtube"
        avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"

        try:
            acc_info = test_client.get_account_info()
            if acc_info.get("accountName"):
                name = acc_info.get("accountName")
            if acc_info.get("channelHandle"):
                handle = acc_info.get("channelHandle")
            if acc_info.get("accountPhotoUrl"):
                avatar = acc_info.get("accountPhotoUrl")
        except Exception as acc_err:
            print(f"Notice: get_account_info fallback ({acc_err})")
            # Verify library access
            test_client.get_library_playlists(limit=1)
        
        # Success! Save to file
        with open(AUTH_FILE, "w") as f:
            json.dump(parsed_headers, f, indent=2)

        yt = test_client
        user_profile = {
            "isLoggedIn": True,
            "name": name,
            "handle": handle,
            "avatar": avatar
        }
        return {"status": "success", "profile": user_profile}
    except Exception as e:
        print(f"Login failed: {e}")
        raise HTTPException(status_code=401, detail=f"Anmeldung fehlgeschlagen: {str(e)}")


@app.post("/api/auth/logout")
async def logout():
    """Log out and reset to guest mode"""
    global yt, user_profile
    if AUTH_FILE.exists():
        AUTH_FILE.unlink()
    user_profile = None
    try:
        yt = YTMusic()
    except Exception:
        pass
    return {"status": "logged_out"}


@app.get("/api/auth/library/playlists")
async def get_user_playlists():
    """Get the logged in user's personal playlists from YouTube Music"""
    global yt
    if not user_profile or not user_profile.get("isLoggedIn") or not yt:
        raise HTTPException(status_code=401, detail="Bitte melde dich mit deinem Google-Konto an")

    try:
        playlists = yt.get_library_playlists(limit=50)
        formatted = []
        for pl in playlists:
            formatted.append({
                "id": pl.get("playlistId"),
                "title": pl.get("title"),
                "trackCount": pl.get("count"),
                "thumbnail": extract_thumbnail(pl.get("thumbnails", []))
            })
        return {"playlists": formatted}
    except Exception as e:
        print(f"Error fetching user playlists: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/auth/library/liked")
async def get_user_liked_songs():
    """Get the logged in user's Liked Songs (Lieblingslieder) from YouTube Music"""
    global yt
    if not user_profile or not user_profile.get("isLoggedIn") or not yt:
        raise HTTPException(status_code=401, detail="Bitte melde dich mit deinem Google-Konto an")

    try:
        liked = yt.get_liked_songs(limit=50)
        tracks = []
        for r in liked.get("tracks", []):
            vid = r.get("videoId")
            if not vid:
                continue
            artists = [a.get("name") for a in r.get("artists", []) if a.get("name")]
            tracks.append({
                "id": vid,
                "title": r.get("title"),
                "artist": ", ".join(artists) if artists else "Artist",
                "artists": artists,
                "thumbnail": extract_thumbnail(r.get("thumbnails", [])),
                "duration": format_duration(r.get("duration_seconds")),
                "durationSeconds": r.get("duration_seconds"),
                "isCached": get_cached_file(vid) is not None
            })
        return {"title": "Lieblingslieder", "tracks": tracks}
    except Exception as e:
        print(f"Error fetching liked songs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/auth/library/history")
async def get_user_history():
    """Get user listening history from YouTube Music"""
    global yt
    if not user_profile or not user_profile.get("isLoggedIn") or not yt:
        raise HTTPException(status_code=401, detail="Bitte melde dich mit deinem Google-Konto an")

    try:
        hist = yt.get_history()
        tracks = []
        for r in hist[:40]:
            vid = r.get("videoId")
            if not vid:
                continue
            artists = [a.get("name") for a in r.get("artists", []) if a.get("name")]
            tracks.append({
                "id": vid,
                "title": r.get("title"),
                "artist": ", ".join(artists) if artists else "Artist",
                "artists": artists,
                "thumbnail": extract_thumbnail(r.get("thumbnails", [])),
                "duration": format_duration(r.get("duration_seconds")),
                "durationSeconds": r.get("duration_seconds"),
                "isCached": get_cached_file(vid) is not None
            })
        return {"history": tracks}
    except Exception as e:
        print(f"Error fetching history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/track/like")
async def like_track_on_youtube(payload: Dict[str, str] = Body(...)):
    """Like song on user's YouTube account"""
    global yt
    if not user_profile or not user_profile.get("isLoggedIn") or not yt:
        return {"status": "guest_only"}

    video_id = payload.get("id")
    if not video_id:
        raise HTTPException(status_code=400, detail="Missing track id")

    try:
        yt.rate_song(videoId=video_id, rating="LIKE")
        return {"status": "liked", "id": video_id}
    except Exception as e:
        print(f"Error rating song: {e}")
        return {"status": "error", "error": str(e)}


@app.post("/api/auth/track/unlike")
async def unlike_track_on_youtube(payload: Dict[str, str] = Body(...)):
    """Remove like from song on user's YouTube account"""
    global yt
    if not user_profile or not user_profile.get("isLoggedIn") or not yt:
        return {"status": "guest_only"}

    video_id = payload.get("id")
    if not video_id:
        raise HTTPException(status_code=400, detail="Missing track id")

    try:
        yt.rate_song(videoId=video_id, rating="INDIFFERENT")
        return {"status": "unliked", "id": video_id}
    except Exception as e:
        print(f"Error un-rating song: {e}")
        return {"status": "error", "error": str(e)}


# ==========================================
# HOME & EXPLORE SHELVES (1:1 YTM LAYOUT)
# ==========================================

@app.get("/api/home")
async def get_home_feed(country: str = "DE"):
    """
    Get 1:1 authentic YouTube Music home shelves:
    - Quick picks (4-track vertical columns)
    - Trending charts (ranked 1-10)
    - Listen again / Forgotten favorites
    - Curated mood mixes & playlists
    """
    global yt
    if not yt:
        init_yt_client()

    shelves = []
    all_tracks = []

    # 1. Fetch Trending Charts (Ranked)
    trending_tracks = []
    if yt:
        try:
            charts = yt.get_charts(country=country)
            video_charts = charts.get("videos", [])
            if video_charts and len(video_charts) > 0 and video_charts[0].get("playlistId"):
                pl = yt.get_playlist(video_charts[0]["playlistId"], limit=20)
                for i, t in enumerate(pl.get("tracks", [])):
                    vid = t.get("videoId")
                    if not vid:
                        continue
                    artists = [a.get("name") for a in t.get("artists", []) if a.get("name")]
                    track_obj = {
                        "id": vid,
                        "title": t.get("title"),
                        "artist": ", ".join(artists) if artists else "Artist",
                        "artists": artists,
                        "thumbnail": extract_thumbnail(t.get("thumbnails", [])),
                        "duration": format_duration(t.get("duration_seconds")),
                        "durationSeconds": t.get("duration_seconds"),
                        "rank": i + 1,
                        "isCached": get_cached_file(vid) is not None
                    }
                    trending_tracks.append(track_obj)
                    all_tracks.append(track_obj)
        except Exception as e:
            print(f"Error fetching trending charts: {e}")

    # Fallback trending if empty
    if not trending_tracks:
        curated_ids = [
            ("J7p4bzqLvCw", "Blinding Lights", "The Weeknd", "3:22"),
            ("4EQkYVtE-28", "Circles", "Post Malone", "3:35"),
            ("nujn6wbr-e8", "As It Was", "Harry Styles", "2:47"),
            ("XfEMj-z3TtA", "STAY", "The Kid LAROI, Justin Bieber", "2:21"),
            ("k2qgadSvNyU", "New Rules", "Dua Lipa", "3:44"),
            ("OPf0YbXqDm0", "Uptown Funk", "Mark Ronson ft. Bruno Mars", "4:30"),
            ("2Vv-BfVoq4g", "Perfect", "Ed Sheeran", "4:23"),
            ("dQw4w9WgXcQ", "Never Gonna Give You Up", "Rick Astley", "3:34"),
        ]
        for i, (vid, title, artist, dur) in enumerate(curated_ids):
            t_obj = {
                "id": vid,
                "title": title,
                "artist": artist,
                "artists": [artist],
                "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                "duration": dur,
                "durationSeconds": 200,
                "rank": i + 1,
                "isCached": get_cached_file(vid) is not None
            }
            trending_tracks.append(t_obj)
            all_tracks.append(t_obj)

    # 2. Build Quick Picks in 4-track vertical columns (The classic YTM Mobile experience)
    # 4 tracks per column, e.g. 3 columns = 12 tracks
    quick_picks_raw = list(trending_tracks)
    if len(quick_picks_raw) < 16 and yt:
        try:
            extra = yt.search("Top Hits 2026", filter="songs", limit=12)
            for r in extra:
                vid = r.get("videoId")
                if vid and not any(x["id"] == vid for x in quick_picks_raw):
                    artists = [a.get("name") for a in r.get("artists", []) if a.get("name")]
                    quick_picks_raw.append({
                        "id": vid,
                        "title": r.get("title"),
                        "artist": ", ".join(artists) if artists else "Artist",
                        "artists": artists,
                        "thumbnail": extract_thumbnail(r.get("thumbnails", [])),
                        "duration": r.get("duration") or "3:20",
                        "isCached": get_cached_file(vid) is not None
                    })
        except Exception:
            pass

    # Group into columns of 4
    columns = []
    chunk_size = 4
    for i in range(0, min(len(quick_picks_raw), 16), chunk_size):
        chunk = quick_picks_raw[i:i + chunk_size]
        if chunk:
            columns.append(chunk)

    shelves.append({
        "id": "quick_picks",
        "title": "Schnellauswahl",
        "subtitle": "STARTET EINE RADIOSTATION",
        "type": "columns_4",
        "columns": columns,
        "tracks": quick_picks_raw[:16]
    })

    # 3. Trending Shelf (Ranked 1..N)
    shelves.append({
        "id": "trending",
        "title": "Charts & Trends",
        "subtitle": "TOP 20 DEUTSCHLAND",
        "type": "rankings",
        "items": trending_tracks
    })

    # 4. Featured Mixes & Playlists
    featured_playlists = [
        {
            "id": "RDCLAK5uy_m0wlRoNn5iCTTgBedfoOQ19Jq9P3XTLIA",
            "title": "Feel-Good Pop & Rock",
            "subtitle": "YouTube Music Mix",
            "thumbnail": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80",
            "query": "Feel good pop rock hits"
        },
        {
            "id": "RDCLAK5uy_k1Wu8QbZASiGVqr1wmie9NIYo38aBqscQ",
            "title": "Deutschrap Top Hits",
            "subtitle": "Ayliva, Luciano, Apache 207",
            "thumbnail": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80",
            "query": "Deutschrap Top Hits"
        },
        {
            "id": "RDCLAK5uy_k8d0XHQgAWWSZe7l7tUp0xLmEV_ncPxck",
            "title": "Gym & Workout Hardstyle",
            "subtitle": "Bass & Motivation",
            "thumbnail": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&auto=format&fit=crop&q=80",
            "query": "Gym workout motivation high energy"
        },
        {
            "id": "RDCLAK5uy_nHSqCJjDrW9HBhCNdF6tWPdnOMngOv0wA",
            "title": "Chill & Lofi Beats",
            "subtitle": "Zum Abschalten & Lernen",
            "thumbnail": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80",
            "query": "Chill lofi study beats"
        }
    ]

    shelves.append({
        "id": "mixes",
        "title": "Empfohlene Mixe für dich",
        "subtitle": "PERSONALISIERT",
        "type": "playlists",
        "items": featured_playlists
    })

    return {"shelves": shelves}


@app.get("/api/playlist/{playlist_id}")
async def get_playlist_tracks(playlist_id: str):
    """Get tracks of any YouTube Music playlist"""
    global yt
    if not yt:
        init_yt_client()

    try:
        pl = yt.get_playlist(playlist_id, limit=50)
        tracks = []
        for t in pl.get("tracks", []):
            vid = t.get("videoId")
            if not vid:
                continue
            artists = [a.get("name") for a in t.get("artists", []) if a.get("name")]
            tracks.append({
                "id": vid,
                "title": t.get("title"),
                "artist": ", ".join(artists) if artists else "Artist",
                "artists": artists,
                "thumbnail": extract_thumbnail(t.get("thumbnails", [])),
                "duration": format_duration(t.get("duration_seconds")),
                "durationSeconds": t.get("duration_seconds"),
                "isCached": get_cached_file(vid) is not None
            })
        return {
            "id": playlist_id,
            "title": pl.get("title", "Playlist"),
            "description": pl.get("description"),
            "thumbnail": extract_thumbnail(pl.get("thumbnails", [])),
            "trackCount": len(tracks),
            "tracks": tracks
        }
    except Exception as e:
        print(f"Error loading playlist {playlist_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# SEARCH & EXPLORE
# ==========================================

@app.get("/api/search")
async def search_tracks(q: str = Query(..., min_length=1), filter: Optional[str] = None):
    """Search for tracks on YouTube Music with metadata and duration"""
    global yt
    if not yt:
        init_yt_client()
    if not yt:
        raise HTTPException(status_code=500, detail="YouTube Music service unavailable")

    try:
        search_filter = None
        if filter in ["songs", "videos", "albums", "artists"]:
            search_filter = filter

        results = yt.search(q, filter=search_filter, limit=25)
        formatted = []
        for r in results:
            result_type = r.get("resultType") or filter or "song"
            vid = r.get("videoId")
            # only playable songs/videos with a title
            if not vid or not r.get("title") or result_type not in ["song", "video"]:
                continue

            artists = [a.get("name") for a in r.get("artists", []) if a.get("name")]
            album = r.get("album", {}).get("name") if isinstance(r.get("album"), dict) else None
            duration_str = r.get("duration") or format_duration(r.get("duration_seconds"))
            thumb = extract_thumbnail(r.get("thumbnails", []))

            is_cached = get_cached_file(vid) is not None if vid else False

            formatted.append({
                "id": vid,
                "title": r.get("title"),
                "artist": ", ".join(artists) if artists else (r.get("uploader") or "Unknown Artist"),
                "artists": artists,
                "album": album,
                "duration": duration_str,
                "durationSeconds": r.get("duration_seconds"),
                "thumbnail": thumb,
                "type": result_type,
                "isCached": is_cached,
            })

        return {"query": q, "results": formatted}
    except Exception as e:
        print(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/charts")
async def get_charts(country: str = "DE"):
    """Get top trending songs and artists (Ad-free)"""
    global yt
    items = []
    if yt:
        try:
            charts = yt.get_charts(country=country)
            if charts:
                songs_data = charts.get("videos", {}).get("items", []) or charts.get("songs", {}).get("items", [])
                for r in songs_data[:30]:
                    vid = r.get("videoId")
                    if not vid:
                        continue
                    artists = [a.get("name") for a in r.get("artists", []) if a.get("name")]
                    thumb = extract_thumbnail(r.get("thumbnails", []))
                    items.append({
                        "id": vid,
                        "title": r.get("title"),
                        "artist": ", ".join(artists) if artists else "Trending Artist",
                        "artists": artists,
                        "thumbnail": thumb,
                        "duration": format_duration(r.get("duration_seconds")),
                        "durationSeconds": r.get("duration_seconds"),
                        "isCached": get_cached_file(vid) is not None
                    })
        except Exception as ex:
            print(f"Error fetching charts: {ex}")

    if not items:
        curated_ids = [
            ("J7p4bzqLvCw", "Blinding Lights", "The Weeknd", "3:22"),
            ("4EQkYVtE-28", "Circles", "Post Malone", "3:35"),
            ("nujn6wbr-e8", "As It Was", "Harry Styles", "2:47"),
            ("XfEMj-z3TtA", "STAY", "The Kid LAROI, Justin Bieber", "2:21"),
            ("dQw4w9WgXcQ", "Never Gonna Give You Up", "Rick Astley", "3:34"),
            ("k2qgadSvNyU", "New Rules", "Dua Lipa", "3:44"),
            ("OPf0YbXqDm0", "Uptown Funk", "Mark Ronson ft. Bruno Mars", "4:30"),
            ("2Vv-BfVoq4g", "Perfect", "Ed Sheeran", "4:23"),
        ]
        for vid, title, artist, dur in curated_ids:
            items.append({
                "id": vid,
                "title": title,
                "artist": artist,
                "artists": [artist],
                "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                "duration": dur,
                "durationSeconds": 200,
                "isCached": get_cached_file(vid) is not None
            })

    return {"country": country, "items": items}


@app.get("/api/explore")
async def get_explore():
    """Get explore moods, genres and playlists"""
    moods = [
        {"id": "charts", "name": "Top Hits 2026", "icon": "Flame", "color": "from-red-600 to-amber-600", "query": "Top Hits 2026 charts"},
        {"id": "german", "name": "Deutschrap & Hip-Hop", "icon": "Radio", "color": "from-emerald-600 to-teal-800", "query": "Deutschrap Top Hits"},
        {"id": "workout", "name": "Workout & Gym", "icon": "Zap", "color": "from-orange-600 to-red-700", "query": "Workout gym motivation music"},
        {"id": "chill", "name": "Chill & Relax", "icon": "Coffee", "color": "from-blue-600 to-indigo-800", "query": "Chill lofi beats relax study"},
        {"id": "focus", "name": "Deep Focus", "icon": "Brain", "color": "from-purple-600 to-violet-900", "query": "Instrumental focus deep work"},
        {"id": "party", "name": "Party & Dance", "icon": "Music", "color": "from-pink-600 to-rose-700", "query": "Dance party electronic hits"},
        {"id": "rock", "name": "Rock Classics", "icon": "Disc", "color": "from-yellow-600 to-orange-800", "query": "Rock classics greatest hits"},
        {"id": "sleep", "name": "Sleep & Meditation", "icon": "Moon", "color": "from-slate-700 to-zinc-900", "query": "Calm ambient music sleep meditation"}
    ]
    return {"moods": moods}


@app.get("/api/radio/{video_id}")
async def get_radio(video_id: str):
    """Get continuous up-next auto-play queue based on playing song"""
    global yt
    tracks = []
    if yt:
        try:
            watch = yt.get_watch_playlist(videoId=video_id, limit=20)
            for t in watch.get("tracks", []):
                vid = t.get("videoId")
                if not vid or vid == video_id:
                    continue
                artists = [a.get("name") for a in t.get("artists", []) if a.get("name")]
                thumb = extract_thumbnail(t.get("thumbnails", []))
                tracks.append({
                    "id": vid,
                    "title": t.get("title"),
                    "artist": ", ".join(artists) if artists else "Artist",
                    "artists": artists,
                    "thumbnail": thumb,
                    "duration": format_duration(t.get("duration_seconds")),
                    "durationSeconds": t.get("duration_seconds"),
                    "isCached": get_cached_file(vid) is not None
                })
        except Exception as e:
            print(f"Error fetching radio for {video_id}: {e}")

    if not tracks:
        try:
            search_res = yt.search("popular music hits", filter="songs", limit=10) if yt else []
            for r in search_res:
                vid = r.get("videoId")
                if vid and vid != video_id:
                    artists = [a.get("name") for a in r.get("artists", []) if a.get("name")]
                    tracks.append({
                        "id": vid,
                        "title": r.get("title"),
                        "artist": ", ".join(artists) if artists else "Artist",
                        "artists": artists,
                        "thumbnail": extract_thumbnail(r.get("thumbnails", [])),
                        "duration": r.get("duration") or "3:30",
                        "isCached": get_cached_file(vid) is not None
                    })
        except Exception:
            pass

    return {"videoId": video_id, "tracks": tracks}


@app.get("/api/lyrics/{video_id}")
async def get_lyrics(video_id: str, title: Optional[str] = None, artist: Optional[str] = None):
    """Fetch synchronized or standard lyrics for song (LRCLIB + YTM fallback)"""
    global yt
    # 1. Try LRCLIB for real-time synchronized karaoke lyrics
    if title:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=4.0) as client:
                params = {"track_name": title}
                if artist:
                    params["artist_name"] = artist
                resp = await client.get("https://lrclib.net/api/get", params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("syncedLyrics"):
                        return {
                            "lyrics": data.get("syncedLyrics"),
                            "isSynced": True,
                            "source": "LRCLIB Synced"
                        }
                    elif data.get("plainLyrics"):
                        return {
                            "lyrics": data.get("plainLyrics"),
                            "isSynced": False,
                            "source": "LRCLIB"
                        }
        except Exception as lrc_err:
            print(f"LRCLIB notice ({title}): {lrc_err}")

    # 2. Fallback to YouTube Music official lyrics
    if yt:
        try:
            watch = yt.get_watch_playlist(videoId=video_id)
            lyrics_id = watch.get("lyrics")
            if lyrics_id:
                res = yt.get_lyrics(lyrics_id)
                if res and res.get("lyrics"):
                    return {
                        "lyrics": res.get("lyrics"),
                        "isSynced": False,
                        "source": res.get("source", "YouTube Music")
                    }
        except Exception as e:
            print(f"Lyrics lookup error {video_id}: {e}")

    return {"lyrics": None, "isSynced": False, "source": None}


# ==========================================
# AUDIO STREAMING (Range Requests, Background Playback, Ad-Free)
# ==========================================

@app.api_route("/api/stream/{video_id}", methods=["GET", "HEAD"])
async def stream_audio(video_id: str, request: Request):
    """
    Stream audio file with HTTP 206 Partial Content Range support.
    Supports instant scrubbing, lockscreen controls, and 100% ad-free playback.
    """
    file_path = get_cached_file(video_id)
    if not file_path:
        file_path = await download_audio(video_id)

    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Audiodatei konnte nicht geladen werden")

    file_size = file_path.stat().st_size
    range_header = request.headers.get("Range")
    content_type = "audio/mp4" if file_path.suffix == ".m4a" else "audio/webm"

    if request.method == "HEAD":
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": content_type,
            "Cache-Control": "public, max-age=31536000",
        }
        return Response(status_code=200, headers=headers)

    if range_header:
        match = re.search(r"bytes=(\d+)-(\d*)", range_header)
        if match:
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else file_size - 1
            if end >= file_size:
                end = file_size - 1
            content_length = end - start + 1

            def iterfile():
                with open(file_path, "rb") as f:
                    f.seek(start)
                    bytes_left = content_length
                    chunk_size = 64 * 1024
                    while bytes_left > 0:
                        read_len = min(chunk_size, bytes_left)
                        data = f.read(read_len)
                        if not data:
                            break
                        bytes_left -= len(data)
                        yield data

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": content_type,
                "Cache-Control": "public, max-age=31536000",
            }
            return StreamingResponse(iterfile(), status_code=206, headers=headers)

    def full_iter():
        with open(file_path, "rb") as f:
            chunk_size = 64 * 1024
            while True:
                data = f.read(chunk_size)
                if not data:
                    break
                yield data

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": content_type,
        "Cache-Control": "public, max-age=31536000",
    }
    return StreamingResponse(full_iter(), status_code=200, headers=headers)


@app.get("/api/download-apk")
async def download_android_apk():
    """Download compiled Android APK file"""
    apk_path = BASE_DIR / "ytmusic-mobile.apk"
    if not apk_path.exists():
        raise HTTPException(status_code=404, detail="APK nicht gefunden")
    return FileResponse(
        path=apk_path,
        media_type="application/vnd.android.package-archive",
        filename="ytmusic-mobile.apk"
    )


@app.get("/api/cache")
async def list_cache():
    """Get list of downloaded offline tracks and cache size"""
    cached_tracks = []
    total_size = 0
    meta = get_cache_metadata()
    for f in CACHE_DIR.glob("*.*"):
        if f.is_file() and f.suffix in [".m4a", ".webm", ".mp3"]:
            size = f.stat().st_size
            total_size += size
            video_id = f.stem
            track_info = meta.get(video_id, {})
            cached_tracks.append({
                "id": video_id,
                "title": track_info.get("title", f"Offline Track ({video_id})"),
                "artist": track_info.get("artist", "YouTube Music Offline"),
                "thumbnail": track_info.get("thumbnail", f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"),
                "duration": track_info.get("duration", "3:30"),
                "filename": f.name,
                "sizeBytes": size,
                "sizeFormatted": f"{size / (1024 * 1024):.1f} MB",
                "isCached": True
            })
    return {
        "totalSizeBytes": total_size,
        "totalSizeMB": f"{total_size / (1024 * 1024):.1f} MB",
        "count": len(cached_tracks),
        "tracks": cached_tracks
    }


@app.delete("/api/cache/{video_id}")
async def delete_cached_track(video_id: str):
    """Delete a track from offline cache"""
    deleted = False
    for ext in ["m4a", "webm", "mp3"]:
        p = CACHE_DIR / f"{video_id}.{ext}"
        if p.exists():
            p.unlink()
            deleted = True
    meta = get_cache_metadata()
    if video_id in meta:
        del meta[video_id]
        save_cache_metadata(meta)
    return {"id": video_id, "deleted": deleted}


@app.post("/api/download/{video_id}")
async def trigger_download(
    video_id: str,
    background_tasks: BackgroundTasks,
    payload: Optional[Dict[str, Any]] = Body(None)
):
    """Pre-download a track into offline cache"""
    cached = get_cached_file(video_id)
    track_meta = payload if payload else {}
    if cached:
        if track_meta:
            meta = get_cache_metadata()
            meta[video_id] = track_meta
            save_cache_metadata(meta)
        return {"id": video_id, "status": "ready"}

    background_tasks.add_task(download_audio, video_id, track_meta)
    return {"id": video_id, "status": "downloading"}


from fastapi.staticfiles import StaticFiles

# If frontend/dist exists, mount it for seamless single-port hosting
dist_dir = BASE_DIR / "frontend" / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=True)
