import React, { useState, useEffect, useRef } from 'react';
import { Play, Loader2, ArrowDown } from 'lucide-react';
import { EqBars, SectionHeader } from './Primitives';
import { Track } from '../types';
import { api } from '../services/api';
import { isNativeApp, HomeCard } from '../services/youtube';
import { usePlayer } from '../context/PlayerContext';
import { greeting, tap, toast } from '../services/ui';
import { HomeExtras } from './HomeExtras';
import { TrackItem } from './TrackItem';

const HOME_CACHE_KEY = 'ytmusic_home_cache';
const readHomeCache = (): any[] | null => {
  try {
    const v = JSON.parse(localStorage.getItem(HOME_CACHE_KEY) || 'null');
    return Array.isArray(v) && v.length ? v : null;
  } catch {
    return null;
  }
};
const writeHomeCache = (shelves: any[]) => {
  try {
    const json = JSON.stringify(shelves.slice(0, 8));
    if (json.length < 400_000) localStorage.setItem(HOME_CACHE_KEY, json);
  } catch {
    /* ignore */
  }
};

interface HomeViewProps {
  filterMood?: string | null;
  onChips?: (chips: string[]) => void;
  accountKey?: string;
}

export const HomeView: React.FC<HomeViewProps> = ({ filterMood, onChips, accountKey }) => {
  const [shelves, setShelves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openingCard, setOpeningCard] = useState<string | null>(null);
  const { playTrack, currentTrack, isPlaying, history } = usePlayer();
  const loggedIn = !!accountKey && accountKey !== 'guest';
  // logged in: "Zuletzt gehört" comes from the Google account (YouTube Music history), not the phone
  const [accountHistory, setAccountHistory] = useState<Track[]>([]);
  const chipParamsRef = useRef<Record<string, string>>({});
  const loadTokenRef = useRef(0);

  const openCard = async (card: HomeCard) => {
    if (openingCard) return;
    setOpeningCard(card.id);
    try {
      const tracks = await api.getCardTracks(card);
      if (tracks.length > 0) playTrack(tracks[0], tracks);
    } catch (e) {
      console.warn('Could not open card', e);
    } finally {
      setOpeningCard(null);
    }
  };

  const loadFeed = async (mood?: string | null) => {
    const token = ++loadTokenRef.current;
    // start page: show the last one right away (and offline), then replace it with the fresh one
    const cached = !mood ? readHomeCache() : null;
    if (cached) {
      setShelves(cached);
      setLoading(false);
    } else setLoading(true);
    try {
      const chipParams = mood ? chipParamsRef.current[mood] : undefined;
      if (isNativeApp() && (!mood || chipParams)) {
        // real YouTube Music start page (personalised when logged in) or mood chip page
        const data = await api.getHomeFeed('DE', chipParams);
        if (token !== loadTokenRef.current) return;
        setShelves(data.shelves || []);
        if (!mood && data.shelves?.length) writeHomeCache(data.shelves);
        if (!mood && data.chips?.length) {
          chipParamsRef.current = Object.fromEntries(data.chips.map((c) => [c.title, c.params]));
          onChips?.(data.chips.map((c) => c.title));
        }
        setLoading(false);
        // more sections like in the app (YouTube delivers the start page in pages)
        let cont = data.continuation || null;
        setLoadingMore(!!cont);
        for (let page = 0; cont && page < 4; page++) {
          const more = await api.getHomeMore(cont).catch(() => null);
          if (!more || token !== loadTokenRef.current) break;
          setShelves((prev) => [...prev, ...more.shelves]);
          cont = more.continuation;
        }
        if (token === loadTokenRef.current) setLoadingMore(false);
        return;
      }
      if (mood) {
        const results = await api.search(`${mood} music hits`, 'songs');
        const columns: Track[][] = [];
        for (let i = 0; i < Math.min(results.length, 16); i += 4) {
          columns.push(results.slice(i, i + 4));
        }
        setShelves([
          {
            id: 'mood_picks',
            title: `${mood} • Schnellauswahl`,
            subtitle: 'STARTET EINE RADIOSTATION',
            type: 'columns_4',
            columns: columns,
            tracks: results
          },
          {
            id: 'mood_tracks',
            title: `Beliebt bei ${mood}`,
            subtitle: 'COMMUNITY-FAVORITEN',
            type: 'rankings',
            items: results.slice(0, 10)
          }
        ]);
      } else {
        const data = await api.getHomeFeed('DE');
        setShelves(data.shelves || []);
      }
    } catch (err) {
      console.error('Failed to load home feed:', err);
      if (cached && token === loadTokenRef.current) toast('Offline – zeige die zuletzt geladene Startseite');
    } finally {
      if (token === loadTokenRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed(filterMood);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMood, accountKey]);

  useEffect(() => {
    if (!loggedIn || filterMood) return;
    let alive = true;
    api
      .getUserHistory()
      .then((h) => alive && setAccountHistory(h))
      .catch(() => alive && setAccountHistory([]));
    return () => {
      alive = false;
    };
  }, [loggedIn, accountKey, filterMood]);

  // pull down at the top = reload the start page
  const pullRef = useRef<{ y: number; active: boolean } | null>(null);
  const [pull, setPull] = useState(0);
  const scroller = () => document.querySelector('main');
  const onPullStart = (e: React.TouchEvent) => {
    pullRef.current = { y: e.touches[0].clientY, active: (scroller()?.scrollTop || 0) <= 0 };
  };
  const onPullMove = (e: React.TouchEvent) => {
    const p = pullRef.current;
    if (!p?.active) return;
    const dy = e.touches[0].clientY - p.y;
    setPull(dy > 0 ? Math.min(110, dy * 0.6) : 0);
  };
  const onPullEnd = () => {
    const p = pullRef.current;
    pullRef.current = null;
    if (p?.active && pull >= 70 && !loading) {
      tap();
      loadFeed(filterMood);
    }
    setPull(0);
  };

  const recent = loggedIn ? accountHistory : history;

  // YouTube's own "Wieder reinhören" shelf already shows recent plays -> no second row
  const recentIds = new Set(recent.slice(0, 20).map((t) => t.id));
  const hasYtListenAgain = shelves.some((s) => {
    if (/wieder|nochmal|noch einmal|erneut|zuletzt|kürzlich|listen again|recently/i.test(s.title || '')) return true;
    const ids: string[] = (s.tracks || s.items || []).map((x: any) => x.videoId || x.id).filter(Boolean);
    return ids.length > 0 && ids.filter((id) => recentIds.has(id)).length >= Math.min(4, ids.length);
  });

  const cardOverlay = (busy: boolean) => (
    <div
      className={`absolute inset-0 flex items-center justify-center transition-opacity ${
        busy ? 'bg-black/50 opacity-100' : 'bg-black/25 opacity-0 group-hover:opacity-100'
      }`}
    >
      <div className="w-11 h-11 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
        {busy ? (
          <Loader2 className="w-5 h-5 text-black animate-spin" />
        ) : (
          <Play className="w-5 h-5 text-black fill-black ml-0.5" />
        )}
      </div>
    </div>
  );

  return (
    <div className="pb-player space-y-9 pt-3 select-none" onTouchStart={onPullStart} onTouchMove={onPullMove} onTouchEnd={onPullEnd}>
      {pull > 0 && (
        <div className="flex justify-center -mb-6 overflow-hidden" style={{ height: pull }}>
          <div
            className={`mt-2 w-9 h-9 rounded-full flex items-center justify-center shadow-float transition-colors ${
              pull >= 70 ? 'bg-white text-black' : 'bg-surface-3 text-zinc-400'
            }`}
          >
            <ArrowDown className={`w-5 h-5 transition-transform duration-200 ${pull >= 70 ? 'rotate-180' : ''}`} />
          </div>
        </div>
      )}
      {!filterMood && (
        <h1 className="px-4 -mb-4 text-[1.75rem] leading-tight font-extrabold text-white tracking-tight">
          {greeting()}
          {loggedIn && accountKey ? `, ${accountKey.split(' ')[0]}` : ''} 👋
        </h1>
      )}
      {filterMood && (
        <h1 className="px-4 -mb-4 text-[1.75rem] leading-tight font-extrabold text-white tracking-tight truncate">{filterMood}</h1>
      )}

      {/* Zuletzt gehört: quick-access tiles (2 columns) */}
      {!loading && recent.length > 0 && !filterMood && !hasYtListenAgain && (
        <section className="px-4">
          <SectionHeader eyebrow="Wieder reinhören" title="Zuletzt gehört" />
          <div className="grid grid-cols-2 gap-2">
            {recent.slice(0, 6).map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <button
                  key={track.id}
                  onClick={() => {
                    tap();
                    playTrack(track, recent);
                  }}
                  className={`flex items-center h-14 rounded-xl overflow-hidden text-left press ${
                    isCurrent ? 'bg-white/[0.14]' : 'bg-white/[0.07] hover:bg-white/[0.1]'
                  }`}
                >
                  <img src={track.thumbnail} alt="" className="w-14 h-14 object-cover flex-shrink-0" loading="lazy" />
                  <span className="flex-1 min-w-0 px-2.5">
                    <span
                      className={`block text-[0.8125rem] font-semibold leading-tight line-clamp-2 ${
                        isCurrent ? 'text-red-400' : 'text-white'
                      }`}
                    >
                      {track.title}
                    </span>
                  </span>
                  {isCurrent && <EqBars playing={isPlaying} className="mr-2.5 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!loading && !filterMood && <HomeExtras recent={recent} />}

      {loading ? (
        <div className="space-y-9" aria-label="Lade YouTube Music…">
          {[0, 1, 2].map((i) => (
            <section key={i} className="px-4">
              <div className="skeleton h-3 w-24 rounded-full mb-2" />
              <div className="skeleton h-6 w-48 rounded-lg mb-4" />
              <div className="flex space-x-3 overflow-hidden -mx-4 px-4">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="w-[9.5rem] flex-shrink-0">
                    <div className="skeleton aspect-square rounded-2xl mb-2.5" />
                    <div className="skeleton h-3 w-28 rounded-full mb-1.5" />
                    <div className="skeleton h-3 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        shelves.map((shelf) => {
          // 1. Classic 4-track column shelves (Schnellauswahl)
          if (shelf.type === 'columns_4' && shelf.columns) {
            return (
              <section key={shelf.id} className="px-4">
                <SectionHeader
                  eyebrow={shelf.subtitle}
                  title={shelf.title}
                  action={
                    <button
                      onClick={() => {
                        tap();
                        if (shelf.tracks && shelf.tracks.length > 0) {
                          playTrack(shelf.tracks[0], shelf.tracks);
                        }
                      }}
                      className="h-9 px-4 rounded-full border border-white/15 text-[0.8125rem] font-semibold text-white hover:bg-white/10 press"
                    >
                      Alle abspielen
                    </button>
                  }
                />

                <div className="shelf space-x-3 scrollbar-none -mx-4 px-4">
                  {shelf.columns.map((col: Track[], colIdx: number) => (
                    <div key={colIdx} className="w-[84vw] max-w-[340px] space-y-1">
                      {col.map((track) => {
                        const isCurrent = currentTrack?.id === track.id;
                        return (
                          <div
                            key={track.id}
                            onClick={() => playTrack(track, shelf.tracks)}
                            className={`flex items-center h-16 px-1.5 rounded-2xl cursor-pointer transition-colors ${
                              isCurrent ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04] active:bg-white/[0.07]'
                            }`}
                          >
                            <div className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.06]">
                              <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" loading="lazy" />
                              {isCurrent && (
                                <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                                  <EqBars playing={isPlaying} />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 ml-3">
                              <div
                                className={`text-[0.9375rem] leading-snug truncate ${
                                  isCurrent ? 'text-red-400 font-semibold' : 'text-white font-medium'
                                }`}
                              >
                                {track.title}
                              </div>
                              <div className="text-[0.8125rem] leading-snug text-zinc-400 truncate mt-0.5">{track.artist}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          // 2. Rankings / Top Charts Shelf
          if (shelf.type === 'rankings' && shelf.items) {
            return (
              <section key={shelf.id} className="px-4">
                <SectionHeader eyebrow={shelf.subtitle || 'Charts'} title={shelf.title} />
                <div className="space-y-0.5 -mx-2">
                  {shelf.items.slice(0, 10).map((track: any, idx: number) => (
                    <TrackItem key={track.id || idx} track={track} rank={idx + 1} playlistContext={shelf.items} />
                  ))}
                </div>
              </section>
            );
          }

          // 3. YouTube Music cards (playlists, albums, mixes, artists, songs)
          if (shelf.type === 'cards' && shelf.items) {
            return (
              <section key={shelf.id} className="px-4">
                <SectionHeader eyebrow={shelf.subtitle} title={shelf.title} />
                <div className="shelf space-x-3 scrollbar-none -mx-4 px-4">
                  {shelf.items.map((card: HomeCard) => {
                    const round = card.kind === 'artist';
                    const isCurrent = card.kind === 'song' && currentTrack?.id === card.videoId;
                    return (
                      <div
                        key={`${shelf.id}_${card.id}`}
                        onClick={() => {
                          tap();
                          openCard(card);
                        }}
                        className="w-[9.5rem] cursor-pointer group press"
                      >
                        <div
                          className={`relative aspect-square overflow-hidden bg-white/[0.06] mb-2.5 ${
                            round ? 'rounded-full' : 'rounded-2xl'
                          }`}
                        >
                          <img src={card.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                          {cardOverlay(openingCard === card.id)}
                        </div>
                        <div
                          className={`text-[0.8125rem] font-semibold leading-snug line-clamp-2 ${round ? 'text-center' : ''} ${
                            isCurrent ? 'text-red-400' : 'text-white'
                          }`}
                        >
                          {card.title}
                        </div>
                        {card.subtitle && (
                          <div className={`text-xs leading-snug text-zinc-400 line-clamp-2 mt-0.5 ${round ? 'text-center' : ''}`}>
                            {card.subtitle}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          // 4. Playlists Shelf
          if (shelf.type === 'playlists' && shelf.items) {
            return (
              <section key={shelf.id} className="px-4">
                <SectionHeader eyebrow={shelf.subtitle} title={shelf.title} />
                <div className="shelf space-x-3 scrollbar-none -mx-4 px-4">
                  {shelf.items.map((pl: any) => (
                    <div
                      key={pl.id}
                      onClick={() => {
                        tap();
                        api.search(pl.query, 'songs').then((res) => {
                          if (res.length > 0) playTrack(res[0], res);
                        });
                      }}
                      className="w-[9.5rem] cursor-pointer group press"
                    >
                      <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/[0.06] mb-2.5">
                        <img src={pl.thumbnail} alt={pl.title} className="w-full h-full object-cover" loading="lazy" />
                        {cardOverlay(false)}
                      </div>
                      <div className="text-[0.8125rem] font-semibold leading-snug text-white truncate">{pl.title}</div>
                      <div className="text-xs leading-snug text-zinc-400 truncate mt-0.5">{pl.subtitle}</div>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          return null;
        })
      )}

      {!loading && loadingMore && (
        <div className="flex justify-center py-4 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        </div>
      )}
    </div>
  );
};
