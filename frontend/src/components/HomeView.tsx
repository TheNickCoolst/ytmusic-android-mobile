import React, { useState, useEffect } from 'react';
import { Play, MoreVertical, Flame, RefreshCw, Loader2, Sparkles, Disc } from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { usePlayer } from '../context/PlayerContext';

interface HomeViewProps {
  filterMood?: string | null;
}

export const HomeView: React.FC<HomeViewProps> = ({ filterMood }) => {
  const [shelves, setShelves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { playTrack, currentTrack, isPlaying, history } = usePlayer();

  const loadFeed = async (mood?: string | null) => {
    setLoading(true);
    try {
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
  }, [filterMood]);

  return (
    <div className="pb-36 space-y-7 pt-2 select-none">
      {/* Zuletzt gehört (Listen Again) from History if available */}
      {history.length > 0 && !filterMood && (
        <section className="px-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            WIEDER REINHÖREN
          </div>
          <h2 className="text-xl font-black text-white tracking-tight mb-3">
            Zuletzt gehört
          </h2>
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
            {history.slice(0, 8).map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, history)}
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

          // 3. Playlists Shelf
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
    </div>
  );
};
