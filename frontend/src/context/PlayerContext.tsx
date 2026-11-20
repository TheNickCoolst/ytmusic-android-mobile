import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Track, Playlist, RepeatMode } from '../types';
import { api } from '../services/api';

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  queue: Track[];
  queueIndex: number;
  autoPlayRadio: boolean;
  isPlayerExpanded: boolean;
  likedTracks: Track[];
  playlists: Playlist[];
  history: Track[];
  sleepTimerRemaining: number | null; // in seconds

  // Controls
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setAutoPlayRadio: (enabled: boolean) => void;
  setIsPlayerExpanded: (expanded: boolean) => void;

  // Library actions
  toggleLike: (track: Track) => void;
  isLiked: (trackId: string) => boolean;
  createPlaylist: (name: string, description?: string) => void;
  addToPlaylist: (playlistId: string, track: Track) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  deletePlaylist: (playlistId: string) => void;

  // Sleep timer
  setSleepTimer: (minutes: number | null) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

const STORAGE_KEYS = {
  LIKED: 'ytmusic_liked_tracks',
  PLAYLISTS: 'ytmusic_playlists',
  HISTORY: 'ytmusic_history',
};

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [autoPlayRadio, setAutoPlayRadio] = useState<boolean>(true);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState<boolean>(false);

  // Library state
  const [likedTracks, setLikedTracks] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIKED);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [history, setHistory] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sleep timer
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio Element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    // Enable background playback on iOS & mobile browsers
    audio.setAttribute('playsinline', 'true');
    (audio as any).playsInline = true;
    audio.crossOrigin = 'anonymous';

    audio.addEventListener('play', () => setIsPlaying(true));
    audio.addEventListener('pause', () => setIsPlaying(false));
    audio.addEventListener('waiting', () => setIsBuffering(true));
    audio.addEventListener('playing', () => setIsBuffering(false));
    audio.addEventListener('canplay', () => setIsBuffering(false));

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
      updateMediaSessionPosition(audio.currentTime, audio.duration);
    });

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration || 0);
      updateMediaSessionPosition(0, audio.duration || 0);
    });

    audio.addEventListener('ended', () => {
      handleTrackEnd();
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      setIsBuffering(false);
      setIsPlaying(false);
    });

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LIKED, JSON.stringify(likedTracks));
  }, [likedTracks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }, [history]);

  // Sleep timer interval
  useEffect(() => {
    if (sleepTimerRemaining === null) {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
      return;
    }

    if (sleepTimerRemaining <= 0) {
      pause();
      setSleepTimerRemaining(null);
      return;
    }

    sleepTimerRef.current = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null || prev <= 1) {
          pause();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    };
  }, [sleepTimerRemaining]);

  // Web Media Session API setup (Background playback & Lockscreen controls)
  const setupMediaSession = (track: Track) => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'YouTube Music',
        artwork: [
          { src: track.thumbnail, sizes: '96x96', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '128x128', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '192x192', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => resume());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => previousTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          seek(details.seekTime);
        }
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        seek(Math.max((audioRef.current?.currentTime || 0) - offset, 0));
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        seek(Math.min((audioRef.current?.currentTime || 0) + offset, duration));
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        pause();
      });
    } catch (err) {
      console.warn('MediaSession setup warning:', err);
    }
  };

  const updateMediaSessionPosition = (pos: number, dur: number) => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: audioRef.current?.playbackRate || 1.0,
          position: Math.min(pos, dur),
        });
      } catch (e) {
        // Ignored if position state is temporarily out of sync
      }
    }
  };

  // Play track implementation
  const playTrack = async (track: Track, newQueue?: Track[]) => {
    if (!audioRef.current) return;

    setCurrentTrack(track);
    setIsBuffering(true);
    setCurrentTime(0);

    // Update queue
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex((t) => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    } else if (queue.length === 0 || !queue.some((t) => t.id === track.id)) {
      setQueue([track]);
      setQueueIndex(0);
    } else {
      const idx = queue.findIndex((t) => t.id === track.id);
      if (idx !== -1) setQueueIndex(idx);
    }

    // Add to history
    setHistory((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      return [track, ...filtered].slice(0, 50);
    });

    setupMediaSession(track);

    const streamUrl = api.getStreamUrl(track.id);
    audioRef.current.src = streamUrl;

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Play call rejected (e.g. autoplay restriction):', err);
    }

    // Prefetch radio/related tracks for continuous playback if queue is short
    if (autoPlayRadio && (!newQueue || newQueue.length <= 1)) {
      try {
        const radioTracks = await api.getRadio(track.id);
        if (radioTracks.length > 0) {
          setQueue((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newTracks = radioTracks.filter((t) => !existingIds.has(t.id));
            return [...prev, ...newTracks];
          });
        }
      } catch (e) {
        console.warn('Could not auto-fetch radio tracks:', e);
      }
    }
  };

  const handleTrackEnd = async () => {
    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      return;
    }

    if (queueIndex < queue.length - 1) {
      const nextIndex = shuffle ? Math.floor(Math.random() * queue.length) : queueIndex + 1;
      setQueueIndex(nextIndex);
      playTrack(queue[nextIndex], queue);
    } else if (repeatMode === 'all' && queue.length > 0) {
      setQueueIndex(0);
      playTrack(queue[0], queue);
    } else if (autoPlayRadio && currentTrack) {
      // Auto-fetch song radio when queue ends so music never stops!
      try {
        const radioTracks = await api.getRadio(currentTrack.id);
        if (radioTracks.length > 0) {
          setQueue((prev) => [...prev, ...radioTracks]);
          setQueueIndex((prev) => prev + 1);
          playTrack(radioTracks[0]);
        } else {
          setIsPlaying(false);
        }
      } catch {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resume = () => {
    if (audioRef.current && currentTrack) {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const nextTrack = () => {
    if (queue.length === 0) return;
    let nextIdx = queueIndex + 1;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else if (nextIdx >= queue.length) {
      if (repeatMode === 'all') {
        nextIdx = 0;
      } else {
        return;
      }
    }
    setQueueIndex(nextIdx);
    playTrack(queue[nextIdx], queue);
  };

  const previousTrack = () => {
    if (!audioRef.current || queue.length === 0) return;
    // If playing more than 3 seconds, restart current song
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = repeatMode === 'all' ? queue.length - 1 : 0;
    }
    setQueueIndex(prevIdx);
    playTrack(queue[prevIdx], queue);
  };

  const seek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
      updateMediaSessionPosition(seconds, duration);
    }
  };

  const setVolume = (val: number) => {
    if (audioRef.current) {
      audioRef.current.volume = val;
      setVolumeState(val);
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.muted = false;
        setIsMuted(false);
      } else {
        audioRef.current.muted = true;
        setIsMuted(true);
      }
    }
  };

  const toggleShuffle = () => setShuffle((prev) => !prev);

  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const addToQueue = (track: Track) => {
    setQueue((prev) => [...prev, track]);
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
    if (index < queueIndex) {
      setQueueIndex((prev) => prev - 1);
    }
  };

  const clearQueue = () => {
    if (currentTrack) {
      setQueue([currentTrack]);
      setQueueIndex(0);
    } else {
      setQueue([]);
      setQueueIndex(-1);
    }
  };

  // Library actions
  const toggleLike = (track: Track) => {
    setLikedTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      if (exists) {
        return prev.filter((t) => t.id !== track.id);
      } else {
        return [track, ...prev];
      }
    });
  };

  const isLiked = (trackId: string) => {
    return likedTracks.some((t) => t.id === trackId);
  };

  const createPlaylist = (name: string, description?: string) => {
    const newPlaylist: Playlist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name,
      description,
      tracks: [],
      createdAt: Date.now(),
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);
  };

  const addToPlaylist = (playlistId: string, track: Track) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === playlistId) {
          if (pl.tracks.some((t) => t.id === track.id)) return pl;
          return {
            ...pl,
            tracks: [track, ...pl.tracks],
            cover: pl.cover || track.thumbnail,
          };
        }
        return pl;
      })
    );
  };

  const removeFromPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === playlistId) {
          return {
            ...pl,
            tracks: pl.tracks.filter((t) => t.id !== trackId),
          };
        }
        return pl;
      })
    );
  };

  const deletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
  };

  const setSleepTimer = (minutes: number | null) => {
    if (minutes === null) {
      setSleepTimerRemaining(null);
    } else {
      setSleepTimerRemaining(minutes * 60);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isBuffering,
        currentTime,
        duration,
        volume,
        isMuted,
        shuffle,
        repeatMode,
        queue,
        queueIndex,
        autoPlayRadio,
        isPlayerExpanded,
        likedTracks,
        playlists,
        history,
        sleepTimerRemaining,
        playTrack,
        togglePlay,
        pause,
        resume,
        nextTrack,
        previousTrack,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        cycleRepeatMode,
        addToQueue,
        removeFromQueue,
        clearQueue,
        setAutoPlayRadio,
        setIsPlayerExpanded,
        toggleLike,
        isLiked,
        createPlaylist,
        addToPlaylist,
        removeFromPlaylist,
        deletePlaylist,
        setSleepTimer,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};
