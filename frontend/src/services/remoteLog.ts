// Sends the app's console output (log/info/warn/error), uncaught errors and rejected promises
// to the log server on Railway. Secrets are scrubbed on the device before anything leaves it.
import { Capacitor } from '@capacitor/core';

const LOG_URL = 'https://logs-production-0aaa9aa2.up.railway.app/logs';
const INGEST_KEY = 'e3cea9e1820dfbb33bdd63e5001f06b1';
const PENDING_KEY = 'ytmusic_log_pending';
const DEVICE_KEY = 'ytmusic_log_device';
const MAX_BUFFER = 500;

type Entry = { t: string; level: string; msg: string };
let buffer: Entry[] = [];
let sending = false;

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
  if (buffer.length >= 50) void flush();
};

const savePending = () => {
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
        build: String(typeof __WEB_BUILD__ !== 'undefined' ? __WEB_BUILD__ : 0),
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

  push('info', [`App start build ${typeof __WEB_BUILD__ !== 'undefined' ? __WEB_BUILD__ : 0}`]);
  setInterval(() => void flush(), 20000);
  setTimeout(() => void flush(), 5000);
};
