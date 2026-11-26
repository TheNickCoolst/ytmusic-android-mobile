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
  ChevronLeft
} from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { TrackItem } from './TrackItem';
import { PlayAllBar } from './PlayAllBar';
import { tap, useBackClose } from '../services/ui';

/** Genre / mood tiles. `embedded`: shown inside the search tab (no own title or bottom padding). */
export const ExploreView: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

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

  const loadTokenRef = React.useRef(0);
  const handleSelect = async (cat: typeof categories[0]) => {
    tap();
    const token = ++loadTokenRef.current;
    setSelectedCategory(cat.name);
    setTracks([]);
    setFailed(false);
    setLoading(true);
    try {
      const data = await api.search(cat.query, 'songs');
      if (token === loadTokenRef.current) setTracks(data);
    } catch (err) {
      console.error('Failed to load category:', err);
      if (token === loadTokenRef.current) setFailed(true);
    } finally {
      if (token === loadTokenRef.current) setLoading(false);
    }
  };
  const closeCategory = () => {
    loadTokenRef.current++;
    setSelectedCategory(null);
    setLoading(false);
  };
  useBackClose(!!selectedCategory, closeCategory);
  const selected = categories.find((c) => c.name === selectedCategory);

  // one category open: its songs, with a way back to the grid
  if (selected) {
    const Icon = selected.icon;
    return (
      <div className={embedded ? '' : 'pb-player px-4 pt-3'}>
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${selected.color} p-4 mb-4 shadow-float`}>
          <button
            onClick={closeCategory}
            aria-label="Zurück zu den Kategorien"
            className="relative z-10 -ml-1 -mt-1 mb-3 h-9 pl-1.5 pr-3.5 rounded-full bg-black/25 flex items-center space-x-1 text-[0.8125rem] font-semibold text-white press"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Alle Kategorien</span>
          </button>
          <div className="relative z-10 flex items-center">
            <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-white" />
            </span>
            <div className="min-w-0 ml-3">
              <h2 className="text-[1.375rem] leading-tight font-extrabold tracking-tight text-white">{selected.name}</h2>
              <p className="text-[0.8125rem] text-white/75 mt-0.5">{selected.desc}</p>
            </div>
          </div>
          <div className="absolute -right-6 -bottom-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        </div>

        {loading ? (
          <div className="space-y-2" aria-label="Lädt">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center h-16 px-2">
                <div className="w-12 h-12 rounded-xl skeleton" />
                <div className="ml-3 flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 rounded-full skeleton" />
                  <div className="h-3 w-1/3 rounded-full skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : failed ? (
          <div className="text-center py-12 text-zinc-400 text-sm space-y-3">
            <div>Laden fehlgeschlagen – Internetverbindung prüfen.</div>
            <button
              onClick={() => handleSelect(selected)}
              className="h-10 px-5 rounded-full bg-white/10 text-white text-sm font-semibold press"
            >
              Nochmal versuchen
            </button>
          </div>
        ) : (
          <>
            <PlayAllBar tracks={tracks} />
            <div className="space-y-0.5 -mx-2">
              {tracks.map((track, i) => (
                <TrackItem key={`${track.id}-${i}`} track={track} index={i + 1} playlistContext={tracks} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'pb-player px-4 pt-3'}>
      {!embedded && (
        <div className="mb-5">
          <h2 className="text-[1.75rem] leading-tight font-extrabold tracking-tight text-white">Entdecken</h2>
          <p className="text-[0.8125rem] text-zinc-500 mt-0.5">Stimmungen, Genres und kuratierte Playlists</p>
        </div>
      )}

      {/* Category Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => handleSelect(cat)}
              className={`relative overflow-hidden rounded-3xl p-4 h-[6.5rem] text-left bg-gradient-to-br ${cat.color} press shadow-float flex flex-col justify-between`}
            >
              <Icon className="relative z-10 w-6 h-6 text-white/90" />
              <div className="relative z-10 min-w-0">
                <h3 className="text-[0.9375rem] font-bold text-white leading-tight line-clamp-2">{cat.name}</h3>
              </div>
              <div className="absolute -right-5 -bottom-5 w-20 h-20 rounded-full bg-white/10 blur-xl pointer-events-none" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
