// Blending Optimisation flagship — live charts + interactive blend console.
import { renderNav, renderFooter, postJSON, chartDefaults, setLoading, tween, PALETTE, esc, $ } from './shared.js';
import { Stream } from './sim.js';

renderNav('production');
renderFooter();
chartDefaults();

const ASSAYS = { sapHi: 2.02, sapMed: 1.74, limonite: 1.35 };
const SOURCES = [
  { key: 'sapHi', name: 'Saprolite HG', sub: 'SP-1 · 2.02% Ni', value: 50 },
  { key: 'sapMed', name: 'Saprolite MG', sub: 'SP-2 · 1.74% Ni', value: 35 },
  { key: 'limonite', name: 'Limonite', sub: 'SP-4 · 1.35% Ni', value: 15 },
];
const TARGET = 1.8;

// ── Charts ────────────────────────────────────────────────────────────────────
const feed = new Stream({ base: 2050, drift: 0, noise: 90, period: 12, amp: 220, seed: 401 }, 56);
const tonnageChart = new Chart($('#tonnageChart'), {
  type: 'line',
  data: { labels: feed.data.map((_, i) => i), datasets: [{ label: 't/h', data: [...feed.data], borderColor: PALETTE.amber, borderWidth: 2, pointRadius: 0, tension: 0.35, fill: { target: 'origin' }, backgroundColor: 'rgba(245,166,35,0.05)' }] },
  options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { suggestedMin: 1400 } } },
});
setInterval(() => {
  feed.tick();
  tonnageChart.data.datasets[0].data = [...feed.data];
  tonnageChart.update('none');
  tween($('#kTph'), feed.last() / 6.6, { decimals: 0 });
  const kt = $('#kTonnes');
  tween(kt, parseFloat(kt.textContent.replace(/,/g, '')) + Math.random() * 40, { decimals: 0 });
}, 2000);

new Chart($('#gradeChart'), {
  type: 'bar',
  data: { labels: ['A2 sap', 'B1 sap', 'B2 trans', 'C1 lim'], datasets: [{ data: [1.92, 1.65, 1.51, 1.28], backgroundColor: [PALETTE.green + 'cc', PALETTE.amber + 'cc', PALETTE.amber + '88', PALETTE.cyan + '88'], borderRadius: 5 }] },
  options: { plugins: { legend: { display: false } }, scales: { y: { suggestedMin: 1.0 } } },
});
new Chart($('#stockChart'), {
  type: 'doughnut',
  data: { labels: ['Sap HG (SP-1)', 'Sap MG (SP-2)', 'Limonite (SP-4)'], datasets: [{ data: [86, 142, 210], backgroundColor: [PALETTE.green, PALETTE.amber, PALETTE.cyan], borderWidth: 0 }] },
  options: { cutout: '62%', plugins: { legend: { position: 'bottom' } } },
});

// ── Blend console ─────────────────────────────────────────────────────────────
const rows = $('#blendRows');
rows.innerHTML = SOURCES.map((s) => `
  <div class="blend-row">
    <div class="nm">${s.name}<small>${s.sub}</small></div>
    <input type="range" min="0" max="100" step="1" value="${s.value}" data-key="${s.key}" />
    <div class="pv"><span data-pv="${s.key}">${s.value}</span>%</div>
  </div>`).join('');

function blendState() {
  const b = {};
  rows.querySelectorAll('input[type="range"]').forEach((i) => { b[i.dataset.key] = Number(i.value); });
  return b;
}

function updateBlend() {
  const b = blendState();
  SOURCES.forEach((s) => { rows.querySelector(`[data-pv="${s.key}"]`).textContent = b[s.key]; });
  const total = b.sapHi + b.sapMed + b.limonite;
  const grade = total ? (b.sapHi * ASSAYS.sapHi + b.sapMed * ASSAYS.sapMed + b.limonite * ASSAYS.limonite) / total : 0;
  const el = $('#blendGrade');
  el.textContent = grade.toFixed(3) + '% Ni';
  el.className = 'v ' + (grade >= TARGET ? 'ok' : 'bad');
  $('#blendSum').textContent = total === 100 ? '' : `Σ ${total}% — normalised`;
}
rows.querySelectorAll('input').forEach((i) => i.addEventListener('input', updateBlend));
updateBlend();

// ── AI optimisation ───────────────────────────────────────────────────────────
$('#optBtn').addEventListener('click', async () => {
  const btn = $('#optBtn');
  const panel = $('#aiPanel');
  setLoading(btn, true, 'Optimising blend…');
  panel.classList.add('loading-shimmer');
  try {
    const r = await postJSON('/api/production/analyze', {
      blend: blendState(), assays: ASSAYS, throughputTph: Math.round(feed.last() / 6.6), target: TARGET,
    });
    renderOptimisation(panel, r);
  } catch (e) {
    panel.innerHTML = `<div style="color:var(--red); font-size:13.5px;">${esc(e.message)}</div>`;
  } finally {
    panel.classList.remove('loading-shimmer');
    setLoading(btn, false);
  }
});

function renderOptimisation(panel, r) {
  const rb = r.recommendedBlend || {};
  const ok = (r.estimatedGradeNi ?? 0) >= TARGET;
  panel.innerHTML = `
    <div class="ai-panel-head"><span class="spark">✦</span><span class="t">OreSight AI Optimisation</span>
      <span class="src">${r.source === 'live' ? 'claude · live inference' : 'OreSight engine'}</span></div>
    <div style="display:flex; gap:14px; flex-wrap:wrap; margin-bottom: 14px;">
      <div class="derived" style="flex:1; min-width: 180px;"><span class="l">Your blend grades</span><span class="v" style="color:${ok ? 'var(--green)' : 'var(--red)'}">${Number(r.estimatedGradeNi).toFixed(2)}% Ni</span></div>
      <div class="derived" style="flex:1; min-width: 180px;"><span class="l">AI recommended</span><span class="v" style="color:var(--green)">${rb.sapHi}/${rb.sapMed}/${rb.limonite} → ${Number(rb.grade).toFixed(2)}%</span></div>
    </div>
    <div style="display:flex; gap:14px; flex-wrap:wrap; margin-bottom: 4px;">
      <div class="derived" style="flex:1;"><span class="l">24 h forecast</span><span class="v" style="font-size:15px;">${Number(r.forecast24h?.tonnes).toLocaleString('en-US')} t @ ${Number(r.forecast24h?.grade).toFixed(2)}% Ni · ${r.forecast24h?.recoveryPct}% rec</span></div>
    </div>
    <div class="derived" style="border-color: rgba(239,68,68,0.4);"><span class="l">⛔ Bottleneck</span><span class="v" style="font-size:13.5px; font-weight:600;">${esc(r.bottleneck)}</span></div>
    <div style="margin-top:12px;">${(r.recommendations || []).map((rec, i) => `
      <div class="ai-rec"><div class="n">${String(i + 1).padStart(2, '0')}</div><div class="a" style="font-weight:500; font-size:13px;">${esc(rec)}</div></div>`).join('')}</div>
    <div class="ai-narrative">${esc(r.narrative)}</div>
    <div style="margin-top:14px;"><button class="btn-secondary" id="applyBlend">Apply recommended blend ↺</button></div>`;
  $('#applyBlend')?.addEventListener('click', () => {
    rows.querySelector('[data-key="sapHi"]').value = rb.sapHi;
    rows.querySelector('[data-key="sapMed"]').value = rb.sapMed;
    rows.querySelector('[data-key="limonite"]').value = rb.limonite;
    updateBlend();
  });
}
