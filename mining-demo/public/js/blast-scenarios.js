// Canonical Blast Optimisation engine — the single source of truth for the
// deterministic drill-and-blast demo. Both the browser console (public/js/blast.js)
// and the server-side API fallback (data/blast.js) import from here, so the
// fragmentation curve, P80, pattern, PPV / flyrock gates, value and the AI copy
// can never drift between client and server. DOM-free and framework-free by design.
//
// Ported verbatim from the design-handoff prototype: a light toy model tuned for
// plausibility and visible reactivity, NOT a blasting thesis. The safety gate is
// absolute — no recommended (preset) design may ever return a BREACH.

const L10 = Math.log10;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export function usd(n) {
  const a = Math.abs(n);
  return (n < 0 ? '-' : '') + '$' + (a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : Math.round(a / 1e3) + 'k');
}

// ── plot geometry (size axis 4..1200 mm, log; passing 0..100%) ──────────────────
const PX_L = 54, PX_R = 582, PX_T = 16, PX_B = 250;
const LXMIN = L10(4), LXSPAN = L10(1200) - L10(4);
export const lx = (x) => PX_L + (L10(x) - LXMIN) / LXSPAN * (PX_R - PX_L);
export const yP = (p) => PX_B - (p / 100) * (PX_B - PX_T);

// Rosin–Rammler cumulative % passing at size x given P80 & uniformity n
export function passing(x, p80, n) {
  const x50 = p80 / Math.pow(2.3219, 1 / n);
  return 100 * (1 - Math.exp(-0.6931 * Math.pow(x / x50, n)));
}

const PPV_K = 2193, FLY_K = 358;

// Fragmentation / safety semantic colours (presentation that travels with data).
export const statusColor = (s) => (s === 'BREACH' ? '#e5484d' : s === 'WATCH' ? '#e0a23a' : '#5fbf86');
const p80BandColor = (p80) => (p80 > 650 ? '#e5484d' : p80 > 350 ? '#e0a23a' : p80 < 120 ? '#d98a3a' : '#5fbf86');
const TAG = { charge: '#15803d', spacing: '#0e7490', burden: '#0e7490', timing: '#7c5cff', 'hole-diameter': '#a78b2e', stemming: '#b45309', 'sub-drill': '#0f766e' };
export const tagColor = (p) => TAG[p] || '#6b7264';

// ── deterministic core: design + ctx → raw metrics ──────────────────────────────
// design = {B, S, stem, PF, timing, hardness}; ctx = {target, ppvLimit, exclusion, struct}
export function core(d, ctx) {
  const patMult = Math.pow((d.B * d.S) / 30, 0.6);
  const hardMult = 0.86 + 0.32 * (d.hardness / 100);
  let p80 = (520 - 290 * d.PF) * patMult * hardMult;
  p80 = clamp(p80, 55, 720);
  let n = 1.05 + (d.timing - 9) * 0.014 + (30 - d.B * d.S) * 0.006 + 0.6 * (d.PF - 0.85);
  n = clamp(n, 0.85, 1.75);
  const fines = passing(30, p80, n);
  const onspec = passing(350, p80, n) - fines;
  const oversize = passing(650, p80, n) - passing(350, p80, n);
  const boulder = 100 - passing(650, p80, n);
  const coarse = oversize + boulder;
  const digRate = clamp(1360 - 9.2 * coarse - 1.1 * Math.max(0, fines - 12), 900, 1340);
  const charge = d.PF * d.B * d.S * 15;        // kg per hole
  const tf = 1 + (d.timing - 8) * 0.03;        // electronic-det timing spread
  const eff = charge / tf;                      // effective charge-per-delay
  const ppv = PPV_K / Math.pow(ctx.struct / Math.sqrt(eff), 1.6);
  const fly = FLY_K * Math.pow(d.PF, 1.3) / Math.pow(d.stem / 4, 0.9);
  return { p80, n, fines, onspec, oversize, boulder, coarse, digRate, charge, ppv, fly };
}

// ── scenario presets ────────────────────────────────────────────────────────────
// Each = an as-drilled `base` design (for the "As-drilled P80" box and coarseRef),
// the AI-recommended `design` (what is drawn), ctx, and the AI copy.
export const PRESETS = {
  'optimise': {
    label: '◆ Optimise', target: 250, ppvLimit: 25, exclusion: 500, struct: 420,
    base: { B: 5.2, S: 6.3, stem: 3.8, PF: 0.82, timing: 8, hardness: 60 },
    design: { B: 4.8, S: 5.8, stem: 4.2, PF: 0.95, timing: 11, hardness: 60 },
    headline: 'As-drilled muck runs coarse at ~315 mm. Tightening burden×spacing and lifting powder factor to 0.95 lands P80 on the 250 mm mill-feed target.',
    narrative: 'The as-drilled 5.2×6.3 m pattern at 0.82 kg/m³ leaves 15% of the muckpile oversize, starving the shovel and choking the gyratory. Tightening to 4.8×5.8 m, lifting powder factor to 0.95 and staggering the electronic dets to 11 ms centres the distribution on the 250 mm target — oversize falls to ~8% and dig rate lifts. PPV (16 mm/s) and flyrock (320 m) both sit well inside their limits.',
    actions: [
      { param: 'spacing', change: '6.3 → 5.8 m', reason: 'Tighten the pattern to break the coarse tail', effect: 'P80 −90 mm' },
      { param: 'charge', change: 'PF 0.82 → 0.95 kg/m³', reason: 'More energy per m³ to hit mill-feed size', effect: 'oversize −7%' },
      { param: 'timing', change: '8 → 11 ms', reason: 'Stagger dets to improve breakage & cut PPV', effect: 'PPV −3 mm/s' },
      { param: 'stemming', change: '3.8 → 4.2 m', reason: 'Hold gases, keep flyrock inside the zone', effect: 'flyrock −40 m' },
    ],
    recs: [
      { action: 'Adopt 4.8×5.8 m pattern bench-wide', impact: 'P80 ~250 mm, +110 t/h to the mill', timeframe: 'next bench' },
      { action: 'Lock electronic-det timing at 11 ms inter-hole', impact: 'better breakage, PPV 16 vs 25 limit', timeframe: 'this design' },
      { action: 'Reconcile against WipFrag after firing', impact: 'feeds the next powder-factor call', timeframe: 'post-blast' },
    ],
  },
  'harder-seam': {
    label: '⛰ Harder seam', target: 250, ppvLimit: 25, exclusion: 500, struct: 420,
    base: { B: 4.8, S: 5.8, stem: 4.2, PF: 0.85, timing: 9, hardness: 85 },
    design: { B: 4.6, S: 5.6, stem: 4.2, PF: 1.03, timing: 12, hardness: 85 },
    headline: 'MWD logs a hard band on the north of the bench. Charge-up to 1.03 kg/m³ in the hard zone holds P80 on target without breaching vibration.',
    narrative: 'The MWD specific-energy log flags a hard band (hardness 85) that, left at 0.85 kg/m³, would blow P80 out past 330 mm. Varying charge to the geology — heavier in the purple hard zone, nominal elsewhere — and tightening to 4.6×5.6 m holds the distribution on target. Cost is the binding constraint here, not safety: PPV stays at 15 mm/s and flyrock at 350 m.',
    actions: [
      { param: 'charge', change: 'PF 0.85 → 1.03 kg/m³', reason: 'Match charge to the MWD hard band', effect: 'P80 held 255 mm' },
      { param: 'burden', change: '4.8 → 4.6 m', reason: 'Tighten where the rock is stiffest', effect: 'oversize −5%' },
      { param: 'timing', change: '9 → 12 ms', reason: 'Longer delays free face for hard rock', effect: 'breakage +' },
      { param: 'hole-diameter', change: 'hold 229 mm', reason: 'Deck-load rather than re-drill', effect: 'no rig delay' },
    ],
    recs: [
      { action: 'Variable charge: +22% in the hard zone only', impact: 'holds P80 250 mm, +$0.04/t explosive', timeframe: 'this bench' },
      { action: 'Keep blanket PF off — charge to MWD', impact: 'avoids over-blasting the soft south', timeframe: 'design rule' },
      { action: 'Watch fines in the soft margin', impact: 'protects recoverable ore', timeframe: 'reconcile' },
    ],
  },
  'structure-near': {
    label: '🏠 Structure near', target: 250, ppvLimit: 20, exclusion: 420, struct: 330,
    base: { B: 4.8, S: 5.8, stem: 4.2, PF: 0.95, timing: 11, hardness: 60 },
    design: { B: 5.3, S: 6.4, stem: 4.4, PF: 0.70, timing: 16, hardness: 60 },
    headline: 'House logged at 330 m drops the PPV cap to 20 mm/s. Back off powder factor to 0.70 and spread timing to 16 ms — vibration governs, and it holds.',
    narrative: 'With a structure at 330 m the legal PPV cap tightens to 20 mm/s, making vibration the binding constraint. The AI backs powder factor off to 0.70, opens the pattern to 5.3×6.4 m and spreads electronic-det timing to 16 ms to cut peak particle velocity to 19 mm/s — just inside the cap. P80 runs a touch coarse at ~285 mm; that is the deliberate trade to stay compliant and protect the asset.',
    actions: [
      { param: 'charge', change: 'PF 0.90 → 0.70 kg/m³', reason: 'Cut charge-per-delay near the structure', effect: 'PPV −8 mm/s' },
      { param: 'timing', change: '9 → 16 ms', reason: 'Spread delays to lower peak velocity', effect: 'PPV −4 mm/s' },
      { param: 'spacing', change: '6.0 → 6.4 m', reason: 'Open pattern, fewer holes firing close', effect: 'within cap' },
      { param: 'stemming', change: '4.0 → 4.4 m', reason: 'Confine gases, shorten flyrock throw', effect: 'flyrock 206 m' },
    ],
    recs: [
      { action: 'Hold PPV ≤ 20 mm/s at the house', impact: 'compliant; protects social licence', timeframe: 'absolute' },
      { action: 'Accept coarser P80 ~285 mm this bench', impact: '−$ throughput, avoids breach', timeframe: 'while structure near' },
      { action: 'Re-tighten once the cut advances past 450 m', impact: 'recovers fragmentation later', timeframe: '2 benches' },
    ],
  },
  'wet-holes': {
    label: '💧 Wet holes', target: 250, ppvLimit: 25, exclusion: 500, struct: 420,
    base: { B: 5.0, S: 6.1, stem: 3.6, PF: 0.85, timing: 9, hardness: 58 },
    design: { B: 5.0, S: 6.1, stem: 4.9, PF: 0.80, timing: 10, hardness: 58 },
    headline: 'Water in the holes — switch to a re-decked emulsion and lift stemming to 4.9 m. Trim powder factor slightly; flyrock and cost govern.',
    narrative: 'Groundwater in the pattern rules out ANFO and forces a water-resistant emulsion with a re-decked charge. Lifting stemming to 4.9 m confines the gases — flyrock drops to ~230 m — and powder factor eases to 0.80 to avoid pushing the wet column. P80 sits at ~290 mm; the trade buys reliable initiation and a tighter flyrock margin.',
    actions: [
      { param: 'charge', change: 're-deck emulsion', reason: 'Water-resistant column, split charge', effect: 'reliable init' },
      { param: 'stemming', change: '3.6 → 4.9 m', reason: 'Confine gases in wet ground', effect: 'flyrock −60 m' },
      { param: 'charge', change: 'PF 0.85 → 0.80 kg/m³', reason: 'Avoid over-pressuring the wet column', effect: 'P80 ~290 mm' },
      { param: 'timing', change: '9 → 10 ms', reason: 'Keep breakage with the lighter charge', effect: 'holds frag' },
    ],
    recs: [
      { action: 'Emulsion + decked charge on wet holes only', impact: 'reliable initiation, no misfires', timeframe: 'this bench' },
      { action: 'Dewater the toe where practical', impact: 'recovers ~0.05 kg/m³ of useful energy', timeframe: 'pre-charge' },
      { action: 'Hold flyrock margin > 250 m', impact: 'safe under the wet-season plan', timeframe: 'absolute' },
    ],
  },
  'finer-feed': {
    label: '⚙ Finer feed', target: 190, ppvLimit: 25, exclusion: 500, struct: 420,
    base: { B: 5.0, S: 6.0, stem: 4.0, PF: 0.88, timing: 9, hardness: 60 },
    design: { B: 4.5, S: 5.5, stem: 4.3, PF: 1.12, timing: 12, hardness: 60 },
    headline: 'Plant calls for finer SAG feed — drop the target to 190 mm. Push powder factor to 1.12 and tighten to 4.5×5.5 m, watching the fines tail.',
    narrative: 'A mill-throughput push lowers the target P80 to 190 mm. The AI lifts powder factor to 1.12 and tightens the pattern to 4.5×5.5 m, dropping P80 to ~205 mm and cutting oversize to ~3% — a clear mine-to-mill gain. Fines is now the watch item: over-blasting past this wastes energy and risks ore loss, so the design stops at the band rather than chasing the finest. Safety stays clear at PPV 16 and flyrock 389 m.',
    actions: [
      { param: 'charge', change: 'PF 0.88 → 1.12 kg/m³', reason: 'More energy to drive finer feed', effect: 'P80 −85 mm' },
      { param: 'spacing', change: '6.0 → 5.5 m', reason: 'Denser pattern for uniform breakage', effect: 'oversize ~3%' },
      { param: 'timing', change: '9 → 12 ms', reason: 'Tune delays for a uniform muckpile', effect: 'fines held' },
      { param: 'stemming', change: '4.0 → 4.3 m', reason: 'Keep flyrock inside the zone at high PF', effect: 'flyrock 389 m' },
    ],
    recs: [
      { action: 'Run PF 1.12 to the 190 mm target', impact: '+180 t/h SAG throughput', timeframe: 'while plant pulls' },
      { action: 'Stop at the band — do not over-blast', impact: 'guards fines / ore loss & energy cost', timeframe: 'design rule' },
      { action: 'Confirm SAG draws the finer feed', impact: 'locks the mine-to-mill value', timeframe: 'next shift' },
    ],
  },
};

export const DEFAULT_SCENARIO = 'optimise';

// ── gauge geometry (semicircle 180°→0°, r=72 needle / r=78 arc, center 100,108) ──
function needle(frac) {
  const a = (180 - 180 * clamp(frac, 0, 1)) * Math.PI / 180;
  return { x: +(100 + 72 * Math.cos(a)).toFixed(1), y: +(108 - 72 * Math.sin(a)).toFixed(1) };
}
function limitArc(frac) {
  const a = (180 - 180 * clamp(frac, 0, 1)) * Math.PI / 180;
  const x = 100 + 78 * Math.cos(a), y = 108 - 78 * Math.sin(a);
  return `M ${x.toFixed(1)} ${y.toFixed(1)} A 78 78 0 0 1 178 108`;
}

// ── deriveView: design + ctx (+ scenario context) → full display snapshot ────────
// `opts.coarseRef` anchors the mine-to-mill uplift; `opts.scenario` floors the
// structure-near value; `opts.edited` flips the solve/AI status labels.
export function deriveView(d, ctx, opts = {}) {
  const { coarseRef = ctx.coarseRef ?? 21.0, scenario = DEFAULT_SCENARIO, edited = false } = opts;
  const m = core(d, ctx);

  const ppvStatus = m.ppv >= ctx.ppvLimit ? 'BREACH' : (m.ppv >= 0.8 * ctx.ppvLimit ? 'WATCH' : 'OK');
  const flyStatus = m.fly >= ctx.exclusion ? 'BREACH' : (m.fly >= 0.82 * ctx.exclusion ? 'WATCH' : 'OK');
  const ppvColor = statusColor(ppvStatus), flyColor = statusColor(flyStatus);
  const rejected = ppvStatus === 'BREACH' || flyStatus === 'BREACH';
  const rejectReason = ppvStatus === 'BREACH'
    ? ('PPV ' + m.ppv.toFixed(0) + ' > ' + ctx.ppvLimit + ' mm/s limit')
    : ('Flyrock ' + m.fly.toFixed(0) + ' > ' + ctx.exclusion + ' m exclusion');

  const p80 = m.p80, p80Color = p80BandColor(p80);

  // fragmentation curve (64 geometric samples 4 → ~1200 mm)
  const pts = [];
  for (let i = 0; i <= 64; i++) { const x = 4 * Math.pow(300, i / 64); pts.push(lx(x).toFixed(1) + ',' + yP(passing(x, p80, m.n)).toFixed(1)); }

  // KPIs
  const pf = d.PF;
  const kpis = [
    { label: 'Powder factor', dot: '#15803d', value: pf.toFixed(2), unit: 'kg/m³', valColor: '#161b13', delta: (pf >= 0.7 && pf <= 1.0 ? 'in hard-rock band 0.7–1.0' : (pf > 1.0 ? 'above band — watch fines' : 'below band — coarse risk')), deltaColor: (pf >= 0.7 && pf <= 1.0 ? '#16915a' : '#b45309') },
    { label: 'Predicted P80', dot: p80Color, value: String(Math.round(p80)), unit: 'mm', valColor: '#161b13', delta: (Math.abs(p80 - ctx.target) <= 35 ? 'on the ' + ctx.target + ' mm target' : (p80 > ctx.target ? '+' + Math.round(p80 - ctx.target) + ' mm coarse vs target' : Math.round(p80 - ctx.target) + ' mm fine vs target')), deltaColor: (Math.abs(p80 - ctx.target) <= 35 ? '#16915a' : (p80 > ctx.target ? '#d97706' : '#b45309')) },
    { label: 'Dig rate', dot: '#0e7490', value: fmt(m.digRate), unit: 'bcm/h', valColor: '#161b13', delta: 'shovel productivity proxy', deltaColor: '#8b9182' },
    { label: 'PPV vs limit', dot: ppvColor, value: m.ppv.toFixed(1), unit: 'mm/s', valColor: (rejected && ppvStatus === 'BREACH') ? '#b91c1c' : '#161b13', delta: 'limit ' + ctx.ppvLimit + ' mm/s · ' + ppvStatus, deltaColor: ppvColor },
  ];

  const fragChips = [
    { label: '% fines', value: m.fines.toFixed(1) + '%', color: m.fines > 16 ? '#e0a23a' : '#cdd6c6' },
    { label: '% on-spec', value: m.onspec.toFixed(0) + '%', color: '#5fbf86' },
    { label: '% oversize', value: m.oversize.toFixed(1) + '%', color: m.oversize > 10 ? '#e0a23a' : '#cdd6c6' },
    { label: '% boulder', value: m.boulder.toFixed(1) + '%', color: m.boulder > 3 ? '#e5484d' : '#cdd6c6' },
  ];

  // binding constraint (priority: vibration → flyrock → fragmentation → cost)
  let bindName = 'fragmentation', bindColor = '#15803d', bindNote = '';
  if (ppvStatus !== 'OK') { bindName = 'vibration'; bindColor = ppvColor; bindNote = 'Ground vibration governs — predicted PPV ' + m.ppv.toFixed(0) + ' mm/s against the ' + ctx.ppvLimit + ' mm/s cap at the nearest structure (' + ctx.struct + ' m).'; }
  else if (flyStatus !== 'OK') { bindName = 'flyrock'; bindColor = flyColor; bindNote = 'Flyrock governs — predicted throw ' + m.fly.toFixed(0) + ' m against the ' + ctx.exclusion + ' m exclusion zone. Add stemming or back off charge.'; }
  else if (m.coarse > 13) { bindName = 'fragmentation'; bindColor = '#d97706'; bindNote = 'Fragmentation governs — ' + m.coarse.toFixed(0) + '% of the muck is oversize, choking the shovel and crusher. Tighten the pattern or lift powder factor.'; }
  else if (pf > 1.05) { bindName = 'cost'; bindColor = '#b45309'; bindNote = 'Explosive cost governs — powder factor ' + pf.toFixed(2) + ' kg/m³ is high; confirm the mine-to-mill gain still clears the marginal charge cost.'; }
  else { bindName = 'fragmentation'; bindColor = '#15803d'; bindNote = 'Design is balanced — P80 on target, ' + m.coarse.toFixed(0) + '% oversize, and both safety gates clear with margin.'; }

  // pattern holes (8 cols × 4 rows) + echelon timing contours
  const cols = 8, rows = 4, x0 = 70, x1 = 560, y0 = 70, y1 = 240;
  const hzColor = (h) => (h > 72 ? '#7c3aed' : h >= 58 ? '#c97a1e' : '#2f7d4f');
  const holes = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cx = x0 + (x1 - x0) * c / (cols - 1), cy = y0 + (y1 - y0) * r / (rows - 1);
    const hh = clamp(d.hardness + (c - 3.5) * 5.2 + (r - 1.5) * 1.5, 30, 98);
    const rr = clamp(5.5 + (d.PF - 0.6) * 6.5 + (hh - 60) * 0.025, 5, 12.5);
    holes.push({ cx: +cx.toFixed(1), cy: +cy.toFixed(1), r: +rr.toFixed(1), fill: hzColor(hh) });
  }
  const spread = clamp(40 + (d.timing - 9) * 6, 18, 90);
  const timingLines = [];
  for (let k = -2; k <= 6; k++) { const off = k * spread; timingLines.push({ x1: +(x0 + off - 60).toFixed(1), y1: +(y0 - 18).toFixed(1), x2: +(x0 + off + 170).toFixed(1), y2: +(y1 + 18).toFixed(1) }); }

  // reconciliation (measured muck runs coarser / less uniform than planned)
  const aP80 = clamp(p80 * 1.07 + 14, 55, 760), aN = clamp(m.n * 0.93, 0.8, 1.7);
  const pp = [], ap = [];
  for (let i = 0; i <= 64; i++) { const x = 4 * Math.pow(300, i / 64); pp.push(lx(x).toFixed(1) + ',' + yP(passing(x, p80, m.n)).toFixed(1)); ap.push(lx(x).toFixed(1) + ',' + yP(passing(x, aP80, aN)).toFixed(1)); }
  const reconDelta = aP80 - p80;

  // mine-to-mill value (derived from coarse reduction vs as-drilled reference)
  const uplift = Math.max(0, Math.round((coarseRef - m.coarse) * 16));
  let value = uplift * 7000 * 3.0 - Math.max(0, (pf - 0.82)) * 9e5;
  if (scenario === 'structure-near') value = Math.max(value, 2.1e6);
  value = Math.max(value, 0);

  const ppvScale = ctx.ppvLimit * 1.5, flyScale = ctx.exclusion * 1.5;

  return {
    m, ppvStatus, flyStatus, ppvColor, flyColor, rejected, rejectReason,
    p80, p80Color, n: m.n,
    kpis, fragChips, bindName, bindColor, bindNote,
    // fragmentation curve
    curvePts: pts.join(' '), p80X: +lx(p80).toFixed(1), targetX: +lx(ctx.target).toFixed(1),
    p80Disp: String(Math.round(p80)), targetDisp: ctx.target + ' mm',
    // pattern
    holes, timingLines, patDims: d.B.toFixed(1) + ' m burden × ' + d.S.toFixed(1) + ' m spacing',
    timingDisp: String(d.timing), chargeDisp: fmt(m.charge),
    init: { x: +x0.toFixed(1), y: +y1.toFixed(1), lx: +(x0 - 2).toFixed(1), ly: +(y1 + 18).toFixed(1) },
    // reconciliation
    plannedPts: pp.join(' '), actualPts: ap.join(' '), actualP80: String(Math.round(aP80)),
    reconErr: (reconDelta >= 0 ? '+' : '') + Math.round(reconDelta) + ' mm', reconColor: Math.abs(reconDelta) <= 30 ? '#5fbf86' : '#e0a23a',
    // safety gauges
    ppvDisp: m.ppv.toFixed(1), ppvLimitDisp: ctx.ppvLimit + ' mm/s', ppvNeedle: needle(m.ppv / ppvScale), ppvLimArc: limitArc(ctx.ppvLimit / ppvScale), ppvBorder: rejected && ppvStatus === 'BREACH' ? '#991b1b' : '#e7e4d8',
    flyDisp: String(Math.round(m.fly)), exclDisp: ctx.exclusion + ' m', flyNeedle: needle(m.fly / flyScale), flyLimArc: limitArc(ctx.exclusion / flyScale), flyBorder: rejected && flyStatus === 'BREACH' ? '#991b1b' : '#e7e4d8',
    // value / AI numeric boxes
    uplift, upliftDisp: fmt(uplift), value, valueDisp: usd(value), pfDisp: pf.toFixed(2), digDisp: fmt(m.digRate),
    // solve / AI status labels
    solveLabel: rejected ? 'design rejected' : (edited ? 'live design' : 'optimal'),
    solveColor: rejected ? '#e5484d' : (edited ? '#e0a23a' : '#7fc796'),
    aiTag: edited ? 'live design — edited' : 'optimised',
  };
}

// ── buildMetrics({scenario, design, edited}) → the full snapshot ────────────────
// With no `design` override it resolves the preset's recommended design (the
// initial solve). The server fallback maps a subset of this onto the API schema.
export function buildMetrics({ scenario = DEFAULT_SCENARIO, design = null, edited = false } = {}) {
  const p = PRESETS[scenario] || PRESETS[DEFAULT_SCENARIO];
  const ctx = { target: p.target, ppvLimit: p.ppvLimit, exclusion: p.exclusion, struct: p.struct };
  ctx.coarseRef = core({ ...p.base }, ctx).coarse;
  const d = design ? { ...design } : { ...p.design };
  const baseP80 = Math.round(core({ ...p.base }, ctx).p80);
  const view = deriveView(d, ctx, { coarseRef: ctx.coarseRef, scenario, edited });
  return {
    scenario, design: d, ctx, baseP80,
    headline: p.headline, narrative: p.narrative, actions: p.actions, recs: p.recs,
    ...view,
  };
}

// NL note → scenario key (heuristic; mirrors the prototype parser).
export function parseScenarioKey(text = '') {
  const t = String(text).toLowerCase();
  if (/(hard|seam|band|stiff|tough)/.test(t)) return 'harder-seam';
  if (/(house|structure|wall|near|residen|village|town|metre|meter| m\b|\dm)/.test(t)) return 'structure-near';
  if (/(wet|water|ground ?water|flood)/.test(t)) return 'wet-holes';
  if (/(fine|finer|mill|throughput|sag|crusher)/.test(t)) return 'finer-feed';
  return 'optimise';
}
const SCENARIO_TAG = { 'optimise': 'optimise', 'harder-seam': 'harder seam', 'structure-near': 'structure near', 'wet-holes': 'wet holes', 'finer-feed': 'finer feed' };
export const scenarioTag = (k) => SCENARIO_TAG[k] || k;

// Grounded copilot answer from a live-state snapshot (DOM-free; used by the
// browser fallback and the server fallback so both agree with no API key).
export function answerFromState(question, state = {}) {
  const t = String(question || '').toLowerCase();
  const p80 = Math.round(state.predictedP80mm ?? state.p80 ?? 0);
  const target = state.targetP80mm ?? state.target ?? 250;
  const pf = +(state.powderFactorKgM3 ?? state.PF ?? 0.9);
  const ppv = +(state.ppvMmS ?? state.ppv ?? 0);
  const ppvLimit = state.ppvLimitMmS ?? state.ppvLimit ?? 25;
  const fly = Math.round(state.flyrockM ?? state.fly ?? 0);
  const exclusion = state.exclusionM ?? state.exclusion ?? 500;
  const struct = state.structM ?? state.struct ?? 420;
  const fines = +(state.pctFines ?? state.fines ?? 0);
  const oversize = +(state.pctOversize ?? state.oversize ?? 0);
  const coarse = +(state.pctCoarse ?? state.coarse ?? oversize);
  const coarseRef = state.coarseRef ?? 21;
  const ppvStatus = ppv >= ppvLimit ? 'BREACH' : (ppv >= 0.8 * ppvLimit ? 'WATCH' : 'OK');
  const flyStatus = fly >= exclusion ? 'BREACH' : 'OK';
  if (/(binding|govern|constraint|limit.*design|what.*govern)/.test(t) || t === 'binding') {
    return 'With P80 at ' + p80 + ' mm, ' + oversize.toFixed(0) + '% oversize and PPV ' + ppv.toFixed(0) + '/' + ppvLimit + ' mm/s, ' + (ppvStatus !== 'OK' ? 'ground vibration' : (coarse > 13 ? 'fragmentation' : 'the mine-to-mill trade-off')) + ' is binding this design. ' + (ppvStatus !== 'OK' ? 'Charge-per-delay near the ' + struct + ' m structure is the lever.' : 'There is headroom on both safety gates.');
  }
  if (/ppv|vibration|limit|safe/.test(t) || t === 'ppv') {
    return 'Predicted PPV is ' + ppv.toFixed(1) + ' mm/s against a ' + ppvLimit + ' mm/s cap at the structure ' + struct + ' m away — status ' + ppvStatus + '. Flyrock is ' + fly + ' m vs the ' + exclusion + ' m exclusion (' + flyStatus + '). ' + (ppvStatus === 'OK' && flyStatus === 'OK' ? 'Both gates are clear, so this design is offerable.' : 'A gate is in play — the design is held until it clears.');
  }
  if (/powder|pf|charge|higher|more/.test(t) || t === 'pf') {
    return 'Powder factor is ' + pf.toFixed(2) + ' kg/m³. Pushing higher would finer the feed but ' + (ppvStatus !== 'OK' ? 'PPV is already at ' + ppv.toFixed(0) + '/' + ppvLimit + ' — vibration caps it.' : (fines > 14 ? 'fines are climbing (' + fines.toFixed(0) + '%), wasting energy and risking ore loss.' : 'the gain has to clear the marginal explosive cost and the fines watch.')) + ' The aim is the ' + target + ' mm band, not the finest muck.';
  }
  if (/value|mine.?to.?mill|throughput|money|\$|worth/.test(t) || t === 'value') {
    const uplift = Math.max(0, Math.round((coarseRef - coarse) * 16));
    return 'This design lifts mine-to-mill throughput about +' + fmt(uplift) + ' t/h by cutting oversize to ' + oversize.toFixed(0) + '% and feeding the crusher cleaner. Net of the marginal explosive at ' + pf.toFixed(2) + ' kg/m³, that is worth roughly ' + usd(Math.max(0, uplift * 7000 * 3.0 - Math.max(0, (pf - 0.82)) * 9e5)) + '/yr — derived from the live curve, not a fixed figure.';
  }
  if (/fragment|p80|size|frag/.test(t)) {
    return 'Predicted P80 is ' + p80 + ' mm vs a ' + target + ' mm target — ' + fines.toFixed(0) + '% fines, ' + (state.pctOnspec ?? state.onspec ?? 0).toFixed(0) + '% on-spec, ' + oversize.toFixed(0) + '% oversize. ' + (p80 > target + 35 ? 'It is running coarse; tighten the pattern or lift PF.' : (p80 < target - 35 ? 'It is fine; you can ease charge to save energy.' : 'It is sitting on the band.'));
  }
  return 'Reading the live bench: P80 ' + p80 + ' mm, powder factor ' + pf.toFixed(2) + ' kg/m³, PPV ' + ppv.toFixed(0) + '/' + ppvLimit + ' mm/s, flyrock ' + fly + '/' + exclusion + ' m. Ask about the binding constraint, the safety gates, the powder factor, or the mine-to-mill value.';
}
