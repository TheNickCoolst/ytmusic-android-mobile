import React, { useState, useEffect } from 'react';
import { Flame, Play, Sparkles, RefreshCw, Loader2, Music2 } from 'lucide-react';
import { Track } from '../types';
import { api } from '../services/api';
import { TrackItem } from './TrackItem';
import { usePlayer } from '../context/PlayerContext';

export const HomeView: React.FC = () => {
  const [charts, setCharts] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const { playTrack, history } = usePlayer();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
  };

  const moods = [
    { label: 'Energieschub', query: 'High energy hits workout' },
    { label: 'Entspannung', query: 'Chill acoustic relax music' },
    { label: 'Workout', query: 'Gym workout motivation' },
    { label: 'Fokus', query: 'Lofi deep focus beats' },
    { label: 'Party', query: 'Club dance party hits' },
  ];

  const loadCharts = async () => {
    setLoading(true);
    try {
      const data = await api.getCharts('DE');
      setCharts(data);
    } catch (err) {
      console.error('Failed to load charts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoodSelect = async (mood: typeof moods[0]) => {
    if (activeMood === mood.label) {
      setActiveMood(null);
      loadCharts();
      return;
    }
    setActiveMood(mood.label);
    setLoading(true);
    try {
      const results = await api.search(mood.query, 'songs');
      setCharts(results);
    } catch (err) {
      console.error('Failed to filter by mood:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharts();
  }, []);

  return (
    <div className="pb-36 px-4 space-y-6 pt-2">
      {/* Greeting & Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            {getGreeting()}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            100% Werbefrei • Hintergrundwiedergabe aktiv
          </p>
        </div>
        <button
          onClick={loadCharts}
          className="p-2 text-zinc-400 hover:text-white rounded-full bg-white/5 active:scale-90 transition"
          title="Neu laden"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Mood Quick Pills */}
      <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
        {moods.map((m) => {
          const isSelected = activeMood === m.label;
          return (
            <button
              key={m.label}
              onClick={() => handleMoodSelect(m)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                isSelected
                  ? 'bg-white text-black shadow-lg shadow-white/20'
                  : 'bg-white/10 text-zinc-300 hover:bg-white/15'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Hero Banner: Quick Mix */}
      {charts.length > 0 && (
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-red-950 via-zinc-900 to-black p-5 border border-red-500/20 shadow-xl">
          <div className="relative z-10 max-w-[70%]">
            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full mb-2">
              <Sparkles className="w-3 h-3 mr-1" /> Endlos-Mix
            </span>
            <h3 className="text-lg font-bold text-white leading-tight">
              {activeMood ? `${activeMood} Radio` : 'Deine Top Hits'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Spielt automatisch im Hintergrund weiter ohne Unterbrechung.
            </p>
            <button
              onClick={() => playTrack(charts[0], charts)}
              className="mt-3.5 px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-lg shadow-red-600/30 active:scale-95 transition"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Jetzt starten</span>
            </button>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-red-600/20 blur-2xl"></div>
          {charts[0] && (
            <img
              src={charts[0].thumbnail}
              alt={charts[0].title}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-24 h-24 rounded-xl object-cover shadow-2xl rotate-6 opacity-85 border border-white/10"
            />
          )}
        </div>
      )}

      {/* Recently Played History (if any) */}
      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
            Zuletzt gehört
          </h3>
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
            {history.slice(0, 10).map((track) => (
              <div
                key={track.id}
                onClick={() => playTrack(track)}
                className="w-28 flex-shrink-0 cursor-pointer group select-none active:scale-95 transition"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 shadow-md mb-1.5">
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>
                <div className="text-xs font-medium text-white truncate">
                  {track.title}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {track.artist}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts & Recommended Track List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Flame className="w-4 h-4 text-red-500" />
            <h3 className="text-base font-bold text-white">
              {activeMood ? `${activeMood} Titel` : 'Trending & Charts (Deutschland)'}
            </h3>
          </div>
          <span className="text-[11px] text-zinc-500">
            {charts.length} Titel
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-2">
            <Loader2 className="w-7 h-7 animate-spin text-red-500" />
            <span className="text-xs">Lade Musik...</span>
          </div>
        ) : (
          <div className="space-y-1">
            {charts.map((track, idx) => (
              <TrackItem
                key={track.id || idx}
                track={track}
                index={idx + 1}
                playlistContext={charts}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
