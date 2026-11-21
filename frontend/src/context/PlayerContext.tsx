import React, { createContext, useContext, useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { Track, Playlist, RepeatMode, EqualizerPreset } from '../types';
import { api, isServerMarkedDown } from '../services/api';
import { isNativeApp, reportPlayback, forgetAudioUrl } from '../services/youtube';
import { prepareTrack, planMix, MixPlan, TrackAnalysis } from '../services/dj';
import { mediaControls } from '../services/mediaControls';

export interface DjStatus {
  phase: 'off' | 'idle' | 'analyzing' | 'ready' | 'mixing' | 'error';
  message?: string;
  bpmOut?: number | null;
  bpmIn?: number | null;
  beatSync?: boolean;
  mixStart?: number; // position in the current track where the mix begins
  nextTitle?: string;
}


const safeSet = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* storage unavailable */ }
};
const loadJson = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const SETTINGS_KEY = 'ytmusic_player_settings';
const SESSION_KEY = 'ytmusic_last_session';
type SavedSettings = { shuffle?: boolean; repeatMode?: RepeatMode; autoPlayRadio?: boolean; volume?: number };
type SavedSession = { track: Track; queue: Track[]; index: number; pos: number };

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
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
  dislikedTrackIds: string[];
  playlists: Playlist[];
  history: Track[];
  sleepTimerRemaining: number | null; // in seconds

  // Video / Audio mode toggle
  isVideoMode: boolean;
  setIsVideoMode: (video: boolean) => void;

  // 550 Sound Equalizer & Bass Boost
  audioQuality: 'high' | 'normal';
  setAudioQuality: (q: 'high' | 'normal') => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  bassGain: number;
  midGain: number;
  trebleGain: number;
  equalizerPreset: EqualizerPreset;
  setEqualizerPreset: (preset: EqualizerPreset) => void;
  setBassGain: (gain: number) => void;
  setMidGain: (gain: number) => void;
  setTrebleGain: (gain: number) => void;
  playbackError: string | null;
  clearPlaybackError: () => void;

  // DJ mode: beat-matched automatic transitions into the next track
  djMode: boolean;
  setDjMode: (on: boolean) => void;
  djStatus: DjStatus;

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
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setAutoPlayRadio: (enabled: boolean) => void;
  setIsPlayerExpanded: (expanded: boolean) => void;

  // Library actions
  toggleLike: (track: Track) => void;
  isLiked: (trackId: string) => boolean;
  toggleDislike: (trackId: string) => void;
  isDisliked: (trackId: string) => boolean;
  createPlaylist: (name: string, description?: string) => void;
  addToPlaylist: (playlistId: string, track: Track) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  deletePlaylist: (playlistId: string) => void;

  // Sleep timer
  setSleepTimer: (minutes: number | null) => void;
  sleepAtTrackEnd: boolean;
  setSleepAtTrackEnd: (on: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

// Playback position lives outside React state: timeupdate fires ~4x/s, and as context state it
// re-rendered the whole app (every TrackItem) each time. Only the players subscribe to it.
let playbackTime = 0;
const timeListeners = new Set<() => void>();
const setCurrentTime = (t: number) => {
  if (t === playbackTime) return;
  playbackTime = t;
  timeListeners.forEach((l) => l());
};
const subscribeTime = (l: () => void) => {
  timeListeners.add(l);
  return () => timeListeners.delete(l);
};
export const usePlaybackTime = () => useSyncExternalStore(subscribeTime, () => playbackTime);

const STORAGE_KEYS = {
  LIKED: 'ytmusic_liked_tracks',
  DISLIKED: 'ytmusic_disliked_ids',
  PLAYLISTS: 'ytmusic_playlists',
  HISTORY: 'ytmusic_history',
  EQ: 'ytmusic_eq_settings',
};

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const saved0 = useRef<SavedSettings>(loadJson<SavedSettings>(SETTINGS_KEY, {})).current;
  const [volume, setVolumeState] = useState<number>(typeof saved0.volume === 'number' ? saved0.volume : 1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [shuffle, setShuffle] = useState<boolean>(!!saved0.shuffle);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(saved0.repeatMode || 'off');
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [autoPlayRadio, setAutoPlayRadio] = useState<boolean>(saved0.autoPlayRadio ?? true);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState<boolean>(false);
  const [isVideoMode, setIsVideoMode] = useState<boolean>(false);
  const [audioQuality, setAudioQuality] = useState<'high' | 'normal'>('high');
  const [playbackRate, setPlaybackRateState] = useState<number>(1.0);

  const setPlaybackRate = (rate: number) => {
    setPlaybackRateState(rate);
    playbackRateRef.current = rate;
    if (audioRef.current && !djTransRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  // 550 Sound Equalizer State
  // Default flat: audio plays through the native <audio> output (no Web Audio graph),
  // which is the only path that reliably produces sound in Android WebView and in background.
  const [bassGain, setBassGainState] = useState<number>(0);
  const [midGain, setMidGainState] = useState<number>(0);
  const [trebleGain, setTrebleGainState] = useState<number>(0);
  const [equalizerPreset, setEqualizerPresetState] = useState<EqualizerPreset>('flat');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [djMode, setDjModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ytmusic_dj_mode') === '1';
    } catch {
      return false;
    }
  });
  const [djStatus, setDjStatus] = useState<DjStatus>({ phase: 'off' });
  const [djEpoch, setDjEpoch] = useState(0);
  const djRetryRef = useRef<{ key: string; n: number }>({ key: '', n: 0 });

  // Library state
  const [likedTracks, setLikedTracks] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIKED);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [dislikedTrackIds, setDislikedTrackIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DISLIKED);
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
  const [sleepAtTrackEnd, setSleepAtTrackEndState] = useState(false);
  const sleepEndRef = useRef(false);
  const setSleepAtTrackEnd = (on: boolean) => {
    sleepEndRef.current = on;
    setSleepAtTrackEndState(on);
    if (on) setSleepTimerRemaining(null);
  };
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const retryRef = useRef<number>(0);
  const playTokenRef = useRef<number>(0);
  const currentTrackIdRef = useRef<string | null>(null);
  const directSrcRef = useRef<boolean>(false);
  const handleTrackEndRef = useRef<() => void>(() => {});
  const backStackRef = useRef<string[]>([]);
  const goingBackRef = useRef(false);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);

  // ---- DJ mode: second deck + transition state ----
  type DjPlanRef = {
    forId: string;
    nextIndex: number;
    track: Track;
    plan: MixPlan;
    inAnalysis: TrackAnalysis;
    blobUrl: string;
    timer?: ReturnType<typeof setTimeout>;
  };
  type DjTrans = {
    out: HTMLAudioElement;
    inn: HTMLAudioElement;
    P: DjPlanRef;
    mixStart: number;
    fadeLen: number;
    inRate: number;
    base: number;
    syncPhase: boolean;
    swapped: boolean;
    started: boolean;
    alive?: boolean;
    latKey: 'fg' | 'bg';
    replayed?: boolean;
    loadTimer?: ReturnType<typeof setTimeout>;
    lastCorr: number;
    startPos: number;
    measured: boolean;
    t0: number; // wall clock at start (fallback if outgoing stalls)
    tOut0: number;
    timer: ReturnType<typeof setInterval>;
  };
  const decksRef = useRef<HTMLAudioElement[]>([]);
  const deckBlobRef = useRef(new Map<HTMLAudioElement, string>());
  const publishMediaRef = useRef<() => void>(() => {});
  const djModeRef = useRef(djMode);
  const djPlanRef = useRef<DjPlanRef | null>(null);
  const djTransRef = useRef<DjTrans | null>(null);
  const djTokenRef = useRef(0);
  const djTickRef = useRef<() => void>(() => {});
  const glideRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(false);
  const playbackRateRef = useRef(1);
  // learned start latency of play() on this device (s), separately for app visible / in background
  const djLatencyRef = useRef<{ fg: number; bg: number }>(
    (() => {
      try {
        const v = JSON.parse(localStorage.getItem('ytmusic_dj_latency2') || 'null');
        if (v && typeof v.fg === 'number' && typeof v.bg === 'number') return v;
      } catch {
        /* ignore */
      }
      return { fg: 0.2, bg: 0.45 };
    })()
  );
  const latKey = (): 'fg' | 'bg' => (document.visibilityState === 'visible' ? 'fg' : 'bg');
  djModeRef.current = djMode;

  // Audio decks. A new deck is created for every DJ transition: Android WebView refuses to start
  // a paused, preloaded element while the app is in the background, but a fresh element plays fine.
  const eqSourcesRef = useRef(new Map<HTMLAudioElement, MediaElementAudioSourceNode>());
  const connectDeckToEq = (d: HTMLAudioElement) => {
    const ctx = audioContextRef.current;
    if (!ctx || !bassFilterRef.current || eqSourcesRef.current.has(d)) return;
    try {
      const src = ctx.createMediaElementSource(d);
      src.connect(bassFilterRef.current);
      eqSourcesRef.current.set(d, src);
    } catch (e) {
      console.warn('EQ connect failed', e);
    }
  };

  const makeDeck = () => {
    const audio = new Audio();
    audio.preload = 'auto';
    // iOS ManagedMediaSource (stream while downloading) only opens with AirPlay-remote off
    (audio as any).disableRemotePlayback = true;
    audio.setAttribute('playsinline', 'true');
    (audio as any).playsInline = true;
    // tempo matching must not change the pitch
    (audio as any).preservesPitch = true;
    // only the active deck drives the UI / player state
    const active = () => audio === audioRef.current;

    audio.addEventListener('play', () => active() && setIsPlaying(true));
    audio.addEventListener('pause', () => active() && setIsPlaying(false));
    audio.addEventListener('waiting', () => active() && setIsBuffering(true));
    audio.addEventListener('playing', () => {
      if (!active()) return;
      setIsBuffering(false);
      setPlaybackError(null);
      retryRef.current = 0;
    });
    audio.addEventListener('canplay', () => active() && setIsBuffering(false));
    audio.addEventListener('seeked', () => active() && publishMediaRef.current());

    audio.addEventListener('timeupdate', () => {
      if (!active()) return;
      setCurrentTime(audio.currentTime);
      updateMediaSessionPosition(audio.currentTime, audio.duration);
      djTickRef.current();
    });

    audio.addEventListener('loadedmetadata', () => {
      if (!active()) return;
      setDuration(audio.duration || 0);
      updateMediaSessionPosition(0, audio.duration || 0);
    });

    audio.addEventListener('ended', () => {
      if (!active()) return;
      handleTrackEndRef.current();
    });

    audio.addEventListener('error', () => {
      if (!active()) {
        // incoming DJ deck failed before taking over -> keep the current song, normal transition later
        const T = djTransRef.current;
        if (T && T.inn === audio && !T.swapped) djAbortRef.current('Nächster Titel konnte nicht geladen werden');
        return;
      }
      const code = audio.error?.code;
      console.error('Audio playback error, code:', code, audio.src);
      const src = audio.src;
      const trackId = currentTrackIdRef.current;
      // Retry once: direct YouTube URL failed -> try server; server failed -> try direct/server again
      if (src && trackId && retryRef.current < 1) {
        retryRef.current += 1;
        const token = playTokenRef.current;
        api
          .resolvePlaybackUrl(trackId, directSrcRef.current)
          .then(({ url, direct }) => {
            if (token !== playTokenRef.current) return;
            directSrcRef.current = direct;
            audio.src = direct ? url : `${url}?retry=${Date.now()}`;
            audio.play().catch(() => {});
          })
          .catch(() => {});
        return;
      }
      setIsBuffering(false);
      setIsPlaying(false);
      setPlaybackError('Song konnte nicht geladen werden. Bitte Internetverbindung prüfen und nochmal antippen.');
    });

    decksRef.current.push(audio);
    connectDeckToEq(audio);
    return audio;
  };

  useEffect(() => {
    const a = makeDeck();
    audioRef.current = a;
    return () => {
      for (const d of decksRef.current) {
        d.pause();
        d.src = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Web Audio API Equalizer on first user playback
  const initEqualizer = () => {
    if (audioContextRef.current || !audioRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Low Shelf Filter (Bass: 60Hz - 250Hz)
      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 150;
      bass.gain.value = bassGain;

      // Peaking Filter (Mids: 1kHz)
      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1000;
      mid.Q.value = 1.0;
      mid.gain.value = midGain;

      // High Shelf Filter (Treble: 3.5kHz - 16kHz)
      const treble = ctx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 4000;
      treble.gain.value = trebleGain;

      bass.connect(mid);
      mid.connect(treble);
      treble.connect(ctx.destination);

      audioContextRef.current = ctx;
      bassFilterRef.current = bass;
      for (const d of decksRef.current) connectDeckToEq(d);
      midFilterRef.current = mid;
      trebleFilterRef.current = treble;
    } catch (e) {
      console.warn('Web Audio Equalizer init skipped (CORS/Browser):', e);
    }
  };

  const ensureEqualizer = (val: number) => {
    if (val !== 0) initEqualizer();
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  };

  const setBassGain = (val: number) => {
    ensureEqualizer(val);
    setBassGainState(val);
    if (bassFilterRef.current) {
      bassFilterRef.current.gain.value = val;
    }
  };

  const setMidGain = (val: number) => {
    ensureEqualizer(val);
    setMidGainState(val);
    if (midFilterRef.current) {
      midFilterRef.current.gain.value = val;
    }
  };

  const setTrebleGain = (val: number) => {
    ensureEqualizer(val);
    setTrebleGainState(val);
    if (trebleFilterRef.current) {
      trebleFilterRef.current.gain.value = val;
    }
  };

  const setEqualizerPreset = (preset: EqualizerPreset) => {
    setEqualizerPresetState(preset);
    switch (preset) {
      case 'bass_boost':
        setBassGain(8);
        setMidGain(1);
        setTrebleGain(3);
        break;
      case 'vocal':
        setBassGain(0);
        setMidGain(5);
        setTrebleGain(2);
        break;
      case 'dance':
        setBassGain(6);
        setMidGain(0);
        setTrebleGain(5);
        break;
      case 'rock':
        setBassGain(5);
        setMidGain(2);
        setTrebleGain(4);
        break;
      case 'clarity':
        setBassGain(-1);
        setMidGain(2);
        setTrebleGain(6);
        break;
      case 'flat':
      default:
        setBassGain(0);
        setMidGain(0);
        setTrebleGain(0);
        break;
    }
  };

  // LocalStorage sync
  useEffect(() => {
    safeSet(STORAGE_KEYS.LIKED, JSON.stringify(likedTracks));
  }, [likedTracks]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.DISLIKED, JSON.stringify(dislikedTrackIds));
  }, [dislikedTrackIds]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    safeSet(SETTINGS_KEY, JSON.stringify({ shuffle, repeatMode, autoPlayRadio, volume }));
  }, [shuffle, repeatMode, autoPlayRadio, volume]);

  // ---- last session: the song (queue + position) is back after an app restart, paused ----
  const resumePosRef = useRef<{ id: string; pos: number } | null>(null);
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const s = loadJson<SavedSession | null>(SESSION_KEY, null);
    if (!s?.track?.id || currentTrack) return;
    const q = Array.isArray(s.queue) && s.queue.length ? s.queue : [s.track];
    setCurrentTrack(s.track);
    setQueue(q);
    setQueueIndex(Math.max(0, q.findIndex((t) => t.id === s.track.id)));
    if (s.track.durationSeconds) setDuration(s.track.durationSeconds);
    setCurrentTime(s.pos || 0);
    resumePosRef.current = { id: s.track.id, pos: s.pos || 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sessionRef = useRef<() => void>(() => {});
  sessionRef.current = () => {
    if (!currentTrack) return;
    const a = audioRef.current;
    const pos = a && a.getAttribute('src') ? a.currentTime : resumePosRef.current?.pos || 0;
    const start = Math.max(0, queueIndex - 50);
    safeSet(
      SESSION_KEY,
      JSON.stringify({ track: currentTrack, queue: queue.slice(start, start + 200), index: queueIndex - start, pos })
    );
  };
  useEffect(() => {
    sessionRef.current();
  }, [currentTrack?.id, queue, queueIndex, isPlaying]);
  useEffect(() => {
    const save = () => sessionRef.current();
    const iv = setInterval(save, 15000);
    const onVis = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', save);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', save);
    };
  }, []);

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
        const a = audioRef.current;
        if (prev === null || prev <= 1) {
          pause();
          if (a) a.volume = volumeRef.current; // undo the fade for the next play
          return null;
        }
        // gentle fade-out over the last 10 seconds
        if (a && prev <= 11 && !djTransRef.current) a.volume = volumeRef.current * Math.max(0, (prev - 1) / 10);
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
        // Ignored
      }
    }
  };

  // Play track
  const playTrack = async (track: Track, newQueue?: Track[]) => {
    if (!audioRef.current) return;

    if (audioContextRef.current && audioContextRef.current.state !== 'running') {
      audioContextRef.current.resume().catch(console.error);
    }

    abortDj();
    retryRef.current = 0;
    setPlaybackError(null);
    // remember where we came from (Zurück in shuffle mode goes to the song played before)
    const prevId = currentTrackIdRef.current;
    if (goingBackRef.current) goingBackRef.current = false;
    else if (prevId && prevId !== track.id) backStackRef.current = [...backStackRef.current.slice(-49), prevId];
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

    const token = ++playTokenRef.current;
    currentTrackIdRef.current = track.id;
    audioRef.current.pause();

    let streamUrl: string;
    try {
      const resolved = await api.resolvePlaybackUrl(track.id);
      streamUrl = resolved.url;
      directSrcRef.current = resolved.direct;
    } catch (e) {
      if (isNativeApp()) {
        // app: no Mac server fallback
        if (token !== playTokenRef.current) return;
        console.error('Stream URL failed:', e);
        setIsBuffering(false);
        setIsPlaying(false);
        setPlaybackError('Song konnte nicht geladen werden. Bitte Internetverbindung prüfen und nochmal antippen.');
        return;
      }
      streamUrl = api.getStreamUrl(track.id);
      directSrcRef.current = false;
    }
    // user tapped another song meanwhile
    if (token !== playTokenRef.current || !audioRef.current) return;

    audioRef.current.src = streamUrl;
    audioRef.current.playbackRate = playbackRateRef.current;
    const resumeAt = resumePosRef.current?.id === track.id ? resumePosRef.current.pos : 0;
    resumePosRef.current = null;
    if (resumeAt > 3) {
      const a = audioRef.current;
      a.addEventListener(
        'loadedmetadata',
        () => {
          if (token === playTokenRef.current && (!a.duration || resumeAt < a.duration - 5)) a.currentTime = resumeAt;
        },
        { once: true }
      );
    }

    audioRef.current.volume = volume;
    audioRef.current.muted = isMuted;

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err: any) {
      // AbortError = src changed again before playback started (fast skipping) -> ignore
      if (err?.name !== 'AbortError') console.error('Play call error:', err);
    }

    // Prefetch radio
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
    if (sleepEndRef.current) {
      // sleep timer "Ende des Titels"
      setSleepAtTrackEnd(false);
      setIsPlaying(false);
      return;
    }
    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      return;
    }

    const shuffleIdx = shuffle ? shuffleNextIndex(repeatMode === 'all') : -1;
    if (shuffleIdx >= 0) {
      setQueueIndex(shuffleIdx);
      playTrack(queue[shuffleIdx], queue);
    } else if (!shuffle && queueIndex < queue.length - 1) {
      setQueueIndex(queueIndex + 1);
      playTrack(queue[queueIndex + 1], queue);
    } else if (repeatMode === 'all' && queue.length > 0) {
      setQueueIndex(0);
      playTrack(queue[0], queue);
    } else if (autoPlayRadio && currentTrack) {
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

  handleTrackEndRef.current = handleTrackEnd;

  // ==================================================================
  // DJ MODE ENGINE
  // Deck B is preloaded with the next track (full file in memory). At the planned mix point
  // (end of the last full-energy phrase, snapped to a bar) deck B starts silently, is tempo-matched
  // via playbackRate (pitch preserved), kept in phase by tiny rate nudges and crossfaded in with an
  // equal-power curve. Afterwards the tempo glides back to the user's speed.
  // ==================================================================
  const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  // Chrome pauses volume-0 media while the app is in the background -> "silent" = -60 dB, never 0
  const SILENT = 0.001;

  const stopGlide = () => {
    if (glideRef.current) clearInterval(glideRef.current);
    glideRef.current = null;
  };

  const releaseDeck = (d: HTMLAudioElement) => {
    d.pause();
    d.removeAttribute('src');
    try {
      d.load();
    } catch {
      /* ignore */
    }
    const blob = deckBlobRef.current.get(d);
    if (blob) {
      URL.revokeObjectURL(blob);
      deckBlobRef.current.delete(d);
    }
    const src = eqSourcesRef.current.get(d);
    if (src) {
      try {
        src.disconnect();
      } catch {
        /* ignore */
      }
      eqSourcesRef.current.delete(d);
    }
    decksRef.current = decksRef.current.filter((x) => x !== d);
  };

  const clearDjPlan = () => {
    const P = djPlanRef.current;
    if (P) {
      if (P.timer) clearTimeout(P.timer);
      // blob not handed to a deck yet -> free it
      if (!djTransRef.current || djTransRef.current.P !== P) URL.revokeObjectURL(P.blobUrl);
    }
    djPlanRef.current = null;
    djTokenRef.current++;
  };

  const swapDecks = (T: DjTrans) => {
    T.swapped = true;
    const { P } = T;
    audioRef.current = T.inn;
    playTokenRef.current++; // cancel pending loads of an older playTrack
    currentTrackIdRef.current = P.track.id;
    directSrcRef.current = false;
    retryRef.current = 0;
    djPlanRef.current = null;
    setCurrentTrack(P.track);
    setQueueIndex(P.nextIndex);
    setDuration(T.inn.duration || P.inAnalysis.duration);
    setCurrentTime(T.inn.currentTime);
    setIsPlaying(true);
    setIsBuffering(false);
    setPlaybackError(null);
    setHistory((prev) => [P.track, ...prev.filter((t) => t.id !== P.track.id)].slice(0, 50));
  };

  const finishTransition = () => {
    const T = djTransRef.current;
    if (!T) return;
    if (!T.started) {
      // incoming never started (still loading) -> keep the current song
      return abortDj();
    }
    clearInterval(T.timer);
    if (!T.swapped) swapDecks(T);
    djTransRef.current = null;
    releaseDeck(T.out);
    T.inn.volume = volumeRef.current;
    // glide tempo back to the user's speed (inaudible, pitch preserved)
    stopGlide();
    const from = T.inn.playbackRate;
    if (Math.abs(from - playbackRateRef.current) > 0.002) {
      const t0 = Date.now();
      glideRef.current = setInterval(() => {
        if (audioRef.current !== T.inn) return stopGlide();
        const k = Math.min(1, (Date.now() - t0) / 8000);
        T.inn.playbackRate = from + (playbackRateRef.current - from) * k;
        if (k >= 1) stopGlide();
      }, 200);
    }
    setDjStatus({ phase: 'idle' });
    setDjEpoch((e) => e + 1);
  };

  /** Stop any DJ activity and keep only the active deck playing normally. */
  const abortDj = (message?: string) => {
    stopGlide();
    const T = djTransRef.current;
    if (T) {
      clearInterval(T.timer);
      if (T.loadTimer) clearTimeout(T.loadTimer);
      djTransRef.current = null;
      releaseDeck(T.swapped ? T.out : T.inn);
      const act = audioRef.current;
      if (act) {
        act.volume = volumeRef.current;
        act.playbackRate = playbackRateRef.current;
      }
      if (djPlanRef.current === T.P) djPlanRef.current = null;
    }
    clearDjPlan();
    if (message) setDjStatus({ phase: 'error', message });
  };
  const djAbortRef = useRef<(msg?: string) => void>(() => {});
  djAbortRef.current = abortDj;

  const djStep = () => {
    const T = djTransRef.current;
    if (!T || !T.started) return;
    const { out, inn } = T;
    const vol = volumeRef.current;
    // wall-clock fallback in case the outgoing deck stalls
    const tWall = T.tOut0 + ((performance.now() - T.t0) / 1000) * T.base;
    let t = Math.max(out.currentTime, tWall - 1.5);
    if (out.ended) t = T.mixStart + T.fadeLen;

    // only hand over once the incoming deck is really playing
    if (!T.swapped && !T.alive) {
      T.alive = !inn.paused && inn.currentTime > T.startPos + 0.03;
      if (!T.alive) {
        const waited = performance.now() - T.t0;
        if (waited > 1200 && !T.replayed) {
          T.replayed = true;
          inn.play().catch(() => {});
        }
        if (waited > 3000 || out.ended) return djAbortRef.current('Übergang nicht möglich – normaler Wechsel');
        if (t >= T.mixStart) {
          // late: keep the outgoing at full volume and start the fade when the incoming runs
          out.volume = vol;
          T.mixStart = t + 0.04;
          T.syncPhase = false;
        }
        return;
      }
    }
    if (t >= T.mixStart && !T.swapped) swapDecks(T);

    const p = clampN((t - T.mixStart) / T.fadeLen, 0, 1);
    out.volume = Math.max(p < 1 ? SILENT : 0, vol * Math.cos((p * Math.PI) / 2));
    inn.volume = t < T.mixStart ? SILENT : Math.max(SILENT, vol * Math.sin((p * Math.PI) / 2));

    // phase lock: nudge the incoming tempo until its beats sit on the outgoing beats
    if (T.syncPhase && p < 1 && !inn.paused) {
      const plan = T.P.plan;
      const expected = plan.inStart + (t - plan.mixStart) * plan.rate;
      let e = inn.currentTime - expected;
      if (!T.measured) {
        // learn this device's start latency (measured before any correction) for the next transition
        if (inn.currentTime < T.startPos + 0.12) return;
        T.measured = true;
        const k = T.latKey;
        const L = clampN(djLatencyRef.current[k] - e / plan.rate, 0, 0.8);
        djLatencyRef.current[k] = 0.3 * djLatencyRef.current[k] + 0.7 * L;
        safeSet('ytmusic_dj_latency2', JSON.stringify(djLatencyRef.current));
      }
      const bt = T.P.inAnalysis.beat || 0.5;
      if (Math.abs(e) > bt / 2) e -= Math.round(e / bt) * bt;
      // while still silent (pre-roll / fade start) correct hard, later only gently
      const silent = t < T.mixStart + 0.5;
      const corr =
        Math.abs(e) < 0.012 ? 0 : silent ? clampN(-e * 1.5, -0.15, 0.15) : clampN(-e * 0.8, -0.04, 0.04);
      if (Math.abs(corr - T.lastCorr) > 0.004) {
        inn.playbackRate = T.inRate * (1 + corr);
        T.lastCorr = corr;
      }
    }
    if (p >= 1) finishTransition();
  };
  const djStepRef = useRef(djStep);
  djStepRef.current = djStep;

  // incoming deck has metadata -> position it and start (silently) in sync with the outgoing deck
  const beginIncoming = (T: DjTrans, quick: boolean) => {
    if (djTransRef.current !== T || T.started) return;
    if (T.loadTimer) {
      clearTimeout(T.loadTimer);
      T.loadTimer = undefined;
    }
    const { out, inn, P } = T;
    const plan = P.plan;
    const t = out.currentTime;
    const dur = out.duration || plan.mixStart + plan.fadeLen;
    let inPos: number;
    if (quick || t > plan.mixStart + 0.25) {
      // manual skip (or late): blend right now
      T.mixStart = t;
      T.fadeLen = quick ? 3 : Math.max(1.5, Math.min(plan.fadeLen, dur - t - 0.1));
      T.syncPhase = false;
      inPos = plan.inStart;
    } else {
      // silent pre-roll + learned latency compensation; phase lock fixes the rest
      T.latKey = latKey();
      const comp = plan.beatSync ? djLatencyRef.current[T.latKey] * plan.rate : 0;
      const raw = plan.inStart - (plan.mixStart - t) * plan.rate + comp;
      if (raw < -0.03) {
        // loaded early: start exactly when the incoming has to begin at its first sample
        setTimeout(() => beginIncoming(T, quick), (-raw / plan.rate / T.base) * 1000);
        return;
      }
      inPos = Math.max(0, raw);
    }
    inn.currentTime = inPos;
    inn.playbackRate = T.inRate;
    T.startPos = inPos;
    T.measured = !T.syncPhase;
    T.started = true;
    T.t0 = performance.now();
    T.tOut0 = t;
    inn.play().catch((e) => {
      if (e?.name !== 'AbortError') djAbortRef.current('Übergang konnte nicht gestartet werden');
    });
  };

  const startTransition = (P: DjPlanRef, quick: boolean): boolean => {
    const A = audioRef.current;
    if (!A || djTransRef.current) return false;
    if (P.timer) {
      clearTimeout(P.timer);
      P.timer = undefined;
    }
    stopGlide();
    const plan = P.plan;
    const base = playbackRateRef.current;
    const B = makeDeck();
    deckBlobRef.current.set(B, P.blobUrl);
    B.volume = SILENT;
    B.muted = mutedRef.current;
    const T: DjTrans = {
      out: A,
      inn: B,
      P,
      mixStart: plan.mixStart,
      fadeLen: plan.fadeLen,
      inRate: plan.beatSync ? plan.rate * base : base,
      base,
      syncPhase: plan.beatSync,
      swapped: false,
      started: false,
      latKey: 'fg',
      lastCorr: 0,
      startPos: 0,
      measured: false,
      t0: performance.now(),
      tOut0: A.currentTime,
      timer: setInterval(() => djStepRef.current(), 40),
    };
    djTransRef.current = T;
    B.addEventListener('loadedmetadata', () => beginIncoming(T, quick), { once: true });
    T.loadTimer = setTimeout(() => {
      if (!T.started) djAbortRef.current('Nächster Titel lädt nicht – normaler Übergang');
    }, 4000);
    B.src = P.blobUrl;
    B.load();
    setDjStatus((prev) => ({ ...prev, phase: 'mixing' }));
    return true;
  };

  // called on every timeupdate of the active deck
  djTickRef.current = () => {
    if (sleepEndRef.current) return; // stop after this song: no mix into the next one
    const P = djPlanRef.current;
    const A = audioRef.current;
    if (!djModeRef.current || !P || djTransRef.current || !A || A.paused) return;
    if (P.forId !== currentTrackIdRef.current) return;
    // pre-roll before the mix point + headroom to create/load the incoming deck
    const lead = Math.min(2.5, P.plan.inStart / P.plan.rate) + 0.6;
    const startAt = P.plan.mixStart - lead;
    const t = A.currentTime;
    if (t >= startAt - 0.03) {
      startTransition(P, false);
    } else if (startAt - t < 1.5 && !P.timer) {
      // timeupdate is coarse (~250 ms) -> schedule the exact start
      P.timer = setTimeout(() => {
        P.timer = undefined;
        djTickRef.current();
      }, ((startAt - t) / (A.playbackRate || 1)) * 1000);
    }
  };

  const setDjMode = (on: boolean) => {
    setDjModeState(on);
    djModeRef.current = on;
    safeSet('ytmusic_dj_mode', on ? '1' : '0');
    if (!on) abortDj();
  };

  // Shuffle: one random pick per current track, shared by skip, song end, DJ and prefetch.
  // Never the current song, and no repeats until every song in the queue has played.
  const shufflePlayedRef = useRef<Set<string>>(new Set());
  const shuffleNextRef = useRef<{ forId: string; idx: number } | null>(null);
  const shuffleNextIndex = (cycle: boolean): number => {
    if (!currentTrack || queue.length < 2) return -1;
    const c = shuffleNextRef.current;
    if (c && c.forId === currentTrack.id && c.idx !== queueIndex && queue[c.idx]) return c.idx;
    const played = shufflePlayedRef.current;
    played.add(currentTrack.id);
    const others = queue
      .map((_, i) => i)
      .filter((i) => i !== queueIndex && queue[i].id !== currentTrack.id && !dislikedTrackIds.includes(queue[i].id));
    let pool = others.filter((i) => !played.has(queue[i].id));
    if (!pool.length && cycle) {
      played.clear();
      played.add(currentTrack.id);
      pool = others;
    }
    if (!pool.length) return -1;
    const idx = pool[Math.floor(Math.random() * pool.length)];
    shuffleNextRef.current = { forId: currentTrack.id, idx };
    return idx;
  };

  // Which track comes next for the DJ
  let djNextIndex = -1;
  if (djMode && currentTrack && queue.length > 1 && queueIndex >= 0 && repeatMode !== 'one') {
    if (shuffle) {
      djNextIndex = shuffleNextIndex(repeatMode === 'all');
    } else if (queueIndex + 1 < queue.length) {
      djNextIndex = queueIndex + 1;
    } else if (repeatMode === 'all') {
      djNextIndex = 0;
    }
  }
  const djNextId = djNextIndex >= 0 ? queue[djNextIndex]?.id : undefined;

  // Prepare (download + analyse + plan) the next transition
  useEffect(() => {
    if (!djMode) {
      setDjStatus({ phase: 'off' });
      return;
    }
    if (djTransRef.current) return;
    const cur = currentTrack;
    if (!cur || djNextIndex < 0 || !djNextId) {
      clearDjPlan();
      setDjStatus({ phase: 'idle', message: 'Kein nächster Titel in der Warteschlange' });
      return;
    }
    const P = djPlanRef.current;
    if (P && P.forId === cur.id && P.track.id === djNextId) return;
    clearDjPlan();
    const token = djTokenRef.current;
    const nextTrack = queue[djNextIndex];
    const nextIndex = djNextIndex;
    setDjStatus({ phase: 'analyzing', nextTitle: nextTrack.title });
    const delay = setTimeout(async () => {
      try {
        const [a, b] = await Promise.all([prepareTrack(cur.id, false), prepareTrack(nextTrack.id, true)]);
        if (token !== djTokenRef.current || currentTrackIdRef.current !== cur.id || djTransRef.current) {
          if (b.blobUrl) URL.revokeObjectURL(b.blobUrl);
          return;
        }
        const plan = planMix(a.analysis, b.analysis);
        if (!plan || !b.blobUrl) throw new Error('Kein Mix möglich');
        djPlanRef.current = {
          forId: cur.id,
          nextIndex,
          track: nextTrack,
          plan,
          inAnalysis: b.analysis,
          blobUrl: b.blobUrl,
        };
        setDjStatus({
          phase: 'ready',
          bpmOut: plan.bpmOut,
          bpmIn: plan.bpmIn,
          beatSync: plan.beatSync,
          mixStart: plan.mixStart,
          nextTitle: nextTrack.title,
        });
      } catch (e) {
        if (token !== djTokenRef.current) return;
        // network hiccups are common on mobile: try again a few times before giving up on the mix
        const key = `${cur.id}>${nextTrack.id}`;
        const n = djRetryRef.current.key === key ? djRetryRef.current.n + 1 : 1;
        djRetryRef.current = { key, n };
        if (n <= 3) {
          console.info(`DJ prepare failed (try ${n}/3), retrying`, e);
          forgetAudioUrl(cur.id);
          forgetAudioUrl(nextTrack.id);
          setDjStatus({ phase: 'analyzing', message: 'Verbindung schwach – neuer Versuch…', nextTitle: nextTrack.title });
          setTimeout(() => token === djTokenRef.current && setDjEpoch((x) => x + 1), 3000 * n);
          return;
        }
        console.warn('DJ prepare failed', e);
        setDjStatus({ phase: 'error', message: 'Analyse fehlgeschlagen – normaler Übergang', nextTitle: nextTrack.title });
      }
    }, 2500);
    return () => clearTimeout(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [djMode, currentTrack?.id, djNextId, djNextIndex, djEpoch]);

  // keep lock-screen metadata + handlers current (also after DJ deck swaps)
  useEffect(() => {
    if (currentTrack) setupMediaSession(currentTrack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, queue, queueIndex, shuffle, repeatMode, djMode]);

  // Last song in the queue: fetch the radio continuation now, not when the song ends.
  // iOS suspends the app's JavaScript seconds after audio stops in the background, so the
  // follow-up song must already be queued (and its URL warmed) before the current one ends.
  const radioExtendRef = useRef<string | null>(null);
  const atQueueEnd = queue.length > 0 && queueIndex >= queue.length - 1;
  useEffect(() => {
    const id = currentTrack?.id;
    if (!id || !atQueueEnd || !autoPlayRadio || repeatMode !== 'off' || radioExtendRef.current === id) return;
    const t = setTimeout(() => {
      radioExtendRef.current = id;
      api
        .getRadio(id)
        .then((radio) => {
          if (currentTrackIdRef.current !== id) return;
          setQueue((prev) => {
            const have = new Set(prev.map((x) => x.id));
            const add = radio.filter((x) => !have.has(x.id));
            return add.length ? [...prev, ...add] : prev;
          });
        })
        .catch(() => {
          radioExtendRef.current = null;
        });
    }, 4000);
    return () => clearTimeout(t);
  }, [currentTrack?.id, atQueueEnd, autoPlayRadio, repeatMode]);

  // Prefetch next track on the server so skipping / auto-advance starts instantly
  const nextPrefetchId = shuffle ? queue[shuffleNextIndex(repeatMode === 'all')]?.id : queue[queueIndex + 1]?.id;
  useEffect(() => {
    if (!nextPrefetchId || djMode) return;
    const t = setTimeout(() => {
      if (isNativeApp()) {
        // warm the direct YouTube URL cache
        api.prefetchPlayback(nextPrefetchId).catch(() => {});
      } else if (!isServerMarkedDown()) {
        fetch(api.getStreamUrl(nextPrefetchId), { method: 'HEAD' }).catch(() => {});
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [nextPrefetchId, djMode]);

  // Resume Web Audio (only exists if EQ was enabled) when the app comes back to foreground
  useEffect(() => {
    const onVis = () => {
      const ctx = audioContextRef.current;
      if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') {
        ctx.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const pause = () => {
    if (djTransRef.current) finishTransition();
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resume = () => {
    if (audioRef.current && currentTrack && !audioRef.current.getAttribute('src')) {
      // restored session: nothing loaded yet
      playTrack(currentTrack, queue.length ? queue : undefined);
      return;
    }
    if (audioRef.current && currentTrack) {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const nextTrack = () => {
    if (queue.length === 0) return;
    if (djModeRef.current) {
      // skip during a mix = jump to its end; otherwise a quick 3 s DJ blend into the prepared track
      if (djTransRef.current) return finishTransition();
      const P = djPlanRef.current;
      if (P && P.forId === currentTrackIdRef.current && startTransition(P, true)) return;
    }
    let nextIdx = queueIndex + 1;
    if (shuffle && queue.length > 1) {
      nextIdx = shuffleNextIndex(true);
      if (nextIdx < 0) return;
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
    if (djTransRef.current) finishTransition();
    if (!audioRef.current || queue.length === 0) return;
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (shuffle) {
      while (backStackRef.current.length) {
        const id = backStackRef.current[backStackRef.current.length - 1];
        backStackRef.current = backStackRef.current.slice(0, -1);
        const i = queue.findIndex((t) => t.id === id);
        if (i >= 0) {
          goingBackRef.current = true;
          setQueueIndex(i);
          playTrack(queue[i], queue);
          return;
        }
      }
    }
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = repeatMode === 'all' ? queue.length - 1 : 0;
    }
    setQueueIndex(prevIdx);
    playTrack(queue[prevIdx], queue);
  };

  // Logged in: report plays to YouTube Music (history -> personal recommendations), like the real app
  useEffect(() => {
    const id = currentTrack?.id;
    if (!id || !isNativeApp()) return;
    const t = setTimeout(() => {
      const a = audioRef.current;
      if (currentTrackIdRef.current === id && a && !a.paused) reportPlayback(id);
    }, 10000);
    return () => clearTimeout(t);
  }, [currentTrack?.id]);

  // ---- system "now playing" notification (status bar, Samsung quick panel, lock screen) ----
  const publishMediaState = (override?: { position?: number; playing?: boolean }) => {
    if (!currentTrack) return;
    const a = audioRef.current;
    mediaControls.update({
      title: currentTrack.title || 'Unbekannt',
      artist: currentTrack.artist || '',
      album: currentTrack.album || '',
      artwork: currentTrack.thumbnail,
      isPlaying: override?.playing ?? isPlaying,
      position: override?.position ?? a?.currentTime ?? 0,
      duration: (a && isFinite(a.duration) && a.duration) || duration || currentTrack.durationSeconds || 0,
      rate: a?.playbackRate || 1,
    });
  };
  publishMediaRef.current = () => publishMediaState();
  useEffect(() => {
    publishMediaState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, isPlaying, duration]);

  const seek = (seconds: number) => {
    if (djTransRef.current) finishTransition();
    const P = djPlanRef.current;
    if (P?.timer) {
      clearTimeout(P.timer);
      P.timer = undefined;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
      publishMediaState({ position: seconds });
      updateMediaSessionPosition(seconds, duration);
    }
  };

  const setVolume = (val: number) => {
    volumeRef.current = val;
    if (audioRef.current) {
      if (!djTransRef.current) audioRef.current.volume = val;
      setVolumeState(val);
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const m = !isMuted;
      mutedRef.current = m;
      for (const d of decksRef.current) d.muted = m;
      setIsMuted(m);
    }
  };

  const toggleShuffle = () => {
    shufflePlayedRef.current.clear();
    shuffleNextRef.current = null;
    setShuffle((prev) => !prev);
  };

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

  /** Insert right after the current song ("Als Nächstes abspielen"). */
  const playNext = (track: Track) => {
    if (!currentTrack) {
      playTrack(track);
      return;
    }
    if (track.id === currentTrack.id) return;
    const rest = queue.filter((t, i) => i <= queueIndex || t.id !== track.id);
    const at = Math.max(0, rest.findIndex((t) => t.id === currentTrack.id)) + 1;
    setQueue([...rest.slice(0, at), track, ...rest.slice(at)]);
    setQueueIndex(at - 1);
    // shuffle: the inserted song really comes next
    shuffleNextRef.current = { forId: currentTrack.id, idx: at };
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

  // Likes & Dislikes
  const toggleLike = (track: Track) => {
    const exists = likedTracks.some((t) => t.id === track.id);
    if (exists) {
      setLikedTracks((prev) => prev.filter((t) => t.id !== track.id));
      api.unlikeTrackOnYouTube(track.id);
    } else {
      setLikedTracks((prev) => [track, ...prev]);
      setDislikedTrackIds((prev) => prev.filter((id) => id !== track.id));
      api.likeTrackOnYouTube(track.id);
    }
  };

  const isLiked = (trackId: string) => {
    return likedTracks.some((t) => t.id === trackId);
  };

  const toggleDislike = (trackId: string) => {
    if (dislikedTrackIds.includes(trackId)) {
      setDislikedTrackIds((prev) => prev.filter((id) => id !== trackId));
    } else {
      setDislikedTrackIds((prev) => [...prev, trackId]);
      setLikedTracks((prev) => prev.filter((t) => t.id !== trackId));
      api.unlikeTrackOnYouTube(trackId);
    }
  };

  const isDisliked = (trackId: string) => {
    return dislikedTrackIds.includes(trackId);
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
    if (audioRef.current && !djTransRef.current) audioRef.current.volume = volumeRef.current;
    sleepEndRef.current = false;
    setSleepAtTrackEndState(false);
    if (minutes === null) {
      setSleepTimerRemaining(null);
    } else {
      setSleepTimerRemaining(minutes * 60);
    }
  };

  const mediaActionsRef = useRef({ resume, pause, nextTrack, previousTrack, seek });
  mediaActionsRef.current = { resume, pause, nextTrack, previousTrack, seek };
  useEffect(
    () =>
      mediaControls.onAction((action, position) => {
        const f = mediaActionsRef.current;
        if (action === 'play') f.resume();
        else if (action === 'pause') f.pause();
        else if (action === 'next') f.nextTrack();
        else if (action === 'previous') f.previousTrack();
        else if (action === 'seekto' && typeof position === 'number') f.seek(position);
      }),
    []
  );

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isBuffering,
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
        dislikedTrackIds,
        playlists,
        history,
        sleepTimerRemaining,
        isVideoMode,
        setIsVideoMode,
        audioQuality,
        setAudioQuality,
        playbackRate,
        setPlaybackRate,
        bassGain,
        midGain,
        trebleGain,
        equalizerPreset,
        setEqualizerPreset,
        setBassGain,
        setMidGain,
        setTrebleGain,
        playbackError,
        clearPlaybackError: () => setPlaybackError(null),
        djMode,
        setDjMode,
        djStatus,
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
        playNext,
        removeFromQueue,
        clearQueue,
        setAutoPlayRadio,
        setIsPlayerExpanded,
        toggleLike,
        isLiked,
        toggleDislike,
        isDisliked,
        createPlaylist,
        addToPlaylist,
        removeFromPlaylist,
        deletePlaylist,
        setSleepTimer,
        sleepAtTrackEnd,
        setSleepAtTrackEnd,
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
