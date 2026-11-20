import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { execSync } from 'node:child_process';

// Monotonic web build number (= commit count). CI passes WEB_BUILD; the app compares it for self-updates.
const webBuild = (() => {
  if (process.env.WEB_BUILD) return parseInt(process.env.WEB_BUILD, 10);
  try {
    return parseInt(execSync('git rev-list --count HEAD').toString().trim(), 10) || 0;
  } catch {
    return 0;
  }
})();

function removeCrossoriginPlugin(): Plugin {
  return {
    name: 'remove-crossorigin',
    enforce: 'post',
    transformIndexHtml(html: string) {
      return html
        .replace(/\s+crossorigin(?:="[^"]*")?/gi, '')
        .replace(/<link rel="modulepreload"[^>]*>/gi, '');
    }
  };
}

export default defineConfig({
  base: './', // CRITICAL for Android Capacitor & relative asset resolution
  define: {
    __WEB_BUILD__: JSON.stringify(webBuild),
  },
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'Android >= 7', 'Chrome >= 60'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderModernChunks: true,
    }),
    removeCrossoriginPlugin(),
  ],
  build: {
    target: ['es2019', 'chrome70', 'safari12'], // old Android WebViews
    cssTarget: 'chrome70',
    modulePreload: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
