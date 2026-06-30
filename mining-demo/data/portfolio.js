// Deterministic fallbacks for the Portfolio Control Tower AI layer.
// These mirror the JSON the live model returns, derived from the portfolio
// state the client posts, so the Board Read and Scenario Copilot stay credible
// with no ANTHROPIC_API_KEY / on timeout (the "simulated" mode).

const pickName = (s) => (s.nm || s.id || 'an asset');

// ── AI Board Read — group-level narrative over Tier 0/1 state ──
export function boardReadFallback(body = {}) {
  const g = body.group || {};
  const subs = Array.isArray(body.subs) ? body.subs : [];
  const risk = subs.filter((s) => s.status === 'red');
  const watch = subs.filter((s) => s.status === 'amber');
  const on = subs.filter((s) => s.status === 'green');
  const rev = g.revenue ?? 145.2;
  const yoy = g.revenueYoY ?? 34.6;

  const riskName = risk[0] ? pickName(risk[0]) : null;
  const lowCost = subs.filter((s) => (s.quartile ?? 4) <= 1).map(pickName);
  const highCost = subs.filter((s) => (s.quartile ?? 1) >= 4).map(pickName);

  const headline =
    `Record group revenue (Rp ${rev}T, +${yoy}%), but the quality is uneven — ` +
    `${on.length} on track, ${watch.length} on watch, ${risk.length} carrying real risk.`;

  const read =
    `Group revenue hit Rp ${rev}T (+${yoy}% YoY) and contribution to the State reached Rp ${g.stateContribution ?? 90.4}T, ` +
    `but the headline flatters the mix. ` +
    (riskName
      ? `${riskName} is the concentration of risk — it is the biggest profit driver yet sits under a live operational disruption. `
      : '') +
    (highCost.length
      ? `${highCost.join(' and ')} ${highCost.length > 1 ? 'are' : 'is'} high on the cost curve (Q4), so margin — not the top line — is the thing to watch there. `
      : '') +
    (lowCost.length
      ? `${lowCost.join(' and ')} ${lowCost.length > 1 ? 'are' : 'is'} first-quartile and resilient through the cycle.`
      : '');

  const watchlist = [];
  for (const s of risk) watchlist.push({ asset: pickName(s), why: s.note || 'flagged RISK — operational/financial tail risk' });
  for (const s of watch) watchlist.push({ asset: pickName(s), why: s.note || 'flagged WATCH — margin or price pressure' });

  const oneThing = riskName
    ? `Stress the group cash floor against a shock to ${riskName.split(' ')[0]} and its commodity — that single asset is where the portfolio is most concentrated.`
    : `Re-run the cash-floor stress test on the weakest two assets; the rest of the book is comfortable.`;

  return {
    headline,
    read,
    watchlist: watchlist.slice(0, 3),
    oneThing,
    posture: risk.length ? 'WATCHFUL' : watch.length ? 'BALANCED' : 'CONSTRUCTIVE',
  };
}

// ── Scenario Copilot — parse a natural-language shock into driver deltas + read ──
const COMMODITIES = [
  { key: 'copper', words: ['copper', 'cu', 'freeport', 'grasberg', 'ptfi'], asset: 'Freeport Indonesia', protect: true },
  { key: 'nickel', words: ['nickel', 'ni', 'antam', 'ferronickel'], asset: 'Antam', protect: false },
  { key: 'coal', words: ['coal', 'thermal', 'bukit asam', 'ptba', 'hba'], asset: 'Bukit Asam', protect: false },
  { key: 'aluminium', words: ['aluminium', 'aluminum', 'alumina', 'inalum'], asset: 'Inalum', protect: true },
  { key: 'tin', words: ['tin', 'sn', 'timah'], asset: 'Timah', protect: false },
  { key: 'gold', words: ['gold', 'au', 'bullion'], asset: 'Antam', protect: true },
];

function parsePct(q, idx) {
  // Find the % figure tied to the keyword at `idx`. Prefer the closest match that
  // comes AFTER the keyword within ~28 chars ("copper -30%", "rupiah weakens 10%");
  // otherwise fall back to the globally nearest ("30% drop in copper").
  const re = /([+-]?\d{1,3})\s*%/g;
  const all = [];
  let m;
  while ((m = re.exec(q))) all.push(m);
  if (!all.length) return null;
  let best = null, bestDist = 1e9;
  for (const mm of all) { if (mm.index >= idx && mm.index - idx < 28) { const d = mm.index - idx; if (d < bestDist) { bestDist = d; best = mm; } } }
  if (!best) { bestDist = 1e9; for (const mm of all) { const d = Math.abs(mm.index - idx); if (d < bestDist) { bestDist = d; best = mm; } } }
  if (!best) return null;
  let v = Number(best[1]);
  const ctx = q.slice(Math.max(0, idx - 30), idx + 30);
  if (/(down|fall|drop|weaken|lower|−|minus|slump|crash|−)/.test(ctx) && v > 0) v = -v;
  if (/(up|rise|rally|stronger|gain|higher|surge|jump)/.test(ctx) && best[1][0] !== '-' && v < 0) v = Math.abs(v);
  return v;
}

export function scenarioFallback(body = {}) {
  const q = String(body.query || '').toLowerCase();
  const drivers = [];
  const exposed = [];

  // commodities
  for (const c of COMMODITIES) {
    const idx = c.words.map((w) => q.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (idx === undefined) continue;
    const pct = parsePct(q, idx);
    if (pct === null) continue;
    drivers.push({ name: c.key[0].toUpperCase() + c.key.slice(1) + ' price', change: `${pct > 0 ? '+' : ''}${pct}%` });
    const down = pct < 0;
    exposed.push({
      asset: c.asset,
      effect: down
        ? (c.key === 'copper'
            ? `${c.asset} net cash cost is ~$0/lb (gold credits), so it stays cash-positive even on a ${Math.abs(pct)}% fall — but the group's largest earnings stream shrinks`
            : `${c.asset} margin compresses; if it is high on the cost curve a ${Math.abs(pct)}% fall can push it underwater and toward curtailment`)
        : `${c.asset} earnings lift with the ${pct}% move`,
      severity: down ? (c.protect ? 'medium' : 'high') : 'positive',
    });
  }

  // FX (rupiah)
  const fxIdx = [q.indexOf('rupiah'), q.indexOf('idr'), q.indexOf('usd/idr'), q.indexOf('currency'), q.indexOf('fx')].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (fxIdx !== undefined) {
    const pct = parsePct(q, fxIdx);
    if (pct !== null) {
      const weaker = /weak|depreciat|fall|down|lower/.test(q.slice(Math.max(0, fxIdx - 25), fxIdx + 25)) || pct > 0;
      drivers.push({ name: 'USD/IDR', change: `${weaker ? '+' : '-'}${Math.abs(pct)}% (rupiah ${weaker ? 'weaker' : 'stronger'})` });
      exposed.push({ asset: 'Group (USD revenue)', effect: weaker ? `A weaker rupiah flatters reported IDR earnings on USD-priced exports, partly offsetting commodity weakness — but adds variance` : `A stronger rupiah trims reported IDR earnings`, severity: weaker ? 'positive' : 'medium' });
    }
  }

  const anyDown = exposed.some((e) => e.severity === 'high');
  const verdict = anyDown ? 'ACT' : exposed.some((e) => e.severity === 'medium') ? 'WATCH' : drivers.length ? 'HOLD' : 'UNCLEAR';

  const impact = drivers.length
    ? `Modelled shock: ${drivers.map((d) => `${d.name} ${d.change}`).join(', ')}. ` +
      `The group's exposure is concentrated — Freeport (copper) is the largest earnings stream but sits at ~$0/lb net cash cost, so it absorbs price falls better than the high-cost assets. ` +
      `${anyDown ? 'At least one asset is pushed toward curtailment — run the full cash-floor stress to size the dividend impact.' : 'Cash cover likely holds, but confirm against the board floor in the Stress Test.'}`
    : `I couldn't read a specific shock from that. Try e.g. "copper −30% and rupiah weakens 10%" or "coal falls 20%".`;

  return { drivers, exposed: exposed.slice(0, 4), verdict, impact };
}
