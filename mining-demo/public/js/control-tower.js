// IROC — Integrated Operations Centre (single-view command console).
// One screen: live pit fleet map + KPIs + constraint/gauge/disruption dock on
// the left, an AI duty-controller rail on the right. One simulation loop drives
// everything; the AI (duty analysis, NL parse, copilot) comes from /api/iroc/*
// with unbreakable fallbacks. Three light theme variants.
const root = document.getElementById('irocRoot');
const el = (id) => document.getElementById(id);
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const hhmm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function postJSON(url, body) { const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); }

const FALL = { text: '#1f2937', muted: '#647082', faint: '#8a95a3', accent: '#0d9488', green: '#059669', amber: '#d97706', red: '#dc2626', blue: '#2563eb', gray: '#94a3b8', ret: '#0891b2', needle: '#334155', truckStroke: 'rgba(15,23,42,.45)' };
const VARS = { text: 'text', muted: 'muted', faint: 'faint', accent: 'accent', green: 'green', amber: 'amber', red: 'red', blue: 'blue', gray: 'gray', ret: 'ret', needle: 'needle', truckStroke: 'truck-stroke' };
let P = { ...FALL };
function readPalette() { const cs = getComputedStyle(root); const o = {}; for (const k in VARS) { const v = cs.getPropertyValue('--' + VARS[k]).trim(); o[k] = v || FALL[k]; } P = o; }
const CCOL = { loader: '#0e7490', 'haul-road': '#d97706', crusher: '#dc2626', mill: '#7c3aed', geotech: '#b91c1c', weather: '#2563eb', fleet: '#0d9488' };

const ROUTES = {
  ore1: [[250, 210], [430, 170], [650, 150], [860, 150]], ore2: [[420, 430], [600, 330], [740, 230], [860, 150]],
  waste1: [[250, 210], [480, 250], [700, 300], [880, 330]], waste2: [[420, 430], [540, 490], [640, 525], [700, 540]],
};
function pointAlong(pts, t) {
  const segs = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(L); total += L; }
  let d = cl(t, 0, 1) * total;
  for (let i = 0; i < segs.length; i++) { if (d <= segs[i] || i === segs.length - 1) { const f = segs[i] ? d / segs[i] : 0; return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, ang: Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) * 180 / Math.PI }; } d -= segs[i]; }
  return { x: pts[0][0], y: pts[0][1], ang: 0 };
}
const statusColor = (s) => ({ Hauling: P.green, Returning: P.ret, Queuing: P.amber, Spotting: P.blue, Loading: P.blue, Dumping: P.blue, Down: P.gray }[s] || P.green);
const sevColor = (s) => (s === 'red' ? P.red : s === 'amber' ? P.amber : P.blue);

// ── State ─────────────────────────────────────────────────────────────────────
function seedHist() { const a = []; let v = 152000; for (let i = 0; i < 48; i++) { v += Math.random() * 900 + 350; a.push(Math.min(184320, Math.round(v))); } a.push(184320); return a; }
const S = {
  now: new Date(),
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
  tyre: 74, tonnes: 184320, tonnesTarget: 230000, tonnesHistory: seedHist(), crusherBin: 56,
  alarms: [
    { id: 1, sev: 'red', text: 'Shovel 2 over-trucked — queue building (3)', unit: 'SH-02', time: '13:04' },
    { id: 2, sev: 'amber', text: 'Haul-road grade alert — segment B wet', unit: null, time: '13:01' },
    { id: 3, sev: 'amber', text: 'CAT-305 tyre temp rising (TKPH)', unit: 'CAT-305', time: '12:58' },
    { id: 4, sev: 'red', text: 'CAT-308 down — hydraulic fault E-1623', unit: 'CAT-308', time: '12:41' },
  ],
  alertCount: 4, alarmsOpen: false, selected: null, highlight: null, vib: 2.5, slope: 1270, dil: 5.5,
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
    else if (dir > 0) { stage = 'Hauling'; status = 'Hauling'; } else { stage = 'Returning'; status = 'Returning'; payload = 0; }
    if (np > 0.06 && np < 0.94 && status === 'Spotting') status = dir > 0 ? 'Hauling' : 'Returning';
    return { ...t, tpos: np, dir, stage, status, payload };
  });
  const g = S.g;
  g.matchT = cl(g.matchT + (Math.random() - 0.5) * 0.05, 0.86, 1.16);
  g.cycleT = cl(g.cycleT + (Math.random() - 0.5) * 0.6, 21, 29);
  g.prodT = cl(g.prodT + (Math.random() - 0.5) * 0.25, 5.2, 7.2);
  if (S.disruption && S.dEff) { if (S.dEff.prodT != null) g.prodT = S.dEff.prodT; if (S.dEff.matchT != null) g.matchT = S.dEff.matchT; if (S.dEff.cycleT != null) g.cycleT = S.dEff.cycleT; }
  g.match += (g.matchT - g.match) * 0.30; g.cycle += (g.cycleT - g.cycle) * 0.30; g.prod += (g.prodT - g.prod) * 0.30;
  S.shovels = S.shovels.map((sh) => ({ ...sh, mf: cl(sh.mf + (Math.random() - 0.5) * 0.06, sh.id === 'SH-02' ? 1.0 : 0.85, sh.id === 'SH-02' ? 1.28 : 1.12) }));
  S.tonnes = Math.min(S.tonnesTarget, S.tonnes + 70 + Math.random() * 120);
  S.tonnesHistory = [...S.tonnesHistory, Math.round(S.tonnes)]; if (S.tonnesHistory.length > 70) S.tonnesHistory.shift();
  S.tyre -= 0.015; if (S.tyre < 58) S.tyre = 74;
  S.crusherBin = (S.disruption && S.dEff && S.dEff.crusherBin != null) ? S.dEff.crusherBin : cl(54 + Math.sin(now.getTime() / 9000) * 30, 0, 100);
  S.vib = cl(2.5 + Math.sin(now.getTime() / 5200) * 1.1, 0, 8); S.slope = cl(1270 + Math.sin(now.getTime() / 7000) * 55, 800, 1600); S.dil = cl(5.5 + Math.sin(now.getTime() / 6100) * 0.7, 0, 10);
  if (Math.random() < 0.05) {
    const pool = [{ sev: 'amber', text: 'Truck CAT-305 low tyre pressure', unit: 'CAT-305' }, { sev: 'red', text: 'Shovel 2 over-trucked', unit: 'SH-02' }, { sev: 'amber', text: 'Haul-road grade alert — seg B', unit: null }, { sev: 'amber', text: 'CAT-302 speeding on ramp R3', unit: 'CAT-302' }, { sev: 'red', text: 'Slope radar prism P-12 movement', unit: null }, { sev: 'amber', text: 'Crusher feed bin 82% full', unit: null }];
    const a = pool[Math.floor(Math.random() * pool.length)]; S.alarms = [{ ...a, id: now.getTime(), time: hhmm(now) }, ...S.alarms].slice(0, 14); S.alertCount += 1;
  }
  if (el('ctClock')) el('ctClock').textContent = hhmm(now) + ':' + String(now.getSeconds()).padStart(2, '0');
  if (el('ctBadge')) el('ctBadge').textContent = S.alertCount;
  if (el('ctKpis')) { renderKPIs(); updateDock(); updateMap(); if (!S.disruption) renderSummary(); }
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
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="display:block;overflow:hidden"><g>${segs}</g><g>${ticks}</g>` +
    `<text x="${pt(180, R + 3)[0].toFixed(1)}" y="${cy + 12}" font-size="9" fill="${P.faint}" font-family="'IBM Plex Mono'">${min}</text>` +
    `<text x="${pt(0, R + 3)[0].toFixed(1)}" y="${cy + 12}" text-anchor="end" font-size="9" fill="${P.faint}" font-family="'IBM Plex Mono'">${max}</text>` +
    `<line x1="${bp[0].toFixed(1)}" y1="${bp[1].toFixed(1)}" x2="${np[0].toFixed(1)}" y2="${np[1].toFixed(1)}" stroke="${P.needle}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="5.5" fill="${P.needle}"/>` +
    `<text x="${cx}" y="${(cy - R * 0.32).toFixed(1)}" text-anchor="middle" font-family="'IBM Plex Mono'" font-weight="600" font-size="${(R * 0.33).toFixed(1)}" fill="${P.text}">${valueStr || ''}</text>` +
    (unit ? `<text x="${cx}" y="${(cy - R * 0.32 + 12).toFixed(1)}" text-anchor="middle" font-size="10" fill="${P.muted}">${unit}</text>` : '') + `</svg>`;
}
function lineSVG(data, color, W, H, id) { const max = Math.max(...data), min = Math.min(...data); const X = (i) => i / (data.length - 1) * W, Y = (v) => H - ((v - min) / ((max - min) || 1)) * (H - 8) - 4; const line = 'M' + data.map((v, i) => X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' L'); return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none" style="display:block"><path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`; }
const spark = (seed) => { const a = []; for (let i = 0; i < 14; i++) a.push(22 + Math.sin(i / 2 + seed) * 3.2 + Math.cos(i / 3 + seed) * 1.5 + 1.5); return a; };

// ── Shell ─────────────────────────────────────────────────────────────────────
function renderShell() {
  root.innerHTML = `
    <header class="ct-hdr">
      <a class="ct-brand" href="/index.html#matrix" title="Back to OreSight"><span class="ct-logo">OS</span>
        <span><span class="ct-bt1">IROC · Batu Hijau Pit</span><br><span class="ct-bt2">Integrated Operations Centre · OreSight AI</span></span></a>
      <span class="ct-spacer"></span>
      <div class="ct-seg" id="ctVariant">${['console', 'blueprint', 'warm'].map((v) => `<button data-v="${v}">${v}</button>`).join('')}</div>
      <div><div class="ct-clock mono" id="ctClock">--:--:--</div><div class="ct-shift">Shift A · 06:00–18:00</div></div>
      <button class="ct-ico" id="ctBell" title="Alarms">⚑<span class="ct-badge" id="ctBadge">4</span></button>
      <span class="ct-live"><span class="dot"></span><span>Live</span></span>
    </header>
    <div class="ct-body">
      <div class="ct-left">
        <div class="ct-kpis" id="ctKpis"></div>
        <div class="card ct-map" id="ctMap"></div>
        <div class="ct-dock" id="ctDock"></div>
      </div>
      <aside class="ct-rail">
        <div class="ct-rail-top" id="ctRailTop"></div>
        <div class="card ct-copilot" id="ctCopilot"></div>
      </aside>
    </div>`;
  el('ctVariant').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setVariant(b.dataset.v)));
  el('ctBell').addEventListener('click', () => { S.alarmsOpen = !S.alarmsOpen; S.selected = null; updateMap(); });
  renderKPIs(); buildMap(); renderDock(); renderSummary(); renderCopilot(); updateMap(); updateDock();
  setVariant('console');
}
function setVariant(v) { root.setAttribute('data-variant', v); el('ctVariant').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === v)); requestAnimationFrame(() => { readPalette(); buildMap(); renderDock(); updateMap(); updateDock(); if (S.disruption && S.dutyResp) renderDuty(S.dutyResp); else renderSummary(); }); }

// ── KPI row ───────────────────────────────────────────────────────────────────
function renderKPIs() {
  const planPct = S.tonnes / S.tonnesTarget * 100;
  const mfOk = S.g.match >= 0.9 && S.g.match <= 1.1;
  const kpis = [
    { l: 'Production rate', v: S.g.prod.toFixed(1), u: 'kt/h', d: S.g.prod >= 6.4 ? 'on target' : (S.g.prod - 6.5).toFixed(1), dc: S.g.prod >= 6.0 ? P.green : P.amber, sub: 'target 6.5 kt/h' },
    { l: 'Tonnes to plan', v: planPct.toFixed(1), u: '%', d: Math.round(S.tonnes / 1000) + 'k / ' + Math.round(S.tonnesTarget / 1000) + 'k', dc: P.muted, sub: 'shift plan' },
    { l: 'Fleet match factor', v: S.g.match.toFixed(2), u: '', d: mfOk ? 'balanced' : (S.g.match > 1.1 ? 'over-trucked' : 'under-trucked'), dc: mfOk ? P.green : P.amber, sub: 'target 0.9–1.1' },
  ];
  el('ctKpis').innerHTML = kpis.map((k) => `<div class="card ct-kpi"><div class="ct-kpi-top"><span class="lbl">${k.l}</span><span class="ct-kpi-d" style="color:${k.dc}">${k.d}</span></div><div class="ct-kpi-v">${k.v}${k.u ? `<span>${k.u}</span>` : ''}</div><div class="ct-kpi-sub">${k.sub}</div></div>`).join('');
}

// ── Predictive (shared by map overlay + summary) ──────────────────────────────
function predData() {
  const sh2 = S.shovels.find((x) => x.id === 'SH-02');
  const bin = Math.round(S.crusherBin);
  return [
    { p: bin, t: 'Crusher feed bin → choke', c: bin > 75 ? 'hi' : bin > 50 ? 'med' : 'lo' },
    { p: S.tyre < 66 ? 71 : 32, t: 'CAT-305 tyre TKPH → limit', c: S.tyre < 66 ? 'hi' : 'lo' },
    { p: sh2 && sh2.mf > 1.15 ? 64 : 24, t: 'Shovel 2 over-truck / queue', c: sh2 && sh2.mf > 1.15 ? 'med' : 'lo' },
  ];
}
function renderPred() { if (!el('ctPred')) return; el('ctPred').innerHTML = `<div class="ct-pred-cap">✦ AI predictive · next 30 min</div>${predData().map((r) => `<div class="ct-pred-row"><span class="ct-pred-p ${r.c}">${r.p}%</span><span>${r.t}</span></div>`).join('')}`; }

// ── Fleet map ─────────────────────────────────────────────────────────────────
function buildMap() {
  let grid = '';
  for (let x = 0; x <= 1000; x += 150) grid += `<line x1="${x}" y1="0" x2="${x}" y2="600" style="stroke:var(--map-grid)" stroke-width="1"/>`;
  for (let y = 0; y <= 600; y += 250) grid += `<line x1="0" y1="${y}" x2="1000" y2="${y}" style="stroke:var(--map-grid)" stroke-width="1"/>`;
  const benches = [[262, 176, 'bench1'], [210, 140, 'bench2'], [160, 108, 'bench3'], [104, 70, 'bench4'], [52, 32, 'bench4']].map(([rx, ry, b]) => `<ellipse cx="350" cy="320" rx="${rx}" ry="${ry}" style="fill:var(--${b});stroke:var(--bench-line)" stroke-width="1"/>`).join('');
  const roads = ['ore1', 'ore2', 'waste1', 'waste2'].map((k) => { const pts = ROUTES[k].map((p) => p.join(',')).join(' '); return `<polyline points="${pts}" fill="none" style="stroke:var(--road)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${pts}" fill="none" style="stroke:var(--road-flow)" stroke-width="2.4" stroke-dasharray="7 11" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="18" to="0" dur="1.1s" repeatCount="indefinite"/></polyline>`; }).join('');
  const dests = [[810, 100, 'CRUSHER / ROM'], [832, 286, 'WD-1'], [654, 498, 'WD-2']].map(([x, y, lbl]) => `<g><rect x="${x}" y="${y}" width="48" height="34" rx="3" style="fill:var(--dest);stroke:var(--dest-stroke)" stroke-width="1.5"/><polygon points="${x},${y} ${x + 48},${y} ${x + 24},${y - 12}" style="fill:var(--dest-roof)"/><text x="${x + 24}" y="${y + 50}" text-anchor="middle" font-size="11" style="fill:var(--muted)" font-family="'IBM Plex Mono'">${lbl}</text></g>`).join('');
  const scene = `<svg class="scene" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"><rect x="0" y="0" width="1000" height="600" style="fill:var(--map-bg)"/>${grid}${benches}<text x="350" y="324" text-anchor="middle" font-size="13" style="fill:var(--pit-label)" font-family="'IBM Plex Mono'">460 RL</text>${roads}${dests}<g id="ctDisrupt"></g><g id="ctShovels"></g><g id="ctTrucks"></g><g id="ctHighlight"></g></svg>`;
  el('ctMap').innerHTML = scene + `
    <div class="ct-ovl tl"><div class="ct-livetag"><span class="ct-livedot"></span>LIVE FLEET MAP · BATU HIJAU PIT</div>
      <div class="ct-leg">${[['Hauling', P.green], ['Queuing', P.amber], ['Spotting', P.blue], ['Down', P.gray]].map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div>
      <div class="ct-predwrap" id="ctPred"></div></div>
    <div class="ct-ovl tr"><div class="ct-alpill" id="ctAlPill"><span class="d"></span>Alarms (<span id="ctAlCount">${S.alertCount}</span>) ▾</div></div>
    <div class="ct-ovl bl"><div class="ct-tele"><div class="lbl">Tonnes moved · shift</div><div class="big" id="ctTele">0</div><div class="faint mono" style="font-size:10px" id="ctTele2"></div></div></div>
    <div id="ctMapPop"></div>`;
  el('ctShovels').innerHTML = S.shovels.map((sh) => `<g data-unit="${sh.id}" style="cursor:pointer"><circle cx="${sh.x}" cy="${sh.y}" r="16" style="fill:var(--shovel-fill)" stroke="${P.accent}" stroke-width="2.5" class="ct-shring"/><rect x="${sh.x - 9}" y="${sh.y - 6}" width="18" height="12" rx="2" style="fill:var(--needle)"/><text x="${sh.x}" y="${sh.y + 30}" text-anchor="middle" font-size="10" style="fill:var(--muted)" font-family="'IBM Plex Mono'">${sh.id}</text></g>`).join('');
  el('ctTrucks').innerHTML = S.trucks.map((t) => `<g data-unit="${t.id}" style="cursor:pointer;transition:transform 1.05s linear"><rect x="-11" y="-6" width="22" height="12" rx="3" fill="${statusColor(t.status)}" stroke="${t.autonomy === 'AHS' ? P.accent : t.autonomy === 'Tele-remote' ? P.blue : P.truckStroke}" stroke-width="${t.autonomy === 'AHS' ? 1.6 : 1.2}" stroke-dasharray="${t.autonomy === 'Tele-remote' ? '3 2' : ''}"><title>${t.id} · ${t.autonomy}</title></rect></g>`).join('');
  el('ctMap').querySelectorAll('[data-unit]').forEach((g) => g.addEventListener('click', (e) => { e.stopPropagation(); S.selected = g.dataset.unit; S.alarmsOpen = false; updateMap(); }));
  el('ctAlPill').addEventListener('click', () => { S.alarmsOpen = !S.alarmsOpen; S.selected = null; updateMap(); });
  renderPred();
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
    pop.innerHTML = `<div class="ct-pop" style="top:46px;right:14px;width:330px;max-height:360px;overflow:auto">
      <div class="ct-triage">✦ AI triage · ${S.alarms.length} alarms → ${Object.keys(groups).length} events${top ? ` · top: ${esc(top[0])} (${top[1]})` : ''}</div>
      ${S.alarms.map((a) => `<div class="ct-alrow" data-al="${esc(a.unit || '')}"><span class="d" style="background:${sevColor(a.sev)}"></span><div><div class="tx">${esc(a.text)}</div><div class="mt">${a.unit ? a.unit + ' · ' : ''}${a.time}</div></div></div>`).join('')}</div>`;
    pop.querySelectorAll('.ct-alrow').forEach((row) => row.addEventListener('click', () => { const u = row.dataset.al; if (u) traceUnit(u); }));
  } else if (S.selected) {
    const t = S.trucks.find((x) => x.id === S.selected), sh = S.shovels.find((x) => x.id === S.selected);
    const ualarms = S.alarms.filter((a) => a.unit === S.selected);
    const rows = t ? [['Status', t.status], ['Autonomy', t.autonomy], ['Payload', `${t.payload} / ${t.target} t`], ['Stage', t.stage], ['Operator', t.operator]] : [['Dig rate', sh.digRate + ' t/h'], ['Trucks assigned', sh.assigned], ['Queue', sh.queue], ['Match factor', sh.mf.toFixed(2)]];
    pop.innerHTML = `<div class="ct-pop" style="top:46px;right:14px;width:268px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:13px">${t ? 'Truck' : 'Shovel'} · ${S.selected}</b><span style="cursor:pointer;color:var(--muted)" id="ctPopX">✕</span></div>${rows.map(([l, v]) => `<div style="display:flex;justify-content:space-between;gap:14px;padding:3px 0;font-size:12px"><span style="color:var(--muted)">${l}</span><span class="mono">${esc(String(v))}</span></div>`).join('')}<div class="lbl" style="margin:8px 0 4px">Cycle time</div><div style="height:40px">${lineSVG(spark(t ? t.seed : sh.id.length), P.accent, 200, 40, 'sp' + S.selected)}</div></div>`;
    el('ctPopX').addEventListener('click', () => { S.selected = null; updateMap(); });
  } else pop.innerHTML = '';
  el('ctHighlight').innerHTML = S.highlight ? `<circle cx="${S.highlight.x}" cy="${S.highlight.y}" r="14" fill="none" stroke="${P.accent}" stroke-width="3" style="animation:pulsering 4.6s ease-out"/>` : '';
}
function traceUnit(id) {
  const t = S.trucks.find((x) => x.id === id), sh = S.shovels.find((x) => x.id === id);
  let pos = null; if (t) pos = t.down ? { x: t.x, y: t.y } : pointAlong(ROUTES[t.route], t.tpos); else if (sh) pos = { x: sh.x, y: sh.y };
  if (!pos) return;
  S.highlight = { x: pos.x, y: pos.y, id }; S.selected = id; S.alarmsOpen = false; updateMap();
  setTimeout(() => { S.highlight = null; if (el('ctHighlight')) el('ctHighlight').innerHTML = ''; }, 4600);
}

// ── Dock (constraint · gauges · disruption) ───────────────────────────────────
function bindingNow() { if (S.dutyResp && S.dutyResp.bindingConstraint) return S.dutyResp.bindingConstraint; if (S.crusherBin > 88) return 'crusher'; const sh2 = S.shovels.find((x) => x.id === 'SH-02'); if (sh2 && (sh2.mf > 1.15 || sh2.mf < 0.85)) return 'loader'; return 'fleet'; }
function constraintBars() { const sh2 = S.shovels.find((x) => x.id === 'SH-02') || { mf: 1 }; return [['loader', Math.round(cl(sh2.mf, 0.8, 1.3) / 1.3 * 100), CCOL.loader], ['haul-road', 72, CCOL['haul-road']], ['crusher', Math.round(S.crusherBin), CCOL.crusher], ['fleet', Math.round(cl(S.g.match, 0.7, 1.3) / 1.3 * 100), CCOL.fleet]]; }
function renderDock() {
  el('ctDock').innerHTML = `
    <div class="card ct-dpanel"><div class="ct-dcap2">Binding constraint</div><div class="ct-bind" id="ctBindName">fleet</div><div class="ct-dbars" id="ctBindBars"></div></div>
    <div class="card ct-dpanel ct-dgauges">
      <div class="ct-dg"><div class="ct-dcap2">Match factor</div><div id="ctMfGauge" style="flex:1;min-height:0"></div><div class="ct-dgv" id="ctMfVal">—</div></div>
      <div class="ct-dg"><div class="ct-dcap2">Crusher feed</div><div id="ctCrGauge" style="flex:1;min-height:0"></div><div class="ct-dgv" id="ctCrVal">—</div></div>
    </div>
    <div class="card ct-dpanel"><div class="ct-dcap2-row"><span class="ct-dcap2">Disruption · inject</span><button class="ct-dreset" id="ctDReset" title="Clear">↺</button></div>
      <div class="ct-dtoggles" id="ctDTog"></div>
      <div class="ct-dfree"><input id="ctDFree" placeholder="or type… 'lightning'"/><button id="ctDGo">→</button></div></div>`;
  renderDTog();
  el('ctDGo').addEventListener('click', dFree);
  el('ctDFree').addEventListener('keydown', (e) => { if (e.key === 'Enter') dFree(); });
  el('ctDReset').addEventListener('click', clearDisruption);
  updateDock();
}
function updateDock() {
  if (!el('ctBindName')) return;
  const b = bindingNow(); el('ctBindName').textContent = b; el('ctBindName').style.color = CCOL[b] || P.text;
  el('ctBindBars').innerHTML = constraintBars().map(([n, v, c]) => `<div><div class="ct-dbar-top"><span style="color:${n === b ? c : 'var(--muted)'}">${n.replace('-', ' ')}</span><span style="color:${n === b ? c : 'var(--text)'}">${v}%</span></div><div class="ct-dbar"><div style="width:${Math.min(100, v)}%;background:${c}"></div></div></div>`).join('');
  el('ctMfGauge').innerHTML = gaugeSVG({ value: S.g.match, min: 0.7, max: 1.3, greenLo: 0.9, greenHi: 1.1, valueStr: '', unit: '', W: 200, H: 104 });
  const mfOk = S.g.match >= 0.9 && S.g.match <= 1.1; el('ctMfVal').textContent = S.g.match.toFixed(2); el('ctMfVal').style.color = mfOk ? P.green : P.amber;
  el('ctCrGauge').innerHTML = gaugeSVG({ value: S.crusherBin, min: 0, max: 100, thr: [70, 90], valueStr: '', unit: '', W: 200, H: 104 });
  const cc = S.crusherBin > 90 ? P.red : S.crusherBin > 70 ? P.amber : P.green; el('ctCrVal').innerHTML = Math.round(S.crusherBin) + '<span>%</span>'; el('ctCrVal').style.color = cc;
}

// ── Disruptions + duty controller ─────────────────────────────────────────────
const DISRUPTIONS = [
  { id: 'shovel-down', label: 'Shovel down', dot: '#dc2626', alarm: { sev: 'red', text: 'SH-02 hydraulic fault — loading halted', unit: 'SH-02' }, trace: 'SH-02', eff: { downShovel: 'SH-02', g: { prodT: 5.4, matchT: 1.22, cycleT: 27.5 } } },
  { id: 'road-block', label: 'Road block', dot: '#d97706', alarm: { sev: 'amber', text: 'Haul-road seg B blocked — rockfall', unit: null }, trace: { x: 540, y: 490 }, eff: { exclusion: { x: 540, y: 490, r: 60 }, g: { prodT: 5.8, cycleT: 28 } } },
  { id: 'crusher-choke', label: 'Crusher choke', dot: '#dc2626', alarm: { sev: 'red', text: 'Gyratory choke — feed bin 96%', unit: null }, trace: { x: 834, y: 117 }, eff: { g: { prodT: 5.0 }, crusherBin: 96 } },
  { id: 'slope-alarm', label: 'Slope alarm', dot: '#dc2626', alarm: { sev: 'red', text: 'Slope radar prism P-12 accelerating', unit: null }, trace: { x: 300, y: 300 }, eff: { exclusion: { x: 300, y: 300, r: 92 }, g: { prodT: 5.6, matchT: 0.92 } } },
  { id: 'storm-hold', label: 'Lightning', dot: '#d97706', alarm: { sev: 'amber', text: 'Lightning within 10 km — AHS hold', unit: null }, trace: null, eff: { g: { prodT: 4.8, cycleT: 29 } } },
  { id: 'mill-trip', label: 'Mill trip', dot: '#dc2626', alarm: { sev: 'red', text: 'SAG mill trip — feed demand dropped', unit: null }, trace: { x: 834, y: 117 }, eff: { g: { prodT: 5.2 } } },
];
function dutyState() { return { site: 'Batu Hijau', tonnes: Math.round(S.tonnes), tonnesTarget: S.tonnesTarget, prodKtH: +S.g.prod.toFixed(1), matchFactor: +S.g.match.toFixed(2), crusherBinPct: Math.round(S.crusherBin), downUnits: S.trucks.filter((t) => t.down).map((t) => t.id).concat(S.downShovel ? [S.downShovel] : []), alarms: S.alarms.length, activeDisruption: S.disruption || 'none' }; }
function renderDTog() { if (!el('ctDTog')) return; el('ctDTog').innerHTML = DISRUPTIONS.map((d) => `<button class="ct-dtoggle" data-id="${d.id}"><span class="dot" style="background:${d.dot}"></span>${d.label}</button>`).join(''); el('ctDTog').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => applyDisruption(b.dataset.id))); syncDTog(); }
function syncDTog() { if (el('ctDTog')) el('ctDTog').querySelectorAll('.ct-dtoggle').forEach((b) => b.classList.toggle('active', b.dataset.id === S.disruption)); }
function applyDisruption(id) {
  const d = DISRUPTIONS.find((x) => x.id === id); if (!d) return;
  if (S.disruption === id) { clearDisruption(); return; }
  S.disruption = id; S.downShovel = d.eff.downShovel || null; S.exclusion = d.eff.exclusion || null; S.dEff = { ...(d.eff.g || {}), crusherBin: d.eff.crusherBin };
  S.alarms = [{ ...d.alarm, id: Date.now(), time: hhmm(new Date()) }, ...S.alarms].slice(0, 14); S.alertCount += 1;
  if (typeof d.trace === 'string') traceUnit(d.trace); else if (d.trace) { S.highlight = { x: d.trace.x, y: d.trace.y }; setTimeout(() => { S.highlight = null; if (el('ctHighlight')) el('ctHighlight').innerHTML = ''; }, 6000); }
  syncDTog(); updateMap(); updateDock();
  el('ctRailTop').innerHTML = `<div class="card ct-rt-card"><div class="ct-rt-head"><span class="ct-rt-badge">AI</span><span class="ct-rt-cap">Duty controller</span></div><div class="faint" style="font-size:13px;margin-top:6px">Analysing the exception across the chain…</div></div>`;
  fetchDuty(id, d);
}
function clearDisruption() { S.disruption = null; S.downShovel = null; S.exclusion = null; S.dEff = null; S.dutyResp = null; syncDTog(); updateMap(); updateDock(); renderSummary(); }
async function fetchDuty(id, d) {
  let r; try { r = await postJSON('/api/iroc/analyze', { scenario: { disruptionId: id, description: d.alarm.text, state: dutyState() } }); } catch { return; }
  if (S.disruption !== id) return; S.dutyResp = r; renderDuty(r); updateDock();
}
function renderDuty(r) {
  const pp = r.productionImpact || {};
  el('ctRailTop').innerHTML = `<div class="card ct-rt-card">
    <div class="ct-rt-head"><span class="ct-rt-badge">AI</span><span class="ct-rt-cap">Duty controller</span><span class="ct-rt-x" id="ctRtX">✕</span></div>
    <div class="ct-rt-hl">${esc(r.headline || '')}</div>
    <div class="ct-impact"><div><span class="l">At risk</span><span class="v">${pp.lostKt ?? '—'} kt</span></div><div><span class="l">To plan</span><span class="v" style="color:${(pp.planPct ?? 0) < 0 ? 'var(--red)' : 'var(--green)'}">${(pp.planPct ?? 0) > 0 ? '+' : ''}${pp.planPct ?? '—'}%</span></div><div><span class="l">Binding</span><span class="v">${esc(r.bindingConstraint || '—')}</span></div></div>
    <div class="ct-rt-sec">Prioritised actions</div>${(r.actions || []).map((a) => `<div class="ct-act"><div class="ct-act-a">${esc(a.action)}</div><div class="ct-act-m">${esc(a.impact || '')} · <b>${esc(a.owner || '')}</b></div></div>`).join('')}
    <div class="ct-rt-cols"><div><div class="ct-rt-sec">Root cause</div><div class="ct-rt-rc">${esc(r.rootCause || '')}</div></div><div><div class="ct-rt-sec">Controller rationale</div><div class="ct-rt-rc">${esc(r.narrative || '')}</div></div></div>
    ${r.draftedComms ? `<div class="ct-rt-sec">Drafted comms <span class="faint" style="font-weight:400;text-transform:none">· broadcast to dispatch</span></div><div class="ct-comms-draft">${esc(r.draftedComms)}</div>` : ''}
  </div>`;
  if (el('ctRtX')) el('ctRtX').addEventListener('click', clearDisruption);
}
function dFree() { const inp = el('ctDFree'); const v = (inp.value || '').trim(); if (!v) return; inp.value = ''; postJSON('/api/iroc/parse', { text: v }).then((r) => applyDisruption(r.disruptionId || 'shovel-down')).catch(() => {}); }

// ── Standing brief (idle rail) ────────────────────────────────────────────────
function renderSummary() {
  if (!el('ctRailTop') || S.disruption) return;
  const reds = S.alarms.filter((a) => a.sev === 'red').length, ambers = S.alarms.filter((a) => a.sev === 'amber').length;
  const groups = {}; S.alarms.forEach((a) => { const k = a.unit || a.text.split('—')[0].trim().split(' ').slice(0, 2).join(' '); groups[k] = (groups[k] || 0) + 1; });
  const planPct = (S.tonnes / S.tonnesTarget * 100).toFixed(1); const bin = Math.round(S.crusherBin); const mfOk = S.g.match >= 0.9 && S.g.match <= 1.1;
  const risks = [
    { p: reds > 0 ? 'HIGH' : ambers > 0 ? 'MED' : 'LOW', c: reds > 0 ? P.red : ambers > 0 ? P.amber : P.green, t: 'Open exceptions to plan', s: `${reds} red · ${ambers} amber on the bus — clear the reds first.` },
    { p: bin > 80 ? 'HIGH' : bin > 60 ? 'MED' : 'LOW', c: bin > 80 ? P.red : bin > 60 ? P.amber : P.green, t: 'Crusher feed / mill continuity', s: `Bin ${bin}% — keep a ROM buffer so the pit can't starve the mill.` },
    { p: mfOk ? 'LOW' : 'MED', c: mfOk ? P.green : P.amber, t: 'Fleet balance', s: `MF ${S.g.match.toFixed(2)} — ${S.g.match > 1.1 ? 'over-trucked' : S.g.match < 0.9 ? 'under-trucked' : 'balanced'}; hold the 0.9–1.1 band.` },
  ];
  el('ctRailTop').innerHTML = `<div class="card ct-rt-card">
    <div class="ct-rt-head"><span class="ct-rt-badge">AI</span><span class="ct-rt-cap">Duty controller · standing brief</span></div>
    <div class="ct-rt-hl">On plan at ${planPct}% — no active exception. Watching crusher feed and the alarm bus.</div>
    <div class="ct-rt-sec">Top risks to plan</div>${risks.map((r) => `<div class="ct-risk"><span class="p" style="color:${r.c}">${r.p}</span><div><div class="t">${r.t}</div><div class="s">${r.s}</div></div></div>`).join('')}
    <div class="ct-rt-cols"><div><div class="ct-rt-sec">Predictive · next 30 min</div>${predData().map((r) => `<div class="ct-pred-row" style="padding:3px 0"><span class="ct-pred-p ${r.c}" style="min-width:34px">${r.p}%</span><span style="font-size:11.5px">${r.t}</span></div>`).join('')}</div>
    <div><div class="ct-rt-sec">Alarm triage</div><div class="ct-triage" style="margin:0">✦ ${S.alarms.length} alarms → ${Object.keys(groups).length} events</div><div class="faint" style="font-size:11.5px;margin-top:8px;line-height:1.5">Related alarms cluster into ranked events. Inject a disruption to engage the duty controller.</div></div></div>
  </div>`;
}

// ── Copilot ───────────────────────────────────────────────────────────────────
const COPILOT_Q = ['Biggest risk to plan?', 'Where do I put the spare truck?', 'What is the binding constraint?'];
function renderCopilot() {
  el('ctCopilot').innerHTML = `<div class="ct-rt-cap">Copilot · ask the controller</div>
    <div class="ct-cp-qs">${COPILOT_Q.map((q) => `<button class="ct-cp-q" data-q="${esc(q)}">${q}</button>`).join('')}</div>
    <div class="ct-cp-row"><input id="ctCpIn" placeholder="Ask the IROC copilot…"/><button id="ctCpGo">Ask</button></div>
    <div class="ct-cp-ans" id="ctCpAns" style="display:none"></div>`;
  el('ctCpGo').addEventListener('click', () => askCp(el('ctCpIn').value));
  el('ctCpIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') askCp(el('ctCpIn').value); });
  el('ctCopilot').querySelectorAll('.ct-cp-q').forEach((b) => b.addEventListener('click', () => askCp(b.dataset.q)));
}
async function askCp(q) { q = (q || '').trim(); if (!q) return; el('ctCpIn').value = ''; const ans = el('ctCpAns'); ans.style.display = ''; ans.textContent = '…'; try { const r = await postJSON('/api/iroc/copilot', { question: q, state: dutyState() }); ans.textContent = r.answer || '—'; } catch { ans.textContent = '—'; } }

// ── Boot ──────────────────────────────────────────────────────────────────────
readPalette();
renderShell();
setInterval(tick, 1100);
tick();
