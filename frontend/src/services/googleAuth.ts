import { registerPlugin, Capacitor } from '@capacitor/core';

export interface GoogleAuthPluginInterface {
  signIn(): Promise<{ status: string; cookie: string }>;
  signOut(): Promise<{ status: string }>;
}

const NativeGoogleAuth = registerPlugin<GoogleAuthPluginInterface>('GoogleAuth');

export const googleAuthService = {
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  },

  async signIn(): Promise<{ status: string; cookie: string }> {
    if (Capacitor.isNativePlatform()) {
      return await NativeGoogleAuth.signIn();
    } else {
      // In web browser: open Google login in a popup window
      const loginUrl =
        'https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fmusic.youtube.com%2F';
      window.open(loginUrl, '_blank', 'width=500,height=650');
      throw new Error(
        'Im Browser geöffnet! In der Android-App (APK) funktioniert der Google-Login vollautomatisch mit 1 Klick. Im Desktop-Browser bitte das Cookie unten einfügen.'
      );
    }
  },

  async signOut(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeGoogleAuth.signOut();
      } catch (e) {
        console.warn('Native signOut error:', e);
      }
    }
  }
};
