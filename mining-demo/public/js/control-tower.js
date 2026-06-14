// IROC — Integrated Operations Centre (control & command center).
// Full-viewport pit-to-plant exception-management console: live fleet map,
// set-point gauges, fleet KPIs, index cards, comms chat, alarms — all driven by
// one simulation loop. Three light theme variants. Ported from the design
// handoff prototype into vanilla JS.
const root = document.getElementById('irocRoot');
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const hhmm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function postJSON(url, body) { const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); }

const FALL = { text: '#1f2937', muted: '#647082', faint: '#8a95a3', accent: '#0d9488', green: '#059669', amber: '#d97706', red: '#dc2626', blue: '#2563eb', gray: '#94a3b8', ret: '#0891b2', needle: '#334155', truckStroke: 'rgba(15,23,42,.45)' };
const VARS = { text: 'text', muted: 'muted', faint: 'faint', accent: 'accent', green: 'green', amber: 'amber', red: 'red', blue: 'blue', gray: 'gray', ret: 'ret', needle: 'needle', truckStroke: 'truck-stroke' };
let P = { ...FALL };
function readPalette() {
  const cs = getComputedStyle(root); const o = {};
  for (const k in VARS) { const v = cs.getPropertyValue('--' + VARS[k]).trim(); o[k] = v || FALL[k]; }
  P = o;
}

const ROUTES = {
  ore1: [[250, 210], [430, 170], [650, 150], [860, 150]],
  ore2: [[420, 430], [600, 330], [740, 230], [860, 150]],
  waste1: [[250, 210], [480, 250], [700, 300], [880, 330]],
  waste2: [[420, 430], [540, 490], [640, 525], [700, 540]],
};
function pointAlong(pts, t) {
  const segs = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(L); total += L; }
  let d = cl(t, 0, 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) { const f = segs[i] ? d / segs[i] : 0; return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, ang: Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) * 180 / Math.PI }; }
    d -= segs[i];
  }
  return { x: pts[0][0], y: pts[0][1], ang: 0 };
}
const statusColor = (s) => ({ Hauling: P.green, Returning: P.ret, Queuing: P.amber, Spotting: P.blue, Loading: P.blue, Dumping: P.blue, Down: P.gray }[s] || P.green);
const sevColor = (s) => (s === 'red' ? P.red : s === 'amber' ? P.amber : P.blue);
const el = (id) => document.getElementById(id);

// ── State ─────────────────────────────────────────────────────────────────────
function seedHist() { const a = []; let v = 152000; for (let i = 0; i < 48; i++) { v += Math.random() * 900 + 350; a.push(Math.min(184320, Math.round(v))); } a.push(184320); return a; }
const S = {
  tab: 'FLEET DISPATCH', now: new Date(),
  trucks: [
    { id: 'CAT-301', route: 'ore1', tpos: 0.30, dir: 1, speed: 0.030, autonomy: 'AHS', operator: 'Autonomous', target: 256, payload: 252, stage: 'Hauling', status: 'Hauling', seed: 1 },
    { id: 'CAT-302', route: 'ore1', tpos: 0.72, dir: -1, speed: 0.034, autonomy: 'Manual', operator: 'A. Wijaya', target: 256, payload: 0, stage: 'Returning', status: 'Returning', seed: 2 },
    { id: 'CAT-303', route: 'ore2', tpos: 0.48, dir: 1, speed: 0.032, autonomy: 'AHS', operator: 'Autonomous', target: 240, payload: 236, stage: 'Hauling', status: 'Hauling', seed: 3 },
    { id: 'CAT-304', route: 'ore2', tpos: 0.05, dir: 1, speed: 0.030, autonomy: 'Manual', operator: 'B. Santoso', target: 240, payload: 0, stage: 'Queuing', status: 'Queuing', seed: 4, queue: true },
    { id: 'CAT-305', route: 'waste1', tpos: 0.58, dir: 1, speed: 0.028, autonomy: 'Manual', operator: 'C. Halim', target: 256, payload: 250, stage: 'Hauling', status: 'Hauling', seed: 5 },
    { id: 'CAT-306', route: 'waste1', tpos: 0.22, dir: -1, speed: 0.030, autonomy: 'Tele-remote', operator: 'Remote-3', target: 256, payload: 0, stage: 'Returning', status: 'Returning', seed: 6 },
    { id: 'CAT-307', route: 'waste2', tpos: 0.62, dir: 1, speed: 0.036, autonomy: 'Manual', operator: 'D. Putra', target: 256, payload: 248, stage: 'Hauling', status: 'Hauling', seed: 7 },
    { id: 'CAT-308', down: true, x: 828, y: 206, autonomy: 'Manual', operator: '—', target: 256, payload: 0, stage: 'Down', status: 'Down', seed: 8 },
  ],
  shovels: [
    { id: 'SH-01', name: 'Shovel 1 · EX-5500', x: 250, y: 210, digRate: 3200, assigned: 3, queue: 1, mf: 1.02 },
    { id: 'SH-02', name: 'Shovel 2 · EX-3600', x: 420, y: 430, digRate: 2400, assigned: 4, queue: 3, mf: 1.18 },
  ],
  g: { match: 1.02, matchT: 1.02, cycle: 24.5, cycleT: 24.5, prod: 6.1, prodT: 6.1 },
  kpis: [
    { key: 'avail', label: 'Fleet Avail.', value: 88, target: 85, lo: 82, hi: 93, step: 1.0, unit: '%', dec: 0, higherGood: true, up: true, good: true },
    { key: 'util', label: 'Utilisation', value: 81, target: 80, lo: 74, hi: 88, step: 1.2, unit: '%', dec: 0, higherGood: true, up: true, good: true },
    { key: 'oee', label: 'OEE', value: 72, target: 75, lo: 66, hi: 80, step: 1.0, unit: '%', dec: 0, higherGood: true, up: false, good: false },
    { key: 'pvar', label: 'Payload Var.', value: 4.2, target: 5, lo: 2.5, hi: 7.5, step: 0.4, unit: '%', dec: 1, higherGood: false, up: false, good: true },
    { key: 'queue', label: 'Queue/cyc', value: 2.1, target: 2.5, lo: 1.2, hi: 4.2, step: 0.35, unit: 'min', dec: 1, higherGood: false, up: false, good: true },
    { key: 'fuel', label: 'Fuel burn', value: 41, target: 40, lo: 37, hi: 46, step: 0.7, unit: 'L/100t', dec: 0, higherGood: false, up: true, good: false },
  ],
  tyre: 74, tkph: 412, tkphMax: 540, tonnes: 184320, tonnesTarget: 230000, tonnesHistory: seedHist(),
  alarms: [
    { id: 1, sev: 'red', text: 'Shovel 2 over-trucked — queue building (3)', unit: 'SH-02', time: '13:04' },
    { id: 2, sev: 'amber', text: 'Haul-road grade alert — segment B wet', unit: null, time: '13:01' },
    { id: 3, sev: 'amber', text: 'CAT-305 tyre temp rising (TKPH)', unit: 'CAT-305', time: '12:58' },
    { id: 4, sev: 'red', text: 'CAT-308 down — hydraulic fault E-1623', unit: 'CAT-308', time: '12:41' },
  ],
  alertCount: 4, alarmsOpen: false,
  chat: [
    { who: 'dispatch', text: 'Wet patch on haul road seg B near the WD-2 turn — trucks slowing through it.', time: '13:02', mine: false },
    { who: 'you', text: 'Copy. Grader en route? Cycle times up ~1.5 min on that leg.', time: '13:03', mine: true },
    { who: 'dispatch', text: 'Grader GD-12 dispatched, ETA 8 min. Watch Shovel 2 — over-trucked, queue building.', time: '13:04', mine: false },
  ],
  selected: null, highlight: null, vib: 2.5, slope: 1270, dil: 5.5,
  disruption: null, downShovel: null, exclusion: null, dEff: null, dutyResp: null,
};

// ── Simulation tick ───────────────────────────────────────────────────────────
function tick() {
  const now = new Date(); S.now = now;
  S.trucks = S.trucks.map((t) => {
    if (t.down) return t;
    if (t.queue) { const np = 0.03 + Math.abs(Math.sin(now.getTime() / 2300 + t.seed)) * 0.06; return { ...t, tpos: np, stage: 'Queuing', status: 'Queuing', payload: 0 }; }
    let np = t.tpos + t.dir * t.speed, dir = t.dir, stage, status, payload = t.payload;
    if (np >= 1) { np = 1; dir = -1; stage = 'Dumping'; status = 'Spotting'; payload = 0; }
    else if (np <= 0) { np = 0; dir = 1; stage = 'Loading'; status = 'Spotting'; payload = Math.round(t.target - Math.random() * 12); }
    else if (dir > 0) { stage = 'Hauling'; status = 'Hauling'; }
    else { stage = 'Returning'; status = 'Returning'; payload = 0; }
    if (np > 0.06 && np < 0.94 && status === 'Spotting') status = dir > 0 ? 'Hauling' : 'Returning';
    return { ...t, tpos: np, dir, stage, status, payload };
  });
  const g = S.g;
  g.matchT = cl(g.matchT + (Math.random() - 0.5) * 0.05, 0.86, 1.16);
  g.cycleT = cl(g.cycleT + (Math.random() - 0.5) * 0.6, 21, 29);
  g.prodT = cl(g.prodT + (Math.random() - 0.5) * 0.25, 5.2, 7.2);
  if (S.disruption && S.dEff) { if (S.dEff.prodT != null) g.prodT = S.dEff.prodT; if (S.dEff.matchT != null) g.matchT = S.dEff.matchT; if (S.dEff.cycleT != null) g.cycleT = S.dEff.cycleT; }
  g.match += (g.matchT - g.match) * 0.30; g.cycle += (g.cycleT - g.cycle) * 0.30; g.prod += (g.prodT - g.prod) * 0.30;
  S.kpis = S.kpis.map((k) => { const nv = cl(k.value + (Math.random() - 0.5) * k.step, k.lo, k.hi); return { ...k, value: nv, up: nv >= k.value, good: k.higherGood ? nv >= k.target : nv <= k.target }; });
  S.shovels = S.shovels.map((sh) => ({ ...sh, mf: cl(sh.mf + (Math.random() - 0.5) * 0.06, sh.id === 'SH-02' ? 1.0 : 0.85, sh.id === 'SH-02' ? 1.28 : 1.12) }));
  S.tonnes = Math.min(S.tonnesTarget, S.tonnes + 70 + Math.random() * 120);
  S.tonnesHistory = [...S.tonnesHistory, Math.round(S.tonnes)]; if (S.tonnesHistory.length > 70) S.tonnesHistory.shift();
  S.tyre -= 0.015; if (S.tyre < 58) S.tyre = 74;
  S.vib = cl(2.5 + Math.sin(now.getTime() / 5200) * 1.1, 0, 8);
  S.slope = cl(1270 + Math.sin(now.getTime() / 7000) * 55, 800, 1600);
  S.dil = cl(5.5 + Math.sin(now.getTime() / 6100) * 0.7, 0, 10);
  if (Math.random() < 0.05) {
    const pool = [
      { sev: 'amber', text: 'Truck CAT-305 low tyre pressure', unit: 'CAT-305' }, { sev: 'red', text: 'Shovel 2 over-trucked', unit: 'SH-02' },
      { sev: 'amber', text: 'Haul-road grade alert — seg B', unit: null }, { sev: 'amber', text: 'CAT-302 speeding on ramp R3', unit: 'CAT-302' },
      { sev: 'red', text: 'Slope radar prism P-12 movement', unit: null }, { sev: 'amber', text: 'Crusher feed bin 82% full', unit: null },
    ];
    const a = pool[Math.floor(Math.random() * pool.length)];
    S.alarms = [{ ...a, id: now.getTime(), time: hhmm(now) }, ...S.alarms].slice(0, 14);
    S.alertCount += 1;
  }
  if (el('ctClock')) el('ctClock').textContent = hhmm(now) + ':' + String(now.getSeconds()).padStart(2, '0');
  if (el('ctBadge')) el('ctBadge').textContent = S.alertCount;
  if (S.tab === 'FLEET DISPATCH' && el('ctGauges')) { renderGauges(); renderKpiCol(); renderCards(); updateMap(); }
}

// ── SVG builders ──────────────────────────────────────────────────────────────
function gaugeSVG({ value, min, max, greenLo, greenHi, thr, valueStr, unit, W = 300, H = 140 }) {
  const cx = W / 2, cy = H - 14, R = Math.min(W / 2 - 14, H - 30), sw = Math.max(9, R * 0.15);
  const frac = (v) => (cl(v, min, max) - min) / ((max - min) || 1);
  const ang = (f) => 180 - f * 180;
  const pt = (a, r = R) => [cx + r * Math.cos(a * Math.PI / 180), cy - r * Math.sin(a * Math.PI / 180)];
  const arc = (f1, f2, col) => { f1 = cl(f1, 0, 1); f2 = cl(f2, 0, 1); if (f2 <= f1) return ''; const p1 = pt(ang(f1)), p2 = pt(ang(f2)); return `<path d="M${p1[0].toFixed(2)} ${p1[1].toFixed(2)} A ${R} ${R} 0 0 1 ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}" stroke="${col}" stroke-width="${sw}" fill="none"/>`; };
  let segs = '';
  if (thr) { const f1 = frac(thr[0]), f2 = frac(thr[1]); segs = arc(0, f1, P.green) + arc(f1, f2, P.amber) + arc(f2, 1, P.red); }
  else { const fLo = frac(greenLo), fHi = frac(greenHi), aL = Math.max(0, fLo - 0.16), aH = Math.min(1, fHi + 0.16); segs = arc(0, aL, P.red) + arc(aL, fLo, P.amber) + arc(fLo, fHi, P.green) + arc(fHi, aH, P.amber) + arc(aH, 1, P.red); }
  let ticks = '';
  for (let i = 0; i <= 8; i++) { const a = ang(i / 8), o1 = pt(a, R + sw / 2 + 1), o2 = pt(a, R + sw / 2 + (i % 2 ? 2 : 5)); ticks += `<line x1="${o1[0].toFixed(1)}" y1="${o1[1].toFixed(1)}" x2="${o2[0].toFixed(1)}" y2="${o2[1].toFixed(1)}" stroke="${P.faint}" stroke-width="1.4"/>`; }
  const av = ang(frac(value)), np = pt(av, R - 3), bp = pt(av + 180, 9);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="display:block;overflow:visible"><g>${segs}</g><g>${ticks}</g>` +
    `<text x="${pt(180, R + 3)[0].toFixed(1)}" y="${cy + 12}" font-size="9" fill="${P.faint}" font-family="'IBM Plex Mono'">${min}</text>` +
    `<text x="${pt(0, R + 3)[0].toFixed(1)}" y="${cy + 12}" text-anchor="end" font-size="9" fill="${P.faint}" font-family="'IBM Plex Mono'">${max}</text>` +
    `<line x1="${bp[0].toFixed(1)}" y1="${bp[1].toFixed(1)}" x2="${np[0].toFixed(1)}" y2="${np[1].toFixed(1)}" stroke="${P.needle}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="5.5" fill="${P.needle}"/>` +
    `<text x="${cx}" y="${(cy - R * 0.32).toFixed(1)}" text-anchor="middle" font-family="'IBM Plex Mono'" font-weight="600" font-size="${(R * 0.33).toFixed(1)}" fill="${P.text}">${valueStr}</text>` +
    `<text x="${cx}" y="${(cy - R * 0.32 + 12).toFixed(1)}" text-anchor="middle" font-size="10" fill="${P.muted}">${unit || ''}</text></svg>`;
}
function areaSVG(data, color, W, H, id) {
  if (!data || data.length < 2) data = [0, 1];
  const max = Math.max(...data), min = Math.min(...data, 0);
  const X = (i) => i / (data.length - 1) * W, Y = (v) => H - ((v - min) / ((max - min) || 1)) * (H - 4) - 2;
  let area = 'M0 ' + H; data.forEach((v, i) => { area += ' L' + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }); area += ' L' + W + ' ' + H + ' Z';
  const line = 'M' + data.map((v, i) => X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' L');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none" style="display:block"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.30"/><stop offset="100%" stop-color="${color}" stop-opacity="0.02"/></linearGradient></defs><path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
}
function lineSVG(data, color, W, H, id) {
  const max = Math.max(...data), min = Math.min(...data);
  const X = (i) => i / (data.length - 1) * W, Y = (v) => H - ((v - min) / ((max - min) || 1)) * (H - 8) - 4;
  const line = 'M' + data.map((v, i) => X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' L');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none" style="display:block"><path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
}
const spark = (seed) => { const a = []; for (let i = 0; i < 14; i++) a.push(22 + Math.sin(i / 2 + seed) * 3.2 + Math.cos(i / 3 + seed) * 1.5 + 1.5); return a; };

// ── Shell + nav ───────────────────────────────────────────────────────────────
const TABS = ['FLEET DISPATCH', 'ASSET HEALTH', 'PRODUCTION', 'PLAN vs ACTUAL', 'SUSTAINABILITY', 'SHIFT REPORT'];
function renderShell() {
  root.innerHTML = `
    <div class="ct-nav">
      <a class="ct-brand" href="/index.html" title="Back to OreSight">
        <span class="ct-logo">◈</span>
        <span><span class="ct-bt1">IROC <b>·</b> Batu Hijau Pit</span><br><span class="ct-bt2">Integrated Operations Centre</span></span>
      </a>
      <div class="ct-tabs" id="ctTabs">${TABS.map((t) => `<button class="ct-tab" data-tab="${t}">${t}</button>`).join('')}</div>
      <div class="ct-right">
        <div class="ct-seg" id="ctVariant">${['console', 'blueprint', 'warm'].map((v) => `<button data-v="${v}">${v}</button>`).join('')}</div>
        <div class="ct-div"></div>
        <div><div class="ct-clock mono" id="ctClock">--:--:--</div><div class="ct-shift">Shift A · 06:00–18:00</div></div>
        <button class="ct-ico" title="Reports">▤</button>
        <button class="ct-ico" title="Messages">✉</button>
        <button class="ct-ico" id="ctBell" title="Alarms">⚑<span class="ct-badge" id="ctBadge">4</span></button>
        <div class="ct-div"></div>
        <div class="ct-avatar">DP</div>
      </div>
    </div>
    <div class="ct-body"><div class="ct-main" id="ctMain"></div><div class="ct-aside"><div class="card ct-comms" id="ctComms"></div></div></div>`;
  el('ctTabs').querySelectorAll('.ct-tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  el('ctVariant').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setVariant(b.dataset.v)));
  el('ctBell').addEventListener('click', () => { S.alarmsOpen = !S.alarmsOpen; S.selected = null; if (S.tab !== 'FLEET DISPATCH') setTab('FLEET DISPATCH'); else updateMap(); });
  renderComms();
  setTab(S.tab);
  setVariant('console');
}
function setVariant(v) {
  root.setAttribute('data-variant', v);
  el('ctVariant').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  requestAnimationFrame(() => { readPalette(); buildMain(); });
}
function setTab(tab) {
  S.tab = tab; S.selected = null;
  el('ctTabs').querySelectorAll('.ct-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  buildMain();
}

// ── Main (per tab) ────────────────────────────────────────────────────────────
function buildMain() {
  const main = el('ctMain');
  if (S.tab === 'FLEET DISPATCH') {
    main.innerHTML = `
      <div class="ct-gauges" id="ctGauges"></div>
      <div class="ct-mid">
        <div class="card ct-map" id="ctMap"></div>
        <div class="ct-kpicol" id="ctKpi"></div>
      </div>
      <div class="ct-cards" id="ctCards"></div>`;
    buildMap();
    renderGauges(); renderKpiCol(); renderCards(); updateMap();
  } else {
    main.innerHTML = `<div class="ct-secbody">${secondaryTab(S.tab)}</div>`;
  }
}

function renderGauges() {
  el('ctGauges').innerHTML = [
    { t: 'Fleet Match Factor', hint: 'tgt 0.9–1.1', g: gaugeSVG({ value: S.g.match, min: 0.7, max: 1.3, greenLo: 0.9, greenHi: 1.1, valueStr: S.g.match.toFixed(2), unit: 'ratio' }) },
    { t: 'Haul Cycle Time', hint: 'lower better', g: gaugeSVG({ value: S.g.cycle, min: 18, max: 32, thr: [26, 30], valueStr: S.g.cycle.toFixed(1), unit: 'min' }) },
    { t: 'Production Rate', hint: 'tgt 6.5', g: gaugeSVG({ value: S.g.prod, min: 4, max: 8, greenLo: 5.5, greenHi: 8, valueStr: S.g.prod.toFixed(1), unit: 'kt/h' }) },
  ].map((x) => `<div class="card ct-gauge"><div class="ct-ghead"><span class="lbl">${x.t}</span><span class="ct-ghint">${x.hint}</span></div><div class="ct-garc">${x.g}</div></div>`).join('');
}

// ── Fleet map ─────────────────────────────────────────────────────────────────
function buildMap() {
  let grid = '';
  for (let x = 0; x <= 1000; x += 150) grid += `<line x1="${x}" y1="0" x2="${x}" y2="600" style="stroke:var(--map-grid)" stroke-width="1"/>`;
  for (let y = 0; y <= 600; y += 250) grid += `<line x1="0" y1="${y}" x2="1000" y2="${y}" style="stroke:var(--map-grid)" stroke-width="1"/>`;
  const benches = [[262, 176, 'bench1'], [210, 140, 'bench2'], [160, 108, 'bench3'], [104, 70, 'bench4'], [52, 32, 'bench4']].map(([rx, ry, b]) => `<ellipse cx="350" cy="320" rx="${rx}" ry="${ry}" style="fill:var(--${b});stroke:var(--bench-line)" stroke-width="1"/>`).join('');
  const roads = ['ore1', 'ore2', 'waste1', 'waste2'].map((k) => { const pts = ROUTES[k].map((p) => p.join(',')).join(' '); return `<polyline points="${pts}" fill="none" style="stroke:var(--road)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${pts}" fill="none" style="stroke:var(--road-flow)" stroke-width="2.4" stroke-dasharray="7 11" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="18" to="0" dur="1.1s" repeatCount="indefinite"/></polyline>`; }).join('');
  const dests = [[810, 100, 'CRUSHER / ROM'], [832, 286, 'WD-1'], [654, 498, 'WD-2']].map(([x, y, lbl]) => `<g><rect x="${x}" y="${y}" width="48" height="34" rx="3" style="fill:var(--dest);stroke:var(--dest-stroke)" stroke-width="1.5"/><polygon points="${x},${y} ${x + 48},${y} ${x + 24},${y - 12}" style="fill:var(--dest-roof)"/><text x="${x + 24}" y="${y + 50}" text-anchor="middle" font-size="11" style="fill:var(--muted)" font-family="'IBM Plex Mono'">${lbl}</text></g>`).join('');
  const scene = `<svg class="scene" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
    <rect x="0" y="0" width="1000" height="600" style="fill:var(--map-bg)"/>${grid}${benches}
    <text x="350" y="324" text-anchor="middle" font-size="13" style="fill:var(--pit-label)" font-family="'IBM Plex Mono'">460 RL</text>
    ${roads}${dests}<g id="ctDisrupt"></g><g id="ctShovels"></g><g id="ctTrucks"></g><g id="ctHighlight"></g></svg>`;
  el('ctMap').innerHTML = scene + `
    <div class="ct-ovl tl"><div class="ct-livetag"><span class="ct-livedot"></span>LIVE FLEET MAP · BATU HIJAU PIT</div>
      <div class="ct-leg">${[['Hauling', P.green], ['Queuing', P.amber], ['Spotting', P.blue], ['Down', P.gray]].map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div>
      <div class="ct-predwrap" id="ctPred"></div></div>
    <div class="ct-ovl tr"><div class="ct-alpill" id="ctAlPill"><span class="d"></span>Alarms (<span id="ctAlCount">${S.alertCount}</span>) ▾</div></div>
    <div class="ct-ovl bl"><div class="ct-tele"><div class="lbl">Tonnes moved · shift</div><div class="big" id="ctTele">0</div><div class="faint mono" style="font-size:10px" id="ctTele2"></div></div></div>
    <div class="ct-ovl" style="bottom:12px;left:50%;transform:translateX(-50%);z-index:8">
      <div class="ct-disrupt"><span class="ct-dcap">Inject disruption</span><div class="ct-dtoggles" id="ctDTog"></div>
        <input id="ctDFree" placeholder="or type… 'lightning within 10 km'"/><button id="ctDGo">→</button><button id="ctDReset" title="Clear">↺</button></div>
    </div>
    <div class="ct-duty" id="ctDuty" style="display:none"></div>
    <div id="ctMapPop"></div>`;
  renderDTog(); renderPred();
  el('ctDGo').addEventListener('click', dFree);
  el('ctDFree').addEventListener('keydown', (e) => { if (e.key === 'Enter') dFree(); });
  el('ctDReset').addEventListener('click', clearDisruption);
  if (S.disruption && S.dutyResp) renderDuty(S.dutyResp);
  el('ctShovels').innerHTML = S.shovels.map((sh) => `<g data-unit="${sh.id}" style="cursor:pointer"><circle cx="${sh.x}" cy="${sh.y}" r="16" style="fill:var(--shovel-fill)" stroke="${P.accent}" stroke-width="2.5" class="ct-shring"/><rect x="${sh.x - 9}" y="${sh.y - 6}" width="18" height="12" rx="2" style="fill:var(--needle)"/><text x="${sh.x}" y="${sh.y + 30}" text-anchor="middle" font-size="10" style="fill:var(--muted)" font-family="'IBM Plex Mono'">${sh.id}</text></g>`).join('');
  el('ctTrucks').innerHTML = S.trucks.map((t) => `<g data-unit="${t.id}" style="cursor:pointer;transition:transform 1.05s linear"><rect x="-11" y="-6" width="22" height="12" rx="3" fill="${statusColor(t.status)}" stroke="${t.autonomy === 'AHS' ? P.accent : t.autonomy === 'Tele-remote' ? P.blue : P.truckStroke}" stroke-width="${t.autonomy === 'AHS' ? 1.6 : 1.2}" stroke-dasharray="${t.autonomy === 'Tele-remote' ? '3 2' : ''}"><title>${t.id} · ${t.autonomy}</title></rect></g>`).join('');
  el('ctMap').querySelectorAll('[data-unit]').forEach((g) => g.addEventListener('click', (e) => { e.stopPropagation(); S.selected = g.dataset.unit; S.alarmsOpen = false; updateMap(); }));
  el('ctAlPill').addEventListener('click', () => { S.alarmsOpen = !S.alarmsOpen; S.selected = null; updateMap(); });
}

function updateMap() {
  if (!el('ctTrucks')) return;
  S.trucks.forEach((t) => {
    const g = el('ctTrucks').querySelector(`[data-unit="${t.id}"]`); if (!g) return;
    let x, y, ang = 0;
    if (t.down) { x = t.x; y = t.y; } else { const p = pointAlong(ROUTES[t.route], t.tpos); x = p.x; y = p.y; ang = t.dir > 0 ? p.ang : p.ang + 180; }
    g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${ang.toFixed(0)})`);
    g.querySelector('rect').setAttribute('fill', statusColor(t.status));
  });
  S.shovels.forEach((sh) => { const ring = el('ctShovels').querySelector(`[data-unit="${sh.id}"] .ct-shring`); if (ring) ring.setAttribute('stroke', sh.id === S.downShovel ? P.gray : (sh.mf < 0.85 || sh.mf > 1.15) ? P.amber : P.accent); });
  const dz = el('ctDisrupt'); if (dz) dz.innerHTML = S.exclusion ? `<circle cx="${S.exclusion.x}" cy="${S.exclusion.y}" r="${S.exclusion.r}" fill="rgba(220,38,38,0.10)" stroke="${P.red}" stroke-width="2" stroke-dasharray="6 5"><animate attributeName="r" from="${S.exclusion.r - 10}" to="${S.exclusion.r}" dur="1.6s" repeatCount="indefinite"/></circle><text x="${S.exclusion.x}" y="${S.exclusion.y - S.exclusion.r - 6}" text-anchor="middle" font-size="10" font-family="'IBM Plex Mono'" fill="${P.red}">EXCLUSION</text>` : '';
  renderPred();
  el('ctTele').textContent = Math.round(S.tonnes).toLocaleString('en-US');
  el('ctTele2').textContent = S.g.prod.toFixed(1) + ' kt/h · ' + S.trucks.filter((t) => !t.down).length + ' units active';
  el('ctAlCount').textContent = S.alertCount;
  const pop = el('ctMapPop');
  if (S.alarmsOpen) {
    const groups = {}; S.alarms.forEach((a) => { const k = a.unit || a.text.split('—')[0].trim().split(' ').slice(0, 2).join(' '); groups[k] = (groups[k] || 0) + 1; });
    const top = Object.entries(groups).sort((x, y) => y[1] - x[1])[0];
    pop.innerHTML = `<div class="ct-pop" style="top:46px;right:12px;width:330px;max-height:360px;overflow:auto">
      <div class="ct-triage">✦ AI triage · ${S.alarms.length} alarms → ${Object.keys(groups).length} events${top ? ` · top: ${esc(top[0])} (${top[1]})` : ''}</div>
      ${S.alarms.map((a) => `<div class="ct-alrow" data-al="${esc(a.unit || '')}"><span class="d" style="background:${sevColor(a.sev)}"></span><div><div class="tx">${esc(a.text)}</div><div class="mt">${a.unit ? a.unit + ' · ' : ''}${a.time}</div></div></div>`).join('')}</div>`;
    pop.querySelectorAll('.ct-alrow').forEach((row) => row.addEventListener('click', () => { const u = row.dataset.al; if (u) traceUnit(u); }));
  } else if (S.selected) {
    const t = S.trucks.find((x) => x.id === S.selected), sh = S.shovels.find((x) => x.id === S.selected);
    const ualarms = S.alarms.filter((a) => a.unit === S.selected);
    const rows = t ? [['Status', t.status], ['Autonomy', t.autonomy], ['Payload', `${t.payload} / ${t.target} t`], ['Stage', t.stage], ['Operator', t.operator]]
      : [['Dig rate', sh.digRate + ' t/h'], ['Trucks assigned', sh.assigned], ['Queue', sh.queue], ['Match factor', sh.mf.toFixed(2)]];
    pop.innerHTML = `<div class="ct-pop" style="top:46px;right:12px;width:268px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:13px">${t ? 'Truck' : 'Shovel'} · ${S.selected}</b><span style="cursor:pointer;color:var(--muted)" id="ctPopX">✕</span></div>
      ${rows.map(([l, v]) => `<div style="display:flex;justify-content:space-between;gap:14px;padding:3px 0;font-size:12px"><span style="color:var(--muted)">${l}</span><span class="mono">${esc(String(v))}</span></div>`).join('')}
      <div class="lbl" style="margin:8px 0 4px">Cycle time</div><div style="height:40px">${lineSVG(spark(t ? t.seed : sh.id.length), P.accent, 200, 40, 'sp' + S.selected)}</div>
      <div class="lbl" style="margin:8px 0 4px">Unit alarms</div>${ualarms.length ? ualarms.map((a) => `<div class="ct-alrow" style="cursor:default"><span class="d" style="background:${sevColor(a.sev)}"></span><div class="tx">${esc(a.text)}</div></div>`).join('') : '<div class="faint" style="font-size:12px">No active alarms</div>'}</div>`;
    el('ctPopX').addEventListener('click', () => { S.selected = null; updateMap(); });
  } else pop.innerHTML = '';
  el('ctHighlight').innerHTML = S.highlight ? `<circle cx="${S.highlight.x}" cy="${S.highlight.y}" r="14" fill="none" stroke="${P.accent}" stroke-width="3" style="animation:pulsering 4.6s ease-out"/>` : '';
}
function traceUnit(id) {
  const t = S.trucks.find((x) => x.id === id), sh = S.shovels.find((x) => x.id === id);
  let pos = null; if (t) pos = t.down ? { x: t.x, y: t.y } : pointAlong(ROUTES[t.route], t.tpos); else if (sh) pos = { x: sh.x, y: sh.y };
  if (!pos) return;
  if (S.tab !== 'FLEET DISPATCH') setTab('FLEET DISPATCH');
  S.highlight = { x: pos.x, y: pos.y, id }; S.selected = id; S.alarmsOpen = false; updateMap();
  setTimeout(() => { S.highlight = null; if (el('ctHighlight')) el('ctHighlight').innerHTML = ''; }, 4600);
}

// ── Disruptions + AI duty controller ──────────────────────────────────────────
const DISRUPTIONS = [
  { id: 'shovel-down', label: 'Shovel down', dot: '#dc2626', alarm: { sev: 'red', text: 'SH-02 hydraulic fault — loading halted', unit: 'SH-02' }, trace: 'SH-02', eff: { downShovel: 'SH-02', g: { prodT: 5.4, matchT: 1.22, cycleT: 27.5 } } },
  { id: 'road-block', label: 'Road block', dot: '#d97706', alarm: { sev: 'amber', text: 'Haul-road seg B blocked — rockfall', unit: null }, trace: { x: 540, y: 490 }, eff: { exclusion: { x: 540, y: 490, r: 60 }, g: { prodT: 5.8, cycleT: 28 } } },
  { id: 'crusher-choke', label: 'Crusher choke', dot: '#dc2626', alarm: { sev: 'red', text: 'Gyratory choke — feed bin 96%', unit: null }, trace: { x: 834, y: 117 }, eff: { g: { prodT: 5.0 } } },
  { id: 'slope-alarm', label: 'Slope alarm', dot: '#dc2626', alarm: { sev: 'red', text: 'Slope radar prism P-12 accelerating', unit: null }, trace: { x: 300, y: 300 }, eff: { exclusion: { x: 300, y: 300, r: 92 }, g: { prodT: 5.6, matchT: 0.92 } } },
  { id: 'storm-hold', label: 'Lightning hold', dot: '#d97706', alarm: { sev: 'amber', text: 'Lightning within 10 km — AHS hold', unit: null }, trace: null, eff: { g: { prodT: 4.8, cycleT: 29 } } },
  { id: 'mill-trip', label: 'Mill trip', dot: '#dc2626', alarm: { sev: 'red', text: 'SAG mill trip — feed demand dropped', unit: null }, trace: { x: 834, y: 117 }, eff: { g: { prodT: 5.2 } } },
];
function dutyState() {
  return { site: 'Batu Hijau', tonnes: Math.round(S.tonnes), tonnesTarget: S.tonnesTarget, prodKtH: +S.g.prod.toFixed(1), matchFactor: +S.g.match.toFixed(2), downUnits: S.trucks.filter((t) => t.down).map((t) => t.id).concat(S.downShovel ? [S.downShovel] : []), alarms: S.alarms.length, activeDisruption: S.disruption || 'none' };
}
function renderDTog() {
  if (!el('ctDTog')) return;
  el('ctDTog').innerHTML = DISRUPTIONS.map((d) => `<button class="ct-dtoggle" data-id="${d.id}"><span class="dot" style="background:${d.dot}"></span>${d.label}</button>`).join('');
  el('ctDTog').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => applyDisruption(b.dataset.id)));
  syncDTog();
}
function syncDTog() { if (el('ctDTog')) el('ctDTog').querySelectorAll('.ct-dtoggle').forEach((b) => b.classList.toggle('active', b.dataset.id === S.disruption)); }
function applyDisruption(id) {
  const d = DISRUPTIONS.find((x) => x.id === id); if (!d) return;
  if (S.disruption === id) { clearDisruption(); return; }
  S.disruption = id; S.downShovel = d.eff.downShovel || null; S.exclusion = d.eff.exclusion || null; S.dEff = d.eff.g || {};
  S.alarms = [{ ...d.alarm, id: Date.now(), time: hhmm(new Date()) }, ...S.alarms].slice(0, 14); S.alertCount += 1;
  if (S.tab !== 'FLEET DISPATCH') setTab('FLEET DISPATCH');
  if (typeof d.trace === 'string') traceUnit(d.trace);
  else if (d.trace) { S.highlight = { x: d.trace.x, y: d.trace.y }; setTimeout(() => { S.highlight = null; if (el('ctHighlight')) el('ctHighlight').innerHTML = ''; }, 6000); }
  syncDTog(); updateMap();
  el('ctDuty').style.display = ''; el('ctDuty').innerHTML = `<div class="ct-duty-head"><span class="ct-duty-badge">AI</span><span>Duty controller</span></div><div class="faint" style="font-size:12px;padding:8px 2px">Analysing the exception across the chain…</div>`;
  fetchDuty(id, d);
}
function clearDisruption() {
  S.disruption = null; S.downShovel = null; S.exclusion = null; S.dEff = null; S.dutyResp = null;
  if (el('ctDuty')) el('ctDuty').style.display = 'none';
  syncDTog(); updateMap();
}
async function fetchDuty(id, d) {
  let r;
  try { r = await postJSON('/api/iroc/analyze', { scenario: { disruptionId: id, description: d.alarm.text, state: dutyState() } }); }
  catch { return; }
  if (S.disruption !== id) return; // cleared while loading
  S.dutyResp = r; renderDuty(r);
  if (r.draftedComms) { S.chat.push({ who: 'dispatch', text: '✦ Duty controller: ' + r.draftedComms, time: hhmm(new Date()), mine: false }); if (el('ctMsgs')) paintMsgs(); }
}
function renderDuty(r) {
  const duty = el('ctDuty'); if (!duty) return; duty.style.display = '';
  const pp = r.productionImpact || {};
  duty.innerHTML = `
    <div class="ct-duty-head"><span class="ct-duty-badge">AI</span><span>Duty controller</span><span class="ct-duty-x" id="ctDutyX">✕</span></div>
    <div class="ct-duty-hl">${esc(r.headline || '')}</div>
    <div class="ct-duty-impact">
      <div><span class="l">At risk</span><span class="v">${pp.lostKt ?? '—'} kt</span></div>
      <div><span class="l">To plan</span><span class="v" style="color:${(pp.planPct ?? 0) < 0 ? 'var(--red)' : 'var(--green)'}">${(pp.planPct ?? 0) > 0 ? '+' : ''}${pp.planPct ?? '—'}%</span></div>
      <div><span class="l">Binding</span><span class="v" style="text-transform:capitalize">${esc(r.bindingConstraint || '—')}</span></div>
    </div>
    <div class="ct-duty-sec">Root cause</div><div class="ct-duty-rc">${esc(r.rootCause || '')}</div>
    <div class="ct-duty-sec">Prioritised actions</div>
    <div class="ct-duty-actions">${(r.actions || []).map((a) => `<div class="ct-act"><div class="ct-act-a">${esc(a.action)}</div><div class="ct-act-m">${esc(a.impact || '')} · <b>${esc(a.owner || '')}</b></div></div>`).join('')}</div>
    ${r.draftedComms ? `<div class="ct-duty-sec">Drafted comms <span class="faint" style="font-weight:400;text-transform:none">· posted to dispatch</span></div><div class="ct-duty-comms">${esc(r.draftedComms)}</div>` : ''}
    <div class="ct-duty-narr">${esc(r.narrative || '')}</div>`;
  el('ctDutyX').addEventListener('click', clearDisruption);
}
function dFree() {
  const inp = el('ctDFree'); const v = (inp.value || '').trim(); if (!v) return; inp.value = '';
  postJSON('/api/iroc/parse', { text: v }).then((r) => applyDisruption(r.disruptionId || 'shovel-down')).catch(() => {});
}
function renderPred() {
  if (!el('ctPred')) return;
  const sh2 = S.shovels.find((x) => x.id === 'SH-02');
  const binRisk = Math.round(52 + Math.sin(S.now.getTime() / 9000) * 30);
  const pred = [
    { p: binRisk, t: 'Crusher feed bin → choke', c: binRisk > 70 ? 'hi' : binRisk > 45 ? 'med' : 'lo' },
    { p: S.tyre < 66 ? 71 : 32, t: 'CAT-305 tyre TKPH → limit', c: S.tyre < 66 ? 'hi' : 'lo' },
    { p: sh2 && sh2.mf > 1.15 ? 64 : 24, t: 'Shovel 2 over-truck / queue', c: sh2 && sh2.mf > 1.15 ? 'med' : 'lo' },
  ];
  el('ctPred').innerHTML = `<div class="ct-pred-cap">✦ AI predictive · next 30 min</div>${pred.map((r) => `<div class="ct-pred-row"><span class="ct-pred-p ${r.c}">${r.p}%</span><span>${r.t}</span></div>`).join('')}`;
}

// ── KPI column ────────────────────────────────────────────────────────────────
function renderKpiCol() {
  const tyreColor = S.tyre < 68 ? P.amber : P.green;
  el('ctKpi').innerHTML = `
    <div class="card ct-kpicard">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="lbl">Tyre Life / TKPH</span><span class="mono" style="font-weight:600;color:${tyreColor}">${Math.round(S.tyre)}%</span></div>
      <div class="ct-bar"><div style="width:${Math.round(S.tyre)}%;background:${tyreColor}"></div></div>
      <div class="faint mono" style="font-size:10px;margin-top:5px">TKPH ${S.tkph} / ${S.tkphMax} · Front-left worst</div>
    </div>
    <div class="card ct-kpicard">
      <span class="lbl">Fleet KPIs vs target</span>
      <div class="ct-chips">${S.kpis.map((k) => `<div class="ct-chip"><div class="l">${k.label}</div><div class="v" style="color:${k.good ? P.accent : P.amber}">${k.value.toFixed(k.dec)}<span class="u">${k.unit}</span> <span style="color:${k.up ? (k.higherGood ? P.green : P.red) : (k.higherGood ? P.red : P.green)}">${k.up ? '▲' : '▼'}</span></div></div>`).join('')}</div>
    </div>
    <div class="card ct-kpicard">
      <span class="lbl">Integrated Schedule</span>
      <div class="ct-sched" style="margin-top:7px">Mining bench 460RL ore · phase 2 → crusher<br><span class="faint mono" style="font-size:10px">Target ETA 14:00 · </span><span class="mono" style="font-size:10px;color:${P.green}">Proj 13:20</span></div>
      <div class="ct-sched next" style="margin-top:6px">Next · 18:00 — Shift change-over + relocate to WD-2</div>
    </div>
    <div class="card ct-kpicard" style="margin-top:auto">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="lbl">Tonnes vs Target</span><span class="mono" style="font-size:11px;color:var(--muted)">${Math.round(S.tonnes).toLocaleString('en-US')} / ${S.tonnesTarget.toLocaleString('en-US')}</span></div>
      <div style="height:40px;margin-top:4px">${areaSVG(S.tonnesHistory, P.accent, 300, 42, 'ta1')}</div>
      <div class="ct-bar"><div style="width:${(S.tonnes / S.tonnesTarget * 100).toFixed(1)}%;background:${P.accent}"></div></div>
    </div>`;
}

// ── Index cards ───────────────────────────────────────────────────────────────
function renderCards() {
  const mfbar = S.shovels.map((sh) => { const f = cl((sh.mf - 0.7) / 0.6, 0, 1) * 100; const oob = sh.mf < 0.9 || sh.mf > 1.1; return `<div style="margin-top:7px"><div style="display:flex;justify-content:space-between;font-size:10px"><span class="mono">${sh.id}</span><span class="mono" style="color:${oob ? P.red : P.text}">${sh.mf.toFixed(2)}</span></div><div class="ct-bar" style="position:relative"><div style="position:absolute;left:${(0.2 / 0.6 * 100).toFixed(1)}%;width:${(0.2 / 0.6 * 100).toFixed(1)}%;height:100%;background:var(--accent-soft)"></div><div style="position:absolute;left:${f.toFixed(1)}%;width:3px;height:100%;background:${oob ? P.red : P.accent}"></div></div></div>`; }).join('');
  const cards = [
    { i: 0, t: 'Match-Factor Balance', body: `${mfbar}<div class="faint mono" style="font-size:9px;margin-top:7px">band = target 0.9–1.1</div>` },
    { i: 1, t: 'Ground Vibration · PPV', body: `<div style="flex:1;min-height:0">${gaugeSVG({ value: S.vib, min: 0, max: 8, thr: [5, 7], valueStr: S.vib.toFixed(1), unit: 'mm/s', W: 220, H: 84 })}</div>` },
    { i: 2, t: 'Slope Stability · Radar', body: `<div style="flex:1;min-height:0">${gaugeSVG({ value: S.slope, min: 800, max: 1600, thr: [1050, 1450], valueStr: String(Math.round(S.slope)), unit: 'mm', W: 220, H: 84 })}</div>` },
    { i: 3, t: 'Dilution / Ore Loss', body: `<div style="flex:1;min-height:0">${gaugeSVG({ value: S.dil, min: 0, max: 10, thr: [6, 8], valueStr: S.dil.toFixed(1) + '%', unit: '', W: 220, H: 84 })}</div>` },
  ];
  el('ctCards').innerHTML = cards.map((c) => `<div class="card ct-card" data-card="${c.i}"><span class="lbl">${c.t}</span>${c.body}</div>`).join('');
  el('ctCards').querySelectorAll('[data-card]').forEach((c) => c.addEventListener('click', () => openCard(+c.dataset.card)));
}
function openCard(i) {
  const meta = [
    { t: 'Match-Factor Balance', v: S.g.match.toFixed(2) + ' ratio', d: Array.from({ length: 24 }, (_, k) => 1.0 + Math.sin(k / 3) * 0.12), c: P.accent, leg: 'Target band 0.9–1.1' },
    { t: 'Ground Vibration · PPV', v: S.vib.toFixed(1) + ' mm/s', d: Array.from({ length: 24 }, (_, k) => 2.5 + Math.sin(k / 2) * 1.1), c: P.amber, leg: 'High 5 · Crit 7 mm/s' },
    { t: 'Slope Stability · Radar', v: Math.round(S.slope) + ' mm', d: Array.from({ length: 24 }, (_, k) => 1270 + Math.sin(k / 4) * 60), c: P.blue, leg: 'Alert 1050 · Crit 1450 mm' },
    { t: 'Dilution / Ore Loss', v: S.dil.toFixed(1) + '%', d: Array.from({ length: 24 }, (_, k) => 5.5 + Math.sin(k / 3) * 0.8), c: P.green, leg: 'High 6 · Crit 8 %' },
  ][i];
  const wrap = document.createElement('div'); wrap.className = 'ct-scrim';
  wrap.innerHTML = `<div class="ct-modal"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b style="font-size:16px">${meta.t}</b><span style="cursor:pointer;color:var(--muted)" id="ctModalX">✕</span></div>
    <div class="mono" style="font-size:24px;color:var(--text);margin-bottom:10px">${meta.v}</div>
    <div style="height:130px">${lineSVG(meta.d, meta.c, 420, 120, 'cm' + i)}</div>
    <div class="faint mono" style="font-size:11px;margin-top:8px">${meta.leg}</div></div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.id === 'ctModalX') wrap.remove(); });
  root.appendChild(wrap);
}

// ── Comms ─────────────────────────────────────────────────────────────────────
const REPLIES = ['Copy — adjusting dispatch now.', 'Understood, watching that unit.', 'Grader re-tasked, will update cycle ETA.', 'Acknowledged. Shovel 2 queue easing.', 'Roger, holding two trucks off SH-02.'];
function renderComms() {
  el('ctComms').innerHTML = `
    <div class="ct-chead"><span class="ct-online"></span><b style="font-size:13px">InPit Dispatch</b><span class="faint mono" style="font-size:10px;margin-left:auto">ONLINE</span></div>
    <div class="ct-msgs" id="ctMsgs"></div>
    <div class="ct-cinput"><input id="ctChatIn" placeholder="Message dispatch…"/><button id="ctSend">SEND</button></div>`;
  paintMsgs();
  el('ctSend').addEventListener('click', sendChat);
  el('ctChatIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
}
function paintMsgs() {
  el('ctMsgs').innerHTML = S.chat.map((m) => `<div class="ct-msg ${m.mine ? 'mine' : ''}"><div class="ct-bub">${esc(m.text)}</div><div class="ct-meta">${m.mine ? 'You' : 'Dispatch'} · ${m.time}</div></div>`).join('');
  el('ctMsgs').scrollTop = el('ctMsgs').scrollHeight;
}
async function sendChat() {
  const inp = el('ctChatIn'); const v = inp.value.trim(); if (!v) return;
  S.chat.push({ who: 'you', text: v, time: hhmm(new Date()), mine: true }); inp.value = ''; paintMsgs();
  let text;
  try { const r = await postJSON('/api/iroc/copilot', { question: v, state: dutyState() }); text = r.answer; }
  catch { text = REPLIES[Math.floor(Math.random() * REPLIES.length)]; }
  S.chat.push({ who: 'dispatch', text: text || '…', time: hhmm(new Date()), mine: false }); paintMsgs();
}

// ── Secondary tabs ────────────────────────────────────────────────────────────
function statCards(arr) { return `<div class="ct-stat" style="grid-template-columns:repeat(${arr.length},1fr)">${arr.map((s) => `<div class="card ct-statcard"><span class="lbl">${s.l}</span><div class="big" style="${s.c ? 'color:' + s.c : ''}">${s.v}</div><div class="faint" style="font-size:11px;margin-top:3px">${s.s || ''}</div></div>`).join('')}</div>`; }
function secondaryTab(tab) {
  if (tab === 'ASSET HEALTH') {
    const units = [['CAT-301', 'None', 94, 240, '—', '—', 'ok'], ['CAT-305', 'TYRE-TEMP', 71, 198, '8 h · SCHEDULE', '36 h', 'amber'], ['CAT-308', 'HYD E-1623', 12, 120, 'IN SERVICE', 'FAILED', 'red'], ['CAT-303', 'None', 90, 226, '—', '—', 'ok'], ['CAT-307', 'BRAKE-WEAR', 82, 210, '60 h', '120 h', 'amber']];
    return statCards([{ l: 'Fleet availability', v: '88%', s: 'MTBF 214h · MTTR 6.2h' }, { l: 'Units in service', v: '7/8', s: '1 down (CAT-308)' }, { l: 'Predictive flags', v: '2', s: 'tyre · brake', c: P.amber }]) +
      `<div class="card" style="padding:6px 4px"><table class="ct-table"><thead><tr><th>Unit</th><th>Top fault</th><th>Health</th><th>MTBF</th><th>To service</th><th>Time-to-failure</th></tr></thead><tbody>${units.map(([u, f, h, mt, ts, tf, sev]) => `<tr style="background:${sev === 'red' ? 'rgba(220,38,38,.07)' : sev === 'amber' ? 'rgba(217,119,6,.06)' : 'transparent'}"><td class="m">${u}</td><td>${f}</td><td class="m" style="color:${h < 40 ? P.red : h < 75 ? P.amber : P.green}">${h}%</td><td class="m">${mt}h</td><td class="m">${ts}</td><td class="m">${tf}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if (tab === 'PRODUCTION') {
    return `<div style="display:grid;grid-template-columns:1.6fr 1fr;gap:8px;flex:1;min-height:0">
      <div class="card" style="padding:12px;display:flex;flex-direction:column"><span class="lbl">Production · tonnes vs target</span><div style="flex:1;min-height:160px">${areaSVG(S.tonnesHistory, P.accent, 640, 260, 'pa')}</div><div class="faint mono" style="font-size:11px">${Math.round(S.tonnes).toLocaleString('en-US')} / ${S.tonnesTarget.toLocaleString('en-US')} t · ${(S.tonnes / S.tonnesTarget * 100).toFixed(1)}%</div></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="card ct-statcard"><span class="lbl">Rate t/h vs benchmark</span><div class="big">${S.g.prod.toFixed(1)}<span style="font-size:14px;color:var(--muted)"> kt/h</span></div><div class="ct-bar"><div style="width:${cl(S.g.prod / 7.2 * 100, 0, 100)}%;background:${P.accent}"></div></div><div class="faint" style="font-size:11px;margin-top:4px">benchmark 6.5 · peak 7.2</div></div>
        <div class="card" style="padding:12px;overflow:auto"><span class="lbl">Payload by unit</span>${S.trucks.filter((t) => !t.down).map((t) => `<div style="margin-top:8px"><div style="display:flex;justify-content:space-between;font-size:11px"><span class="mono">${t.id}</span><span class="mono">${t.payload} t</span></div><div class="ct-hbar"><div style="width:${cl(t.payload / 256 * 100, 0, 100)}%"></div></div></div>`).join('')}</div>
      </div></div>`;
  }
  if (tab === 'PLAN vs ACTUAL') {
    const benches = [['460 RL', 92, 88], ['475 RL', 76, 80], ['445 RL', 64, 60], ['490 RL', 41, 45]];
    return statCards([{ l: 'Schedule adherence', v: '92%', c: P.green }, { l: 'Tonnes variance', v: '−2.4%', c: P.amber }, { l: 'Re-handles', v: '3' }]) +
      `<div class="card" style="padding:14px"><span class="lbl">Planned vs actual · by bench</span>${benches.map(([b, act, plan]) => `<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:12px"><span class="mono">${b}</span><span class="mono">${act}% <span class="faint">/ plan ${plan}%</span></span></div><div class="ct-hbar" style="position:relative"><div style="width:${act}%;background:${act >= plan ? P.green : P.amber}"></div><div style="position:absolute;left:${plan}%;top:-2px;width:2px;height:18px;background:var(--needle)"></div></div></div>`).join('')}</div>`;
  }
  if (tab === 'SUSTAINABILITY') {
    const c = [['CO₂ intensity', '12.4', 'kg/t', P.amber], ['Diesel vs target', '41', 'L/100t', P.amber], ['Water use', '0.42', 'm³/t', P.green], ['Tailings / slope risk', 'ELEVATED', '', P.amber]];
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${c.map(([l, v, u, col]) => `<div class="card ct-statcard"><span class="lbl">${l}</span><div class="big" style="color:${col}">${v}<span style="font-size:14px;color:var(--muted)"> ${u}</span></div></div>`).join('')}</div>`;
  }
  return statCards([{ l: 'Tonnes moved', v: Math.round(S.tonnes).toLocaleString('en-US') }, { l: 'Avg availability', v: '88%' }, { l: 'Cycles', v: '412' }, { l: 'Alarms', v: String(S.alertCount) }]) +
    `<div class="card" style="padding:14px"><span class="lbl">Handover notes</span><p style="font-size:13px;line-height:1.5;color:var(--text);margin:8px 0 0">Shift A held 88% availability with CAT-308 out on a hydraulic fault (E-1623) — relocation crew assigned. Shovel 2 ran over-trucked through the afternoon; two trucks held off to keep match factor near band. Wet patch on haul-road segment B graded mid-shift, cycle times recovered ~1.5 min. Tonnes 184k of 230k plan; projected on-target by 18:00 handover.</p></div>
    <div class="card" style="padding:14px"><span class="lbl">Top alarms this shift</span>${S.alarms.slice(0, 5).map((a) => `<div class="ct-alrow" style="cursor:default"><span class="d" style="background:${sevColor(a.sev)}"></span><div><div class="tx">${esc(a.text)}</div><div class="mt">${a.unit ? a.unit + ' · ' : ''}${a.time}</div></div></div>`).join('')}</div>`;
}

// ── Boot ──────────────────────────────────────────────────────────────────────
readPalette();
renderShell();
setInterval(tick, 1100);
tick();
