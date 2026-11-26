import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, History, RefreshCw } from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { TrackItem } from './TrackItem';
import { usePlayer } from '../context/PlayerContext';
import { ExploreView } from './ExploreView';
import { PageTitle, SectionHeader } from './Primitives';

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
    <div className="pb-player px-4 space-y-5 pt-3">
      <PageTitle title="Suche" />
      {/* Search Input Bar */}
      <div className="sticky top-0 z-20 bg-[#030303]/95 pt-1 pb-2 -mx-4 px-4 !mt-3">
        <form
          className="relative flex items-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
            if (query.trim()) performSearch(query, filter);
            (document.activeElement as HTMLElement | null)?.blur(); // hide the keyboard
          }}
        >
          <Search className="absolute left-4 w-5 h-5 text-zinc-600 pointer-events-none" />
          <input
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={handleInputChange}
            placeholder="Was möchtest du hören?"
            aria-label="Suchen"
            className="w-full h-12 bg-white text-black border-2 border-transparent rounded-2xl pl-12 pr-12 text-base font-medium placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
          />
          {query && (
            <button
              type="button"
              aria-label="Suche leeren"
              onClick={handleClear}
              className="absolute right-1 w-10 h-10 flex items-center justify-center rounded-full text-zinc-600 hover:text-black active:bg-black/10"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </form>

        {/* Filter Chips (only once there is something to filter) */}
        {query.trim() && (
        <div className="shelf space-x-2 mt-3 -mx-4 px-4 pb-1 scrollbar-none">
          {filterChips.map((chip) => {
            const isSelected = filter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => handleFilterChange(chip.id)}
                className={`h-9 px-4 rounded-full text-[0.8125rem] font-medium whitespace-nowrap press ${
                  isSelected
                    ? 'bg-white text-black font-semibold'
                    : 'bg-white/[0.08] text-zinc-200 hover:bg-white/[0.12]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        )}
      </div>

      {/* Suggestions while typing */}
      {suggestions.length > 0 && query.trim().length > 1 && (
        <div className="-mx-2">
          {suggestions.slice(0, 6).map((sg) => (
            <button
              key={sg}
              onClick={() => {
                if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
                setQuery(sg);
                performSearch(sg, filter);
                (document.activeElement as HTMLElement | null)?.blur();
              }}
              className="w-full h-11 px-2 flex items-center rounded-xl text-left text-[0.9375rem] text-zinc-200 hover:bg-white/[0.05] active:bg-white/[0.08]"
            >
              <Search className="w-4 h-4 mr-3 text-zinc-500 flex-shrink-0" />
              <span className="truncate">{sg}</span>
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
          <div className="text-[0.8125rem] font-semibold text-zinc-400 px-1 mb-1">
            {results.length} Ergebnisse
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
          <SectionHeader
            title="Zuletzt gesucht"
            action={
              <button
                onClick={() => {
                  setRecentSearches([]);
                  saveRecent([]);
                }}
                className="h-9 px-3 rounded-full text-[0.8125rem] font-semibold text-zinc-400 hover:text-white active:bg-white/10"
              >
                Alle löschen
              </button>
            }
          />
          <div className="-mx-2">
            {recentSearches.map((term) => (
              <div key={term} className="flex items-center rounded-xl hover:bg-white/[0.04]">
                <button
                  onClick={() => {
                    setQuery(term);
                    performSearch(term, filter);
                  }}
                  className="flex-1 min-w-0 h-11 px-2 flex items-center text-left text-[0.9375rem] text-zinc-200 active:opacity-60"
                >
                  <History className="w-4 h-4 mr-3 text-zinc-500 flex-shrink-0" />
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
                  className="w-11 h-11 flex items-center justify-center rounded-full text-zinc-500 hover:text-white active:bg-white/10"
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
          <SectionHeader title="Beliebte Künstler" />
          <div className="shelf space-x-2 -mx-4 px-4 scrollbar-none">
            {SUGGESTIONS.filter((t) => !recentSearches.includes(t)).map((term) => (
              <button
                key={term}
                onClick={() => {
                  setQuery(term);
                  performSearch(term, filter);
                }}
                className="h-10 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.12] text-[0.875rem] font-medium text-zinc-200 whitespace-nowrap press"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Browse genres & moods (former "Entdecken" tab) */}
      {!query && (
        <section>
          <SectionHeader eyebrow="Genres & Stimmungen" title="Stöbern" />
          <ExploreView embedded />
        </section>
      )}
    </div>
  );
};
