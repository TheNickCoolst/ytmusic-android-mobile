// On-device offline songs (no Mac server needed): audio blobs live in IndexedDB,
// the small metadata list in localStorage so "is downloaded?" checks stay synchronous.
const DB_NAME = 'ytmusic-offline';
const STORE = 'audio';
const META_KEY = 'ytmusic_offline_meta';

export interface OfflineMeta {
  id: string;
  title?: string;
  artist?: string;
  thumbnail?: string;
  duration?: string;
  size: number;
  mime: string;
  savedAt: number;
}

let meta: Record<string, OfflineMeta> = {};
try {
  meta = JSON.parse(localStorage.getItem(META_KEY) || '{}') || {};
} catch {
  meta = {};
}
const saveMeta = () => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
};

let dbPromise: Promise<IDBDatabase> | null = null;
const db = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
};

const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r.result as T);
    t.onerror = () => reject(t.error || r.error);
    t.onabort = () => reject(t.error || new Error('aborted'));
  });
};

export const isOffline = (id: string): boolean => !!meta[id];

const objectUrls = new Map<string, string>();

/** blob: URL of a downloaded song, or null when it is not stored (or the blob went missing). */
export const getOfflineUrl = async (id: string): Promise<string | null> => {
  if (!meta[id]) return null;
  const known = objectUrls.get(id);
  if (known) return known;
  try {
    const blob = await tx<Blob | undefined>('readonly', (s) => s.get(id));
    if (!blob) {
      delete meta[id];
      saveMeta();
      return null;
    }
    const url = URL.createObjectURL(blob);
    objectUrls.set(id, url);
    return url;
  } catch (e) {
    console.warn('offline read failed', e);
    return null;
  }
};

export const getOfflineBytes = async (id: string): Promise<{ bytes: Uint8Array; mime: string } | null> => {
  if (!meta[id]) return null;
  try {
    const blob = await tx<Blob | undefined>('readonly', (s) => s.get(id));
    return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || meta[id].mime } : null;
  } catch {
    return null;
  }
};

const inflight = new Map<string, Promise<void>>();

export const downloadOffline = (id: string, info: Partial<OfflineMeta> = {}): Promise<void> => {
  if (meta[id]) return Promise.resolve();
  const running = inflight.get(id);
  if (running) return running;
  const p = (async () => {
    const { downloadAudio } = await import('./dj');
    const { bytes, mime } = await downloadAudio(id, true);
    if (bytes.length < 10_000) throw new Error('Audiodatei unvollständig');
    const type = mime.split(';')[0] || 'audio/mp4';
    await tx('readwrite', (s) => s.put(new Blob([bytes], { type }), id));
    meta[id] = {
      id,
      title: info.title,
      artist: info.artist,
      thumbnail: info.thumbnail,
      duration: info.duration,
      size: bytes.length,
      mime: type,
      savedAt: Date.now(),
    };
    saveMeta();
    console.info(`Offline gespeichert: ${id} (${(bytes.length / 1048576).toFixed(1)} MB)`);
  })().finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
};

export const deleteOffline = async (id: string) => {
  delete meta[id];
  saveMeta();
  const u = objectUrls.get(id);
  if (u) {
    URL.revokeObjectURL(u);
    objectUrls.delete(id);
  }
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
};

const fmtSize = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

export const listOffline = () => {
  const tracks = Object.values(meta)
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((m) => ({ ...m, sizeFormatted: fmtSize(m.size) }));
  const total = tracks.reduce((n, t) => n + t.size, 0);
  return { totalSizeMB: fmtSize(total), count: tracks.length, tracks };
};
