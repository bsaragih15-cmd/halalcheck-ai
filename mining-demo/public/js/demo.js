// Drives demo.html — the templated demo for every non-flagship matrix cell.
// Reads ?case=<id>, renders KPIs/charts/scenario from usecases.js config.
import { renderNav, renderFooter, postJSON, renderAIResult, chartDefaults, setLoading, PALETTE, esc, $ } from './shared.js';
import { channel, Stream } from './sim.js';
import { USE_CASES, VALUE_DRIVERS } from './usecases.js';

const id = new URLSearchParams(location.search).get('case');
const uc = USE_CASES[id];

renderNav();
renderFooter();
chartDefaults();

if (!uc || uc.flagship) {
  $('#title').textContent = 'Demo not found';
  $('#pitch').innerHTML = 'Unknown use case — <a href="/index.html#matrix" style="color:var(--accent)">back to the value chain</a>.';
  throw new Error('unknown case');
}

document.title = `OreSight AI — ${uc.title}`;

// Header
$('#crumb').innerHTML = `<a href="/index.html#matrix">Value Chain</a><span class="sep">/</span><span>${esc(uc.stage)}</span><span class="sep">/</span><span class="cur">${esc(uc.title)}</span>`;
const badges = (uc.drivers || []).map((d) => `<span class="vdg ${VALUE_DRIVERS[d].cls}" title="${VALUE_DRIVERS[d].label}" style="font-size:15px;">${VALUE_DRIVERS[d].icon}</span>`).join(' ');
$('#title').innerHTML = `${esc(uc.title)} <span style="display:inline-flex; gap:8px;">${badges}</span> <span class="tag info">Horizon: ${esc(uc.horizon)}</span> <span class="badge-indev">IN DEV</span>`;
$('#site').textContent = uc.site || '';
$('#pitch').textContent = uc.pitch || '';

// KPIs
$('#kpis').innerHTML = (uc.kpis || []).map((k) => `
  <div class="kpi-card">
    <div class="l">${esc(k.label)}</div>
    <div class="v">${Number(k.value).toLocaleString('en-US', { maximumFractionDigits: k.decimals ?? 0, minimumFractionDigits: k.decimals ?? 0 })}<small>${esc(k.unit)}</small></div>
    <div class="d">${esc(k.delta || '')}</div>
  </div>`).join('');

// Charts
const liveStreams = [];
$('#charts').innerHTML = (uc.charts || []).map((c, i) => `<div class="chart-box"><div class="ct">${esc(c.title)}</div><canvas id="chart${i}"></canvas></div>`).join('');
(uc.charts || []).forEach((c, i) => {
  const ctx = document.getElementById(`chart${i}`);
  if (c.type === 'bar') {
    new Chart(ctx, {
      type: 'bar',
      data: { labels: c.labels, datasets: [{ data: c.data, backgroundColor: PALETTE[c.color || 'amber'] + 'cc', borderRadius: 5 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });
    return;
  }
  // line chart, possibly multi-series, possibly live-streaming
  const datasets = (c.series || []).map((s) => {
    const data = channel(s.gen, c.series[0] === s && c.live ? (s.points ?? 30) : (s.points ?? 30));
    const stream = c.live ? new Stream(s.gen, s.points ?? 30) : null;
    return { s, stream, ds: {
      label: s.label, data: stream ? [...stream.data] : data,
      borderColor: PALETTE[s.color || 'amber'], backgroundColor: 'transparent',
      borderWidth: 2, pointRadius: 0, tension: 0.35,
    } };
  });
  const labels = c.xlabels || datasets[0].ds.data.map((_, j) => j + 1);
  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: datasets.map((d) => d.ds) },
    options: {
      plugins: { legend: { display: (c.series || []).length > 1 } },
      scales: { y: { title: { display: !!c.unit, text: c.unit } } },
    },
  });
  if (c.threshold) {
    chart.data.datasets.push({ label: c.threshold.label, data: labels.map(() => c.threshold.value), borderColor: PALETTE.red, borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 });
    chart.options.plugins.legend.display = true;
    chart.update();
  }
  if (c.live) liveStreams.push({ chart, datasets });
});

if (liveStreams.length) {
  setInterval(() => {
    for (const { chart, datasets } of liveStreams) {
      datasets.forEach((d, k) => {
        if (!d.stream) return;
        d.stream.tick();
        chart.data.datasets[k].data = [...d.stream.data];
      });
      chart.update('none');
    }
  }, 2000);
}

// Scenario control
let scenarioState = {};
const sc = uc.scenario;
if (sc) {
  const wrap = $('#scenario');
  wrap.innerHTML = `
    <div class="row">
      <label>${esc(sc.label)}</label>
      <input type="range" id="scInput" min="${sc.min}" max="${sc.max}" step="${sc.step}" value="${sc.value}" />
      <span class="val" id="scVal"></span>
    </div>
    <div class="derived"><span class="l" id="dvL"></span><span class="v" id="dvV"></span><span class="note" id="dvN"></span></div>`;
  const input = $('#scInput');
  const update = () => {
    const v = Number(input.value);
    scenarioState = { control: sc.label, value: v, unit: sc.unit };
    $('#scVal').textContent = v.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + sc.unit;
    const d = sc.derive(v);
    $('#dvL').textContent = d.label;
    $('#dvV').textContent = d.value;
    const n = $('#dvN');
    n.textContent = d.note || '';
    n.classList.toggle('warn', /⚠/.test(d.note || ''));
    scenarioState.derived = `${d.label}: ${d.value} (${d.note || ''})`;
  };
  input.addEventListener('input', update);
  update();
}

// AI recommendation
$('#aiBtn').addEventListener('click', async () => {
  const btn = $('#aiBtn');
  const panel = $('#aiPanel');
  setLoading(btn, true, 'Analyzing scenario…');
  panel.classList.add('loading-shimmer');
  try {
    const r = await postJSON('/api/usecase/analyze', { caseId: id, scenario: scenarioState });
    renderAIResult(panel, r);
  } catch (e) {
    panel.innerHTML = `<div class="ai-panel-head"><span class="spark">✦</span><span class="t">OreSight AI</span></div><div style="color:var(--red); font-size:13.5px;">${esc(e.message)}</div>`;
  } finally {
    panel.classList.remove('loading-shimmer');
    setLoading(btn, false);
  }
});
