// Sends the app's console output (log/info/warn/error), uncaught errors and rejected promises
// to the log server on Railway. Secrets are scrubbed on the device before anything leaves it.
// Also reports hangs: a frozen page cannot send anything, so it leaves a heartbeat in
// localStorage, and the next start reports a session that ended without unloading.
import { Capacitor } from '@capacitor/core';

const LOG_URL = 'https://logs-production-0aaa9aa2.up.railway.app/logs';
const INGEST_KEY = 'e3cea9e1820dfbb33bdd63e5001f06b1';
const PENDING_KEY = 'ytmusic_log_pending';
const DEVICE_KEY = 'ytmusic_log_device';
const SESSION_KEY = 'ytmusic_log_session';
const MAX_BUFFER = 500;
const TICK_MS = 1000;
const BLOCKED_MS = 2000; // a tick this late (page visible) = UI was blocked
const LONG_TASK_MS = 500;

type Entry = { t: string; level: string; msg: string };
type Session = { start: number; beat: number; visible: boolean; clean: boolean; build: string; heap?: number };

let buffer: Entry[] = [];
let sending = false;
let pendingDirty = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;

const buildNo = () => String(typeof __WEB_BUILD__ !== 'undefined' ? __WEB_BUILD__ : 0);

/** Used JS heap in MB (Chrome/Android WebView only). */
const heapMB = (): number | undefined => {
  const m = (performance as any).memory;
  return m?.usedJSHeapSize ? Math.round(m.usedJSHeapSize / 1048576) : undefined;
};
const heapText = () => {
  const h = heapMB();
  return h ? `, Speicher ${h} MB` : '';
};

const deviceId = (): string => {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
};

/** Remove cookies, auth hashes, stream URLs (they contain the IP) and e-mail addresses. */
export const scrub = (s: string): string =>
  s
    .replace(/https?:\/\/[^\s"']*googlevideo\.com[^\s"']*/g, '[stream-url]')
    .replace(/\b(SAPISID|APISID|HSID|SSID|SID|SIDCC|LOGIN_INFO|__Secure-[\w-]+)=[^;\s"']+/g, '$1=[redacted]')
    .replace(/SAPISIDHASH\s+\S+/g, 'SAPISIDHASH [redacted]')
    .replace(/([?&](?:ip|key|token|sig|signature)=)[^&\s"']+/gi, '$1[redacted]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');

const fmt = (a: unknown): string => {
  if (a instanceof Error) return `${a.name}: ${a.message}${a.stack ? '\n' + a.stack.split('\n').slice(0, 6).join('\n') : ''}`;
  if (typeof a === 'string') return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
};

const push = (level: string, args: unknown[]) => {
  const msg = scrub(args.map(fmt).join(' ')).slice(0, 4000);
  buffer.push({ t: new Date().toISOString(), level, msg });
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
  pendingDirty = true;
  if (buffer.length >= 50) void flush();
  else if ((level === 'error' || level === 'warn') && !flushTimer) {
    // send problems soon: the app may be about to hang or crash
    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      void flush();
    }, 2000);
  }
};

const savePending = () => {
  pendingDirty = false;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(buffer.slice(-MAX_BUFFER)));
  } catch {
    /* storage full / unavailable */
  }
};

export const flush = async () => {
  if (sending || buffer.length === 0) return;
  sending = true;
  const batch = buffer.slice(0, 300);
  try {
    const res = await fetch(LOG_URL, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Log-Key': INGEST_KEY },
      body: JSON.stringify({
        device: deviceId(),
        platform: Capacitor.getPlatform(),
        build: buildNo(),
        version: navigator.userAgent.match(/(iPhone OS|Android) [\d_.]+/)?.[0] || '',
        entries: batch,
      }),
    });
    if (res.ok) {
      buffer = buffer.slice(batch.length);
      savePending();
    }
  } catch {
    /* offline: keep the buffer, retry later (never log here -> no loop) */
  } finally {
    sending = false;
  }
};

// --- hang / crash detection ---------------------------------------------------------------

let session: Session = { start: Date.now(), beat: Date.now(), visible: true, clean: false, build: '0' };

const saveSession = () => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
};

/** Report how the previous page session ended if it did not unload normally. */
const reportLastSession = () => {
  try {
    const prev = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null;
    if (!prev || prev.clean || !prev.beat) return;
    const ago = Math.round((Date.now() - prev.beat) / 1000);
    const ran = Math.round((prev.beat - prev.start) / 1000);
    const heap = prev.heap ? `, Speicher ${prev.heap} MB` : '';
    const at = new Date(prev.beat).toISOString();
    if (prev.visible) {
      push('error', [
        `Vorige Sitzung im Vordergrund abgebrochen (Hänger oder Absturz): letztes Lebenszeichen ${at} (vor ${ago}s), lief ${ran}s, build ${prev.build}${heap}`,
      ]);
    } else {
      push('info', [`Vorige Sitzung im Hintergrund beendet: letztes Lebenszeichen ${at}, lief ${ran}s, build ${prev.build}${heap}`]);
    }
  } catch {
    /* ignore */
  }
};

const watchHangs = () => {
  session = { start: Date.now(), beat: Date.now(), visible: document.visibilityState === 'visible', clean: false, build: buildNo(), heap: heapMB() };
  saveSession();

  let lastTick = Date.now();
  let lastBeat = 0;
  setInterval(() => {
    const now = Date.now();
    const late = now - lastTick - TICK_MS;
    lastTick = now;
    if (late > BLOCKED_MS && document.visibilityState === 'visible') {
      push('warn', [`UI blockiert ~${(late / 1000).toFixed(1)}s${heapText()}`]);
    }
    if (now - lastBeat >= 2000) {
      lastBeat = now;
      session.beat = now;
      session.heap = heapMB();
      saveSession();
      if (pendingDirty) savePending(); // keep the last lines if the page dies before the next send
    }
  }, TICK_MS);

  document.addEventListener('visibilitychange', () => {
    lastTick = Date.now(); // timers pause in the background: not a hang
    session.visible = document.visibilityState === 'visible';
    session.beat = Date.now();
    saveSession();
  });
  window.addEventListener('pagehide', () => {
    session.clean = true;
    saveSession();
    savePending();
  });
  window.addEventListener('pageshow', () => {
    session.clean = false;
    saveSession();
  });

  // Chrome/Android only: individual JS tasks that froze the UI, summed up every 10 s
  try {
    let count = 0;
    let max = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.duration < LONG_TASK_MS) continue;
        count++;
        max = Math.max(max, e.duration);
      }
      if (count && !timer) {
        timer = setTimeout(() => {
          push('warn', [`${count} lange Aufgaben ≥${LONG_TASK_MS} ms (längste ${Math.round(max)} ms)${heapText()}`]);
          count = 0;
          max = 0;
          timer = undefined;
        }, 10000);
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* not supported (iOS) */
  }
};

let started = false;
export const initRemoteLog = () => {
  if (started) return;
  started = true;
  try {
    const old = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    if (Array.isArray(old)) buffer = old.slice(-MAX_BUFFER);
  } catch {
    /* ignore */
  }

  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        push(level, args);
      } catch {
        /* never break the app because of logging */
      }
      orig(...args);
    };
  }
  window.addEventListener('error', (e) => {
    if (e.error || e.message) push('error', ['Uncaught', e.error || e.message, e.filename ? `@${e.filename}:${e.lineno}` : '']);
  });
  window.addEventListener('unhandledrejection', (e) => push('error', ['Unhandled rejection', e.reason]));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      savePending();
      void flush();
    }
  });

  push('info', [`App start build ${buildNo()}`]);
  reportLastSession();
  try {
    watchHangs();
  } catch {
    /* ignore */
  }
  setInterval(() => void flush(), 20000);
  setTimeout(() => void flush(), 5000);
};
