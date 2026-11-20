// Bridge to the native "now playing" notification / media session (Android APK only).
import { registerPlugin, Capacitor, PluginListenerHandle } from '@capacitor/core';

export type MediaAction = 'play' | 'pause' | 'next' | 'previous' | 'seekto';

interface MediaControlsPlugin {
  update(options: {
    title: string;
    artist: string;
    album?: string;
    artwork?: string;
    isPlaying: boolean;
    position: number;
    duration: number;
    rate: number;
  }): Promise<void>;
  clear(): Promise<void>;
  addListener(
    event: 'action',
    cb: (data: { action: MediaAction; position?: number }) => void
  ): Promise<PluginListenerHandle>;
}

const MediaControls = registerPlugin<MediaControlsPlugin>('MediaControls');
const available = () => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('MediaControls');
  } catch {
    return false;
  }
};

export const mediaControls = {
  update(o: Parameters<MediaControlsPlugin['update']>[0]) {
    if (!available()) return;
    MediaControls.update(o).catch((e) => console.warn('media notification update failed', e));
  },
  clear() {
    if (available()) MediaControls.clear().catch(() => {});
  },
  onAction(cb: (action: MediaAction, position?: number) => void): () => void {
    if (!available()) return () => {};
    let handle: PluginListenerHandle | null = null;
    MediaControls.addListener('action', (d) => cb(d.action, d.position)).then((h) => (handle = h));
    return () => {
      handle?.remove();
    };
  },
};
