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

const PlaybackErrorBanner: React.FC = () => {
  const { playbackError, clearPlaybackError } = usePlayer();
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

const AppContent: React.FC = () => {
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

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [activeMoodFilter, setActiveMoodFilter] = useState<string | null>(null);
  const [moodChips, setMoodChips] = useState<string[] | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
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
    setActiveTab(tab);
    setIsSearchOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#030303] text-white overflow-hidden select-none font-sans">
      {/* 1:1 Standard YouTube Music Header */}
      <Header
        userProfile={userProfile}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        activeFilter={activeMoodFilter}
        onSelectFilter={handleSelectFilter}
        chips={moodChips}
      />

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
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
            <SearchView />
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
        <div className="pointer-events-auto">
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
