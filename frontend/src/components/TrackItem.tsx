import React, { useState } from 'react';
import { Play, MoreVertical, Heart, Download, Check, ListPlus, Radio, Loader2, FolderPlus, X } from 'lucide-react';
import { Track } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../services/api';

interface TrackItemProps {
  track: Track;
  index?: number;
  playlistContext?: Track[];
}

export const TrackItem: React.FC<TrackItemProps> = ({ track, index, playlistContext }) => {
  const { currentTrack, isPlaying, playTrack, addToQueue, toggleLike, isLiked, playlists, addToPlaylist } = usePlayer();
  const [showMenu, setShowMenu] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(track.isCached || api.isDownloaded(track.id));

  const isCurrent = currentTrack?.id === track.id;
  const liked = isLiked(track.id);

  const handlePlay = () => {
    playTrack(track, playlistContext);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    setShowMenu(false);
    try {
      await api.downloadTrack(track.id, {
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        duration: track.duration
      });
      setDownloaded(true);
    } catch (err) {
      console.error('Download error:', err);
      alert(`Download fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      onClick={handlePlay}
      className={`group flex items-center justify-between p-2 rounded-xl transition cursor-pointer select-none ${
        isCurrent ? 'bg-white/10' : 'hover:bg-white/5 active:bg-white/10'
      }`}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1 mr-2">
        {/* Track Thumbnail or Number */}
        <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-md">
          <img
            src={track.thumbnail}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div
            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {isCurrent && isPlaying ? (
              <div className="flex items-end space-x-0.5 h-4">
                <span className="w-1 bg-red-500 animate-pulse h-full"></span>
                <span className="w-1 bg-red-500 animate-pulse delay-75 h-2/3"></span>
                <span className="w-1 bg-red-500 animate-pulse delay-150 h-5/6"></span>
              </div>
            ) : (
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            )}
          </div>
        </div>

        {/* Track Info */}
        <div className="min-w-0 flex-1">
          <div
            className={`text-sm font-semibold truncate ${
              isCurrent ? 'text-red-400 font-bold' : 'text-white'
            }`}
          >
            {track.title}
          </div>
          <div className="flex items-center text-xs text-zinc-400 space-x-1.5 truncate">
            <span className="truncate">{track.artist}</span>
            {track.duration && (
              <>
                <span>•</span>
                <span>{track.duration}</span>
              </>
            )}
            {downloaded && (
              <span className="inline-flex items-center text-[10px] text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded">
                <Check className="w-3 h-3 mr-0.5" /> Offline
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trailing actions */}
      <div className="flex items-center space-x-1 relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => toggleLike(track)}
          className="p-2 text-zinc-400 hover:text-red-500 active:scale-90 transition"
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
        </button>

        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 text-zinc-400 hover:text-white active:scale-90 transition"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-10 z-50 w-52 bg-[#1f1f1f] border border-white/10 rounded-xl shadow-2xl py-1 backdrop-blur-xl">
              <button
                onClick={() => {
                  addToQueue(track);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
              >
                <ListPlus className="w-4 h-4 text-zinc-400" />
                <span>Zur Warteschlange</span>
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowPlaylistPicker(true);
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
              >
                <FolderPlus className="w-4 h-4 text-zinc-400" />
                <span>In Playlist speichern</span>
              </button>

              <button
                onClick={handleDownload}
                disabled={isDownloading || downloaded}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-zinc-400" />
                )}
                <span>{downloaded ? 'Offline gespeichert' : 'Für Offline laden'}</span>
              </button>

              <button
                onClick={() => {
                  api.getRadio(track.id).then((r) => {
                    if (r.length > 0) playTrack(r[0], r);
                  });
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 flex items-center space-x-2.5"
              >
                <Radio className="w-4 h-4 text-zinc-400" />
                <span>Song-Radio starten</span>
              </button>
            </div>
          </>
        )}

        {/* Playlist Picker Dialog */}
        {showPlaylistPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-xs bg-[#1c1c1c] border border-white/10 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <FolderPlus className="w-4 h-4 text-red-500" />
                  <span>Playlist wählen</span>
                </span>
                <button
                  onClick={() => setShowPlaylistPicker(false)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 max-h-52 overflow-y-auto space-y-1">
                {playlists.length === 0 ? (
                  <div className="text-xs text-zinc-400 text-center py-4">
                    Noch keine Playlists erstellt. Erstelle zuerst eine unter "Mediathek"!
                  </div>
                ) : (
                  playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => {
                        addToPlaylist(pl.id, track);
                        setShowPlaylistPicker(false);
                      }}
                      className="w-full p-2 text-left text-xs text-white hover:bg-white/10 rounded-lg flex items-center justify-between transition"
                    >
                      <span className="font-semibold truncate">{pl.name}</span>
                      <span className="text-[10px] text-zinc-400">{pl.tracks.length} Titel</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
