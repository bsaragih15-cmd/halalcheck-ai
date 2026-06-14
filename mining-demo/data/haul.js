// Server-side fallback for the Hauling Optimisation AI endpoint. Returns the
// re-dispatch rationale for a given scenario when ANTHROPIC_API_KEY is absent
// or a live call fails, so the console always responds. The client carries the
// full deterministic copy and only swaps in live AI text when available, so
// this stays concise.

const BY_SCENARIO = {
  'truck-down': {
    headline: 'HT-105 down — delivered 1,815 t/h, 85 below the 1,900 demand line. Re-balance recovers it.',
    bindingConstraint: 'fleet',
    currentRateTph: 1815,
    optimisedRateTph: 1900,
    matchFactor: 0.92,
    recommendations: [
      { action: 'Re-balance fleet 5/3 across loaders', impact: '+85 t/h, queue −2 min/cyc', timeframe: 'now' },
      { action: 'Stagger HT-103 refuel to 11:40', impact: 'holds feed above demand line', timeframe: '+25 min' },
      { action: 'Flag HT-105 cycle-time outlier to Maintenance', impact: 'pre-empts a second failure', timeframe: 'this shift' },
    ],
    valueImpactUSD: 1900000,
    narrative: 'A single truck loss pushes the fleet under-trucked (MF 0.92), starving the loaders and dipping delivery 85 t/h below the barge demand. Reassigning the LD-2 spare and ending one crib break early restores match factor to ~1.0 and lifts delivery back to the 1,900 line, protecting the coupled barge’s laycan window.',
  },
  'loader-down': {
    headline: 'LD-2 down — single-loader cap holds delivery to ~1,740 t/h. Hold trucks to kill the queue.',
    bindingConstraint: 'loader',
    currentRateTph: 1560,
    optimisedRateTph: 1740,
    matchFactor: 1.28,
    recommendations: [
      { action: 'Hold 3 trucks — run LD-1 at MF 1.0', impact: 'queue 6→2 min/cyc, +180 t/h recovered', timeframe: 'now' },
      { action: 'Expedite LD-2 repair', impact: 'restores +180 t/h marginal capacity', timeframe: 'ETA 90 min' },
      { action: 'Surge payload to policy ceiling on LD-1', impact: '+40 t/h within 10/10/20', timeframe: 'now' },
    ],
    valueImpactUSD: 4200000,
    narrative: 'With LD-2 out, the loader becomes the binding constraint: nine trucks chasing one loader drives MF to 1.28 and bunches the queue, yet delivery is capped at single-loader capacity (~1,740 t/h). Holding three trucks as spares restores MF to ~1.0 and cuts queue loss; the only path past 1,740 is bringing LD-2 back, worth +180 t/h marginal. Hopper buffer is the live risk at 5 minutes.',
  },
  'road-wet': {
    headline: 'Ramp wet — cycle time +2.4 min stretches the haul-road to the binding constraint.',
    bindingConstraint: 'haul-road',
    currentRateTph: 1735,
    optimisedRateTph: 1880,
    matchFactor: 0.97,
    recommendations: [
      { action: 'Schedule watering passes off-peak', impact: 'dust control without traction loss, +90 t/h', timeframe: 'now' },
      { action: 'Cap ramp speed at 22 km/h', impact: 'protects TKPH, fuel −0.4 L/t', timeframe: 'now' },
      { action: 'Trim payload to 88 t on wet cycles', impact: 'tyre-failure risk down, holds cadence', timeframe: 'until ramp dries' },
    ],
    valueImpactUSD: 2600000,
    narrative: 'Watering the wet 8% ramp protects against dust but cuts traction, stretching cycle time and pushing the haul-road to 96% — the binding constraint. Capping ramp speed at 22 km/h and trimming payload to 88 t protects tyre TKPH in wet-season heat while recovering ~145 t/h. The loaders and hopper still have slack, so the road is where the AI spends its moves.',
  },
  'demand-surge': {
    headline: 'Laycan-critical barge — surge the fleet to build buffer ahead of the load window.',
    bindingConstraint: 'fleet',
    currentRateTph: 2080,
    optimisedRateTph: 2150,
    matchFactor: 1.04,
    recommendations: [
      { action: 'Surge all 9 trucks, defer crib breaks', impact: '+70 t/h, builds hopper buffer pre-window', timeframe: 'now → load window' },
      { action: 'Accept +0.3 L/t fuel to chase demand', impact: 'demurrage protection outweighs fuel', timeframe: 'this barge' },
      { action: 'Pre-build hopper to 80% before swell', impact: 'covers forecast 14:00 swell stall', timeframe: '+2 h' },
    ],
    valueImpactUSD: 5600000,
    narrative: 'A laycan-critical barge lifts loadout demand, making the fleet the binding constraint at full surge (~2,150 t/h achievable). The AI deploys all nine trucks, defers crib breaks, and pre-builds the hopper to 80% ahead of the load window and a forecast 14:00 swell — accepting a small fuel-per-tonne penalty because protected demurrage on the coupled barge dwarfs it.',
  },
  'optimise': {
    headline: 'Delivered 1,985 t/h vs 1,900 demand — meeting demand with 4% headroom.',
    bindingConstraint: 'fleet',
    currentRateTph: 1985,
    optimisedRateTph: 2010,
    matchFactor: 1.01,
    recommendations: [
      { action: 'Stagger refuels & crib breaks', impact: 'keeps feed above demand, +25 t/h', timeframe: 'rolling' },
      { action: 'Hold MF in 0.98–1.03 band', impact: 'queue under 2 min/cyc', timeframe: 'continuous' },
      { action: 'Bank hopper buffer to 75% pre-shift-change', impact: 'covers 19:00 handover gap', timeframe: '+3 h' },
    ],
    valueImpactUSD: 2400000,
    narrative: 'The circuit is running balanced — MF 1.01, delivery 4% above the barge demand line, hopper buffer a healthy 13 minutes. The AI’s moves here are about banking headroom: staggering refuels and trimming match factor toward 1.0 keep the queue minimal and pre-build buffer ahead of the 19:00 shift handover.',
  },
};

export function haulFallback({ disruptionId } = {}) {
  return BY_SCENARIO[disruptionId] || BY_SCENARIO['optimise'];
}

// NL disruption → a scenario the deterministic engine can run (heuristic fallback).
export function haulParseFallback(text = '') {
  const t = String(text).toLowerCase();
  let scenarioKey = 'optimise', interp = 'no clear disruption — holding the balanced plan';
  if (/(loader|ld-?\d|wheel loader|excavator|992|ex1900).*(down|out|fail|broke|crack|bucket|stuck)|(down|out|stuck).*(loader|ld-?\d)/.test(t)) {
    scenarioKey = 'loader-down'; interp = 'loader down (LD-2) → hold 3 trucks, expedite repair';
  } else if (/(wet|rain|ramp|slip|traction|muddy|grade|water)/.test(t)) {
    scenarioKey = 'road-wet'; interp = 'ramp wet → watering + 22 km/h speed cap';
  } else if (/(surge|laycan|demurrage|barge|swell|critical|deadline|vessel|rush)/.test(t)) {
    scenarioKey = 'demand-surge'; interp = 'demand surge (laycan-critical) → fleet surge';
  } else if (/(ht-?\d|truck).*(down|out|fault|fail|broke|engine|tyre|tire|hydraul|refuel|crib)|(down|out|fault).*(truck|ht-?\d)/.test(t)) {
    scenarioKey = 'truck-down'; interp = 'truck down (HT-105) → re-balance 5/3 across loaders';
  }
  return { scenarioKey, interpretation: `Parsed: ${interp}`, parsed: 'heuristic' };
}

// Grounded copilot answer over the live haul-circuit state (heuristic fallback).
export function haulCopilotFallback({ question = '', state = {} } = {}) {
  const q = String(question).toLowerCase();
  const d = Math.round(state.deliveredTph ?? 1985), dem = Math.round(state.demandTph ?? 1900);
  const mf = (state.matchFactor ?? 1.01), buf = state.hopperBufferMin ?? 13, binding = state.binding || 'fleet';
  const goal = q.match(/\b(\d{3,4})\b/);
  if (goal && /(t\/h|tph|get|reach|target|to|hit)/.test(q)) {
    const target = parseInt(goal[1], 10), gap = target - d;
    return { answer: gap <= 0
      ? `You're already at ${d} t/h, above the ${target} t/h goal — ease cadence toward the demand line to cut fuel per tonne.`
      : `To reach ${target} t/h from ${d} (gap ${gap}), the binding ${binding} constraint sets the ceiling: return/add trucks toward MF 1.0, lift payload to the 10/10/20 policy ceiling, and clear the queue. If the chain is ${binding}-bound, the only path past it is relieving that resource (e.g. a second loader, or a dry ramp).` };
  }
  if (/bottleneck|constraint|binding|limit/.test(q)) return { answer: `The binding constraint is ${binding} — it sets the delivery ceiling, so relieving it is the only way past the current ${d} t/h.` };
  if (/starve|hopper|buffer|min/.test(q)) return { answer: `Hopper buffer is ${buf} min at ${d} t/h delivered vs ${dem} t/h demand. ${buf < 10 ? 'Below the 10-min line — protect the feed.' : 'Comfortably above the 10-min warning line.'}` };
  if (/over|under|truck|match|\bmf\b/.test(q)) return { answer: `Match factor is ${mf.toFixed ? mf.toFixed(2) : mf} — ${mf < 0.95 ? 'under-trucked, loaders waiting' : mf > 1.05 ? 'over-trucked, trucks queuing' : 'balanced'}. Drive it toward 1.0 to minimise queue loss.` };
  return { answer: `Delivering ${d} t/h vs ${dem} demand, MF ${mf.toFixed ? mf.toFixed(2) : mf}, hopper ${buf} min. Binding constraint: ${binding}. Ask about the bottleneck, hopper buffer, match factor — or set a target t/h.` };
}
