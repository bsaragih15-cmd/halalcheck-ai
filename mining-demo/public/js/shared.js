// OreSight AI — shared page utilities: nav/footer, API helper, AI badge,
// number tween, sparkline, Chart.js dark defaults.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// POST JSON with an automatic timeout. The AI endpoints can be slow (or stall),
// so we abort after `timeoutMs` and surface a clean error — every caller already
// wraps this in a try/catch that degrades to the deterministic fallback.
export async function postJSON(url, body, { timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function renderNav(active = '') {
  const el = document.createElement('header');
  el.className = 'nav';
  el.innerHTML = `
    <div class="container nav-inner">
      <a class="logo" href="/index.html"><span class="logo-mark">OS</span><span>Ore<em>Sight</em> AI</span></a>
      <nav class="nav-links">
        <a href="/index.html#matrix" ${active === 'matrix' ? 'class="active"' : ''}>Value Chain</a>
        <a href="/cockpit.html" ${active === 'cockpit' ? 'class="active"' : ''}>CEO Cockpit</a>
        <a href="/cockpit-montecarlo.html" ${active === 'cockpit-sim' ? 'class="active"' : ''}>Cockpit Sim</a>
        <a href="/portfolio-risk-engine.html" ${active === 'portfolio-risk' ? 'class="active"' : ''}>Portfolio Risk</a>
        <a href="/fsp.html" ${active === 'fsp' ? 'class="active"' : ''}>Scheduler (FSP)</a>
        <a href="/payload.html" ${active === 'payload' ? 'class="active"' : ''}>Payload</a>
        <a href="/blast.html" ${active === 'blast' ? 'class="active"' : ''}>Blast</a>
        <a href="/haul.html" ${active === 'haul' ? 'class="active"' : ''}>Hauling</a>
        <a href="/control-tower.html" ${active === 'control-tower' ? 'class="active"' : ''}>Control Tower</a>
        <a href="/maintenance.html" ${active === 'maintenance' ? 'class="active"' : ''}>Maintenance</a>
        <a href="/blending.html" ${active === 'blending' ? 'class="active"' : ''}>Blending</a>
        <a href="/safety.html" ${active === 'safety' ? 'class="active"' : ''}>Safety</a>
        <span class="ai-badge" id="aiBadge"><span class="dot"></span><span id="aiBadgeText">AI: …</span></span>
        <button class="btn-cta" onclick="document.getElementById('pilot')?.scrollIntoView({behavior:'smooth'}) || (location.href='/index.html#pilot')">Book a pilot</button>
      </nav>
    </div>`;
  document.body.prepend(el);
  initAIBadge();
}

export function renderFooter() {
  const el = document.createElement('footer');
  el.className = 'footer';
  el.innerHTML = `
    <div class="container footer-inner">
      <a class="logo" href="/index.html"><span class="logo-mark">OS</span><span>Ore<em>Sight</em> AI</span></a>
      <span>Operations Intelligence for Indonesian Mining</span>
      <span class="copy">PT OreSight Teknologi Indonesia · Treasury Tower, SCBD, Jakarta · © 2026</span>
    </div>`;
  document.body.append(el);
}

export async function initAIBadge() {
  const badge = $('#aiBadge');
  const text = $('#aiBadgeText');
  if (!badge) return;
  try {
    const { aiMode } = await (await fetch('/api/health')).json();
    badge.classList.add(aiMode === 'live' ? 'live' : 'demo');
    text.textContent = aiMode === 'live' ? 'AI: Live' : 'AI: Demo Mode';
  } catch {
    badge.classList.add('demo');
    text.textContent = 'AI: Demo Mode';
  }
}

// Tween a numeric text node toward a target value.
export function tween(el, to, { decimals = 0, duration = 600, suffix = '' } = {}) {
  const from = parseFloat(String(el.textContent).replace(/[^\d.-]/g, '')) || 0;
  const t0 = performance.now();
  function frame(t) {
    const k = Math.min(1, (t - t0) / duration);
    const v = from + (to - from) * (1 - Math.pow(1 - k, 3));
    el.textContent = v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (k < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Minimal SVG sparkline: fills an <svg> with a polyline of the data.
export function sparkline(svg, data, { stroke = 'var(--accent)' } = {}) {
  const w = 100, h = 30, pad = 2;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${pad + (i / (data.length - 1)) * (w - 2 * pad)},${h - pad - ((v - min) / span) * (h - 2 * pad)}`).join(' ');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/>`;
}

// Chart.js dark theme defaults (call once per page that uses charts).
export function chartDefaults() {
  if (!window.Chart) return;
  const C = window.Chart;
  C.defaults.color = '#6e7468';
  C.defaults.borderColor = 'rgba(29, 37, 31, 0.08)';
  C.defaults.font.family = "'Inter', system-ui, sans-serif";
  C.defaults.font.size = 11;
  C.defaults.plugins.legend.labels.boxWidth = 12;
  C.defaults.plugins.legend.labels.boxHeight = 12;
  C.defaults.animation.duration = 400;
}

// Light-theme chart palette. Keys are kept from the original dark theme so
// per-case chart configs keep working: "amber" is now the warm secondary tone
// and "green" doubles as the primary brand accent.
export const PALETTE = {
  amber: '#b45309',
  green: '#15803d',
  red: '#b91c1c',
  cyan: '#0e7490',
  muted: '#a8a699',
};

// Render an AI result ({headline, recommendations, valueImpactUSD, narrative})
// into a container as an .ai-panel body.
export function renderAIResult(el, r) {
  const recs = (r.recommendations || []).map((rec, i) => `
    <div class="ai-rec">
      <div class="n">${String(i + 1).padStart(2, '0')}</div>
      <div><div class="a">${esc(rec.action)}</div>
      <div class="meta"><b>${esc(rec.impact)}</b> · ${esc(rec.timeframe)}</div></div>
    </div>`).join('');
  el.innerHTML = `
    <div class="ai-panel-head"><span class="spark">✦</span><span class="t">OreSight AI Recommendation</span>
      <span class="src">${r.source === 'live' ? 'claude · live inference' : 'OreSight engine'}</span></div>
    <div class="ai-headline">${esc(r.headline)}</div>
    ${recs}
    ${r.valueImpactUSD ? `<div class="ai-value"><span class="v">$${Number(r.valueImpactUSD).toLocaleString('en-US')}</span><span class="l">estimated annualised value impact</span></div>` : ''}
    ${r.narrative ? `<div class="ai-narrative">${esc(r.narrative)}</div>` : ''}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function setLoading(btn, on, label = 'Analyzing…') {
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${label}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.label || btn.innerHTML;
  }
}
