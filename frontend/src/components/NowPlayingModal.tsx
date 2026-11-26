import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ListPlus,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  ThumbsUp,
  Heart,
  ThumbsDown,
  Share2,
  Download,
  Check,
  ListMusic,
  FileText,
  Clock,
  Sparkles,
  Radio,
  Trash2,
  Loader2,
  Sliders,
  Music2,
  Video,
  Car,
  Mic2,
  Gauge,
  Disc3,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { usePlayer, usePlaybackTime } from '../context/PlayerContext';
import { api } from '../services/api';
import { EqualizerPreset } from '../types';
import { tap, toast, useBackClose } from '../services/ui';
import { useSettings } from '../services/settings';
import { Sheet, SheetItem } from './Sheet';
import { Switch } from './Primitives';

interface LyricLine {
  time: number;
  text: string;
}

function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lines) {
    const match = timeRegex.exec(line.trim());
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
      const time = minutes * 60 + seconds + millis / 1000;
      const text = match[4].trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

export const NowPlayingModal: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    duration,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    shuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    queue,
    queueIndex,
    removeFromQueue,
    moveInQueue,
    insertIntoQueue,
    createPlaylistWith,
    autoPlayRadio,
    setAutoPlayRadio,
    isPlayerExpanded,
    setIsPlayerExpanded,
    toggleLike,
    isLiked,
    toggleDislike,
    isDisliked,
    sleepTimerRemaining,
    setSleepTimer,
    sleepAtTrackEnd,
    setSleepAtTrackEnd,
    playTrack,
    isVideoMode,
    setIsVideoMode,
    audioQuality,
    playbackRate,
    setPlaybackRate,
    bassGain,
    setBassGain,
    midGain,
    setMidGain,
    trebleGain,
    setTrebleGain,
    equalizerPreset,
    setEqualizerPreset,
    isMuted,
    toggleMute,
    djMode,
    setDjMode,
    djStatus,
  } = usePlayer();
  const currentTime = usePlaybackTime();

  const [activeTab, setActiveTab] = useState<'queue' | 'lyrics' | 'eq'>('queue');
  // queue / lyrics / studio live in a panel that slides up over the player
  const [panelOpen, setPanelOpen] = useState(false);
  useBackClose(panelOpen && isPlayerExpanded, () => setPanelOpen(false));
  const panelTouchRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlayerExpanded) setPanelOpen(false);
  }, [isPlayerExpanded]);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [syncedLines, setSyncedLines] = useState<LyricLine[]>([]);
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const [lyricsSource, setLyricsSource] = useState<string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const lastCoverTapRef = useRef(0);
  const coverTouchRef = useRef<{ x: number; y: number } | null>(null);
  const { seekStep } = useSettings();
  const [heartPop, setHeartPop] = useState(0);
  useEffect(() => {
    if (!heartPop) return;
    const t = setTimeout(() => setHeartPop(0), 700);
    return () => clearTimeout(t);
  }, [heartPop]);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCarMode, setIsCarMode] = useState(false);

  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const lyricsScrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Load lyrics when track changes
  useEffect(() => {
    if (!currentTrack) return;
    setLoadingLyrics(true);
    setLyrics(null);
    setSyncedLines([]);
    setIsSynced(false);
    setLyricsSource(null);
    setDownloaded(currentTrack.isCached || api.isDownloaded(currentTrack.id));

    api.getLyrics(currentTrack.id, currentTrack.title, currentTrack.artist)
      .then((res) => {
        setLyrics(res.lyrics);
        setLyricsSource(res.source || null);
        if (res.lyrics) {
          const parsed = parseLrc(res.lyrics);
          if (parsed.length > 0) {
            setSyncedLines(parsed);
            setIsSynced(true);
          } else {
            setSyncedLines([]);
            setIsSynced(false);
          }
        }
      })
      .catch(() => {
        setLyrics(null);
        setSyncedLines([]);
        setIsSynced(false);
      })
      .finally(() => setLoadingLyrics(false));
  }, [currentTrack?.id]);

  // Compute active lyric line
  let activeLyricIndex = -1;
  if (isSynced && syncedLines.length > 0) {
    for (let i = 0; i < syncedLines.length; i++) {
      if (currentTime >= syncedLines[i].time) {
        activeLyricIndex = i;
      } else {
        break;
      }
    }
  }

  // Auto-scroll active lyric line into view smoothly
  useEffect(() => {
    if (activeTab === 'lyrics' && isSynced && activeLyricRef.current) {
      const box = lyricsScrollContainerRef.current;
      const el = activeLyricRef.current;
      if (box) {
        const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
        try {
          box.scrollTo({ top, behavior: 'smooth' });
        } catch {
          box.scrollTop = top;
        }
      }
    }
  }, [activeLyricIndex, activeTab, isSynced, panelOpen]);

  if (!isPlayerExpanded || !currentTrack) return null;

  // cover gestures: swipe left/right = next/previous song, swipe down = close the player
  const onCoverTouchStart = (e: React.TouchEvent) => {
    coverTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onCoverTouchEnd = (e: React.TouchEvent) => {
    const s0 = coverTouchRef.current;
    coverTouchRef.current = null;
    if (!s0) return;
    const dx = e.changedTouches[0].clientX - s0.x;
    const dy = e.changedTouches[0].clientY - s0.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      tap();
      if (dx < 0) nextTrack();
      else previousTrack();
    } else if (dy > 90 && dy > Math.abs(dx) * 1.5) {
      setIsPlayerExpanded(false);
    }
  };

  const onHeaderTouchEnd = (e: React.TouchEvent) => {
    const s0 = coverTouchRef.current;
    coverTouchRef.current = null;
    if (!s0) return;
    const dy = e.changedTouches[0].clientY - s0.y;
    if (dy > 70 && dy > Math.abs(e.changedTouches[0].clientX - s0.x) * 1.5) setIsPlayerExpanded(false);
  };

  // double tap on the cover = like (with a heart pop)
  const onCoverTap = () => {
    const now = Date.now();
    if (now - lastCoverTapRef.current < 320) {
      lastCoverTapRef.current = 0;
      if (!isLiked(currentTrack.id)) toggleLike(currentTrack);
      tap(15);
      setHeartPop(Date.now());
    } else {
      lastCoverTapRef.current = now;
    }
  };

  const liked = isLiked(currentTrack.id);
  const disliked = isDisliked(currentTrack.id);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScrubValue(parseFloat(e.target.value));
  };

  const handleSeekStart = () => {
    setIsScrubbing(true);
    setScrubValue(currentTime);
  };

  const handleSeekEnd = () => {
    setIsScrubbing(false);
    seek(scrubValue);
  };

  const handleDownload = async () => {
    if (!currentTrack || downloaded || isDownloading) return;
    setIsDownloading(true);
    try {
      await api.downloadTrack(currentTrack.id, {
        title: currentTrack.title,
        artist: currentTrack.artist,
        thumbnail: currentTrack.thumbnail,
        duration: currentTrack.duration || formatTime(duration)
      });
      setDownloaded(true);
    } catch (e) {
      console.error('Download failed:', e);
      alert(`Download fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!currentTrack) return;
    const url = `https://music.youtube.com/watch?v=${currentTrack.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentTrack.title,
          text: `${currentTrack.title} von ${currentTrack.artist}`,
          url
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
      alert('Link in die Zwischenablage kopiert!');
    }
  };

  const currentDisplayTime = isScrubbing ? scrubValue : currentTime;
  const progressPercent = duration > 0 ? (currentDisplayTime / duration) * 100 : 0;

  const eqPresets: { id: EqualizerPreset; label: string }[] = [
    { id: 'bass_boost', label: '🔥 Mega Bass' },
    { id: 'dance', label: '🎧 Club / Dance' },
    { id: 'vocal', label: '🎙️ Vocal Boost' },
    { id: 'rock', label: '🎸 Rock & Gitarre' },
    { id: 'clarity', label: '✨ Höhen Klar' },
    { id: 'flat', label: 'Flat (Original)' },
  ];

  const ctrlBtn = 'flex items-center justify-center rounded-full press';
  const pillBtn = (on: boolean) =>
    `h-10 px-4 rounded-full flex items-center space-x-1.5 text-[0.8125rem] font-semibold flex-shrink-0 press ${
      on ? 'bg-white text-black' : 'bg-white/[0.1] text-white hover:bg-white/[0.16]'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#030303] text-white select-none overflow-hidden animate-in slide-in-from-bottom duration-300">
      {/* Backdrop tinted by the cover (blur is skipped in battery-saver mode) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img
          key={currentTrack.thumbnail}
          src={currentTrack.thumbnail}
          alt=""
          aria-hidden
          className="absolute left-1/2 top-0 w-[160%] max-w-none -translate-x-1/2 aspect-square object-cover blur-[90px] opacity-70 animate-in fade-in duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#030303]/80 to-[#030303]" />
      </div>

      {/* Car Mode Fullscreen Overlay */}
      {isCarMode && (
        <div className="fixed inset-0 z-[60] bg-[#070707] flex flex-col justify-between p-6 select-none animate-in fade-in duration-200">
          <img
            src={currentTrack.thumbnail}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover blur-[80px] opacity-40 pointer-events-none"
          />
          <div className="absolute inset-0 bg-black/50 pointer-events-none" />
          {/* Car Mode Header */}
          <div className="relative flex items-center justify-between pt-[max(var(--sat),12px)]">
            <div className="flex items-center space-x-2 text-red-500 font-black tracking-wider uppercase text-sm">
              <Car className="w-5 h-5" />
              <span>550 Fahrmodus</span>
            </div>
            <button
              onClick={() => setIsCarMode(false)}
              className="flex items-center space-x-1.5 h-11 px-5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm press"
            >
              <X className="w-4 h-4" />
              <span>Beenden</span>
            </button>
          </div>

          {/* Huge Car Cover & Metadata */}
          <div className="relative flex flex-col items-center text-center my-auto px-4">
            <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-2xl shadow-black/70 mb-6">
              <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white truncate max-w-sm tracking-tight">
              {currentTrack.title}
            </h2>
            <p className="text-base sm:text-lg text-zinc-400 truncate max-w-sm mt-1 font-medium">{currentTrack.artist}</p>
          </div>

          {/* Giant Touch-Friendly Car Controls */}
          <div className="relative space-y-6 pb-6">
            <div className="flex items-center justify-center space-x-8">
              <button onClick={previousTrack} className="p-5 rounded-full bg-white/10 text-white press" title="Vorheriger Titel">
                <SkipBack className="w-9 h-9 fill-current" />
              </button>
              <button
                onClick={togglePlay}
                className="p-7 rounded-full bg-white text-black shadow-2xl shadow-black/60 press"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-12 h-12 fill-black" /> : <Play className="w-12 h-12 fill-black ml-1" />}
              </button>
              <button onClick={nextTrack} className="p-5 rounded-full bg-white/10 text-white press" title="Nächster Titel">
                <SkipForward className="w-9 h-9 fill-current" />
              </button>
            </div>

            {/* Quick Car Helpers */}
            <div className="flex items-center justify-around max-w-xs mx-auto border-t border-white/10 pt-4">
              <button
                onClick={() => toggleLike(currentTrack)}
                className={`p-4 rounded-full press ${liked ? 'text-red-500 bg-red-500/15' : 'text-zinc-300 bg-white/[0.08]'}`}
                title="Gefällt mir"
              >
                <ThumbsUp className={`w-7 h-7 ${liked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={toggleMute}
                className="p-4 rounded-full bg-white/[0.08] text-zinc-300 press"
                title={isMuted ? 'Stummschaltung aufheben' : 'Stumm'}
              >
                {isMuted ? <VolumeX className="w-7 h-7 text-red-500" /> : <Volume2 className="w-7 h-7" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar (swipe down here or on the cover = close) */}
      <header
        className="relative z-10 flex items-center justify-between px-2 pb-1"
        style={{ paddingTop: 'max(var(--sat), 0.75rem)' }}
        onTouchStart={onCoverTouchStart}
        onTouchEnd={onHeaderTouchEnd}
      >
        <button
          onClick={() => setIsPlayerExpanded(false)}
          className={`w-11 h-11 text-white ${ctrlBtn} hover:bg-white/10`}
          aria-label="Minimieren"
          title="Minimieren"
        >
          <ChevronDown className="w-7 h-7" />
        </button>

        {/* Song | Video switch */}
        <div className="flex items-center bg-white/[0.1] p-1 rounded-full">
          <button
            onClick={() => setIsVideoMode(false)}
            className={`flex items-center space-x-1.5 h-8 px-3.5 rounded-full text-[0.8125rem] font-semibold transition-colors ${
              !isVideoMode ? 'bg-white text-black shadow' : 'text-white/70 hover:text-white'
            }`}
          >
            <Music2 className="w-3.5 h-3.5" />
            <span>Song</span>
          </button>
          <button
            onClick={() => setIsVideoMode(true)}
            className={`flex items-center space-x-1.5 h-8 px-3.5 rounded-full text-[0.8125rem] font-semibold transition-colors ${
              isVideoMode ? 'bg-white text-black shadow' : 'text-white/70 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video</span>
          </button>
        </div>

        <div className="flex items-center">
          <button
            onClick={() => setIsCarMode(true)}
            className={`w-11 h-11 text-white/80 ${ctrlBtn} hover:bg-white/10`}
            aria-label="Fahrmodus"
            title="Fahrmodus"
          >
            <Car className="w-[1.375rem] h-[1.375rem]" />
          </button>
          <button
            onClick={() => setShowSleepMenu(true)}
            className={`relative w-11 h-11 ${ctrlBtn} ${
              sleepTimerRemaining || sleepAtTrackEnd ? 'text-red-400 bg-red-500/15' : 'text-white/80 hover:bg-white/10'
            }`}
            aria-label="Schlaf-Timer"
            title="Schlaf-Timer"
          >
            <Clock className="w-[1.375rem] h-[1.375rem]" />
          </button>
        </div>
      </header>

      <Sheet
        open={showSleepMenu}
        onClose={() => setShowSleepMenu(false)}
        title={`Schlaf-Timer${
          sleepTimerRemaining ? ` · noch ${Math.ceil(sleepTimerRemaining / 60)} Min.` : sleepAtTrackEnd ? ' · Titelende' : ''
        }`}
      >
        {[15, 30, 45, 60].map((mins) => (
          <SheetItem
            key={mins}
            icon={Clock}
            label={`${mins} Minuten`}
            active={!!sleepTimerRemaining && Math.round(sleepTimerRemaining / 60) === mins}
            onClick={() => {
              setSleepTimer(mins);
              setShowSleepMenu(false);
            }}
          />
        ))}
        <SheetItem
          icon={Music2}
          label="Ende des Titels"
          active={sleepAtTrackEnd}
          onClick={() => {
            setSleepAtTrackEnd(!sleepAtTrackEnd);
            setShowSleepMenu(false);
          }}
        />
        {(sleepTimerRemaining || sleepAtTrackEnd) && (
          <SheetItem
            icon={X}
            danger
            label="Timer ausschalten"
            onClick={() => {
              setSleepTimer(null);
              setShowSleepMenu(false);
            }}
          />
        )}
      </Sheet>

      {/* Main area: artwork, info, controls - sized to fit one screen */}
      <div className="relative z-10 flex-1 min-h-0 w-full max-w-xl mx-auto px-6 pt-1 overflow-y-auto overscroll-contain scrollbar-none">
        {/* spreads out when there is room, scrolls from the top when there is not (landscape) */}
        <div className="min-h-full flex flex-col justify-evenly space-y-3">
        {/* Media Box: shrinks on short screens so the controls always fit */}
        <div
          className="w-full aspect-square mx-auto relative flex-shrink-0"
          style={{ maxWidth: 'min(380px, 100%, max(8rem, calc(100vh - 31rem - var(--sat) - var(--sab))))' }}
        >
          {isVideoMode ? (
            <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${currentTrack.id}?autoplay=1&playsinline=1`}
                title={currentTrack.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div
              onClick={onCoverTap}
              onTouchStart={onCoverTouchStart}
              onTouchEnd={onCoverTouchEnd}
              className={`relative w-full h-full rounded-3xl overflow-hidden bg-white/[0.06] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] transition-transform duration-500 ${
                isPlaying ? 'scale-100' : 'scale-[0.92]'
              }`}
              style={{ transitionTimingFunction: 'var(--ease-spring)' }}
            >
              {heartPop > 0 && (
                <div key={heartPop} className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none animate-ping">
                  <Heart className="w-24 h-24 text-white fill-red-500 drop-shadow-2xl" />
                </div>
              )}
              <img
                key={currentTrack.id}
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-300"
              />
              {isBuffering && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-white animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title & Artist + like */}
        <div className="flex items-center">
          <div className="min-w-0 flex-1 mr-2">
            <h1 className="text-[1.5rem] leading-tight font-bold text-white truncate tracking-tight">{currentTrack.title}</h1>
            <div className="flex items-center mt-1 min-w-0">
              <p className="text-base text-white/60 truncate">{currentTrack.artist}</p>
              <span className="ml-2 flex-shrink-0 text-[0.625rem] font-bold tracking-wide text-white/50 bg-white/[0.08] px-1.5 py-0.5 rounded">
                {audioQuality === 'high' ? 'HQ' : '128k'}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              tap();
              toggleLike(currentTrack);
            }}
            className={`w-12 h-12 -mr-2 flex-shrink-0 ${ctrlBtn} ${liked ? 'text-red-500' : 'text-white/80'}`}
            aria-label={liked ? 'Gefällt mir entfernen' : 'Gefällt mir'}
            title="Gefällt mir"
          >
            <Heart className={`w-7 h-7 ${liked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Progress scrubber: 32px tall touch area, thin visual track */}
        <div>
          <div className={`relative flex items-center h-8 group ${isScrubbing ? 'scrubbing' : ''}`}>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentDisplayTime}
              onChange={handleSeekChange}
              onMouseDown={handleSeekStart}
              onMouseUp={handleSeekEnd}
              onTouchStart={handleSeekStart}
              onTouchEnd={handleSeekEnd}
              aria-label="Position"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={`w-full rounded-full bg-white/20 overflow-hidden transition-all duration-150 ${isScrubbing ? 'h-2' : 'h-1'}`}>
              <div className="h-full bg-white rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
            <div
              className={`absolute rounded-full bg-white shadow-md pointer-events-none transition-[width,height,margin] duration-150 ${
                isScrubbing ? 'w-5 h-5 -ml-2.5' : 'w-3.5 h-3.5 -ml-[7px]'
              }`}
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs tabular-nums text-white/50 -mt-0.5">
            <span className={`w-12 ${isScrubbing ? 'text-white font-semibold' : ''}`}>{formatTime(currentDisplayTime)}</span>
            <div className="flex items-center space-x-1.5">
              <button
                aria-label={`${seekStep} Sekunden zurück`}
                onClick={() => seek(Math.max(0, currentTime - seekStep))}
                className="h-7 px-2.5 rounded-full bg-white/[0.08] text-[0.75rem] font-semibold text-white/75 press"
              >
                −{seekStep}s
              </button>
              <button
                aria-label={`${seekStep} Sekunden vor`}
                onClick={() => seek(Math.min(Math.max(0, duration - 1), currentTime + seekStep))}
                className="h-7 px-2.5 rounded-full bg-white/[0.08] text-[0.75rem] font-semibold text-white/75 press"
              >
                +{seekStep}s
              </button>
            </div>
            <span className="w-12 text-right">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Media Controls (Shuffle, Back, Play, Forward, Repeat) */}
        <div className="flex items-center justify-between -mx-2">
          <button
            onClick={() => {
              tap();
              toggleShuffle();
            }}
            className={`relative w-12 h-12 ${ctrlBtn} ${shuffle ? 'text-red-500' : 'text-white/70 hover:text-white'}`}
            aria-label="Zufallswiedergabe"
            aria-pressed={shuffle}
            title="Zufallswiedergabe"
          >
            <Shuffle className="w-6 h-6" />
            {shuffle && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-red-500" />}
          </button>

          <button
            onClick={() => {
              tap();
              previousTrack();
            }}
            className={`w-16 h-16 text-white ${ctrlBtn}`}
            aria-label="Vorheriger Titel"
            title="Vorheriger Titel"
          >
            <SkipBack className="w-9 h-9 fill-current" />
          </button>

          <button
            onClick={() => {
              tap();
              togglePlay();
            }}
            disabled={isBuffering}
            className={`w-[4.5rem] h-[4.5rem] bg-white text-black shadow-xl shadow-black/40 ${ctrlBtn}`}
            aria-label={isPlaying ? 'Pause' : 'Abspielen'}
            title={isPlaying ? 'Pause' : 'Abspielen'}
          >
            {isBuffering ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 fill-black stroke-none" />
            ) : (
              <Play className="w-8 h-8 fill-black stroke-none ml-1" />
            )}
          </button>

          <button
            onClick={() => {
              tap();
              nextTrack();
            }}
            className={`w-16 h-16 text-white ${ctrlBtn}`}
            aria-label="Nächster Titel"
            title="Nächster Titel"
          >
            <SkipForward className="w-9 h-9 fill-current" />
          </button>

          <button
            onClick={() => {
              tap();
              cycleRepeatMode();
            }}
            className={`relative w-12 h-12 ${ctrlBtn} ${repeatMode !== 'off' ? 'text-red-500' : 'text-white/70 hover:text-white'}`}
            aria-label="Wiederholen"
            title="Wiederholen"
          >
            {repeatMode === 'one' ? <Repeat1 className="w-6 h-6" /> : <Repeat className="w-6 h-6" />}
            {repeatMode !== 'off' && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-red-500" />}
          </button>
        </div>

        {/* Action pills (YouTube Music style) */}
        <div className="shelf space-x-2 -mx-6 px-6 scrollbar-none">
          <button onClick={() => toggleDislike(currentTrack.id)} className={pillBtn(disliked)} aria-label="Gefällt mir nicht" title="Gefällt mir nicht">
            <ThumbsDown className={`w-4 h-4 ${disliked ? 'fill-current' : ''}`} />
          </button>
          <button onClick={handleDownload} disabled={isDownloading || downloaded} className={pillBtn(false)} title="Für Offline speichern">
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : downloaded ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{downloaded ? 'Offline' : isDownloading ? 'Lädt…' : 'Download'}</span>
          </button>
          <button onClick={handleShare} className={pillBtn(false)} title="Teilen">
            <Share2 className="w-4 h-4" />
            <span>Teilen</span>
          </button>
        </div>

        {/* DJ mode: automatic beat-matched mixing into the next track */}
        <div className="flex items-center justify-between pl-3 pr-2 py-0.5 rounded-2xl bg-white/[0.06]">
          <div className="flex items-center min-w-0">
            <span
              className={`w-9 h-9 mr-3 rounded-full flex items-center justify-center flex-shrink-0 ${
                djMode ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-zinc-500'
              }`}
            >
              <Disc3 className={`w-5 h-5 ${djStatus.phase === 'mixing' ? 'animate-spin' : ''}`} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">DJ-Modus</div>
              <div className="text-xs text-white/50 truncate">
                {!djMode
                  ? 'Mixt automatisch in den nächsten Song'
                  : djStatus.phase === 'analyzing'
                  ? 'Analysiert Beats & Übergang …'
                  : djStatus.phase === 'ready'
                  ? `${djStatus.bpmOut ? Math.round(djStatus.bpmOut) : '?'} → ${
                      djStatus.bpmIn ? Math.round(djStatus.bpmIn) : '?'
                    } BPM · ${djStatus.beatSync ? 'Beatmatch' : 'Blend'} in ${formatTime(
                      Math.max(0, (djStatus.mixStart || 0) - currentTime)
                    )}`
                  : djStatus.phase === 'mixing'
                  ? `Mix läuft${djStatus.beatSync ? ' · Beats synchron' : ''} …`
                  : djStatus.message || 'Bereit'}
              </div>
            </div>
          </div>
          <Switch on={djMode} onChange={setDjMode} label="DJ-Modus" />
        </div>

        </div>
      </div>

      {/* Pinned bottom strip: opens queue / lyrics / 550 studio */}
      <div className="relative z-10 w-full max-w-xl mx-auto px-4 pt-2 pb-safe">
        <div className="flex items-center p-1 rounded-full bg-white/[0.08]">
          {(
            [
              { id: 'queue', icon: ListMusic, label: 'Als Nächstes' },
              { id: 'lyrics', icon: Mic2, label: 'Songtext' },
              { id: 'eq', icon: Sliders, label: 'Studio' },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => {
                  tap();
                  setActiveTab(t.id);
                  setPanelOpen(true);
                }}
                className="flex-1 min-w-0 h-11 rounded-full flex items-center justify-center space-x-1.5 text-[0.8125rem] font-semibold text-white/75 hover:text-white active:bg-white/10"
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{t.label}</span>
                {t.id === 'lyrics' && isSynced && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slide-up panel (swipe down on its top bar, the chevron or the back button closes it) */}
      {panelOpen && (
        <div
          className="absolute inset-x-0 mx-auto max-w-xl bottom-0 z-20 flex flex-col bg-surface-1 rounded-t-[1.75rem] border-t border-white/[0.08] shadow-sheet animate-in slide-in-from-bottom duration-300"
          style={{ top: 'calc(max(var(--sat), 0.75rem) + 3.25rem)' }}
        >
          <div
            className="flex-shrink-0 px-3 pt-2 pb-2"
            onTouchStart={(e) => {
              panelTouchRef.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              const y0 = panelTouchRef.current;
              panelTouchRef.current = null;
              if (y0 !== null && e.changedTouches[0].clientY - y0 > 60) setPanelOpen(false);
            }}
          >
            <div className="relative flex justify-center items-center h-9 -mt-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
              <button
                onClick={() => setPanelOpen(false)}
                aria-label="Panel schließen"
                className={`absolute right-0 w-10 h-10 text-white/80 ${ctrlBtn} hover:bg-white/10`}
              >
                <ChevronDown className="w-6 h-6" />
              </button>
            </div>
            <div className="flex items-center">
          <div className="flex-1 min-w-0 flex items-center p-1 rounded-full bg-white/[0.07]">
            {(
              [
                { id: 'queue', icon: ListMusic, label: 'Als Nächstes' },
                { id: 'lyrics', icon: Mic2, label: 'Songtext' },
                { id: 'eq', icon: Sliders, label: 'Studio' },
              ] as const
            ).map((t) => {
              const on = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    tap();
                    setActiveTab(t.id);
                  }}
                  className={`flex-1 min-w-0 h-10 px-1 rounded-full flex items-center justify-center space-x-1 text-[0.8125rem] font-semibold transition-colors ${
                    on ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <span className="truncate">{t.label}</span>
                  {t.id === 'lyrics' && isSynced && (
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${on ? 'bg-emerald-600' : 'bg-emerald-400'}`} />
                  )}
                </button>
              );
            })}
          </div>

            </div>
          </div>

          {/* Panel Content */}
          <div ref={lyricsScrollContainerRef} className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-1 pb-safe scrollbar-none">
            {activeTab === 'queue' ? (
              <div className="space-y-1">
                {/* Auto-play Radio Toggle */}
                <div className="flex items-center justify-between pl-3 pr-2 rounded-2xl bg-white/[0.06] mb-2">
                  <div className="flex items-center space-x-2.5 text-sm text-white/80">
                    <Radio className="w-4 h-4 text-red-400" />
                    <span>Endlos-Wiedergabe (Radio)</span>
                  </div>
                  <Switch on={autoPlayRadio} onChange={setAutoPlayRadio} label="Endlos-Wiedergabe" />
                </div>

                <button
                  onClick={() => {
                    const name = `Warteschlange ${new Date().toLocaleDateString('de-DE')}`;
                    createPlaylistWith(name, queue);
                    toast(`Als Playlist „${name}“ gespeichert`);
                  }}
                  className="w-full h-11 flex items-center justify-center space-x-2 mb-2 text-[0.8125rem] font-medium text-white/80 bg-white/[0.06] rounded-2xl press"
                >
                  <ListPlus className="w-4 h-4" /> <span>Warteschlange als Playlist speichern</span>
                </button>

                {/* Queue list */}
                {queue.map((track, i) => {
                  const isTrackCurrent = i === queueIndex;
                  return (
                    <div
                      key={`${track.id}-${i}`}
                      onClick={() => playTrack(track, queue)}
                      className={`flex items-center justify-between min-h-[3.5rem] pl-1.5 py-1 rounded-2xl cursor-pointer transition-colors ${
                        isTrackCurrent ? 'bg-white/[0.1]' : 'hover:bg-white/[0.04] active:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          loading="lazy"
                          className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-medium leading-snug truncate ${isTrackCurrent ? 'text-red-400 font-semibold' : 'text-white'}`}>
                            {track.title}
                          </div>
                          <div className="text-xs leading-snug text-white/50 truncate">
                            {track.artist}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          aria-label="Nach oben"
                          disabled={i === 0}
                          onClick={() => moveInQueue(i, i - 1)}
                          className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 active:bg-white/10 disabled:opacity-20"
                        >
                          <ChevronUp className="w-[1.125rem] h-[1.125rem]" />
                        </button>
                        <button
                          aria-label="Nach unten"
                          disabled={i === queue.length - 1}
                          onClick={() => moveInQueue(i, i + 1)}
                          className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 active:bg-white/10 disabled:opacity-20"
                        >
                          <ChevronDown className="w-[1.125rem] h-[1.125rem]" />
                        </button>
                        {i !== queueIndex && (
                          <button
                            aria-label="Aus Warteschlange entfernen"
                            onClick={() => {
                              removeFromQueue(i);
                              toast('Entfernt', 'info', { label: 'Rückgängig', run: () => insertIntoQueue(i, track) });
                            }}
                            className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 hover:text-red-400 active:bg-white/10"
                          >
                            <Trash2 className="w-[1.125rem] h-[1.125rem]" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : activeTab === 'lyrics' ? (
              /* Synchronized Karaoke Lyrics View */
              <div className="py-2 px-3">
                {loadingLyrics ? (
                  <div className="flex flex-col items-center justify-center py-8 text-zinc-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                    <span className="text-xs">Synchronisiere Songtext...</span>
                  </div>
                ) : isSynced && syncedLines.length > 0 ? (
                  <div className="space-y-3 text-left py-2">
                    <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-semibold mb-2">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>Karaoke Live-Synchronisiert (Tippe zum Springen)</span>
                    </div>
                    {syncedLines.map((line, idx) => {
                      const isActive = idx === activeLyricIndex;
                      const isPast = idx < activeLyricIndex;
                      return (
                        <div
                          key={idx}
                          ref={isActive ? activeLyricRef : null}
                          onClick={() => seek(line.time)}
                          className={`cursor-pointer transition-all duration-300 py-1 px-2 rounded-lg ${
                            isActive
                              ? 'text-[1.375rem] leading-snug font-extrabold text-white'
                              : isPast
                              ? 'text-lg leading-snug font-bold text-white/35 hover:text-white/60'
                              : 'text-lg leading-snug font-bold text-white/20 hover:text-white/40'
                          }`}
                        >
                          {line.text}
                        </div>
                      );
                    })}
                  </div>
                ) : lyrics ? (
                  <div className="text-center py-3">
                    <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-400 mb-3">
                      <span>{lyricsSource || 'Songtext'}</span>
                    </div>
                    <div className="text-base leading-relaxed text-white/85 whitespace-pre-line font-semibold">
                      {lyrics}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-zinc-500">
                    Kein Songtext für diesen Titel verfügbar.
                  </div>
                )}
              </div>
            ) : (
              /* 550 Pro Equalizer & DJ Speed Studio */
              <div className="p-2 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="font-bold flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-red-500" />
                    <span>550 Sound Studio & DJ Controller</span>
                  </span>
                  <span className="text-emerald-400 text-[11px] font-semibold">Aktiv</span>
                </div>

                {/* DJ Speed & Tempo Bar */}
                <div className="space-y-2 bg-white/[0.06] p-3 rounded-2xl">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="flex items-center space-x-1">
                      <Gauge className="w-3.5 h-3.5 text-red-400" />
                      <span>DJ Wiedergabegeschwindigkeit (Tempo)</span>
                    </span>
                    <span className="font-mono text-white font-bold">{playbackRate}x</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { rate: 0.75, label: '0.75x Chill' },
                      { rate: 0.9, label: '0.9x Slowed' },
                      { rate: 1.0, label: '1.0x Normal' },
                      { rate: 1.15, label: '1.15x Groove' },
                      { rate: 1.25, label: '1.25x Nightcore' },
                      { rate: 1.5, label: '1.5x Speed' },
                    ].map((item) => (
                      <button
                        key={item.rate}
                        onClick={() => setPlaybackRate(item.rate)}
                        className={`h-9 px-1.5 rounded-xl text-xs font-semibold press ${
                          playbackRate === item.rate
                            ? 'bg-red-600 text-white font-bold shadow-md'
                            : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="shelf space-x-2 pb-1 scrollbar-none">
                  {eqPresets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setEqualizerPreset(p.id)}
                      className={`h-9 px-3.5 rounded-full text-[0.8125rem] whitespace-nowrap press ${
                        equalizerPreset === p.id
                          ? 'bg-red-600 text-white font-bold'
                          : 'bg-white/10 text-zinc-300 hover:bg-white/15'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Bass Boost Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Bass Booster</span>
                    <span className="font-mono text-red-400 font-bold">+{bassGain} dB</span>
                  </div>
                  <input
                    type="range"
                    min={-6}
                    max={12}
                    step={1}
                    value={bassGain}
                    onChange={(e) => setBassGain(parseInt(e.target.value))}
                    className="slider w-full"
                  />
                </div>

                {/* Mids & Treble */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
                      <span>Mitten (Vocals)</span>
                      <span className="font-mono">{midGain > 0 ? `+${midGain}` : midGain} dB</span>
                    </div>
                    <input
                      type="range"
                      min={-8}
                      max={8}
                      step={1}
                      value={midGain}
                      onChange={(e) => setMidGain(parseInt(e.target.value))}
                      className="slider w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
                      <span>Höhen (Klarheit)</span>
                      <span className="font-mono">{trebleGain > 0 ? `+${trebleGain}` : trebleGain} dB</span>
                    </div>
                    <input
                      type="range"
                      min={-8}
                      max={8}
                      step={1}
                      value={trebleGain}
                      onChange={(e) => setTrebleGain(parseInt(e.target.value))}
                      className="slider w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
