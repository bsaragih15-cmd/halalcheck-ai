// Maintenance Optimisation flagship — streaming fleet telemetry + AI diagnosis.
import { renderNav, renderFooter, postJSON, chartDefaults, setLoading, sparkline, PALETTE, esc, $ } from './shared.js';
import { FLEET, Stream, ISO_ALARM, ISO_WARN, assetStatus, healthScore, witaTime } from './sim.js';

renderNav('maintenance');
renderFooter();
chartDefaults();

setInterval(() => { $('#witaClock').textContent = witaTime(); }, 1000);
$('#witaClock').textContent = witaTime();

const POINTS = 60;
const assets = FLEET.map((a) => ({
  ...a,
  vibStream: new Stream(a.vib, POINTS),
  tempStream: new Stream(a.temp, POINTS),
}));

let selected = assets.find((a) => a.id === 'HT-104');

// ── Fleet list ────────────────────────────────────────────────────────────────
function renderFleet() {
  const list = $('#fleetList');
  list.innerHTML = assets.map((a) => {
    const v = a.vibStream.last();
    const st = assetStatus(v);
    const hs = healthScore(v);
    return `
      <div class="fleet-card ${a.id === selected.id ? 'active' : ''}" data-id="${a.id}">
        <span class="status-dot ${st}"></span>
        <span class="id">${a.id}</span>
        <span class="meta"><span class="m1">${a.type} · ${a.hours.toLocaleString('en-US')} h</span></span>
        <svg class="spark" data-spark="${a.id}"></svg>
        <span class="hs" style="color: ${st === 'crit' ? 'var(--red)' : st === 'warn' ? 'var(--amber)' : 'var(--green)'}">${hs}</span>
      </div>`;
  }).join('');
  for (const a of assets) {
    const svg = list.querySelector(`[data-spark="${a.id}"]`);
    if (svg) sparkline(svg, a.vibStream.data.slice(-24), { stroke: assetStatus(a.vibStream.last()) === 'ok' ? PALETTE.green : assetStatus(a.vibStream.last()) === 'warn' ? PALETTE.amber : PALETTE.red });
  }
  list.querySelectorAll('.fleet-card').forEach((el) => el.addEventListener('click', () => selectAsset(el.dataset.id)));
  $('#kAlerts').textContent = assets.filter((a) => assetStatus(a.vibStream.last()) !== 'ok').length;
}

// ── Detail charts ─────────────────────────────────────────────────────────────
const labels = Array.from({ length: POINTS }, (_, i) => i - POINTS + 1);
const vibChart = new Chart($('#vibChart'), {
  type: 'line',
  data: { labels, datasets: [
    { label: 'Vibration RMS', data: [], borderColor: PALETTE.amber, borderWidth: 2, pointRadius: 0, tension: 0.3 },
    { label: `Alarm — ISO zone D (${ISO_ALARM})`, data: labels.map(() => ISO_ALARM), borderColor: PALETTE.red, borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 },
    { label: `Warning — ISO zone C (${ISO_WARN})`, data: labels.map(() => ISO_WARN), borderColor: PALETTE.amber, borderDash: [3, 5], borderWidth: 1, pointRadius: 0 },
  ]},
  options: { scales: { y: { suggestedMin: 0, suggestedMax: 10, title: { display: true, text: 'mm/s' } }, x: { display: false } } },
});
const tempChart = new Chart($('#tempChart'), {
  type: 'line',
  data: { labels, datasets: [{ label: 'Bearing temp', data: [], borderColor: PALETTE.cyan, borderWidth: 2, pointRadius: 0, tension: 0.3 }] },
  options: { plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: '°C' } }, x: { display: false } } },
});

function selectAsset(id) {
  selected = assets.find((a) => a.id === id) || selected;
  $('#detailTitle').innerHTML = `${selected.id} — ${selected.type} <span class="hint">${selected.role} · ${selected.hours.toLocaleString('en-US')} engine hours</span>`;
  $('#aiPanel').style.display = 'none';
  refreshCharts();
  renderFleet();
}

function refreshCharts() {
  vibChart.data.datasets[0].data = [...selected.vibStream.data];
  tempChart.data.datasets[0].data = [...selected.tempStream.data];
  vibChart.update('none');
  tempChart.update('none');
}

// Live tick — all assets stream so sparklines + selected charts move.
setInterval(() => {
  for (const a of assets) { a.vibStream.tick(); a.tempStream.tick(); }
  refreshCharts();
  renderFleet();
}, 2000);

selectAsset('HT-104');

// ── AI diagnosis ──────────────────────────────────────────────────────────────
$('#diagBtn').addEventListener('click', async () => {
  const btn = $('#diagBtn');
  const panel = $('#aiPanel');
  setLoading(btn, true, 'Running diagnosis…');
  panel.style.display = '';
  panel.classList.add('loading-shimmer');
  panel.innerHTML = `<div class="ai-panel-head"><span class="spark">✦</span><span class="t">OreSight AI Diagnosis</span></div><div style="color:var(--muted); font-size:13.5px;">Analysing ${selected.id} telemetry…</div>`;

  const vib = selected.vibStream.data;
  const temp = selected.tempStream.data;
  const summary = {
    vibrationLast: +vib[vib.length - 1].toFixed(2),
    vibrationMean: +(vib.reduce((a, b) => a + b) / vib.length).toFixed(2),
    vibrationMax: +Math.max(...vib).toFixed(2),
    vibrationTrendPerHour: +(((vib[vib.length - 1] - vib[0]) / POINTS) * 1800).toFixed(3),
    bearingTempLast: +temp[temp.length - 1].toFixed(1),
    bearingTempMean: +(temp.reduce((a, b) => a + b) / temp.length).toFixed(1),
    fleetBaselineTemp: 79,
    isoWarnZone: ISO_WARN, isoAlarmZone: ISO_ALARM,
  };

  try {
    const r = await postJSON('/api/maintenance/analyze', {
      assetId: selected.id,
      assetMeta: { type: selected.type, role: selected.role, engineHours: selected.hours },
      telemetrySummary: summary,
    });
    renderDiagnosis(panel, r);
  } catch (e) {
    panel.innerHTML = `<div style="color:var(--red); font-size:13.5px;">${esc(e.message)}</div>`;
  } finally {
    panel.classList.remove('loading-shimmer');
    setLoading(btn, false);
  }
});

function renderDiagnosis(panel, r) {
  const sevTag = r.severity === 'CRITICAL' ? 'bad' : r.severity === 'WARNING' ? 'warn' : 'ok';
  const prob = Math.round((r.failureProbability ?? 0) * 100);
  panel.innerHTML = `
    <div class="ai-panel-head"><span class="spark">✦</span><span class="t">OreSight AI Diagnosis — ${esc(selected.id)}</span>
      <span class="src">${r.source === 'live' ? 'claude · live inference' : 'OreSight engine'}</span></div>
    <div class="grid-2" style="gap: 20px; align-items: start;">
      <div>
        <div style="display:flex; gap:18px; align-items:center;">
          <div style="position:relative; width:120px; height:120px; flex-shrink:0;"><canvas id="gauge"></canvas>
            <div style="position:absolute; inset:0; display:grid; place-items:center; flex-direction:column;">
              <div class="mono" style="font-size:22px; font-weight:800; color:${prob >= 50 ? 'var(--red)' : prob >= 20 ? 'var(--amber)' : 'var(--green)'}">${prob}%</div>
            </div>
          </div>
          <div>
            <div style="font-size:11.5px; color:var(--muted); font-weight:600;">30-DAY FAILURE PROBABILITY</div>
            <div style="margin-top:8px;"><span class="tag ${sevTag}">${esc(r.severity)}</span> <span class="tag">Health ${esc(String(r.healthScore))}</span></div>
            <div style="margin-top:10px; font-size:13.5px; font-weight:700;">${esc(r.component)}</div>
            <div style="font-size:12.5px; color:var(--muted);">${r.predictedFailureDays ? `Predicted functional failure in ~${r.predictedFailureDays} days` : 'No failure predicted'}</div>
          </div>
        </div>
        <div class="derived" style="margin-top:16px;"><span class="l">Recommended window</span><span class="v" style="font-size:14px;">${esc(r.recommendedWindow)}</span></div>
        ${r.costAvoidanceUSD ? `<div class="ai-value"><span class="v">$${Number(r.costAvoidanceUSD).toLocaleString('en-US')}</span><span class="l">cost avoidance vs in-service failure</span></div>` : ''}
      </div>
      <div>
        <div style="font-size:12px; font-weight:700; color:var(--muted); margin-bottom:8px;">ACTION CHECKLIST</div>
        <div class="list-block">${(r.actions || []).map((a) => `<div class="li">${esc(a)}</div>`).join('')}</div>
        ${(r.parts || []).length ? `<div style="font-size:12px; font-weight:700; color:var(--muted); margin:14px 0 8px;">PARTS</div>
          ${(r.parts || []).map((p) => `<div style="display:flex; gap:10px; font-size:12.5px; padding:5px 0; border-top:1px solid var(--border);"><span style="font-weight:600;">${esc(p.part)}</span><span class="mono" style="color:var(--muted);">${esc(p.number)}</span><span class="tag ok" style="margin-left:auto; font-size:10.5px; padding:2px 8px;">${esc(p.status)}</span></div>`).join('')}` : ''}
      </div>
    </div>
    <div class="ai-narrative">${esc(r.narrative)}</div>`;

  new Chart($('#gauge'), {
    type: 'doughnut',
    data: { datasets: [{ data: [prob, 100 - prob], backgroundColor: [prob >= 50 ? PALETTE.red : prob >= 20 ? PALETTE.amber : PALETTE.green, '#1a2230'], borderWidth: 0, cutout: '74%' }] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } } },
  });
}
