// Blast Optimisation — drill-and-blast design console.
// A deterministic engine (blast-scenarios.js) is the source of truth for every
// number on screen — the fragmentation curve, P80, bench pattern, PPV / flyrock
// gates and value all redraw instantly from it (works with no API key). The AI
// rationale comes from /api/blast/* with an unbreakable deterministic fallback.
import { postJSON, esc } from './shared.js';
import { witaTime } from './sim.js';
import { buildMetrics, deriveView, PRESETS, DEFAULT_SCENARIO, tagColor, parseScenarioKey, scenarioTag, answerFromState, fmt, usd } from './blast-scenarios.js';

const el = (id) => document.getElementById(id);

// ── live state ──────────────────────────────────────────────────────────────
let scenario = DEFAULT_SCENARIO;
let design = { ...PRESETS[DEFAULT_SCENARIO].design };
let ctx = { target: 250, ppvLimit: 25, exclusion: 500, struct: 420, coarseRef: 21 };
let ai = null;          // { headline, narrative, actions, recs, baseP80 }
let edited = false;
let tab = 'frag';
let reqToken = 0;       // guards async AI overlays against newer edits

// ── slider config ──────────────────────────────────────────────────────────
const SLIDERS = [
  { key: 'PF', label: 'Powder fac', min: 0.6, max: 1.3, step: 0.01, disp: (v) => v.toFixed(2) },
  { key: 'B', label: 'Burden m', min: 3.5, max: 6.5, step: 0.1, disp: (v) => v.toFixed(1) },
  { key: 'S', label: 'Spacing m', min: 4.5, max: 7.5, step: 0.1, disp: (v) => v.toFixed(1) },
  { key: 'stem', label: 'Stemming m', min: 3.0, max: 5.5, step: 0.1, disp: (v) => v.toFixed(1) },
  { key: 'timing', label: 'Timing ms', min: 4, max: 20, step: 1, disp: (v) => String(Math.round(v)) },
  { key: 'hardness', label: 'MWD hard', min: 40, max: 95, step: 1, disp: (v) => String(Math.round(v)) },
];

function renderSliders() {
  el('sliders').innerHTML = SLIDERS.map((s) => `
    <div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.03em;text-transform:uppercase;color:#8b9182;">${s.label}</span>
        <span id="sd-${s.key}" style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:800;color:#dfe5da;">${s.disp(design[s.key])}</span>
      </div>
      <input id="sl-${s.key}" type="range" class="b-rng" min="${s.min}" max="${s.max}" step="${s.step}" value="${design[s.key]}" />
    </div>`).join('');
  SLIDERS.forEach((s) => el('sl-' + s.key).addEventListener('input', (e) => {
    design[s.key] = parseFloat(e.target.value);
    edited = true;
    el('sd-' + s.key).textContent = s.disp(design[s.key]);
    renderDynamic();
  }));
}
function syncSliders() {
  SLIDERS.forEach((s) => { const i = el('sl-' + s.key); if (i) i.value = design[s.key]; el('sd-' + s.key).textContent = s.disp(design[s.key]); });
}

// ── presets ──────────────────────────────────────────────────────────────────
function renderPresets() {
  el('presets').innerHTML = Object.keys(PRESETS).map((k) =>
    `<button class="b-preset" data-key="${k}">${PRESETS[k].label}</button>`).join('');
  el('presets').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => solve(b.dataset.key)));
}
function syncPresets() {
  el('presets').querySelectorAll('.b-preset').forEach((b) => b.classList.toggle('active', b.dataset.key === scenario && !edited));
}

// ── tabs ─────────────────────────────────────────────────────────────────────
function renderTabs() {
  document.querySelectorAll('.b-tab').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    document.querySelectorAll('.b-tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
    el('panelFrag').style.display = tab === 'frag' ? 'flex' : 'none';
    el('panelPattern').style.display = tab === 'pattern' ? 'flex' : 'none';
    el('panelRecon').style.display = tab === 'recon' ? 'flex' : 'none';
  }));
}

// ── render: dynamic (engine-driven) panels ────────────────────────────────────
function renderDynamic() {
  const v = deriveView(design, ctx, { coarseRef: ctx.coarseRef, scenario, edited });

  // KPIs
  el('kpiRow').innerHTML = v.kpis.map((k) => `
    <div style="background:#fff;border:1px solid #e7e4d8;border-radius:13px;padding:13px 15px;box-shadow:0 1px 2px rgba(20,30,15,0.04);">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;color:#8b9182;font-weight:600;display:flex;align-items:center;gap:6px;white-space:nowrap;"><span style="width:8px;height:8px;border-radius:2px;background:${k.dot};flex-shrink:0;"></span>${k.label}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:25px;font-weight:800;letter-spacing:-0.02em;margin-top:7px;color:${k.valColor};">${k.value}<span style="font-size:12px;color:#9aa091;font-weight:500;margin-left:3px;">${k.unit}</span></div>
      <div style="font-size:11px;color:${k.deltaColor};margin-top:5px;font-weight:600;">${k.delta}</div>
    </div>`).join('');

  // solve status pill
  el('solveDot').style.background = v.solveColor;
  el('solveLabel').style.color = v.solveColor;
  el('solveLabel').textContent = v.solveLabel;
  el('solveLabel').parentElement.style.color = v.solveColor;

  // binding constraint
  el('bindDot').style.background = v.bindColor;
  el('bindName').style.color = v.bindColor;
  el('bindName').textContent = v.bindName;
  el('bindNote').textContent = v.bindNote;

  // fragmentation curve
  el('fragCurve').setAttribute('points', v.curvePts);
  el('fragCurve').setAttribute('stroke', v.p80Color);
  el('fragTarget').setAttribute('x1', v.targetX); el('fragTarget').setAttribute('x2', v.targetX);
  el('fragCrossH').setAttribute('x2', v.p80X);
  el('fragCrossV').setAttribute('x1', v.p80X); el('fragCrossV').setAttribute('x2', v.p80X);
  el('fragP80Dot').setAttribute('cx', v.p80X); el('fragP80Dot').setAttribute('fill', v.p80Color);
  el('fragP80Lbl').textContent = v.p80Disp + ' mm'; el('fragP80Lbl').style.color = v.p80Color;
  el('fragTargetLbl').textContent = v.targetDisp;
  el('fragChips').innerHTML = v.fragChips.map((c) => `
    <div style="flex:1;background:#141a12;border:1px solid #283226;border-radius:8px;padding:6px 9px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:#7c8a78;">${c.label}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:800;color:${c.color};margin-top:2px;">${c.value}</div>
    </div>`).join('');

  // pattern
  el('patDims').textContent = v.patDims;
  el('patTiming').textContent = v.timingDisp;
  el('patCharge').textContent = v.chargeDisp;
  el('timingLayer').innerHTML = v.timingLines.map((t) =>
    `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="#2c6e8a" stroke-width="1" stroke-dasharray="3 4" opacity="0.55"></line>`).join('');
  el('holeLayer').innerHTML = v.holes.map((h) =>
    `<circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="${h.fill}" stroke="#0c110b" stroke-width="1.4"></circle>`).join('');

  // reconciliation
  el('reconPlanned').setAttribute('points', v.plannedPts);
  el('reconActual').setAttribute('points', v.actualPts);
  el('reconPlannedP80').textContent = v.p80Disp + ' mm';
  el('reconActualP80').textContent = v.actualP80 + ' mm';
  el('reconErr').textContent = v.reconErr; el('reconErr').style.color = v.reconColor;

  // safety gauges
  setGauge('ppv', v.ppvLimArc, v.ppvNeedle, v.ppvColor, v.ppvDisp, 'limit ' + v.ppvLimitDisp + ' · ' + v.ppvStatus, v.ppvBorder);
  setGauge('fly', v.flyLimArc, v.flyNeedle, v.flyColor, v.flyDisp, 'exclusion ' + v.exclDisp + ' · ' + v.flyStatus, v.flyBorder);
  el('rejectBanner').style.display = v.rejected ? 'block' : 'none';
  if (v.rejected) el('rejectReason').textContent = v.rejectReason;

  // AI numeric boxes (live with the design)
  el('optP80').textContent = v.p80Disp;
  el('valueDisp').textContent = v.valueDisp;
  el('pfDisp').textContent = v.pfDisp;
  el('upliftDisp').textContent = v.upliftDisp;
  el('digDisp').textContent = v.digDisp;
  el('aiTag').textContent = v.aiTag;

  syncPresets();
}

function setGauge(p, limArc, needle, color, val, cap, border) {
  el(p + 'LimArc').setAttribute('d', limArc);
  el(p + 'Needle').setAttribute('x2', needle.x); el(p + 'Needle').setAttribute('y2', needle.y);
  el(p + 'Needle').setAttribute('stroke', color);
  el(p + 'Hub').setAttribute('fill', color);
  el(p + 'Val').textContent = val; el(p + 'Val').style.color = color;
  el(p + 'Cap').textContent = cap;
  el(p + 'Card').style.borderColor = border;
}

// ── render: AI copy (changes only on solve / live inference) ───────────────────
function renderAICopy() {
  if (!ai) return;
  el('aiHeadline').textContent = ai.headline;
  el('baseP80').textContent = ai.baseP80;
  el('aiNarrative').textContent = ai.narrative;
  el('aiActions').innerHTML = (ai.actions || []).map((a) => `
    <div style="display:flex;gap:10px;align-items:flex-start;background:#faf9f3;border:1px solid #eeece1;border-radius:10px;padding:10px 12px;">
      <span style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#fff;background:${tagColor(a.param)};border-radius:5px;padding:3px 7px;flex-shrink:0;margin-top:1px;">${esc(a.param)}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;font-weight:700;color:#161b13;font-family:'JetBrains Mono',monospace;">${esc(a.change)}</div>
        <div style="font-size:11.5px;color:#6b7264;line-height:1.35;margin-top:2px;">${esc(a.reason)}</div>
      </div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#16915a;flex-shrink:0;white-space:nowrap;margin-top:1px;">${esc(a.effect)}</span>
    </div>`).join('');
  el('aiRecs').innerHTML = (ai.recs || []).map((r) => `
    <div style="display:flex;gap:10px;align-items:flex-start;">
      <span style="width:6px;height:6px;border-radius:50%;background:#15803d;flex-shrink:0;margin-top:6px;"></span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;font-weight:600;color:#161b13;line-height:1.35;">${esc(r.action)}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#0e7490;margin-top:2px;">${esc(r.impact)} · ${esc(r.timeframe)}</div>
      </div>
    </div>`).join('');
}

// ── solve a scenario: load the preset, then overlay live AI rationale ──────────
async function solve(key) {
  const m = buildMetrics({ scenario: key });
  scenario = key;
  design = { ...m.design };
  ctx = { ...m.ctx };
  edited = false;
  ai = { headline: m.headline, narrative: m.narrative, actions: m.actions, recs: m.recs, baseP80: m.baseP80 };
  syncSliders();
  renderAICopy();
  renderDynamic();

  const token = ++reqToken;
  try {
    const r = await postJSON('/api/blast/analyze', { design, scenario: { scenarioKey: key } });
    if (r && r.source === 'live' && token === reqToken && !edited && scenario === key) {
      if (r.headline) { ai.headline = r.headline; el('aiHeadline').textContent = r.headline; }
      if (r.narrative) { ai.narrative = r.narrative; el('aiNarrative').textContent = r.narrative; }
      if (Array.isArray(r.designActions) && r.designActions.length) { ai.actions = r.designActions; }
      if (Array.isArray(r.recommendations) && r.recommendations.length) { ai.recs = r.recommendations; }
      renderAICopy();
      if (typeof r.valueImpactUSD === 'number') el('valueDisp').textContent = usd(r.valueImpactUSD);
    }
  } catch { /* deterministic copy already shown */ }
}

// ── free-text scenario parse ──────────────────────────────────────────────────
async function submitFree() {
  const v = el('blastFree').value.trim();
  if (!v) { el('parsedNote').textContent = ''; return; }
  const btn = el('blastFreeBtn'), lbl = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  let key = 'optimise', interp = '';
  try { const r = await postJSON('/api/blast/parse', { text: v }); key = r.scenarioKey || parseScenarioKey(v); interp = r.interpretation || ''; }
  catch { key = parseScenarioKey(v); interp = 'Parsed: "' + v + '" → ' + scenarioTag(key) + ' · re-solving'; }
  btn.disabled = false; btn.textContent = lbl;
  el('parsedNote').textContent = interp;
  await solve(key);
}

// ── copilot — grounded Q&A over the live design ───────────────────────────────
const COPILOT_QS = ['What governs this design?', 'Are we inside the PPV limit?', 'Why not push powder factor higher?', 'What is the mine-to-mill value?'];
function renderCopilotQs() {
  el('copilotQs').innerHTML = COPILOT_QS.map((q) => `<button class="b-cpq" data-q="${esc(q)}">${q}</button>`).join('');
  el('copilotQs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => askCopilot(b.dataset.q)));
}
function liveState() {
  const m = deriveView(design, ctx, { coarseRef: ctx.coarseRef, scenario, edited });
  return {
    predictedP80mm: Math.round(m.p80), targetP80mm: ctx.target, powderFactorKgM3: +design.PF.toFixed(2),
    ppvMmS: +m.m.ppv.toFixed(1), ppvLimitMmS: ctx.ppvLimit, flyrockM: Math.round(m.m.fly), exclusionM: ctx.exclusion, structM: ctx.struct,
    pctFines: +m.m.fines.toFixed(1), pctOnspec: +m.m.onspec.toFixed(0), pctOversize: +m.m.oversize.toFixed(1), pctCoarse: +m.m.coarse.toFixed(1),
    coarseRef: ctx.coarseRef,
  };
}
async function askCopilot(q) {
  q = (q || '').trim(); if (!q) return;
  el('cpInput').value = '';
  el('copilotAnswer').textContent = '…';
  const state = liveState();
  try { const r = await postJSON('/api/blast/copilot', { question: q, state }); el('copilotAnswer').textContent = r.answer || answerFromState(q, state); }
  catch { el('copilotAnswer').textContent = answerFromState(q, state); }
}

// ── boot ──────────────────────────────────────────────────────────────────────
renderTabs();
renderSliders();
renderPresets();
renderCopilotQs();
el('blastFreeBtn').addEventListener('click', submitFree);
el('blastFree').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitFree(); });
el('cpBtn').addEventListener('click', () => askCopilot(el('cpInput').value));
el('cpInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') askCopilot(el('cpInput').value); });
el('blastClock').textContent = witaTime();
setInterval(() => { el('blastClock').textContent = witaTime(); }, 1000);
solve(DEFAULT_SCENARIO);
