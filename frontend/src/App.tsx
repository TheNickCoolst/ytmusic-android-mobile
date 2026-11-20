import React, { useState, useEffect } from 'react';
import { PlayerProvider } from './context/PlayerContext';
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

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [activeMoodFilter, setActiveMoodFilter] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    isLoggedIn: false,
    name: 'Gast'
  });

  useEffect(() => {
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
            {activeTab === 'home' && <HomeView filterMood={activeMoodFilter} />}
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
