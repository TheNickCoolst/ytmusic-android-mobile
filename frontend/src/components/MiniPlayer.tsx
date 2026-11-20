import React from 'react';
import { Play, Pause, SkipForward, Heart, Loader2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const MiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    togglePlay,
    nextTrack,
    currentTime,
    duration,
    setIsPlayerExpanded,
    toggleLike,
    isLiked,
  } = usePlayer();

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const liked = isLiked(currentTrack.id);

  return (
    <div
      onClick={() => setIsPlayerExpanded(true)}
      className="fixed bottom-[calc(56px+max(env(safe-area-inset-bottom),8px))] left-2 right-2 z-30 bg-[#212121]/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl cursor-pointer select-none active:scale-[0.99] transition duration-150"
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
        <div className="flex items-center space-x-3 min-w-0 flex-1 mr-2">
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
            onClick={() => toggleLike(currentTrack)}
            className="p-2 text-zinc-400 hover:text-red-500 transition active:scale-90"
            title={liked ? "Gefällt mir entfernen" : "Gefällt mir"}
          >
            <Heart className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
          </button>

          <button
            onClick={togglePlay}
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
            onClick={nextTrack}
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
