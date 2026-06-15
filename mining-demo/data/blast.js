// Server-side fallbacks for the Blast Optimisation AI endpoints. Returned when
// ANTHROPIC_API_KEY is absent or a live call fails, so the console always
// responds. Derived from the single canonical engine in
// public/js/blast-scenarios.js, so the client console and these fallbacks can
// never drift apart.
import { buildMetrics, parseScenarioKey, scenarioTag, answerFromState } from '../public/js/blast-scenarios.js';

// Map the full blast snapshot onto the /api/blast/analyze response shape.
// `scenario` may carry a `design` override (live slider edits) and an `edited` flag.
export function blastFallback(scenario = {}) {
  const key = scenario.scenarioKey || scenario.disruptionId || scenario.scenario || 'optimise';
  const m = buildMetrics({ scenario: key, design: scenario.design || null, edited: !!scenario.edited });
  return {
    headline: m.headline,
    powderFactorKgM3: +m.design.PF.toFixed(2),
    predictedP80mm: Math.round(m.p80),
    fragmentation: { pctOversize: +m.m.oversize.toFixed(1), pctFines: +m.m.fines.toFixed(1), targetP80mm: m.ctx.target },
    bindingConstraint: m.bindName,
    constraintNote: m.bindNote,
    designActions: m.actions,
    vibration: { predictedPpvMmS: +m.m.ppv.toFixed(1), limitMmS: m.ctx.ppvLimit, status: m.ppvStatus },
    flyrock: { predictedRangeM: Math.round(m.m.fly), exclusionM: m.ctx.exclusion, status: m.flyStatus },
    downstreamUpliftTph: m.uplift,
    recommendations: m.recs,
    valueImpactUSD: Math.round(m.value),
    narrative: m.narrative,
  };
}

// NL note → a scenario the deterministic engine can run (heuristic fallback).
export function blastParseFallback(text = '') {
  const key = parseScenarioKey(text);
  return { scenarioKey: key, interpretation: 'Parsed: "' + String(text).trim() + '" → ' + scenarioTag(key) + ' · re-solving', parsed: 'heuristic' };
}

// Grounded copilot answer over the live design state (heuristic fallback).
export function blastCopilotFallback({ question = '', state = {} } = {}) {
  return { answer: answerFromState(question, state) };
}
