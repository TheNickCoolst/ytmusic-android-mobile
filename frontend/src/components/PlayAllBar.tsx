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
    <div className="flex items-center gap-2 mb-2">
      <button
        onClick={() => {
          tap();
          playTrack(tracks[0], tracks);
        }}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full bg-white text-black text-xs font-bold active:scale-95 transition"
      >
        <Play className="w-4 h-4 fill-black" /> Alle abspielen
      </button>
      <button
        onClick={() => {
          tap();
          const s = shuffled(tracks);
          playTrack(s[0], s);
        }}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full bg-white/10 text-white text-xs font-bold active:scale-95 transition"
      >
        <Shuffle className="w-4 h-4" /> Zufällig
      </button>
    </div>
  );
};
