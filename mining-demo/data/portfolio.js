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

// ── Capital Copilot — grounded Q&A over the capital-allocation state ──
export function capitalCopilotFallback(body = {}) {
  const t = String(body.question || '').toLowerCase();
  const m = (...ks) => ks.some((k) => t.includes(k));
  let answer;
  if (m('source', 'come from', 'generated', 'generate', 'where did the cash', 'inflow'))
    answer = "The cash came from <b>Rp 40.5T EBITDA</b>; after ~Rp 9T tax & interest and Rp 2T working capital that's <b>Rp 29.5T of operating cash</b>. A further <b>Rp 5T was drawn from debt</b> to help fund the build.";
  else if (m('deploy', 'allocat', 'where did it go', 'spent', 'spend', 'use of', 'uses', 'outflow'))
    answer = 'Of the Rp 29.5T operating cash: <b>Rp 11.5T sustaining capex</b>, <b>Rp 12T growth capex</b> (Manyar + SGAR), and <b>Rp 9T dividend</b> to the State — leaving ~Rp 2T retained after the Rp 5T debt draw.';
  else if (m('return', 'roic', 'wacc', 'cost of capital', 'economic profit', 'value creat', 'earning its'))
    answer = 'Only <b>Freeport</b> clearly out-earns its cost of capital (ROIC ~14% vs ~10% → <b>+Rp 6.8T</b> economic profit). Coal & nickel capital is underwater this year — Bukit Asam −Rp 0.7T, Antam −Rp 1.2T. Group economic profit <b>+Rp 5.3T, ~96% from Freeport</b>.';
  else if (m('freeport', 'ptfi', 'grasberg', 'concentr'))
    answer = '<b>Freeport</b> ties up ~<b>Rp 170T (63%)</b> of group capital and earns ROIC ~14% → <b>+Rp 6.8T</b> economic profit — the value engine, but ~80% of profit and under force majeure.';
  else if (m('debt', 'leverage', 'gearing', 'afford', 'borrow'))
    answer = 'Net debt/EBITDA is <b>~0.8×</b>, up from 0.7× on the Rp 5T draw — low, with wide headroom to a ~2.0× comfort line. Growth + dividend (Rp 21T) outrun FCF (Rp 18T), so the gap is debt-funded; affordable, but a soft-price year tightens it.';
  else if (m('dividend', 'payout', 'to state', 'shareholder'))
    answer = "The dividend was <b>Rp 9T</b>, covered <b>2.0×</b> by FCF — self-funded. It's the committed claim, protected ahead of the discretionary growth spend.";
  else if (m('pipeline', 'manyar', 'sgar', 'build', 'project', 'when', 'smelter', 'first prod', 'irr'))
    answer = 'The Rp 12T build: <b>Manyar smelter Rp 5.5T</b> (95%, first cathode 2024, IRR ~14%), <b>SGAR alumina Rp 3.5T</b> (85%, 2025, ~13%), <b>Grasberg underground Rp 2.0T</b> (ramping), and Rp 1T smelters/debottleneck.';
  else if (m('conversion', 'fcf/ebitda', 'quality of cash'))
    answer = 'Cash conversion (FCF/EBITDA) is <b>44%</b> — earnings convert to cash; the downstreaming build, not margin, is what holds FCF below plan.';
  else if (m('reinvest', 'over time', 'trend', 'history', 'build phase'))
    answer = 'Reinvestment is <b>80%</b> of operating cash (Rp 23.5T capex). Growth capex has tripled — <b>Rp 4T → Rp 12T</b> over five years — now the single biggest use of cash.';
  else if (m('risk', 'concern', 'worry', 'watch', 'weak'))
    answer = 'The watch item is <b>concentration</b>: ~96% of economic profit and ~63% of capital sit in Freeport, which is under force majeure. Coal & nickel capital earns below its cost of capital this year.';
  else if (m('summar', 'overview', 'insight', 'read', 'sound', 'how are we', 'tell me'))
    answer = 'The group turned <b>Rp 29.5T</b> of operating cash into <b>Rp 23.5T</b> of capex and <b>Rp 9T</b> of dividends; FCF covers the dividend <b>2.0×</b>, but the <b>Rp 12T build</b> is part debt-funded. Only Freeport clearly beats its cost of capital (<b>+Rp 6.8T</b>, ~96% of the group). Leverage stays low (~0.8×); the watch item is concentration.';
  else
    answer = 'I can answer on the <b>sources</b> & <b>uses</b> of cash, <b>returns vs cost of capital</b>, the <b>debt draw / leverage</b>, the <b>dividend</b>, or the <b>growth pipeline</b>. Try one of those, or ask about a specific subsidiary.';
  return { answer };
}

// ── Operations Copilot — company-aware Q&A over the physical operational state ──
const OPSFACT = {
  ptfi: "<b>Freeport</b> is the group's one impaired asset: the Sep-2025 <b>Grasberg mud rush</b> puts it under <b>force majeure</b>, cutting 2026 output ~35% with ramp recovery through the year. FY24 output ~89% of plan, LTIFR 0.42, 0 fatalities, mine life ~25 yr. Its Manyar copper smelter is 95% complete (commissioning, first cathode 2024).",
  antam: '<b>Antam</b> is <b>constrained</b>: RKEF ferronickel runs below nameplate (20.1k of 22.5k TNi) — high-cost, curtailment under review. Output ~89% of plan, LTIFR 0.38, 0 fatalities, mine life ~20 yr. Co-owns the SGAR alumina refinery (85% complete, first alumina 2025).',
  ptba: '<b>Bukit Asam</b> is <b>running well</b>: record 43.3 Mt, strip ratio beat (6.23× vs 6.44×), output 101% of plan. LTIFR 0.55, 0 fatalities, mine life ~18 yr.',
  inalum: '<b>Inalum</b> is the cleanest operational performer — <b>running</b> at +27% volume (127% of plan) toward ~900 kt, captive Asahan hydro, LTIFR 0.30 (best), 0 fatalities. A smelter, so no reserve base; leads the SGAR build.',
  timah: "<b>Timah</b> is <b>running</b> (refined tin +23%, 123% of plan, LTIFR 0.61, 0 fatalities), but its <b>~14-yr reserve life</b> is the structural watch — depleting faster than it replaces.",
};
export function opsCopilotFallback(body = {}) {
  const t = String(body.question || '').toLowerCase();
  const re = (x) => new RegExp(x).test(t);
  const map = { ptfi: ['freeport', 'ptfi', 'grasberg', 'manyar'], antam: ['antam', 'antm', 'ferronickel', 'feni', 'sgar'], ptba: ['bukit', 'ptba', 'coal'], inalum: ['inalum', 'alumin'], timah: ['timah', 'tins', 'tin'] };
  for (const id in map) if (map[id].some((k) => t.includes(k))) return { answer: OPSFACT[id] };
  let answer;
  if (re('safe|ltifr|fatal|injur')) answer = 'Safety: <b>zero fatalities</b> across the portfolio. LTIFR runs 0.30 (Inalum, best) to 0.61 (Timah); Freeport 0.42, Bukit Asam 0.55, Antam 0.38.';
  else if (re('reserve|mine life|deplet|last|how long')) answer = 'Mine life: Freeport ~25 yr, Antam ~20 yr, Bukit Asam ~18 yr, <b>Timah ~14 yr — the depletion watch</b>. Inalum is a smelter (no reserve base).';
  else if (re('build|project|construct|smelter|first prod')) answer = 'Growth build: <b>Manyar Cu smelter 95%</b> (commissioning, first cathode 2024), <b>SGAR alumina 85%</b> (construction, 2025), Grasberg underground ramping (70%), smelters/debottleneck 55%.';
  else if (re('disrupt|broken|impair|force majeure|outage')) answer = 'Only two assets are off-nominal: <b>Freeport</b> (force majeure — Grasberg mud rush, 2026 ~−35%) and <b>Antam</b> (FeNi below nameplate). The rest are running, several at records.';
  else if (re('output|production|deliver|plan|volume')) answer = 'Output vs plan: Inalum 127%, Timah 123%, Bukit Asam 101% (above); <b>Freeport 89%</b> (mud rush) and <b>Antam 89%</b> (FeNi) below.';
  else if (re('summar|overview|status|how are|fleet|everything')) answer = 'Operationally the fleet runs well — records at Bukit Asam, Inalum and Timah. Exceptions: <b>Freeport</b> under force majeure and <b>Antam</b> constrained. Zero fatalities; Timah\'s ~14-yr reserve life is the one structural watch.';
  else answer = 'Ask me about a specific company — <b>Freeport, Bukit Asam, Antam, Inalum, or Timah</b> — or about safety, reserves, the growth build, or disruptions across the fleet.';
  return { answer };
}
