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
  Music2
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { TrackItem } from './TrackItem';
import { api, UserProfile } from '../services/api';
import { Track, Playlist } from '../types';

interface LibraryViewProps {
  userProfile: UserProfile;
  onOpenAuth: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ userProfile, onOpenAuth }) => {
  const { likedTracks, history, playTrack, playlists, createPlaylist, deletePlaylist } = usePlayer();
  const [activeTab, setActiveTab] = useState<'liked' | 'playlists' | 'downloads' | 'history'>('liked');

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
  const [selectedLocalPlaylist, setSelectedLocalPlaylist] = useState<Playlist | null>(null);

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
  const displayLiked = userProfile.isLoggedIn && ytLikedSongs.length > 0 ? ytLikedSongs : likedTracks;
  // logged in: listening history of the Google account
  const displayHistory = userProfile.isLoggedIn && ytHistory.length > 0 ? ytHistory : history;

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
    <div className="pb-36 px-4 space-y-4 pt-2 select-none">
      {/* Page Title & Account banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Mediathek
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Deine Musik, Playlists & Offline-Titel
          </p>
        </div>
        <button
          onClick={() => {
            loadAccountData();
            loadCacheInfo();
          }}
          className="p-2 text-zinc-400 hover:text-white rounded-full bg-white/5 active:scale-90 transition"
          title="Aktualisieren"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Account Status Card */}
      {!userProfile.isLoggedIn ? (
        <div
          onClick={onOpenAuth}
          className="p-4 rounded-2xl bg-gradient-to-r from-red-950/80 to-zinc-900 border border-red-500/30 flex items-center justify-between cursor-pointer active:scale-[0.99] transition shadow-lg"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/30 flex items-center justify-center text-red-500 flex-shrink-0">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center space-x-1.5">
                <span>Mit Google / YouTube anmelden</span>
                <Sparkles className="w-3.5 h-3.5 text-red-400" />
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Tippe hier für Login im mobilen Browser (ohne Google-Blockade).
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <img
              src={userProfile.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
              alt={userProfile.name}
              className="w-8 h-8 rounded-full object-cover border border-emerald-500"
            />
            <div>
              <div className="text-xs font-semibold text-white flex items-center space-x-1">
                <span>{userProfile.name}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-[10px] text-zinc-400">
                YouTube Music synchronisiert
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAuth}
            className="text-[11px] text-zinc-400 hover:text-white px-2.5 py-1 rounded-full bg-white/5"
          >
            Verwalten
          </button>
        </div>
      )}

      {/* Library Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none border-b border-white/5">
        {[
          { id: 'liked', label: `Lieblingslieder (${displayLiked.length})`, icon: Heart },
          { id: 'playlists', label: `Playlists (${ytPlaylists.length + playlists.length})`, icon: ListMusic },
          { id: 'downloads', label: `Offline (${cacheInfo.count})`, icon: Download },
          { id: 'history', label: `Verlauf (${displayHistory.length})`, icon: HistoryIcon },
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
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                isActive
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Create Playlist Modal */}
      {showCreatePlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 shadow-2xl">
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
              <div>
                <h3 className="text-base font-bold text-white">{selectedLocalPlaylist.name}</h3>
                <p className="text-xs text-zinc-400">
                  {selectedLocalPlaylist.tracks.length} Titel • Eigene Playlist
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
                  deletePlaylist(selectedLocalPlaylist.id);
                  setSelectedLocalPlaylist(null);
                }}
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
                <TrackItem
                  key={`${track.id}-${i}`}
                  track={track}
                  index={i + 1}
                  playlistContext={selectedLocalPlaylist.tracks}
                />
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
                <div className="text-center py-12 text-zinc-500 text-xs">
                  Noch keine Lieblingslieder vorhanden. Klicke auf das Herz bei einem Song!
                </div>
              ) : (
                displayLiked.map((track, i) => (
                  <TrackItem
                    key={`${track.id}-${i}`}
                    track={track}
                    index={i + 1}
                    playlistContext={displayLiked}
                  />
                ))
              )}
            </div>
          )}

          {/* Playlists tab */}
          {activeTab === 'playlists' && (
            <div className="space-y-4">
              {/* Top Create Playlist Action */}
              <button
                onClick={() => setShowCreatePlaylistModal(true)}
                className="w-full p-3 rounded-xl bg-white/5 border border-dashed border-white/20 hover:border-red-500/50 flex items-center justify-center space-x-2 text-xs font-bold text-zinc-200 hover:text-white active:scale-[0.99] transition"
              >
                <Plus className="w-4 h-4 text-red-500" />
                <span>+ Neue eigene Playlist erstellen</span>
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
                        className="p-3 bg-[#181818] rounded-xl border border-white/5 hover:border-red-500/30 cursor-pointer active:scale-95 transition"
                      >
                        <div className="w-full aspect-square rounded-lg bg-zinc-800 flex items-center justify-center mb-2 overflow-hidden shadow-inner">
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
                        className="p-3 bg-[#181818] rounded-xl border border-white/5 hover:border-white/20 cursor-pointer active:scale-95 transition"
                      >
                        <img
                          src={pl.thumbnail}
                          alt={pl.title}
                          className="w-full aspect-square rounded-lg object-cover mb-2"
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
                <div className="text-center py-12 text-zinc-500 text-xs">
                  Noch keine Titel heruntergeladen. Tippe bei einem Song auf "Für Offline laden"!
                </div>
              ) : (
                <div className="space-y-1">
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

          {/* History tab */}
          {activeTab === 'history' && (
            <div className="space-y-1">
              {displayHistory.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  Noch kein Verlauf vorhanden.
                </div>
              ) : (
                displayHistory.map((track, i) => (
                  <TrackItem
                    key={`${track.id}-${i}`}
                    track={track}
                    index={i + 1}
                    playlistContext={displayHistory}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
