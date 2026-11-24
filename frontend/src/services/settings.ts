// App settings (persisted on the device). Read anywhere with getSettings(), in React with useSettings().
import { useSyncExternalStore } from 'react';

export interface AppSettings {
  normalize: boolean; // turn loud songs down to YouTube's reference loudness
  fontScale: 'small' | 'normal' | 'large';
  reduceMotion: boolean; // battery saver: fewer animations / blur
  wifiOnlyDownloads: boolean;
  offlineLimitMB: number; // 0 = unlimited; oldest offline songs are removed above it
  seekStep: 10 | 15 | 30;
  seasonalPlaylists: boolean;
}

const KEY = 'ytmusic_app_settings';
const DEFAULTS: AppSettings = {
  normalize: true,
  fontScale: 'normal',
  reduceMotion: false,
  wifiOnlyDownloads: false,
  offlineLimitMB: 0,
  seekStep: 10,
  seasonalPlaylists: true,
};

let current: AppSettings = (() => {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') || {}) };
  } catch {
    return { ...DEFAULTS };
  }
})();
const listeners = new Set<() => void>();

const apply = () => {
  const root = document.documentElement;
  root.style.fontSize = current.fontScale === 'small' ? '14px' : current.fontScale === 'large' ? '18px' : '16px';
  root.classList.toggle('reduce-motion', current.reduceMotion);
};
if (typeof document !== 'undefined') apply();

export const getSettings = () => current;

export const updateSettings = (patch: Partial<AppSettings>) => {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  apply();
  listeners.forEach((l) => l());
};

export const useSettings = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current
  );

/** Wi-Fi check for "Downloads nur im WLAN" (Android WebView knows the type; iOS doesn't -> allowed). */
export const onCellular = (): boolean => {
  const c = (navigator as any).connection;
  return !!c && (c.type === 'cellular' || (c.type === undefined && c.saveData === true));
};
