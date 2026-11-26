import React, { useState, useRef } from 'react';
import { MoreVertical, Heart, Download, Check, ListPlus, Radio, Loader2, FolderPlus, ListStart, Share2, Trash2, ThumbsDown, Plus, User, ChevronLeft } from 'lucide-react';
import { Sheet, SheetItem } from './Sheet';
import { EqBars } from './Primitives';
import { toast, tap, shareTrack } from '../services/ui';
import { Track } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../services/api';

interface TrackItemProps {
  track: Track;
  index?: number;
  playlistContext?: Track[];
  /** chart position, shown left of the cover */
  rank?: number;
}

export const TrackItem: React.FC<TrackItemProps> = ({ track, index, playlistContext, rank }) => {
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
  // one sheet for both the action menu and the playlist picker (single back-button entry)
  const [sheet, setSheet] = useState<null | 'menu' | 'playlist'>(null);
  const showMenu = sheet !== null;
  const setShowMenu = (v: boolean) => setSheet(v ? 'menu' : null);
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

  const handleDownload = async () => {
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

  const artistName =
    track.artist && track.artist !== 'Unbekannt' ? track.artist.split(/,| & | feat\.? /i)[0].trim() : '';
  const disliked = isDisliked(track.id);
  const close = () => setSheet(null);

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
      style={
        dragX
          ? { transform: `translateX(${dragX}px)`, background: `rgba(220,38,38,${Math.min(0.35, dragX / 300)})` }
          : { transition: 'transform 0.25s var(--ease-out), background-color 0.2s ease' }
      }
      className={`group relative flex items-center min-h-[4rem] pl-2 py-1.5 rounded-2xl cursor-pointer select-none ${
        isCurrent ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04] active:bg-white/[0.07]'
      }`}
    >
      {dragX > 0 && (
        <ListPlus
          className={`absolute -left-9 w-5 h-5 transition-opacity ${dragX > 90 ? 'text-white opacity-100' : 'text-white/60 opacity-60'}`}
        />
      )}
      <div className="flex items-center min-w-0 flex-1 mr-1">
        {rank !== undefined && (
          <span
            className={`w-7 -ml-1 mr-2 flex-shrink-0 text-center text-base font-extrabold tabular-nums ${
              rank <= 3 ? 'text-white' : 'text-zinc-600'
            }`}
          >
            {rank}
          </span>
        )}
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
          <div className="flex items-center text-[0.8125rem] leading-snug text-zinc-400 min-w-0 mt-0.5">
            {downloaded && (
              <span className="mr-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex-shrink-0" title="Offline verfügbar">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            )}
            <span className="truncate">{track.artist}</span>
            {track.duration && <span className="flex-shrink-0 ml-1.5 text-zinc-500">· {track.duration}</span>}
            {isDownloading && (
              <span className="flex-shrink-0 ml-2 inline-flex items-center text-[0.6875rem] text-red-300">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> {Math.round(progress * 100)} %
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trailing actions */}
      <div className="flex items-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => {
            tap();
            toggleLike(track);
            toast(liked ? 'Aus Lieblingssongs entfernt' : 'Zu Lieblingssongs hinzugefügt');
          }}
          aria-label={liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'}
          className={`w-11 h-11 rounded-full flex items-center justify-center press ${
            liked ? 'text-red-500' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
        </button>

        <button
          onClick={() => {
            tap();
            setShowMenu(!showMenu);
          }}
          aria-label="Mehr Optionen"
          className="w-11 h-11 rounded-full flex items-center justify-center text-zinc-400 hover:text-white press"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      <Sheet
        open={sheet !== null}
        onClose={close}
        header={
          sheet === 'playlist' ? (
            <div className="flex items-center px-2 pb-2">
              <button
                onClick={() => setSheet('menu')}
                aria-label="Zurück"
                className="w-11 h-11 rounded-full flex items-center justify-center text-zinc-300 active:bg-white/10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-base font-bold text-white">In Playlist speichern</span>
            </div>
          ) : (
            <div className="flex items-center px-5 pb-3 border-b border-white/[0.06]">
              <img src={track.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
              <div className="min-w-0 ml-3">
                <div className="text-[0.9375rem] font-semibold text-white truncate">{track.title}</div>
                <div className="text-[0.8125rem] text-zinc-400 truncate">{track.artist}</div>
              </div>
            </div>
          )
        }
      >
        {sheet === 'menu' && (
          <div className="pt-2">
            <SheetItem
              icon={ListStart}
              label="Als Nächstes abspielen"
              onClick={() => {
                playNext(track);
                close();
                toast('Wird als Nächstes gespielt');
              }}
            />
            <SheetItem
              icon={ListPlus}
              label="Zur Warteschlange"
              onClick={() => {
                addToQueue(track);
                close();
                toast('Zur Warteschlange hinzugefügt');
              }}
            />
            <SheetItem icon={FolderPlus} label="In Playlist speichern" onClick={() => setSheet('playlist')} />
            <SheetItem
              icon={Heart}
              active={liked}
              label={liked ? 'Aus Lieblingssongs entfernen' : 'Zu Lieblingssongs'}
              onClick={() => {
                toggleLike(track);
                close();
                toast(liked ? 'Aus Lieblingssongs entfernt' : 'Zu Lieblingssongs hinzugefügt');
              }}
            />
            {downloaded ? (
              <SheetItem
                icon={Trash2}
                label="Offline-Kopie löschen"
                onClick={async () => {
                  close();
                  await api.deleteFromCache(track.id).catch(() => {});
                  setDownloaded(false);
                  toast('Offline-Kopie gelöscht');
                }}
              />
            ) : (
              <SheetItem
                icon={isDownloading ? Loader2 : Download}
                label="Für Offline laden"
                disabled={isDownloading}
                onClick={handleDownload}
              />
            )}
            <SheetItem
              icon={Radio}
              label="Song-Radio starten"
              onClick={() => {
                close();
                toast('Radio wird geladen…');
                api
                  .getRadio(track.id)
                  .then((r) => {
                    if (r.length > 0) playTrack(r[0], r);
                    else toast('Kein Radio für diesen Song gefunden', 'error');
                  })
                  .catch(() => toast('Radio konnte nicht geladen werden', 'error'));
              }}
            />
            {artistName && (
              <SheetItem
                icon={User}
                label={`Mehr von ${artistName}`}
                onClick={() => {
                  close();
                  window.dispatchEvent(new CustomEvent('ytm:search', { detail: artistName }));
                }}
              />
            )}
            <SheetItem
              icon={Share2}
              label="Teilen"
              onClick={() => {
                close();
                shareTrack(track);
              }}
            />
            <SheetItem
              icon={ThumbsDown}
              active={disliked}
              label={disliked ? 'Wieder interessiert' : 'Nicht interessiert'}
              onClick={() => {
                close();
                toggleDislike(track.id);
                toast(disliked ? 'Wieder interessiert' : 'Wird beim Mischen übersprungen');
              }}
            />
          </div>
        )}

        {sheet === 'playlist' && (
          <div className="px-2">
            <form
              className="flex items-center space-x-2 mb-2"
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
                className="flex-1 min-w-0 h-12 bg-white/[0.06] border border-white/[0.08] rounded-2xl px-4 text-[0.9375rem] text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/70"
              />
              <button
                type="submit"
                aria-label="Playlist erstellen"
                className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center press"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>
            {playlists.length === 0 ? (
              <div className="text-sm text-zinc-500 text-center py-6">Noch keine Playlists – oben eine anlegen.</div>
            ) : (
              <div className="-mx-2">
                {playlists.map((pl) => {
                  const already = pl.tracks.some((t) => t.id === track.id);
                  return (
                    <SheetItem
                      key={pl.id}
                      icon={already ? Check : FolderPlus}
                      active={already}
                      label={pl.name}
                      hint={`${pl.tracks.length} Titel`}
                      onClick={() => {
                        addToPlaylist(pl.id, track);
                        close();
                        toast(already ? `Schon in „${pl.name}“` : `In „${pl.name}“ gespeichert`);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
};
