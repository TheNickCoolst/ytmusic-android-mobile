import React from 'react';
import { X, Settings as SettingsIcon } from 'lucide-react';
import { useSettings, updateSettings, AppSettings } from '../services/settings';
import { currentWebBuild } from '../services/updater';
import { CHANGELOG } from '../services/changelog';

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({
  on,
  onChange,
  label,
  hint,
}) => (
  <button
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    className="w-full flex items-center justify-between gap-3 py-3 text-left"
  >
    <span className="min-w-0">
      <span className="block text-sm text-white">{label}</span>
      {hint && <span className="block text-[11px] text-zinc-400 mt-0.5">{hint}</span>}
    </span>
    <span className={`w-10 h-6 rounded-full p-0.5 flex-shrink-0 transition-colors ${on ? 'bg-red-600' : 'bg-zinc-700'}`}>
      <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
    </span>
  </button>
);

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="py-3">
      <div className="text-sm text-white mb-2">{label}</div>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((o) => (
          <button
            key={String(o.v)}
            onClick={() => onChange(o.v)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 ${
              value === o.v ? 'bg-white text-black' : 'bg-white/10 text-zinc-300'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

export const SettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const s = useSettings();
  if (!open) return null;
  const set = (p: Partial<AppSettings>) => updateSettings(p);
  return (
    <div className="fixed inset-0 z-[60] bg-[#030303] flex flex-col">
      <div className="flex items-center justify-between px-4 pt-[calc(var(--sat)+12px)] pb-3 border-b border-white/5">
        <h2 className="text-lg font-black text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-red-500" /> Einstellungen
        </h2>
        <button onClick={onClose} aria-label="Schließen" className="p-2 text-zinc-300">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10 divide-y divide-white/5">
        <section>
          <h3 className="pt-4 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Wiedergabe</h3>
          <Toggle
            label="Lautstärke angleichen"
            hint="Laute Songs werden auf YouTubes Referenz-Lautstärke gesenkt"
            on={s.normalize}
            onChange={(v) => set({ normalize: v })}
          />
          <Choice
            label="Sprungweite (−/+ im Player)"
            value={s.seekStep}
            options={[
              { v: 10, l: '10 s' },
              { v: 15, l: '15 s' },
              { v: 30, l: '30 s' },
            ]}
            onChange={(v) => set({ seekStep: v as AppSettings['seekStep'] })}
          />
        </section>
        <section>
          <h3 className="pt-4 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Downloads</h3>
          <Toggle
            label="Nur im WLAN herunterladen"
            hint="Gilt für „Für Offline laden“ (Android erkennt das Netz)"
            on={s.wifiOnlyDownloads}
            onChange={(v) => set({ wifiOnlyDownloads: v })}
          />
          <Choice
            label="Speicherlimit für Offline-Songs"
            value={s.offlineLimitMB}
            options={[
              { v: 0, l: 'Kein Limit' },
              { v: 500, l: '500 MB' },
              { v: 1000, l: '1 GB' },
              { v: 2000, l: '2 GB' },
              { v: 5000, l: '5 GB' },
            ]}
            onChange={(v) => set({ offlineLimitMB: v })}
          />
          <p className="text-[11px] text-zinc-500 -mt-1 pb-3">Wird es voll, fliegen die ältesten Offline-Songs raus.</p>
        </section>
        <section>
          <h3 className="pt-4 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Darstellung</h3>
          <Choice
            label="Schriftgröße"
            value={s.fontScale}
            options={[
              { v: 'small', l: 'Klein' },
              { v: 'normal', l: 'Normal' },
              { v: 'large', l: 'Groß' },
            ]}
            onChange={(v) => set({ fontScale: v })}
          />
          <Toggle
            label="Akku-Sparmodus"
            hint="Keine Animationen und Unschärfe-Effekte"
            on={s.reduceMotion}
            onChange={(v) => set({ reduceMotion: v })}
          />
          <Toggle
            label="Saison-Playlists auf der Startseite"
            hint="Weihnachten, Silvester, Sommer, Halloween …"
            on={s.seasonalPlaylists}
            onChange={(v) => set({ seasonalPlaylists: v })}
          />
        </section>
        <section className="pb-4">
          <h3 className="pt-4 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Was ist neu</h3>
          <ul className="mt-2 space-y-1.5 text-xs text-zinc-300 list-disc pl-4">
            {CHANGELOG.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-zinc-500">Version {currentWebBuild()}</p>
        </section>
      </div>
    </div>
  );
};
