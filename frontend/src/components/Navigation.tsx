import React from 'react';
import { Home, Search, Library } from 'lucide-react';
import { tap } from '../services/ui';

export type NavTab = 'home' | 'search' | 'library';

interface NavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const tabs = [
  { id: 'home' as NavTab, label: 'Start', icon: Home },
  { id: 'search' as NavTab, label: 'Suche', icon: Search },
  { id: 'library' as NavTab, label: 'Mediathek', icon: Library },
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => (
  <nav
    className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-white/[0.06] select-none"
    style={{ paddingBottom: 'var(--nav-pad)' }}
  >
    <div className="max-w-md mx-auto grid grid-cols-3 px-4" style={{ height: 'var(--nav-h)' }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              tap();
              onTabChange(tab.id);
            }}
            aria-current={isActive ? 'page' : undefined}
            className={`group flex flex-col items-center justify-center ${
              isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {/* Material-3 style pill behind the active icon */}
            <span
              className={`flex items-center justify-center w-16 h-8 rounded-full transition-all duration-300 group-active:scale-90 ${
                isActive ? 'bg-white/[0.14]' : 'bg-transparent'
              }`}
            >
              <Icon className={`w-6 h-6 transition-all ${isActive ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
            </span>
            <span
              className={`text-[0.6875rem] mt-1 tracking-tight transition-colors ${
                isActive ? 'font-semibold' : 'font-medium'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  </nav>
);
