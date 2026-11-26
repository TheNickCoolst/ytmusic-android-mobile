import React from 'react';
import { User, Settings } from 'lucide-react';
import { UserProfile } from '../services/api';
import { tap } from '../services/ui';

interface HeaderProps {
  userProfile: UserProfile;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  activeFilter: string | null;
  onSelectFilter: (filter: string) => void;
  chips?: string[] | null;
  /** mood chips belong to the start page; hidden on the other tabs and in the search */
  showChips?: boolean;
}

const defaultChips = ['Energieschub', 'Entspannung', 'Workout', 'Unterwegs', 'Fokus', 'Party'];

const iconBtn =
  'w-11 h-11 rounded-full flex items-center justify-center text-zinc-200 hover:bg-white/10 active:bg-white/15 press';

export const Header: React.FC<HeaderProps> = ({
  userProfile,
  onOpenAuth,
  onOpenSettings,
  activeFilter,
  onSelectFilter,
  chips: liveChips,
  showChips = true,
}) => {
  // real YouTube Music mood chips once the start page is loaded
  const chips = liveChips && liveChips.length ? liveChips : defaultChips;

  return (
    <div className="sticky top-0 z-30 glass select-none">
      <div className="flex items-center justify-between pl-4 pr-2 pb-1" style={{ paddingTop: 'calc(var(--sat) + 0.5rem)' }}>
        {/* Brand */}
        <div className="flex items-center">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/30">
            <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-white ml-0.5" />
          </div>
          <span className="ml-2 font-bold text-[1.25rem] tracking-tight text-white font-sans">Music</span>
          <span className="ml-1.5 text-[0.5625rem] font-bold tracking-wide text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md">
            550 PRO
          </span>
        </div>

        <div className="flex items-center">
          <button className={iconBtn} title="Einstellungen" aria-label="Einstellungen" onClick={onOpenSettings}>
            <Settings className="w-[1.375rem] h-[1.375rem]" />
          </button>
          <button
            onClick={onOpenAuth}
            className="relative w-11 h-11 flex items-center justify-center press"
            aria-label={userProfile.isLoggedIn ? `Konto: ${userProfile.name}` : 'Google-Konto'}
            title={userProfile.isLoggedIn ? userProfile.name : 'Google-Konto'}
          >
            {userProfile.isLoggedIn && userProfile.avatar ? (
              <img
                src={userProfile.avatar}
                alt=""
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-zinc-300">
                <User className="w-[1.125rem] h-[1.125rem]" />
              </div>
            )}
            {userProfile.isLoggedIn && (
              <span className="absolute bottom-2 right-1.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#121214]" />
            )}
          </button>
        </div>
      </div>

      {/* Mood / activity chips */}
      {showChips && (
        <div className="shelf space-x-2 px-4 pt-1 pb-3 scrollbar-none">
          {chips.map((chip) => {
            const isSelected = activeFilter === chip;
            return (
              <button
                key={chip}
                onClick={() => {
                  tap();
                  onSelectFilter(chip);
                }}
                className={`h-9 px-4 rounded-full text-[0.8125rem] whitespace-nowrap press ${
                  isSelected
                    ? 'bg-white text-black font-semibold'
                    : 'bg-white/[0.08] text-zinc-200 font-medium hover:bg-white/[0.12]'
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
