import React from 'react';
import { User, ShieldCheck, Download, Smartphone } from 'lucide-react';
import { UserProfile } from '../services/api';

interface HeaderProps {
  userProfile: UserProfile;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ userProfile, onOpenAuth }) => {
  return (
    <header className="sticky top-0 z-30 bg-[#030303]/90 backdrop-blur-md px-4 py-3 border-b border-white/5 flex items-center justify-between">
      {/* Brand Logo */}
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center shadow-lg shadow-red-600/30">
          <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-white ml-0.5"></div>
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="font-black text-xl tracking-tight text-white">Music</span>
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/30">
            Ad-Free
          </span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center space-x-2">
        {/* Android APK Download button */}
        <a
          href="/api/download-apk"
          download="ytmusic-mobile.apk"
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-semibold text-emerald-400 transition active:scale-95"
          title="Android APK herunterladen"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>APK</span>
        </a>

        {/* User Account / Login Button */}
        <button
          onClick={onOpenAuth}
          className="flex items-center space-x-2 pl-2 pr-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 transition border border-white/10 active:scale-95"
          title={userProfile.isLoggedIn ? userProfile.name : "Google Account verbinden"}
        >
          {userProfile.isLoggedIn && userProfile.avatar ? (
            <img
              src={userProfile.avatar}
              alt={userProfile.name}
              className="w-6 h-6 rounded-full object-cover border border-red-500"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-red-600/30 flex items-center justify-center text-red-400">
              <User className="w-3.5 h-3.5" />
            </div>
          )}
          <span className="text-xs font-medium text-white max-w-[100px] truncate">
            {userProfile.isLoggedIn ? userProfile.name.split(' ')[0] : 'Anmelden'}
          </span>
        </button>
      </div>
    </header>
  );
};
