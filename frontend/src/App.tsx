import React, { useState, useEffect, useRef } from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { MiniPlayer } from './components/MiniPlayer';
import { NowPlayingModal } from './components/NowPlayingModal';
import { AuthModal } from './components/AuthModal';
import { HomeView } from './components/HomeView';
import { SearchView } from './components/SearchView';
import { LibraryView } from './components/LibraryView';
import { api, UserProfile } from './services/api';
import { initUpdater, applyUpdate, UpdateStatus, currentWebBuild, installDownloadedApk } from './services/updater';
import { googleAuthService } from './services/googleAuth';
import { Capacitor } from '@capacitor/core';
import { Toaster } from './components/Toaster';
import { SettingsModal } from './components/SettingsModal';
import { Sheet } from './components/Sheet';
import { CHANGELOG, CHANGELOG_ID } from './services/changelog';
import { useBackClose, useOnline } from './services/ui';

const PlaybackErrorBanner: React.FC = () => {
  const { playbackError, clearPlaybackError } = usePlayer();
  useEffect(() => {
    if (!playbackError) return;
    const t = setTimeout(clearPlaybackError, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackError]);
  if (!playbackError) return null;
  return (
    <div
      onClick={clearPlaybackError}
      className="mx-3 mb-2 rounded-2xl bg-red-600/95 px-4 py-3 text-sm text-white shadow-float animate-in fade-in slide-in-from-bottom-4"
    >
      ⚠️ {playbackError}
    </div>
  );
};

const UpdateBanner: React.FC<{ status: UpdateStatus | null; onClose: () => void; onStatus: (s: UpdateStatus) => void }> = ({
  status,
  onClose,
  onStatus,
}) => {
  const [busy, setBusy] = useState(false);
  if (!status) return null;
  if (status.type === 'apk') {
    const text =
      status.phase === 'downloading'
        ? `⬇️ Neue Version ${status.version} wird geladen${status.percent && status.percent > 0 ? ` – ${status.percent} %` : '…'}`
        : status.phase === 'permission'
          ? `🔓 Einmalig „Apps aus dieser Quelle zulassen“ aktivieren, dann zurück zur App`
          : status.phase === 'installing'
            ? `📲 Version ${status.version} bereit – im Fenster auf „Aktualisieren“ tippen`
            : `⚠️ Update fehlgeschlagen${status.error ? ` (${status.error})` : ''}`;
    return (
      <div className="mx-3 mb-2 rounded-2xl bg-blue-600/95 px-4 py-2.5 text-sm text-white shadow-float flex items-center justify-between gap-3">
        <span className="min-w-0">{text}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {status.phase !== 'downloading' && (
            <button
              onClick={() => installDownloadedApk(status.version, status.url, onStatus)}
              className="rounded-full bg-white/95 h-8 px-3.5 text-xs font-bold text-blue-700 active:scale-95"
            >
              {status.phase === 'error' ? 'Nochmal' : 'Installieren'}
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-white/80 active:bg-white/20" aria-label="Schließen">
            ✕
          </button>
        </div>
      </div>
    );
  }
  if (status.type === 'ready') {
    return (
      <div className="mx-3 mb-2 rounded-2xl bg-emerald-600/95 px-4 py-2.5 text-sm text-white shadow-float flex items-center justify-between gap-3">
        <span className="min-w-0">✨ Update geladen – wird beim nächsten Start aktiv</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              applyUpdate(status.bundleId).catch(() => setBusy(false));
            }}
            className="rounded-full bg-white/95 h-8 px-3.5 text-xs font-bold text-emerald-700 active:scale-95"
          >
            {busy ? '…' : 'Jetzt'}
          </button>
          <button onClick={onClose} className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-white/80 active:bg-white/20" aria-label="Schließen">
            ✕
          </button>
        </div>
      </div>
    );
  }
  const isAndroid = Capacitor.getPlatform() === 'android';
  return (
    <div className="mx-3 mb-2 rounded-2xl bg-blue-600/95 px-4 py-2.5 text-sm text-white shadow-float flex items-center justify-between gap-3">
      <span className="min-w-0">
        📲 Neue App-Version verfügbar{isAndroid ? '' : ' – in SideStore aktualisieren'}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isAndroid && status.info.apk && (
          <button
            onClick={() => googleAuthService.openSystemBrowser(status.info.apk).catch(() => {})}
            className="rounded-full bg-white/95 h-8 px-3.5 text-xs font-bold text-blue-700 active:scale-95"
          >
            Laden
          </button>
        )}
        <button onClick={onClose} className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-white/80 active:bg-white/20" aria-label="Schließen">
          ✕
        </button>
      </div>
    </div>
  );
};

const OfflineBanner: React.FC = () => {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="mx-3 mb-2 rounded-2xl glass border border-white/[0.08] px-4 py-2.5 text-xs text-zinc-200 shadow-float">
      📴 Keine Internetverbindung – Offline-Songs findest du in der Mediathek.
    </div>
  );
};

const TAB_KEY = 'ytmusic_last_tab';
const SEEN_KEY = 'ytmusic_seen_changelog';

/** "Was ist neu" once after an update (not on a fresh install). */
const WhatsNew: React.FC = () => {
  const [open, setOpen] = useState(() => {
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      if (seen === CHANGELOG_ID) return false;
      const used = !!localStorage.getItem('ytmusic_history');
      localStorage.setItem(SEEN_KEY, CHANGELOG_ID);
      return used;
    } catch {
      return false;
    }
  });
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="✨ Was ist neu">
      <ul className="px-3 space-y-2.5 text-sm text-zinc-300 list-disc pl-7">
        {CHANGELOG.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="px-3 pt-5 pb-1">
        <button onClick={() => setOpen(false)} className="w-full h-12 rounded-full bg-white text-black text-sm font-bold press">
          Los geht's
        </button>
      </div>
    </Sheet>
  );
};

const AppContent: React.FC = () => {
  const { isPlayerExpanded, setIsPlayerExpanded, togglePlay, nextTrack, previousTrack } = usePlayer();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    (window as any).__webBuild = currentWebBuild();
    return initUpdater(setUpdateStatus);
  }, []);
  // back from "allow installs from this source" -> open the installer right away
  const updateRef = useRef<UpdateStatus | null>(null);
  updateRef.current = updateStatus;
  useEffect(() => {
    const onVis = () => {
      const s = updateRef.current;
      if (document.visibilityState === 'visible' && s?.type === 'apk' && s.phase === 'permission') {
        installDownloadedApk(s.version, s.url, setUpdateStatus);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    try {
      const t = localStorage.getItem(TAB_KEY);
      // "explore" was merged into the search tab
      return t === 'explore' || t === 'search' ? 'search' : t === 'library' ? 'library' : 'home';
    } catch {
      return 'home';
    }
  });
  const mainRef = useRef<HTMLElement>(null);
  const [activeMoodFilter, setActiveMoodFilter] = useState<string | null>(null);
  const [moodChips, setMoodChips] = useState<string[] | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    isLoggedIn: false,
    name: 'Gast'
  });

  useEffect(() => {
    // Hide boot splash immediately on App mount
    try {
      const splash = document.getElementById('boot-splash');
      if (splash) {
        splash.style.opacity = '0';
        splash.style.transition = 'opacity 0.2s ease';
        setTimeout(() => splash.remove(), 250);
      }
    } catch { /* ignore */ }

    api.getAuthStatus().then(setUserProfile).catch(console.error);
  }, []);

  const handleSelectFilter = (filter: string) => {
    if (activeMoodFilter === filter) {
      setActiveMoodFilter(null);
    } else {
      setActiveMoodFilter(filter);
      setActiveTab('home');
    }
  };

  const handleTabChange = (tab: NavTab) => {
    if (tab === activeTab) {
      // tap on the active tab = back to the top
      mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveTab(tab);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignore */
    }
  };

  // "Mehr von <Künstler>" etc.: open the search with a query
  const [searchSeed, setSearchSeed] = useState<{ q: string; n: number } | null>(null);
  useEffect(() => {
    const onSearch = (e: Event) => {
      const q = String((e as CustomEvent).detail || '').trim();
      if (!q) return;
      setSearchSeed({ q, n: Date.now() });
      setActiveTab('search');
    };
    window.addEventListener('ytm:search', onSearch);
    const onTab = (e: Event) => {
      const t = (e as CustomEvent).detail;
      if (t === 'home' || t === 'search' || t === 'library') setActiveTab(t);
    };
    window.addEventListener('ytm:tab', onTab);
    // Android "Teilen" -> this app: a YouTube link (or any text) opens in the search
    const onShared = () => {
      const t = (window as any).__sharedText;
      (window as any).__sharedText = null;
      if (typeof t === 'string' && t.trim()) {
        setSearchSeed({ q: t.trim().slice(0, 300), n: Date.now() });
        setActiveTab('search');
      }
    };
    window.addEventListener('ytm:shared', onShared);
    onShared();
    return () => {
      window.removeEventListener('ytm:search', onSearch);
      window.removeEventListener('ytm:tab', onTab);
      window.removeEventListener('ytm:shared', onShared);
    };
  }, []);

  // a "Mehr von …" / shared-link query belongs to that one visit of the search tab
  useEffect(() => {
    if (activeTab !== 'search') setSearchSeed(null);
  }, [activeTab]);

  // Android back button closes the open screen instead of leaving the app
  useBackClose(activeTab === 'search', () => setActiveTab('home'));
  useBackClose(isPlayerExpanded, () => setIsPlayerExpanded(false));
  useBackClose(isAuthOpen, () => setIsAuthOpen(false));
  useBackClose(isSettingsOpen, () => setIsSettingsOpen(false));

  // keyboard (browser / tablet with keyboard): space = play/pause, shift+arrows = skip
  const keysRef = useRef({ togglePlay, nextTrack, previousTrack });
  keysRef.current = { togglePlay, nextTrack, previousTrack };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        keysRef.current.togglePlay();
      } else if (e.shiftKey && e.key === 'ArrowRight') keysRef.current.nextTrack();
      else if (e.shiftKey && e.key === 'ArrowLeft') keysRef.current.previousTrack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-[#030303] text-white overflow-hidden select-none font-sans">
      {/* 1:1 Standard YouTube Music Header */}
      <Header
        userProfile={userProfile}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeFilter={activeMoodFilter}
        onSelectFilter={handleSelectFilter}
        chips={moodChips}
        showChips={activeTab === 'home'}
      />

      {/* Main View Area */}
      <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        {activeTab === 'home' && (
          <HomeView
            filterMood={activeMoodFilter}
            onChips={setMoodChips}
            accountKey={userProfile.isLoggedIn ? userProfile.name : 'guest'}
          />
        )}
        {activeTab === 'search' && <SearchView key={searchSeed?.n || 0} initialQuery={searchSeed?.q} />}
        {activeTab === 'library' && <LibraryView userProfile={userProfile} onOpenAuth={() => setIsAuthOpen(true)} />}
      </main>

      {/* Banners float above mini player + navigation */}
      <div className="fixed left-0 right-0 z-[45] bottom-banners max-w-xl mx-auto pointer-events-none">
        <Toaster />
        <div className="pointer-events-auto">
          <OfflineBanner />
          <PlaybackErrorBanner />
          <UpdateBanner status={updateStatus} onClose={() => setUpdateStatus(null)} onStatus={setUpdateStatus} />
        </div>
      </div>

      {/* Mini Player */}
      <MiniPlayer />

      {/* 3-Tab Bottom Navigation (1:1 YTM) */}
      <Navigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Fullscreen Now Playing Modal (1:1 YTM + 550 Upgrades) */}
      <NowPlayingModal />

      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <WhatsNew />

      {/* Google Account Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        userProfile={userProfile}
        onProfileUpdate={setUserProfile}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
};

export default App;
