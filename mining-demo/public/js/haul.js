// Hauling Optimisation — stockpile→jetty haul-circuit dispatch console.
// Deterministic simulation drives the live route map (always runs); the AI
// dispatch rationale comes from /api/haul/analyze with an unbreakable fallback.
import { renderNav, renderFooter, postJSON, esc, $ } from './shared.js';
import { witaTime } from './sim.js';

renderNav('haul');
renderFooter();

const el = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const usd = (n) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.round(n / 1e3) + 'k');
const NS = 'http://www.w3.org/2000/svg';

const STATE_COLOR = { loading: '#15803d', hauling: '#0e7490', queuing: '#b45309', dumping: '#0f766e', returning: '#64748b', down: '#b91c1c' };
const CST = {
  fleet: { label: 'Fleet', color: '#15803d' },
  loader: { label: 'Loader', color: '#0e7490' },
  'haul-road': { label: 'Haul-road', color: '#b45309' },
  'jetty-hopper': { label: 'Jetty-hopper', color: '#b91c1c' },
};
const BASE_DEMAND = 1900;

// ── Deterministic scenario engine ─────────────────────────────────────────────
const TAG = { reassign: ['#0e7490', '#0c2a32'], hold: ['#b45309', '#2e2008'], release: ['#15803d', '#0e2114'], refuel: ['#a78b2e', '#241f0c'], reroute: ['#7c5cff', '#1a1430'], payload: ['#0f766e', '#0c2622'], surge: ['#15803d', '#0e2114'] };
const fa = (unit, action, detail, delta) => ({ unit, action, detail, delta: (delta >= 0 ? '+' : '') + delta + ' t/h', deltaColor: delta >= 0 ? '#5cc77e' : '#e06666', tagColor: (TAG[action] || ['#8a9384', '#1d251a'])[0], tagBg: (TAG[action] || ['#8a9384', '#1d251a'])[1] });

function buildMetrics(key) {
  const D = BASE_DEMAND;
  const base = { demand: D };
  if (key === 'truck-down') return { ...base, delivered: 1815, mf: 0.92, util: 84, hopPct: 41, hopMin: 7, binding: 'fleet',
    bars: { loader: 70, 'haul-road': 68, 'jetty-hopper': 58, fleet: 95 },
    cnote: 'One truck out drops the loaded count below the loaders’ feed rate — under-trucked.',
    headline: 'HT-105 down — delivered 1,815 t/h, 85 below the 1,900 demand line. Re-balance recovers it.',
    current: 1815, optimised: 1900,
    fa: [fa('HT-104', 'reassign', 'Pull from LD-2 spare to LD-1 to refill its cadence', 45), fa('HT-102', 'release', 'End crib break early, return to circuit now', 25), fa('HT-107', 'payload', 'Lift to 90 t within 10/10/20 policy', 15)],
    recs: [{ action: 'Re-balance fleet 5/3 across loaders', impact: '+85 t/h, queue −2 min/cyc', timeframe: 'now' }, { action: 'Stagger HT-103 refuel to 11:40', impact: 'holds feed above demand line', timeframe: '+25 min' }, { action: 'Flag HT-105 cycle-time outlier to Maintenance', impact: 'pre-empts a second failure', timeframe: 'this shift' }],
    value: 1.9e6,
    narrative: 'A single truck loss pushes the fleet under-trucked (MF 0.92), starving the loaders and dipping delivery 85 t/h below the barge demand. Reassigning the LD-2 spare and ending one crib break early restores match factor to ~1.0 and lifts delivery back to the 1,900 line, protecting the coupled barge’s laycan window.',
    actions: { 'HT-104': '→ LD-1 (reassign +45 t/h)', 'HT-102': 'Release from crib break', 'HT-105': 'DOWN — hand to Maintenance', 'HT-107': 'Payload → 90 t' },
    down: ['HT-105'], loaderDown: null, wet: false, surge: false, moved: ['HT-104', 'HT-102'], parsed: 'Parsed: 1 truck DOWN (HT-105) → re-balance' };
  if (key === 'loader-down') return { ...base, delivered: 1560, mf: 1.28, util: 79, hopPct: 28, hopMin: 5, binding: 'loader',
    bars: { loader: 100, 'haul-road': 60, 'jetty-hopper': 47, fleet: 72 },
    cnote: 'All ore funnels through LD-1 — trucks bunch and queue (over-trucked on one loader).',
    headline: 'LD-2 down — single-loader cap holds delivery to ~1,740 t/h. Hold trucks to kill the queue.',
    current: 1560, optimised: 1740,
    fa: [fa('HT-106', 'hold', 'Park as spare — LD-1 can’t absorb 9 trucks', 0), fa('HT-108', 'hold', 'Stage at SP-1; release as LD-1 frees', 0), fa('HT-103', 'payload', 'Max policy payload to lift per-cycle tonnes', 40), fa('HT-101', 'reassign', 'Tighten spot time at LD-1', 30)],
    recs: [{ action: 'Hold 3 trucks — run LD-1 at MF 1.0', impact: 'queue 6→2 min/cyc, +180 t/h recovered', timeframe: 'now' }, { action: 'Expedite LD-2 repair', impact: 'restores +180 t/h marginal capacity', timeframe: 'ETA 90 min' }, { action: 'Surge payload to policy ceiling on LD-1', impact: '+40 t/h within 10/10/20', timeframe: 'now' }],
    value: 4.2e6,
    narrative: 'With LD-2 out, the loader becomes the binding constraint: nine trucks chasing one loader drives MF to 1.28 and bunches the queue, yet delivery is capped at single-loader capacity (~1,740 t/h). Holding three trucks as spares restores MF to ~1.0 and cuts queue loss; the only path past 1,740 is bringing LD-2 back, worth +180 t/h marginal. Hopper buffer is the live risk at 5 minutes.',
    actions: { 'HT-106': 'HOLD — spare', 'HT-108': 'HOLD — stage SP-1', 'HT-103': 'Payload → ceiling', 'HT-101': '→ LD-1 tighten spot', 'HT-107': '→ LD-1 (reassign)', 'HT-109': '→ LD-1 (reassign)' },
    down: [], loaderDown: 'LD-2', wet: false, surge: false, moved: ['HT-106', 'HT-107', 'HT-108', 'HT-109', 'HT-101'], parsed: 'Parsed: LOADER DOWN (LD-2) → hold 3, expedite repair' };
  if (key === 'road-wet') return { ...base, delivered: 1735, mf: 0.97, util: 83, hopPct: 44, hopMin: 8, binding: 'haul-road',
    bars: { loader: 74, 'haul-road': 96, 'jetty-hopper': 60, fleet: 88 },
    cnote: 'Wet 8% ramp cuts traction — cycle time stretches and TKPH headroom thins.',
    headline: 'Ramp wet — cycle time +2.4 min stretches the haul-road to the binding constraint.',
    current: 1735, optimised: 1880,
    fa: [fa('LD-1', 'payload', 'Trim to 88 t to protect tyre TKPH on the wet grade', -10), fa('HT-102', 'reroute', 'Eco-speed downhill, 22 km/h cap on ramp', 35), fa('HT-105', 'reroute', 'Same speed discipline — no bunching on grade', 30)],
    recs: [{ action: 'Schedule watering passes off-peak', impact: 'dust control without traction loss, +90 t/h', timeframe: 'now' }, { action: 'Cap ramp speed at 22 km/h', impact: 'protects TKPH, fuel −0.4 L/t', timeframe: 'now' }, { action: 'Trim payload to 88 t on wet cycles', impact: 'tyre-failure risk down, holds cadence', timeframe: 'until ramp dries' }],
    value: 2.6e6,
    narrative: 'Watering the wet 8% ramp protects against dust but cuts traction, stretching cycle time and pushing the haul-road to 96% — the binding constraint. Capping ramp speed at 22 km/h and trimming payload to 88 t protects tyre TKPH in wet-season heat while recovering ~145 t/h. The loaders and hopper still have slack, so the road is where the AI spends its moves.',
    actions: { 'LD-1': 'Payload → 88 t', 'HT-102': 'Eco-speed + 22 km/h cap', 'HT-105': 'Speed discipline on grade', 'HT-103': '22 km/h ramp cap' },
    down: [], loaderDown: null, wet: true, surge: false, moved: ['HT-102', 'HT-105'], parsed: 'Parsed: RAMP WET → watering + speed cap' };
  if (key === 'demand-surge') { const dd = Math.round(D * 1.16); return { ...base, demand: dd, delivered: 2080, mf: 1.04, util: 92, hopPct: 35, hopMin: 6, binding: 'fleet',
    bars: { loader: 90, 'haul-road': 85, 'jetty-hopper': 78, fleet: 97 },
    cnote: 'Laycan-critical barge lifts demand to ' + fmt(dd) + ' t/h — fleet is now the binding constraint.',
    headline: 'Laycan-critical barge — demand ' + fmt(dd) + ' t/h. Surge the fleet to build buffer ahead of the window.',
    current: 2080, optimised: 2150,
    fa: [fa('HT-106', 'surge', 'All 9 in circuit — defer crib breaks 30 min', 40), fa('HT-108', 'surge', 'Hold zero spares, max cadence', 20), fa('LD-2', 'payload', 'Policy-ceiling payloads to chase demand', 10), fa('HT-101', 'refuel', 'Top-off staggered to never drop feed', 0)],
    recs: [{ action: 'Surge all 9 trucks, defer crib breaks', impact: '+70 t/h, builds hopper buffer pre-window', timeframe: 'now → load window' }, { action: 'Accept +0.3 L/t fuel to chase demand', impact: 'demurrage protection outweighs fuel', timeframe: 'this barge' }, { action: 'Pre-build hopper to 80% before swell', impact: 'covers forecast 14:00 swell stall', timeframe: '+2 h' }],
    value: 5.6e6,
    narrative: 'A laycan-critical barge lifts loadout demand to ' + fmt(dd) + ' t/h, making the fleet the binding constraint at full surge (~2,150 t/h achievable). The AI deploys all nine trucks, defers crib breaks, and pre-builds the hopper to 80% ahead of the load window and a forecast 14:00 swell — accepting a small fuel-per-tonne penalty because protected demurrage on the coupled barge dwarfs it.',
    actions: { 'HT-106': 'SURGE — defer crib', 'HT-108': 'SURGE — max cadence', 'LD-2': 'Payload → ceiling', 'HT-101': 'Staggered top-off' },
    down: [], loaderDown: null, wet: false, surge: true, moved: ['HT-106', 'HT-108'], parsed: 'Parsed: DEMAND SURGE (laycan-critical) → fleet surge' }; }
  return { ...base, delivered: 1985, mf: 1.01, util: 88, hopPct: 68, hopMin: 13, binding: 'fleet',
    bars: { loader: 82, 'haul-road': 71, 'jetty-hopper': 64, fleet: 90 },
    cnote: 'Fleet near balanced — loaders carry slack; small moves bank headroom.',
    headline: 'Delivered 1,985 t/h vs 1,900 demand — meeting demand with 4% headroom.',
    current: 1985, optimised: 2010,
    fa: [fa('HT-103', 'refuel', 'Stagger refuel to 11:40 to avoid feed dip', 0), fa('HT-108', 'hold', 'Brief hold — trim MF from 1.04 toward 1.0', 15), fa('LD-2', 'payload', 'Nudge mean payload to 89 t', 10)],
    recs: [{ action: 'Stagger refuels & crib breaks', impact: 'keeps feed above demand, +25 t/h', timeframe: 'rolling' }, { action: 'Hold MF in 0.98–1.03 band', impact: 'queue under 2 min/cyc', timeframe: 'continuous' }, { action: 'Bank hopper buffer to 75% pre-shift-change', impact: 'covers 19:00 handover gap', timeframe: '+3 h' }],
    value: 2.4e6,
    narrative: 'The circuit is running balanced — MF 1.01, delivery 4% above the barge demand line, hopper buffer a healthy 13 minutes. The AI’s moves here are about banking headroom: staggering refuels and trimming match factor toward 1.0 keep the queue minimal and pre-build buffer ahead of the 19:00 shift handover.',
    actions: { 'HT-103': 'Stagger refuel 11:40', 'HT-108': 'Brief hold', 'LD-2': 'Payload → 89 t' },
    down: [], loaderDown: null, wet: false, surge: false, moved: [], parsed: '' };
}

// ── Simulation ────────────────────────────────────────────────────────────────
const GEO = {
  loadedLD1: [[120, 130], [250, 150], [340, 175], [700, 175], [840, 185]],
  loadedLD2: [[120, 320], [250, 235], [340, 175], [700, 175], [840, 185]],
  returnLD1: [[840, 235], [700, 250], [340, 250], [250, 165], [120, 130]],
  returnLD2: [[840, 235], [700, 250], [340, 250], [250, 300], [120, 320]],
};
const LOADER_POS = { 'LD-1': [116, 130], 'LD-2': [116, 320] };
const T = { load: 2.4, haul: 7.0, dump: 1.8, ret: 6.0 };
let trucks = [], loaders, hopper, speedMult = 1, tnodes = [], hopDisp = 68, history = [], last = 0;
let m = buildMetrics('optimise');

function initSim() {
  loaders = { 'LD-1': { busy: false, down: false }, 'LD-2': { busy: false, down: false } };
  hopper = { bays: 0, max: 2 };
  const ids = ['HT-101', 'HT-102', 'HT-103', 'HT-104', 'HT-105', 'HT-106', 'HT-107', 'HT-108', 'HT-109'];
  const orig = { 'HT-101': 'LD-1', 'HT-102': 'LD-1', 'HT-103': 'LD-1', 'HT-104': 'LD-1', 'HT-105': 'LD-1', 'HT-106': 'LD-2', 'HT-107': 'LD-2', 'HT-108': 'LD-2', 'HT-109': 'LD-2' };
  trucks = ids.map((id, i) => {
    const ph = i / ids.length;
    const t = { id, num: id.replace('HT-', ''), loader: orig[id], origLoader: orig[id], payload: 88 + Math.round(Math.random() * 5), lastCycle: 18 + Math.round(Math.random() * 3), timer: 0, prog: 0, state: 'hauling', moved: false };
    if (ph < 0.5) { t.state = 'hauling'; t.prog = ph * 2; } else { t.state = 'returning'; t.prog = (ph - 0.5) * 2; }
    return t;
  });
  // build truck nodes
  const layer = el('truckLayer'); layer.innerHTML = '';
  tnodes = trucks.map((t) => {
    const g = document.createElementNS(NS, 'g');
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '7.5'); c.setAttribute('stroke', 'rgba(255,255,255,0.35)'); c.setAttribute('stroke-width', '1.5'); c.setAttribute('fill', '#64748b');
    const tx = document.createElementNS(NS, 'text'); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('y', '-11'); tx.setAttribute('font-family', "'JetBrains Mono',monospace"); tx.setAttribute('font-size', '8'); tx.setAttribute('font-weight', '700'); tx.setAttribute('fill', '#aeb6a5'); tx.textContent = t.num;
    g.appendChild(c); g.appendChild(tx); layer.appendChild(g); return g;
  });
}

function lerp(pts, f) {
  f = Math.max(0, Math.min(1, f));
  let segs = [], tot = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(l); tot += l; }
  let d = f * tot;
  for (let i = 0; i < segs.length; i++) { if (d <= segs[i] || i === segs.length - 1) { const tt = segs[i] ? d / segs[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * tt, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * tt]; } d -= segs[i]; }
  return pts[pts.length - 1];
}
const downIdx = (id) => trucks.filter((t) => t.state === 'down').findIndex((t) => t.id === id);
function setBadge(g, txt, n) { el(g).setAttribute('opacity', n > 0 ? '1' : '0'); if (n > 0) el(txt).textContent = n; }

function step(ts) {
  const dt = Math.min(0.6, (ts - last) / 1000); last = ts;
  const sm = speedMult;
  trucks.forEach((t) => {
    if (t.state === 'down') return;
    if (t.state === 'loading') { t.timer -= dt; if (t.timer <= 0) { loaders[t.loader].busy = false; t.state = 'hauling'; t.prog = 0; t.payload = 86 + Math.round(Math.random() * 6); t._cstart = ts; } }
    else if (t.state === 'hauling') { t.prog += dt / (T.haul * sm); if (t.prog >= 1) { t.prog = 1; if (hopper.bays < hopper.max) { hopper.bays++; t.state = 'dumping'; t.timer = T.dump; } else t.state = 'qhopper'; } }
    else if (t.state === 'qhopper') { if (hopper.bays < hopper.max) { hopper.bays++; t.state = 'dumping'; t.timer = T.dump; } }
    else if (t.state === 'dumping') { t.timer -= dt; if (t.timer <= 0) { hopper.bays--; t.state = 'returning'; t.prog = 0; if (t._cstart) t.lastCycle = Math.round(17 + (ts - t._cstart) / 1000 * 0.4 + (sm > 1 ? 2.4 : 0)); } }
    else if (t.state === 'returning') { t.prog += dt / (T.ret * sm); if (t.prog >= 1) { t.prog = 1; const L = loaders[t.loader]; if (!L.down && !L.busy) { L.busy = true; t.state = 'loading'; t.timer = T.load; } else t.state = 'qloader'; } }
    else if (t.state === 'qloader') { const L = loaders[t.loader]; if (!L.down && !L.busy) { L.busy = true; t.state = 'loading'; t.timer = T.load; } }
  });
  const qlc = { 'LD-1': 0, 'LD-2': 0 }; let qhc = 0;
  trucks.forEach((t, i) => {
    let x, y;
    if (t.state === 'down') { x = 44 + downIdx(t.id) * 30; y = 388; }
    else if (t.state === 'loading') { const lp = LOADER_POS[t.loader]; x = lp[0] + 34; y = lp[1]; }
    else if (t.state === 'qloader') { const k = qlc[t.loader]++; const lp = LOADER_POS[t.loader]; x = lp[0] + 58 + k * 22; y = lp[1] + (t.loader === 'LD-1' ? -6 : 6); }
    else if (t.state === 'dumping') { x = 820; y = 200; }
    else if (t.state === 'qhopper') { const k = qhc++; x = 748 - k * 22; y = 176; }
    else if (t.state === 'hauling') { const p = lerp(t.loader === 'LD-1' ? GEO.loadedLD1 : GEO.loadedLD2, t.prog); x = p[0]; y = p[1]; }
    else { const p = lerp(t.loader === 'LD-1' ? GEO.returnLD1 : GEO.returnLD2, t.prog); x = p[0]; y = p[1]; }
    const st = (t.state === 'qloader' || t.state === 'qhopper') ? 'queuing' : t.state;
    const node = tnodes[i];
    node.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
    const c = node.querySelector('circle');
    c.setAttribute('fill', t.state === 'down' ? '#10150f' : (STATE_COLOR[st] || '#64748b'));
    c.setAttribute('stroke', t.state === 'down' ? '#b91c1c' : 'rgba(255,255,255,0.35)');
    c.setAttribute('stroke-width', t.state === 'down' ? '2.5' : '1.5');
  });
  setBadge('q1Badge', 'q1Text', qlc['LD-1']); setBadge('q2Badge', 'q2Text', qlc['LD-2']); setBadge('qhBadge', 'qhText', qhc);
  hopDisp += (m.hopPct - hopDisp) * Math.min(1, dt * 2);
  const h0 = 100, y0 = 152, h = Math.max(2, hopDisp / 100 * h0);
  const hf = el('hopFill'); hf.setAttribute('height', h.toFixed(1)); hf.setAttribute('y', (y0 + h0 - h).toFixed(1));
  hf.setAttribute('fill', m.hopMin < 6 ? '#b91c1c' : (m.hopMin < 10 ? '#b45309' : '#15803d'));
  el('hopPct').textContent = Math.round(hopDisp) + '%';
}
function frame(ts) { step(ts); requestAnimationFrame(frame); }

function tick() {
  step(performance.now());
  history.push({ d: m.delivered + (Math.random() - 0.5) * 22, dem: m.demand });
  if (history.length > 30) history.shift();
  el('hopMin').textContent = m.hopMin + ' min';
  el('hopDemand').textContent = 'DEMAND ' + fmt(m.demand) + ' t/h';
  drawTrends();
  if (el('pane-dispatch').style.display !== 'none') renderDispatch();
}

function drawTrends() {
  const w = 420, h = 150, lo = 1400, hi = 2300;
  const sx = (i) => i / (history.length - 1) * w, sy = (v) => h - ((v - lo) / (hi - lo)) * h;
  el('deliveredLine').setAttribute('points', history.map((p, i) => sx(i).toFixed(1) + ',' + sy(p.d).toFixed(1)).join(' '));
  el('demandLine').setAttribute('points', history.map((p, i) => sx(i).toFixed(1) + ',' + sy(p.dem).toFixed(1)).join(' '));
  el('trendNow').textContent = fmt(m.delivered); el('trendDemand').textContent = fmt(m.demand);
  const frac = Math.max(0, Math.min(1, (m.mf - 0.7) / 0.6)), ang = (-90 + frac * 180) * Math.PI / 180;
  const nd = el('mfNeedle'); nd.setAttribute('x2', (100 + Math.sin(ang) * 64).toFixed(1)); nd.setAttribute('y2', (120 - Math.cos(ang) * 64).toFixed(1));
  const mv = el('mfVal'); mv.textContent = m.mf.toFixed(2); mv.style.color = (m.mf >= 0.95 && m.mf <= 1.05) ? '#5cc77e' : '#e0a44a';
  const bf = Math.max(0, Math.min(1, m.hopMin / 20)), a0 = Math.PI, a1 = Math.PI - bf * Math.PI;
  const x0 = 100 + 80 * Math.cos(a0), y0b = 120 - 80 * Math.sin(a0), x1 = 100 + 80 * Math.cos(a1), y1 = 120 - 80 * Math.sin(a1);
  const ba = el('bufArc'); ba.setAttribute('d', `M${x0.toFixed(1)} ${y0b.toFixed(1)} A80 80 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`);
  ba.setAttribute('stroke', m.hopMin < 6 ? '#b91c1c' : (m.hopMin < 10 ? '#b45309' : '#15803d'));
  el('bufVal').innerHTML = m.hopMin + '<span> min</span>';
}

function applySimFlags(metrics, initial) {
  trucks.forEach((t, i) => { if (t.state === 'down') { t.state = 'returning'; t.prog = 0.5; } t.loader = t.origLoader; t.moved = false; const c = tnodes[i].querySelector('circle'); if (c) c.style.animation = ''; });
  loaders['LD-1'].down = false; loaders['LD-2'].down = false;
  speedMult = metrics.wet ? 1.45 : 1;
  (metrics.down || []).forEach((id) => { const t = trucks.find((x) => x.id === id); if (t) t.state = 'down'; });
  if (metrics.loaderDown) { loaders[metrics.loaderDown].down = true; const other = metrics.loaderDown === 'LD-2' ? 'LD-1' : 'LD-2'; trucks.forEach((t) => { if (t.origLoader === metrics.loaderDown && t.state !== 'down') { t.loader = other; t.moved = true; } }); }
  if (!initial) { const mv = new Set(metrics.moved || []); trucks.forEach((t, i) => { if (mv.has(t.id)) { t.moved = true; const c = tnodes[i].querySelector('circle'); if (c) { c.style.transformBox = 'fill-box'; c.style.transformOrigin = 'center'; c.style.animation = 'osPulse 0.9s ease 3'; setTimeout(() => { if (c) c.style.animation = ''; }, 2800); } } }); }
  el('ld2Down').setAttribute('opacity', metrics.loaderDown === 'LD-2' ? '0.28' : '0');
}

// ── Panel rendering ───────────────────────────────────────────────────────────
function renderKPIs() {
  const dDelta = m.delivered - m.demand;
  const inBand = m.mf >= 0.95 && m.mf <= 1.05;
  const cards = [
    { label: 'Delivered vs demand', value: fmt(m.delivered), unit: 't/h', delta: (dDelta >= 0 ? '+' : '−') + fmt(Math.abs(dDelta)), deltaColor: dDelta >= 0 ? '#15803d' : '#b91c1c', barW: Math.min(100, m.delivered / 2300 * 100), barColor: dDelta >= 0 ? '#15803d' : '#b91c1c', sub: 'demand ' + fmt(m.demand) + ' t/h' },
    { label: 'Match factor', value: m.mf.toFixed(2), unit: 'ratio', delta: inBand ? 'balanced' : (m.mf < 0.95 ? 'under' : 'over'), deltaColor: inBand ? '#15803d' : '#b45309', barW: Math.max(4, Math.min(100, (m.mf - 0.7) / 0.6 * 100)), barColor: inBand ? '#15803d' : '#b45309', sub: 'target 0.95–1.05' },
    { label: 'Fleet utilisation', value: m.util, unit: '%', delta: (m.util >= 85 ? '+' : '−') + Math.abs(m.util - 85), deltaColor: m.util >= 85 ? '#15803d' : '#b45309', barW: m.util, barColor: m.util >= 85 ? '#15803d' : '#b45309', sub: 'productive ÷ available' },
    { label: 'Hopper buffer', value: m.hopMin, unit: 'min', delta: m.hopMin >= 10 ? 'safe' : (m.hopMin >= 6 ? 'watch' : 'critical'), deltaColor: m.hopMin >= 10 ? '#15803d' : (m.hopMin >= 6 ? '#b45309' : '#b91c1c'), barW: m.hopPct, barColor: m.hopMin >= 10 ? '#15803d' : (m.hopMin >= 6 ? '#b45309' : '#b91c1c'), sub: m.hopPct + '% fill · to starve' },
  ];
  el('kpiRow').innerHTML = cards.map((k) => `
    <div class="haul-kpi">
      <div class="hk-top"><span class="hk-label">${k.label}</span><span class="hk-delta" style="color:${k.deltaColor}">${k.delta}</span></div>
      <div class="hk-val">${k.value}<span>${k.unit}</span></div>
      <div class="hk-bar"><div style="width:${k.barW}%;background:${k.barColor}"></div></div>
      <div class="hk-sub">${k.sub}</div>
    </div>`).join('');
}

function renderConstraint() {
  const c = CST[m.binding];
  el('cstSquare').style.background = c.color; el('cstSquare').style.boxShadow = `0 0 0 4px ${c.color}22`;
  el('cstName').textContent = c.label;
  el('cstNote').textContent = m.cnote;
  el('cstBars').innerHTML = Object.entries(m.bars).map(([name, pct]) => {
    const isB = name === m.binding;
    const col = isB ? c.color : (pct >= 92 ? '#b45309' : pct >= 80 ? '#0e7490' : '#15803d');
    return `<div class="hcb"><div class="hcb-top"><span style="color:${isB ? c.color : '#8b9182'}">${name.replace('-', ' ')}</span><span style="color:${isB ? c.color : '#1a1f17'}">${pct}%</span></div><div class="hcb-bar"><div style="width:${pct}%;background:${col}"></div></div></div>`;
  }).join('');
}

function renderDispatch() {
  const sortKey = state.sort, dir = state.sortDir;
  const rows = trucks.map((t) => {
    const st = (t.state === 'qloader' || t.state === 'qhopper') ? 'queuing' : t.state;
    return { id: t.id, num: t.num, state: st.toUpperCase(), color: STATE_COLOR[st] || '#64748b', loader: t.loader, cycle: t.lastCycle + '′', cycleN: t.lastCycle, payload: t.payload + ' t', payloadN: t.payload, action: m.actions[t.id] || '—', moved: t.moved };
  });
  rows.sort((a, b) => {
    let av, bv;
    if (sortKey === 'cycle') { av = a.cycleN; bv = b.cycleN; } else if (sortKey === 'payload') { av = a.payloadN; bv = b.payloadN; } else { av = a[sortKey]; bv = b[sortKey]; }
    return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
  });
  el('dispatchBody').innerHTML = rows.map((r) => `
    <tr style="${r.moved ? 'background:rgba(20,60,30,0.16)' : ''}">
      <td class="mono b">${r.id}</td>
      <td><span class="hd-state"><span class="dot" style="background:${r.color}"></span><span style="color:${r.color}">${r.state}</span></span></td>
      <td class="mono">${r.loader}</td>
      <td class="r mono" style="color:${r.cycleN > 22 ? '#b45309' : '#c6cebf'}">${r.cycle}</td>
      <td class="r mono" style="color:${r.payloadN > 91 ? '#b45309' : '#c6cebf'}">${r.payload}</td>
      <td style="color:${r.moved ? '#5cc77e' : '#9aa091'}">${esc(r.action)}</td>
    </tr>`).join('');
}

function renderAIPanel() {
  el('aiHeadline').textContent = m.headline;
  el('aiCurrent').innerHTML = fmt(m.current) + '<span> t/h</span>';
  el('aiOptimised').innerHTML = fmt(m.optimised) + '<span> t/h</span>';
  el('aiValue').textContent = usd(m.value);
  el('aiActions').innerHTML = m.fa.map((f) => `
    <div class="ha-action">
      <span class="ha-unit">${f.unit}</span>
      <span class="ha-tag" style="color:${f.tagColor};background:${f.tagBg}">${f.action}</span>
      <span class="ha-detail">${esc(f.detail)}</span>
      <span class="ha-d" style="color:${f.deltaColor}">${f.delta}</span>
    </div>`).join('');
  el('aiRecs').innerHTML = m.recs.map((r) => `
    <div class="ha-rec"><span class="dot"></span><div><span class="a">${esc(r.action)}</span><span class="i"> — ${esc(r.impact)}</span><span class="t"> · ${esc(r.timeframe)}</span></div></div>`).join('');
  el('aiNarrative').textContent = m.narrative;
}

function renderRisks() {
  const risks = [
    { title: 'Wet-ramp traction', ...(m.wet ? { level: 'HIGH', color: '#b91c1c' } : { level: 'LOW', color: '#15803d' }), note: m.wet ? 'Ramp watered — traction down, cycle time stretched on the grade.' : 'Ramp dry; traction nominal on the 8% grade.' },
    { title: 'Tyre TKPH (wet-season heat)', ...(m.wet ? { level: 'FLAGGED', color: '#b45309' } : { level: 'OK', color: '#15803d' }), note: m.wet ? 'Overload on watered grade thins TKPH headroom — trim payload.' : 'TKPH headroom within rating at current payloads.' },
    { title: 'Truck degradation', ...((m.down || []).length ? { level: 'WATCH', color: '#b45309' } : { level: 'LOW', color: '#15803d' }), note: (m.down || []).length ? `${m.down.join(', ')} flagged — cycle-time outlier handed to Maintenance.` : 'Fleet cycle times within band; no degradation signature.' },
    { title: 'Hopper starve', ...(m.hopMin < 6 ? { level: 'CRITICAL', color: '#b91c1c' } : m.hopMin < 10 ? { level: 'WATCH', color: '#b45309' } : { level: 'SAFE', color: '#15803d' }), note: `${m.hopMin} min to starve at current delivery vs demand.` },
  ];
  el('riskList').innerHTML = risks.map((r) => `
    <div class="hr-item"><span class="dot" style="background:${r.color}"></span>
      <div><div class="hr-row"><span class="t">${r.title}</span><span class="lv" style="color:${r.color}">${r.level}</span></div><div class="n">${r.note}</div></div>
    </div>`).join('');
}

const COPILOT = [
  { q: 'What is the binding constraint right now?', a: () => `The binding constraint is ${CST[m.binding].label.toLowerCase()} — utilisation ${m.bars[m.binding]}%. ${m.cnote}` },
  { q: 'How many minutes until the hopper starves?', a: () => `Hopper buffer is ${m.hopMin} min (${m.hopPct}% fill) at ${fmt(m.delivered)} t/h delivered vs ${fmt(m.demand)} t/h demand. ${m.hopMin < 10 ? 'Below the 10-min warning line — protect the feed.' : 'Comfortably above the 10-min warning line.'}` },
  { q: 'Are we over- or under-trucked?', a: () => `Match factor is ${m.mf.toFixed(2)} — ${m.mf < 0.95 ? 'under-trucked, loaders waiting' : m.mf > 1.05 ? 'over-trucked, trucks queuing' : 'balanced'}. Forecast next 4h tracks ${fmt(m.delivered * 4)} t to the jetty.` },
];
function renderCopilot() {
  el('copilotQs').innerHTML = COPILOT.map((c, i) => `<button data-cp="${i}">${c.q}</button>`).join('');
  el('copilotQs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { el('copilotAnswer').textContent = COPILOT[+b.dataset.cp].a(); }));
}

const LEGEND = [['loading', 'Loading'], ['hauling', 'Hauling'], ['queuing', 'Queuing'], ['dumping', 'Dumping'], ['returning', 'Returning'], ['down', 'Down / parked']];
el('haulLegend').innerHTML = LEGEND.map(([k, n]) => `<span class="hl-chip"><i style="background:${STATE_COLOR[k]}"></i>${n}</span>`).join('');

// ── Scenario application + AI ─────────────────────────────────────────────────
const state = { sort: 'id', sortDir: 1 };

async function applyScenario(key) {
  const prev = m.binding;
  m = buildMetrics(key);
  applySimFlags(m, false);
  renderKPIs(); renderConstraint(); renderAIPanel(); renderRisks(); renderDispatch();
  // solving flash + shift indicator
  const solve = el('haulSolve'); solve.style.opacity = '1'; setTimeout(() => { solve.style.opacity = '0'; }, 1400);
  el('cstShift').textContent = (prev !== m.binding && key !== 'optimise') ? `⟳ constraint shifted ${prev.toUpperCase()} → ${m.binding.toUpperCase()}` : '';
  el('haulParsed').textContent = m.parsed || '';
  // live AI rationale (falls back to the deterministic copy when offline)
  try {
    const r = await postJSON('/api/haul/analyze', { scenario: { disruptionId: key, description: m.headline, demandTph: m.demand, deliveredTph: m.delivered, matchFactor: m.mf, hopperBufferMin: m.hopMin } });
    if (r && r.source === 'live') {
      if (r.headline) el('aiHeadline').textContent = r.headline;
      if (r.narrative) el('aiNarrative').textContent = r.narrative;
      if (r.valueImpactUSD) el('aiValue').textContent = usd(r.valueImpactUSD);
      if (typeof r.optimisedRateTph === 'number') el('aiOptimised').innerHTML = fmt(r.optimisedRateTph) + '<span> t/h</span>';
      if (Array.isArray(r.recommendations) && r.recommendations.length) {
        el('aiRecs').innerHTML = r.recommendations.map((rc) => `<div class="ha-rec"><span class="dot"></span><div><span class="a">${esc(rc.action)}</span><span class="i"> — ${esc(rc.impact)}</span><span class="t"> · ${esc(rc.timeframe)}</span></div></div>`).join('');
      }
    }
  } catch { /* deterministic copy already shown */ }
}

function parseFree(text) {
  const t = text.toLowerCase();
  if (/(loader|ld-?\d).*(down|out|fail|broke)|(down|out).*(loader|ld-?\d)/.test(t)) return 'loader-down';
  if (/(wet|rain|ramp|slip|traction|muddy)/.test(t)) return 'road-wet';
  if (/(surge|laycan|demurrage|barge|swell|critical)/.test(t)) return 'demand-surge';
  if (/(ht-?\d|truck).*(down|out|fault|fail|broke)|(down|out|fault).*(truck|ht-?\d)/.test(t)) return 'truck-down';
  return 'optimise';
}

// ── Wiring ────────────────────────────────────────────────────────────────────
const PRESETS = [
  { key: 'truck-down', label: 'Truck down', dot: '#b91c1c' },
  { key: 'loader-down', label: 'Loader down', dot: '#0e7490' },
  { key: 'road-wet', label: 'Ramp wet', dot: '#b45309' },
  { key: 'demand-surge', label: 'Demand surge', dot: '#15803d' },
];
el('haulPresets').innerHTML = PRESETS.map((p) => `<button class="hd-preset" data-key="${p.key}"><span class="dot" style="background:${p.dot}"></span>${p.label}</button>`).join('');
el('haulPresets').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => applyScenario(b.dataset.key)));
el('haulReset').addEventListener('click', () => { el('haulFree').value = ''; applyScenario('optimise'); });
function submitFree() { const v = el('haulFree').value.trim(); if (!v) return; applyScenario(parseFree(v)); }
el('haulFreeBtn').addEventListener('click', submitFree);
el('haulFree').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitFree(); });

document.querySelectorAll('.haul-tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.haul-tab').forEach((t) => t.classList.toggle('active', t === tab));
  for (const p of ['fleet', 'dispatch', 'trends']) el('pane-' + p).style.display = p === tab.dataset.tab ? '' : 'none';
  if (tab.dataset.tab === 'dispatch') renderDispatch();
}));
document.querySelectorAll('.haul-table th[data-sort]').forEach((th) => th.addEventListener('click', () => {
  const k = th.dataset.sort; if (state.sort === k) state.sortDir *= -1; else { state.sort = k; state.sortDir = 1; } renderDispatch();
}));

// ── Boot ──────────────────────────────────────────────────────────────────────
initSim();
applySimFlags(m, true);
hopDisp = m.hopPct;
renderKPIs(); renderConstraint(); renderAIPanel(); renderRisks(); renderCopilot(); renderDispatch();
for (let i = 0; i < 28; i++) history.push({ d: m.delivered + Math.sin(i / 3) * 40, dem: m.demand });
drawTrends();
last = performance.now();
requestAnimationFrame(frame);
setInterval(tick, 550);
setInterval(() => { el('witaClock').textContent = witaTime(); }, 1000);
el('witaClock').textContent = witaTime();
