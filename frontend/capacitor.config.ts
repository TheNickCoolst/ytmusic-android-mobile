import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ytmusic.mobile',
  appName: 'YT Music',
  webDir: 'dist',
  loggingBehavior: 'none',
  backgroundColor: '#030303',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  plugins: {
    // light status/navigation bar icons on the dark app background
    SystemBars: { style: 'DARK' },
    // Self-updates from GitHub Releases (manual mode, no Capgo cloud, no telemetry)
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: '',
      appReadyTimeout: 15000,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      resetWhenUpdate: true,
    },
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#030303',
  }
};

export default config;
