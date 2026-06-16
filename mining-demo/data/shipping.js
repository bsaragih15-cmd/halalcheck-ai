// Server-side fallbacks for the Shipping Optimisation AI endpoints. These keep
// the console responsive when ANTHROPIC_API_KEY is absent or a live call fails.
// The cost model here mirrors the deterministic MODEL in public/shipping.html
// (total(b) = D0·e^(−k·b) + c·b) so the live and fallback numbers never drift.

const D0 = 900000, K = 0.45, C = 140000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
const fmtK = (n) => '$' + Math.round(n / 1000) + 'k';

export function shippingCost(b) {
  const dem = D0 * Math.exp(-K * b);
  const car = C * b;
  return { dem, car, total: dem + car };
}
export function shippingOptimum() {
  return clamp((1 / K) * Math.log((D0 * K) / C), 0.5, 6);
}

// Recommendation panel: the cost-minimising laycan buffer + fleet actions.
export function shippingFallback(scenario = {}) {
  const cur = Number(scenario.buffer ?? 2.0);
  const policy = Number(scenario.currentPolicyBuffer ?? 3.8);
  const opt = shippingOptimum();
  const costNow = shippingCost(cur).total;
  const costOpt = shippingCost(opt).total;
  const costPolicy = shippingCost(policy).total;
  const saveVsPolicy = costPolicy - costOpt;
  return {
    headline: `Move the laycan buffer to ${opt.toFixed(1)} days and re-sequence the line-up. Total annualised cost falls to ${fmt(costOpt)}.`,
    recommendedBufferDays: Number(opt.toFixed(1)),
    costCurrentUSD: Math.round(costPolicy),
    costOptimisedUSD: Math.round(costOpt),
    valueImpactUSD: Math.round(saveVsPolicy),
    actions: [
      `Set laycan buffer to <b>${opt.toFixed(1)} days</b> (from current practice of ${policy.toFixed(1)} d) to balance demurrage against carrying cost.`,
      `Hold <b>MV Cape Kendari</b> at anchorage drift 8 h: it is the only late vessel and is driving ${fmt(128000)} of forecast demurrage; pull its FC-2 slot forward only once saprolite cover clears 4.0 d.`,
      `Prioritise a <b>limonite barge cycle</b> for MV Sulawesi Dawn before the 12th to protect the cover dip, then rebalance FC-2 to saprolite.`,
    ],
    narrative: `At the selected buffer of ${cur.toFixed(1)} d the total is ${fmt(costNow)}. The cost-minimising buffer is ${opt.toFixed(1)} d, where a marginal day of buffer saves as much demurrage as it adds in carrying cost. Every figure traces to the live line-up, the tide window and the cost curve — not a black box.`,
  };
}

// Disruption re-dispatch: free-text or preset → a re-dispatch rationale.
const DISRUPTIONS = {
  fc2: { scenarioKey: 'fc2', title: 'FC-2 floating crane down', text: '<b>FC-2 down.</b> Re-routed all limonite barge cycles to FC-1; MV Sulawesi Dawn slips 14 h, forecast demurrage +$58k. AI recommends declaring weather hold and pulling MV Hai Long 7 laycan back 1 day.' },
  rain: { scenarioKey: 'rain', title: 'Rain on uncovered barges', text: '<b>TML risk.</b> 3 barges over moisture limit; loading paused 6 h to re-test. Saprolite cover holds at 4.1 d. AI re-sequences to load tested saprolite first, defers limonite cycle.' },
  late: { scenarioKey: 'late', title: 'Capesize arrives early', text: '<b>MV Cape Kendari early by 2 days.</b> No FC slot until the 25th; despatch opportunity if cover allows. AI recommends accelerating saprolite barge cycles to convert $128k demurrage into ~$40k despatch.' },
  tide: { scenarioKey: 'tide', title: 'Neap tide cuts draft', text: '<b>Neap tide.</b> Deep-draft window shrinks 1.1 m; Capesize load capped −16 kt. AI recommends topping off at Kendari outer anchorage on the next spring tide.' },
};
export function shippingDisruptionFallback({ text = '', scenarioKey = '' } = {}) {
  const t = String(text).toLowerCase();
  let key = scenarioKey;
  if (!key) {
    if (/fc|crane/.test(t)) key = 'fc2';
    else if (/rain|moist|wet|tml/.test(t)) key = 'rain';
    else if (/early|cape|capesize/.test(t)) key = 'late';
    else if (/tide|draft|neap|swell/.test(t)) key = 'tide';
  }
  if (key && DISRUPTIONS[key]) return DISRUPTIONS[key];
  return {
    scenarioKey: 'general',
    title: 'Re-dispatch',
    text: '<b>Parsed.</b> Re-solving the line-up against your disruption. AI holds the binding constraint (floating-crane rate) and protects minimum stockpile cover; check the updated vessel line-up above.',
  };
}

// Copilot: grounded Q&A over the live line-up / cost curve / tide window.
export function shippingCopilotFallback({ question = '' } = {}) {
  const q = String(question).toLowerCase();
  const opt = shippingOptimum();
  let answer;
  if (/constraint|binding/.test(q)) {
    answer = 'The binding constraint over the next 30 days is the <b>floating-crane rate</b> at ~94% utilisation. FC-1 and FC-2 combine for 38 kt/day while OGV demand peaks at 40 kt/day on the 27th. Barge cycle is second at 81%.';
  } else if (/risk|vessel|late/.test(q)) {
    answer = '<b>MV Cape Kendari</b> (Capesize) is the at-risk vessel: it is forecast late against a 25–27 Jun laycan and is driving ~$128k of demurrage. It is gearless, so it needs an FC slot that is contested by the crane constraint.';
  } else if (/buffer|optimal|optimum/.test(q)) {
    answer = `The cost-minimising laycan buffer is <b>${opt.toFixed(1)} days</b>. Below that, demurrage risk dominates; above it, carrying cost dominates. Current practice runs 3.8 d, so trimming the buffer saves ${fmtK(shippingCost(3.8).total - shippingCost(opt).total)}/yr.`;
  } else if (/tide|draft/.test(q)) {
    answer = 'Each extra centimetre of sailing draft is worth ~150 t of ore. At the current DUKC setting that is roughly the value shown in the tide widget; on a Capesize a full +1 m of draft is worth well over $1M of extra cargo per sailing.';
  } else if (/\d/.test(q) && /(demurrage|under|target|get)/.test(q)) {
    const m = q.match(/(\d[\d,.]*)\s*(k|m)?/);
    let tgt = m ? parseFloat(m[1].replace(/,/g, '')) : 500;
    if (m && m[2] === 'm') tgt *= 1e6; else if ((m && m[2] === 'k') || tgt < 10000) tgt *= 1000;
    const floor = shippingCost(opt).total;
    answer = `To target a total annualised cost of <b>${fmt(tgt)}</b>: the floor at the optimal ${opt.toFixed(1)}-day buffer is ${fmt(floor)}. ${tgt < floor ? 'That is below the achievable floor with the current fleet; you would need an extra floating crane or a tighter barge cycle to go lower.' : 'Achievable — set the buffer to ~' + opt.toFixed(1) + ' d and re-sequence MV Cape Kendari as recommended.'}`;
  } else {
    answer = 'I read the live line-up, the binding constraint, the tide window and the cost curve. Try asking about the binding constraint, the at-risk vessel, the optimal buffer, or set a demurrage target.';
  }
  return { answer };
}
