import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  ThumbsUp,
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
  Cast
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../services/api';
import { EqualizerPreset } from '../types';

export const NowPlayingModal: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
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
    playTrack,
    isVideoMode,
    setIsVideoMode,
    audioQuality,
    setAudioQuality,
    bassGain,
    setBassGain,
    midGain,
    setMidGain,
    trebleGain,
    setTrebleGain,
    equalizerPreset,
    setEqualizerPreset
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<'queue' | 'lyrics' | 'eq'>('queue');
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Load lyrics when track changes
  useEffect(() => {
    if (!currentTrack) return;
    setLoadingLyrics(true);
    setLyrics(null);
    setDownloaded(currentTrack.isCached || false);
    api.getLyrics(currentTrack.id)
      .then((res) => setLyrics(res.lyrics))
      .catch(() => setLyrics(null))
      .finally(() => setLoadingLyrics(false));
  }, [currentTrack?.id]);

  if (!isPlayerExpanded || !currentTrack) return null;

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
      await api.downloadTrack(currentTrack.id);
      setDownloaded(true);
    } catch (e) {
      console.error('Download failed:', e);
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#030303] text-white select-none overflow-hidden animate-in fade-in duration-200">
      {/* Dynamic ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-36 -left-36 w-[150vw] h-[65vh] rounded-full blur-[130px] opacity-25 transition-all duration-1000"
          style={{
            backgroundImage: `radial-gradient(circle, #e11d48, #3b0764, transparent)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#030303]/85 to-[#030303]" />
      </div>

      {/* Top Bar: 1:1 YouTube Music Player Header */}
      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-1">
        {/* Minimize Chevron */}
        <button
          onClick={() => setIsPlayerExpanded(false)}
          className="p-2 text-zinc-300 hover:text-white rounded-full active:scale-90 transition"
          title="Minimieren"
        >
          <ChevronDown className="w-7 h-7" />
        </button>

        {/* 1:1 Song | Video Switcher Pill */}
        <div className="flex items-center bg-[#212121] p-0.5 rounded-full border border-white/10 shadow-inner">
          <button
            onClick={() => setIsVideoMode(false)}
            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold transition ${
              !isVideoMode ? 'bg-white text-black shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Music2 className="w-3.5 h-3.5" />
            <span>Song</span>
          </button>
          <button
            onClick={() => setIsVideoMode(true)}
            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold transition ${
              isVideoMode ? 'bg-white text-black shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video</span>
          </button>
        </div>

        {/* Actions: Cast & Sleep Timer */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowSleepMenu(!showSleepMenu)}
            className={`p-2 rounded-full active:scale-90 transition ${
              sleepTimerRemaining ? 'bg-red-600 text-white' : 'text-zinc-300 hover:text-white'
            }`}
            title="Schlaf-Timer"
          >
            <Clock className="w-5 h-5" />
          </button>
        </div>

        {/* Sleep Menu Popup */}
        {showSleepMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowSleepMenu(false)} />
            <div className="absolute right-4 top-14 z-50 w-52 bg-[#1c1c1c] border border-white/10 rounded-2xl shadow-2xl p-2 backdrop-blur-xl">
              <div className="text-xs font-semibold px-3 py-1.5 text-zinc-400 border-b border-white/5">
                Schlaf-Timer {sleepTimerRemaining ? `(${Math.ceil(sleepTimerRemaining / 60)}m)` : ''}
              </div>
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => {
                    setSleepTimer(mins);
                    setShowSleepMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-white/10 rounded-lg flex items-center justify-between"
                >
                  <span>{mins} Minuten</span>
                  {sleepTimerRemaining && Math.round(sleepTimerRemaining / 60) === mins && (
                    <Check className="w-4 h-4 text-red-500" />
                  )}
                </button>
              ))}
              {sleepTimerRemaining && (
                <button
                  onClick={() => {
                    setSleepTimer(null);
                    setShowSleepMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg mt-1"
                >
                  Timer ausschalten
                </button>
              )}
            </div>
          </>
        )}
      </header>

      {/* Main Center Area: Artwork or Video */}
      <div className="relative z-10 flex-1 flex flex-col justify-between px-6 py-2 overflow-y-auto">
        {/* Media Box */}
        <div className="w-full max-w-[340px] aspect-square mx-auto my-auto relative">
          {isVideoMode ? (
            /* Video Mode Player */
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10">
              <iframe
                src={`https://www.youtube.com/embed/${currentTrack.id}?autoplay=1&playsinline=1`}
                title={currentTrack.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            /* Album Artwork with Soft Shadow */
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl shadow-black/90 bg-zinc-900 border border-white/10">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform duration-1000 ${
                  isPlaying ? 'scale-100' : 'scale-95 brightness-90'
                }`}
              />
              {isBuffering && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-white animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title & Artist */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-3">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate tracking-tight">
                {currentTrack.title}
              </h1>
              <p className="text-sm sm:text-base text-zinc-400 truncate mt-0.5">
                {currentTrack.artist}
              </p>
            </div>
            {/* 550 Hi-Res Badge */}
            <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
              {audioQuality === 'high' ? 'HQ 256k' : '128k'}
            </span>
          </div>

          {/* 1:1 YouTube Music Action Row (Thumbs Up, Thumbs Down, Save, Share, Download) */}
          <div className="flex items-center justify-between mt-3 px-2 border-y border-white/5 py-1.5">
            {/* Thumbs Up (Like) */}
            <button
              onClick={() => toggleLike(currentTrack)}
              className={`p-2 rounded-full active:scale-90 transition flex items-center space-x-1 ${
                liked ? 'text-red-500' : 'text-zinc-400 hover:text-white'
              }`}
              title="Gefällt mir"
            >
              <ThumbsUp className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
            </button>

            {/* Thumbs Down (Dislike) */}
            <button
              onClick={() => toggleDislike(currentTrack.id)}
              className={`p-2 rounded-full active:scale-90 transition ${
                disliked ? 'text-red-500' : 'text-zinc-400 hover:text-white'
              }`}
              title="Gefällt mir nicht"
            >
              <ThumbsDown className={`w-5 h-5 ${disliked ? 'fill-current' : ''}`} />
            </button>

            {/* Offline Download */}
            <button
              onClick={handleDownload}
              disabled={isDownloading || downloaded}
              className={`p-2 rounded-full active:scale-90 transition ${
                downloaded ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
              }`}
              title="Für Offline speichern"
            >
              {isDownloading ? (
                <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
              ) : downloaded ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="p-2 rounded-full text-zinc-400 hover:text-white active:scale-90 transition"
              title="Teilen"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Custom Progress Scrubber */}
        <div className="mt-3">
          <div className="relative flex items-center h-5 group">
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
              className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600 transition-all duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div
              className="absolute w-3.5 h-3.5 bg-red-500 rounded-full shadow-md pointer-events-none -ml-1.5 transition-transform group-hover:scale-125"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between text-xs font-mono text-zinc-400 mt-1">
            <span>{formatTime(currentDisplayTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Media Controls (Shuffle, Back, Play, Forward, Repeat) */}
        <div className="flex items-center justify-between px-2 my-2">
          <button
            onClick={toggleShuffle}
            className={`p-3 rounded-full active:scale-90 transition ${
              shuffle ? 'text-red-500 bg-red-500/10' : 'text-zinc-400 hover:text-white'
            }`}
            title="Zufallswiedergabe"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            onClick={previousTrack}
            className="p-3 text-zinc-200 hover:text-white active:scale-90 transition"
            title="Vorheriger Titel"
          >
            <SkipBack className="w-7 h-7 fill-current" />
          </button>

          <button
            onClick={togglePlay}
            disabled={isBuffering}
            className="p-5 rounded-full bg-white text-black hover:bg-zinc-200 active:scale-95 shadow-xl shadow-white/10 transition"
            title={isPlaying ? "Pause" : "Abspielen"}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-black" />
            ) : (
              <Play className="w-8 h-8 fill-black ml-1" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-3 text-zinc-200 hover:text-white active:scale-90 transition"
            title="Nächster Titel"
          >
            <SkipForward className="w-7 h-7 fill-current" />
          </button>

          <button
            onClick={cycleRepeatMode}
            className={`p-3 rounded-full active:scale-90 transition ${
              repeatMode !== 'off' ? 'text-red-500 bg-red-500/10' : 'text-zinc-400 hover:text-white'
            }`}
            title="Wiederholen"
          >
            {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </button>
        </div>

        {/* Bottom Drawer Tabs: Queue vs Lyrics vs 550 Equalizer */}
        <div className="border-t border-white/10 pt-2">
          <div className="flex items-center justify-around border-b border-white/5 pb-2">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center space-x-1.5 text-xs font-semibold tracking-wider uppercase pb-1 transition ${
                activeTab === 'queue' ? 'text-white border-b-2 border-red-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <ListMusic className="w-4 h-4" />
              <span>Nächste Titel ({queue.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('lyrics')}
              className={`flex items-center space-x-1.5 text-xs font-semibold tracking-wider uppercase pb-1 transition ${
                activeTab === 'lyrics' ? 'text-white border-b-2 border-red-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Songtext</span>
            </button>

            {/* The 550 Pro Equalizer Tab */}
            <button
              onClick={() => setActiveTab('eq')}
              className={`flex items-center space-x-1 text-xs font-semibold tracking-wider uppercase pb-1 transition ${
                activeTab === 'eq' ? 'text-red-400 border-b-2 border-red-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>550 Equalizer</span>
            </button>
          </div>

          {/* Drawer Content */}
          <div className="h-44 overflow-y-auto pt-2 scrollbar-thin">
            {activeTab === 'queue' ? (
              <div className="space-y-1">
                {/* Auto-play Radio Toggle */}
                <div className="flex items-center justify-between px-2 py-1.5 text-xs text-zinc-400 bg-white/5 rounded-lg mb-2">
                  <div className="flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-red-500" />
                    <span>Endlos-Wiedergabe (Radio)</span>
                  </div>
                  <button
                    onClick={() => setAutoPlayRadio(!autoPlayRadio)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                      autoPlayRadio ? 'bg-red-600' : 'bg-zinc-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        autoPlayRadio ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Queue list */}
                {queue.map((track, i) => {
                  const isTrackCurrent = i === queueIndex;
                  return (
                    <div
                      key={`${track.id}-${i}`}
                      onClick={() => playTrack(track, queue)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                        isTrackCurrent ? 'bg-red-600/20 border border-red-500/30' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-semibold truncate ${isTrackCurrent ? 'text-red-400' : 'text-white'}`}>
                            {track.title}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            {track.artist}
                          </div>
                        </div>
                      </div>

                      {i !== queueIndex && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(i);
                          }}
                          className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : activeTab === 'lyrics' ? (
              /* Lyrics View */
              <div className="py-2 px-3 text-center">
                {loadingLyrics ? (
                  <div className="flex flex-col items-center justify-center py-8 text-zinc-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                    <span className="text-xs">Songtext wird geladen...</span>
                  </div>
                ) : lyrics ? (
                  <div className="text-sm leading-relaxed text-zinc-200 whitespace-pre-line font-medium">
                    {lyrics}
                  </div>
                ) : (
                  <div className="py-8 text-xs text-zinc-500">
                    Kein Songtext für diesen Titel verfügbar.
                  </div>
                )}
              </div>
            ) : (
              /* 550 Pro Equalizer View */
              <div className="p-2 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="font-bold flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-red-500" />
                    <span>550 Sound Studio & Bass Booster</span>
                  </span>
                  <span className="text-emerald-400 text-[11px] font-semibold">Aktiv</span>
                </div>

                {/* Preset Chips */}
                <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {eqPresets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setEqualizerPreset(p.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition active:scale-95 ${
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
                    className="w-full accent-red-600 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
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
                      className="w-full accent-zinc-400 h-1 bg-zinc-800 rounded-lg"
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
                      className="w-full accent-zinc-400 h-1 bg-zinc-800 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
