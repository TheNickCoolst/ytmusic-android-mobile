import React, { useState, useEffect, useRef } from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { MiniPlayer } from './components/MiniPlayer';
import { NowPlayingModal } from './components/NowPlayingModal';
import { AuthModal } from './components/AuthModal';
import { HomeView } from './components/HomeView';
import { SearchView } from './components/SearchView';
import { ExploreView } from './components/ExploreView';
import { LibraryView } from './components/LibraryView';
import { api, UserProfile } from './services/api';
import { initUpdater, applyUpdate, UpdateStatus, currentWebBuild, installDownloadedApk } from './services/updater';
import { googleAuthService } from './services/googleAuth';
import { Capacitor } from '@capacitor/core';
import { Toaster } from './components/Toaster';
import { SettingsModal } from './components/SettingsModal';
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
      className="mx-3 mb-2 rounded-xl bg-red-600/90 px-4 py-3 text-sm text-white shadow-lg"
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
      <div className="mx-3 mb-2 rounded-xl bg-blue-600/95 px-4 py-2.5 text-sm text-white shadow-lg flex items-center justify-between gap-3">
        <span className="min-w-0">{text}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {status.phase !== 'downloading' && (
            <button
              onClick={() => installDownloadedApk(status.version, status.url, onStatus)}
              className="rounded-lg bg-white/95 px-2.5 py-1 text-xs font-bold text-blue-700 active:scale-95"
            >
              {status.phase === 'error' ? 'Nochmal' : 'Installieren'}
            </button>
          )}
          <button onClick={onClose} className="text-white/80 px-1" aria-label="Schließen">
            ✕
          </button>
        </div>
      </div>
    );
  }
  if (status.type === 'ready') {
    return (
      <div className="mx-3 mb-2 rounded-xl bg-emerald-600/95 px-4 py-2.5 text-sm text-white shadow-lg flex items-center justify-between gap-3">
        <span className="min-w-0">✨ Update geladen – wird beim nächsten Start aktiv</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              applyUpdate(status.bundleId).catch(() => setBusy(false));
            }}
            className="rounded-lg bg-white/95 px-2.5 py-1 text-xs font-bold text-emerald-700 active:scale-95"
          >
            {busy ? '…' : 'Jetzt'}
          </button>
          <button onClick={onClose} className="text-white/80 px-1" aria-label="Schließen">
            ✕
          </button>
        </div>
      </div>
    );
  }
  const isAndroid = Capacitor.getPlatform() === 'android';
  return (
    <div className="mx-3 mb-2 rounded-xl bg-blue-600/95 px-4 py-2.5 text-sm text-white shadow-lg flex items-center justify-between gap-3">
      <span className="min-w-0">
        📲 Neue App-Version verfügbar{isAndroid ? '' : ' – in SideStore aktualisieren'}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isAndroid && status.info.apk && (
          <button
            onClick={() => googleAuthService.openSystemBrowser(status.info.apk).catch(() => {})}
            className="rounded-lg bg-white/95 px-2.5 py-1 text-xs font-bold text-blue-700 active:scale-95"
          >
            Laden
          </button>
        )}
        <button onClick={onClose} className="text-white/80 px-1" aria-label="Schließen">
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
    <div className="mx-3 mb-2 rounded-xl bg-zinc-800/95 px-4 py-2.5 text-xs text-zinc-200 shadow-lg">
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
  useBackClose(open, () => setOpen(false));
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md bg-[#1c1c1c] border border-white/10 rounded-2xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-black text-white">✨ Was ist neu</h2>
        <ul className="mt-3 space-y-2 text-xs text-zinc-300 list-disc pl-4 max-h-[50vh] overflow-y-auto">
          {CHANGELOG.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button onClick={() => setOpen(false)} className="mt-5 w-full py-2.5 rounded-full bg-white text-black text-sm font-bold active:scale-95">
          Los geht's
        </button>
      </div>
    </div>
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
      const t = localStorage.getItem(TAB_KEY) as NavTab | null;
      return t === 'home' || t === 'explore' || t === 'library' ? t : 'home';
    } catch {
      return 'home';
    }
  });
  const mainRef = useRef<HTMLElement>(null);
  const [activeMoodFilter, setActiveMoodFilter] = useState<string | null>(null);
  const [moodChips, setMoodChips] = useState<string[] | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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
      setIsSearchOpen(false);
    }
  };

  const handleTabChange = (tab: NavTab) => {
    if (tab === activeTab && !isSearchOpen) {
      // tap on the active tab = back to the top
      mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveTab(tab);
    setIsSearchOpen(false);
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
      setIsSearchOpen(true);
    };
    window.addEventListener('ytm:search', onSearch);
    // Android "Teilen" -> this app: a YouTube link (or any text) opens in the search
    const onShared = () => {
      const t = (window as any).__sharedText;
      (window as any).__sharedText = null;
      if (typeof t === 'string' && t.trim()) {
        setSearchSeed({ q: t.trim().slice(0, 300), n: Date.now() });
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('ytm:shared', onShared);
    onShared();
    return () => {
      window.removeEventListener('ytm:search', onSearch);
      window.removeEventListener('ytm:shared', onShared);
    };
  }, []);

  // Android back button closes the open screen instead of leaving the app
  useBackClose(isSearchOpen, () => setIsSearchOpen(false));
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
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeFilter={activeMoodFilter}
        onSelectFilter={handleSelectFilter}
        chips={moodChips}
      />

      {/* Main View Area */}
      <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain">
        {isSearchOpen ? (
          <div className="relative">
            <div className="flex items-center justify-between px-4 pt-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Suche
              </span>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="text-xs text-red-400 font-semibold px-2 py-1"
              >
                Schließen
              </button>
            </div>
            <SearchView key={searchSeed?.n || 0} initialQuery={searchSeed?.q} />
          </div>
        ) : (
          <>
            {activeTab === 'home' && <HomeView
            filterMood={activeMoodFilter}
            onChips={setMoodChips}
            accountKey={userProfile.isLoggedIn ? userProfile.name : 'guest'}
          />}
            {activeTab === 'explore' && <ExploreView />}
            {activeTab === 'library' && (
              <LibraryView
                userProfile={userProfile}
                onOpenAuth={() => setIsAuthOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Banners float above mini player + navigation */}
      <div className="fixed left-0 right-0 z-[45] bottom-[calc(56px+max(var(--sab),8px)+76px)] pointer-events-none">
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
