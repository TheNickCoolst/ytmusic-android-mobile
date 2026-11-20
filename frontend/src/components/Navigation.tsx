import React from 'react';
import { Home, Compass, Library, Search } from 'lucide-react';

export type NavTab = 'home' | 'explore' | 'search' | 'library';

interface NavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'home' as NavTab, label: 'Start', icon: Home },
    { id: 'explore' as NavTab, label: 'Entdecken', icon: Compass },
    { id: 'search' as NavTab, label: 'Suche', icon: Search },
    { id: 'library' as NavTab, label: 'Mediathek', icon: Library },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#070707]/95 backdrop-blur-lg border-t border-white/5 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
      <div className="max-w-md mx-auto grid grid-cols-4 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1 transition-all ${
                isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              } active:scale-90`}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110 text-white' : ''}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full"></span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium tracking-tight ${isActive ? 'text-white font-semibold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
