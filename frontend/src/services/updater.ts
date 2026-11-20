// Self-updating app: the web part (all of the UI + logic) updates itself from GitHub Releases.
// Native changes (new Android/iOS shell) are announced so the user can reinstall.
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const REPO = 'TheNickCoolst/ytmusic-android-mobile';
const LATEST_URL = `https://github.com/${REPO}/releases/download/web-latest/latest.json`;

export interface UpdateInfo {
  version: number; // web build number
  url: string; // zip of the web bundle
  minNative: string; // oldest native shell that can run it
  apk?: string;
  ipa?: string;
  notes?: string;
}

export type UpdateStatus =
  | { type: 'ready'; version: number; bundleId: string; notes?: string }
  | { type: 'native'; info: UpdateInfo };

export const currentWebBuild = (): number => (typeof __WEB_BUILD__ === 'number' ? __WEB_BUILD__ : 0);

const cmpVersion = (a: string, b: string): number => {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
};

const available = () => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CapacitorUpdater');
  } catch {
    return false;
  }
};

let checking = false;
let preparedVersion = 0;

export const checkForUpdate = async (onStatus: (s: UpdateStatus) => void): Promise<void> => {
  if (!available() || checking) return;
  checking = true;
  try {
    const res = await CapacitorHttp.get({
      url: `${LATEST_URL}?t=${Date.now()}`,
      responseType: 'text',
      connectTimeout: 10000,
      readTimeout: 15000,
    });
    if (res.status !== 200) return;
    const info: UpdateInfo = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    if (!info?.version || info.version <= currentWebBuild() || info.version <= preparedVersion) return;

    const native = (await CapacitorUpdater.getBuiltinVersion()).version || '0';
    if (info.minNative && cmpVersion(native, info.minNative) < 0) {
      onStatus({ type: 'native', info });
      return;
    }
    const bundle = await CapacitorUpdater.download({ url: info.url, version: String(info.version) });
    // becomes active on the next app start (or right away via applyUpdate)
    await CapacitorUpdater.next({ id: bundle.id });
    preparedVersion = info.version;
    onStatus({ type: 'ready', version: info.version, bundleId: bundle.id, notes: info.notes });
  } catch (e) {
    console.warn('update check failed', e);
  } finally {
    checking = false;
  }
};

/** Switch to the downloaded version now (reloads the app UI). */
export const applyUpdate = async (bundleId: string) => {
  await CapacitorUpdater.set({ id: bundleId });
};

/** Must run on every start: confirms the running bundle works (otherwise the plugin rolls back). */
export const initUpdater = (onStatus: (s: UpdateStatus) => void): (() => void) => {
  if (!available()) return () => {};
  CapacitorUpdater.notifyAppReady().catch(() => {});
  const first = setTimeout(() => checkForUpdate(onStatus), 8000);
  const every = setInterval(() => checkForUpdate(onStatus), 6 * 60 * 60 * 1000);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
};
