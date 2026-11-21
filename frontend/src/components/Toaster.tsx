import React from 'react';
import { useToasts } from '../services/ui';

/** Short confirmations ("Zur Warteschlange hinzugefügt") above the mini player. */
export const Toaster: React.FC = () => {
  const list = useToasts();
  if (!list.length) return null;
  return (
    <div className="flex flex-col items-center gap-1.5 px-3 mb-2 pointer-events-none">
      {list.map((t) => (
        <div
          key={t.id}
          className={`max-w-full rounded-full px-4 py-2 text-xs font-semibold shadow-lg animate-in fade-in ${
            t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-white text-black'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
};
