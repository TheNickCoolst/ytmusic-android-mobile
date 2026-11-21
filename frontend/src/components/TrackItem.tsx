import React, { useState, useRef } from 'react';
import { Play, MoreVertical, Heart, Download, Check, ListPlus, Radio, Loader2, FolderPlus, X, ListStart, Share2, Trash2, ThumbsDown, Plus, User } from 'lucide-react';
import { toast, tap, shareTrack } from '../services/ui';
import { Track } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../services/api';

interface TrackItemProps {
  track: Track;
  index?: number;
  playlistContext?: Track[];
}

export const TrackItem: React.FC<TrackItemProps> = ({ track, index, playlistContext }) => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    addToQueue,
    playNext,
    toggleLike,
    isLiked,
    playlists,
    addToPlaylist,
    createPlaylist,
    toggleDislike,
    isDisliked,
  } = usePlayer();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(track.isCached || api.isDownloaded(track.id));

  // long press = menu, swipe right = add to queue
  const pressRef = useRef<{ x: number; y: number; timer?: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragX, setDragX] = useState(0);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const p = { x: t.clientX, y: t.clientY, fired: false } as NonNullable<typeof pressRef.current>;
    p.timer = setTimeout(() => {
      p.fired = true;
      suppressClickRef.current = true;
      tap(15);
      setShowMenu(true);
    }, 500);
    pressRef.current = p;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const p = pressRef.current;
    if (!p) return;
    const dx = e.touches[0].clientX - p.x;
    const dy = e.touches[0].clientY - p.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(p.timer);
    if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.5) setDragX(Math.min(110, dx));
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const p = pressRef.current;
    pressRef.current = null;
    setDragX(0);
    if (!p) return;
    clearTimeout(p.timer);
    const dx = e.changedTouches[0].clientX - p.x;
    const dy = e.changedTouches[0].clientY - p.y;
    if (!p.fired && dx > 90 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClickRef.current = true;
      tap();
      addToQueue(track);
      toast('Zur Warteschlange hinzugefügt');
    }
  };

  const isCurrent = currentTrack?.id === track.id;
  const liked = isLiked(track.id);

  const handlePlay = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    playTrack(track, playlistContext);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    setProgress(0);
    setShowMenu(false);
    try {
      await api.downloadTrack(
        track.id,
        {
          title: track.title,
          artist: track.artist,
          thumbnail: track.thumbnail,
          duration: track.duration,
        },
        setProgress
      );
      setDownloaded(true);
      toast('Offline gespeichert');
    } catch (err) {
      console.error('Download error:', err);
      toast(`Download fehlgeschlagen${err instanceof Error ? `: ${err.message}` : ''}`, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      onClick={handlePlay}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
      style={dragX ? { transform: `translateX(${dragX}px)`, background: `rgba(220,38,38,${dragX / 400})` } : undefined}
      className={`group flex items-center justify-between p-2 rounded-xl transition cursor-pointer select-none ${
        isCurrent ? 'bg-white/10' : 'hover:bg-white/5 active:bg-white/10'
      }`}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1 mr-2">
        {/* Track Thumbnail or Number */}
        <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-md">
          <img
            src={track.thumbnail}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div
            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {isCurrent && isPlaying ? (
              <div className="flex items-end space-x-0.5 h-4">
                <span className="w-1 bg-red-500 animate-pulse h-full"></span>
                <span className="w-1 bg-red-500 animate-pulse delay-75 h-2/3"></span>
                <span className="w-1 bg-red-500 animate-pulse delay-150 h-5/6"></span>
              </div>
            ) : (
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            )}
          </div>
        </div>

        {/* Track Info */}
        <div className="min-w-0 flex-1">
          <div
            className={`text-sm font-semibold truncate ${
              isCurrent ? 'text-red-400 font-bold' : 'text-white'
            }`}
          >
            {track.title}
          </div>
          <div className="flex items-center text-xs text-zinc-400 space-x-1.5 truncate">
            <span className="truncate">{track.artist}</span>
            {track.duration && (
              <>
                <span>•</span>
                <span>{track.duration}</span>
              </>
            )}
            {isDownloading && (
              <span className="inline-flex items-center text-[10px] text-red-300 bg-red-500/10 px-1 rounded">
                <Loader2 className="w-3 h-3 mr-0.5 animate-spin" /> {Math.round(progress * 100)} %
              </span>
            )}
            {downloaded && (
              <span className="inline-flex items-center text-[10px] text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded">
                <Check className="w-3 h-3 mr-0.5" /> Offline
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trailing actions */}
      <div className="flex items-center space-x-1 relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => {
            tap();
            toggleLike(track);
            toast(liked ? 'Aus Lieblingssongs entfernt' : 'Zu Lieblingssongs hinzugefügt');
          }}
          aria-label={liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'}
          className="p-2 text-zinc-400 hover:text-red-500 active:scale-90 transition"
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
        </button>

        <button
          onClick={() => setShowMenu(!showMenu)}
          aria-label="Mehr Optionen"
          className="p-2 text-zinc-400 hover:text-white active:scale-90 transition"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-10 z-50 w-56 bg-[#1f1f1f] border border-white/10 rounded-xl shadow-2xl py-1">
              <button
                onClick={() => {
                  playNext(track);
                  setShowMenu(false);
                  toast('Wird als Nächstes gespielt');
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
              >
                <ListStart className="w-4 h-4 text-zinc-400" />
                <span>Als Nächstes abspielen</span>
              </button>

              <button
                onClick={() => {
                  addToQueue(track);
                  setShowMenu(false);
                  toast('Zur Warteschlange hinzugefügt');
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
              >
                <ListPlus className="w-4 h-4 text-zinc-400" />
                <span>Zur Warteschlange</span>
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowPlaylistPicker(true);
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
              >
                <FolderPlus className="w-4 h-4 text-zinc-400" />
                <span>In Playlist speichern</span>
              </button>

              {downloaded ? (
                <button
                  onClick={async () => {
                    setShowMenu(false);
                    await api.deleteFromCache(track.id).catch(() => {});
                    setDownloaded(false);
                    toast('Offline-Kopie gelöscht');
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
                >
                  <Trash2 className="w-4 h-4 text-zinc-400" />
                  <span>Offline-Kopie löschen</span>
                </button>
              ) : (
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-zinc-400" />
                  )}
                  <span>Für Offline laden</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowMenu(false);
                  toast('Radio wird geladen…');
                  api
                    .getRadio(track.id)
                    .then((r) => {
                      if (r.length > 0) playTrack(r[0], r);
                      else toast('Kein Radio für diesen Song gefunden', 'error');
                    })
                    .catch(() => toast('Radio konnte nicht geladen werden', 'error'));
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
              >
                <Radio className="w-4 h-4 text-zinc-400" />
                <span>Song-Radio starten</span>
              </button>

              {track.artist && track.artist !== 'Unbekannt' && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    window.dispatchEvent(new CustomEvent('ytm:search', { detail: track.artist.split(/,| & | feat\.? /i)[0].trim() }));
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
                >
                  <User className="w-4 h-4 text-zinc-400" />
                  <span className="truncate">Mehr von {track.artist.split(/,| & | feat\.? /i)[0].trim()}</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowMenu(false);
                  shareTrack(track);
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
              >
                <Share2 className="w-4 h-4 text-zinc-400" />
                <span>Teilen</span>
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  const was = isDisliked(track.id);
                  toggleDislike(track.id);
                  toast(was ? 'Wieder interessiert' : 'Wird beim Mischen übersprungen');
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
              >
                <ThumbsDown className={`w-4 h-4 ${isDisliked(track.id) ? 'text-red-400 fill-red-400' : 'text-zinc-400'}`} />
                <span>{isDisliked(track.id) ? 'Wieder interessiert' : 'Nicht interessiert'}</span>
              </button>
            </div>
          </>
        )}

        {/* Playlist Picker Dialog */}
        {showPlaylistPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-xs bg-[#1c1c1c] border border-white/10 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <FolderPlus className="w-4 h-4 text-red-500" />
                  <span>Playlist wählen</span>
                </span>
                <button
                  onClick={() => setShowPlaylistPicker(false)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                className="mt-3 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newPlaylistName.trim();
                  if (!name) return;
                  createPlaylist(name);
                  setNewPlaylistName('');
                  toast(`Playlist „${name}“ erstellt`);
                }}
              >
                <input
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Neue Playlist…"
                  className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
                <button type="submit" aria-label="Playlist erstellen" className="p-1.5 rounded-lg bg-red-600 text-white active:scale-95">
                  <Plus className="w-4 h-4" />
                </button>
              </form>
              <div className="mt-3 max-h-52 overflow-y-auto space-y-1">
                {playlists.length === 0 ? (
                  <div className="text-xs text-zinc-400 text-center py-4">Noch keine Playlists – oben eine anlegen.</div>
                ) : (
                  playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => {
                        const already = pl.tracks.some((t) => t.id === track.id);
                        addToPlaylist(pl.id, track);
                        setShowPlaylistPicker(false);
                        toast(already ? `Schon in „${pl.name}“` : `In „${pl.name}“ gespeichert`);
                      }}
                      className="w-full p-2 text-left text-xs text-white hover:bg-white/10 rounded-lg flex items-center justify-between transition"
                    >
                      <span className="font-semibold truncate">{pl.name}</span>
                      <span className="text-[10px] text-zinc-400">{pl.tracks.length} Titel</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
