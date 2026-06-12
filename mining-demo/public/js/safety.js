// Safety & Compliance flagship — incident analysis with Indonesian regulations.
import { renderNav, renderFooter, postJSON, chartDefaults, setLoading, PALETTE, esc, $ } from './shared.js';
import { SAMPLE_INCIDENTS } from './samples.js';

renderNav('safety');
renderFooter();
chartDefaults();

let activeSampleId = null;

// Sample chips
const chips = $('#sampleChips');
chips.innerHTML = SAMPLE_INCIDENTS.map((s) => `
  <button class="chip-btn" data-id="${s.id}">${esc(s.title)}<small>${esc(s.tag)}</small></button>`).join('');
chips.querySelectorAll('.chip-btn').forEach((btn) => btn.addEventListener('click', () => {
  const s = SAMPLE_INCIDENTS.find((x) => x.id === btn.dataset.id);
  $('#reportInput').value = s.text;
  activeSampleId = s.id;
  chips.querySelectorAll('.chip-btn').forEach((b) => b.classList.toggle('active', b === btn));
}));
$('#reportInput').addEventListener('input', () => {
  // Free edits detach the report from the sample (server falls back generically)
  const sample = SAMPLE_INCIDENTS.find((s) => s.id === activeSampleId);
  if (sample && $('#reportInput').value !== sample.text) {
    activeSampleId = null;
    chips.querySelectorAll('.chip-btn').forEach((b) => b.classList.remove('active'));
  }
});

// Dashboard strip charts
new Chart($('#catChart'), {
  type: 'bar',
  data: {
    labels: ['Vehicle interaction', 'Ground/strata', 'Energy isolation', 'Fatigue', 'Working at height', 'Hand injuries'],
    datasets: [{ data: [17, 9, 12, 14, 6, 21], backgroundColor: PALETTE.red + 'bb', borderRadius: 5 }],
  },
  options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
});
new Chart($('#trifrChart'), {
  type: 'line',
  data: {
    labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{ label: 'TRIFR', data: [4.8, 4.6, 4.9, 4.3, 4.1, 4.4, 3.9, 3.7, 3.8, 3.4, 3.2, 3.1], borderColor: PALETTE.green, borderWidth: 2, pointRadius: 2, tension: 0.35 }],
  },
  options: { plugins: { legend: { display: false } } },
});

// ── Analysis ──────────────────────────────────────────────────────────────────
$('#analyzeBtn').addEventListener('click', async () => {
  const report = $('#reportInput').value.trim();
  if (!report) { $('#reportInput').focus(); return; }
  const btn = $('#analyzeBtn');
  setLoading(btn, true, 'Analyzing incident…');
  $('#placeholder').style.display = 'none';
  const results = $('#results');
  results.style.display = 'flex';
  results.classList.add('loading-shimmer');
  results.innerHTML = `<div class="panel" style="color:var(--muted); font-size:13.5px;">✦ Classifying hazards, scoring risk, mapping regulations…</div>`;
  try {
    const r = await postJSON('/api/safety/analyze', { report, sampleId: activeSampleId });
    renderAnalysis(results, r);
  } catch (e) {
    results.innerHTML = `<div class="panel" style="color:var(--red);">${esc(e.message)}</div>`;
  } finally {
    results.classList.remove('loading-shimmer');
    setLoading(btn, false);
  }
});

function riskMatrixHTML(like, cons) {
  // 5x5: rows = likelihood 5..1 (top to bottom), cols = consequence 1..5
  const color = (l, c) => { const s = l * c; return s >= 15 ? 'rk-r' : s >= 10 ? 'rk-o' : s >= 5 ? 'rk-y' : 'rk-g'; };
  let html = '<div class="risk-matrix"><div class="axis"></div>';
  for (let c = 1; c <= 5; c++) html += `<div class="axis">C${c}</div>`;
  for (let l = 5; l >= 1; l--) {
    html += `<div class="axis">L${l}</div>`;
    for (let c = 1; c <= 5; c++) {
      html += `<div class="risk-cell ${color(l, c)} ${l === like && c === cons ? 'hit' : ''}">${l * c}</div>`;
    }
  }
  return html + '</div>';
}

function statusTag(s) {
  return s === 'GAP' ? 'bad' : s === 'PARTIAL' ? 'warn' : s === 'OK' ? 'ok' : 'info';
}

function renderAnalysis(root, r) {
  const lvl = r.severity?.level ?? 3;
  const like = r.riskScore?.likelihood ?? 3;
  const cons = r.riskScore?.consequence ?? 3;
  root.innerHTML = `
    <div class="severity-banner s${lvl}">
      <span class="lvl">S${lvl}</span>
      <div><div>${esc(r.severity?.label ?? '')}</div>
        <div style="font-weight:500; font-size:12.5px; opacity:0.85;">Risk score ${like}×${cons} = ${like * cons} · ${r.source === 'live' ? 'Claude live inference' : 'OreSight engine'}</div></div>
    </div>

    <div class="panel">
      <h3>Hazard classification</h3>
      <div class="chips">${(r.hazardCategories || []).map((h) => `<span class="tag warn">${esc(h)}</span>`).join('')}</div>
    </div>

    <div class="grid-2" style="align-items: stretch;">
      <div class="panel">
        <h3>5×5 risk matrix <span class="hint">likelihood × consequence</span></h3>
        ${riskMatrixHTML(like, cons)}
      </div>
      <div class="panel">
        <h3>Root causes</h3>
        <div class="list-block red">${(r.rootCauses || []).map((c) => `<div class="li">${esc(c)}</div>`).join('')}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <h3>⏱ Immediate actions <span class="hint">24–48 h</span></h3>
        <div class="list-block">${(r.immediateActions || []).map((a) => `<div class="li">${esc(a)}</div>`).join('')}</div>
      </div>
      <div class="panel">
        <h3>🛡 Preventive actions <span class="hint">systemic</span></h3>
        <div class="list-block green">${(r.preventiveActions || []).map((a) => `<div class="li">${esc(a)}</div>`).join('')}</div>
      </div>
    </div>

    <div class="panel">
      <h3>Regulatory compliance check</h3>
      ${(r.complianceFlags || []).map((f) => `
        <div class="comp-flag">
          <span class="reg">${esc(f.regulation)}<small>${esc(f.clause)}</small></span>
          <span class="tag ${statusTag(f.status)}" style="flex-shrink:0;">${esc(f.status)}</span>
          <span class="note">${esc(f.note)}</span>
        </div>`).join('')}
    </div>

    <div class="ai-panel">
      <div class="ai-panel-head"><span class="spark">✦</span><span class="t">Analyst narrative — for the KTT</span></div>
      <div style="font-size: 13.5px; line-height: 1.65;">${esc(r.narrative)}</div>
    </div>`;
  root.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
