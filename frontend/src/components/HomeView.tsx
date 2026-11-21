import React, { useState, useEffect, useRef } from 'react';
import { Play, MoreVertical, Flame, RefreshCw, Loader2, Sparkles, Disc, Shuffle, Gift } from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { isNativeApp, HomeCard } from '../services/youtube';
import { usePlayer } from '../context/PlayerContext';

// Weihnachtsplaylist: shown 1 Nov – 6 Jan, built from YouTube Music song searches
const XMAS_QUERIES = ['Weihnachtslieder', 'Christmas Songs Klassiker', 'Deutsche Weihnachtslieder'];
const isXmasSeason = (d = new Date()) => d.getMonth() >= 10 || (d.getMonth() === 0 && d.getDate() <= 6);
let xmasCache: Track[] | null = null;
const loadXmas = async (): Promise<Track[]> => {
  if (xmasCache) return xmasCache;
  const lists = await Promise.all(XMAS_QUERIES.map((q) => api.search(q, 'songs').catch(() => [] as Track[])));
  const seen = new Set<string>();
  const out: Track[] = [];
  for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++) {
    for (const l of lists) {
      const t = l[i];
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
    }
  }
  if (out.length) xmasCache = out.slice(0, 50);
  return out.slice(0, 50);
};
const shuffled = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
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
    setLoading(true);
    const token = ++loadTokenRef.current;
    try {
      const chipParams = mood ? chipParamsRef.current[mood] : undefined;
      if (isNativeApp() && (!mood || chipParams)) {
        // real YouTube Music start page (personalised when logged in) or mood chip page
        const data = await api.getHomeFeed('DE', chipParams);
        if (token !== loadTokenRef.current) return;
        setShelves(data.shelves || []);
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
    } finally {
      setLoading(false);
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

  const [xmas, setXmas] = useState<Track[]>(xmasCache || []);
  useEffect(() => {
    if (filterMood || !isXmasSeason()) return;
    let alive = true;
    loadXmas().then((t) => alive && setXmas(t));
    return () => {
      alive = false;
    };
  }, [filterMood]);

  const recent = loggedIn ? accountHistory : history;

  // YouTube's own "Wieder reinhören" shelf already shows recent plays -> no second row
  const recentIds = new Set(recent.slice(0, 20).map((t) => t.id));
  const hasYtListenAgain = shelves.some((s) => {
    if (/wieder|nochmal|noch einmal|erneut|zuletzt|kürzlich|listen again|recently/i.test(s.title || '')) return true;
    const ids: string[] = (s.tracks || s.items || []).map((x: any) => x.videoId || x.id).filter(Boolean);
    return ids.length > 0 && ids.filter((id) => recentIds.has(id)).length >= Math.min(4, ids.length);
  });

  return (
    <div className="pb-36 space-y-7 pt-2 select-none">
      {/* Zuletzt gehört (Listen Again) from History if available */}
      {!loading && recent.length > 0 && !filterMood && !hasYtListenAgain && (
        <section className="px-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            WIEDER REINHÖREN
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mb-3">
            Zuletzt gehört
          </h2>
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
            {recent.slice(0, 8).map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, recent)}
                  className="w-32 flex-shrink-0 cursor-pointer group active:scale-95 transition"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 shadow-md mb-2">
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className={`text-xs font-semibold truncate ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                    {track.title}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {track.artist}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!loading && !filterMood && xmas.length > 0 && isXmasSeason() && (
        <section className="px-4">
          <div className="rounded-2xl bg-gradient-to-br from-red-700 via-red-900 to-emerald-900 p-4 mb-3 flex items-center gap-3 shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Playlist · {xmas.length} Titel</div>
              <h2 className="text-xl font-black text-white tracking-tight truncate">🎄 Weihnachtsplaylist</h2>
            </div>
            <button
              onClick={() => {
                const s = shuffled(xmas);
                playTrack(s[0], s);
              }}
              aria-label="Zufallswiedergabe"
              className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition"
            >
              <Shuffle className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => playTrack(xmas[0], xmas)}
              aria-label="Abspielen"
              className="w-11 h-11 rounded-full bg-white flex items-center justify-center active:scale-95 transition"
            >
              <Play className="w-5 h-5 text-black fill-black ml-0.5" />
            </button>
          </div>
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
            {xmas.slice(0, 15).map((track) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, xmas)}
                className="w-32 flex-shrink-0 cursor-pointer active:scale-95 transition"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-zinc-900 shadow-md mb-2">
                  <img src={track.thumbnail} alt={track.title} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className={`text-xs font-semibold truncate ${currentTrack?.id === track.id ? 'text-red-400' : 'text-white'}`}>
                  {track.title}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">{track.artist}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          <span className="text-xs">Lade YouTube Music...</span>
        </div>
      ) : (
        shelves.map((shelf) => {
          // 1. Classic 4-track column shelves (Schnellauswahl)
          if (shelf.type === 'columns_4' && shelf.columns) {
            return (
              <section key={shelf.id} className="px-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    {shelf.subtitle && (
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        {shelf.subtitle}
                      </div>
                    )}
                    <h2 className="text-xl font-black text-white tracking-tight">
                      {shelf.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      if (shelf.tracks && shelf.tracks.length > 0) {
                        playTrack(shelf.tracks[0], shelf.tracks);
                      }
                    }}
                    className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white border border-white/10 active:scale-95 transition"
                  >
                    Alle wiedergeben
                  </button>
                </div>

                {/* Horizontal scrollable columns */}
                <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 snap-x">
                  {shelf.columns.map((col: Track[], colIdx: number) => (
                    <div
                      key={colIdx}
                      className="w-[82vw] max-w-[320px] flex-shrink-0 space-y-2.5 snap-start"
                    >
                      {col.map((track) => {
                        const isCurrent = currentTrack?.id === track.id;
                        return (
                          <div
                            key={track.id}
                            onClick={() => playTrack(track, shelf.tracks)}
                            className={`flex items-center justify-between p-1.5 rounded-xl transition cursor-pointer active:scale-[0.98] ${
                              isCurrent ? 'bg-white/10' : 'hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center space-x-3 min-w-0 flex-1 mr-2">
                              <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800">
                                <img
                                  src={track.thumbnail}
                                  alt={track.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                {isCurrent && isPlaying && (
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <div className="flex items-end space-x-0.5 h-3.5">
                                      <span className="w-0.5 bg-red-500 animate-pulse h-full"></span>
                                      <span className="w-0.5 bg-red-500 animate-pulse delay-75 h-2/3"></span>
                                      <span className="w-0.5 bg-red-500 animate-pulse delay-150 h-5/6"></span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className={`text-xs font-semibold truncate ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                                  {track.title}
                                </div>
                                <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                                  {track.artist}
                                </div>
                              </div>
                            </div>
                            <div className="text-zinc-500 p-2">
                              <MoreVertical className="w-4 h-4" />
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
                  {shelf.subtitle || 'CHARTS'}
                </div>
                <h2 className="text-xl font-black text-white tracking-tight mb-3">
                  {shelf.title}
                </h2>
                <div className="space-y-1">
                  {shelf.items.slice(0, 10).map((track: any, idx: number) => {
                    const isCurrent = currentTrack?.id === track.id;
                    return (
                      <div
                        key={track.id || idx}
                        onClick={() => playTrack(track, shelf.items)}
                        className={`flex items-center justify-between p-2 rounded-xl transition cursor-pointer active:scale-[0.98] ${
                          isCurrent ? 'bg-white/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                          <span className={`w-5 text-center text-sm font-black ${idx < 3 ? 'text-red-500' : 'text-zinc-500'}`}>
                            {idx + 1}
                          </span>
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                            loading="lazy"
                          />
                          <div className="min-w-0 flex-1">
                            <div className={`text-xs font-semibold truncate ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                              {track.title}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">
                              {track.artist}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs font-mono text-zinc-500">
                          {track.duration}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          // 3. YouTube Music cards (playlists, albums, mixes, artists, songs)
          if (shelf.type === 'cards' && shelf.items) {
            return (
              <section key={shelf.id} className="px-4">
                {shelf.subtitle && (
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
                    {shelf.subtitle}
                  </div>
                )}
                <h2 className="text-xl font-black text-white tracking-tight mb-3">{shelf.title}</h2>
                <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                  {shelf.items.map((card: HomeCard) => {
                    const round = card.kind === 'artist';
                    const isCurrent = card.kind === 'song' && currentTrack?.id === card.videoId;
                    return (
                      <div
                        key={`${shelf.id}_${card.id}`}
                        onClick={() => openCard(card)}
                        className="w-36 flex-shrink-0 cursor-pointer group active:scale-95 transition"
                      >
                        <div
                          className={`relative aspect-square overflow-hidden bg-zinc-900 shadow-md mb-2 ${
                            round ? 'rounded-full' : 'rounded-xl'
                          }`}
                        >
                          <img src={card.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                          <div
                            className={`absolute inset-0 flex items-center justify-center transition ${
                              openingCard === card.id ? 'bg-black/50 opacity-100' : 'bg-black/30 opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                              {openingCard === card.id ? (
                                <Loader2 className="w-5 h-5 text-white animate-spin" />
                              ) : (
                                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                              )}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`text-xs font-semibold line-clamp-2 ${round ? 'text-center' : ''} ${
                            isCurrent ? 'text-red-400' : 'text-white'
                          }`}
                        >
                          {card.title}
                        </div>
                        {card.subtitle && (
                          <div className={`text-[11px] text-zinc-400 line-clamp-2 mt-0.5 ${round ? 'text-center' : ''}`}>
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
                  {shelf.subtitle}
                </div>
                <h2 className="text-xl font-black text-white tracking-tight mb-3">
                  {shelf.title}
                </h2>
                <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                  {shelf.items.map((pl: any) => (
                    <div
                      key={pl.id}
                      onClick={() => {
                        api.search(pl.query, 'songs').then((res) => {
                          if (res.length > 0) playTrack(res[0], res);
                        });
                      }}
                      className="w-36 flex-shrink-0 cursor-pointer group active:scale-95 transition"
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 shadow-md mb-2">
                        <img
                          src={pl.thumbnail}
                          alt={pl.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-white truncate">
                        {pl.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {pl.subtitle}
                      </div>
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
          <Loader2 className="w-5 h-5 animate-spin text-red-600" />
        </div>
      )}
    </div>
  );
};
