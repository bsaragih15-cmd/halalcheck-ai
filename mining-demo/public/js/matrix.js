// Renders the interactive value-chain matrix on index.html from usecases.js.
// Light wireframe style: chevron stages, mono horizon labels, LIVE DEMO /
// IN DEV badges, plain value-driver glyphs.
import { STAGES, VALUE_DRIVERS, MATRIX_ROWS, USE_CASES } from './usecases.js';

// Cells carrying the solid green LIVE DEMO badge (the deep interactive demos).
const LIVE = new Set(['command-center', 'maintenance', 'blending', 'haul', 'payload', 'blast', 'marketing']);

function hrefFor(id) {
  const uc = USE_CASES[id];
  return uc?.href || `/demo.html?case=${id}`;
}

const badgeHTML = (id) => LIVE.has(id)
  ? '<span class="badge-live">▶ LIVE DEMO</span>'
  : '<span class="badge-indev">IN DEV</span>';

const driversHTML = (uc) => (uc.drivers || [])
  .map((d) => `<span class="vdg ${VALUE_DRIVERS[d].cls}" title="${VALUE_DRIVERS[d].label}">${VALUE_DRIVERS[d].icon}</span>`)
  .join(' ');

function cellHTML(id, fullRow) {
  const uc = USE_CASES[id];
  if (!uc) return '';
  const live = LIVE.has(id);
  if (fullRow) {
    return `
      <a class="matrix-cell row-cell ${live ? 'live' : ''}" href="${hrefFor(id)}">
        <span class="rc-main">
          <span class="rc-text"><span class="t">${uc.title}</span><span class="d">${uc.decisions}</span></span>
          ${badgeHTML(id)}
        </span>
        <span class="vd-icons rc-right">${driversHTML(uc)}</span>
      </a>`;
  }
  return `
    <a class="matrix-cell ${live ? 'live' : ''}" href="${hrefFor(id)}">
      <span class="cell-top"><span class="t">${uc.title}</span><span class="vd-icons">${driversHTML(uc)}</span></span>
      <span class="d">${uc.decisions}</span>
      <span class="cell-badge">${badgeHTML(id)}</span>
    </a>`;
}

export function renderMatrix(root) {
  let html = '<div></div>'; // corner spacer over the horizon column
  STAGES.forEach((s, i) => {
    html += `<div class="chevron ${i === 0 ? 'first' : ''}">${s.label}</div>`;
  });

  for (const row of MATRIX_ROWS) {
    html += `<div class="horizon-label">${row.horizon}</div>`;
    for (const cell of row.cells) {
      const [a, b] = cell.span;
      const fullRow = a === 1 && b === 10;
      html += `<div style="grid-column: ${a + 1} / ${b + 2}; display:flex; flex-direction:column;">${cellHTML(cell.case, fullRow)}</div>`;
    }
  }
  root.innerHTML = html;
}

export function renderLegend(root) {
  root.innerHTML = `
    <span class="item mono-label">PRIMARY VALUE DRIVER</span>
    ${Object.values(VALUE_DRIVERS).map((v) => `<span class="item"><span class="vdg ${v.cls}">${v.icon}</span>${v.label}</span>`).join('')}
    <span class="item" style="margin-left:auto;"><span class="leg-dot live"></span>Live demo</span>
    <span class="item"><span class="leg-dot"></span>In development</span>`;
}
