import React, { useRef, useState } from 'react';
import { tap } from '../services/ui';
import { Play, Pause, SkipForward, Heart, Loader2 } from 'lucide-react';
import { usePlayer, usePlaybackTime } from '../context/PlayerContext';

export const MiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    togglePlay,
    nextTrack,
    previousTrack,
    duration,
    setIsPlayerExpanded,
    toggleLike,
    isLiked,
  } = usePlayer();
  const currentTime = usePlaybackTime();
  // swipe left = next song, right = previous, up = open the player
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  const [dragX, setDragX] = useState(0);

  if (!currentTrack) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touchRef.current;
    if (!s) return;
    const dx = e.touches[0].clientX - s.x;
    const dy = e.touches[0].clientY - s.y;
    if (Math.abs(dx) > Math.abs(dy)) setDragX(Math.max(-90, Math.min(90, dx)));
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchRef.current;
    touchRef.current = null;
    setDragX(0);
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipedRef.current = true;
      tap();
      if (dx < 0) nextTrack();
      else previousTrack();
    } else if (dy < -50 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      swipedRef.current = true;
      setIsPlayerExpanded(true);
    }
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const liked = isLiked(currentTrack.id);

  return (
    <div
      onClick={() => {
        if (swipedRef.current) {
          swipedRef.current = false;
          return;
        }
        setIsPlayerExpanded(true);
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="fixed bottom-mini left-2 right-2 z-30 max-w-xl mx-auto rounded-2xl overflow-hidden shadow-float cursor-pointer select-none bg-surface-3 border border-white/[0.08] transition-transform duration-150 active:scale-[0.99]"
      style={{ height: 'var(--mini-h)' }}
    >
      {/* cover tint: blurred artwork behind the bar (hidden in battery-saver mode) */}
      <img
        key={currentTrack.thumbnail}
        src={currentTrack.thumbnail}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover scale-150 blur-[28px] opacity-60 pointer-events-none"
      />
      <div className="absolute inset-0 bg-black/45 pointer-events-none" />

      <div className="relative h-full flex items-center pl-2 pr-1">
        <div
          className="flex items-center min-w-0 flex-1 mr-1"
          style={
            dragX
              ? { transform: `translateX(${dragX}px)`, opacity: 1 - Math.abs(dragX) / 180 }
              : { transition: 'transform 0.25s var(--ease-out), opacity 0.25s ease' }
          }
        >
          <div className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-zinc-800 shadow-md">
            <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
            {isBuffering && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 ml-3">
            <div className="text-[0.875rem] font-semibold text-white truncate tracking-tight leading-snug">
              {currentTrack.title}
            </div>
            <div className="text-[0.8125rem] text-white/60 truncate leading-snug">{currentTrack.artist}</div>
          </div>
        </div>

        <div className="flex items-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              tap();
              toggleLike(currentTrack);
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center press ${
              liked ? 'text-red-500' : 'text-white/70 hover:text-white'
            }`}
            aria-label={liked ? 'Gefällt mir entfernen' : 'Gefällt mir'}
            title={liked ? 'Gefällt mir entfernen' : 'Gefällt mir'}
          >
            <Heart className={`w-[1.375rem] h-[1.375rem] ${liked ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={() => {
              tap();
              togglePlay();
            }}
            disabled={isBuffering}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white press"
            aria-label={isPlaying ? 'Pause' : 'Abspielen'}
            title={isPlaying ? 'Pause' : 'Abspielen'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-white stroke-none" />
            ) : (
              <Play className="w-7 h-7 fill-white stroke-none ml-0.5" />
            )}
          </button>

          <button
            onClick={() => {
              tap();
              nextTrack();
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white press"
            aria-label="Nächster Titel"
            title="Nächster Titel"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>
        </div>
      </div>

      {/* progress along the bottom edge */}
      <div className="absolute left-3 right-3 bottom-0 h-[2px] rounded-full bg-white/15 overflow-hidden">
        <div className="h-full bg-white rounded-full transition-[width] duration-300 ease-linear" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
};
