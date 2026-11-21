// DJ mode: beat/energy analysis of tracks and planning of beat-matched transitions.
// The analysis runs on decoded PCM (downsampled), the mix itself on two <audio> elements.
import { CapacitorHttp } from '@capacitor/core';
import { isNativeApp, getDirectAudioUrl } from './youtube';
import { api } from './api';

export interface TrackAnalysis {
  bpm: number | null; // null = no stable beat found
  beat: number; // seconds per beat (0 if unknown)
  firstBeat: number; // first downbeat (s)
  start: number; // first audible moment (s)
  end: number; // last audible moment (s)
  introEnd: number; // full energy reached (s)
  outroStart: number; // last moment at full energy (s)
  duration: number;
  confidence: number; // 0..1 beat stability
}

export interface MixPlan {
  mixStart: number; // position in outgoing track where the crossfade begins
  fadeLen: number; // crossfade length (s, outgoing time)
  inStart: number; // position in incoming track at mixStart
  rate: number; // playback-rate factor for incoming during the mix (tempo match)
  beatSync: boolean; // tempo + phase matched
  bpmOut: number | null;
  bpmIn: number | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const movingAvg = (x: Float32Array, win: number): Float32Array => {
  const out = new Float32Array(x.length);
  const half = Math.max(1, Math.floor(win / 2));
  let sum = 0;
  let lo = 0;
  let hi = -1;
  for (let i = 0; i < x.length; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(x.length - 1, i + half);
    while (hi < b) sum += x[++hi];
    while (lo < a) sum -= x[lo++];
    out[i] = sum / (hi - lo + 1);
  }
  return out;
};

const percentile = (x: Float32Array, p: number): number => {
  const s = Array.from(x).sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0;
};

/** Analyse mono PCM: tempo (autocorrelation of a bass-weighted onset envelope), beat grid, energy profile. */
export const analyzePcm = (x: Float32Array, sr: number): TrackAnalysis => {
  const duration = x.length / sr;
  if (duration < 20) throw new Error('Audio zu kurz für DJ-Analyse');
  const hop = Math.max(64, Math.round(sr / 86)); // ~11.6 ms frames
  const fps = sr / hop;
  const n = Math.floor(x.length / hop);
  const eFull = new Float32Array(n);
  const eLow = new Float32Array(n);

  // one-pole low-pass ~150 Hz isolates kick/bass
  const alpha = 1 - Math.exp((-2 * Math.PI * 150) / sr);
  let lp = 0;
  for (let f = 0; f < n; f++) {
    let sf = 0;
    let sl = 0;
    const o = f * hop;
    for (let i = 0; i < hop; i++) {
      const v = x[o + i];
      lp += alpha * (v - lp);
      sf += v * v;
      sl += lp * lp;
    }
    eFull[f] = Math.sqrt(sf / hop);
    eLow[f] = Math.sqrt(sl / hop);
  }

  // onset strength: positive log-energy flux, bass weighted, minus local mean
  const onsetRaw = new Float32Array(n);
  for (let f = 1; f < n; f++) {
    const dl = Math.log1p(100 * eLow[f]) - Math.log1p(100 * eLow[f - 1]);
    const df = Math.log1p(100 * eFull[f]) - Math.log1p(100 * eFull[f - 1]);
    onsetRaw[f] = Math.max(0, dl) + 0.5 * Math.max(0, df);
  }
  const localMean = movingAvg(onsetRaw, Math.round(fps * 0.4));
  const onset = new Float32Array(n);
  for (let f = 0; f < n; f++) onset[f] = Math.max(0, onsetRaw[f] - localMean[f]);

  // ---- energy profile ----
  const energy = movingAvg(eFull, Math.round(fps * 2));
  const fine = movingAvg(eFull, Math.round(fps * 0.2));
  const ref = percentile(energy, 0.7) || 1e-6;
  let startF = 0;
  while (startF < n - 1 && fine[startF] < 0.08 * ref) startF++;
  let endF = n - 1;
  while (endF > startF && fine[endF] < 0.08 * ref) endF--;
  let introF = startF;
  while (introF < endF && energy[introF] < 0.7 * ref) introF++;
  let outroF = endF;
  while (outroF > introF && energy[outroF] < 0.7 * ref) outroF--;

  // ---- tempo: autocorrelation over the musical body ----
  const a0 = startF;
  const a1 = endF;
  const minLag = Math.floor((fps * 60) / 190);
  const maxLag = Math.ceil((fps * 60) / 60);
  const ac = new Float32Array(maxLag * 2 + 2);
  for (let lag = 0; lag < ac.length; lag++) {
    let s = 0;
    for (let f = a0; f + lag < a1; f++) s += onset[f] * onset[f + lag];
    ac[lag] = s;
  }
  let bestLag = 0;
  let bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag;
    // perceptual prior around 120 BPM, plus support from the double period
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    const score = w * (ac[lag] + 0.5 * ac[2 * lag]);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  let period = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const y0 = ac[bestLag - 1];
    const y1 = ac[bestLag];
    const y2 = ac[bestLag + 1];
    const d = y0 - 2 * y1 + y2;
    if (d < 0) period = bestLag + clamp((0.5 * (y0 - y2)) / d, -0.5, 0.5);
  }
  // refine period over the whole track: maximise comb energy around the estimate
  const combScore = (p: number, phase: number) => {
    let s = 0;
    for (let t = a0 + phase; t < a1; t += p) {
      const i = Math.round(t);
      s += onset[i] + 0.5 * (onset[i - 1] || 0) + 0.5 * (onset[i + 1] || 0);
    }
    return s;
  };
  const bestPhaseFor = (p: number) => {
    let bp = 0;
    let bs = -1;
    for (let ph = 0; ph < p; ph += 0.5) {
      const s = combScore(p, ph);
      if (s > bs) {
        bs = s;
        bp = ph;
      }
    }
    return { phase: bp, score: bs };
  };
  let best = { p: period, ...bestPhaseFor(period) };
  for (let dp = -0.3; dp <= 0.3001; dp += 0.05) {
    const p = period + dp;
    if (Math.abs(dp) < 1e-6) continue;
    const r = bestPhaseFor(p);
    if (r.score > best.score) best = { p, ...r };
  }
  period = best.p;

  // confidence: comb energy on-beat vs. half-beat off-grid
  const off = combScore(period, best.phase + period / 2);
  const confidence = clamp((best.score - off) / (best.score + 1e-9), 0, 1);

  // downbeat: of the 4 beat phases pick the one with strongest bass onsets every bar
  let beatPhase = best.phase;
  let barBest = -1;
  for (let k = 0; k < 4; k++) {
    const ph = best.phase + k * period;
    let s = 0;
    for (let t = a0 + ph; t < a1; t += 4 * period) {
      const i = Math.round(t);
      s += Math.max(0, Math.log1p(100 * eLow[i]) - Math.log1p(100 * (eLow[i - 2] || 0)));
    }
    if (s > barBest) {
      barBest = s;
      beatPhase = ph;
    }
  }

  const beat = period / fps;
  let bpm: number | null = (60 * fps) / period;
  if (confidence < 0.12 || !isFinite(bpm)) bpm = null;
  const firstBeatRaw = (a0 + beatPhase) / fps;
  const firstBeat = bpm ? firstBeatRaw % (4 * beat) : 0;

  return {
    bpm: bpm ? Math.round(bpm * 10) / 10 : null,
    beat: bpm ? beat : 0,
    firstBeat,
    start: startF / fps,
    end: Math.min(duration, (endF + 1) / fps),
    introEnd: introF / fps,
    outroStart: outroF / fps,
    duration,
    confidence: Math.round(confidence * 100) / 100,
  };
};

/** Decide where and how to mix from track A (playing) into track B. */
export const planMix = (a: TrackAnalysis, b: TrackAnalysis): MixPlan | null => {
  if (!(a.duration >= 20 && b.duration >= 20 && a.end > a.start)) return null;
  // tempo match (allow half/double time), max ±7 % pitch-free stretch
  let rate = 1;
  let beatSync = false;
  if (a.bpm && b.bpm) {
    const cands = [a.bpm / b.bpm, (2 * a.bpm) / b.bpm, a.bpm / (2 * b.bpm)];
    const r = cands.reduce((p, c) => (Math.abs(c - 1) < Math.abs(p - 1) ? c : p));
    if (Math.abs(r - 1) <= 0.07) {
      rate = r;
      beatSync = true;
    }
  }

  const beatA = a.beat || 0.5;
  // beat-synced: 16 beats (4 bars), otherwise a short 8-beat blend
  let fadeLen = beatSync ? clamp(16 * beatA, 6, 14) : a.bpm ? clamp(8 * beatA, 4, 8) : 6;
  const outEnd = Math.max(1, Math.min(a.end, a.duration - 0.25));

  // start where the outro begins (incoming intro plays over the outro), else so the fade ends at the end
  let mixStart = outEnd - a.outroStart >= fadeLen ? a.outroStart : outEnd - fadeLen;
  if (a.bpm) {
    const bar = 4 * a.beat;
    mixStart = a.firstBeat + Math.round((mixStart - a.firstBeat) / bar) * bar;
    while (mixStart + fadeLen > outEnd + 0.5 && mixStart - bar > 0) mixStart -= bar;
  }
  // never cut a song too early (long quiet outros, ambient tracks)
  const earliest = Math.max(a.start + 30, a.duration * 0.6);
  if (mixStart < earliest) mixStart = Math.max(earliest, outEnd - fadeLen);
  fadeLen = Math.max(2, Math.min(fadeLen, a.duration - 0.2 - mixStart));

  // incoming: first downbeat at/after the first audible sound (skip silence)
  let inStart = b.start;
  if (b.bpm) {
    const bar = 4 * b.beat;
    const firstBar = b.firstBeat + Math.ceil((b.start - 0.05 - b.firstBeat) / bar) * bar;
    const firstBeat = b.firstBeat + Math.ceil((b.start - 0.05 - b.firstBeat) / b.beat) * b.beat;
    inStart = Math.max(0, firstBar - b.start <= 3 ? firstBar : firstBeat);
  }

  return {
    mixStart,
    fadeLen,
    inStart,
    rate,
    beatSync,
    bpmOut: a.bpm,
    bpmIn: b.bpm,
  };
};

// ------------------------------------------------------------------
// Loading + decoding (runs in the app)
// ------------------------------------------------------------------
const ANALYSIS_SR = 11025;
const analysisCache = new Map<string, TrackAnalysis>();
const ANALYSIS_KEY = 'ytmusic_dj_analysis';

try {
  const saved = JSON.parse(localStorage.getItem(ANALYSIS_KEY) || '{}');
  for (const k of Object.keys(saved)) analysisCache.set(k, saved[k]);
} catch {
  /* ignore */
}

const persistAnalysis = () => {
  try {
    const entries = Array.from(analysisCache.entries()).slice(-300);
    localStorage.setItem(ANALYSIS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* ignore */
  }
};

export const getCachedAnalysis = (id: string) => analysisCache.get(id) || null;

const b64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const fetchBytes = async (url: string): Promise<Uint8Array> => {
  if (isNativeApp()) {
    const res = await CapacitorHttp.request({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      connectTimeout: 10000,
      readTimeout: 20000,
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    return typeof res.data === 'string' ? b64ToBytes(res.data) : new Uint8Array(res.data);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};

/** Download the full audio file. YouTube URLs are fetched as parallel range chunks (fast, not throttled). */
export const downloadAudio = async (id: string, skipOffline = false): Promise<{ bytes: Uint8Array; mime: string }> => {
  if (!skipOffline) {
    const local = await (await import('./offline')).getOfflineBytes(id);
    if (local) return local;
  }
  if (isNativeApp()) {
    const url = await getDirectAudioUrl(id);
    const u = new URL(url);
    const clen = parseInt(u.searchParams.get('clen') || '0', 10);
    const mime = (u.searchParams.get('mime') || 'audio/mp4').replace('%2F', '/');
    if (clen > 0) {
      const CH = 512 * 1024;
      const ranges: [number, number][] = [];
      for (let s = 0; s < clen; s += CH) ranges.push([s, Math.min(clen, s + CH) - 1]);
      const parts: Uint8Array[] = new Array(ranges.length);
      let next = 0;
      const worker = async () => {
        while (next < ranges.length) {
          const i = next++;
          const [s, e] = ranges[i];
          parts[i] = await fetchBytes(`${url}&range=${s}-${e}`);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0;
      for (const p of parts) {
        out.set(p, o);
        o += p.length;
      }
      return { bytes: out, mime };
    }
    return { bytes: await fetchBytes(url), mime };
  }
  return { bytes: await fetchBytes(api.getStreamUrl(id)), mime: 'audio/mp4' };
};

const decodeMono = async (bytes: Uint8Array): Promise<Float32Array> => {
  const Ctx = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const ctx: OfflineAudioContext = new Ctx(1, ANALYSIS_SR, ANALYSIS_SR);
  const buf = await ctx.decodeAudioData(bytes.slice().buffer);
  const ch0 = buf.getChannelData(0);
  if (buf.numberOfChannels < 2) return ch0;
  const ch1 = buf.getChannelData(1);
  const out = new Float32Array(ch0.length);
  for (let i = 0; i < ch0.length; i++) out[i] = 0.5 * (ch0[i] + ch1[i]);
  return out;
};

export interface PreparedTrack {
  id: string;
  analysis: TrackAnalysis;
  blobUrl: string | null; // full file in memory -> instant, sample-exact start
}

const inflight = new Map<string, Promise<PreparedTrack>>();

/** Download + analyse a track. With keepBlob the audio stays in memory for gapless playback. */
export const prepareTrack = (id: string, keepBlob: boolean): Promise<PreparedTrack> => {
  const key = `${id}:${keepBlob ? 1 : 0}`;
  const cached = analysisCache.get(id);
  if (cached && !keepBlob) return Promise.resolve({ id, analysis: cached, blobUrl: null });
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      const { bytes, mime } = await downloadAudio(id);
      let analysis = analysisCache.get(id);
      if (!analysis) {
        const pcm = await decodeMono(bytes);
        analysis = analyzePcm(pcm, ANALYSIS_SR);
        analysisCache.set(id, analysis);
        persistAnalysis();
      }
      const blobUrl = keepBlob ? URL.createObjectURL(new Blob([bytes], { type: mime })) : null;
      return { id, analysis, blobUrl };
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
};
