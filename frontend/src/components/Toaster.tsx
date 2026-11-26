import React from 'react';
import { useToasts, dismissToast } from '../services/ui';

/** Short confirmations ("Zur Warteschlange hinzugefügt") above the mini player. */
export const Toaster: React.FC = () => {
  const list = useToasts();
  if (!list.length) return null;
  return (
    <div className="flex flex-col items-center space-y-1.5 px-3 mb-2 pointer-events-none">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`max-w-full min-h-[2.75rem] rounded-2xl py-2 text-[0.8125rem] font-medium shadow-float animate-in fade-in slide-in-from-bottom-4 flex items-center ${
            t.action ? 'pl-4 pr-2' : 'px-4'
          } ${
            t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-[#f2f2f3] text-zinc-900'
          }`}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              className={`pointer-events-auto ml-3 h-8 px-3 rounded-full text-xs font-bold uppercase tracking-wide press ${
                t.kind === 'error' ? 'bg-white/20 text-white' : 'bg-black/[0.06] text-red-600'
              }`}
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
