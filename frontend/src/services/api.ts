import { Track, MoodCategory, LyricsResponse } from '../types';
import * as yt from './youtube';
import * as offline from './offline';

// ---- Mac server reachability (the app works without it in the native APK) ----
let serverDownUntil = 0;
export const isServerMarkedDown = () => Date.now() < serverDownUntil;
const markServerDown = () => {
  serverDownUntil = Date.now() + 60_000;
};
const markServerUp = () => {
  serverDownUntil = 0;
};

/** In the app everything goes directly to YouTube (the Mac only signs/updates the apps);
 *  the Mac server is used only by the browser version. */
async function withFallback<T>(serverCall: (signal: AbortSignal) => Promise<T>, nativeCall: () => Promise<T>): Promise<T> {
  if (yt.isNativeApp()) return nativeCall();
  try {
    const result = await serverCall(AbortSignal.timeout(15000));
    markServerUp();
    return result;
  } catch (e) {
    markServerDown();
    throw e;
  }
}

const PROFILE_KEY = 'ytmusic_google_profile';
const nativeAuth = () => yt.isNativeApp() && !!yt.getStoredCookie();
const loadProfile = (): UserProfile | null => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const saveProfile = (p: UserProfile | null) => {
  try {
    if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
};

export interface UserProfile {
  isLoggedIn: boolean;
  name: string;
  handle?: string | null;
  avatar?: string | null;
}

// Dynamic API Base Resolution
export const getApiBase = (): string => {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000/api';

  // 1. User manual override in localStorage
  let saved: string | null = null;
  try { saved = localStorage.getItem('ytmusic_server_url'); } catch { /* ignore */ }
  if (saved) return `${saved.replace(/\/+$/, '')}/api`;

  // 2. If running in browser or PWA where port is 8000
  if (window.location.port === '8000') {
    return `${window.location.origin}/api`;
  }

  // 3. If running on another port or domain (e.g. 192.168.178.183:5173 or dev)
  if (window.location.hostname && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.')) {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }

  // 4. Fallback for native Android APK: the Mac's LAN IP
  return 'http://192.168.178.183:8000/api';
};

export const api = {
  // Auth & Account
  // In the APK the Google cookie lives on the phone and all account calls go directly to YouTube.
  async getAuthStatus(): Promise<UserProfile> {
    if (yt.isNativeApp()) {
      const cookie = yt.getStoredCookie();
      if (!cookie) return { isLoggedIn: false, name: 'Gast' };
      const cached = loadProfile();
      if (cached) {
        // refresh in background, keep cached profile on network errors
        yt.getAccountInfo(cookie).then(saveProfile).catch(() => {});
        return cached;
      }
      try {
        const p = await yt.getAccountInfo(cookie);
        saveProfile(p);
        return p;
      } catch {
        return { isLoggedIn: false, name: 'Gast' };
      }
    }
    try {
      const res = await fetch(`${getApiBase()}/auth/status`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return { isLoggedIn: false, name: 'Gast' };
      return await res.json();
    } catch {
      return { isLoggedIn: false, name: 'Gast' };
    }
  },

  async login(authData: string): Promise<{ status: string; profile: UserProfile }> {
    if (yt.isNativeApp()) {
      const cookie = yt.normalizeCookieInput(authData);
      if (!yt.cookieHasAuth(cookie)) {
        throw new Error('Keine gültige Google-Anmeldung gefunden (SAPISID fehlt). Bitte erneut anmelden.');
      }
      const profile = await yt.getAccountInfo(cookie);
      yt.setStoredCookie(cookie);
      saveProfile(profile);
      return { status: 'success', profile };
    }
    const res = await fetch(`${getApiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth: authData })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Anmeldung fehlgeschlagen' }));
      throw new Error(err.detail || 'Anmeldung fehlgeschlagen');
    }
    return await res.json();
  },

  async logout(): Promise<void> {
    if (yt.isNativeApp()) {
      yt.setStoredCookie(null);
      saveProfile(null);
      return;
    }
    await fetch(`${getApiBase()}/auth/logout`, { method: 'POST' });
  },

  async getUserPlaylists(): Promise<{ id: string; title: string; trackCount?: number; thumbnail: string }[]> {
    if (nativeAuth()) return yt.getLibraryPlaylists();
    const res = await fetch(`${getApiBase()}/auth/library/playlists`);
    if (!res.ok) throw new Error('Could not fetch playlists');
    const data = await res.json();
    return data.playlists || [];
  },

  async getUserLikedSongs(): Promise<Track[]> {
    if (nativeAuth()) return yt.getLikedSongs();
    const res = await fetch(`${getApiBase()}/auth/library/liked`);
    if (!res.ok) throw new Error('Could not fetch liked songs');
    const data = await res.json();
    return data.tracks || [];
  },

  async getUserHistory(): Promise<Track[]> {
    if (nativeAuth()) return yt.getHistory();
    const res = await fetch(`${getApiBase()}/auth/library/history`);
    if (!res.ok) throw new Error('Could not fetch history');
    const data = await res.json();
    return data.history || [];
  },

  async likeTrackOnYouTube(trackId: string): Promise<void> {
    try {
      if (nativeAuth()) return await yt.rateSong(trackId, true);
      if (yt.isNativeApp()) return;
      await fetch(`${getApiBase()}/auth/track/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trackId })
      });
    } catch (e) {
      console.warn('Failed to sync like with YouTube:', e);
    }
  },

  async unlikeTrackOnYouTube(trackId: string): Promise<void> {
    try {
      if (nativeAuth()) return await yt.rateSong(trackId, false);
      if (yt.isNativeApp()) return;
      await fetch(`${getApiBase()}/auth/track/unlike`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trackId })
      });
    } catch (e) {
      console.warn('Failed to sync unlike with YouTube:', e);
    }
  },

  // Content & Feed
  async getHomeFeed(country = 'DE', chipParams?: string): Promise<{ shelves: any[]; chips?: yt.HomeChip[]; continuation?: string | null }> {
    // APK: the real YouTube Music start page, personalised with the phone's Google login
    if (yt.isNativeApp()) {
      try {
        const h = await yt.getHome(chipParams);
        if (h.shelves.length) return h;
      } catch (e) {
        console.warn('YouTube Music home failed, falling back', e);
      }
    }
    try {
      return await withFallback(
        async (signal) => {
          const res = await fetch(`${getApiBase()}/home?country=${country}`, { signal });
          if (!res.ok) throw new Error('Home feed failed');
          return await res.json();
        },
        async () => {
          const shelves = await yt.getNativeHomeShelves();
          if (!shelves.length) throw new Error('native home empty');
          return { shelves };
        }
      );
    } catch (e) {
      console.warn('Backend home feed unreachable, using offline fallback shelves');
      return {
        shelves: [
          {
            id: 'quick_picks',
            title: 'Schnellauswahl',
            subtitle: 'STARTET EINE RADIOSTATION',
            type: 'columns_4',
            columns: [
              [
                { id: 'J7p4bzqLvCw', title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/J7p4bzqLvCw/hqdefault.jpg', duration: '3:22' },
                { id: '4EQkYVtE-28', title: 'Circles', artist: 'Post Malone', thumbnail: 'https://i.ytimg.com/vi/4EQkYVtE-28/hqdefault.jpg', duration: '3:35' },
                { id: 'nujn6wbr-e8', title: 'As It Was', artist: 'Harry Styles', thumbnail: 'https://i.ytimg.com/vi/nujn6wbr-e8/hqdefault.jpg', duration: '2:47' },
                { id: 'XfEMj-z3TtA', title: 'STAY', artist: 'The Kid LAROI, Justin Bieber', thumbnail: 'https://i.ytimg.com/vi/XfEMj-z3TtA/hqdefault.jpg', duration: '2:21' },
              ],
              [
                { id: 'k2qgadSvNyU', title: 'New Rules', artist: 'Dua Lipa', thumbnail: 'https://i.ytimg.com/vi/k2qgadSvNyU/hqdefault.jpg', duration: '3:44' },
                { id: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', thumbnail: 'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg', duration: '4:30' },
                { id: '2Vv-BfVoq4g', title: 'Perfect', artist: 'Ed Sheeran', thumbnail: 'https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg', duration: '4:23' },
                { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', duration: '3:34' },
              ]
            ],
            tracks: [
              { id: 'J7p4bzqLvCw', title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/J7p4bzqLvCw/hqdefault.jpg', duration: '3:22' },
              { id: '4EQkYVtE-28', title: 'Circles', artist: 'Post Malone', thumbnail: 'https://i.ytimg.com/vi/4EQkYVtE-28/hqdefault.jpg', duration: '3:35' },
              { id: 'nujn6wbr-e8', title: 'As It Was', artist: 'Harry Styles', thumbnail: 'https://i.ytimg.com/vi/nujn6wbr-e8/hqdefault.jpg', duration: '2:47' },
              { id: 'XfEMj-z3TtA', title: 'STAY', artist: 'The Kid LAROI, Justin Bieber', thumbnail: 'https://i.ytimg.com/vi/XfEMj-z3TtA/hqdefault.jpg', duration: '2:21' },
            ]
          }
        ]
      };
    }
  },

  async getHomeMore(token: string): Promise<{ shelves: any[]; continuation: string | null }> {
    return yt.getHomeContinuation(token);
  },

  async getCardTracks(card: yt.HomeCard): Promise<Track[]> {
    return yt.getCardTracks(card);
  },

  async getPlaylist(playlistId: string): Promise<any> {
    // Logged in on the phone: load directly (private playlists need the phone's cookie)
    if (nativeAuth()) return yt.getPlaylistDirect(playlistId);
    return withFallback(
      async (signal) => {
        const res = await fetch(`${getApiBase()}/playlist/${playlistId}`, { signal });
        if (!res.ok) throw new Error('Playlist failed');
        return await res.json();
      },
      () => yt.getPlaylistDirect(playlistId)
    );
  },

  async search(query: string, filter?: string): Promise<Track[]> {
    // "Künstler" = songs by that artist (artist pages themselves are not playable)
    const f = filter === 'artists' ? 'songs' : filter;
    const params = new URLSearchParams({ q: query });
    if (f && f !== 'all') {
      params.append('filter', f);
    }
    const results = await withFallback(
      async (signal) => {
        const res = await fetch(`${getApiBase()}/search?${params.toString()}`, { signal });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        return (data.results || []) as Track[];
      },
      () => (f === 'songs' ? yt.searchSongs(query) : yt.searchAll(query))
    );
    // Only playable entries with a real title (no artist/album/radio cards)
    return results
      .filter((t: any) => t && t.id && t.title && !['artist', 'album', 'playlist', 'podcast', 'episode'].includes(t.type))
      .filter((t: any) => !/^radio\s*[•·]/i.test(t.title))
      .map((t: any) => ({
        ...t,
        artist: t.artist && t.artist !== 'Unknown Artist' ? t.artist : 'Unbekannt',
        duration: t.duration && t.duration !== '0:00' ? t.duration : undefined,
      }));
  },

  async getCharts(country = 'DE'): Promise<Track[]> {
    return withFallback(
      async (signal) => {
        const res = await fetch(`${getApiBase()}/charts?country=${country}`, { signal });
        if (!res.ok) throw new Error('Charts failed');
        const data = await res.json();
        return data.items || [];
      },
      async () => (await yt.searchSongs('Charts Deutschland')).slice(0, 20).map((t, i) => ({ ...t, rank: i + 1 }))
    );
  },

  async getExplore(): Promise<MoodCategory[]> {
    const res = await fetch(`${getApiBase()}/explore`);
    if (!res.ok) throw new Error('Explore failed');
    const data = await res.json();
    return data.moods || [];
  },

  async getRadio(videoId: string): Promise<Track[]> {
    try {
      return await withFallback(
        async (signal) => {
          const res = await fetch(`${getApiBase()}/radio/${videoId}`, { signal });
          if (!res.ok) throw new Error('Radio failed');
          const data = await res.json();
          return data.tracks || [];
        },
        () => yt.getRadioTracks(videoId)
      );
    } catch {
      return [];
    }
  },

  async getLyrics(videoId: string, title?: string, artist?: string): Promise<LyricsResponse> {
    try {
      const params = new URLSearchParams();
      if (title) params.append('title', title);
      if (artist) params.append('artist', artist);
      const q = params.toString() ? `?${params.toString()}` : '';
      return await withFallback(
        async (signal) => {
          const res = await fetch(`${getApiBase()}/lyrics/${videoId}${q}`, { signal });
          if (!res.ok) throw new Error('Lyrics failed');
          return await res.json();
        },
        () => yt.getLyricsDirect(title, artist)
      );
    } catch {
      return { lyrics: null, isSynced: false, source: null };
    }
  },

  /** Best playable URL: offline copy, else in the app direct from YouTube, in the browser via the server.
   *  `fresh` (app) drops the cached YouTube URL, e.g. after a playback error. */
  async resolvePlaybackUrl(videoId: string, fresh = false): Promise<{ url: string; direct: boolean }> {
    if (offline.isOffline(videoId)) {
      const local = await offline.getOfflineUrl(videoId);
      if (local) return { url: local, direct: true };
    }
    if (yt.isNativeApp()) {
      if (fresh) yt.forgetAudioUrl(videoId);
      try {
        return { url: await yt.getDirectAudioUrl(videoId), direct: true };
      } catch (e) {
        console.warn('Direct YouTube stream failed, retrying:', e);
        yt.forgetAudioUrl(videoId);
        return { url: await yt.getDirectAudioUrl(videoId), direct: true };
      }
    }
    return { url: this.getStreamUrl(videoId), direct: false };
  },

  getStreamUrl(videoId: string): string {
    return `${getApiBase()}/stream/${videoId}`;
  },

  async getCacheList() {
    if (yt.isNativeApp()) return offline.listOffline();
    try {
      const res = await fetch(`${getApiBase()}/cache`);
      if (!res.ok) return { totalSizeMB: '0 MB', count: 0, tracks: [] };
      return await res.json();
    } catch {
      return { totalSizeMB: '0 MB', count: 0, tracks: [] };
    }
  },

  async deleteFromCache(videoId: string) {
    if (yt.isNativeApp()) {
      await offline.deleteOffline(videoId);
      return { ok: true };
    }
    const res = await fetch(`${getApiBase()}/cache/${videoId}`, { method: 'DELETE' });
    return await res.json();
  },

  /** In the app: saved on the phone itself. In the browser: cached by the Mac server. */
  async downloadTrack(videoId: string, meta?: { title?: string; artist?: string; thumbnail?: string; duration?: string }) {
    if (yt.isNativeApp()) {
      await offline.downloadOffline(videoId, meta);
      return { ok: true };
    }
    const res = await fetch(`${getApiBase()}/download/${videoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta || {})
    });
    if (!res.ok) throw new Error(`Download fehlgeschlagen (HTTP ${res.status})`);
    return await res.json();
  },

  isDownloaded(videoId: string): boolean {
    return offline.isOffline(videoId);
  }
};
