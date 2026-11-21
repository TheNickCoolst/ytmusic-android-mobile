import React from 'react';
import { User, Search, Settings, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../services/api';

interface HeaderProps {
  userProfile: UserProfile;
  onOpenAuth: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  activeFilter: string | null;
  onSelectFilter: (filter: string) => void;
  chips?: string[] | null;
}

export const Header: React.FC<HeaderProps> = ({
  userProfile,
  onOpenAuth,
  onOpenSearch,
  onOpenSettings,
  activeFilter,
  onSelectFilter,
  chips: liveChips,
}) => {
  const defaultChips = [
    'Energieschub',
    'Entspannung',
    'Workout',
    'Unterwegs',
    'Fokus',
    'Party',
  ];
  // real YouTube Music mood chips once the start page is loaded
  const chips = liveChips && liveChips.length ? liveChips : defaultChips;

  return (
    <div className="sticky top-0 z-30 bg-[#030303]/95 backdrop-blur-xl border-b border-white/5 select-none">
      {/* Top Main Bar */}
      <div className="flex items-center justify-between px-4 pt-[calc(var(--sat)+12px)] pb-2">
        {/* Brand: YouTube Music 1:1 Logo */}
        <div className="flex items-center space-x-1.5 cursor-pointer">
          <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center shadow-md shadow-red-600/40">
            <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[7px] border-l-white ml-0.5"></div>
          </div>
          <span className="font-bold text-lg tracking-tight text-white font-sans">
            Music
          </span>
          <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1 py-0.2 rounded border border-red-500/20 ml-0.5">
            550 PRO
          </span>
        </div>

        {/* Action icons right */}
        <div className="flex items-center space-x-3 text-white">
          {/* Cast button */}
          <button
            className="p-1.5 text-zinc-300 hover:text-white active:scale-90 transition"
            title="Einstellungen"
            aria-label="Einstellungen"
            onClick={onOpenSettings}
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Search magnifying glass */}
          <button
            onClick={onOpenSearch}
            aria-label="Suchen"
            className="p-1.5 text-zinc-300 hover:text-white active:scale-90 transition"
            title="Suchen"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* User Avatar Circle */}
          <button
            onClick={onOpenAuth}
            className="relative flex items-center justify-center active:scale-90 transition ml-0.5"
            title={userProfile.isLoggedIn ? userProfile.name : "Google Account"}
          >
            {userProfile.isLoggedIn && userProfile.avatar ? (
              <img
                src={userProfile.avatar}
                alt={userProfile.name}
                className="w-7 h-7 rounded-full object-cover border border-emerald-400"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-800 border border-white/20 flex items-center justify-center text-zinc-300">
                <User className="w-4 h-4" />
              </div>
            )}
            {userProfile.isLoggedIn && (
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-[#030303]" />
            )}
          </button>
        </div>
      </div>

      {/* Horizontally scrolling Mood / Activity Chips (1:1 YTM) */}
      <div className="flex items-center space-x-2 px-4 pb-2.5 overflow-x-auto scrollbar-none">
        {chips.map((chip) => {
          const isSelected = activeFilter === chip;
          return (
            <button
              key={chip}
              onClick={() => onSelectFilter(chip)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                isSelected
                  ? 'bg-white text-black font-semibold shadow-md'
                  : 'bg-[#212121] text-zinc-200 hover:bg-[#2e2e2e] border border-white/5'
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
};
