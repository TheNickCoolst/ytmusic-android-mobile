import React, { useEffect, useState } from 'react';
import { Play, Shuffle } from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useSettings } from '../services/settings';
import { topTracks, dailyShuffle } from '../services/stats';
import { tap } from '../services/ui';

const shuffled = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

// ---------- seasonal playlists, built from YouTube Music song searches ----------
type Season = { id: string; title: string; gradient: string; queries: string[]; active: (d: Date) => boolean };
const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate(); // 1225 = 25 Dec
const SEASONS: Season[] = [
  {
    id: 'xmas',
    title: '🎄 Weihnachtsplaylist',
    gradient: 'from-red-700 via-red-900 to-emerald-900',
    queries: ['Weihnachtslieder', 'Christmas Songs Klassiker', 'Deutsche Weihnachtslieder'],
    active: (d) => md(d) >= 1101 || md(d) <= 106,
  },
  {
    id: 'nye',
    title: '🎆 Silvester-Party',
    gradient: 'from-indigo-700 via-purple-900 to-amber-700',
    queries: ['Silvester Party Hits', 'New Year Party Songs', 'Party Hits Deutsch'],
    active: (d) => md(d) >= 1227 || md(d) <= 106,
  },
  {
    id: 'halloween',
    title: '🎃 Halloween',
    gradient: 'from-orange-600 via-orange-900 to-zinc-900',
    queries: ['Halloween Songs', 'Halloween Party Hits'],
    active: (d) => md(d) >= 1015 && md(d) <= 1101,
  },
  {
    id: 'summer',
    title: '☀️ Sommerhits',
    gradient: 'from-amber-500 via-orange-700 to-pink-800',
    queries: ['Sommerhits', 'Summer Hits', 'Sommer Party Songs'],
    active: (d) => md(d) >= 601 && md(d) <= 831,
  },
  {
    id: 'spring',
    title: '🌸 Frühlingsgefühle',
    gradient: 'from-pink-600 via-rose-800 to-emerald-800',
    queries: ['Frühlingslieder', 'Spring Feel Good Songs'],
    active: (d) => md(d) >= 320 && md(d) <= 520,
  },
];

const seasonCache = new Map<string, Track[]>();
const loadSeason = async (s: Season): Promise<Track[]> => {
  const cached = seasonCache.get(s.id);
  if (cached) return cached;
  const lists = await Promise.all(s.queries.map((q) => api.search(q, 'songs').catch(() => [] as Track[])));
  const seen = new Set<string>();
  const out: Track[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) {
    for (const l of lists) {
      const t = l[i];
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
    }
  }
  const list = out.slice(0, 50);
  if (list.length) seasonCache.set(s.id, list);
  return list;
};

// ---------- UI ----------
const Banner: React.FC<{ title: string; subtitle: string; gradient: string; tracks: Track[] }> = ({
  title,
  subtitle,
  gradient,
  tracks,
}) => {
  const { playTrack, currentTrack } = usePlayer();
  if (!tracks.length) return null;
  return (
    <section className="px-4">
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-4 mb-3 shadow-float`}>
        <div className="flex items-center">
          {/* 2x2 cover mosaic */}
          <div className="grid grid-cols-2 w-[4.5rem] h-[4.5rem] rounded-2xl overflow-hidden flex-shrink-0 shadow-lg bg-black/20">
            {tracks.slice(0, 4).map((t) => (
              <img key={t.id} src={t.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
            ))}
          </div>
          <div className="flex-1 min-w-0 ml-3.5">
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white/70 truncate">{subtitle}</div>
            <h2 className="mt-0.5 text-[1.1875rem] leading-tight font-bold text-white tracking-tight line-clamp-2 break-words">
              {title}
            </h2>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-3.5">
          <button
            onClick={() => {
              tap();
              playTrack(tracks[0], tracks);
            }}
            aria-label={`${title} abspielen`}
            className="h-10 pl-3.5 pr-4 rounded-full bg-white flex items-center space-x-1.5 text-[0.8125rem] font-bold text-black shadow-lg press"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>Abspielen</span>
          </button>
          <button
            onClick={() => {
              tap();
              const s = shuffled(tracks);
              playTrack(s[0], s);
            }}
            aria-label={`${title} zufällig abspielen`}
            className="h-10 pl-3.5 pr-4 rounded-full bg-black/25 flex items-center space-x-1.5 text-[0.8125rem] font-bold text-white press"
          >
            <Shuffle className="w-4 h-4" />
            <span>Zufällig</span>
          </button>
        </div>
      </div>
      <div className="shelf space-x-3 scrollbar-none -mx-4 px-4">
        {tracks.slice(0, 15).map((track) => (
          <div
            key={track.id}
            onClick={() => playTrack(track, tracks)}
            className="w-[8.5rem] cursor-pointer press"
          >
            <div className="aspect-square rounded-2xl overflow-hidden bg-white/[0.06] mb-2.5">
              <img src={track.thumbnail} alt={track.title} loading="lazy" className="w-full h-full object-cover" />
            </div>
            <div
              className={`text-[0.8125rem] font-semibold leading-snug truncate ${
                currentTrack?.id === track.id ? 'text-red-400' : 'text-white'
              }`}
            >
              {track.title}
            </div>
            <div className="text-xs leading-snug text-zinc-400 truncate mt-0.5">{track.artist}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const WEEK = 7 * 24 * 3600 * 1000;
const becauseCache = new Map<string, Track[]>();

/** Personal rows on the start page: season playlists, top songs, daily mix, "because you listened". */
export const HomeExtras: React.FC<{ recent: Track[] }> = ({ recent }) => {
  const { likedTracks } = usePlayer();
  const { seasonalPlaylists } = useSettings();
  const [seasons, setSeasons] = useState<{ s: Season; tracks: Track[] }[]>([]);
  const seed = recent[0];
  const [because, setBecause] = useState<Track[]>(() => (seed ? becauseCache.get(seed.id) || [] : []));

  useEffect(() => {
    if (!seasonalPlaylists) {
      setSeasons([]);
      return;
    }
    let alive = true;
    const now = new Date();
    const active = SEASONS.filter((s) => s.active(now));
    Promise.all(active.map(async (s) => ({ s, tracks: await loadSeason(s) }))).then((r) => alive && setSeasons(r));
    return () => {
      alive = false;
    };
  }, [seasonalPlaylists]);

  useEffect(() => {
    if (!seed) return;
    let alive = true;
    const cached = becauseCache.get(seed.id);
    if (cached) {
      setBecause(cached);
      return;
    }
    api
      .getRadio(seed.id)
      .then((r) => {
        const list = r.filter((t) => t.id !== seed.id).slice(0, 25);
        becauseCache.set(seed.id, list);
        if (alive) setBecause(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [seed?.id]);

  const top = topTracks(WEEK, 25);
  const topList = top.map((x) => x.track);
  const mix = likedTracks.length >= 5 ? dailyShuffle(likedTracks, 'mix').slice(0, 30) : [];

  return (
    <>
      {seasons.map(({ s, tracks }) => (
        <Banner key={s.id} title={s.title} subtitle={`Playlist · ${tracks.length} Titel`} gradient={s.gradient} tracks={tracks} />
      ))}
      {topList.length >= 5 && (
        <Banner
          title="Deine Top-Songs"
          subtitle={`Diese Woche · ${top.reduce((n, x) => n + x.plays, 0)} Wiedergaben`}
          gradient="from-zinc-700 via-zinc-800 to-red-900"
          tracks={topList}
        />
      )}
      {mix.length > 0 && (
        <Banner
          title="Dein Tagesmix"
          subtitle="Aus deinen Lieblingssongs · jeden Tag neu"
          gradient="from-sky-700 via-blue-900 to-violet-900"
          tracks={mix}
        />
      )}
      {seed && because.length > 0 && (
        <Banner
          title={`Weil du „${seed.title}“ gehört hast`}
          subtitle="Ähnliche Songs"
          gradient="from-emerald-700 via-teal-900 to-zinc-900"
          tracks={because}
        />
      )}
    </>
  );
};
