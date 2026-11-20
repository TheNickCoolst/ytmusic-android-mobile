// Collects app logs from the YT Music app and stores them as one JSONL file per day.
// POST /logs  (header X-Log-Key: INGEST_KEY)  body: { device, platform, build, version, entries: [...] }
// GET  /logs?day=YYYY-MM-DD&device=..&level=..&limit=..  (header Authorization: Bearer READ_TOKEN)
// GET  /days  (same auth) -> available days
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || 8080;
const DIR = process.env.LOG_DIR || '/data/logs';
const INGEST_KEY = process.env.INGEST_KEY || '';
const READ_TOKEN = process.env.READ_TOKEN || '';
const KEEP_DAYS = parseInt(process.env.KEEP_DAYS || '30', 10);
const MAX_BODY = 256 * 1024;

fs.mkdirSync(DIR, { recursive: true });

// simple per-IP rate limit: 120 requests / 10 min
const hits = new Map();
const limited = (ip) => {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 600_000);
  h.push(now);
  hits.set(ip, h);
  return h.length > 120;
};

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : v == null ? '' : String(v).slice(0, n));

const cleanup = () => {
  const cutoff = day(new Date(Date.now() - KEEP_DAYS * 86400_000));
  for (const f of fs.readdirSync(DIR)) if (f.endsWith('.jsonl') && f.slice(0, 10) < cutoff) fs.rmSync(path.join(DIR, f));
};
cleanup();
setInterval(cleanup, 6 * 3600_000);

const send = (res, code, body) => {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Log-Key, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const authed = (req) => READ_TOKEN && req.headers.authorization === `Bearer ${READ_TOKEN}`;

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (url.pathname === '/health') return send(res, 200, { ok: true });

    if (req.method === 'POST' && url.pathname === '/logs') {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
      if (!INGEST_KEY || req.headers['x-log-key'] !== INGEST_KEY) return send(res, 401, { error: 'key' });
      if (limited(ip)) return send(res, 429, { error: 'rate' });
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) req.destroy();
        else chunks.push(c);
      });
      req.on('end', () => {
        let b;
        try {
          b = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          return send(res, 400, { error: 'json' });
        }
        const meta = { device: str(b.device, 40), platform: str(b.platform, 12), build: str(b.build, 12), version: str(b.version, 20) };
        const entries = Array.isArray(b.entries) ? b.entries.slice(0, 300) : [];
        const received = new Date().toISOString();
        const lines = entries.map((e) =>
          JSON.stringify({ received, t: str(e?.t, 30), level: str(e?.level, 8), msg: str(e?.msg, 4000), ...meta })
        );
        if (lines.length) {
          fs.appendFileSync(path.join(DIR, `${day()}.jsonl`), lines.join('\n') + '\n');
          for (const l of lines) console.log(l); // also visible in Railway's log view
        }
        send(res, 200, { stored: lines.length });
      });
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/logs' || url.pathname === '/days')) {
      if (!authed(req)) return send(res, 401, { error: 'auth' });
      if (url.pathname === '/days') return send(res, 200, fs.readdirSync(DIR).filter((f) => f.endsWith('.jsonl')).map((f) => f.slice(0, 10)).sort());
      const d = url.searchParams.get('day') || day();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return send(res, 400, { error: 'day' });
      const f = path.join(DIR, `${d}.jsonl`);
      if (!fs.existsSync(f)) return send(res, 200, []);
      const dev = url.searchParams.get('device');
      const lvl = url.searchParams.get('level');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10) || 500, 5000);
      const out = fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
        .filter((e) => (!dev || e.device === dev) && (!lvl || e.level === lvl));
      return send(res, 200, out.slice(-limit));
    }

    send(res, 404, { error: 'not found' });
  })
  .listen(PORT, () => console.log(`log server on :${PORT}, dir ${DIR}`));
