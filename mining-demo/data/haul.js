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
