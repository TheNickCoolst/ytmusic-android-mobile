// Direct YouTube / YouTube Music access from the phone itself (no Mac server needed).
// Uses native HTTP (CapacitorHttp) inside the Android app so CORS does not apply.
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Track } from '../types';

export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

type HttpFn = (url: string, opts: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: any }) => Promise<any>;

// Native HTTP in the APK; plain fetch elsewhere (only useful outside a browser, e.g. tests)
let http: HttpFn = async (url, opts) => {
  if (isNativeApp()) {
    const res = await CapacitorHttp.request({
      url,
      method: opts.method,
      headers: opts.headers,
      data: opts.body,
      responseType: 'text',
      connectTimeout: 10000,
      readTimeout: 15000,
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }
  const res = await fetch(url, {
    method: opts.method,
    headers: opts.headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
};

export const setHttpForTests = (fn: HttpFn) => {
  http = fn;
};

const VISION_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const WEB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const MUSIC_CLIENT = { clientName: 'WEB_REMIX', clientVersion: '1.20260707.12.00', hl: 'de', gl: 'DE' };

// ---------- visitor data ----------
let visitorData: string | null = null;
let visitorPromise: Promise<string | null> | null = null;

const getVisitorData = async (): Promise<string | null> => {
  if (visitorData) return visitorData;
  if (!visitorPromise) {
    visitorPromise = (async () => {
      try {
        const txt: string = await http('https://www.youtube.com/sw.js_data', {
          method: 'GET',
          headers: { 'User-Agent': WEB_UA },
        });
        const m = txt.match(/"(Cg[t-z][A-Za-z0-9_%-]{20,})"/);
        visitorData = m ? m[1] : null;
      } catch (e) {
        console.warn('visitorData fetch failed', e);
        visitorData = null;
      }
      visitorPromise = null;
      return visitorData;
    })();
  }
  return visitorPromise;
};

// ---------- audio stream URL ----------
const urlCache = new Map<string, { url: string; expires: number }>();

export const getDirectAudioUrl = async (videoId: string): Promise<string> => {
  const cached = urlCache.get(videoId);
  if (cached && cached.expires > Date.now()) return cached.url;

  const vd = await getVisitorData();
  const body = {
    context: {
      client: {
        clientName: 'VISIONOS',
        clientVersion: '1.02',
        deviceMake: 'Apple',
        deviceModel: 'RealityDevice17,1',
        userAgent: VISION_UA,
        osName: 'visionOS',
        osVersion: '26.5.23O471',
        hl: 'de',
        gl: 'DE',
        ...(vd ? { visitorData: vd } : {}),
      },
    },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': VISION_UA,
    'X-YouTube-Client-Name': '101',
    'X-YouTube-Client-Version': '1.02',
    Origin: 'https://www.youtube.com',
  };
  if (vd) headers['X-Goog-Visitor-Id'] = vd;

  const txt = await http('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers,
    body,
  });
  const data = JSON.parse(txt);
  const status = data?.playabilityStatus?.status;
  if (status !== 'OK') {
    // visitor data may be stale -> refresh next time
    visitorData = null;
    throw new Error(`Nicht abspielbar: ${status} ${data?.playabilityStatus?.reason || ''}`);
  }
  const formats: any[] = (data?.streamingData?.adaptiveFormats || []).filter(
    (f: any) => typeof f.mimeType === 'string' && f.mimeType.startsWith('audio') && f.url
  );
  // Prefer AAC m4a (plays everywhere), then Opus
  const pick =
    formats.find((f) => f.itag === 140) ||
    formats.find((f) => f.itag === 251) ||
    formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  if (!pick) throw new Error('Keine Audio-Formate gefunden');

  const ttl = Math.max(60, (parseInt(data.streamingData.expiresInSeconds, 10) || 3600) - 300) * 1000;
  urlCache.set(videoId, { url: pick.url, expires: Date.now() + ttl });
  return pick.url;
};

// ---------- YouTube Music (WEB_REMIX) ----------
const musicRequest = async (endpoint: string, payload: Record<string, any>): Promise<any> => {
  const vd = await getVisitorData();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': WEB_UA,
    Origin: 'https://music.youtube.com',
    Referer: 'https://music.youtube.com/',
    'X-YouTube-Client-Name': '67',
    'X-YouTube-Client-Version': MUSIC_CLIENT.clientVersion,
  };
  if (vd) headers['X-Goog-Visitor-Id'] = vd;
  const txt = await http(`https://music.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers,
    body: { context: { client: { ...MUSIC_CLIENT, ...(vd ? { visitorData: vd } : {}) } }, ...payload },
  });
  return JSON.parse(txt);
};

const collect = (node: any, key: string, out: any[] = []): any[] => {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const n of node) collect(n, key, out);
    return out;
  }
  for (const k of Object.keys(node)) {
    if (k === key) out.push(node[k]);
    else collect(node[k], key, out);
  }
  return out;
};

const runsText = (t: any): string => (t?.runs || []).map((r: any) => r.text).join('') || t?.simpleText || '';

const bestThumb = (thumbs: any[] | undefined, videoId: string): string => {
  if (thumbs && thumbs.length) {
    let url: string = thumbs[thumbs.length - 1].url || '';
    if (url.startsWith('//')) url = 'https:' + url;
    // upscale googleusercontent thumbnails
    url = url.replace(/=w\d+-h\d+/, '=w544-h544');
    if (url) return url;
  }
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
};

const parseDuration = (s: string): number | undefined => {
  if (!/^\d+(:\d+)+$/.test(s)) return undefined;
  return s.split(':').reduce((acc, p) => acc * 60 + parseInt(p, 10), 0);
};

const parseListItem = (r: any): Track | null => {
  const videoId =
    r?.playlistItemData?.videoId ||
    collect(r?.overlay, 'watchEndpoint')[0]?.videoId ||
    collect(r?.flexColumns, 'watchEndpoint')[0]?.videoId;
  if (!videoId) return null;
  const cols = (r.flexColumns || []).map((c: any) => c?.musicResponsiveListItemFlexColumnRenderer?.text);
  const title = runsText(cols[0]);
  const metaRuns: any[] = cols[1]?.runs || [];
  const parts = metaRuns.map((x: any) => x.text).join('').split(' • ').map((s: string) => s.trim()).filter(Boolean);
  const kinds = ['Song', 'Video', 'Titel', 'Folge', 'Episode'];
  const metaParts = parts.filter((p: string) => !kinds.includes(p));
  const artistRuns = metaRuns.filter((x: any) => {
    const pt = x?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
      ?.browseEndpointContextMusicConfig?.pageType;
    return pt === 'MUSIC_PAGE_TYPE_ARTIST' || pt === 'MUSIC_PAGE_TYPE_USER_CHANNEL';
  });
  const artists = artistRuns.length ? artistRuns.map((x: any) => x.text) : metaParts[0] ? [metaParts[0]] : [];
  const albumRun = metaRuns.find(
    (x: any) =>
      x?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig
        ?.pageType === 'MUSIC_PAGE_TYPE_ALBUM'
  );
  let duration = metaParts.find((p: string) => /^\d+(:\d+)+$/.test(p));
  if (!duration) {
    const fixed = runsText(r.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text);
    if (/^\d+(:\d+)+$/.test(fixed)) duration = fixed;
  }
  return {
    id: videoId,
    title: title || 'Unbekannt',
    artist: artists.join(', ') || 'Unbekannt',
    artists,
    album: albumRun?.text,
    duration,
    durationSeconds: duration ? parseDuration(duration) : undefined,
    thumbnail: bestThumb(r?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails, videoId),
    type: 'song',
  };
};

const SONGS_PARAM = 'EgWKAQIIAWoMEA4QChADEAQQCRAF';

const VIDEOS_PARAM = 'EgWKAQIQAWoMEA4QChADEAQQCRAF';

const searchWith = async (query: string, params: string): Promise<Track[]> => {
  const data = await musicRequest('search', { query, params });
  return collect(data, 'musicResponsiveListItemRenderer')
    .map(parseListItem)
    .filter((t): t is Track => !!t);
};

export const searchSongs = async (query: string): Promise<Track[]> => {
  const out: Track[] = [];
  const seen = new Set<string>();
  for (const t of await searchWith(query, SONGS_PARAM)) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
};

// Songs + music videos (many tracks only exist as official videos)
export const searchAll = async (query: string): Promise<Track[]> => {
  const [songs, videos] = await Promise.all([
    searchWith(query, SONGS_PARAM).catch(() => [] as Track[]),
    searchWith(query, VIDEOS_PARAM).catch(() => [] as Track[]),
  ]);
  const out: Track[] = [];
  const seen = new Set<string>();
  // interleave: top video first often is the exact hit for new releases
  const merged = [...videos.slice(0, 2), ...songs, ...videos.slice(2)];
  for (const t of merged) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
};

export const getLyricsDirect = async (
  title?: string,
  artist?: string
): Promise<{ lyrics: string | null; isSynced: boolean; source: string | null }> => {
  if (!title) return { lyrics: null, isSynced: false, source: null };
  const q = new URLSearchParams({ track_name: title, artist_name: artist || '' });
  try {
    const txt = await http(`https://lrclib.net/api/get?${q.toString()}`, {
      method: 'GET',
      headers: { 'User-Agent': 'ytmusic-mobile (https://github.com)' },
    });
    const d = JSON.parse(txt);
    if (d?.syncedLyrics) return { lyrics: d.syncedLyrics, isSynced: true, source: 'LRCLIB' };
    if (d?.plainLyrics) return { lyrics: d.plainLyrics, isSynced: false, source: 'LRCLIB' };
  } catch {
    /* not found */
  }
  return { lyrics: null, isSynced: false, source: null };
};

export const getRadioTracks = async (videoId: string): Promise<Track[]> => {
  const data = await musicRequest('next', {
    videoId,
    playlistId: `RDAMVM${videoId}`,
    isAudioOnly: true,
    enablePersistentPlaylistPanel: true,
    tunerSettingValue: 'AUTOMIX_SETTING_NORMAL',
  });
  const items = collect(data, 'playlistPanelVideoRenderer');
  const out: Track[] = [];
  const seen = new Set<string>([videoId]);
  for (const r of items) {
    const id = r?.videoId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const byline: any[] = r?.longBylineText?.runs || r?.shortBylineText?.runs || [];
    const artistRuns = byline.filter(
      (x: any) =>
        x?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig
          ?.pageType === 'MUSIC_PAGE_TYPE_ARTIST'
    );
    const artists = artistRuns.length
      ? artistRuns.map((x: any) => x.text)
      : [byline.map((x: any) => x.text).join('').split(' • ')[0]].filter(Boolean);
    const duration = runsText(r?.lengthText) || undefined;
    out.push({
      id,
      title: runsText(r?.title) || 'Unbekannt',
      artist: artists.join(', ') || 'Unbekannt',
      artists,
      duration,
      durationSeconds: duration ? parseDuration(duration) : undefined,
      thumbnail: bestThumb(r?.thumbnail?.thumbnails, id),
      type: 'song',
    });
  }
  return out;
};

// Home feed built from music searches (used when the Mac server is not reachable)
export const getNativeHomeShelves = async (): Promise<any[]> => {
  const [hits, de] = await Promise.all([
    searchSongs('Top Hits 2026').catch(() => [] as Track[]),
    searchSongs('Deutschrap Charts').catch(() => [] as Track[]),
  ]);
  const shelves: any[] = [];
  const quick = hits.slice(0, 16);
  if (quick.length) {
    const columns: Track[][] = [];
    for (let i = 0; i < quick.length; i += 4) columns.push(quick.slice(i, i + 4));
    shelves.push({
      id: 'quick_picks',
      title: 'Schnellauswahl',
      subtitle: 'STARTET EINE RADIOSTATION',
      type: 'columns_4',
      columns,
      tracks: quick,
    });
  }
  if (de.length) {
    shelves.push({
      id: 'charts_de',
      title: 'Charts & Trends',
      subtitle: 'DEUTSCHLAND',
      type: 'rankings',
      items: de.slice(0, 20).map((t, i) => ({ ...t, rank: i + 1 })),
      tracks: de.slice(0, 20),
    });
  }
  return shelves;
};
