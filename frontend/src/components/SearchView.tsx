import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, History, RefreshCw } from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { TrackItem } from './TrackItem';
import { usePlayer } from '../context/PlayerContext';

export const SearchView: React.FC<{ initialQuery?: string }> = ({ initialQuery }) => {
  const [query, setQuery] = useState(initialQuery || '');
  const [filter, setFilter] = useState<'all' | 'songs' | 'videos' | 'artists'>('all');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [correction, setCorrection] = useState<string | null>(null);
  const suggestTokenRef = useRef(0);
  const searchTokenRef = useRef(0);
  const SUGGESTIONS = ['Ayliva', 'The Weeknd', 'Luciano', 'Apache 207', 'Billie Eilish'];
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('ytmusic_recent_searches');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const saveRecent = (list: string[]) => {
    try {
      localStorage.setItem('ytmusic_recent_searches', JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const { playTrack } = usePlayer();
  // opened with a shared YouTube link: play it right away
  const autoPlayLinkRef = useRef(!!initialQuery && /youtu\.?be|youtube\.com/i.test(initialQuery));
  useEffect(() => {
    if (initialQuery) {
      setFilter('songs');
      performSearch(initialQuery, 'songs');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performSearch = async (searchQuery: string, searchFilter: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const token = ++searchTokenRef.current;
    setLoading(true);
    setFailed(false);
    setSuggestions([]);
    setCorrection(null);
    try {
      // pasted YouTube / YouTube Music link -> that song (+ its radio)
      const vid = searchQuery.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{11})/)?.[1];
      if (vid) {
        const radio = await api.getRadio(vid);
        if (token !== searchTokenRef.current) return;
        const seed = radio.find((t) => t.id === vid) || {
          id: vid,
          title: 'YouTube-Link',
          artist: 'YouTube',
          thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        };
        const list = [seed, ...radio.filter((t) => t.id !== vid)];
        setResults(list);
        if (autoPlayLinkRef.current) {
          autoPlayLinkRef.current = false;
          playTrack(seed, list);
        }
        return;
      }
      const data = await api.search(searchQuery, searchFilter);
      // an older, slower search must not overwrite the results of the newest one
      if (token !== searchTokenRef.current) return;
      setResults(data);
      setCorrection(api.correctionFor(searchQuery));

      // Save to recent searches
      setRecentSearches((prev) => {
        const q = searchQuery.trim();
        const updated = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 12);
        saveRecent(updated);
        return updated;
      });
    } catch (err) {
      if (token !== searchTokenRef.current) return;
      console.error('Search failed:', err);
      setResults([]);
      setFailed(true);
    } finally {
      if (token === searchTokenRef.current) setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    if (val.trim().length > 1) {
      const st = ++suggestTokenRef.current;
      api.getSearchSuggestions(val).then((s) => st === suggestTokenRef.current && setSuggestions(s));
      debounceTimeout.current = setTimeout(() => {
        performSearch(val, filter);
      }, 700);
    } else {
      searchTokenRef.current++;
      setResults([]);
      setLoading(false);
      setFailed(false);
    }
  };

  const handleFilterChange = (newFilter: 'all' | 'songs' | 'videos' | 'artists') => {
    setFilter(newFilter);
    if (query.trim()) {
      performSearch(query, newFilter);
    }
  };

  const handleClear = () => {
    searchTokenRef.current++;
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    setQuery('');
    setResults([]);
    setLoading(false);
    setFailed(false);
  };

  const filterChips = [
    { id: 'all' as const, label: 'Alle' },
    { id: 'songs' as const, label: 'Songs' },
    { id: 'videos' as const, label: 'Musikvideos' },
    { id: 'artists' as const, label: 'Künstler' },
  ];

  return (
    <div className="pb-36 px-4 space-y-4 pt-2">
      {/* Search Input Bar */}
      <div className="sticky top-14 z-20 bg-[#030303]/95 backdrop-blur-md pt-1 pb-2 -mx-4 px-4">
        <form
          className="relative flex items-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
            if (query.trim()) performSearch(query, filter);
            (document.activeElement as HTMLElement | null)?.blur(); // hide the keyboard
          }}
        >
          <Search className="absolute left-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={handleInputChange}
            placeholder="Songs, Alben, Künstler suchen..."
            className="w-full bg-[#181818] border border-white/10 rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 shadow-inner"
            autoFocus
          />
          {query && (
            <button
              type="button"
              aria-label="Suche leeren"
              onClick={handleClear}
              className="absolute right-3 p-1 rounded-full text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Filter Chips */}
        <div className="flex space-x-2 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
          {filterChips.map((chip) => {
            const isSelected = filter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => handleFilterChange(chip.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition active:scale-95 ${
                  isSelected
                    ? 'bg-white text-black font-semibold'
                    : 'bg-white/10 text-zinc-300 hover:bg-white/15'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Suggestions while typing */}
      {suggestions.length > 0 && query.trim().length > 1 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((sg) => (
            <button
              key={sg}
              onClick={() => {
                if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
                setQuery(sg);
                performSearch(sg, filter);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-200 active:scale-95"
            >
              <Search className="w-3 h-3 text-zinc-500" /> {sg}
            </button>
          ))}
        </div>
      )}

      {!loading && correction && (
        <div className="text-xs text-zinc-400">
          Meintest du{' '}
          <button
            className="text-red-400 font-semibold underline"
            onClick={() => {
              setQuery(correction);
              performSearch(correction, filter);
            }}
          >
            {correction}
          </button>
          ?
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-red-500" />
          <span className="text-xs">Suche auf YouTube Music...</span>
        </div>
      )}

      {/* Results List */}
      {!loading && results.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-zinc-400 px-1 mb-2">
            Suchergebnisse ({results.length})
          </div>
          {results.map((track, i) => (
            <TrackItem
              key={`${track.id}-${i}`}
              track={track}
              index={i + 1}
              playlistContext={results}
            />
          ))}
        </div>
      )}

      {/* No Results found */}
      {!loading && failed && query.trim() && (
        <div className="text-center py-16 text-zinc-400 text-xs space-y-3">
          <div>Suche fehlgeschlagen – Internetverbindung prüfen.</div>
          <button
            onClick={() => performSearch(query, filter)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white font-semibold active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Nochmal
          </button>
        </div>
      )}

      {!loading && !failed && query.trim().length > 1 && results.length === 0 && (
        <div className="text-center py-16 text-zinc-500 text-xs">
          Keine passenden Ergebnisse für "{query}" gefunden.
        </div>
      )}

      {/* Recent / Suggested searches (when query is empty) */}
      {!query && recentSearches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Letzte Suchen</h3>
            <button
              onClick={() => {
                setRecentSearches([]);
                saveRecent([]);
              }}
              className="text-[11px] text-zinc-400 px-2 py-1"
            >
              Alle löschen
            </button>
          </div>
          <div className="space-y-0.5">
            {recentSearches.map((term) => (
              <div key={term} className="flex items-center">
                <button
                  onClick={() => {
                    setQuery(term);
                    performSearch(term, filter);
                  }}
                  className="flex-1 min-w-0 flex items-center gap-3 py-2 text-left text-sm text-zinc-200 active:opacity-60"
                >
                  <History className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <span className="truncate">{term}</span>
                </button>
                <button
                  aria-label={`${term} entfernen`}
                  onClick={() =>
                    setRecentSearches((prev) => {
                      const next = prev.filter((x) => x !== term);
                      saveRecent(next);
                      return next;
                    })
                  }
                  className="p-2 text-zinc-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!query && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Vorschläge</h3>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.filter((t) => !recentSearches.includes(t)).map((term) => (
              <button
                key={term}
                onClick={() => {
                  setQuery(term);
                  performSearch(term, filter);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-zinc-300 transition active:scale-95"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
