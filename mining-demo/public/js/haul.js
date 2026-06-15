// Hauling Optimisation — stockpile→jetty haul-circuit dispatch console.
// A deterministic circuit simulation drives the live route map AND the KPIs:
// every tick the live state (active trucks, loaders up, payload, hopper level)
// is fed through the shared haul model, so delivered t/h, match factor, the
// constraint bars and the Monte-Carlo starve risk all emerge from the running
// twin rather than from canned numbers. The dispatch optimiser + narrative come
// from /api/haul/* with the model's own output as an unbreakable fallback.
import { postJSON, esc } from './shared.js';
import { witaTime } from './sim.js';
import { PARAMS, nominalState, computeMetrics, optimise, forecastStarve, fmt, usd } from './haul-scenarios.js';

const el = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const STATE_COLOR = { loading: '#15803d', hauling: '#0e7490', queuing: '#b45309', dumping: '#0f766e', returning: '#64748b', down: '#b91c1c' };
const LEGEND = [
  { name: 'Loading', color: '#15803d' }, { name: 'Hauling', color: '#0e7490' }, { name: 'Queuing', color: '#b45309' },
  { name: 'Dumping', color: '#0f766e' }, { name: 'Returning', color: '#64748b' }, { name: 'Down / parked', color: '#b91c1c' },
];

// ── View-model (pure data, light theme) ───────────────────────────────────────
function viewModel(m, chosen) {
  const cColor = { loader: '#b45309', 'haul-road': '#0e7490', 'jetty-hopper': '#c0392b', fleet: '#15803d' }[m.binding] || '#15803d';
  const cLabel = { loader: 'Loader', 'haul-road': 'Haul-road', 'jetty-hopper': 'Jetty hopper', fleet: 'Fleet' }[m.binding] || m.binding;
  const bars = ['loader', 'haul-road', 'jetty-hopper', 'fleet'].map((name) => {
    const pct = m.bars[name], isB = name === m.binding;
    const color = isB ? cColor : (pct >= 92 ? '#b45309' : (pct >= 80 ? '#0e7490' : '#5f9a6e'));
    return { name: name.replace('-', ' '), pct: pct + '%', w: pct + '%', color, labelColor: isB ? cColor : '#8b9182', valColor: isB ? cColor : '#3a4133' };
  });
  const dDelta = m.delivered - m.demand;
  const kpis = [
    { label: 'Delivered', value: fmt(m.delivered), unit: 't/h', delta: (dDelta >= 0 ? '+' : '−') + fmt(Math.abs(dDelta)), deltaColor: dDelta >= 0 ? '#16915a' : '#c0392b', barW: Math.min(100, m.delivered / m.demand * 100) + '%', barColor: dDelta >= 0 ? '#15803d' : '#b45309', sub: 'demand ' + fmt(m.demand) + ' t/h' },
    { label: 'Match factor', value: m.mf.toFixed(2), unit: 'ratio', delta: (m.mf >= 0.95 && m.mf <= 1.05) ? 'balanced' : (m.mf < 0.95 ? 'under' : 'over'), deltaColor: (m.mf >= 0.95 && m.mf <= 1.05) ? '#16915a' : '#b45309', barW: Math.max(4, Math.min(100, (m.mf - 0.7) / 0.6 * 100)) + '%', barColor: (m.mf >= 0.95 && m.mf <= 1.05) ? '#15803d' : '#b45309', sub: 'target 0.95–1.05' },
    { label: 'Fleet util', value: m.util, unit: '%', delta: (m.util - 85 >= 0 ? '+' : '') + (m.util - 85), deltaColor: m.util >= 85 ? '#16915a' : '#b45309', barW: m.util + '%', barColor: m.util >= 85 ? '#15803d' : '#b45309', sub: 'prod ÷ avail' },
    { label: 'Hopper buffer', value: m.hopMin, unit: 'min', delta: m.hopMin >= 10 ? 'safe' : (m.hopMin >= 6 ? 'watch' : 'critical'), deltaColor: m.hopMin >= 10 ? '#16915a' : (m.hopMin >= 6 ? '#b45309' : '#c0392b'), barW: Math.min(100, m.hopMin / 20 * 100) + '%', barColor: m.hopMin >= 10 ? '#15803d' : (m.hopMin >= 6 ? '#b45309' : '#c0392b'), sub: m.hopPct + '% to starve' },
  ];
  const strategies = ['protect-demand', 'max-throughput', 'min-fuel'].map((k) => {
    const st = m.strategies[k], on = k === chosen;
    return { ...st, key: k, on,
      border: on ? (k === 'protect-demand' ? '#15803d' : '#b45309') : '#e7e4d8',
      bg: on ? (k === 'protect-demand' ? '#eef6ef' : '#fdf4ea') : '#ffffff',
      tagColor: k === 'protect-demand' ? '#15803d' : '#9aa091' };
  });
  const starveColor = m.starvePct >= 30 ? '#c0392b' : (m.starvePct >= 10 ? '#b45309' : '#16915a');
  const mfBal = (m.mf >= 0.95 && m.mf <= 1.05);
  const mfChip = 'MF ' + m.mf.toFixed(2) + ' · ' + (mfBal ? 'balanced' : (m.mf < 0.95 ? 'under-trucked' : 'over-trucked')) + ' — ' + (m.loaderDown ? 'hold spares' : (m.down && m.down.length ? 're-balance' : 'hold 9'));
  const starveChip = 'Hopper-starve 4h: ' + m.starvePct + '%' + (m.minToStarve != null && m.starvePct >= 10 ? ' · ~' + m.minToStarve + ' min' : '');
  const chosenStrat = m.strategies[chosen] || m.strategies['protect-demand'];
  return {
    kpis, bars, legend: LEGEND,
    constraint: { color: cColor, label: cLabel, note: m.cnote, shiftTxt: m.shiftFrom ? ('⟳ ' + m.shiftFrom.toUpperCase() + '→' + m.binding.toUpperCase()) : '' },
    strategies, chosenStrat,
    starveChip, starveColor, mfChip, mfChipColor: mfBal ? '#16915a' : '#b45309',
    ai: { headline: m.headline, current: fmt(m.current), optimised: fmt(chosenStrat.optimised), value: chosenStrat.value },
    actions: m.actions, narrative: m.narrative,
  };
}

// ── Simulation (deterministic circuit) ────────────────────────────────────────
const GEO = {
  loadedLD1: [[120, 130], [250, 150], [340, 175], [700, 175], [840, 185]],
  loadedLD2: [[120, 320], [250, 235], [340, 175], [700, 175], [840, 185]],
  returnLD1: [[840, 235], [700, 250], [340, 250], [250, 165], [120, 130]],
  returnLD2: [[840, 235], [700, 250], [340, 250], [250, 300], [120, 320]],
};
const LOADER_POS = { 'LD-1': [116, 130], 'LD-2': [116, 320] };
const T = { load: 2.4, haul: 7.0, dump: 1.8, ret: 6.0 };
// Hopper control loop: net (delivered−demand) disturbs the level; a restoring
// term models the barge-loadout controller holding the bin toward its setpoint.
const HOP = { TIME_SCALE: 120, DIST_K: 1, RESTORE_K: 1.1 };

let trucks = [], loaders, hopper, speedMult = 1, tnodes = [], last = 0;
let cstate = nominalState('optimise');   // live circuit state
let plan = null;                         // optimiser output (per scenario)
let m = null;                            // merged metrics for rendering
let liveDelivered = 1980;
let chosen = 'protect-demand';
let currentScenarioKey = 'optimise';

// A rigid mining haul-truck glyph (chunky dump tray with an ore load, front
// rock-guard canopy + cab window, big mining tyres). Body stays haul-truck
// yellow; a status pip shows state. The body group flips + scales (~1.4×) and
// faces the direction of travel.
function truckNode(num) {
  const g = document.createElementNS(NS, 'g');
  const inner = document.createElementNS(NS, 'g'); inner.setAttribute('class', 'tbodyG');
  const body = document.createElementNS(NS, 'path');
  body.setAttribute('class', 'tbody');
  body.setAttribute('d', 'M-12 -1 L-12 -8 L-9 -9 L4 -9 L12 -8 L12 -4 L7 -4 L7 -1 Z');
  body.setAttribute('fill', '#f5b81c'); body.setAttribute('stroke', '#20200f'); body.setAttribute('stroke-width', '0.9'); body.setAttribute('stroke-linejoin', 'round');
  const ore = document.createElementNS(NS, 'path');
  ore.setAttribute('d', 'M-11 -8.4 Q-7 -11.4 -3 -9.4 Q1 -11.4 5 -9.4 Q8 -10.2 10.5 -8.4 Z');
  ore.setAttribute('fill', '#8a7651'); ore.setAttribute('stroke', '#20200f'); ore.setAttribute('stroke-width', '0.4');
  const win = document.createElementNS(NS, 'path');
  win.setAttribute('d', 'M8 -3.7 L10.6 -3.7 L10.6 -1.8 L8 -1.8 Z'); win.setAttribute('fill', '#0d1a22');
  const mk = (cx, r) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', cx); c.setAttribute('cy', '1.8'); c.setAttribute('r', r); c.setAttribute('fill', '#14130b'); return c; };
  const hub = (cx, r) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', cx); c.setAttribute('cy', '1.8'); c.setAttribute('r', r); c.setAttribute('fill', '#c9a227'); return c; };
  inner.append(body, ore, win, mk(-6.5, 3.2), mk(7, 2.9), hub(-6.5, 1.1), hub(7, 1));
  const pip = document.createElementNS(NS, 'circle'); pip.setAttribute('class', 'tpip'); pip.setAttribute('cx', '13'); pip.setAttribute('cy', '-11'); pip.setAttribute('r', '2.4'); pip.setAttribute('fill', '#cdd6c6'); pip.setAttribute('stroke', '#0e140d'); pip.setAttribute('stroke-width', '0.8');
  const tx = document.createElementNS(NS, 'text'); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('y', '-15'); tx.setAttribute('font-family', "'JetBrains Mono',monospace"); tx.setAttribute('font-size', '8'); tx.setAttribute('font-weight', '700'); tx.setAttribute('fill', '#aeb6a5'); tx.textContent = num;
  g.append(inner, pip, tx);
  return g;
}

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
  const layer = el('truckLayer'); layer.innerHTML = '';
  tnodes = trucks.map((t) => { const g = truckNode(t.num); layer.appendChild(g); return g; });
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
    // Face the direction of travel (nose left when returning/at the jetty), ~1.4× size.
    const faceLeft = (t.state === 'returning' || t.state === 'qhopper' || t.state === 'dumping');
    node.querySelector('.tbodyG').setAttribute('transform', faceLeft ? 'scale(-1.4,1.4)' : 'scale(1.4,1.4)');
    const down = t.state === 'down';
    const body = node.querySelector('.tbody');
    body.setAttribute('fill', down ? '#3a3a28' : '#f5b81c');           // yellow body; muted when parked
    body.setAttribute('stroke', down ? '#c0392b' : '#20200f');
    body.setAttribute('stroke-width', down ? '1.5' : '0.9');
    node.querySelector('.tpip').setAttribute('fill', STATE_COLOR[st] || '#64748b'); // state via status pip
  });
  setBadge('q1Badge', 'q1Text', qlc['LD-1']); setBadge('q2Badge', 'q2Text', qlc['LD-2']); setBadge('qhBadge', 'qhText', qhc);

  // Emergent hopper level: integrate delivered−demand with a controller pulling
  // toward the setpoint (the barge loadout throttles to protect the bin).
  const capT = PARAMS.HOP_CAP_MIN / 60 * cstate.demand;
  const disturb = (liveDelivered - cstate.demand) / capT * 100;          // %/mine-hr
  const restore = (PARAMS.HOP_SETPOINT - cstate.hopLevel) * HOP.RESTORE_K;
  const dLevelPerHr = disturb * HOP.DIST_K + restore;
  cstate.hopLevel = clamp(cstate.hopLevel + dLevelPerHr * (dt * HOP.TIME_SCALE / 3600), 0, 100);

  const h0 = 100, y0 = 152, h = Math.max(2, cstate.hopLevel / 100 * h0);
  const hopMinLive = cstate.hopLevel / 100 * PARAMS.HOP_CAP_MIN;
  const hf = el('hopFill'); hf.setAttribute('height', h.toFixed(1)); hf.setAttribute('y', (y0 + h0 - h).toFixed(1));
  hf.setAttribute('fill', hopMinLive < 6 ? '#c0392b' : (hopMinLive < 10 ? '#b45309' : '#15803d'));
  el('hopPct').textContent = Math.round(cstate.hopLevel) + '%';
}
function frame(ts) { step(ts); requestAnimationFrame(frame); }

// ── Live model: recompute emergent KPIs from the running sim ───────────────────
function readObservables() {
  const up = trucks.filter((t) => t.state !== 'down');
  cstate.active = up.length;
  cstate.loadersUp = (loaders['LD-1'].down ? 0 : 1) + (loaders['LD-2'].down ? 0 : 1);
  cstate.payload = up.length ? up.reduce((a, t) => a + t.payload, 0) / up.length : PARAMS.PAYLOAD;
  cstate.wet = speedMult > 1;
  cstate.ct = PARAMS.CT_NOM * (cstate.wet ? PARAMS.WET_CT : 1) * (cstate.cadence || 1);
}
let mcAccum = 0;
function refreshLive(dtMs = 550) {
  readObservables();
  const live = computeMetrics(cstate);
  liveDelivered = live.delivered;
  // Re-run the Monte-Carlo every ~2s (it's the only non-trivial cost).
  mcAccum += dtMs;
  let starve = m ? { starvePct: m.starvePct, minToStarve: m.minToStarve } : { starvePct: 0, minToStarve: null };
  if (mcAccum >= 2000 || !m) { mcAccum = 0; starve = forecastStarve(cstate, live, plan ? plan.optimised : live.delivered, 300); }
  m = { ...live, ...plan, starvePct: starve.starvePct, minToStarve: starve.minToStarve,
    wet: cstate.wet, down: cstate.downIds, loaderDown: cstate.loaderDown, shiftFrom: m ? m.shiftFrom : null };
  const vm = viewModel(m, chosen);
  renderKPIs(vm); renderConstraint(vm); renderChips(vm); drawGauges();
  el('hopMin').textContent = m.hopMin + ' min';
  el('hopDemand').textContent = 'DEMAND ' + fmt(m.demand) + ' t/h';
}

function drawGauges() {
  const frac = Math.max(0, Math.min(1, (m.mf - 0.7) / 0.6)), ang = (-90 + frac * 180) * Math.PI / 180;
  const nd = el('mfNeedle'); nd.setAttribute('x2', (100 + Math.sin(ang) * 64).toFixed(1)); nd.setAttribute('y2', (120 - Math.cos(ang) * 64).toFixed(1));
  const mv = el('mfVal'); mv.textContent = m.mf.toFixed(2); mv.style.color = (m.mf >= 0.95 && m.mf <= 1.05) ? '#15803d' : '#b45309';
  const bf = Math.max(0, Math.min(1, m.hopMin / 20)), a0 = Math.PI, a1 = Math.PI - bf * Math.PI;
  const x0 = 100 + 80 * Math.cos(a0), y0b = 120 - 80 * Math.sin(a0), x1 = 100 + 80 * Math.cos(a1), y1 = 120 - 80 * Math.sin(a1);
  const ba = el('bufArc'); ba.setAttribute('d', `M${x0.toFixed(1)} ${y0b.toFixed(1)} A80 80 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`);
  ba.setAttribute('stroke', m.hopMin < 6 ? '#c0392b' : (m.hopMin < 10 ? '#b45309' : '#15803d'));
  el('bufVal').innerHTML = m.hopMin + '<span style="font-size:12px;font-weight:600;color:#9aa091;"> min</span>';
}

function applySimFlags(snap, initial) {
  trucks.forEach((t) => { if (t.state === 'down') { t.state = 'returning'; t.prog = 0.5; } t.loader = t.origLoader; const b = tnodes[trucks.indexOf(t)].querySelector('.tbody'); if (b) b.style.animation = ''; });
  loaders['LD-1'].down = false; loaders['LD-2'].down = false;
  speedMult = snap.wet ? 1.45 : 1;
  (snap.down || []).forEach((id) => { const t = trucks.find((x) => x.id === id); if (t) t.state = 'down'; });
  if (snap.loaderDown) { loaders[snap.loaderDown].down = true; const other = snap.loaderDown === 'LD-2' ? 'LD-1' : 'LD-2'; trucks.forEach((t) => { if (t.origLoader === snap.loaderDown && t.state !== 'down') t.loader = other; }); }
  if (!initial) { const mv = new Set(snap.moved || []); trucks.forEach((t, i) => { if (mv.has(t.id)) { const b = tnodes[i].querySelector('.tbody'); if (b) { b.style.transformBox = 'fill-box'; b.style.transformOrigin = 'center'; b.style.animation = 'osPulse 0.9s ease 3'; setTimeout(() => { if (b) b.style.animation = ''; }, 2800); } } }); }
  el('ld2Down').setAttribute('opacity', snap.loaderDown === 'LD-2' ? '0.28' : '0');
}

// ── Panel rendering ───────────────────────────────────────────────────────────
function renderKPIs(vm) {
  el('kpiRow').innerHTML = vm.kpis.map((k) => `
    <div style="background:#fff;border:1px solid #e7e4d8;border-radius:14px;padding:14px 16px;box-shadow:0 1px 2px rgba(20,30,15,0.04);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#8b9182;font-weight:600;">${k.label}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${k.deltaColor};">${k.delta}</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:5px;margin-top:8px;">
        <span style="font-size:26px;font-weight:800;letter-spacing:-0.02em;line-height:1;color:#161b13;">${k.value}</span>
        <span style="font-size:13px;font-weight:600;color:#9aa091;">${k.unit}</span>
      </div>
      <div style="margin-top:10px;height:5px;border-radius:3px;background:#eeece1;overflow:hidden;"><div style="height:100%;border-radius:3px;width:${k.barW};background:${k.barColor};transition:width .6s ease,background .4s ease;"></div></div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.02em;color:#9aa091;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${k.sub}</div>
    </div>`).join('');
}

function renderConstraint(vm) {
  el('cstShift').textContent = vm.constraint.shiftTxt;
  el('cstSquare').style.background = vm.constraint.color;
  el('cstSquare').style.boxShadow = `0 0 0 4px ${vm.constraint.color}22`;
  el('cstName').textContent = vm.constraint.label;
  el('cstBars').innerHTML = vm.bars.map((bar) => `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.03em;text-transform:uppercase;color:${bar.labelColor};font-weight:600;white-space:nowrap;">${bar.name}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${bar.valColor};">${bar.pct}</span>
      </div>
      <div style="height:6px;border-radius:4px;background:#eeece1;overflow:hidden;"><div style="height:100%;border-radius:4px;width:${bar.w};background:${bar.color};transition:width .6s ease,background .4s ease;"></div></div>
    </div>`).join('');
}

function renderChips(vm) {
  el('starveDot').style.background = vm.starveColor;
  el('starveChip').style.color = vm.starveColor;
  el('starveChip').textContent = vm.starveChip;
  el('mfDot').style.background = vm.mfChipColor;
  el('mfChip').textContent = vm.mfChip;
}

// Merged "Recommended actions": unit-tagged dispatch moves with impact + horizon.
function actionCard(a) {
  const unit = a.unit ? `<span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#161b13;">${esc(a.unit)}</span>` : '';
  const tag = a.action ? `<span style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.04em;text-transform:uppercase;font-weight:700;color:#fff;background:${a.tagColor || '#6b7264'};padding:3px 7px;border-radius:5px;">${esc(a.action)}</span>` : '';
  const delta = a.delta ? `<span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${a.deltaColor || '#16915a'};">${esc(a.delta)}</span>` : '';
  const tf = a.timeframe ? `<span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#0e7490;"> · ${esc(a.timeframe)}</span>` : '';
  return `
    <div style="background:#faf9f3;border:1px solid #eeece1;border-radius:10px;padding:10px 12px;">
      <div style="display:flex;align-items:center;gap:8px;">${unit}${tag}${delta}</div>
      <div style="font-size:13px;color:#6b7264;margin-top:5px;line-height:1.4;">${esc(a.detail)}${tf}</div>
    </div>`;
}
function renderActions(actions) { el('aiActions').innerHTML = actions.map(actionCard).join(''); }

function renderAIPanel(vm) {
  el('aiHeadline').textContent = vm.ai.headline;
  el('aiCurrent').textContent = vm.ai.current;
  el('aiOptimised').textContent = vm.ai.optimised;
  el('aiValue').textContent = vm.ai.value;
  renderActions(vm.actions);
  el('aiNarrative').textContent = vm.narrative;
}

function renderStrategies(vm) {
  el('aiOptions').innerHTML = vm.strategies.map((st) => `
    <button class="h-strat" data-key="${st.key}" style="border-color:${st.border};background:${st.bg};">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;">
        <span style="font-size:15px;font-weight:700;color:#1a1f17;white-space:nowrap;">${st.name}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;font-weight:700;color:${st.tagColor};">${st.tag}</span>
      </div>
      <div style="font-size:13px;color:#6b7264;line-height:1.4;">${st.desc}</div>
      <div style="display:flex;gap:16px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#9aa091;">
        <span>rate <b style="color:#3a4133;">${fmt(st.rate)}</b></span><span>fuel <b style="color:#3a4133;">${st.fuel}</b></span><span>value <b style="color:#3a4133;">${st.value}</b></span>
      </div>
    </button>`).join('');
  el('aiOptions').querySelectorAll('.h-strat').forEach((b) => b.addEventListener('click', () => {
    chosen = b.dataset.key;
    const v = viewModel(m, chosen);
    renderStrategies(v);
    el('aiOptimised').textContent = v.ai.optimised;
    el('aiValue').textContent = v.ai.value;
  }));
}

// Render the AI plan (optimiser output) — only on scenario change, not each tick.
function renderPlan() {
  const vm = viewModel(m, chosen);
  renderAIPanel(vm); renderStrategies(vm);
}

// ── Map view toggle (schematic ↔ satellite terrain) ───────────────────────────
function applyView(view) {
  const terrain = 'radial-gradient(120% 90% at 20% 15%, #3a4327 0%, #2c3520 35%, #222a18 60%, #1a2013 100%), repeating-linear-gradient(58deg, rgba(0,0,0,0.16) 0 14px, rgba(255,255,255,0.02) 14px 30px)';
  el('haulBg').style.background = view === 'satellite' ? terrain : '#0e140d';
  el('haulGrid').setAttribute('opacity', view === 'satellite' ? '0.25' : '1');
  el('viewNote').textContent = view === 'satellite' ? 'Satellite · est. terrain' : 'Live · Morowali port';
  document.querySelectorAll('.h-viewbtn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
}
document.querySelectorAll('.h-viewbtn').forEach((b) => b.addEventListener('click', () => applyView(b.dataset.view)));

// ── Legend ────────────────────────────────────────────────────────────────────
el('haulLegend').innerHTML = LEGEND.map((lg) => `
  <div style="display:flex;align-items:center;gap:7px;"><span style="width:9px;height:9px;border-radius:50%;background:${lg.color};"></span><span style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.02em;text-transform:uppercase;color:#8b9182;">${lg.name}</span></div>`).join('');

// ── Scenario application + live AI ─────────────────────────────────────────────
function planState() {
  return { binding: m.binding, deliveredTph: m.delivered, demandTph: m.demand, matchFactor: +m.mf.toFixed(2), fleetUtilPct: m.util, hopperBufferMin: m.hopMin, hopperPct: m.hopPct, starveRiskPct: m.starvePct, downTrucks: m.down || [], wet: !!m.wet, activeStrategy: chosen };
}

async function applyScenario(key) {
  const prev = m ? m.binding : null;
  // Apply the perturbation to the sim, then re-derive state + plan from it.
  const snap = nominalState(key);
  applySimFlags(snap, false);
  cstate = snap;
  readObservables();
  const live = computeMetrics(cstate);
  plan = optimise(cstate, live);
  const forecast = forecastStarve(cstate, live, plan.optimised);
  chosen = 'protect-demand';
  currentScenarioKey = key;
  m = { ...live, ...plan, starvePct: forecast.starvePct, minToStarve: forecast.minToStarve,
    wet: cstate.wet, down: cstate.downIds, loaderDown: cstate.loaderDown,
    shiftFrom: (prev && prev !== live.binding && key !== 'optimise') ? prev : null };
  syncToggles();
  renderPlan();
  refreshLive();
  el('haulParsed').textContent = '';
  // solving flash
  const solve = el('haulSolve'); solve.style.opacity = '1'; setTimeout(() => { solve.style.opacity = '0'; }, 1400);
  // live AI rationale (falls back to the model's own copy when offline)
  try {
    const r = await postJSON('/api/haul/analyze', { scenario: { disruptionId: key, description: m.headline, demandTph: m.demand, deliveredTph: m.delivered, matchFactor: m.mf, hopperBufferMin: m.hopMin, starveRiskPct: m.starvePct } });
    if (r && r.source === 'live') {
      if (r.headline) el('aiHeadline').textContent = r.headline;
      if (r.narrative) el('aiNarrative').textContent = r.narrative;
      if (r.valueImpactUSD) el('aiValue').textContent = usd(r.valueImpactUSD);
      if (typeof r.optimisedRateTph === 'number') el('aiOptimised').textContent = fmt(r.optimisedRateTph);
      if (Array.isArray(r.recommendations) && r.recommendations.length) {
        renderActions(r.recommendations.map((rc) => ({ detail: rc.action, delta: rc.impact, timeframe: rc.timeframe })));
      }
    }
  } catch { /* model copy already shown */ }
}

function parseFreeLocal(text) {
  const t = text.toLowerCase();
  if (/(loader|ld-?\d).*(down|out|fail|broke)|(down|out).*(loader|ld-?\d)/.test(t)) return 'loader-down';
  if (/(wet|rain|ramp|slip|traction|muddy|water)/.test(t)) return 'road-wet';
  if (/(surge|laycan|demurrage|barge|swell|critical|demand)/.test(t)) return 'demand-surge';
  if (/(ht-?\d|truck).*(down|out|fault|fail|broke)|(down|out|fault).*(truck|ht-?\d)/.test(t)) return 'truck-down';
  return 'optimise';
}

// ── Disruption presets + free text ────────────────────────────────────────────
const PRESETS = [
  { key: 'loader-down', label: 'Shut LD-2', dot: '#0e7490' },
  { key: 'truck-down', label: 'Shut HT-105', dot: '#c0392b' },
  { key: 'road-wet', label: 'Wet ramp', dot: '#b45309' },
  { key: 'demand-surge', label: 'Demand surge', dot: '#15803d' },
];
el('haulPresets').innerHTML = PRESETS.map((p) => `<button class="h-preset" data-key="${p.key}"><span style="width:8px;height:8px;border-radius:50%;background:${p.dot};"></span>${p.label}</button>`).join('');
el('haulPresets').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => applyScenario(currentScenarioKey === b.dataset.key ? 'optimise' : b.dataset.key)));
function syncToggles() { el('haulPresets').querySelectorAll('.h-preset').forEach((b) => b.classList.toggle('active', b.dataset.key === currentScenarioKey)); }

el('haulReset').addEventListener('click', () => { el('haulFree').value = ''; applyScenario('optimise'); });
async function submitFree() {
  const v = el('haulFree').value.trim(); if (!v) return;
  const btn = el('haulFreeBtn'), lbl = btn.textContent; btn.disabled = true; btn.textContent = '…';
  let key = 'optimise', interp = '';
  try { const r = await postJSON('/api/haul/parse', { text: v }); key = r.scenarioKey || parseFreeLocal(v); interp = r.interpretation || ''; }
  catch { key = parseFreeLocal(v); }
  btn.disabled = false; btn.textContent = lbl;
  await applyScenario(key);
  if (interp) el('haulParsed').textContent = interp;
}
el('haulFreeBtn').addEventListener('click', submitFree);
el('haulFree').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitFree(); });

// ── Copilot — grounded Q&A over live state (API with heuristic fallback) ───────
const COPILOT_SUGGEST = ['What is the binding constraint right now?', 'Minutes until the hopper starves?', 'Get me to 2,000 t/h'];
el('copilotQs').innerHTML = COPILOT_SUGGEST.map((q) => `<button class="h-cpq" data-q="${esc(q)}">${q}</button>`).join('');
el('copilotQs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => askCopilot(b.dataset.q)));
el('cpBtn').addEventListener('click', () => askCopilot(el('cpInput').value));
el('cpInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') askCopilot(el('cpInput').value); });

function copilotLocal(q) {
  const tt = (q || '').toLowerCase();
  const tm = tt.match(/(\d[\d,\.]{2,})\s*t\/?h?|\bto\s+(\d[\d,\.]{2,})/);
  if (/binding|constraint/.test(tt)) return 'Binding constraint is ' + m.binding.toUpperCase() + ': ' + m.cnote + ' Delivered ' + fmt(m.delivered) + ' t/h vs ' + fmt(m.demand) + ' demand.';
  if (/starv|hopper|buffer|min/.test(tt)) return 'Hopper buffer is ' + m.hopMin + ' min at ' + fmt(m.delivered) + ' t/h delivered vs ' + fmt(m.demand) + ' demand (' + m.hopPct + '% level). 4h starve risk ' + m.starvePct + '%' + (m.minToStarve != null ? ' (~' + m.minToStarve + ' min if unmanaged)' : '') + '.';
  if ((/over|under|truck|match|mf/.test(tt)) && !tm) return 'Match factor ' + m.mf.toFixed(2) + ' — ' + (m.mf < 0.95 ? 'under-trucked, loaders waiting' : (m.mf > 1.05 ? 'over-trucked, trucks queuing' : 'balanced')) + '. Fleet utilisation ' + m.util + '%.';
  if (tm) {
    const tgt = parseInt((tm[1] || tm[2]).replace(/[,\.]/g, ''), 10);
    const cap = m.strategies['max-throughput'].optimised;
    if (tgt <= m.current) return 'Target ' + fmt(tgt) + ' t/h is at or below current ' + fmt(m.delivered) + ' t/h — already met. Switch to Min fuel / tonne to hold the line at lowest cost.';
    if (tgt <= cap) return 'To reach ' + fmt(tgt) + ' t/h: pick Max throughput — surge cadence and lift payloads to the policy ceiling. Reaches ~' + fmt(cap) + ' t/h, fuel ' + m.strategies['max-throughput'].fuel + '. Watch the queue and hopper buffer.';
    return 'Target ' + fmt(tgt) + ' t/h is above the achievable ceiling (~' + fmt(cap) + ' t/h) given ' + m.binding.toUpperCase() + ' as the binding constraint. Clear that constraint first (e.g. restore a loader / dry the ramp).';
  }
  return 'Circuit: ' + fmt(m.delivered) + ' t/h vs ' + fmt(m.demand) + ' demand, MF ' + m.mf.toFixed(2) + ', hopper buffer ' + m.hopMin + ' min. Binding constraint: ' + m.binding.toUpperCase() + '.';
}
async function askCopilot(q) {
  q = (q || '').trim(); if (!q) return;
  el('cpInput').value = '';
  el('copilotAnswer').textContent = '…';
  try { const r = await postJSON('/api/haul/copilot', { question: q, state: planState() }); el('copilotAnswer').textContent = r.answer || copilotLocal(q); }
  catch { el('copilotAnswer').textContent = copilotLocal(q); }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
initSim();
cstate = nominalState('optimise');
applySimFlags(cstate, true);
readObservables();
{
  const live = computeMetrics(cstate);
  plan = optimise(cstate, live);
  const forecast = forecastStarve(cstate, live, plan.optimised);
  m = { ...live, ...plan, starvePct: forecast.starvePct, minToStarve: forecast.minToStarve, wet: cstate.wet, down: cstate.downIds, loaderDown: cstate.loaderDown, shiftFrom: null };
}
syncToggles();
applyView('schematic');
renderPlan();
refreshLive();
last = performance.now();
requestAnimationFrame(frame);
setInterval(() => refreshLive(550), 550);
setInterval(() => { el('witaClock').textContent = witaTime(); }, 1000);
el('witaClock').textContent = witaTime();
