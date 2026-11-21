// iPhone: play a YouTube song while it is still downloading.
// iOS WebKit won't play a googlevideo URL in <audio>, so the file is fetched via native HTTP
// in 512 KB range chunks (4 in parallel, in order) and appended to a (Managed)MediaSource.
// Playback starts after the first chunk; the rest keeps downloading in the background.
import { getDirectAudioUrl } from './youtube';

const CHUNK = 512 * 1024;
const AHEAD = 4;

const MSE = (): any => (window as any).ManagedMediaSource || (window as any).MediaSource;

export const canStreamIos = (): boolean => {
  const M = MSE();
  return !!M && !!M.isTypeSupported?.('audio/mp4; codecs="mp4a.40.2"');
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const iosStreamUrl = async (id: string): Promise<string> => {
  const M = MSE();
  if (!M) throw new Error('MediaSource fehlt');
  const url = await getDirectAudioUrl(id);
  const u = new URL(url);
  const clen = parseInt(u.searchParams.get('clen') || '0', 10);
  const dur = parseFloat(u.searchParams.get('dur') || '0');
  const type = u.searchParams.get('itag') === '251' ? 'audio/webm; codecs="opus"' : 'audio/mp4; codecs="mp4a.40.2"';
  if (!clen || !M.isTypeSupported(type)) throw new Error(`Streaming nicht möglich (${type})`);
  const { fetchBytes } = await import('./dj');

  const ranges: [number, number][] = [];
  for (let s = 0; s < clen; s += CHUNK) ranges.push([s, Math.min(clen, s + CHUNK) - 1]);
  const chunk = async (i: number): Promise<Uint8Array> => {
    const [s, e] = ranges[i];
    try {
      return await fetchBytes(`${url}&range=${s}-${e}`);
    } catch {
      await wait(500);
      return await fetchBytes(`${url}&range=${s}-${e}`);
    }
  };

  const ms = new M();
  const objUrl = URL.createObjectURL(ms);
  let closed = false;
  ms.addEventListener(
    'sourceclose',
    () => {
      closed = true; // song skipped / element reused -> stop downloading
      URL.revokeObjectURL(objUrl);
    },
    { once: true }
  );

  const pump = async () => {
    const sb = ms.addSourceBuffer(type);
    const append = (b: Uint8Array) =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          sb.removeEventListener('updateend', done);
          sb.removeEventListener('error', fail);
          resolve();
        };
        const fail = () => {
          sb.removeEventListener('updateend', done);
          sb.removeEventListener('error', fail);
          reject(new Error('appendBuffer failed'));
        };
        sb.addEventListener('updateend', done);
        sb.addEventListener('error', fail);
        sb.appendBuffer(b);
      });

    const pending: (Promise<Uint8Array> | undefined)[] = new Array(ranges.length);
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i; j < Math.min(ranges.length, i + AHEAD); j++) {
        if (!pending[j]) {
          const p = chunk(j);
          p.catch(() => {}); // awaited below; avoid unhandled rejection noise
          pending[j] = p;
        }
      }
      const bytes = await pending[i]!;
      pending[i] = undefined;
      if (closed) return;
      // buffer full (very long tracks): wait until the browser frees played data
      for (let tries = 0; ; tries++) {
        try {
          await append(bytes);
          break;
        } catch (e: any) {
          if (closed) return;
          if (e?.name !== 'QuotaExceededError' || tries > 120) throw e;
          await wait(1000);
        }
      }
      if (i === 0 && dur > 0) {
        try {
          ms.duration = dur;
        } catch {
          /* ignore */
        }
      }
    }
    if (!closed && ms.readyState === 'open') ms.endOfStream();
  };

  ms.addEventListener(
    'sourceopen',
    () => {
      pump().catch((e) => {
        if (closed) return;
        console.warn('iOS stream failed', e);
        try {
          if (ms.readyState === 'open') ms.endOfStream('network'); // -> audio error -> player retries
        } catch {
          /* ignore */
        }
      });
    },
    { once: true }
  );
  return objUrl;
};
