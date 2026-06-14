// Server-side fallback for the Hauling Optimisation AI endpoint. Returns the
// re-dispatch rationale for a given scenario when ANTHROPIC_API_KEY is absent
// or a live call fails, so the console always responds. The deterministic copy
// is derived from the single canonical source in public/js/haul-scenarios.js,
// so the client console and this fallback can never drift apart.
import { buildMetrics } from '../public/js/haul-scenarios.js';

// Map the full circuit snapshot onto the /api/haul/analyze response shape.
export function haulFallback({ disruptionId } = {}) {
  const m = buildMetrics(disruptionId || 'optimise');
  return {
    headline: m.headline,
    bindingConstraint: m.binding,
    currentRateTph: m.current,
    optimisedRateTph: m.optimised,
    matchFactor: m.mf,
    recommendations: m.recs,
    valueImpactUSD: m.value,
    narrative: m.narrative,
  };
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
