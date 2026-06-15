// Payload Optimisation — in-pit load-and-haul truck-factor console.
// Light-theme console that scores the HD785-7 fleet against Caterpillar's
// 10/10/20 payload policy and closes the loader→truck feedback loop.
//
// Fully client-side and deterministic (seeded RNG, no backend / no key — the
// AI optimiser tag reads "no-key"): a pure pipeline derives every panel from
// {scenario, applied, viz}. Swap the synthetic load generator for live VIMS
// payload-meter + bucket-weigh feeds and the UI is unchanged.
import { witaTime } from './sim.js';

const el = (id) => document.getElementById(id);

// ── Tunable inputs (props) ────────────────────────────────────────────────────
const RATED = 91;     // rated payload, t
const TARGET = 90;    // target mean — just under rated, t
const MARGIN = 14;    // recovered-tonne margin, $/t
const OP_DAYS = 350;  // operating days/yr

// ── Client state ──────────────────────────────────────────────────────────────
const state = { scenario: 'baseline', applied: false, viz: 'histogram' };

// ── Seeded RNG + gaussian ─────────────────────────────────────────────────────
function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── Operator / loader population ──────────────────────────────────────────────
function baseOps() {
  return [
    { id: 'BD-07', name: 'Budi A.', loader: 'LD-1', shift: 'Day',   crew: 'A', mean: 89.6, cv: 4.5, n: 120, passes: 3.9, fill: 97 },
    { id: 'AN-12', name: 'Andi P.', loader: 'EX19', shift: 'Day',   crew: 'A', mean: 88.2, cv: 5.3, n: 118, passes: 4.2, fill: 94 },
    { id: 'SR-04', name: 'Sari W.', loader: 'LD-1', shift: 'Night', crew: 'B', mean: 85.0, cv: 7.9, n: 112, passes: 4.7, fill: 89 },
    { id: 'JK-09', name: 'Joko S.', loader: 'EX19', shift: 'Night', crew: 'B', mean: 91.6, cv: 7.0, n: 110, passes: 3.5, fill: 99 },
  ];
}
function scenarioOps(scenario, applied) {
  const ops = baseOps().map((o) => ({ ...o, drift: false }));
  const set = (id, p) => { const o = ops.find((x) => x.id === id); if (o) Object.assign(o, p); };
  if (scenario === 'night-drift') { set('SR-04', { mean: 83.2, cv: 8.7, fill: 86, passes: 4.9 }); set('JK-09', { mean: 92.6, cv: 7.7, fill: 100 }); }
  else if (scenario === 'new-op') { set('AN-12', { name: 'Eko R.', mean: 86.4, cv: 8.9, fill: 90, passes: 4.6 }); }
  else if (scenario === 'wet-ore') { ops.forEach((o) => { o.mean -= 1.6; o.cv += 1.1; o.fill -= 4; }); }
  else if (scenario === 'scale-drift') { set('JK-09', { drift: true, cv: 9.4 }); }
  if (applied) {
    set('SR-04', { mean: 88.8, cv: 5.0, fill: 96, passes: 4.0 });
    set('JK-09', { mean: 89.8, cv: 5.1, fill: 98, passes: 3.7, drift: false });
    set('AN-12', { mean: 89.2, cv: 4.9, fill: 96, passes: 4.0 });
  }
  return ops;
}

// ── Per-truck load samples (seeded gaussian) ──────────────────────────────────
function loads(ops, applied, scenario) {
  const out = [];
  let seed = applied ? 77 : 41;
  if (scenario === 'night-drift') seed += 5;
  if (scenario === 'new-op') seed += 11;
  if (scenario === 'wet-ore') seed += 17;
  if (scenario === 'scale-drift') seed += 23;
  ops.forEach((o, oi) => {
    const r = rng(seed + oi * 1000);
    const sd = o.mean * o.cv / 100;
    for (let i = 0; i < o.n; i++) {
      let p = o.mean + gauss(r) * sd;
      let ex = false;
      if (o.drift && r() < 0.16) { p = o.mean + 12 + gauss(r) * 2; ex = true; }
      p = Math.max(72, Math.min(118, p));
      out.push({ p, op: o, excluded: ex });
    }
  });
  return out;
}

// ── Distribution statistics + 10/10/20 status ─────────────────────────────────
function stats(ld) {
  const valid = ld.filter((l) => !l.excluded).map((l) => l.p);
  const n = valid.length;
  const mean = valid.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(valid.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
  const cv = sd / mean * 100;
  const over110 = valid.filter((p) => p > RATED * 1.10).length / n * 100;
  const over120 = valid.filter((p) => p > RATED * 1.20).length / n * 100;
  const under90 = valid.filter((p) => p < RATED * 0.90).length / n * 100;
  const meanPct = mean / RATED * 100;
  let status = 'PASS';
  if (over120 > 0 || meanPct > 100) status = 'FAIL';
  else if (over110 > 10 || cv > 6.6 || under90 > 22) status = 'MARGINAL';
  const lost = Math.round(valid.filter((p) => p < TARGET).reduce((a, p) => a + (TARGET - p), 0));
  const risk = Math.round(valid.filter((p) => p > RATED * 1.10).reduce((a, p) => a + (p - RATED * 1.10), 0));
  return { n, mean, cv, over110, over120, under90, meanPct, status, lost, risk, excluded: ld.length - n };
}
function baseStats() { return stats(loads(baseOps().map((o) => ({ ...o, drift: false })), false, 'baseline')); }
function perOpLost(scenario, applied) {
  const map = {};
  loads(scenarioOps(scenario, applied), applied, scenario).forEach((l) => {
    if (l.excluded) return;
    map[l.op.id] = (map[l.op.id] || 0) + Math.max(0, TARGET - l.p);
  });
  Object.keys(map).forEach((k) => (map[k] = Math.round(map[k])));
  return map;
}
function scenarioRiskFor(scenario, applied) { return stats(loads(scenarioOps(scenario, applied), applied, scenario)).risk; }

// ── Load-band colour + histogram binning ──────────────────────────────────────
function bandFor(p) {
  if (p < RATED * 0.90) return '#b45309';
  if (p <= RATED * 1.00) return '#15803d';
  if (p <= RATED * 1.10) return '#0e7490';
  if (p <= RATED * 1.20) return '#d97706';
  return '#b91c1c';
}
const LO = 75, HI = 117, STEP = 1.5, BINS = Math.round((HI - LO) / STEP); // 28
function hist(ld) {
  const counts = new Array(BINS).fill(0), drift = new Array(BINS).fill(0);
  ld.forEach((l) => {
    let idx = Math.floor((l.p - LO) / STEP);
    if (idx < 0) idx = 0;
    if (idx >= BINS) idx = BINS - 1;
    if (l.excluded) drift[idx]++; else counts[idx]++;
  });
  const max = Math.max(...counts, ...drift, 1);
  return counts.map((c, i) => {
    const center = LO + STEP * i + STEP / 2;
    const d = drift[i];
    const isDrift = d > 0 && d >= c;
    return { h: Math.round(c / max * 100), fill: isDrift ? '#7c3aed' : bandFor(center), count: c, center, isDrift };
  });
}
const leftPct = (v) => (v - LO) / (HI - LO) * 100;
function fmtUSD(v) {
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'k';
  return '$' + Math.round(v);
}
function actionColor(a) {
  const m = {
    coach: { c: '#15803d', bg: '#e3f1e7' }, 'pass-count': { c: '#0e7490', bg: '#d8eef2' },
    'fill-target': { c: '#0e7490', bg: '#d8eef2' }, calibrate: { c: '#7c3aed', bg: '#eee3fb' }, trim: { c: '#d97706', bg: '#fbeed8' },
  };
  return m[a] || m.coach;
}

// ── AI optimiser engine ───────────────────────────────────────────────────────
function aiEngine(st, scenario, applied) {
  const issueMap = {
    'baseline':    { issue: 'underloading', note: 'Night crew (B) on LD-1 runs ~6 t light — Sari W. at 85.0 t, CV 7.9%. Day shift holds target.' },
    'night-drift': { issue: 'underloading', note: 'Night-shift drift deepened: Sari W. 83.2 t at CV 8.7% — the gap concentrates 19:00→close.' },
    'new-op':      { issue: 'fill-factor',  note: 'New operator on EX1900 erratic at CV 8.9%, fill 90% — pass match unstable.' },
    'wet-ore':     { issue: 'underloading', note: 'Wet-ore swell cut fill ~4 pts fleet-wide; trucks leaving 3–5 t short.' },
    'scale-drift': { issue: 'scale-drift',  note: 'EX1900 meter reads +12 t on ~16% of loads — calibration drift; excluded & flagged.' },
  };
  const im = issueMap[scenario] || issueMap.baseline;
  const tf = st.mean;
  const recBase = perOpLost(scenario, false);
  const riskBase = scenarioRiskFor(scenario, false);
  const tpd = (id) => { const v = recBase[id] || 0; return v > 0 ? '+' + v + ' t/day' : '—'; };
  const recover = Math.round(Object.values(recBase).reduce((a, b) => a + b, 0) * 0.7);
  const value = Math.round(recover * MARGIN * OP_DAYS);
  let actions;
  if (applied) {
    actions = [
      { who: 'SH-01·N Sari W. — 4 even passes @ 96%', action: 'coach', delta: tpd('SR-04') },
      { who: 'SH-01·D Andi P. — fill 94→96%', action: 'fill-target', delta: tpd('AN-12') },
      { who: 'EX1900 Joko S. — overload trimmed', action: 'trim', delta: 'risk −' + riskBase },
    ];
  } else if (scenario === 'scale-drift') {
    actions = [
      { who: 'EX1900 meter — re-zero VIMS', action: 'calibrate', delta: 'exclude' },
      { who: 'SH-02·N Joko S. — re-weigh vs bucket', action: 'coach', delta: '+3 t/day' },
      { who: 'SH-01·N Sari W. — resume feedback', action: 'fill-target', delta: tpd('SR-04') },
    ];
  } else if (scenario === 'new-op') {
    actions = [
      { who: 'EX1900 Eko R. — train on bucket weights', action: 'fill-target', delta: tpd('AN-12') },
      { who: 'SH-01·N Sari W. — add one even pass', action: 'coach', delta: tpd('SR-04') },
      { who: 'EX1900 Joko S. — trim heavy 4th', action: 'pass-count', delta: 'risk −' + riskBase },
    ];
  } else {
    actions = [
      { who: 'SH-01·N Sari W. — fill 89→96%', action: 'coach', delta: tpd('SR-04') },
      { who: 'SH-01·D Andi P. — steadier passes', action: 'fill-target', delta: tpd('AN-12') },
      { who: 'SH-01·D Budi A. — stand up feedback', action: 'fill-target', delta: tpd('BD-07') },
    ];
  }
  return {
    engineTag: 'no-key',
    bindingIssue: im.issue, issueNote: im.note,
    recoverTpd: recover, riskBase,
    headlineSerif: applied
      ? 'Loop closed — truck factor ' + tf.toFixed(1) + ' t at CV ' + st.cv.toFixed(1) + '%, now passing the 10/10/20 policy.'
      : 'Truck factor ' + tf.toFixed(1) + ' t — ' + (RATED - tf).toFixed(1) + ' t under rated, costing ~' + recover + ' t/day of free haulage.',
    operatorActions: actions.map((a) => ({ ...a, color: actionColor(a.action).c, bg: actionColor(a.action).bg })),
    valueLabel: applied ? fmtUSD(value * 1.15) : fmtUSD(value),
  };
}

// ── Trend (truck-factor per load, smoothed across the shift) ───────────────────
function trend(st, applied) {
  const startM = baseStats().mean, endM = st.mean;
  const r = rng(applied ? 91 : 53), N = 18, pts = [];
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    let mv;
    if (applied) { mv = f < 0.5 ? startM : startM + (endM - startM) * ((f - 0.5) / 0.5); }
    else { mv = startM + (endM - startM) * f; }
    const noise = (applied && f > 0.55 ? 0.5 : 1.5) * gauss(r);
    pts.push(Math.max(82, Math.min(95, mv + noise)));
  }
  // map payload 82..101 to y 96..6 against the dashed gridlines
  const ylo = 82, yhi = 101, Yb = (v) => 96 - ((v - ylo) / (yhi - ylo)) * 90, Xb = (i) => i / (N - 1) * 100;
  const line = pts.map((v, i) => Xb(i).toFixed(1) + ',' + Yb(v).toFixed(1)).join(' ');
  const area = '0,100 ' + line + ' 100,100';
  return { line, area, start: pts[0].toFixed(1), end: pts[N - 1].toFixed(1) };
}

// ── Pure view-model from {scenario, applied, viz} ─────────────────────────────
function compute() {
  const { scenario, applied, viz } = state;
  const ops = scenarioOps(scenario, applied);
  const ld = loads(ops, applied, scenario);
  const st = stats(ld);
  const base = baseStats();
  const H = hist(ld);
  const ai = aiEngine(st, scenario, applied);
  const tr = trend(st, applied);

  const statusColors = { PASS: '#15803d', MARGINAL: '#d97706', FAIL: '#b91c1c' };
  const darkStatus = { PASS: '#3fb968', MARGINAL: '#e0a44a', FAIL: '#e87b72' };
  const sumN = ops.reduce((a, o) => a + o.n, 0);
  const fleetFill = ops.reduce((a, o) => a + o.fill * o.n, 0) / sumN;
  const fleetPass = ops.reduce((a, o) => a + o.passes * o.n, 0) / sumN;

  const kpis = [
    { label: 'Truck factor', value: st.mean.toFixed(1), unit: 't/load', valColor: '#1b1f18', valSize: '31px', valWeight: 800,
      chip: (st.mean >= base.mean ? '+' : '') + (st.mean - base.mean).toFixed(1) + ' t', chipColor: st.mean >= base.mean ? '#15803d' : '#b45309',
      barPct: Math.min(100, st.mean / RATED * 100), barColor: '#15803d', note: 'target ' + TARGET + ' · rated ' + RATED + ' t' },
    { label: '10/10/20 policy', value: st.status, unit: '', valColor: statusColors[st.status], valSize: '23px', valWeight: 700,
      chip: st.meanPct.toFixed(0) + '% mean', chipColor: statusColors[st.status],
      barPct: Math.min(100, Math.max(4, (100 - st.over110 * 3))), barColor: statusColors[st.status], note: st.over110.toFixed(1) + '% >110 · ' + st.over120.toFixed(1) + '% >120' },
    { label: 'Payload CV', value: st.cv.toFixed(1), unit: '%', valColor: '#1b1f18', valSize: '31px', valWeight: 800,
      chip: (st.cv <= base.cv ? '' : '+') + (st.cv - base.cv).toFixed(1) + ' pts', chipColor: st.cv <= base.cv ? '#15803d' : '#b45309',
      barPct: Math.min(100, Math.max(6, (9 - st.cv) / 9 * 100)), barColor: st.cv < 6 ? '#15803d' : '#d97706', note: 'consistency · target <6%' },
    { label: 'Lost + risk', value: String(st.lost), unit: 't/day', valColor: '#1b1f18', valSize: '31px', valWeight: 800,
      chip: st.risk + ' t risk', chipColor: st.risk > 0 ? '#b91c1c' : '#15803d',
      barPct: Math.min(100, st.lost / 2200 * 100), barColor: '#b45309', note: 'recoverable + overload' },
  ];

  const issueLabels = { underloading: 'Underloading', overloading: 'Overloading', 'pass-mismatch': 'Pass mismatch', 'fill-factor': 'Fill factor', 'scale-drift': 'Scale drift' };
  const issueColors = { underloading: '#b45309', overloading: '#d97706', 'pass-mismatch': '#0e7490', 'fill-factor': '#0e7490', 'scale-drift': '#7c3aed' };
  const bind = applied ? 'pass-mismatch' : ai.bindingIssue;
  const bc = issueColors[bind];
  const nightFill = ops.find((o) => o.id === 'SR-04').fill;
  const binding = { label: issueLabels[bind], color: bc };
  const bindingBars = [
    { label: 'LD-1 night fill', value: Math.round(nightFill) + '%', pct: nightFill, color: nightFill < 92 ? '#b45309' : '#15803d' },
    { label: 'Fleet CV', value: st.cv.toFixed(1) + '%', pct: Math.min(100, st.cv / 12 * 100), color: st.cv < 6 ? '#15803d' : '#d97706' },
  ];

  const bars = H.map((b) => ({ h: b.h, fill: b.fill, tip: b.center.toFixed(0) + '% · ' + b.count + ' loads', glow: b.isDrift ? '0 0 9px #7c3aed88' : 'none' }));
  const baseLoads = loads(baseOps().map((o) => ({ ...o, drift: false })), false, 'baseline');
  const ghostBars = hist(baseLoads).map((b) => ({ h: b.h }));
  const showGhost = applied || scenario !== 'baseline';

  const valid = ld.filter((l) => !l.excluded);
  const share = (lo, hi) => valid.filter((l) => l.p >= lo && l.p < hi).length / valid.length * 100;
  const legend = [
    ['Underload', '#b45309', share(0, 0.90 * RATED)], ['On-target', '#15803d', share(0.90 * RATED, RATED)],
    ['Upper-OK', '#0e7490', share(RATED, 1.10 * RATED)], ['Over-110', '#d97706', share(1.10 * RATED, 1.20 * RATED)],
    ['Over-120', '#b91c1c', share(1.20 * RATED, 999)],
  ].map((l) => ({ label: l[0], color: l[1], pct: l[2].toFixed(0) + '%' }));

  const gauges = [
    { label: 'BUCKET FILL FACTOR', value: Math.round(fleetFill) + '%', sub: 'vs 100% bucket', frac: Math.min(100, fleetFill), color: fleetFill < 92 ? '#d97706' : '#15803d' },
    { label: 'PASS COUNT', value: fleetPass.toFixed(1), sub: '3–4 even = match', frac: Math.min(100, fleetPass / 5 * 100), color: (fleetPass >= 3 && fleetPass <= 4.4) ? '#15803d' : '#d97706' },
  ];

  const co = { current: st.mean.toFixed(1), optimised: applied ? st.mean.toFixed(1) : TARGET.toFixed(1) };
  const recover = ai.recoverTpd;
  const strategies = [
    { key: 'apply', title: 'Hold just under rated', tag: applied ? '✓ APPLIED' : 'RECOMMENDED', tagColor: '#15803d', active: applied,
      desc: applied ? 'Loop closed — bucket-weight feedback live, distribution centred just under ' + RATED + ' t.' : 'Tighten CV with live trim-pass feedback; recover lost tonnes without overloading — consistency over peak.',
      cols: [{ k: 'Δ / DAY', v: '+' + recover + ' t', color: '#15803d' }, { k: 'CV', v: applied ? st.cv.toFixed(1) + '%' : '→5.1%', color: '#15803d' }, { k: 'VALUE', v: ai.valueLabel, color: '#1b1f18' }] },
    { key: 'chase', title: 'Chase rated payload', tag: 'OPTION', tagColor: '#9a9684', active: false,
      desc: 'Push the mean to rated for more tonnes per load — but overload share and tyre TKPH cost climb. Not the safe centre.',
      cols: [{ k: 'Δ / DAY', v: '+' + Math.round(recover * 1.25) + ' t', color: '#1b1f18' }, { k: 'RISK', v: '+tyre / frame', color: '#b91c1c' }, { k: 'VALUE', v: fmtUSD(MARGIN * recover * OP_DAYS * 0.6), color: '#1b1f18' }] },
  ];

  return {
    loadN: st.n, statusLabel: st.status, statusColor: darkStatus[st.status], meanLeft: leftPct(st.mean), meanLabel: st.mean.toFixed(1),
    kpis, binding, bindingBars, bars, ghostBars, showGhost, legend, gauges, co, strategies, ai,
    isHist: viz === 'histogram',
    vizTitle: viz === 'histogram' ? 'Payload distribution vs % rated' : 'Truck-factor trend · this shift',
    vizSub: viz === 'histogram' ? ('target mean ' + TARGET + ' t · mean marker μ · ' + RATED + ' t rated') : 'mean payload per load, smoothed — tightening after coaching',
    trend: tr,
  };
}

// ── One-time DOM scaffolding (built once, mutated in place to keep transitions)─
const M = "'JetBrains Mono',monospace";
let barEls = [], ghostEls = [], legendPctEls = [], kpiEls = [], gaugeEls = [], bindingBarEls = [];

function buildStatic() {
  // zone tints (constant — depend only on rated)
  const zoneDef = [[75, 0.90 * RATED, '#b4530912'], [0.90 * RATED, RATED, '#15803d12'], [RATED, 1.10 * RATED, '#0e749012'], [1.10 * RATED, 1.20 * RATED, '#d9770614'], [1.20 * RATED, 117, '#b91c1c16']];
  el('zones').innerHTML = zoneDef.map((z) => `<div style="position:absolute;top:0;bottom:0;left:${leftPct(z[0])}%;width:${leftPct(z[1]) - leftPct(z[0])}%;background:${z[2]};"></div>`).join('');

  // histogram bars + ghost baseline bars
  el('bars').innerHTML = Array.from({ length: BINS }, () => '<div style="flex:1;height:0%;border-radius:2px 2px 0 0;transition:height .6s cubic-bezier(.4,0,.2,1),background .4s;"></div>').join('');
  el('ghostBars').innerHTML = Array.from({ length: BINS }, () => '<div style="flex:1;height:0%;border:1px dashed #4a5742;border-bottom:none;border-radius:2px 2px 0 0;transition:height .6s cubic-bezier(.4,0,.2,1);"></div>').join('');
  barEls = [...el('bars').children];
  ghostEls = [...el('ghostBars').children];

  // threshold vlines (constant)
  const vlines = [[RATED, '100% · ' + RATED + 't', '#9aa692', '1px dashed #5f6e58'], [1.10 * RATED, '110%', '#d97706', '1px dashed #d9770699'], [1.20 * RATED, '120%', '#b91c1c', '1px dashed #b91c1c99']];
  el('vlines').innerHTML = vlines.map((v) => `<div style="position:absolute;top:0;bottom:22px;left:${leftPct(v[0])}%;width:0;border-left:${v[3]};z-index:3;"><span style="position:absolute;top:1px;left:5px;font-size:10px;font-family:${M};color:${v[2]};white-space:nowrap;font-weight:600;">${v[1]}</span></div>`).join('');

  // x-axis ticks (constant)
  el('xticks').innerHTML = [75, 85, 95, 105, 115].map((v) => `<span style="position:absolute;left:${leftPct(v)}%;transform:translateX(-50%);font-size:10px;font-family:${M};color:#5f7164;">${Math.round(v / RATED * 100)}%</span>`).join('');

  // legend (labels/colours constant — only % updates)
  const legDef = [['Underload', '#b45309'], ['On-target', '#15803d'], ['Upper-OK', '#0e7490'], ['Over-110', '#d97706'], ['Over-120', '#b91c1c']];
  el('legend').innerHTML = legDef.map((l) => `<div style="display:flex;align-items:center;gap:6px;"><span style="width:9px;height:9px;border-radius:2px;background:${l[1]};"></span><span style="font-size:10px;color:#8a9a83;font-family:${M};">${l[0]}</span><span style="font-size:10px;color:#eef2ea;font-weight:600;font-family:${M};font-variant-numeric:tabular-nums;">—</span></div>`).join('');
  legendPctEls = [...el('legend').children].map((d) => d.lastElementChild);

  // KPI cards
  el('kpiRow').innerHTML = Array.from({ length: 4 }, () => `
    <div style="background:#fff;border:1px solid #e6e3d8;border-radius:15px;padding:14px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span data-r="label" style="font-size:9px;color:#a8a493;font-family:${M};letter-spacing:.09em;text-transform:uppercase;line-height:1.3;font-weight:500;"></span><span data-r="chip" style="font-size:10px;font-weight:600;font-family:${M};white-space:nowrap;font-variant-numeric:tabular-nums;"></span></div>
      <div style="display:flex;align-items:baseline;gap:5px;margin-top:10px;"><span data-r="value" style="line-height:1;letter-spacing:-.025em;font-variant-numeric:tabular-nums;"></span><span data-r="unit" style="font-size:11px;font-weight:500;color:#a8a493;"></span></div>
      <div style="height:4px;background:#ece8de;border-radius:4px;margin-top:13px;overflow:hidden;"><div data-r="bar" style="height:100%;width:0%;border-radius:4px;transition:width .5s,background .4s;"></div></div>
      <div data-r="note" style="font-size:9.5px;color:#a8a493;font-family:${M};margin-top:8px;letter-spacing:.01em;"></div>
    </div>`).join('');
  kpiEls = [...el('kpiRow').children].map((c) => ({
    label: c.querySelector('[data-r=label]'), chip: c.querySelector('[data-r=chip]'), value: c.querySelector('[data-r=value]'),
    unit: c.querySelector('[data-r=unit]'), bar: c.querySelector('[data-r=bar]'), note: c.querySelector('[data-r=note]'),
  }));

  // binding bars
  el('bindingBars').innerHTML = Array.from({ length: 2 }, () => `
    <div><div style="display:flex;justify-content:space-between;font-size:9px;font-family:${M};color:#8a8775;margin-bottom:5px;letter-spacing:.02em;"><span data-r="label" style="white-space:nowrap;"></span><span data-r="value" style="color:#1b1f18;font-weight:600;font-variant-numeric:tabular-nums;"></span></div><div style="height:4px;background:#ece8de;border-radius:4px;overflow:hidden;"><div data-r="bar" style="height:100%;width:0%;border-radius:4px;transition:width .5s,background .4s;"></div></div></div>`).join('');
  bindingBarEls = [...el('bindingBars').children].map((c) => ({ label: c.querySelector('[data-r=label]'), value: c.querySelector('[data-r=value]'), bar: c.querySelector('[data-r=bar]') }));

  // gauges (semicircular dials)
  el('gauges').innerHTML = Array.from({ length: 2 }, () => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;">
      <div data-r="label" style="font-size:8.5px;color:#a8a493;font-family:${M};letter-spacing:.08em;text-align:center;line-height:1.3;height:24px;"></div>
      <svg viewBox="0 0 80 48" style="width:100%;max-width:96px;margin-top:2px;"><path d="M8 44 A32 32 0 0 1 72 44" pathLength="100" fill="none" stroke="#ece8de" stroke-width="6.5" stroke-linecap="round"></path><path data-r="arc" d="M8 44 A32 32 0 0 1 72 44" pathLength="100" fill="none" stroke-width="6.5" stroke-linecap="round" stroke-dasharray="0 100" style="transition:stroke-dasharray .5s,stroke .4s;"></path></svg>
      <div style="margin-top:-6px;text-align:center;"><div data-r="value" style="font-size:20px;font-weight:800;color:#1b1f18;font-family:${M};line-height:1;font-variant-numeric:tabular-nums;"></div><div data-r="sub" style="font-size:8.5px;color:#a8a493;font-family:${M};margin-top:3px;"></div></div>
    </div>`).join('');
  gaugeEls = [...el('gauges').children].map((c) => ({ label: c.querySelector('[data-r=label]'), arc: c.querySelector('[data-r=arc]'), value: c.querySelector('[data-r=value]'), sub: c.querySelector('[data-r=sub]') }));

  // viz tabs (Distribution | Trend)
  const vtDef = [['histogram', 'Distribution'], ['trend', 'Trend']];
  el('vizTabs').innerHTML = vtDef.map((v) => `<button class="p-viztab" data-viz="${v[0]}">${v[1]}</button>`).join('');
  el('vizTabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.viz = b.dataset.viz; paint(); }));

  // scenario inject chips
  const scDef = [['baseline', 'Baseline', '#9a9684'], ['night-drift', 'Night drift', '#b45309'], ['new-op', 'New operator', '#0e7490'], ['scale-drift', 'Scale drift', '#7c3aed']];
  el('scenarios').innerHTML = scDef.map((s) => `<button class="p-scenario" data-sc="${s[0]}"><span style="width:7px;height:7px;border-radius:50%;background:${s[2]};flex-shrink:0;"></span><span style="white-space:nowrap;">${s[1]}</span></button>`).join('');
  el('scenarios').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.scenario = b.dataset.sc; state.applied = false; paint(); }));
}

// ── Paint: recompute the view-model and update the DOM in place ────────────────
function paint() {
  const vm = compute();

  // viz tab + scenario active styling (base styles live in their CSS classes)
  el('vizTabs').querySelectorAll('button').forEach((b) => {
    const on = b.dataset.viz === state.viz;
    b.style.background = on ? '#15803d' : 'transparent';
    b.style.color = on ? '#fff' : '#8b9182';
  });
  el('scenarios').querySelectorAll('button').forEach((b) => {
    const on = b.dataset.sc === state.scenario;
    b.style.background = on ? '#15803d' : '#f5f3ec';
    b.style.color = on ? '#fff' : '#3a382f';
  });

  // KPI cards
  vm.kpis.forEach((k, i) => {
    const e = kpiEls[i];
    e.label.textContent = k.label;
    e.chip.textContent = k.chip; e.chip.style.color = k.chipColor;
    e.value.textContent = k.value; e.value.style.fontSize = k.valSize; e.value.style.fontWeight = k.valWeight; e.value.style.color = k.valColor;
    e.unit.textContent = k.unit;
    e.bar.style.width = k.barPct + '%'; e.bar.style.background = k.barColor;
    e.note.textContent = k.note;
  });

  // viz header + status
  el('vizTitle').textContent = vm.vizTitle;
  el('vizSub').textContent = vm.vizSub;
  el('statusLabel').textContent = vm.statusLabel; el('statusLabel').style.color = vm.statusColor;
  el('loadN').textContent = 'n=' + vm.loadN + ' · 2 shifts';

  // histogram ↔ trend toggle
  el('histView').style.display = vm.isHist ? 'block' : 'none';
  el('trendView').style.display = vm.isHist ? 'none' : 'block';

  if (vm.isHist) {
    vm.bars.forEach((b, i) => { const e = barEls[i]; e.style.height = b.h + '%'; e.style.background = b.fill; e.style.boxShadow = b.glow; e.title = b.tip; });
    el('ghostBars').style.display = vm.showGhost ? 'flex' : 'none';
    if (vm.showGhost) vm.ghostBars.forEach((g, i) => { ghostEls[i].style.height = g.h + '%'; });
    el('meanMarker').style.left = vm.meanLeft + '%';
    el('meanLabel').textContent = 'μ ' + vm.meanLabel + ' t';
    vm.legend.forEach((l, i) => { legendPctEls[i].textContent = l.pct; });
  } else {
    el('trendLine').setAttribute('points', vm.trend.line);
    el('trendArea').setAttribute('points', vm.trend.area);
    el('trendCaption').textContent = 'shift start ' + vm.trend.start + 't → close ' + vm.trend.end + 't';
  }

  // binding constraint
  el('bindingDot').style.background = vm.binding.color;
  el('bindingLabel').textContent = vm.binding.label; el('bindingLabel').style.color = vm.binding.color;
  vm.bindingBars.forEach((b, i) => { const e = bindingBarEls[i]; e.label.textContent = b.label; e.value.textContent = b.value; e.bar.style.width = b.pct + '%'; e.bar.style.background = b.color; });

  // gauges
  vm.gauges.forEach((g, i) => { const e = gaugeEls[i]; e.label.textContent = g.label; e.value.textContent = g.value; e.sub.textContent = g.sub; e.arc.setAttribute('stroke-dasharray', g.frac + ' 100'); e.arc.setAttribute('stroke', g.color); });

  // AI panel
  el('engineTag').textContent = vm.ai.engineTag;
  el('aiHeadline').textContent = vm.ai.headlineSerif;
  el('coCurrent').textContent = vm.co.current;
  el('coOptimised').textContent = vm.co.optimised;
  el('aiValue').textContent = vm.ai.valueLabel;

  // strategy trade-off cards
  el('strategies').innerHTML = vm.strategies.map((s) => `
    <button class="p-strat" data-key="${s.key}" style="cursor:${s.key === 'apply' ? 'pointer' : 'default'};background:${s.active ? '#edf6ef' : '#fff'};border:1.5px solid ${s.active ? '#15803d' : '#e4e1d6'};">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;"><span style="font-size:14px;font-weight:600;color:#1b1f18;letter-spacing:-.01em;white-space:nowrap;">${s.title}</span><span style="font-size:8.5px;font-weight:700;font-family:${M};color:${s.tagColor};letter-spacing:.08em;white-space:nowrap;flex-shrink:0;">${s.tag}</span></div>
      <div style="font-size:11.5px;color:#78745f;line-height:1.5;margin-bottom:11px;">${s.desc}</div>
      <div style="display:flex;gap:16px;">${s.cols.map((c) => `<div><div style="font-size:8.5px;font-family:${M};color:#a8a493;letter-spacing:.08em;">${c.k}</div><div style="font-size:13px;font-weight:700;font-family:${M};color:${c.color};margin-top:2px;font-variant-numeric:tabular-nums;">${c.v}</div></div>`).join('')}</div>
    </button>`).join('');
  const applyCard = el('strategies').querySelector('[data-key=apply]');
  if (applyCard) applyCard.addEventListener('click', () => { state.applied = !state.applied; paint(); });

  // operator actions
  el('operatorActions').innerHTML = vm.ai.operatorActions.map((a) => `
    <div style="display:flex;align-items:center;gap:9px;"><span style="font-size:8px;font-family:${M};font-weight:700;color:${a.color};background:${a.bg};border-radius:4px;padding:3px 5px;text-transform:uppercase;flex-shrink:0;width:66px;text-align:center;letter-spacing:.02em;">${a.action}</span><span style="font-size:11px;color:#46443a;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.who}</span><span style="font-size:11px;font-family:${M};font-weight:700;color:#15803d;flex-shrink:0;font-variant-numeric:tabular-nums;">${a.delta}</span></div>`).join('');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
buildStatic();
paint();
el('witaClock').textContent = witaTime();
setInterval(() => { el('witaClock').textContent = witaTime(); }, 1000);
