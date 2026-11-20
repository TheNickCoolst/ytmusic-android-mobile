import { registerPlugin, Capacitor } from '@capacitor/core';

export interface GoogleAuthPluginInterface {
  signIn(): Promise<{ status: string; url?: string; cookie?: string }>;
  openSystemBrowser(options?: { url?: string }): Promise<{ status: string; url?: string }>;
  signInEmbedded(): Promise<{ status: string; cookie: string }>;
  signOut(): Promise<{ status: string }>;
}

const NativeGoogleAuth = registerPlugin<GoogleAuthPluginInterface>('GoogleAuth');

export const googleAuthService = {
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  },

  async openSystemBrowser(url?: string): Promise<void> {
    const loginUrl =
      url ||
      'https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fmusic.youtube.com%2F';

    if (Capacitor.isNativePlatform()) {
      await NativeGoogleAuth.openSystemBrowser({ url: loginUrl });
    } else {
      window.open(loginUrl, '_blank');
    }
  },

  /** Google login inside an app window; returns the YouTube Music cookie (APK only). */
  async signInInApp(): Promise<string> {
    const res = await NativeGoogleAuth.signInEmbedded();
    if (!res?.cookie) throw new Error('Keine Anmeldedaten erhalten');
    return res.cookie;
  },

  async signIn(): Promise<{ status: string; url?: string; cookie?: string }> {
    // Opens the user's normal mobile browser directly as requested
    await this.openSystemBrowser();
    return { status: 'browser_opened' };
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
