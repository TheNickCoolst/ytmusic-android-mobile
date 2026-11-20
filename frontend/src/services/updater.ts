// Self-updating app: the web part (all of the UI + logic) updates itself from GitHub Releases.
// Native changes (new Android/iOS shell) are announced so the user can reinstall.
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const REPO = 'TheNickCoolst/ytmusic-android-mobile';
const LATEST_URL = `https://github.com/${REPO}/releases/download/web-latest/latest.json`;

export interface UpdateInfo {
  version: number; // web build number
  url: string; // zip of the web bundle
  checksum: string; // SHA-256 of the zip (verified by the plugin)
  minNative: string; // oldest native shell that can run it
  apk?: string;
  ipa?: string;
  notes?: string;
}

export type UpdateStatus =
  | { type: 'ready'; version: number; bundleId: string; notes?: string }
  | { type: 'native'; info: UpdateInfo }
  | {
      type: 'apk';
      version: string;
      url: string;
      phase: 'downloading' | 'installing' | 'permission' | 'error';
      percent?: number;
      error?: string;
    };

// ---------- native Android update (new APK from the latest GitHub release) ----------
interface ApkUpdaterPlugin {
  getInfo(): Promise<{ versionName: string; versionCode: number; canInstall: boolean }>;
  downloadAndInstall(o: { url: string }): Promise<{ status: 'installer_opened' | 'needs_permission' }>;
  install(): Promise<{ status: 'installer_opened' | 'needs_permission' }>;
  addListener(ev: 'progress', cb: (e: { percent: number }) => void): Promise<{ remove: () => Promise<void> }>;
}
const ApkUpdater = registerPlugin<ApkUpdaterPlugin>('ApkUpdater');
const apkHandled = new Set<string>();

/** Android: newer APK on GitHub? Then download it and open the installer automatically. */
export const checkApkUpdate = async (onStatus: (s: UpdateStatus) => void): Promise<boolean> => {
  if (Capacitor.getPlatform() !== 'android') return false;
  try {
    const res = await CapacitorHttp.get({
      url: `https://api.github.com/repos/${REPO}/releases/latest`,
      headers: { Accept: 'application/vnd.github+json' },
      connectTimeout: 10000,
      readTimeout: 15000,
    });
    if (res.status !== 200) return false;
    const rel = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    const version = String(rel?.tag_name || '').replace(/^v/, '');
    const asset = (rel?.assets || []).find((a: any) => typeof a?.name === 'string' && a.name.endsWith('.apk'));
    if (!version || !asset?.browser_download_url) return false;

    if (!Capacitor.isPluginAvailable('ApkUpdater')) {
      // old app shell without the updater: announce it with a download link
      const native = (await CapacitorUpdater.getBuiltinVersion()).version || '0';
      if (cmpVersion(version, native) <= 0) return false;
      onStatus({ type: 'native', info: { apk: asset.browser_download_url } as UpdateInfo });
      return true;
    }
    const info = await ApkUpdater.getInfo();
    if (cmpVersion(version, info.versionName) <= 0 || apkHandled.has(version)) return false;
    apkHandled.add(version);
    void runApkUpdate(asset.browser_download_url, version, onStatus);
    return true;
  } catch (e) {
    console.warn('apk update check failed', e);
    return false;
  }
};

export const runApkUpdate = async (url: string, version: string, onStatus: (s: UpdateStatus) => void) => {
  const base = { type: 'apk' as const, version, url };
  onStatus({ ...base, phase: 'downloading', percent: 0 });
  const sub = await ApkUpdater.addListener('progress', (e) => onStatus({ ...base, phase: 'downloading', percent: e.percent }));
  try {
    const r = await ApkUpdater.downloadAndInstall({ url });
    onStatus({ ...base, phase: r.status === 'needs_permission' ? 'permission' : 'installing' });
  } catch (e: any) {
    console.warn('apk update failed', e);
    onStatus({ ...base, phase: 'error', error: e?.message || String(e) });
  } finally {
    await sub.remove();
  }
};

/** Open the installer again for the downloaded APK (after allowing installs / dismissing it). */
export const installDownloadedApk = async (version: string, url: string, onStatus: (s: UpdateStatus) => void) => {
  try {
    const r = await ApkUpdater.install();
    onStatus({ type: 'apk', version, url, phase: r.status === 'needs_permission' ? 'permission' : 'installing' });
  } catch {
    void runApkUpdate(url, version, onStatus);
  }
};

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
    if (!info?.version || !info.checksum || info.version <= currentWebBuild() || info.version <= preparedVersion) return;

    const native = (await CapacitorUpdater.getBuiltinVersion()).version || '0';
    if (info.minNative && cmpVersion(native, info.minNative) < 0) {
      onStatus({ type: 'native', info });
      return;
    }
    const bundle = await CapacitorUpdater.download({
      url: info.url,
      version: String(info.version),
      checksum: info.checksum,
    });
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
  (async () => {
    try {
      await CapacitorUpdater.notifyAppReady();
      // a newer version was downloaded last time -> switch to it right at app start
      const next = await CapacitorUpdater.getNextBundle();
      const v = next ? parseInt(next.version, 10) : 0;
      if (next && next.id !== 'builtin' && next.status !== 'error' && v > currentWebBuild()) {
        await CapacitorUpdater.set({ id: next.id });
      }
    } catch (e) {
      console.warn('updater init failed', e);
    }
  })();
  // a new APK wins; otherwise check for a web update
  const check = async () => {
    if (!(await checkApkUpdate(onStatus))) await checkForUpdate(onStatus);
  };
  const first = setTimeout(check, 8000);
  const every = setInterval(check, 6 * 60 * 60 * 1000);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
};
