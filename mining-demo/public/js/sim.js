// OreSight AI — simulated-data engine. Seeded PRNG so every demo run tells
// the same story (HT-104 always degrades); live ticks make charts stream.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate a telemetry-like channel: baseline + linear drift + sinusoid + random walk.
// Returns an array of `points` values.
export function channel({ base = 0, drift = 0, noise = 1, period = 0, amp = 0, seed = 1, cap = null }, points = 30) {
  const rnd = mulberry32(seed);
  let walk = 0;
  const out = [];
  for (let i = 0; i < points; i++) {
    walk += (rnd() - 0.5) * noise * 0.6;
    walk *= 0.92; // mean-reverting walk
    const sin = period > 0 ? Math.sin((i / period) * Math.PI * 2) * amp : 0;
    let trend = base + drift * i;
    if (cap != null) trend = Math.min(trend, cap); // degradation saturates, never runs away
    out.push(trend + sin + (rnd() - 0.5) * noise + walk);
  }
  return out;
}

// Live stream wrapper: holds a window of values, tick() appends a new point.
export class Stream {
  constructor(params, points = 30) {
    this.params = { ...params };
    this.i = points;
    this.rnd = mulberry32((params.seed ?? 1) + 7919);
    this.data = channel(params, points);
  }
  tick() {
    const p = this.params;
    const sin = p.period > 0 ? Math.sin((this.i / p.period) * Math.PI * 2) * (p.amp ?? 0) : 0;
    let trend = p.base + (p.drift ?? 0) * this.i;
    if (p.cap != null) trend = Math.min(trend, p.cap);
    const v = trend + sin + (this.rnd() - 0.5) * (p.noise ?? 1);
    this.data.push(v);
    this.data.shift();
    this.i++;
    return v;
  }
  last() { return this.data[this.data.length - 1]; }
}

// ── Fleet definition (Morowali Pit 2) ────────────────────────────────────────
// HT-104 is the scripted story beat: positive vibration drift carries it from
// ~4.5 toward ~9 mm/s, across the ISO 10816 alarm band the chart draws.
export const FLEET = [
  { id: 'HT-101', type: 'Komatsu HD785-7', role: 'Haul truck', hours: 18204, vib: { base: 3.1, drift: 0.001, noise: 0.45, seed: 201 }, temp: { base: 78, drift: 0.002, noise: 1.6, seed: 301 } },
  { id: 'HT-102', type: 'Komatsu HD785-7', role: 'Haul truck', hours: 16871, vib: { base: 3.6, drift: 0.001, noise: 0.5, seed: 202 }, temp: { base: 80, drift: 0.001, noise: 1.5, seed: 302 } },
  { id: 'HT-103', type: 'Komatsu HD785-7', role: 'Haul truck', hours: 21490, vib: { base: 4.0, drift: 0.002, noise: 0.55, seed: 203 }, temp: { base: 81, drift: 0.003, noise: 1.7, seed: 303 } },
  { id: 'HT-104', type: 'Komatsu HD785-7', role: 'Haul truck', hours: 23166, vib: { base: 4.2, drift: 0.08, noise: 0.5, seed: 204, cap: 9.0 }, temp: { base: 82, drift: 0.18, noise: 1.6, seed: 304, cap: 93 } },
  { id: 'HT-105', type: 'Komatsu HD785-7', role: 'Haul truck', hours: 14752, vib: { base: 2.9, drift: 0.001, noise: 0.4, seed: 205 }, temp: { base: 77, drift: 0.001, noise: 1.4, seed: 305 } },
  { id: 'HT-106', type: 'Komatsu HD785-7', role: 'Haul truck', hours: 19038, vib: { base: 3.4, drift: 0.002, noise: 0.5, seed: 206 }, temp: { base: 79, drift: 0.002, noise: 1.5, seed: 306 } },
  { id: 'CR-01', type: 'Metso C160 jaw', role: 'Primary crusher', hours: 31207, vib: { base: 5.2, drift: 0.002, noise: 0.6, seed: 207 }, temp: { base: 68, drift: 0.001, noise: 1.2, seed: 307 } },
  { id: 'CR-02', type: 'Metso HP500 cone', role: 'Secondary crusher', hours: 28944, vib: { base: 5.8, drift: 0.01, noise: 0.65, seed: 208, cap: 6.6 }, temp: { base: 72, drift: 0.012, noise: 1.3, seed: 308, cap: 78 } },
  { id: 'CV-103', type: 'Overland 14 km', role: 'Conveyor', hours: 41552, vib: { base: 2.2, drift: 0.0, noise: 0.3, seed: 209 }, temp: { base: 58, drift: 0.0, noise: 1.0, seed: 309 } },
];

export const ISO_ALARM = 7.1;  // ISO 10816 zone C/D boundary (mm/s RMS)
export const ISO_WARN = 4.5;   // zone B/C boundary

export function assetStatus(vibLast) {
  if (vibLast >= ISO_ALARM) return 'crit';
  if (vibLast >= ISO_WARN) return 'warn';
  return 'ok';
}

export function healthScore(vibLast) {
  return Math.max(15, Math.min(98, Math.round(100 - Math.max(0, vibLast - 2.5) * 9.5)));
}

// WITA clock helper (UTC+8)
export function witaTime(d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(d);
}

// Control-tower ops event generator.
const OPS_EVENTS = [
  { k: 'ok',   m: 'HT-{n} payload {p} t — within target band' },
  { k: 'ok',   m: 'Barge BG-31{n2} loading at jetty 1 — {r} t/h' },
  { k: 'ok',   m: 'CR-01 throughput {r} t/h — feed steady' },
  { k: 'warn', m: 'CV-103 belt drift sensor S-{n2} intermittent — inspection queued' },
  { k: 'ok',   m: 'Pit 1 Block A2 dig rate {r2} bcm/h' },
  { k: 'warn', m: 'Weighbridge queue {q} units — pacing adjusted' },
  { k: 'ok',   m: 'Stockpile SP-2 reclaim blended at 1.8{g}% Ni' },
  { k: 'warn', m: 'HT-104 vibration trending — maintenance review open' },
  { k: 'ok',   m: 'Dispatch re-assigned HT-10{n3} to ROM circuit (queue rule)' },
  { k: 'ok',   m: 'RKEF feed moisture 21.{g}% — inside kiln envelope' },
];

export function opsEvent(rnd) {
  const e = OPS_EVENTS[Math.floor(rnd() * OPS_EVENTS.length)];
  const msg = e.m
    .replace('{n}', String(101 + Math.floor(rnd() * 6)))
    .replace('{n2}', String(10 + Math.floor(rnd() * 80)))
    .replace('{n3}', String(1 + Math.floor(rnd() * 6)))
    .replace('{p}', (84 + rnd() * 10).toFixed(1))
    .replace('{r}', String(1700 + Math.floor(rnd() * 500)))
    .replace('{r2}', String(380 + Math.floor(rnd() * 90)))
    .replace('{q}', String(2 + Math.floor(rnd() * 5)))
    .replace('{g}', String(Math.floor(rnd() * 9)));
  return { kind: e.k, msg };
}
