// Future Scheduling Platform — 48-h logistics schedule with disruption re-planning.
// Chain: jetty berths → barges → floating crane (transshipment) → OGVs.
import { renderNav, renderFooter, postJSON, renderAIResult, chartDefaults, setLoading, PALETTE, esc, $, $$ } from './shared.js';
import { witaTime } from './sim.js';

renderNav('fsp');
renderFooter();
chartDefaults();

setInterval(() => { $('#witaClock').textContent = witaTime(); }, 1000);
$('#witaClock').textContent = witaTime();

const H = 48;           // schedule horizon (hours)
const NOW = 14.5;       // "now" line position
const LABEL_W = 92;     // gantt label column px

const RESOURCES = [
  { id: 'JET-1', label: 'JETTY B1' },
  { id: 'JET-2', label: 'JETTY B2' },
  { id: 'BG-3101', label: 'BG-3101' },
  { id: 'BG-3102', label: 'BG-3102' },
  { id: 'BG-3103', label: 'BG-3103' },
  { id: 'BG-3104', label: 'BG-3104' },
  { id: 'FC-1', label: 'FC-1 CRANE' },
  { id: 'MV-ANOA', label: 'MV ANOA' },
  { id: 'MV-CELEBES', label: 'MV CELEBES' },
];
const BARGES = ['BG-3101', 'BG-3102', 'BG-3103', 'BG-3104'];

// ── Base plan ────────────────────────────────────────────────────────────────
// Barge cycle (14 h): load 4 h at jetty → transit 3 h → transship 3.5 h at FC-1
// → return 3.5 h. Stagger 3.5 h keeps the crane continuously fed.
function buildBasePlan() {
  const acts = [];
  BARGES.forEach((bg, i) => {
    const jetty = i % 2 === 0 ? 'JET-1' : 'JET-2';
    for (let t = i * 3.5 - 6, k = 0; t < H; t += 14, k++) {
      const cid = `${bg}-c${k}`;
      acts.push(
        { id: `${cid}-ld`, res: bg, start: t, dur: 4, type: 'load', label: `LOAD ${jetty.slice(-2)}`, barge: bg },
        { id: `${cid}-ldj`, res: jetty, start: t, dur: 4, type: 'load', label: bg.slice(-4), barge: bg },
        { id: `${cid}-to`, res: bg, start: t + 4, dur: 3, type: 'transit', label: '→ ANCH', barge: bg },
        { id: `${cid}-ts`, res: bg, start: t + 7, dur: 3.5, type: 'tranship', label: 'TRANSSHIP', barge: bg },
        { id: `${cid}-tsf`, res: 'FC-1', start: t + 7, dur: 3.5, type: 'tranship', label: bg.slice(-4), barge: bg },
        { id: `${cid}-tb`, res: bg, start: t + 10.5, dur: 3.5, type: 'transit', label: '→ JETTY', barge: bg },
      );
    }
  });
  acts.push(
    { id: 'anoa-laycan', res: 'MV-ANOA', start: 0, dur: 38, type: 'laycan', label: 'LAYCAN → 38H' },
    { id: 'anoa-load', res: 'MV-ANOA', start: 2, dur: 28, type: 'ogv', label: 'LOADING 54,000 T' },
    { id: 'celebes-laycan', res: 'MV-CELEBES', start: 34, dur: 14, type: 'laycan', label: 'LAYCAN OPENS 34H' },
    { id: 'celebes-load', res: 'MV-CELEBES', start: 36, dur: 12, type: 'ogv', label: 'LOADING (PLANNED)' },
  );
  return acts;
}

const shiftBarge = (acts, bg, fromHour, delta, moved) => {
  for (const a of acts) {
    if (a.barge === bg && a.start >= fromHour - 1e-6) { a.start += delta; if (moved) a.moved = true; }
  }
};

// Push overlapping blocks right on shared resources, propagating to the barge
// chain. Multi-pass to a fixed point: each push can reorder the row, so a
// single sweep over a stale sort can leave new conflicts behind.
function repairOverlaps(acts) {
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const res of ['FC-1', 'JET-1', 'JET-2']) {
      const blocks = acts.filter((a) => a.res === res && a.type !== 'maint').sort((a, b) => a.start - b.start);
      let prevEnd = -Infinity;
      for (const b of blocks) {
        if (b.start < prevEnd - 0.01) {
          shiftBarge(acts, b.barge, b.start, prevEnd - b.start, true);
          changed = true;
        }
        prevEnd = Math.max(prevEnd, b.start + b.dur);
      }
    }
    if (!changed) break;
  }
}

const DISRUPTIONS = {
  'jetty2-down': {
    title: 'Berth 2 loader breakdown — 4 h outage from 15:00',
    apply(acts) {
      acts.push({ id: 'd-jet2', res: 'JET-2', start: 15, dur: 4, type: 'maint', label: 'LOADER OUTAGE' });
      // Loads on JET-2 hitting the window re-slot to JET-1 with a slip.
      for (const a of acts.filter((x) => x.res === 'JET-2' && x.type === 'load' && x.start < 19 && x.start + x.dur > 15 && x.start >= NOW - 4)) {
        const tail = acts.filter((x) => x.barge === a.barge);
        for (const t of tail) if (t.start >= a.start - 1e-6) { if (t.res === 'JET-2') t.res = 'JET-1'; t.start += 2; t.moved = true; }
      }
      repairOverlaps(acts);
      return { adherence: 88.4, anoaSlip: 1, impact: 'Two barge loads re-slotted from berth 2 to berth 1; net slip +2 h; MV Anoa completion +1 h (laycan buffer 7 h).' };
    },
  },
  'swell': {
    title: 'Heavy swell at anchorage — transshipment rate −40% from 15:00 for 8 h',
    apply(acts) {
      for (const a of acts.filter((x) => x.type === 'tranship' && x.res !== 'FC-1' && x.start >= 14 && x.start < 23)) {
        const stretch = a.dur * 0.6;
        a.dur += stretch; a.moved = true;
        const twin = acts.find((x) => x.res === 'FC-1' && x.barge === a.barge && Math.abs(x.start - a.start) < 1e-6);
        if (twin) { twin.dur += stretch; twin.moved = true; }
        shiftBarge(acts, a.barge, a.start + a.dur - stretch, stretch, true);
      }
      repairOverlaps(acts);
      const anoa = acts.find((x) => x.id === 'anoa-load');
      anoa.dur += 5; anoa.moved = true;
      return { adherence: 86.9, anoaSlip: 5, impact: 'Transshipment blocks stretched through the swell window; barges held at jetty instead of queueing at sea; MV Anoa completion +5 h, still 3 h inside laycan.' };
    },
  },
  'barge-engine': {
    title: 'BG-3103 engine fault at 15:00 — barge held at jetty ~6 h',
    apply(acts) {
      acts.push({ id: 'd-bg3', res: 'BG-3103', start: 15, dur: 6, type: 'maint', label: 'ENGINE REPAIR' });
      shiftBarge(acts, 'BG-3103', 15, 6, true);
      shiftBarge(acts, 'BG-3104', 15, -2.5, true); // spare slack advanced to cover the crane
      repairOverlaps(acts);
      const anoa = acts.find((x) => x.id === 'anoa-load');
      anoa.dur += 2; anoa.moved = true;
      return { adherence: 89.6, anoaSlip: 2, impact: 'BG-3103 cycle suspended 6 h for repair at berth; BG-3104 advanced 2.5 h to keep FC-1 fed; MV Anoa completion +2 h.' };
    },
  },
};

// ── Gantt rendering ──────────────────────────────────────────────────────────
const gantt = $('#gantt');
const blockEls = new Map();
let tracks = {};

function ganttScaffold() {
  let axis = '<div></div><div class="gantt-axis">';
  for (let h = 0; h <= H; h += 6) {
    axis += `<div class="tick" style="left:${(h / H) * 100}%">${String((h) % 24).padStart(2, '0')}:00${h === 24 ? ' +1d' : ''}</div>`;
  }
  axis += '</div>';
  gantt.innerHTML = axis + RESOURCES.map((r) => `
    <div class="gantt-row-label">${r.label}</div>
    <div class="gantt-track" data-res="${r.id}">${Array.from({ length: H / 6 - 1 }, (_, i) => `<div class="grid-line" style="left:${((i + 1) * 6 / H) * 100}%"></div>`).join('')}</div>`).join('');
  gantt.insertAdjacentHTML('beforeend', `<div class="gantt-now" style="left: calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${NOW / H}); grid-row: 2 / span ${RESOURCES.length}; grid-column: 1 / -1; position: absolute;"></div>`);
  gantt.style.position = 'relative';
  tracks = Object.fromEntries($$('.gantt-track', gantt).map((t) => [t.dataset.res, t]));
}

function renderPlan(acts) {
  const seen = new Set();
  for (const a of acts) {
    const start = Math.max(a.start, 0);
    const end = Math.min(a.start + a.dur, H);
    if (end <= 0 || start >= H) continue;
    seen.add(a.id);
    let el = blockEls.get(a.id);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = a.id;
      blockEls.set(a.id, el);
      tracks[a.res]?.appendChild(el);
      el.style.left = `${(start / H) * 100}%`; // place before transition kicks in
    } else if (el.parentElement !== tracks[a.res]) {
      tracks[a.res]?.appendChild(el);
    }
    el.className = `gantt-block ${a.type}${a.moved ? ' moved' : ''}`;
    el.title = `${a.label} · ${start.toFixed(1)}h → ${end.toFixed(1)}h`;
    el.textContent = a.label;
    requestAnimationFrame(() => {
      el.style.left = `${(start / H) * 100}%`;
      el.style.width = `${((end - start) / H) * 100}%`;
    });
  }
  for (const [id, el] of blockEls) if (!seen.has(id)) { el.remove(); blockEls.delete(id); }
}

ganttScaffold();
renderPlan(buildBasePlan());

// ── Disruption flow ──────────────────────────────────────────────────────────
let planVersion = 12;
let protectedUSD = 621000;

$$('.disrupt-btn').forEach((btn) => btn.addEventListener('click', async () => {
  const key = btn.dataset.d;
  $$('.disrupt-btn').forEach((b) => b.classList.remove('active'));

  if (key === 'reset') {
    renderPlan(buildBasePlan());
    $('#fspStatus').textContent = `PLAN v${planVersion} · PUBLISHED`;
    $('#fspStatus').classList.remove('replanning');
    $('#kAdh').textContent = '94.2';
    return;
  }

  const d = DISRUPTIONS[key];
  btn.classList.add('active');
  $$('.disrupt-btn').forEach((b) => (b.disabled = true));
  const status = $('#fspStatus');
  status.textContent = 'RE-SOLVING SCHEDULE…';
  status.classList.add('replanning');

  // Apply the transform after a beat so the re-shuffle reads as a "solve".
  const acts = buildBasePlan();
  const result = d.apply(acts);
  setTimeout(() => {
    renderPlan(acts);
    planVersion += 1;
    status.textContent = `PLAN v${planVersion} · PUBLISHED`;
    status.classList.remove('replanning');
    $('#kAdh').textContent = result.adherence.toFixed(1);
    addLog(`${d.title} → re-plan v${planVersion} published (${result.impact.split(';')[0].toLowerCase()})`);
  }, 900);

  // AI rationale in parallel.
  const panel = $('#aiPanel');
  panel.classList.add('loading-shimmer');
  panel.innerHTML = `<div class="ai-panel-head"><span class="spark">✦</span><span class="t">OreSight AI — Re-plan rationale</span></div><div style="color:var(--muted); font-size:13.5px;">Re-solving 48-h schedule: ${esc(d.title)}…</div>`;
  try {
    const r = await postJSON('/api/usecase/analyze', {
      caseId: 'fsp',
      scenario: { disruptionId: key, description: d.title, scheduleImpact: result.impact, nowHour: NOW },
    });
    renderAIResult(panel, r);
    if (r.valueImpactUSD) {
      protectedUSD += Math.round(r.valueImpactUSD / 10);
      $('#kProtected').textContent = '$' + protectedUSD.toLocaleString('en-US');
    }
  } catch (e) {
    panel.innerHTML = `<div style="color:var(--red); font-size:13.5px;">${esc(e.message)}</div>`;
  } finally {
    panel.classList.remove('loading-shimmer');
    $$('.disrupt-btn').forEach((b) => (b.disabled = false));
  }
}));

// ── Tabs ─────────────────────────────────────────────────────────────────────
$$('.fsp-tab').forEach((tab) => tab.addEventListener('click', () => {
  $$('.fsp-tab').forEach((t) => t.classList.toggle('active', t === tab));
  for (const pane of ['outload', 'inload', 'execution']) {
    $(`#pane-${pane}`).style.display = pane === tab.dataset.tab ? '' : 'none';
  }
}));

// ── UC1: Inload network map ──────────────────────────────────────────────────
const NODES = {
  pit1: { x: 70, y: 70, label: 'PIT 1' },
  pit2: { x: 70, y: 230, label: 'PIT 2' },
  crusher: { x: 280, y: 150, label: 'CRUSHER' },
  stockyard: { x: 440, y: 150, label: 'STOCKYARD' },
  jetty: { x: 580, y: 150, label: 'JETTY' },
};
const EDGES = [['pit1', 'crusher'], ['pit2', 'crusher'], ['crusher', 'stockyard'], ['stockyard', 'jetty']];
const svg = $('#netmap');
svg.innerHTML = `
  ${EDGES.map(([a, b]) => `<line x1="${NODES[a].x}" y1="${NODES[a].y}" x2="${NODES[b].x}" y2="${NODES[b].y}" stroke="#2c382a" stroke-width="3"/>`).join('')}
  <line x1="${NODES.crusher.x}" y1="${NODES.crusher.y}" x2="${NODES.stockyard.x}" y2="${NODES.stockyard.y}" stroke="#3d6b45" stroke-width="3" stroke-dasharray="6 5"><animate attributeName="stroke-dashoffset" from="22" to="0" dur="1.2s" repeatCount="indefinite"/></line>
  ${Object.values(NODES).map((n) => `<g><circle cx="${n.x}" cy="${n.y}" r="15" fill="#15803d"/><text x="${n.x}" y="${n.y + 32}" fill="#8fa18f" font-size="10" font-family="JetBrains Mono, monospace" font-weight="700" text-anchor="middle">${n.label}</text></g>`).join('')}
  <g id="convoys"></g>`;

const convoys = [
  { from: 'pit1', to: 'crusher', t: 0.1, speed: 0.004, id: 'CV-01' },
  { from: 'pit1', to: 'crusher', t: 0.55, speed: 0.004, id: 'CV-02' },
  { from: 'pit2', to: 'crusher', t: 0.3, speed: 0.0035, id: 'CV-03' },
  { from: 'pit2', to: 'crusher', t: 0.8, speed: 0.0035, id: 'CV-04' },
  { from: 'stockyard', to: 'jetty', t: 0.4, speed: 0.005, id: 'FEL-1' },
];
const convoyLayer = svg.querySelector('#convoys');
convoyLayer.innerHTML = convoys.map((c, i) => `<circle id="cv${i}" r="5" fill="#e8c46a"/>`).join('');
(function animateConvoys() {
  convoys.forEach((c, i) => {
    c.t += c.speed;
    if (c.t > 1) c.t = 0;
    const a = NODES[c.from], b = NODES[c.to];
    const el = svg.querySelector(`#cv${i}`);
    el.setAttribute('cx', a.x + (b.x - a.x) * c.t);
    el.setAttribute('cy', a.y + (b.y - a.y) * c.t);
  });
  requestAnimationFrame(animateConvoys);
})();

$('#allocTable').innerHTML = `
  <tr><th>Convoy</th><th>Source</th><th>Dump</th><th>Next 4 h</th><th>Status</th></tr>
  ${[
    ['CV-01', 'Pit 1 · Block A2', 'Crusher CR-01', '1,840 t', 'ok|On plan'],
    ['CV-02', 'Pit 1 · Block A2', 'Crusher CR-01', '1,760 t', 'ok|On plan'],
    ['CV-03', 'Pit 2 · Block B1', 'Crusher CR-01', '1,510 t', 'warn|Road watering 20 min'],
    ['CV-04', 'Pit 2 · Block B1', 'ROM pad (buffer)', '1,420 t', 'ok|Re-routed by FSP'],
    ['FEL-1', 'Stockyard SP-2', 'Jetty hopper', '2,950 t', 'ok|Feeding BG-3102'],
  ].map(([id, src, dst, t, st]) => {
    const [cls, txt] = st.split('|');
    return `<tr><td class="mono">${id}</td><td>${src}</td><td>${dst}</td><td class="mono">${t}</td><td><span class="status-dot ${cls}"></span> ${txt}</td></tr>`;
  }).join('')}`;

// ── UC3: Execution ───────────────────────────────────────────────────────────
new Chart($('#varChart'), {
  type: 'bar',
  data: {
    labels: ['JET-1', 'JET-2', 'BG-3101', 'BG-3102', 'BG-3103', 'BG-3104', 'FC-1'],
    datasets: [{ label: 'Variance to plan (h)', data: [0.4, -0.8, 0.2, 1.1, -0.5, 0.3, 0.9], backgroundColor: (c) => (c.raw >= 0 ? '#6fcf8e' : '#e57368'), borderRadius: 4 }],
  },
  options: { plugins: { legend: { display: false } } },
});

const log = $('#replanLog');
function addLog(msg) {
  const li = document.createElement('div');
  li.className = 'li';
  li.innerHTML = `<span class="ts">${witaTime().slice(0, 5)}</span><span>${esc(msg)}</span>`;
  log.prepend(li);
}
[
  'Plan v12 published — barge cycle re-staggered 0.5 h for tide window',
  'Short-interval control: BG-3102 load rate +6% vs plan, schedule holds',
  'Confirmed production: 19,400 t transshipped last 12 h (plan 19,100 t)',
].forEach(addLog);
