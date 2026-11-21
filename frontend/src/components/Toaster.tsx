import React from 'react';
import { useToasts, dismissToast } from '../services/ui';

/** Short confirmations ("Zur Warteschlange hinzugefügt") above the mini player. */
export const Toaster: React.FC = () => {
  const list = useToasts();
  if (!list.length) return null;
  return (
    <div className="flex flex-col items-center gap-1.5 px-3 mb-2 pointer-events-none">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`max-w-full rounded-full px-4 py-2 text-xs font-semibold shadow-lg animate-in fade-in flex items-center gap-3 ${
            t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-white text-black'
          }`}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              className="pointer-events-auto font-bold text-red-600 uppercase tracking-wide"
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
