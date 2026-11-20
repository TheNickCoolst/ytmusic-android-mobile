import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { initRemoteLog } from './services/remoteLog';

// app logs -> log server on Railway (scrubbed of cookies/stream URLs)
try { initRemoteLog(); } catch { /* ignore */ }

// Remove boot splash once React has rendered
const hideSplash = () => {
  try { document.getElementById('boot-splash')?.remove(); } catch { /* ignore */ }
};

// Polyfill for old WebViews (AbortSignal.timeout is Chrome 103+)
try {
  if (typeof AbortSignal !== 'undefined' && !(AbortSignal as any).timeout) {
    (AbortSignal as any).timeout = (ms: number) => {
      const c = new AbortController();
      setTimeout(() => c.abort(), ms);
      return c.signal;
    };
  }
} catch { /* ignore */ }

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
  requestAnimationFrame(hideSplash);
  setTimeout(hideSplash, 300);
} catch (e) {
  (window as any).__bootShow?.('Start-Fehler: ' + (e as Error)?.message);
}
