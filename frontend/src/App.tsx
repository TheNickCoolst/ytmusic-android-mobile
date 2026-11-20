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
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    isLoggedIn: false,
    name: 'Gast'
  });

  useEffect(() => {
    api.getAuthStatus().then(setUserProfile).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-[#030303] text-white overflow-hidden select-none">
      {/* Mobile Header */}
      <Header
        userProfile={userProfile}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Content Scrollable Area */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {activeTab === 'home' && <HomeView />}
        {activeTab === 'explore' && <ExploreView />}
        {activeTab === 'search' && <SearchView />}
        {activeTab === 'library' && (
          <LibraryView
            userProfile={userProfile}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}
      </main>

      {/* Bottom Mini Player */}
      <MiniPlayer />

      {/* Bottom Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Fullscreen Now Playing Modal */}
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
