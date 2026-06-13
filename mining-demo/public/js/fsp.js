// Future Scheduling Platform — 48-h logistics schedule with disruption re-planning.
// Chain: jetty berths → barges → floating crane (transshipment) → OGVs.
//
// The deterministic engine (buildBasePlan + repairOverlaps) is the source of
// truth for the on-screen schedule, so the demo always re-solves visibly. The
// AI layers on top of it: it parses free-text disruptions into constraints,
// frames the trade-off options and writes the re-plan rationale — it never has
// to be online for the schedule itself to move.
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

// Economics of the chain — the value model is derived from these, not canned.
const ECON = {
  demurrageRatePerDay: 28000,   // MV laycan overrun penalty
  throughputMarginPerKt: 4200,  // margin recovered per kt of throughput protected
  chainRateKtPerH: 1.7,         // effective transshipment rate
};
const LAYCAN = { anoaEndH: 38, baseCompletionH: 30 }; // MV Anoa base completion / laycan close

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

// Tidal low-water gates: jetty draft is limited, so a load should not *start*
// inside a gate. Shown as bands; available as an injectable / predicted risk.
const TIDE_GATES = [
  { start: 4, dur: 2.5, label: 'LOW TIDE −1.1m' },
  { start: 28, dur: 2.5, label: 'LOW TIDE −0.9m' },
];

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

// Pull a spare barge cycle forward to keep the crane fed through a gap.
const advanceSpare = (acts, hours) => shiftBarge(acts, 'BG-3104', NOW, -Math.abs(hours), true);

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

// ── Preset disruptions (the three quick buttons) ──────────────────────────────
// Each returns the headline schedule facts; KPIs are then derived from the acts.
const DISRUPTIONS = {
  'jetty2-down': {
    severity: 1,
    title: 'Berth 2 loader breakdown — 4 h outage from 15:00',
    apply(acts) {
      acts.push({ id: 'd-jet2', res: 'JET-2', start: 15, dur: 4, type: 'maint', label: 'LOADER OUTAGE' });
      for (const a of acts.filter((x) => x.res === 'JET-2' && x.type === 'load' && x.start < 19 && x.start + x.dur > 15 && x.start >= NOW - 4)) {
        const tail = acts.filter((x) => x.barge === a.barge);
        for (const t of tail) if (t.start >= a.start - 1e-6) { if (t.res === 'JET-2') t.res = 'JET-1'; t.start += 2; t.moved = true; }
      }
      repairOverlaps(acts);
      return { impact: 'Two barge loads re-slotted from berth 2 to berth 1; net slip +2 h; MV Anoa completion +1 h (laycan buffer 7 h).' };
    },
  },
  'swell': {
    severity: 2,
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
      return { impact: 'Transshipment blocks stretched through the swell window; barges held at jetty instead of queueing at sea; MV Anoa completion +5 h, still 3 h inside laycan.' };
    },
  },
  'barge-engine': {
    severity: 1.5,
    title: 'BG-3103 engine fault at 15:00 — barge held at jetty ~6 h',
    apply(acts) {
      acts.push({ id: 'd-bg3', res: 'BG-3103', start: 15, dur: 6, type: 'maint', label: 'ENGINE REPAIR' });
      shiftBarge(acts, 'BG-3103', 15, 6, true);
      shiftBarge(acts, 'BG-3104', 15, -2.5, true);
      repairOverlaps(acts);
      const anoa = acts.find((x) => x.id === 'anoa-load');
      anoa.dur += 2; anoa.moved = true;
      return { impact: 'BG-3103 cycle suspended 6 h for repair at berth; BG-3104 advanced 2.5 h to keep FC-1 fed; MV Anoa completion +2 h.' };
    },
  },
};

// ── Generic constraint engine (free-form + risk mitigations) ──────────────────
// Applies any structured constraint {resourceId, kind, start, dur, magnitudePct,
// barge, label} to a plan, then repairs overlaps. Same shape the AI parser emits.
function applyGeneric(acts, c) {
  const start = c.start ?? 15;
  const dur = Math.max(0.5, c.dur ?? 4);
  const res = c.resourceId;

  if (c.kind === 'slowdown') {
    const mag = Math.max(0.1, Math.min(0.95, (c.magnitudePct ?? 40) / 100));
    const match = res === 'FC-1' ? ((x) => x.type === 'tranship') : ((x) => x.res === res && x.type !== 'laycan');
    for (const a of acts.filter((x) => match(x) && x.type !== 'laycan' && x.start + x.dur > start && x.start < start + dur)) {
      const stretch = a.dur * mag; a.dur += stretch; a.moved = true;
      if (a.barge) shiftBarge(acts, a.barge, a.start + a.dur - stretch, stretch, true);
    }
    const anoa = acts.find((x) => x.id === 'anoa-load');
    if (anoa) { anoa.dur += Math.round(mag * 8); anoa.moved = true; }
  } else if (c.kind === 'hold') {
    const bg = c.barge || res;
    acts.push({ id: `g-hold-${bg}`, res: bg, start, dur, type: 'maint', label: c.label || 'HOLD' });
    shiftBarge(acts, bg, start, dur, true);
    advanceSpare(acts, Math.min(dur * 0.4, 2.5)); // lean on the spare barge
  } else if (c.kind === 'eta') {
    const shift = c.dur ?? -6; // signed: negative = earlier
    for (const id of ['celebes-laycan', 'celebes-load']) {
      const a = acts.find((x) => x.id === id);
      if (a) { a.start = Math.max(0, a.start + shift); a.moved = true; }
    }
  } else { // outage
    acts.push({ id: `g-out-${res}`, res, start, dur, type: 'maint', label: c.label || 'OUTAGE' });
    if (res === 'JET-1' || res === 'JET-2') {
      const other = res === 'JET-1' ? 'JET-2' : 'JET-1';
      for (const a of acts.filter((x) => x.res === res && x.type === 'load' && x.start + x.dur > start && x.start < start + dur && x.start >= NOW - 4)) {
        const tail = acts.filter((x) => x.barge === a.barge);
        for (const t of tail) if (t.start >= a.start - 1e-6) { if (t.res === res) t.res = other; t.start += Math.min(dur, 2.5); t.moved = true; }
      }
    } else {
      const affected = new Set(acts.filter((x) => x.res === res && x.start + x.dur > start && x.start < start + dur).map((x) => x.barge).filter(Boolean));
      for (const bg of affected) shiftBarge(acts, bg, start, dur, true);
    }
  }
  repairOverlaps(acts);
  const anoa = acts.find((x) => x.id === 'anoa-load');
  const anoaSlip = anoa ? Math.max(0, (anoa.start + anoa.dur) - LAYCAN.baseCompletionH) : 0;
  return { impact: `${c.label || 'Constraint'} on ${res}: re-solved 48-h plan; MV Anoa completion ${anoaSlip > 0 ? `+${anoaSlip.toFixed(1)} h` : 'held'}.` };
}

// ── Analytics: bottleneck, KPIs, value, probability ───────────────────────────
function busyHours(acts, res, a, b) {
  let sum = 0;
  for (const x of acts) {
    if (x.res !== res || x.type === 'laycan' || x.type === 'maint') continue;
    const s = Math.max(x.start, a), e = Math.min(x.start + x.dur, b);
    if (e > s) sum += e - s;
  }
  return sum;
}

function analyzeBottleneck(acts) {
  const span = H - NOW;
  const util = {
    'FC-1': busyHours(acts, 'FC-1', NOW, H) / span,
    'JET-1': busyHours(acts, 'JET-1', NOW, H) / span,
    'JET-2': busyHours(acts, 'JET-2', NOW, H) / span,
  };
  const drum = Object.entries(util).sort((p, q) => q[1] - p[1])[0][0];
  return { util, drum, fcIdleH: span - busyHours(acts, 'FC-1', NOW, H) };
}

function computeKPIs(acts) {
  const anoa = acts.find((x) => x.id === 'anoa-load');
  const anoaCompletion = anoa ? anoa.start + anoa.dur : LAYCAN.baseCompletionH;
  const anoaSlip = Math.max(0, anoaCompletion - LAYCAN.baseCompletionH);
  const laycanSlackH = LAYCAN.anoaEndH - anoaCompletion;
  const demurrageUSD = Math.max(0, -laycanSlackH) * ECON.demurrageRatePerDay / 24;
  const moved = acts.filter((x) => x.moved).length;
  const adherence = Math.max(80, Math.min(96.5, 94.2 - moved * 0.45 - anoaSlip * 0.9));
  return { anoaCompletion, anoaSlip, laycanSlackH, demurrageUSD, moved, adherence };
}

// Value protected vs the legacy hand-of-shift process (bigger slip, no laycan
// ordering): avoided demurrage + throughput recovered.
function valueModel(kpis) {
  const legacySlip = kpis.anoaSlip + 4;
  const legacyBreach = Math.max(0, legacySlip - (LAYCAN.anoaEndH - LAYCAN.baseCompletionH));
  const legacyDemurrage = legacyBreach * ECON.demurrageRatePerDay / 24;
  const avoidedDemurrage = Math.max(0, legacyDemurrage - kpis.demurrageUSD);
  const throughputKt = Math.max(0, legacySlip - kpis.anoaSlip) * ECON.chainRateKtPerH;
  const throughputValue = throughputKt * ECON.throughputMarginPerKt;
  return {
    avoidedDemurrage: Math.round(avoidedDemurrage),
    throughputKt: +throughputKt.toFixed(1),
    throughputValue: Math.round(throughputValue),
    total: Math.round(avoidedDemurrage + throughputValue),
  };
}

// Standard normal CDF (Abramowitz & Stegun 26.2.17) for the laycan-hold odds.
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
function laycanProbability(kpis, severity) {
  const sd = 1.2 + severity * 1.4; // uncertainty grows with disruption severity
  return Math.max(0.02, Math.min(0.999, normalCdf(kpis.laycanSlackH / sd)));
}
function completionBand(kpis, severity) {
  const sd = 1.2 + severity * 1.4;
  return { p50: kpis.anoaCompletion, p90: kpis.anoaCompletion + 1.2816 * sd, sd };
}

// ── Trade-off options ─────────────────────────────────────────────────────────
// Re-solve under three objectives so the planner chooses the trade-off, not the
// tool. Each policy nudges the same deterministic engine, then KPIs are derived.
const POLICIES = [
  { id: 'balanced', label: 'Balanced', desc: 'Protect the laycan where buffers allow while keeping the crane fed.' },
  { id: 'protect-laycan', label: 'Protect laycan', desc: 'Prioritise MV Anoa completion; absorb more total slip and crane idle.' },
  { id: 'max-throughput', label: 'Max throughput', desc: 'Keep FC-1 fed hard; accept laycan risk / demurrage exposure.' },
];

function applyPolicy(acts, id) {
  const anoa = acts.find((x) => x.id === 'anoa-load');
  if (id === 'protect-laycan') {
    advanceSpare(acts, 1.0);
    if (anoa && anoa.dur > 28) anoa.dur -= Math.min(anoa.dur - 28, 2); // recover OGV time
  } else if (id === 'max-throughput') {
    advanceSpare(acts, 2.5);
    if (anoa) anoa.dur += 1; // crane-first defers the OGV slightly
  }
  repairOverlaps(acts);
}

function buildOptions(applyFn, severity) {
  return POLICIES.map((p) => {
    const acts = buildBasePlan();
    applyFn(acts);
    applyPolicy(acts, p.id);
    const kpis = computeKPIs(acts);
    return { ...p, acts, kpis, value: valueModel(kpis), prob: laycanProbability(kpis, severity), severity };
  });
}

function pickRecommended(options) {
  const balanced = options.find((o) => o.id === 'balanced');
  if (balanced && balanced.prob >= 0.85) return 'balanced';
  return options.slice().sort((a, b) => b.prob - a.prob || b.value.total - a.value.total)[0].id;
}

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
  // Tidal low-water gates (draft-limited jetty windows) behind the blocks.
  for (const g of TIDE_GATES) {
    gantt.insertAdjacentHTML('beforeend', `<div class="tide-band" style="left: calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${g.start / H}); width: calc((100% - ${LABEL_W}px) * ${g.dur / H}); grid-row: 2 / span ${RESOURCES.length}; grid-column: 1 / -1;"><span class="lbl">${g.label}</span></div>`);
  }
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

// ── UI state ──────────────────────────────────────────────────────────────────
let planVersion = 12;
let protectedUSD = 621000;
let currentBottleneck = null;
let currentOptions = null;
let currentChosenId = null;
let currentMeta = null; // { id, title, severity, scenario }

// ── Panels: bottleneck strip, value, confidence ───────────────────────────────
function renderBottleneck(acts, kpis, severity, prevDrum) {
  const bn = analyzeBottleneck(acts);
  currentBottleneck = bn;
  const prob = laycanProbability(kpis, severity);
  const probCls = prob >= 0.9 ? 'lo' : prob >= 0.75 ? 'med' : 'hi';
  const bars = Object.entries(bn.util).map(([res, u]) => `
    <span class="bn-bar ${res === bn.drum ? 'drum' : ''}">
      <span>${res}</span><span class="track"><span class="fill" style="width:${Math.min(100, Math.round(u * 100))}%"></span></span>
      <span>${Math.round(u * 100)}%</span>
    </span>`).join('');
  const shift = prevDrum && prevDrum !== bn.drum ? `<span class="bn-shift">↳ constraint shifted ${prevDrum} → ${bn.drum}</span>` : '';
  $('#bottleneckStrip').innerHTML = `
    <span class="bn-title">Constraint (drum)</span>
    <span class="bn-drum">${bn.drum}${bn.drum === 'FC-1' ? ' · transshipment' : ' · jetty'}</span>
    <span class="bn-bars">${bars}</span>
    ${shift}
    <span class="bn-conf ${probCls}">Laycan hold ${Math.round(prob * 100)}% · buffer ${kpis.laycanSlackH.toFixed(1)} h</span>`;
}

function renderExecProb(kpis, severity) {
  const band = completionBand(kpis, severity);
  const prob = laycanProbability(kpis, severity);
  $('#execProb').innerHTML =
    `MV Anoa completion — P50 ${band.p50.toFixed(1)} h · P90 ${band.p90.toFixed(1)} h · laycan close ${LAYCAN.anoaEndH} h · P(hold laycan) ${Math.round(prob * 100)}%`;
}

// Plan state passed to the copilot so its answers are grounded in live numbers.
function planState() {
  const k = currentOptions ? currentOptions.find((o) => o.id === currentChosenId).kpis : computeKPIs(buildBasePlan());
  return {
    drum: currentBottleneck?.drum || 'FC-1',
    adherence: +k.adherence.toFixed(1),
    laycanSlackH: +k.laycanSlackH.toFixed(1),
    anoaCompletionH: +k.anoaCompletion.toFixed(1),
    planVersion,
    activeStrategy: currentChosenId || 'base',
  };
}

// ── Options (trade-off cards) ─────────────────────────────────────────────────
function renderOptions(options, recommendedId) {
  const box = $('#optionCards');
  box.style.display = '';
  box.innerHTML = options.map((o) => {
    const slipCls = o.kpis.anoaSlip > 0 ? 'neg' : 'pos';
    return `
    <div class="option-card ${o.id === currentChosenId ? 'chosen' : ''} ${o.id === recommendedId ? 'recommended' : ''}" data-opt="${o.id}">
      <div class="oc-head"><span class="oc-name">${o.label}</span><span class="oc-tag">${o.id === recommendedId ? '✓ recommended' : 'strategy'}</span></div>
      <div class="oc-desc">${o.desc}</div>
      <div class="oc-kpis">
        <span>adh <b>${o.kpis.adherence.toFixed(1)}%</b></span>
        <span>Anoa <b class="${slipCls}">${o.kpis.anoaSlip > 0 ? '+' + o.kpis.anoaSlip.toFixed(1) + 'h' : 'on time'}</b></span>
        <span>hold <b>${Math.round(o.prob * 100)}%</b></span>
        <span>value <b class="pos">$${(o.value.total / 1000).toFixed(0)}k</b></span>
      </div>
    </div>`;
  }).join('');
  $$('.option-card', box).forEach((card) => card.addEventListener('click', () => selectOption(card.dataset.opt, false)));
}

function selectOption(optId, recommended) {
  const opt = currentOptions.find((o) => o.id === optId);
  if (!opt) return;
  const prevDrum = currentBottleneck?.drum;
  currentChosenId = optId;
  renderPlan(opt.acts);
  $('#kAdh').textContent = opt.kpis.adherence.toFixed(1);
  renderBottleneck(opt.acts, opt.kpis, opt.severity, recommended ? prevDrum : null);
  renderExecProb(opt.kpis, opt.severity);
  renderOptions(currentOptions, currentOptions.find((o) => o.recommended)?.id || pickRecommended(currentOptions));
  if (recommended) {
    protectedUSD += opt.value.total;
    $('#kProtected').textContent = '$' + protectedUSD.toLocaleString('en-US');
  }
}

// ── The re-plan publish flow (shared by presets, free-form, risk radar) ───────
async function publishReplan({ id, title, applyFn, severity, scenario, parsedNote }) {
  $$('.disrupt-btn').forEach((b) => (b.disabled = true));
  const ffBtn = $('#ffBtn'); if (ffBtn) ffBtn.disabled = true;
  const status = $('#fspStatus');
  status.textContent = 'RE-SOLVING SCHEDULE…';
  status.classList.add('replanning');

  const options = buildOptions(applyFn, severity);
  const recommendedId = pickRecommended(options);
  options.forEach((o) => (o.recommended = o.id === recommendedId));
  currentOptions = options;
  currentChosenId = null;
  currentMeta = { id, title, severity, scenario };

  // Beat, then publish the recommended option so the re-shuffle reads as a solve.
  setTimeout(() => {
    selectOption(recommendedId, true);
    planVersion += 1;
    status.textContent = `PLAN v${planVersion} · PUBLISHED`;
    status.classList.remove('replanning');
    const chosen = options.find((o) => o.id === recommendedId);
    addLog(`${title} → re-plan v${planVersion} published (${chosen.label.toLowerCase()}; Anoa ${chosen.kpis.anoaSlip > 0 ? '+' + chosen.kpis.anoaSlip.toFixed(1) + 'h' : 'on time'}, ${Math.round(chosen.prob * 100)}% laycan hold)`);
    recordEvent({ id, title, severity, drum: currentBottleneck?.drum });
  }, 900);

  // AI rationale in parallel, grounded in the computed options.
  const panel = $('#aiPanel');
  panel.classList.add('loading-shimmer');
  panel.innerHTML = `<div class="ai-panel-head"><span class="spark">✦</span><span class="t">OreSight AI — Re-plan rationale</span></div><div style="color:var(--muted); font-size:13.5px;">Re-solving 48-h schedule: ${esc(title)}…</div>`;
  try {
    const rec = options.find((o) => o.id === recommendedId);
    const r = await postJSON('/api/usecase/analyze', {
      caseId: 'fsp',
      scenario: {
        ...scenario,
        recommendedStrategy: rec.label,
        strategyOptions: options.map((o) => ({ strategy: o.label, anoaSlipH: +o.kpis.anoaSlip.toFixed(1), laycanHoldPct: Math.round(o.prob * 100), valueUSD: o.value.total })),
        bottleneck: currentBottleneck?.drum,
        nowHour: NOW,
        ...(parsedNote ? { parsedNote } : {}),
      },
    });
    renderAIResult(panel, r);
  } catch (e) {
    panel.innerHTML = `<div style="color:var(--red); font-size:13.5px;">${esc(e.message)}</div>`;
  } finally {
    panel.classList.remove('loading-shimmer');
    $$('.disrupt-btn').forEach((b) => (b.disabled = false));
    if (ffBtn) ffBtn.disabled = false;
  }
}

// ── Preset disruption buttons ─────────────────────────────────────────────────
$$('.disrupt-btn').forEach((btn) => btn.addEventListener('click', async () => {
  const key = btn.dataset.d;
  $$('.disrupt-btn').forEach((b) => b.classList.remove('active'));

  if (key === 'reset') {
    resetPlan();
    return;
  }
  const d = DISRUPTIONS[key];
  if (!d) return;
  btn.classList.add('active');
  publishReplan({
    id: key,
    title: d.title,
    severity: d.severity,
    applyFn: (acts) => d.apply(acts),
    scenario: { disruptionId: key, description: d.title, scheduleImpact: d.apply(buildBasePlan()).impact },
  });
}));

function resetPlan() {
  renderPlan(buildBasePlan());
  $('#fspStatus').textContent = `PLAN v${planVersion} · PUBLISHED`;
  $('#fspStatus').classList.remove('replanning');
  $('#kAdh').textContent = '94.2';
  $('#optionCards').style.display = 'none';
  currentOptions = null; currentChosenId = null; currentMeta = null;
  const base = buildBasePlan();
  const k = computeKPIs(base);
  renderBottleneck(base, k, 0, null);
  renderExecProb(k, 0);
}

// ── Free-form (natural-language) disruption ──────────────────────────────────
async function runFreeform() {
  const input = $('#ffInput');
  const text = input.value.trim();
  if (!text) return;
  $$('.disrupt-btn').forEach((b) => b.classList.remove('active'));
  const btn = $('#ffBtn');
  setLoading(btn, true, 'Parsing…');
  try {
    const c = await postJSON('/api/fsp/parse', { text });
    const severity = c.kind === 'slowdown' ? Math.max(1, (c.magnitudePct || 40) / 25)
      : c.kind === 'outage' ? 1.4 : c.kind === 'hold' ? 1.5 : 1;
    setLoading(btn, false);
    publishReplan({
      id: `ff:${c.kind}`,
      title: c.title || `Disruption: ${text}`,
      severity,
      applyFn: (acts) => applyGeneric(acts, c),
      scenario: { disruptionId: c.kind, description: c.title || text, scheduleImpact: applyGeneric(buildBasePlan(), c).impact, freeText: text, constraint: c },
      parsedNote: `${c.parsed === 'heuristic' ? 'Parsed (rules)' : 'Parsed (AI)'}: ${c.kind} on ${c.resourceId}${c.kind === 'slowdown' ? ` −${c.magnitudePct}%` : ''}, ${c.dur} h from ${c.start}h`,
    });
    input.value = '';
  } catch (e) {
    setLoading(btn, false);
    $('#aiPanel').innerHTML = `<div style="color:var(--red); font-size:13.5px;">Could not parse disruption: ${esc(e.message)}</div>`;
  }
}
$('#ffBtn').addEventListener('click', runFreeform);
$('#ffInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') runFreeform(); });

// ── Predictive risk radar ─────────────────────────────────────────────────────
const RISKS = [
  {
    prob: 58, cls: 'med', t: 'Heavy swell building at anchorage (next 12 h)',
    s: 'Met forecast: 2.4 m swell window ~03:00–11:00 — transshipment exposure at FC-1.',
    act: 'Pre-position: hold barges at jetty',
    mitigation: { id: 'risk:swell', title: 'Pre-position for forecast swell — hold barges at jetty', severity: 2, constraint: { resourceId: 'FC-1', kind: 'slowdown', start: NOW + 1, dur: 8, magnitudePct: 35, label: 'SWELL (FCST)' } },
  },
  {
    prob: 100, cls: 'med', t: `Low-tide draft gate at ${String((Math.floor(NOW) + 14) % 24).padStart(2, '0')}:00`,
    s: 'Tide −1.1 m: berths draft-limited for ~2.5 h — loads starting in the gate will slip.',
    act: 'Re-sequence loads around the gate',
    mitigation: { id: 'risk:tide', title: 'Re-sequence around the low-tide draft gate', severity: 1, constraint: { resourceId: 'JET-1', kind: 'outage', start: TIDE_GATES[1].start, dur: TIDE_GATES[1].dur, label: 'TIDE GATE' } },
  },
  {
    prob: 22, cls: 'lo', t: 'BG-3103 aux engine — early degradation signature',
    s: 'Maintenance model flags rising vibration; ~22% chance of a hold this shift.',
    act: 'Stage spare + advance BG-3104',
    mitigation: { id: 'risk:bg3103', title: 'Proactive cover for BG-3103 degradation', severity: 1.5, constraint: { resourceId: 'BG-3103', kind: 'hold', barge: 'BG-3103', start: NOW + 2, dur: 4, label: 'PROACTIVE' } },
  },
];

function renderRiskRadar() {
  $('#riskRadar').innerHTML = `
    <h3>Risk radar <span class="hint">forecast disruptions · pre-position before the hit</span></h3>
    ${RISKS.map((r, i) => `
      <div class="risk-item">
        <span class="rk-prob ${r.cls}">${r.prob}%</span>
        <div class="rk-body">
          <div class="t">${r.t}</div>
          <div class="s">${r.s}</div>
          <button class="rk-act" data-risk="${i}">${r.act} →</button>
        </div>
      </div>`).join('')}`;
  $$('.rk-act', $('#riskRadar')).forEach((b) => b.addEventListener('click', () => {
    const r = RISKS[+b.dataset.risk];
    publishReplan({
      id: r.mitigation.id,
      title: r.mitigation.title,
      severity: r.mitigation.severity,
      applyFn: (acts) => applyGeneric(acts, r.mitigation.constraint),
      scenario: { disruptionId: r.mitigation.id, description: r.mitigation.title, scheduleImpact: applyGeneric(buildBasePlan(), r.mitigation.constraint).impact, proactive: true },
    });
  }));
}

// ── Copilot (grounded Q&A) ────────────────────────────────────────────────────
const COPILOT_SUGGESTIONS = ['Why is FC-1 the bottleneck?', 'How much laycan buffer is left?', 'What if MV Celebes arrives 6 h early?'];

function renderCopilot() {
  $('#copilotPanel').innerHTML = `
    <h3>Scheduling copilot <span class="hint">ask about the live plan</span></h3>
    <div class="copilot-log" id="copilotLog">
      <div class="cp-msg a">Ask me about the bottleneck, laycan exposure, adherence, or pose a "what-if". I answer from the current published plan.</div>
    </div>
    <div style="margin-bottom:8px;">${COPILOT_SUGGESTIONS.map((s) => `<span class="cp-chip" data-q="${esc(s)}">${esc(s)}</span>`).join('')}</div>
    <div class="copilot-row"><input id="cpInput" placeholder="Ask the scheduler…" /><button id="cpBtn">Ask</button></div>`;
  $('#cpBtn').addEventListener('click', () => askCopilot($('#cpInput').value));
  $('#cpInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') askCopilot($('#cpInput').value); });
  $$('.cp-chip', $('#copilotPanel')).forEach((c) => c.addEventListener('click', () => askCopilot(c.dataset.q)));
}

async function askCopilot(question) {
  question = (question || '').trim();
  if (!question) return;
  const logEl = $('#copilotLog');
  $('#cpInput').value = '';
  logEl.insertAdjacentHTML('beforeend', `<div class="cp-msg q">${esc(question)}</div><div class="cp-msg a" id="cpPending">…</div>`);
  logEl.scrollTop = logEl.scrollHeight;
  try {
    const r = await postJSON('/api/fsp/copilot', { question, state: planState() });
    $('#cpPending').textContent = r.answer || 'No answer.';
    $('#cpPending').id = '';
  } catch (e) {
    $('#cpPending').textContent = `Error: ${e.message}`;
    $('#cpPending').id = '';
  }
  logEl.scrollTop = logEl.scrollHeight;
}

// ── Learning loop ─────────────────────────────────────────────────────────────
const eventHistory = [
  { id: 'swell', label: 'Anchorage swell −40%', when: '03 Jun', held: true },
  { id: 'jetty2-down', label: 'Berth 2 loader outage', when: '28 May', held: true },
];
function recordEvent({ id, title, severity, drum }) {
  const precedent = eventHistory.find((e) => id.includes(e.id) || (e.id && id.replace('ff:', '').includes(e.id)));
  eventHistory.unshift({ id, label: title.split('—')[0].trim().slice(0, 42), when: 'today', held: true });
  const el = $('#precedent');
  if (el) {
    el.innerHTML = precedent
      ? `↳ <b>Precedent:</b> similar to “${precedent.label}” (${precedent.when}) — that re-plan held. Institutional memory: ${eventHistory.length} logged events on this chain.`
      : `↳ <b>No close precedent</b> on file — logged as a new case (${eventHistory.length} events on this chain). The platform will reference it next time a similar disruption hits.`;
  }
}

// ── Initial paint ─────────────────────────────────────────────────────────────
renderPlan(buildBasePlan());
(function initPanels() {
  const base = buildBasePlan();
  const k = computeKPIs(base);
  renderBottleneck(base, k, 0, null);
  renderExecProb(k, 0);
  renderRiskRadar();
  renderCopilot();
})();

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
