// Small app-wide UI helpers: toasts, haptic taps, Android back button, online state.
import { useEffect, useRef, useSyncExternalStore } from 'react';

// ---------- toasts ----------
export type Toast = { id: number; text: string; kind: 'info' | 'error' };
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
const emitToasts = () => toastListeners.forEach((l) => l());

export const toast = (text: string, kind: Toast['kind'] = 'info') => {
  const id = Date.now() + Math.random();
  toasts = [...toasts.filter((t) => t.text !== text), { id, text, kind }].slice(-3);
  emitToasts();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emitToasts();
  }, kind === 'error' ? 4500 : 2200);
};

export const useToasts = () =>
  useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts
  );

// ---------- haptics (Android; iOS WebKit ignores vibrate) ----------
export const tap = (ms = 8) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
};

// ---------- back button ----------
// Each open overlay adds a history entry. Android's back button (and browser back) then closes
// the topmost overlay instead of leaving the app.
type BackEntry = { close: () => void };
const backStack: BackEntry[] = [];
let ignorePops = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) {
      ignorePops--;
      return;
    }
    backStack.pop()?.close();
  });
  // Android back button (MainActivity asks this first): true = an overlay was closed
  (window as any).__handleBack = (): boolean => {
    const top = backStack.pop();
    if (!top) return false;
    top.close();
    return true;
  };
}

export const useBackClose = (open: boolean, close: () => void) => {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    let byBack = false;
    const entry: BackEntry = {
      close: () => {
        byBack = true;
        closeRef.current();
      },
    };
    backStack.push(entry);
    try {
      history.pushState({ overlay: backStack.length }, '');
    } catch {
      /* ignore */
    }
    return () => {
      const i = backStack.indexOf(entry);
      if (i >= 0) backStack.splice(i, 1);
      if (!byBack) {
        // closed from the UI: drop our history entry without closing anything else
        ignorePops++;
        history.back();
      }
    };
  }, [open]);
};

// ---------- online state ----------
export const useOnline = () =>
  useSyncExternalStore(
    (l) => {
      window.addEventListener('online', l);
      window.addEventListener('offline', l);
      return () => {
        window.removeEventListener('online', l);
        window.removeEventListener('offline', l);
      };
    },
    () => navigator.onLine
  );

// ---------- share ----------
export const shareTrack = async (t: { id: string; title: string; artist?: string }) => {
  const url = `https://music.youtube.com/watch?v=${t.id}`;
  const text = `${t.title}${t.artist ? ` – ${t.artist}` : ''}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: text, text, url });
      return;
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Link kopiert');
  } catch {
    toast('Teilen nicht möglich', 'error');
  }
};

export const greeting = (d = new Date()) => {
  const h = d.getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Hallo';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
};
