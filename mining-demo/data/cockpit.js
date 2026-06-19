// Deterministic fallback for the CEO Cockpit AI Executive Brief.
// Mirrors the structure the live model returns, derived from the Monte Carlo
// state the client posts, so the brief is credible with no API key / on timeout.

const fmtT = (n) => `Rp ${Number(n ?? 0).toFixed(2)} T`;
const pct = (n) => `${(Number(n ?? 0) * 100).toFixed(1)}%`;

export function cockpitBriefFallback(body = {}) {
  const o = body.outputs || {};
  const breach = Number(o.breachProb ?? 0);
  const breachRef = Number(o.breachProbRef ?? breach);
  const p50 = Number(o.p50 ?? 0);
  const p10 = Number(o.p10 ?? 0);
  const p90 = Number(o.p90 ?? 0);
  const cfar = Number(o.cfar ?? 0);
  const floor = Number(body.floor ?? 1.8);
  const drivers = body.drivers || {};
  const mit = body.mitigation || {};
  const top = (body.attribution && body.attribution[0] && body.attribution[0].name) || 'the coal benchmark';
  const hedged = (mit.hedgePrice || 0) > 0 || (mit.hedgeFx || 0) > 0 || (mit.domShift || 0) > 0 || (mit.costCut || 0) > 0;

  const posture = breach > 0.25 ? 'DEFENSIVE' : breach > 0.1 ? 'BALANCED' : 'CONSTRUCTIVE';
  const confidence = breach > 0.3 || p50 < floor ? 'LOW' : breach > 0.12 ? 'MEDIUM' : 'HIGH';

  const situation =
    `At the current market view (HBA $${Math.round(drivers.hba ?? 0)}/t, USD/IDR ${Math.round(drivers.fx ?? 0).toLocaleString('en-US')}, ` +
    `China demand index ${Math.round(drivers.demand ?? 100)}), the model puts PTBA's dividend to MIND ID at a median of ${fmtT(p50)}, ` +
    `with an 80% band of ${fmtT(p10)}–${fmtT(p90)}. The probability of falling below the board floor of ${fmtT(floor)} is ${pct(breach)}` +
    `${hedged ? `, down from ${pct(breachRef)} before the current mitigations` : ''}.`;

  const implication =
    breach > 0.2
      ? `Dividend cover is fragile: roughly one path in ${Math.max(2, Math.round(1 / Math.max(breach, 0.01)))} breaches the floor, so the MIND ID consolidated dividend and the PTBA equity thesis are exposed to a downside in ${top}.`
      : `Dividend cover holds across most paths; the residual risk concentrates in ${top}, and the cash-flow-at-risk (P50−P5) is ${fmtT(cfar)} — the buffer the board should plan to absorb.`;

  const actions = [];
  if ((mit.hedgePrice || 0) < 0.5 && breach > 0.1)
    actions.push({ action: `Hedge 30–50% of seaborne coal price for the next two quarters`, rationale: `${top} is the dominant driver of the breach probability; locking part of it collapses the left tail at modest give-up of upside.` });
  if ((mit.hedgeFx || 0) < 0.3)
    actions.push({ action: `Layer a partial USD/IDR hedge on the export receivable`, rationale: `Rupiah weakness flatters reported earnings but adds variance; a partial hedge stabilises the dividend in IDR terms.` });
  actions.push({ action: `Set the dividend recommendation against the P10, not the P50`, rationale: `Anchoring the payout to a conservative percentile protects the MIND ID floor in a soft-price year while preserving optionality.` });
  if (breach > 0.15)
    actions.push({ action: `Open an early DMO / royalty engagement with ESDM and stage a cost-reduction program`, rationale: `Regulated domestic volume and unit cash cost are the levers inside management control when the seaborne price turns.` });

  return {
    confidence,
    posture,
    situation,
    implication,
    actions: actions.slice(0, 4),
    risks: [
      `${top} drawdown drives the dividend below the board floor`,
      `Rupiah and freight move together against netback in a demand-down scenario`,
    ],
    opportunities: [
      `A constructive China-demand path lifts the dividend toward ${fmtT(p90)} and rebuilds MIND ID's consolidated payout capacity`,
    ],
    sources: [
      `Monte Carlo dividend-at-risk model (${(body.paths || 0).toLocaleString('en-US')} paths, ${body.regime || 'base'} regime)`,
      `Board dividend floor ${fmtT(floor)}; PTBA→MIND ID ownership 65.9%`,
      `Driver attribution: ${top} ranked highest`,
    ],
  };
}
