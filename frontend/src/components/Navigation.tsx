import React from 'react';
import { Home, Compass, Library } from 'lucide-react';

export type NavTab = 'home' | 'explore' | 'library';

interface NavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'home' as NavTab, label: 'Start', icon: Home },
    { id: 'explore' as NavTab, label: 'Entdecken', icon: Compass },
    { id: 'library' as NavTab, label: 'Mediathek', icon: Library },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#030303]/98 backdrop-blur-xl border-t border-white/5 pb-[max(var(--sab),10px)] pt-2 select-none">
      <div className="max-w-md mx-auto grid grid-cols-3 px-6">
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
                <Icon
                  className={`w-6 h-6 transition-all ${
                    isActive ? 'scale-110 text-white fill-current' : 'stroke-[1.75]'
                  }`}
                />
              </div>
              <span className={`text-[10px] mt-1 tracking-tight ${isActive ? 'text-white font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
