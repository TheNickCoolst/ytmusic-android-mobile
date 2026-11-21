// Local listening log: powers "Deine Top-Songs", the statistics and the daily mix.
import { Track } from '../types';

const KEY = 'ytmusic_play_log';
const MAX = 2000;

export type PlayEntry = { id: string; t: number; title: string; artist: string; thumbnail: string };

const load = (): PlayEntry[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export const logPlay = (track: Track) => {
  const log = load();
  const last = log[log.length - 1];
  if (last && last.id === track.id && Date.now() - last.t < 60_000) return; // same song restarted
  log.push({ id: track.id, t: Date.now(), title: track.title, artist: track.artist, thumbnail: track.thumbnail });
  try {
    localStorage.setItem(KEY, JSON.stringify(log.slice(-MAX)));
  } catch {
    /* ignore */
  }
};

const toTrack = (e: PlayEntry): Track => ({ id: e.id, title: e.title, artist: e.artist, thumbnail: e.thumbnail });

/** Most played songs since `sinceMs` ago. */
export const topTracks = (sinceMs: number, limit = 20): { track: Track; plays: number }[] => {
  const from = Date.now() - sinceMs;
  const m = new Map<string, { e: PlayEntry; n: number }>();
  for (const e of load()) {
    if (e.t < from) continue;
    const x = m.get(e.id);
    if (x) {
      x.n++;
      x.e = e;
    } else m.set(e.id, { e, n: 1 });
  }
  return [...m.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((x) => ({ track: toTrack(x.e), plays: x.n }));
};

export const topArtists = (sinceMs: number, limit = 10): { artist: string; plays: number }[] => {
  const from = Date.now() - sinceMs;
  const m = new Map<string, number>();
  for (const e of load()) {
    if (e.t < from || !e.artist || e.artist === 'Unbekannt') continue;
    m.set(e.artist, (m.get(e.artist) || 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([artist, plays]) => ({ artist, plays }));
};

export const totalPlays = (sinceMs: number) => {
  const from = Date.now() - sinceMs;
  return load().filter((e) => e.t >= from).length;
};

/** Same order all day, new order tomorrow. */
export const dailyShuffle = <T,>(items: T[], salt = ''): T[] => {
  const d = new Date();
  let seed = 0;
  for (const ch of `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}${salt}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const b = [...items];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
