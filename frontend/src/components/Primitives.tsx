import React from 'react';
import { tap } from '../services/ui';

/** iOS-style toggle with a 44px tall hit area. */
export const Switch: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({
  on,
  onChange,
  label,
}) => (
  <button
    role="switch"
    aria-checked={on}
    aria-label={label}
    title={label}
    onClick={(e) => {
      e.stopPropagation();
      tap();
      onChange(!on);
    }}
    className="flex-shrink-0 h-11 flex items-center"
  >
    <span
      className={`relative block w-12 h-7 rounded-full transition-colors duration-200 ${on ? 'bg-red-600' : 'bg-white/15'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
);

/** Animated "now playing" bars; freeze when paused. */
export const EqBars: React.FC<{ playing: boolean; className?: string }> = ({ playing, className = '' }) => (
  <div className={`flex items-end space-x-[3px] h-4 ${playing ? '' : 'eq-paused'} ${className}`} aria-hidden>
    <span className="eq-bar block w-[3px] h-full rounded-full bg-red-500" />
    <span className="eq-bar block w-[3px] h-full rounded-full bg-red-500" />
    <span className="eq-bar block w-[3px] h-full rounded-full bg-red-500" />
  </div>
);

/** Section heading: small eyebrow line + bold title, optional action on the right. */
export const SectionHeader: React.FC<{ eyebrow?: string; title: React.ReactNode; action?: React.ReactNode }> = ({
  eyebrow,
  title,
  action,
}) => (
  <div className="flex items-end justify-between mb-3">
    <div className="min-w-0 flex-1">
      {eyebrow && (
        <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-zinc-500 mb-0.5 truncate">
          {eyebrow}
        </div>
      )}
      <h2 className="text-[1.375rem] leading-tight font-bold text-white tracking-tight truncate">{title}</h2>
    </div>
    {action && <div className="ml-3 flex-shrink-0">{action}</div>}
  </div>
);

/** Page title for the tab roots (Entdecken, Mediathek). */
export const PageTitle: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({
  title,
  subtitle,
  action,
}) => (
  <div className="flex items-end justify-between pt-1">
    <div className="min-w-0">
      <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight text-white">{title}</h1>
      {subtitle && <p className="text-[0.8125rem] text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

/** Friendly empty list: icon, one line of title, one line of help, optional button. */
export const EmptyState: React.FC<{
  icon: React.ElementType;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}> = ({ icon: Icon, title, hint, action }) => (
  <div className="flex flex-col items-center text-center px-6 py-12">
    <span className="w-16 h-16 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400 mb-4">
      <Icon className="w-7 h-7" />
    </span>
    <div className="text-base font-bold text-white">{title}</div>
    {hint && <p className="text-[0.8125rem] text-zinc-500 mt-1 max-w-xs">{hint}</p>}
    {action && (
      <button
        onClick={action.onClick}
        className="mt-5 h-11 px-6 rounded-full bg-white text-black text-[0.875rem] font-bold press"
      >
        {action.label}
      </button>
    )}
  </div>
);

/** Switch the bottom tab from anywhere (e.g. an empty state's "Musik finden"). */
export const goToTab = (tab: 'home' | 'search' | 'library') => {
  window.dispatchEvent(new CustomEvent('ytm:tab', { detail: tab }));
};
