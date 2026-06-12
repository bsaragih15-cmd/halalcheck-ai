// Renders the interactive value-chain matrix on index.html from usecases.js.
import { STAGES, VALUE_DRIVERS, MATRIX_ROWS, USE_CASES } from './usecases.js';

function hrefFor(id) {
  const uc = USE_CASES[id];
  return uc?.href || `/demo.html?case=${id}`;
}

function cellHTML(id, { compact = false } = {}) {
  const uc = USE_CASES[id];
  if (!uc) return '';
  const badges = (uc.drivers || []).map((d) => {
    const v = VALUE_DRIVERS[d];
    return `<span class="vd ${v.cls}" title="${v.label}">${v.icon}</span>`;
  }).join('');
  const cls = ['matrix-cell'];
  if (id === 'safety') cls.push('hse-cell');
  if (uc.flagship && (uc.stage === 'Cross-chain')) cls.push('center');
  return `
    <a class="${cls.join(' ')}" href="${hrefFor(id)}" ${compact ? 'style="min-height:0"' : ''}>
      ${uc.flagship ? '<span class="flag-tag">LIVE DEMO</span>' : badges ? `<span class="vd-badges">${badges}</span>` : ''}
      <span class="t">${uc.title}</span>
      ${compact ? '' : `<span class="d">Decisions: ${uc.decisions}</span>`}
      <span class="launch">Launch demo →</span>
    </a>`;
}

export function renderMatrix(root) {
  let html = '';

  // Header row: empty corner over the horizon column + 10 stage chevrons
  html += '<div></div>';
  for (const s of STAGES) {
    html += `<div class="chevron"><span class="ic">${s.icon}</span>${s.label}</div>`;
  }

  for (const row of MATRIX_ROWS) {
    html += `<div class="horizon-label ${row.horizon === 'HSE' ? 'hse' : ''}">${row.horizon}</div>`;
    for (const cell of row.cells) {
      const [a, b] = cell.span;
      const style = `grid-column: ${a + 1} / ${b + 2};`;
      if (cell.stack) {
        html += `<div class="cell-stack" style="${style}">${cell.stack.map((id) => cellHTML(id, { compact: true })).join('')}</div>`;
      } else {
        html += `<div style="${style}; display:flex; flex-direction:column;">${cellHTML(cell.case)}</div>`;
      }
    }
  }

  root.innerHTML = html;
}

export function renderLegend(root) {
  root.innerHTML = `
    <span class="item"><b style="color:var(--text); font-size:12px">Primary value driver:</b></span>
    ${Object.values(VALUE_DRIVERS).map((v) => `<span class="item"><span class="vd ${v.cls}">${v.icon}</span>${v.label}</span>`).join('')}
    <span class="item"><span class="flag-tag" style="position:static">LIVE DEMO</span> flagship interactive demo</span>`;
}
