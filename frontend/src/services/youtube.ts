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
      // iOS native HTTP can't read sw.js_data (it tries to parse it as JSON): ask InnerTube directly.
      // Without visitor data the player answers LOGIN_REQUIRED ("confirm you're not a bot").
      if (!visitorData) {
        try {
          const txt = await http('https://music.youtube.com/youtubei/v1/visitor_id?prettyPrint=false', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': WEB_UA, Origin: 'https://music.youtube.com' },
            body: { context: { client: MUSIC_CLIENT } },
          });
          visitorData = JSON.parse(txt)?.responseContext?.visitorData || null;
        } catch (e) {
          console.warn('visitor_id fetch failed', e);
        }
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

// ---------- Google account (cookie stored on the phone) ----------
const COOKIE_KEY = 'ytmusic_google_cookie';

export const getStoredCookie = (): string | null => {
  try {
    return localStorage.getItem(COOKIE_KEY);
  } catch {
    return null;
  }
};

export const setStoredCookie = (cookie: string | null) => {
  try {
    if (cookie) localStorage.setItem(COOKIE_KEY, cookie);
    else localStorage.removeItem(COOKIE_KEY);
  } catch {
    /* ignore */
  }
};

/** Normalise pasted input: raw cookie string, "Cookie: ..." line or full request headers. */
export const normalizeCookieInput = (raw: string): string => {
  const text = raw.trim();
  const line = text.split(/\r?\n/).find((l) => /^cookie\s*:/i.test(l.trim()));
  let cookie = line ? line.replace(/^\s*cookie\s*:\s*/i, '') : text.replace(/^cookie\s*:\s*/i, '');
  cookie = cookie.replace(/\s*\r?\n\s*/g, ' ').trim();
  return cookie;
};

const cookieValue = (cookie: string, name: string): string | null => {
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.$]/g, '\\$&')}=([^;]+)`));
  return m ? m[1].trim() : null;
};

export const cookieHasAuth = (cookie: string): boolean =>
  !!(cookieValue(cookie, 'SAPISID') || cookieValue(cookie, '__Secure-3PAPISID'));

// Small synchronous SHA-1 (crypto.subtle is not available in every WebView context)
const sha1Hex = (msg: string): string => {
  const bytes = Array.from(new TextEncoder().encode(msg));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Array<number>(80);
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    }
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = t;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
};

const ORIGIN = 'https://music.youtube.com';

const authHeaders = (cookie: string): Record<string, string> => {
  const sapisid = cookieValue(cookie, '__Secure-3PAPISID') || cookieValue(cookie, 'SAPISID');
  const h: Record<string, string> = { Cookie: cookie, 'X-Goog-AuthUser': '0', 'X-Origin': ORIGIN };
  if (sapisid) {
    const ts = Math.floor(Date.now() / 1000);
    h.Authorization = `SAPISIDHASH ${ts}_${sha1Hex(`${ts} ${sapisid} ${ORIGIN}`)}`;
  }
  return h;
};

// ---------- YouTube Music (WEB_REMIX) ----------
const musicRequest = async (endpoint: string, payload: Record<string, any>, cookieArg?: string | null): Promise<any> => {
  // logged in on the phone -> every request is personalised for the account
  const cookie = cookieArg === undefined ? getStoredCookie() : cookieArg;
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
  if (cookie) Object.assign(headers, authHeaders(cookie));
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

const parsePanel = (data: any, exclude?: string): Track[] => {
  const items = collect(data, 'playlistPanelVideoRenderer');
  const out: Track[] = [];
  const seen = new Set<string>(exclude ? [exclude] : []);
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
    const albumRun = byline.find(
      (x: any) =>
        x?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig
          ?.pageType === 'MUSIC_PAGE_TYPE_ALBUM'
    );
    const duration = runsText(r?.lengthText) || undefined;
    out.push({
      id,
      title: runsText(r?.title) || 'Unbekannt',
      artist: artists.join(', ') || 'Unbekannt',
      artists,
      album: albumRun?.text,
      duration,
      durationSeconds: duration ? parseDuration(duration) : undefined,
      thumbnail: bestThumb(r?.thumbnail?.thumbnails, id),
      type: 'song',
    });
  }
  return out;
};

export const getRadioTracks = async (videoId: string): Promise<Track[]> => {
  const data = await musicRequest('next', {
    videoId,
    playlistId: `RDAMVM${videoId}`,
    isAudioOnly: true,
    enablePersistentPlaylistPanel: true,
    tunerSettingValue: 'AUTOMIX_SETTING_NORMAL',
  });
  return parsePanel(data, videoId);
};

/** Queue of any playlist / album / mix (same as tapping "play" on a card in YouTube Music). */
export const getWatchPlaylist = async (playlistId: string, videoId?: string, params?: string): Promise<Track[]> => {
  const data = await musicRequest('next', {
    playlistId,
    ...(videoId ? { videoId } : {}),
    ...(params ? { params } : {}),
    isAudioOnly: true,
    enablePersistentPlaylistPanel: true,
  });
  return parsePanel(data);
};

// ---------- real YouTube Music start page (personalised when logged in) ----------
export interface HomeCard {
  kind: 'song' | 'playlist' | 'album' | 'artist';
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  videoId?: string;
  playlistId?: string;
  playParams?: string;
  browseId?: string;
}

export interface HomeChip {
  title: string;
  params: string;
}

const pageTypeOf = (ep: any): string =>
  ep?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';

const parseTwoRow = (r: any): HomeCard | null => {
  const title = runsText(r?.title);
  if (!title) return null;
  const nav = r.navigationEndpoint || {};
  const play =
    r.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint || {};
  const watch = nav.watchEndpoint || play.watchEndpoint;
  const wpl = play.watchPlaylistEndpoint || nav.watchPlaylistEndpoint;
  const browseId: string | undefined = nav.browseEndpoint?.browseId;
  const pt = pageTypeOf(nav);
  let kind: HomeCard['kind'] = 'playlist';
  if (nav.watchEndpoint?.videoId) kind = 'song';
  else if (pt.includes('ALBUM')) kind = 'album';
  else if (pt.includes('ARTIST') || pt.includes('USER_CHANNEL')) kind = 'artist';
  const playlistId =
    wpl?.playlistId || watch?.playlistId || (browseId?.startsWith('VL') ? browseId.slice(2) : undefined);
  const thumbs = r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails;
  return {
    kind,
    id: watch?.videoId || playlistId || browseId || title,
    title,
    subtitle: runsText(r.subtitle),
    thumbnail: bestThumb(thumbs, watch?.videoId || ''),
    videoId: kind === 'song' ? watch?.videoId : undefined,
    playlistId,
    playParams: wpl?.params || watch?.params,
    browseId,
  };
};

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

let shelfSeq = 0;
const parseSections = (contents: any[]): any[] => {
  const shelves: any[] = [];
  for (const sec of contents || []) {
    const sh = sec.musicCarouselShelfRenderer || sec.musicImmersiveCarouselShelfRenderer;
    if (!sh) continue;
    const hdr = sh.header?.musicCarouselShelfBasicHeaderRenderer || sh.header?.musicImmersiveCarouselShelfBasicHeaderRenderer;
    const title = runsText(hdr?.title);
    const strapline = runsText(hdr?.strapline);
    const items: any[] = sh.contents || [];
    const tracks = items
      .map((c) => c.musicResponsiveListItemRenderer)
      .filter(Boolean)
      .map(parseListItem)
      .filter((t): t is Track => !!t);
    const cards = items
      .map((c) => c.musicTwoRowItemRenderer)
      .filter(Boolean)
      .map(parseTwoRow)
      .filter((c): c is HomeCard => !!c);
    const id = `yt_${shelfSeq++}`;
    if (tracks.length && tracks.length >= cards.length) {
      shelves.push({
        id,
        title: title || 'Für dich',
        subtitle: strapline,
        type: 'columns_4',
        columns: chunk(tracks, sh.numItemsPerColumn ? parseInt(sh.numItemsPerColumn, 10) || 4 : 4),
        tracks,
      });
    } else if (cards.length) {
      shelves.push({ id, title: title || 'Für dich', subtitle: strapline, type: 'cards', items: cards });
    }
  }
  return shelves;
};

const continuationOf = (node: any): string | null =>
  node?.continuations?.[0]?.nextContinuationData?.continuation || null;

/** First page of the start page (or a mood/genre chip) + chips + continuation token. */
export const getHome = async (
  chipParams?: string
): Promise<{ shelves: any[]; chips: HomeChip[]; continuation: string | null }> => {
  const data = await musicRequest('browse', { browseId: 'FEmusic_home', ...(chipParams ? { params: chipParams } : {}) });
  const sl = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer;
  const chips: HomeChip[] = (sl?.header?.chipCloudRenderer?.chips || [])
    .map((c: any) => c.chipCloudChipRenderer)
    .filter(Boolean)
    .map((c: any) => ({
      title: runsText(c.text),
      params: c.navigationEndpoint?.browseEndpoint?.params || '',
    }))
    .filter((c: HomeChip) => c.title && c.params && !/podcast/i.test(c.title));
  return { shelves: parseSections(sl?.contents), chips, continuation: continuationOf(sl) };
};

export const getHomeContinuation = async (token: string): Promise<{ shelves: any[]; continuation: string | null }> => {
  const vd = await getVisitorData();
  const cookie = getStoredCookie();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': WEB_UA,
    Origin: 'https://music.youtube.com',
    Referer: 'https://music.youtube.com/',
    'X-YouTube-Client-Name': '67',
    'X-YouTube-Client-Version': MUSIC_CLIENT.clientVersion,
  };
  if (vd) headers['X-Goog-Visitor-Id'] = vd;
  if (cookie) Object.assign(headers, authHeaders(cookie));
  const enc = encodeURIComponent(token);
  const txt = await http(
    `https://music.youtube.com/youtubei/v1/browse?ctoken=${enc}&continuation=${enc}&type=next&prettyPrint=false`,
    { method: 'POST', headers, body: { context: { client: { ...MUSIC_CLIENT, ...(vd ? { visitorData: vd } : {}) } } } }
  );
  const data = JSON.parse(txt);
  const cont = data?.continuationContents?.sectionListContinuation;
  return { shelves: parseSections(cont?.contents), continuation: continuationOf(cont) };
};

/** Tracks to play for a start-page card. */
export const getCardTracks = async (card: HomeCard): Promise<Track[]> => {
  if (card.kind === 'song' && card.videoId) {
    const radio = await getRadioTracks(card.videoId).catch(() => [] as Track[]);
    const first: Track = {
      id: card.videoId,
      title: card.title,
      artist: card.subtitle.split(' • ').pop() || card.subtitle,
      thumbnail: card.thumbnail,
      type: 'song',
    };
    return [first, ...radio];
  }
  if (card.playlistId) {
    const t = await getWatchPlaylist(card.playlistId, undefined, card.playParams);
    if (t.length) return t;
  }
  if (card.browseId?.startsWith('MPRE')) {
    // album without play endpoint -> read its tracks
    const data = await musicRequest('browse', { browseId: card.browseId });
    const tracks = collect(data, 'musicResponsiveListItemRenderer')
      .map(parseListItem)
      .filter((x): x is Track => !!x)
      .map((x) => ({ ...x, thumbnail: card.thumbnail || x.thumbnail, album: card.title }));
    if (tracks.length) return tracks;
  }
  // artist / anything else -> top songs of that name
  return searchSongs(card.title);
};

// ---------- tell YouTube Music what was played (history -> better recommendations) ----------
const reported = new Set<string>();
export const reportPlayback = async (videoId: string): Promise<void> => {
  const cookie = getStoredCookie();
  if (!cookie || reported.has(videoId)) return;
  reported.add(videoId);
  try {
    const data = await musicRequest('player', { videoId }, cookie);
    const base: string | undefined = data?.playbackTracking?.videostatsPlaybackUrl?.baseUrl;
    if (!base) return;
    const CPNA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let cpn = '';
    for (let i = 0; i < 16; i++) cpn += CPNA[Math.floor(Math.random() * 256) & 63];
    const url = `${base}${base.includes('?') ? '&' : '?'}ver=2&c=WEB_REMIX&cpn=${cpn}`;
    await http(url, { method: 'GET', headers: { 'User-Agent': WEB_UA, ...authHeaders(cookie) } });
  } catch (e) {
    reported.delete(videoId);
    console.warn('history report failed', e);
  }
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

// ---------- account / library (needs Google cookie) ----------
const requireCookie = (): string => {
  const c = getStoredCookie();
  if (!c) throw new Error('Nicht angemeldet');
  return c;
};

export interface NativeProfile {
  isLoggedIn: boolean;
  name: string;
  handle?: string | null;
  avatar?: string | null;
}

export const getAccountInfo = async (cookie: string): Promise<NativeProfile> => {
  const data = await musicRequest('account/account_menu', {}, cookie);
  const hdr = collect(data, 'activeAccountHeaderRenderer')[0];
  if (!hdr) throw new Error('Google-Anmeldung ungültig oder abgelaufen');
  const thumbs: any[] = hdr?.accountPhoto?.thumbnails || [];
  let avatar: string | null = thumbs.length ? thumbs[thumbs.length - 1].url : null;
  if (avatar?.startsWith('//')) avatar = 'https:' + avatar;
  return {
    isLoggedIn: true,
    name: runsText(hdr.accountName) || 'Google Benutzer',
    handle: runsText(hdr.channelHandle) || null,
    avatar,
  };
};

const tracksFrom = (data: any): Track[] => {
  const seen = new Set<string>();
  return collect(data, 'musicResponsiveListItemRenderer')
    .map(parseListItem)
    .filter((t): t is Track => !!t && !seen.has(t.id) && !!seen.add(t.id));
};

export const getLibraryPlaylists = async (): Promise<{ id: string; title: string; trackCount?: number; thumbnail: string }[]> => {
  const data = await musicRequest('browse', { browseId: 'FEmusic_liked_playlists' }, requireCookie());
  const out: { id: string; title: string; trackCount?: number; thumbnail: string }[] = [];
  for (const r of collect(data, 'musicTwoRowItemRenderer')) {
    const browseId: string | undefined = r?.navigationEndpoint?.browseEndpoint?.browseId;
    if (!browseId || !browseId.startsWith('VL')) continue;
    const id = browseId.slice(2);
    if (id === 'LM') continue; // liked songs have their own section
    const sub = runsText(r.subtitle);
    const count = sub.match(/(\d[\d.]*)\s*(Titel|Songs?|Tracks?|Lieder|Videos?)/i);
    const thumbs: any[] = r?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
    out.push({
      id,
      title: runsText(r.title) || 'Playlist',
      trackCount: count ? parseInt(count[1].replace(/\./g, ''), 10) : undefined,
      thumbnail: thumbs.length ? thumbs[thumbs.length - 1].url : '',
    });
  }
  return out;
};

export const getLikedSongs = async (): Promise<Track[]> =>
  tracksFrom(await musicRequest('browse', { browseId: 'VLLM' }, requireCookie()));

export const getHistory = async (): Promise<Track[]> =>
  tracksFrom(await musicRequest('browse', { browseId: 'FEmusic_history' }, requireCookie())).slice(0, 40);

export const rateSong = async (videoId: string, like: boolean): Promise<void> => {
  await musicRequest(like ? 'like/like' : 'like/removelike', { target: { videoId } }, requireCookie());
};

export const getPlaylistDirect = async (playlistId: string): Promise<any> => {
  const browseId = playlistId.startsWith('VL') ? playlistId : `VL${playlistId}`;
  const data = await musicRequest('browse', { browseId }, getStoredCookie());
  const tracks = tracksFrom(data);
  const hdr =
    collect(data, 'musicResponsiveHeaderRenderer')[0] ||
    collect(data, 'musicDetailHeaderRenderer')[0] ||
    collect(data, 'musicEditablePlaylistDetailHeaderRenderer')[0];
  const title = runsText(hdr?.title) || runsText(collect(hdr, 'title')[0]) || 'Playlist';
  const thumbs: any[] = collect(hdr, 'thumbnails')[0] || [];
  return {
    id: browseId.slice(2),
    title,
    description: runsText(collect(hdr, 'description')[0]?.musicDescriptionShelfRenderer?.description) || null,
    thumbnail: thumbs.length ? thumbs[thumbs.length - 1].url : tracks[0]?.thumbnail || '',
    trackCount: tracks.length,
    tracks,
  };
};
