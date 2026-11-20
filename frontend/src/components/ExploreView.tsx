import React, { useState } from 'react';
import {
  Flame,
  Radio,
  Zap,
  Coffee,
  Brain,
  Music,
  Disc,
  Moon,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { TrackItem } from './TrackItem';
import { usePlayer } from '../context/PlayerContext';

export const ExploreView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const { playTrack } = usePlayer();

  const categories = [
    {
      id: 'charts',
      name: 'Top Hits 2026',
      icon: Flame,
      color: 'from-red-600 to-amber-700',
      desc: 'Die heißesten Songs aktuell',
      query: 'Top Hits 2026 charts'
    },
    {
      id: 'german',
      name: 'Deutschrap & Hip-Hop',
      icon: Radio,
      color: 'from-emerald-700 to-teal-900',
      desc: 'Ayliva, Luciano, Apache 207, RAF',
      query: 'Deutschrap 2026 Top Hits'
    },
    {
      id: 'workout',
      name: 'Gym & Workout',
      icon: Zap,
      color: 'from-orange-600 to-red-800',
      desc: 'Maximaler Bass & Motivation',
      query: 'Gym workout hard bass motivation'
    },
    {
      id: 'chill',
      name: 'Chill & Relax',
      icon: Coffee,
      color: 'from-blue-600 to-indigo-900',
      desc: 'Entspannte Beats zum Abschalten',
      query: 'Chill lofi acoustic beats relax'
    },
    {
      id: 'focus',
      name: 'Deep Focus',
      icon: Brain,
      color: 'from-purple-700 to-slate-900',
      desc: 'Konzentration & Lernen',
      query: 'Instrumental deep focus study music'
    },
    {
      id: 'party',
      name: 'Party & Club Hits',
      icon: Music,
      color: 'from-pink-600 to-rose-900',
      desc: 'Beste Tanz- & EDM-Stimmung',
      query: 'Party dance EDM club hits 2026'
    },
    {
      id: 'rock',
      name: 'Rock Classics',
      icon: Disc,
      color: 'from-yellow-600 to-stone-900',
      desc: 'Legendäre Gitarren & Hymnen',
      query: 'Rock classics greatest hits'
    },
    {
      id: 'sleep',
      name: 'Schlaf & Meditation',
      icon: Moon,
      color: 'from-slate-700 to-zinc-950',
      desc: 'Sanfte Töne zum Einschlafen',
      query: 'Calm ambient sleep meditation rain music'
    },
  ];

  const handleSelect = async (cat: typeof categories[0]) => {
    setSelectedCategory(cat.name);
    setLoading(true);
    try {
      const data = await api.search(cat.query, 'songs');
      setTracks(data);
    } catch (err) {
      console.error('Failed to load category:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-36 px-4 space-y-5 pt-2">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-white">
          Entdecken
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Stimmungen, Genres und kuratierte Playlists
        </p>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.id}
              onClick={() => handleSelect(cat)}
              className={`relative overflow-hidden rounded-2xl p-4 text-left bg-gradient-to-br ${cat.color} border transition active:scale-95 shadow-lg ${
                isSelected ? 'border-white scale-[1.02]' : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="relative z-10">
                <Icon className="w-6 h-6 text-white mb-2" />
                <h3 className="text-sm font-bold text-white leading-tight">
                  {cat.name}
                </h3>
                <p className="text-[11px] text-white/70 line-clamp-1 mt-0.5">
                  {cat.desc}
                </p>
              </div>
              <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-white/10 blur-xl pointer-events-none" />
            </button>
          );
        })}
      </div>

      {/* Selected category track list */}
      {selectedCategory && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>{selectedCategory}</span>
            </h3>
            <span className="text-xs text-zinc-500">
              {tracks.length} Titel gefunden
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-red-500" />
              <span className="text-xs">Lade {selectedCategory}...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {tracks.map((track, i) => (
                <TrackItem
                  key={`${track.id}-${i}`}
                  track={track}
                  index={i + 1}
                  playlistContext={tracks}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
