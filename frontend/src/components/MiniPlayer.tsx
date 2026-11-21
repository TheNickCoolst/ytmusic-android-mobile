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

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
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
      className="fixed bottom-[calc(56px+max(var(--sab),8px))] left-2 right-2 z-30 bg-[#212121]/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl cursor-pointer select-none active:scale-[0.99] transition duration-150"
    >
      {/* Top progress bar */}
      <div className="w-full bg-white/10 h-0.5">
        <div
          className="bg-red-600 h-full transition-all duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        {/* Track thumbnail & info */}
        <div
          className="flex items-center space-x-3 min-w-0 flex-1 mr-2"
          style={dragX ? { transform: `translateX(${dragX}px)`, opacity: 1 - Math.abs(dragX) / 180 } : undefined}
        >
          <div className="relative w-11 h-11 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-md">
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className={`w-full h-full object-cover ${isPlaying ? 'scale-105' : 'scale-100'} transition-transform duration-700`}
            />
            {isBuffering && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate tracking-tight">
              {currentTrack.title}
            </div>
            <div className="text-xs text-zinc-400 truncate">
              {currentTrack.artist}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              tap();
              toggleLike(currentTrack);
            }}
            className="p-2 text-zinc-400 hover:text-red-500 transition active:scale-90"
            title={liked ? "Gefällt mir entfernen" : "Gefällt mir"}
          >
            <Heart className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
          </button>

          <button
            onClick={() => {
              tap();
              togglePlay();
            }}
            disabled={isBuffering}
            className="p-2.5 rounded-full text-white bg-white/10 hover:bg-white/20 active:scale-90 transition"
            title={isPlaying ? "Pause" : "Abspielen"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={() => {
              tap();
              nextTrack();
            }}
            className="p-2 text-zinc-300 hover:text-white transition active:scale-90"
            title="Nächster Titel"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
};
