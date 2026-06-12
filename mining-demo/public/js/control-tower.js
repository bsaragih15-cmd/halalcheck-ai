// Control Tower flagship — live chain status, event feed, disruption scenario.
import { renderNav, renderFooter, postJSON, renderAIResult, chartDefaults, setLoading, tween, PALETTE, esc, $ } from './shared.js';
import { Stream, mulberry32, opsEvent, witaTime } from './sim.js';

renderNav('control-tower');
renderFooter();
chartDefaults();

setInterval(() => { $('#witaClock').textContent = witaTime(); }, 1000);
$('#witaClock').textContent = witaTime();

// ── Chain strip ───────────────────────────────────────────────────────────────
const CHAIN = [
  { nm: 'Exploration', vl: () => '4 rigs', st: 'ok' },
  { nm: 'Pre-strip', vl: () => (420 + Math.random() * 60).toFixed(0) + ' bcm/h', st: 'ok' },
  { nm: 'Drill & Blast', vl: () => '2 blasts/d', st: 'ok' },
  { nm: 'Excavate', vl: () => (1900 + Math.random() * 200).toFixed(0) + ' t/h', st: 'ok' },
  { nm: 'Load & Haul', vl: () => '6/6 trucks', st: 'warn', note: 'HT-104 watch' },
  { nm: 'Processing', vl: () => (305 + Math.random() * 12).toFixed(0) + ' t/h', st: 'ok' },
  { nm: 'Hauling', vl: () => (38 + Math.random() * 4).toFixed(1) + ' kt/d', st: 'ok' },
  { nm: 'Port', vl: () => '438 kt', st: 'ok' },
  { nm: 'Shipping', vl: () => '1 loading', st: 'ok' },
  { nm: 'Marketing', vl: () => '$16.5k/t', st: 'ok' },
];

function renderChain() {
  $('#chainStrip').innerHTML = CHAIN.map((c) => `
    <div class="chain-tile" title="${c.note || ''}">
      <div class="nm">${c.nm}</div>
      <div class="vl">${c.vl()}</div>
      <div class="st"><span class="status-dot ${c.st}"></span></div>
    </div>`).join('');
}
renderChain();
setInterval(renderChain, 2000);

// ── Flow chart ────────────────────────────────────────────────────────────────
const mineFlow = new Stream({ base: 1980, drift: 0, noise: 70, period: 14, amp: 160, seed: 501 }, 50);
const portFlow = new Stream({ base: 1760, drift: 0, noise: 80, period: 18, amp: 140, seed: 502 }, 50);
const flowChart = new Chart($('#flowChart'), {
  type: 'line',
  data: { labels: mineFlow.data.map((_, i) => i), datasets: [
    { label: 'Ex-pit', data: [...mineFlow.data], borderColor: PALETTE.amber, borderWidth: 2, pointRadius: 0, tension: 0.35 },
    { label: 'Port intake', data: [...portFlow.data], borderColor: PALETTE.cyan, borderWidth: 2, pointRadius: 0, tension: 0.35 },
  ]},
  options: { scales: { x: { display: false } } },
});
setInterval(() => {
  mineFlow.tick(); portFlow.tick();
  flowChart.data.datasets[0].data = [...mineFlow.data];
  flowChart.data.datasets[1].data = [...portFlow.data];
  flowChart.update('none');
  const mv = $('#kMoved');
  tween(mv, parseFloat(mv.textContent.replace(/,/g, '')) + 30 + Math.random() * 40, { decimals: 0 });
}, 2000);

// ── Event feed ────────────────────────────────────────────────────────────────
const rnd = mulberry32(20260612);
const feedEl = $('#feed');
function pushEvent() {
  const e = opsEvent(rnd);
  const item = document.createElement('div');
  item.className = `feed-item ${e.kind}`;
  item.innerHTML = `<span class="ts">${witaTime()}</span><span class="msg">${esc(e.msg)}</span>`;
  feedEl.prepend(item);
  while (feedEl.children.length > 14) feedEl.lastChild.remove();
}
for (let i = 0; i < 7; i++) pushEvent();
setInterval(pushEvent, 3500);

// ── Disruption mitigation ─────────────────────────────────────────────────────
$('#mitigateBtn').addEventListener('click', async () => {
  const btn = $('#mitigateBtn');
  const panel = $('#aiPanel');
  setLoading(btn, true, 'Building mitigation plan…');
  panel.style.display = '';
  panel.classList.add('loading-shimmer');
  panel.innerHTML = `<div class="ai-panel-head"><span class="spark">✦</span><span class="t">OreSight AI — Command Center</span></div><div style="color:var(--muted); font-size:13.5px;">Evaluating pit access, blend, crusher buffer and shipping impacts…</div>`;
  try {
    const r = await postJSON('/api/usecase/analyze', {
      caseId: 'control-tower',
      scenario: {
        disruption: 'Heavy rainfall warning — Pit 2 (BMKG orange alert)',
        leadTimeHours: 3, forecastRainMm: '60–90 over 6 h',
        exposure: 'Pit 2 ramp + south wall; active loading area below bench 145',
        currentState: { exPitTph: Math.round(mineFlow.last()), portStockKt: 438, vesselsQueued: 2, blendTarget: '1.80% Ni' },
      },
    });
    renderAIResult(panel, r);
    const note = document.createElement('div');
    note.style.cssText = 'margin-top:12px; font-size:12px; color:var(--muted);';
    note.innerHTML = '↳ Cross-referenced: <a href="/maintenance.html" style="color:var(--amber)">HT-104 maintenance alert</a> and <a href="/production.html" style="color:var(--amber)">blend console</a> reflect this plan.';
    panel.appendChild(note);
  } catch (e) {
    panel.innerHTML = `<div style="color:var(--red); font-size:13.5px;">${esc(e.message)}</div>`;
  } finally {
    panel.classList.remove('loading-shimmer');
    setLoading(btn, false);
  }
});

// 24h cell deep link (#disruptions) — highlight the alert briefly
if (location.hash === '#disruptions') {
  setTimeout(() => {
    const el = $('#disruptions');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.5)';
    setTimeout(() => { el.style.boxShadow = ''; }, 2200);
  }, 300);
}
