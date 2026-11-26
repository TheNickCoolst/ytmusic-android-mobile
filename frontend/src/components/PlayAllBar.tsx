import React from 'react';
import { Play, Shuffle } from 'lucide-react';
import { Track } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { tap } from '../services/ui';

const shuffled = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/** "Alle abspielen" + "Zufällig" above a song list. */
export const PlayAllBar: React.FC<{ tracks: Track[] }> = ({ tracks }) => {
  const { playTrack } = usePlayer();
  if (tracks.length < 2) return null;
  return (
    <div className="flex items-center space-x-2.5 mb-3">
      <button
        onClick={() => {
          tap();
          playTrack(tracks[0], tracks);
        }}
        className="flex-1 h-11 flex items-center justify-center space-x-2 rounded-full bg-white text-black text-[0.875rem] font-bold press"
      >
        <Play className="w-[1.125rem] h-[1.125rem] fill-black" />
        <span>Alle abspielen</span>
      </button>
      <button
        onClick={() => {
          tap();
          const s = shuffled(tracks);
          playTrack(s[0], s);
        }}
        className="flex-1 h-11 flex items-center justify-center space-x-2 rounded-full bg-white/[0.1] text-white text-[0.875rem] font-bold press"
      >
        <Shuffle className="w-[1.125rem] h-[1.125rem]" />
        <span>Zufällig</span>
      </button>
    </div>
  );
};
