// Server-side fallbacks for the IROC Control Tower AI endpoints: the duty-
// controller exception analysis, NL disruption parsing and the ops copilot.
// Used whenever ANTHROPIC_API_KEY is absent or a live call fails.

const DUTY = {
  'shovel-down': {
    headline: 'SH-02 hydraulic fault — face down; re-allocate its trucks to SH-01.',
    rootCause: 'Hydraulic pressure-loss fault (E-1623 class) on Shovel 2; loading halted at the lower face. Four trucks now idle against a single working face.',
    bindingConstraint: 'loader',
    productionImpact: { lostKt: 4.2, planPct: -2.1 },
    actions: [
      { action: "Re-allocate SH-02's 4 trucks to SH-01 + the in-pit re-handle", impact: 'recovers ~60% of lost dig rate', owner: 'Dispatch' },
      { action: 'Dispatch hydraulic crew to SH-02', impact: 'ETA 90 min to restore the face', owner: 'Maintenance' },
      { action: 'Hold 2 trucks as spare to keep SH-01 match factor ~1.0', impact: 'avoids over-trucking the single face', owner: 'Dispatch' },
    ],
    traceUnit: 'SH-02',
    draftedComms: 'All units: SH-02 down (hydraulic). CAT-303/304/307 re-task to SH-01, hold CAT-301/305 as spare. Maintenance to SH-02, ETA 90.',
    narrative: 'Losing a shovel makes the remaining face the binding constraint; the move is to re-allocate SH-02’s trucks to SH-01 without over-trucking it, and put a hard maintenance ETA on the fault. Plan exposure is ~2% for the shift if restored within 90 minutes.',
  },
  'road-block': {
    headline: 'Haul-road seg B blocked (rockfall) — reroute waste hauls via the east ramp.',
    rootCause: 'Rockfall on segment B of the waste haul road near the WD-2 turn; the direct route to WD-2 is impassable until cleared.',
    bindingConstraint: 'haul-road',
    productionImpact: { lostKt: 1.8, planPct: -0.9 },
    actions: [
      { action: 'Reroute WD-2 waste hauls via the east ramp R3', impact: '+3.5 min/cycle but keeps waste moving', owner: 'Dispatch' },
      { action: 'Dispatch dozer + loader to clear segment B', impact: 'ETA 40 min to reopen', owner: 'Maintenance' },
      { action: 'Shift two trucks from waste to ore while rerouted', impact: 'protects ore feed to the crusher', owner: 'Dispatch' },
    ],
    traceUnit: null,
    draftedComms: 'Seg B blocked — rockfall. WD-2 hauls reroute via R3 east ramp. Dozer en route, reopen ETA 40. Hold speed through the detour.',
    narrative: 'A road block raises cycle time, not capacity — so the controller protects the highest-value stream (ore to the crusher) and reroutes waste, while putting a clearance crew on a tight ETA. The cost is cycle time, recovered as soon as segment B reopens.',
  },
  'crusher-choke': {
    headline: 'Gyratory choke (bin 96%) — throttle ore hauls, hold the pit at rate.',
    rootCause: 'Primary gyratory crusher choking with the feed bin at 96%; oversize from the last bench is bridging the mantle. Mill feed is at risk if it trips.',
    bindingConstraint: 'crusher',
    productionImpact: { lostKt: 3.1, planPct: -1.5 },
    actions: [
      { action: 'Throttle ore trucks to the crusher to ~70% for 15 min', impact: 'lets the bin draw down without a trip', owner: 'Dispatch' },
      { action: 'Send a rock-breaker to the gyratory to clear the bridge', impact: 'restores full feed', owner: 'Process' },
      { action: 'Flag the oversize bench to Drill & Blast (powder factor)', impact: 'prevents repeat chokes', owner: 'Geology' },
    ],
    traceUnit: null,
    draftedComms: 'Gyratory choking, bin 96%. Ore hauls to 70% for 15 min, divert spare to ROM stockpile. Rock-breaker to crusher. D&B: review last bench frag.',
    narrative: 'A crusher choke is a downstream constraint that ripples back up the chain: the controller throttles ore hauls to let the bin draw down, diverts to the ROM stockpile, and traces the root cause to coarse fragmentation — closing the loop to Drill & Blast so it doesn’t recur.',
  },
  'slope-alarm': {
    headline: 'Slope radar P-12 accelerating — evacuate the under-wall area now.',
    rootCause: 'Radar prism P-12 on the south wall is accelerating (velocity trend rising); a wedge above the 460RL loading area is a credible failure. This is a safety-first event.',
    bindingConstraint: 'geotech',
    productionImpact: { lostKt: 5.6, planPct: -2.8 },
    actions: [
      { action: 'Evacuate + barricade the under-wall loading area immediately', impact: 'removes people/equipment from the runout', owner: 'OCE' },
      { action: 'Drop the SSR alarm threshold and add visual spotters', impact: 'tighter early warning', owner: 'Geotech' },
      { action: 'Relocate SH-01 + trucks to the north face', impact: 'keeps ~70% of dig rate off the exposed wall', owner: 'Dispatch' },
    ],
    traceUnit: null,
    draftedComms: 'STOP — slope alarm P-12 south wall accelerating. Evacuate 460RL under-wall now, barricade. Relocate SH-01 to north face. Geotech to wall.',
    narrative: 'A geotechnical alarm overrides production: the controller evacuates the runout zone first, tightens monitoring, and only then preserves what dig rate it can by relocating to a safe face. The plan loss is real but non-negotiable against a wall-failure consequence.',
  },
  'storm-hold': {
    headline: 'Lightning within 10 km — AHS hold; bring autonomous trucks to safe-park.',
    rootCause: 'Lightning detected within the 10 km trigger radius; autonomous (AHS) operation must hold and crews shelter per the weather TARP.',
    bindingConstraint: 'weather',
    productionImpact: { lostKt: 4.4, planPct: -2.2 },
    actions: [
      { action: 'Safe-park the AHS fleet; manual units to shelter points', impact: 'compliant weather hold', owner: 'Dispatch' },
      { action: 'Keep the crusher fed from the ROM stockpile during the hold', impact: 'protects mill feed ~25 min', owner: 'Process' },
      { action: 'Pre-stage a surge plan for when the cell clears', impact: 'recovers cycle count fast on resume', owner: 'Dispatch' },
    ],
    traceUnit: null,
    draftedComms: 'Lightning <10 km — weather hold. AHS to safe-park, crews shelter. Crusher draws ROM stockpile. Surge plan staged for resume.',
    narrative: 'A weather hold is a timed loss, not a capacity loss: the controller parks safely, bridges mill feed from the stockpile so the plant doesn’t starve, and pre-stages a surge so the fleet recovers the cycle count the moment the cell clears.',
  },
  'mill-trip': {
    headline: 'SAG mill trip — feed demand dropped; slow the pit to match.',
    rootCause: 'SAG mill tripped (overload/liner); downstream feed demand has collapsed, so continuing to haul ore at rate would just bank stockpile and waste fuel.',
    bindingConstraint: 'mill',
    productionImpact: { lostKt: 6.2, planPct: -3.1 },
    actions: [
      { action: 'Slow ore hauls to match the reduced mill demand', impact: 'saves fuel/tyres, avoids stockpile overflow', owner: 'Dispatch' },
      { action: 'Re-task spare trucks to waste stripping while milled is down', impact: 'banks productive waste movement', owner: 'Dispatch' },
      { action: 'Get the mill restart ETA from Process and pre-build ROM', impact: 'ready to surge feed on restart', owner: 'Process' },
    ],
    traceUnit: null,
    draftedComms: 'SAG mill tripped. Ore hauls to match demand, divert spares to waste strip. Process: restart ETA + pre-build ROM for surge on resume.',
    narrative: 'A mill trip is a reverse ripple — the constraint moves downstream, so the controller slows the pit to match demand rather than banking idle stockpile, and uses the gap to bank productive waste stripping until the mill restarts.',
  },
};

export function irocFallback({ disruptionId } = {}) {
  return DUTY[disruptionId] || {
    headline: 'Exception logged — assessing impact across the chain.',
    rootCause: 'Disruption registered; no specific playbook matched.', bindingConstraint: 'fleet',
    productionImpact: { lostKt: 1.0, planPct: -0.5 },
    actions: [{ action: 'Hold current dispatch and monitor the affected resource', impact: 'contain the event', owner: 'Dispatch' }],
    traceUnit: null, draftedComms: 'Exception logged — monitoring; will re-plan as impact firms up.',
    narrative: 'The controller contains the event and re-plans as the production impact firms up.',
  };
}

const ALIAS = [
  { rx: /(shovel|sh-?0?2|sh-?0?1|loader|dig|face)/i, id: 'shovel-down' },
  { rx: /(road|haul.?road|seg|rockfall|block|ramp|reroute)/i, id: 'road-block' },
  { rx: /(crusher|gyratory|bin|choke|bridge)/i, id: 'crusher-choke' },
  { rx: /(slope|radar|prism|wall|geotech|wedge|p-?12)/i, id: 'slope-alarm' },
  { rx: /(lightning|storm|weather|thunder|rain)/i, id: 'storm-hold' },
  { rx: /(mill|sag|grinding|liner|trip)/i, id: 'mill-trip' },
];
export function irocParseFallback(text = '') {
  const t = String(text).toLowerCase();
  for (const a of ALIAS) if (a.rx.test(t)) {
    const labels = { 'shovel-down': 'shovel down', 'road-block': 'haul-road block', 'crusher-choke': 'crusher choke', 'slope-alarm': 'slope alarm', 'storm-hold': 'lightning hold', 'mill-trip': 'mill trip' };
    return { disruptionId: a.id, interpretation: `Parsed: ${labels[a.id]} → AI duty-controller engaged` };
  }
  return { disruptionId: 'shovel-down', interpretation: `Parsed: unrecognised — defaulting to shovel-down` };
}

export function irocCopilotFallback({ question = '', state = {} } = {}) {
  const q = String(question).toLowerCase();
  const prod = state.prodKtH ?? 6.1, tonnes = state.tonnes ?? 184320, tgt = state.tonnesTarget ?? 230000;
  const pct = ((tonnes / tgt) * 100).toFixed(1);
  if (/risk|plan|behind|biggest/.test(q)) return { answer: `Biggest risk to plan: the active alarms on the south wall and Shovel 2 over-trucking. You're at ${tonnes.toLocaleString('en-US')} t of ${tgt.toLocaleString('en-US')} (${pct}%) — protect the crusher feed and keep match factor near 1.0 to stay on the 18:00 line.` };
  if (/spare|truck|where|put|allocate/.test(q)) return { answer: `Put the spare truck on SH-01 (the constrained face) and hold one as a swing unit; if Shovel 2 is healthy, balance 4/4 to keep both match factors in the 0.9–1.1 band.` };
  if (/bottleneck|constraint|binding/.test(q)) return { answer: `The chain is fleet-bound while both shovels are up; if the crusher bin climbs past ~90% it shifts downstream to the gyratory. Watch the bin and tyre TKPH as the next two constraints.` };
  if (/crusher|mill|feed/.test(q)) return { answer: `Crusher/mill feed is holding at ${prod} kt/h. Keep a ROM stockpile buffer so a brief pit interruption doesn't starve the plant.` };
  return { answer: `Running ${prod} kt/h, ${pct}% to plan. Ask about your biggest risk to plan, where to put the spare truck, the binding constraint, or crusher/mill feed.` };
}
