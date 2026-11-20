import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

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
