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
  Loader2
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { TrackItem } from './TrackItem';
import { api, UserProfile } from '../services/api';
import { Track } from '../types';

interface LibraryViewProps {
  userProfile: UserProfile;
  onOpenAuth: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ userProfile, onOpenAuth }) => {
  const { likedTracks, history, playTrack } = usePlayer();
  const [activeTab, setActiveTab] = useState<'liked' | 'playlists' | 'downloads' | 'history'>('liked');

  // YouTube Account synced data
  const [ytLikedSongs, setYtLikedSongs] = useState<Track[]>([]);
  const [ytPlaylists, setYtPlaylists] = useState<any[]>([]);
  const [cacheInfo, setCacheInfo] = useState<{ totalSizeMB: string; count: number; tracks: any[] }>({
    totalSizeMB: '0 MB',
    count: 0,
    tracks: []
  });
  const [loading, setLoading] = useState(false);

  // Load account data if logged in
  const loadAccountData = async () => {
    if (userProfile.isLoggedIn) {
      setLoading(true);
      try {
        const [liked, playlists] = await Promise.all([
          api.getUserLikedSongs().catch(() => []),
          api.getUserPlaylists().catch(() => [])
        ]);
        setYtLikedSongs(liked);
        setYtPlaylists(playlists);
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

  return (
    <div className="pb-36 px-4 space-y-4 pt-2">
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
                <span>Mit YouTube-Account anmelden</span>
                <Sparkles className="w-3.5 h-3.5 text-red-400" />
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Tippe hier, um deine eigenen Playlists & Lieblingslieder zu synchronisieren.
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
          { id: 'playlists', label: `Playlists (${ytPlaylists.length})`, icon: ListMusic },
          { id: 'downloads', label: `Offline (${cacheInfo.count})`, icon: Download },
          { id: 'history', label: `Verlauf (${history.length})`, icon: HistoryIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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

          {/* YouTube Playlists tab */}
          {activeTab === 'playlists' && (
            <div className="space-y-2">
              {!userProfile.isLoggedIn ? (
                <div className="text-center py-12 text-zinc-400 text-xs space-y-2">
                  <p>Melde dich an, um deine YouTube Music Playlists zu sehen.</p>
                  <button
                    onClick={onOpenAuth}
                    className="px-4 py-2 rounded-full bg-red-600 text-white font-semibold text-xs"
                  >
                    Jetzt anmelden
                  </button>
                </div>
              ) : ytPlaylists.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  Keine Playlists gefunden.
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
                    className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded-lg bg-red-500/10"
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
                      className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-red-500">
                          <Download className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white">
                            Video ID: {ct.id}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {ct.sizeFormatted} • Offline bereit
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          await api.deleteFromCache(ct.id);
                          loadCacheInfo();
                        }}
                        className="p-2 text-zinc-500 hover:text-red-400"
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
              {history.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  Noch kein Verlauf vorhanden.
                </div>
              ) : (
                history.map((track, i) => (
                  <TrackItem
                    key={`${track.id}-${i}`}
                    track={track}
                    index={i + 1}
                    playlistContext={history}
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
