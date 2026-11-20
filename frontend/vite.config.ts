import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './', // CRITICAL for Android Capacitor & relative asset resolution
  plugins: [react()],
  build: {
    target: ['es2019', 'chrome70', 'safari12'], // old Android WebViews
    cssTarget: 'chrome70',
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
