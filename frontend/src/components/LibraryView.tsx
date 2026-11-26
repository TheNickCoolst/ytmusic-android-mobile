import React, { useState, useEffect } from 'react';
import {
  Heart,
  ListMusic,
  Download,
  History as HistoryIcon,
  Plus,
  Trash2,
  HardDrive,
  LogIn,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Play,
  X,
  Music2,
  Pencil,
  Share2,
  ChevronUp,
  ChevronDown,
  Search,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { toast } from '../services/ui';
import { topTracks, topArtists, totalPlays } from '../services/stats';
import { usePlayer } from '../context/PlayerContext';
import { TrackItem } from './TrackItem';
import { PlayAllBar } from './PlayAllBar';
import { EmptyState, goToTab } from './Primitives';
import { api, UserProfile } from '../services/api';
import { Track, Playlist } from '../types';

interface LibraryViewProps {
  userProfile: UserProfile;
  onOpenAuth: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ userProfile, onOpenAuth }) => {
  const {
    likedTracks,
    history,
    playTrack,
    playlists,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    movePlaylistTrack,
    removeFromPlaylist,
    removeFromHistory,
    clearHistory,
  } = usePlayer();
  const [activeTab, setActiveTab] = useState<'liked' | 'playlists' | 'downloads' | 'history' | 'stats'>('liked');
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<'added' | 'title' | 'artist'>('added');
  const [statsRange, setStatsRange] = useState<'week' | 'month' | 'all'>('week');
  const [playlistDownload, setPlaylistDownload] = useState<{ done: number; total: number } | null>(null);

  // YouTube Account synced data
  const [ytLikedSongs, setYtLikedSongs] = useState<Track[]>([]);
  const [ytPlaylists, setYtPlaylists] = useState<any[]>([]);
  const [ytHistory, setYtHistory] = useState<Track[]>([]);
  const [cacheInfo, setCacheInfo] = useState<{ totalSizeMB: string; count: number; tracks: any[] }>({
    totalSizeMB: '0 MB',
    count: 0,
    tracks: []
  });
  const [loading, setLoading] = useState(false);

  // New Playlist Modal state
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');

  // Selected Local Playlist detail view
  // by id, so renames / reordering show up right away
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const selectedLocalPlaylist = playlists.find((p) => p.id === selectedPlaylistId) || null;
  const setSelectedLocalPlaylist = (p: Playlist | null) => setSelectedPlaylistId(p?.id ?? null);

  // Load account data if logged in
  const loadAccountData = async () => {
    if (userProfile.isLoggedIn) {
      setLoading(true);
      try {
        const [liked, pls, hist] = await Promise.all([
          api.getUserLikedSongs().catch(() => []),
          api.getUserPlaylists().catch(() => []),
          api.getUserHistory().catch(() => [])
        ]);
        setYtLikedSongs(liked);
        setYtPlaylists(pls);
        setYtHistory(hist);
      } catch (err) {
        console.error('Failed to load user account library:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const loadCacheInfo = async () => {
    try {
      const data = await api.getCacheList();
      setCacheInfo(data);
    } catch (e) {
      console.warn('Failed to fetch cache list:', e);
    }
  };

  useEffect(() => {
    loadAccountData();
    loadCacheInfo();
  }, [userProfile.isLoggedIn]);

  // Determine which liked tracks to show (YouTube account liked songs take priority if logged in, else local)
  const q = filterText.trim().toLowerCase();
  const matches = (t: Track) => !q || `${t.title} ${t.artist} ${t.album || ''}`.toLowerCase().includes(q);
  const likedBase = userProfile.isLoggedIn && ytLikedSongs.length > 0 ? ytLikedSongs : likedTracks;
  const displayLiked = (() => {
    const list = likedBase.filter(matches);
    if (sortBy === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title, 'de'));
    if (sortBy === 'artist') return [...list].sort((a, b) => (a.artist || '').localeCompare(b.artist || '', 'de'));
    return list;
  })();
  // logged in: listening history of the Google account
  const usingYtHistory = userProfile.isLoggedIn && ytHistory.length > 0;
  const displayHistory = (usingYtHistory ? ytHistory : history).filter(matches);

  const downloadPlaylist = async (tracks: Track[]) => {
    if (playlistDownload) return;
    const todo = tracks.filter((t) => !api.isDownloaded(t.id));
    if (!todo.length) {
      toast('Schon alles offline');
      return;
    }
    setPlaylistDownload({ done: 0, total: todo.length });
    let failed = 0;
    for (let i = 0; i < todo.length; i++) {
      const t = todo[i];
      try {
        await api.downloadTrack(t.id, { title: t.title, artist: t.artist, thumbnail: t.thumbnail, duration: t.duration });
      } catch {
        failed++;
      }
      setPlaylistDownload({ done: i + 1, total: todo.length });
    }
    setPlaylistDownload(null);
    loadCacheInfo();
    toast(failed ? `${todo.length - failed} geladen, ${failed} fehlgeschlagen` : `${todo.length} Songs offline gespeichert`, failed ? 'error' : 'info');
  };

  const sharePlaylist = async (pl: Playlist) => {
    const text = `${pl.name}\n` + pl.tracks.map((t, i) => `${i + 1}. ${t.title} – ${t.artist}`).join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: pl.name, text });
        return;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Playlist als Text kopiert');
    } catch {
      toast('Teilen nicht möglich', 'error');
    }
  };

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    createPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim() || undefined);
    setNewPlaylistName('');
    setNewPlaylistDesc('');
    setShowCreatePlaylistModal(false);
  };

  const handlePlayOfflineTrack = (track: any) => {
    const offlineObj: Track = {
      id: track.id,
      title: track.title || `Offline Track (${track.id})`,
      artist: track.artist || 'Offline Audio',
      thumbnail: track.thumbnail || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`,
      duration: track.duration || '3:30',
      isCached: true
    };
    const allOfflineList: Track[] = cacheInfo.tracks.map((t) => ({
      id: t.id,
      title: t.title || `Offline Track (${t.id})`,
      artist: t.artist || 'Offline Audio',
      thumbnail: t.thumbnail || `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`,
      duration: t.duration || '3:30',
      isCached: true
    }));
    playTrack(offlineObj, allOfflineList);
  };

  return (
    <div className="pb-player px-4 space-y-5 pt-3 select-none">
      {/* Page Title & Account banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.75rem] leading-tight font-extrabold tracking-tight text-white">
            Mediathek
          </h2>
          <p className="text-[0.8125rem] text-zinc-500 mt-0.5">
            Deine Musik, Playlists & Offline-Titel
          </p>
        </div>
        <button
          onClick={() => {
            loadAccountData();
            loadCacheInfo();
          }}
          className="w-11 h-11 flex items-center justify-center text-zinc-300 hover:text-white rounded-full bg-white/[0.07] press"
          title="Aktualisieren"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Account Status Card */}
      {!userProfile.isLoggedIn ? (
        <div
          onClick={onOpenAuth}
          className="p-4 rounded-3xl bg-gradient-to-br from-red-600/30 via-red-950/40 to-white/[0.04] border border-red-500/20 flex items-center cursor-pointer press shadow-float"
        >
          <div className="w-11 h-11 rounded-2xl bg-red-600/30 flex items-center justify-center text-red-400 flex-shrink-0">
            <LogIn className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 mx-3">
            <div className="text-[0.9375rem] font-bold text-white">
              Mit Google anmelden
              <Sparkles className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5 text-red-400 align-middle" />
            </div>
            <p className="text-[0.8125rem] text-zinc-400 mt-0.5 leading-snug">
              Holt deine Playlists, Lieblingssongs und deinen Verlauf von YouTube Music.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-400 flex-shrink-0" />
        </div>
      ) : (
        <div className="p-3 pl-3.5 rounded-3xl bg-white/[0.06] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <img
              src={userProfile.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
              alt={userProfile.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/60"
            />
            <div>
              <div className="text-sm font-semibold text-white flex items-center space-x-1">
                <span>{userProfile.name}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-[0.75rem] text-zinc-400">
                Mit YouTube Music verbunden
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAuth}
            className="h-9 px-4 text-[0.8125rem] font-medium text-zinc-200 hover:text-white rounded-full bg-white/[0.08] press"
          >
            Verwalten
          </button>
        </div>
      )}

      {/* Library Tabs */}
      <div className="shelf space-x-2 -mx-4 px-4 pb-1 scrollbar-none">
        {[
          { id: 'liked', label: 'Lieblingssongs', count: displayLiked.length, icon: Heart },
          { id: 'playlists', label: 'Playlists', count: ytPlaylists.length + playlists.length, icon: ListMusic },
          { id: 'downloads', label: 'Offline', count: cacheInfo.count, icon: Download },
          { id: 'history', label: 'Verlauf', count: displayHistory.length, icon: HistoryIcon },
          { id: 'stats', label: 'Statistik', count: 0, icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedLocalPlaylist(null);
              }}
              aria-pressed={isActive}
              className={`flex items-center space-x-1.5 h-10 px-4 rounded-full text-[0.8125rem] font-semibold whitespace-nowrap press ${
                isActive
                  ? 'bg-white text-black'
                  : 'bg-white/[0.08] text-zinc-300 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive && tab.id === 'liked' ? 'fill-current' : ''}`} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`tabular-nums text-[0.75rem] ${isActive ? 'text-black/50' : 'text-zinc-500'}`}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + sort inside the library */}
      {(activeTab === 'liked' || activeTab === 'history') && (
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filtern…"
              aria-label="Mediathek filtern"
              className="w-full h-10 bg-white/[0.07] border border-transparent rounded-full pl-10 pr-10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20"
            />
            {filterText && (
              <button aria-label="Filter leeren" onClick={() => setFilterText('')} className="absolute right-0.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-zinc-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {activeTab === 'liked' && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sortieren"
              className="h-10 flex-shrink-0 bg-white/[0.07] border border-transparent rounded-full px-3 text-sm text-zinc-200 focus:outline-none"
            >
              <option value="added">Neueste zuerst</option>
              <option value="title">Titel A–Z</option>
              <option value="artist">Künstler A–Z</option>
            </select>
          )}
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreatePlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-surface-2 border border-white/[0.08] rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-red-500" />
                <span>Neue Playlist erstellen</span>
              </h3>
              <button
                onClick={() => setShowCreatePlaylistModal(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Name der Playlist *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Workout Bangers, Chill Vibes..."
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Beschreibung (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Meine persönlichen Lieblingssongs"
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePlaylistModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg transition active:scale-95"
                >
                  Erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Local Playlist Modal / Detail View */}
      {selectedLocalPlaylist && (
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
                <Music2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white truncate">{selectedLocalPlaylist.name}</h3>
                <p className="text-xs text-zinc-400">
                  {playlistDownload
                    ? `Lade offline … ${playlistDownload.done}/${playlistDownload.total}`
                    : `${selectedLocalPlaylist.tracks.length} Titel • Eigene Playlist`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              {selectedLocalPlaylist.tracks.length > 0 && (
                <button
                  onClick={() => playTrack(selectedLocalPlaylist.tracks[0], selectedLocalPlaylist.tracks)}
                  className="p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg active:scale-90 transition"
                  title="Abspielen"
                >
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                </button>
              )}
              <button
                onClick={() => {
                  const name = window.prompt('Neuer Name der Playlist', selectedLocalPlaylist.name);
                  if (name && name.trim()) {
                    renamePlaylist(selectedLocalPlaylist.id, name.trim());
                    toast('Umbenannt');
                  }
                }}
                className="p-2 text-zinc-400 hover:text-white rounded-full active:scale-90 transition"
                aria-label="Umbenennen"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {selectedLocalPlaylist.tracks.length > 0 && (
                <button
                  onClick={() => downloadPlaylist(selectedLocalPlaylist.tracks)}
                  disabled={!!playlistDownload}
                  className="p-2 text-zinc-400 hover:text-white rounded-full active:scale-90 transition disabled:opacity-40"
                  aria-label="Ganze Playlist offline laden"
                >
                  {playlistDownload ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
              )}
              {selectedLocalPlaylist.tracks.length > 0 && (
                <button
                  onClick={() => sharePlaylist(selectedLocalPlaylist)}
                  className="p-2 text-zinc-400 hover:text-white rounded-full active:scale-90 transition"
                  aria-label="Playlist teilen"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => {
                  if (!window.confirm(`Playlist „${selectedLocalPlaylist.name}“ löschen?`)) return;
                  deletePlaylist(selectedLocalPlaylist.id);
                  setSelectedLocalPlaylist(null);
                }}
                aria-label="Playlist löschen"
                className="p-2 text-zinc-400 hover:text-red-400 rounded-full active:scale-90 transition"
                title="Playlist löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedLocalPlaylist(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {selectedLocalPlaylist.tracks.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              Diese Playlist ist noch leer. Tippe bei beliebigen Songs auf das Menü (⋮), um sie hinzuzufügen!
            </div>
          ) : (
            <div className="space-y-1">
              {selectedLocalPlaylist.tracks.map((track, i) => (
                <div key={`${track.id}-${i}`} className="flex items-center">
                  <div className="flex-1 min-w-0">
                    <TrackItem track={track} index={i + 1} playlistContext={selectedLocalPlaylist.tracks} />
                  </div>
                  <div className="flex flex-col">
                    <button
                      aria-label="Nach oben"
                      disabled={i === 0}
                      onClick={() => movePlaylistTrack(selectedLocalPlaylist.id, i, i - 1)}
                      className="p-1 text-zinc-500 disabled:opacity-20"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      aria-label="Nach unten"
                      disabled={i === selectedLocalPlaylist.tracks.length - 1}
                      onClick={() => movePlaylistTrack(selectedLocalPlaylist.id, i, i + 1)}
                      className="p-1 text-zinc-500 disabled:opacity-20"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    aria-label="Aus Playlist entfernen"
                    onClick={() => {
                      removeFromPlaylist(selectedLocalPlaylist.id, track.id);
                      toast('Aus Playlist entfernt');
                    }}
                    className="p-1.5 text-zinc-500 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-red-500" />
          <span className="text-xs">Synchronisiere Mediathek...</span>
        </div>
      ) : (
        <div>
          {/* Liked songs tab */}
          {activeTab === 'liked' && (
            <div className="space-y-1">
              {displayLiked.length === 0 ? (
                filterText ? (
                  <EmptyState icon={Search} title="Nichts gefunden" hint={`Kein Lieblingssong passt zu „${filterText}“.`} />
                ) : (
                  <EmptyState
                    icon={Heart}
                    title="Noch keine Lieblingssongs"
                    hint="Tippe bei einem Song auf das Herz – er landet dann hier."
                    action={{ label: 'Musik finden', onClick: () => goToTab('search') }}
                  />
                )
              ) : (
                <>
                <PlayAllBar tracks={displayLiked} />
                {displayLiked.map((track, i) => (
                  <TrackItem
                    key={`${track.id}-${i}`}
                    track={track}
                    index={i + 1}
                    playlistContext={displayLiked}
                  />
                ))}
                </>
              )}
            </div>
          )}

          {/* Playlists tab */}
          {activeTab === 'playlists' && (
            <div className="space-y-4">
              {/* Top Create Playlist Action */}
              <button
                onClick={() => setShowCreatePlaylistModal(true)}
                className="w-full h-14 px-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] flex items-center space-x-3 text-left press"
              >
                <span className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5" />
                </span>
                <span className="text-[0.9375rem] font-semibold text-white">Neue Playlist erstellen</span>
              </button>

              {/* Local User Playlists */}
              {playlists.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
                    Meine Playlists ({playlists.length})
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {playlists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => setSelectedLocalPlaylist(pl)}
                        className="p-2.5 bg-white/[0.05] rounded-2xl hover:bg-white/[0.08] cursor-pointer press"
                      >
                        <div className="w-full aspect-square rounded-xl bg-white/[0.06] flex items-center justify-center mb-2.5 overflow-hidden">
                          {pl.cover ? (
                            <img src={pl.cover} alt={pl.name} className="w-full h-full object-cover" />
                          ) : (
                            <Music2 className="w-10 h-10 text-red-500/60" />
                          )}
                        </div>
                        <div className="text-xs font-bold text-white truncate">
                          {pl.name}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {pl.tracks.length} Titel
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* YouTube Playlists from Account */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
                  YouTube Music Playlists ({ytPlaylists.length})
                </div>

                {!userProfile.isLoggedIn ? (
                  <div className="text-center py-8 text-zinc-400 text-xs space-y-2 bg-white/5 rounded-2xl p-4">
                    <p>Melde dich mit deinem YouTube-Konto an, um deine Online-Playlists abzurufen.</p>
                    <button
                      onClick={onOpenAuth}
                      className="px-4 py-2 rounded-full bg-red-600 text-white font-semibold text-xs"
                    >
                      Jetzt anmelden
                    </button>
                  </div>
                ) : ytPlaylists.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs">
                    Keine YouTube-Playlists gefunden.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {ytPlaylists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => {
                          api.search(pl.title, 'songs').then((res) => {
                            if (res.length > 0) playTrack(res[0], res);
                          });
                        }}
                        className="p-2.5 bg-white/[0.05] rounded-2xl hover:bg-white/[0.08] cursor-pointer press"
                      >
                        <img
                          src={pl.thumbnail}
                          alt={pl.title}
                          className="w-full aspect-square rounded-xl object-cover mb-2.5"
                        />
                        <div className="text-xs font-bold text-white truncate">
                          {pl.title}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {pl.trackCount ? `${pl.trackCount} Titel` : 'Playlist'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Offline Downloads tab */}
          {activeTab === 'downloads' && (
            <div className="space-y-3">
              {/* Storage Meter */}
              <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <HardDrive className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold text-white">
                      Offline-Speicherplatz
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {cacheInfo.count} Titel gespeichert ({cacheInfo.totalSizeMB})
                    </div>
                  </div>
                </div>
                {cacheInfo.count > 0 && (
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Alle ${cacheInfo.count} Offline-Titel löschen?`)) return;
                      for (const t of cacheInfo.tracks) {
                        await api.deleteFromCache(t.id);
                      }
                      loadCacheInfo();
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded-lg bg-red-500/10 active:scale-95 transition"
                  >
                    Alle leeren
                  </button>
                )}
              </div>

              {cacheInfo.tracks.length === 0 ? (
                <EmptyState
                  icon={Download}
                  title="Noch nichts offline"
                  hint="Im Song-Menü (⋮) auf „Für Offline laden“ tippen – dann läuft der Song auch ohne Internet."
                />
              ) : (
                <div className="space-y-1">
                  <PlayAllBar
                    tracks={cacheInfo.tracks.map((t) => ({
                      id: t.id,
                      title: t.title || `Offline Track (${t.id})`,
                      artist: t.artist || 'Offline Audio',
                      thumbnail: t.thumbnail || `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`,
                      duration: t.duration || '3:30',
                    }))}
                  />
                  {cacheInfo.tracks.map((ct) => (
                    <div
                      key={ct.id}
                      onClick={() => handlePlayOfflineTrack(ct)}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer active:scale-[0.99] transition group"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1 mr-2">
                        <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                          <img
                            src={ct.thumbnail || `https://i.ytimg.com/vi/${ct.id}/hqdefault.jpg`}
                            alt={ct.title || ct.id}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white truncate">
                            {ct.title || `Offline Track (${ct.id})`}
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-center space-x-1.5 truncate">
                            <span className="truncate">{ct.artist || 'Offline Audio'}</span>
                            <span>•</span>
                            <span>{ct.sizeFormatted}</span>
                            <span>•</span>
                            <span className="text-emerald-400">Offline bereit</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await api.deleteFromCache(ct.id);
                          loadCacheInfo();
                        }}
                        className="p-2 text-zinc-500 hover:text-red-400 rounded-lg active:scale-90 transition"
                        title="Aus Cache entfernen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Statistics tab */}
          {activeTab === 'stats' && (() => {
            const span = statsRange === 'week' ? 7 * 864e5 : statsRange === 'month' ? 30 * 864e5 : 1e13;
            const songs = topTracks(span, 10);
            const artists = topArtists(span, 5);
            const plays = totalPlays(span);
            return (
              <div className="space-y-4">
                <div className="flex gap-1.5">
                  {([['week', '7 Tage'], ['month', '30 Tage'], ['all', 'Gesamt']] as const).map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setStatsRange(v)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statsRange === v ? 'bg-white text-black' : 'bg-white/10 text-zinc-300'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-red-700/40 to-zinc-900 border border-white/10">
                  <div className="text-3xl font-black text-white">{plays}</div>
                  <div className="text-xs text-zinc-300">Songs gehört · etwa {Math.round((plays * 3.5) / 60)} Stunden</div>
                </div>
                {plays === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs">Noch keine Daten – hör ein paar Songs!</div>
                ) : (
                  <>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Top-Künstler</h3>
                      {artists.map((a, i) => (
                        <button
                          key={a.artist}
                          onClick={() => window.dispatchEvent(new CustomEvent('ytm:search', { detail: a.artist }))}
                          className="w-full flex items-center justify-between py-1.5 text-sm text-white"
                        >
                          <span className="truncate">
                            <span className="text-zinc-500 mr-2">{i + 1}</span>
                            {a.artist}
                          </span>
                          <span className="text-xs text-zinc-400">{a.plays}×</span>
                        </button>
                      ))}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Top-Songs</h3>
                      <PlayAllBar tracks={songs.map((x) => x.track)} />
                      {songs.map((x, i) => (
                        <div key={x.track.id} className="flex items-center">
                          <div className="flex-1 min-w-0">
                            <TrackItem track={x.track} index={i + 1} playlistContext={songs.map((y) => y.track)} />
                          </div>
                          <span className="text-xs text-zinc-400 pr-2">{x.plays}×</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* History tab */}
          {activeTab === 'history' && (
            <div className="space-y-1">
              {displayHistory.length === 0 ? (
                filterText ? (
                  <EmptyState icon={Search} title="Nichts gefunden" hint={`Kein Song im Verlauf passt zu „${filterText}“.`} />
                ) : (
                  <EmptyState
                    icon={HistoryIcon}
                    title="Noch nichts gehört"
                    hint="Songs, die du abspielst, erscheinen hier."
                    action={{ label: 'Musik finden', onClick: () => goToTab('search') }}
                  />
                )
              ) : (
                <>
                <PlayAllBar tracks={displayHistory} />
                {!usingYtHistory && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (window.confirm('Ganzen Verlauf auf diesem Gerät löschen?')) clearHistory();
                      }}
                      className="text-[11px] text-red-400 px-2 py-1"
                    >
                      Verlauf löschen
                    </button>
                  </div>
                )}
                {displayHistory.map((track, i) => (
                  <div key={`${track.id}-${i}`} className="flex items-center">
                    <div className="flex-1 min-w-0">
                      <TrackItem track={track} index={i + 1} playlistContext={displayHistory} />
                    </div>
                    {!usingYtHistory && (
                      <button
                        aria-label="Aus Verlauf entfernen"
                        onClick={() => removeFromHistory(track.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
