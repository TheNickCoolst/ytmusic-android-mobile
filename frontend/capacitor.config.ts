import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ytmusic.mobile',
  appName: 'YT Music',
  webDir: 'dist',
  backgroundColor: '#030303',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#030303',
  }
};

export default config;
