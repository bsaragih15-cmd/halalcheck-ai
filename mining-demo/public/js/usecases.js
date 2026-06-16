// OreSight AI — shared use-case config.
// Single source of truth for the value-chain matrix, templated demo pages,
// per-case AI prompt context and canned fallbacks. Imported by both the
// browser (ES module) and the Node server — keep it free of DOM/Node APIs.

export const STAGES = [
  { id: 'exploration', label: 'Exploration & mine dev.', icon: '🗺' },
  { id: 'preextract',  label: 'Pre-extract., clearing',  icon: '📋' },
  { id: 'drillblast',  label: 'Drill & Blast',           icon: '💥' },
  { id: 'excavate',    label: 'Excavate',                icon: '🏗' },
  { id: 'loadhaul',    label: 'Load & Haul',             icon: '🚛' },
  { id: 'processing',  label: 'Processing',              icon: '⚙' },
  { id: 'hauling',     label: 'Hauling',                 icon: '🚚' },
  { id: 'port',        label: 'Port',                    icon: '⚓' },
  { id: 'shipping',    label: 'Shipping',                icon: '🚢' },
  { id: 'marketing',   label: 'Marketing',               icon: '📈' },
];

export const VALUE_DRIVERS = {
  throughput: { icon: '↑',   label: 'Throughput', cls: 'vd-throughput' },
  cost:       { icon: '✂',   label: 'Cost',       cls: 'vd-cost' },
  margin:     { icon: '$',   label: 'Margin',     cls: 'vd-margin' },
  npv:        { icon: '$PV', label: 'NPV',        cls: 'vd-npv' },
};

// Matrix rows: horizon label + cells. span = [firstStageCol, lastStageCol], 1-based.
// A cell is either {case} or {stack:[caseA, caseB]} (two half-height cells).
export const MATRIX_ROWS = [
  { horizon: '24h',  cells: [{ case: 'command-center', span: [1, 10] }] },
  { horizon: '4w', cells: [
    { case: 'orebody',  span: [1, 2] },
    { case: 'blast',    span: [3, 3] },
    { case: 'payload',  span: [4, 4] },
    { case: 'dispatch', span: [5, 5] },
    { case: 'recovery', span: [6, 6] },
    { case: 'haul',     span: [7, 7] },
    { case: 'blending', span: [8, 8] },
    { case: 'shipping', span: [9, 9] },
    { case: 'marketing', span: [10, 10] },
  ]},
  { horizon: '6m',   cells: [{ case: 'maintenance', span: [1, 10] }] },
];

const fmtUSD = (n) => '$' + Math.round(n).toLocaleString('en-US');

export const USE_CASES = {

  // ── Flagships (dedicated pages) ────────────────────────────────────────────
  'control-tower': {
    title: 'Control Tower: End-to-end visibility',
    decisions: 'real-time status across the full value chain',
    stage: 'Cross-chain', horizon: '0h', drivers: [],
    flagship: true, href: '/control-tower.html',
    promptContext: 'Integrated remote operations center (control tower) for a nickel laterite mining operation in Morowali, Central Sulawesi, Indonesia, covering pit-to-port: 2 active pits, crushing plant, 14 km overland conveyor, ore preparation, port stockyard and barge loading. A disruption scenario is provided; produce a ranked mitigation plan that minimises lost tonnes and cost.',
    fallback: (s = {}) => ({
      headline: 'Mitigation plan: heavy rainfall warning — Pit 2 (BMKG orange alert, next 6 h)',
      recommendations: [
        { action: 'Re-sequence dispatch to Pit 1 Block A2 (saprolite, all-weather access road) and pull 2 haul trucks from Pit 2 before road friction degrades', impact: 'Preserves ~78% of planned ex-pit tonnes during the rain window', timeframe: 'Next 30 min' },
        { action: 'Build crusher feed buffer: raise ROM pad draw-down to keep CR-01 at 100% utilisation through the outage window', impact: '+4,100 t crushed during rain window vs reactive plan', timeframe: '0–2 h' },
        { action: 'Pre-position water trucks and grader on Pit 2 ramp; inspect drainage culverts D-04/D-07 before peak rainfall', impact: 'Cuts post-rain ramp reopening from ~6 h to ~2 h', timeframe: '0–1 h' },
        { action: 'Notify port: hold barge BG-3107 loading sequence, prioritise stockpile SP-2 (1.82% Ni) to protect blend grade', impact: 'Keeps shipped grade within contract spec despite pit switch', timeframe: 'Next 60 min' },
      ],
      valueImpactUSD: 412000,
      narrative: 'The dominant risk is losing Pit 2 ramp access for 6–8 hours after peak rainfall. Acting before the front arrives converts an unplanned stoppage into a planned pit swap: Pit 1 saprolite keeps the RKEF feed blend within the 1.8% Ni target while Pit 2 drains. The crusher buffer and early road maintenance protect roughly $410k of margin versus a reactive response.',
    }),
  },

  'command-center': {
    title: 'Control Tower & Command Center: Execution & disruption management',
    decisions: 'mitigations to minimise loss from disruptions',
    stage: 'Cross-chain', horizon: '24h', drivers: ['throughput', 'margin'],
    flagship: true, href: '/control-tower.html#disruptions',
  },

  'safety': {
    title: 'Safety & Compliance Intelligence',
    decisions: 'incident triage, hazard controls & regulatory compliance',
    stage: 'Cross-chain', horizon: 'HSE', drivers: ['cost'],
    flagship: true, href: '/safety.html',
  },

  'maintenance': {
    title: 'Maintenance Optimisation',
    decisions: 'timing of maintenance activities, spare parts stock level',
    stage: 'Cross-chain', horizon: '6m', drivers: ['throughput', 'cost'],
    flagship: true, href: '/maintenance.html',
  },

  'fsp': {
    title: 'Future Scheduling Platform',
    decisions: 'allocate convoys, barges & vessels; re-plan on disruption',
    stage: 'Cross-chain', horizon: 'Scheduling', drivers: ['throughput', 'margin'],
    flagship: true, href: '/fsp.html',
    promptContext: 'Future Scheduling Platform (FSP) for the Morowali nickel logistics chain: pits feed a crusher and 14-km overland conveyor into the port stockyard; two jetty berths load four self-propelled barges (BG-3101..BG-3104, ~7,500 t each, cycle: 4 h load, 3 h transit out, 5 h transshipment at floating crane FC-1, 3 h return); FC-1 transships to ocean-going vessels at the anchorage (MV Anoa loading now, laycan ends in 38 h; MV Celebes queued). Demurrage ~$28k/day. A disruption has hit the published 48-hour schedule; produce the re-plan rationale: which activities move, what stays fixed, and the quantified impact (tonnes protected, demurrage avoided, schedule adherence).',
    fallback: (s = {}) => {
      const byId = {
        'jetty2-down': {
          headline: 'Re-plan: berth 2 outage (4 h) absorbed — affected barge loads re-slotted to berth 1, MV Anoa laycan protected',
          recommendations: [
            { action: 'Move BG-3102 and BG-3104 loads from berth 2 to berth 1, re-sequenced around BG-3101 (queue priority by OGV laycan exposure)', impact: '3 of 4 affected loads keep their tide window; net slip +1.5 h', timeframe: 'Immediate — auto-dispatched' },
            { action: 'Hold FC-1 transshipment order unchanged: BG-3103 arrival already covers the crane until 21:00', impact: 'Zero crane idle time during the outage', timeframe: 'No action needed' },
            { action: 'Bring berth 2 loader fitter crew forward to the 14:00 window; conveyor CV-103 keeps stacking to SP-2 meanwhile', impact: 'Outage capped at 4 h; stockyard absorbs 5,400 t buffer', timeframe: '0–4 h' },
          ],
          valueImpactUSD: 214000,
          narrative: 'The schedule bends instead of breaking: berth 1 has 3.1 h of slack in the next 12 hours and the stockyard has buffer to keep the conveyor stacking. Re-sequencing by laycan exposure (not first-come-first-served) is what protects MV Anoa — the legacy HOS schedule would have pushed the last load 6 h right and put 1.2 days of demurrage at risk.',
        },
        'swell': {
          headline: 'Re-plan: heavy swell cuts FC-1 transshipment rate 40% for 8 h — MV Anoa completion slips +5 h but stays inside laycan',
          recommendations: [
            { action: 'Stretch FC-1 transshipment blocks through the swell window and re-time BG-3102/BG-3104 departures to arrive after 22:00 (no anchorage queueing in swell)', impact: 'Barges wait at jetty, not at sea — safer and saves ~1.4 t fuel/barge', timeframe: 'Immediate' },
            { action: 'Use the jetty-side gap to advance BG-3103 maintenance wash-down (was scheduled tomorrow)', impact: 'Recovers 2 h of tomorrow\'s schedule for free', timeframe: 'During swell window' },
            { action: 'Notify MV Celebes agent: ETB shifts +5 h; laycan buffer remains 9 h — no renomination needed', impact: 'Avoids a $34k/day panic renomination', timeframe: 'Next hour' },
          ],
          valueImpactUSD: 286000,
          narrative: 'Weather is absorbed by re-timing, not by brute force: the constraint moves from the jetty to the crane, so the optimum holds barges back rather than queuing them at the anchorage. Completion still lands inside MV Anoa\'s laycan with 9 hours of buffer — the value is the demurrage and the renomination that do not happen.',
        },
        'barge-engine': {
          headline: 'Re-plan: BG-3103 engine fault — barge held 6 h at jetty; BG-3104 cycle advanced to cover, net loss held to one part-cycle',
          recommendations: [
            { action: 'Pull BG-3104\'s next cycle forward 2.5 h into BG-3103\'s vacated berth slot; FC-1 sequence swaps the two barges', impact: 'Crane utilisation holds at 92% through the shift', timeframe: 'Immediate' },
            { action: 'Dispatch the mechanic to BG-3103 at berth (not anchorage) — fault diagnosed as fuel-rack actuator, 4–6 h repair', impact: 'Repair overlaps the schedule gap instead of adding to it', timeframe: '0–6 h' },
            { action: 'If repair exceeds 6 h, activate spot barge BG-3110 from IMIP pool (standing rate $9.5k/day)', impact: 'Caps worst-case schedule loss at 1,800 t', timeframe: 'Decision gate at 21:00' },
          ],
          valueImpactUSD: 121000,
          narrative: 'A four-barge cycle has exactly one barge of redundancy, and the re-plan spends it deliberately: advance the spare capacity, swap the crane order, and put a decision gate (not a hope) on the repair. The fallback spot barge is pre-priced so the 21:00 decision takes one minute, not one meeting.',
        },
      };
      return byId[s.disruptionId] || {
        headline: 'Re-plan computed: schedule re-sequenced around the disruption with laycan-priority ordering',
        recommendations: [
          { action: 'Re-sequence affected loads by OGV laycan exposure rather than original order', impact: 'Protects the highest-cost deadline first', timeframe: 'Immediate' },
          { action: 'Hold transshipment chain unchanged where buffers cover the slip', impact: 'Avoids cascading the disruption downstream', timeframe: 'Ongoing' },
          { action: 'Publish the revised 48-h schedule to all resource operators', impact: 'One plan, no side-channel improvisation', timeframe: 'Next 15 min' },
        ],
        valueImpactUSD: 150000,
        narrative: 'The platform treats the disruption as a constraint change, not an emergency: the optimiser re-solves the 48-hour schedule under the new constraint and republishes it to every resource in minutes.',
      };
    },
  },

  'blending': {
    title: 'Blending Optimisation',
    decisions: 'smelter-feed blend recipe & flux',
    stage: 'Processing', horizon: '4w', drivers: ['margin', 'cost'],
    flagship: true, href: '/blending.html',
  },

  // ── Templated demos (demo.html?case=<id>) ─────────────────────────────────
  'orebody': {
    title: 'Next-Gen Ore-body Knowledge',
    decisions: 'where to drill next',
    stage: 'Exploration & mine dev.', horizon: '4w', drivers: ['npv'],
    pitch: 'Machine-learning grade models fuse drillhole assays, blasthole samples and geophysics into a continuously updated ore-body model — so short-term plans mine the ore body that is actually there.',
    site: 'Morowali Nickel Operations — laterite resource, Central Sulawesi',
    kpis: [
      { label: 'Drillholes in model', value: 4218, unit: '', delta: '+126 this month' },
      { label: 'Resource confidence (M+I)', value: 78.4, unit: '%', delta: '+3.1 pts QoQ', decimals: 1 },
      { label: 'Grade model error (MAPE)', value: 8.2, unit: '%', delta: '−2.4 pts vs kriging', decimals: 1 },
      { label: 'Reconciliation F1 (mine:model)', value: 0.97, unit: '', delta: 'target 0.95–1.05', decimals: 2 },
    ],
    charts: [
      { type: 'line', title: 'Grade model error — ML model vs traditional kriging (MAPE %, 12 wk)', unit: '%',
        series: [
          { label: 'OreSight ML model', gen: { base: 11, drift: -0.25, noise: 0.5, period: 0, seed: 11 }, points: 12, color: 'amber' },
          { label: 'Ordinary kriging', gen: { base: 13.5, drift: -0.02, noise: 0.6, period: 0, seed: 12 }, points: 12, color: 'muted' },
        ]},
      { type: 'bar', title: 'Block-model confidence by mining block (% Measured + Indicated)',
        labels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], data: [91, 88, 74, 69, 58, 41], color: 'cyan' },
    ],
    scenario: {
      type: 'range', label: 'Infill drilling spacing', min: 25, max: 100, step: 5, value: 50, unit: 'm',
      derive: (v) => {
        const conf = Math.max(35, Math.min(96, 120 - v * 0.85));
        return { label: 'Projected M+I confidence for Block C', value: conf.toFixed(0) + '%', note: `${Math.round(2800 / v)} additional holes, ~${fmtUSD(2800 / v * 5200)} drilling cost` };
      },
    },
    promptContext: 'Resource geology for a nickel laterite deposit in Morowali, Central Sulawesi (saprolite + limonite profile). The user is choosing an infill drilling spacing for Block C (currently Inferred). Tighter spacing raises Measured+Indicated confidence but costs ~$5,200/hole. Recommend a drilling program and how the updated ore-body model should change the short-term plan.',
    fallback: (s = {}) => {
      const sp = Number(s.value ?? 50);
      return {
        headline: `Recommended infill program: ${sp <= 40 ? sp : 40} m spacing on Block C high-grade core, ${Math.max(sp, 60)} m on the periphery`,
        recommendations: [
          { action: `Drill the Block C saprolite core at ${sp <= 40 ? sp : 40} m centres first (highest grade uncertainty × tonnage product)`, impact: 'Upgrades ~2.1 Mt from Inferred to Indicated', timeframe: '6–8 weeks' },
          { action: 'Feed blasthole assays back into the ML grade model weekly instead of quarterly', impact: 'Cuts short-range grade error by a further ~15%', timeframe: 'Immediate' },
          { action: 'Re-run the short-term mine plan once Block C is upgraded — current plan carries a 12% grade-risk discount', impact: 'Unlocks earlier access to 1.9%+ Ni ore', timeframe: 'Next planning cycle' },
        ],
        valueImpactUSD: 1850000,
        narrative: 'Block C is the swing block for next quarter\'s RKEF feed blend. The selected spacing balances drilling cost against model confidence; concentrating tighter spacing on the high-grade core captures most of the uncertainty reduction at roughly half the metres drilled.',
      };
    },
  },

  'blast': {
    title: 'Blast Optimisation',
    decisions: 'drill spacing & powder factor',
    stage: 'Drill & Blast', horizon: '4w', drivers: ['throughput'], href: '/blast.html',
    pitch: 'AI links drill-and-blast design to downstream crusher performance: fragmentation predicted per blast, powder factor tuned per domain, and redrill rates driven down.',
    site: 'Pit 2 saprolite & waste domains — Morowali Nickel Operations',
    kpis: [
      { label: 'Powder factor (waste)', value: 0.74, unit: 'kg/m³', delta: '−0.05 vs plan', decimals: 2 },
      { label: 'Fragmentation P80', value: 412, unit: 'mm', delta: 'target ≤ 450 mm' },
      { label: 'Oversize rate', value: 3.1, unit: '%', delta: '−1.8 pts in 8 wks', decimals: 1 },
      { label: 'Cost per blasted tonne', value: 0.62, unit: 'US$/t', delta: '−7% QoQ', decimals: 2 },
    ],
    charts: [
      { type: 'line', title: 'Fragmentation P80 by blast (mm, last 20 blasts)', unit: 'mm', threshold: { value: 450, label: 'Crusher gape limit' },
        series: [{ label: 'P80', gen: { base: 455, drift: -2.4, noise: 14, period: 0, seed: 21 }, points: 20, color: 'amber' }]},
      { type: 'bar', title: 'Drill & blast cost per tonne by domain (US$/t)',
        labels: ['Saprolite', 'Transition', 'Fresh waste', 'Limonite'], data: [0.41, 0.58, 0.81, 0.33], color: 'cyan' },
    ],
    scenario: {
      type: 'range', label: 'Powder factor', min: 0.55, max: 0.95, step: 0.01, value: 0.74, unit: 'kg/m³',
      derive: (v) => {
        const p80 = Math.round(680 - v * 380);
        return { label: 'Predicted P80', value: p80 + ' mm', note: p80 > 450 ? '⚠ above crusher gape limit — expect oversize & hang-ups' : 'within crusher envelope' };
      },
    },
    promptContext: 'Drill & blast engineering at an Indonesian nickel/coal open pit. The user sets a powder factor (kg/m³) for the fresh-waste domain; predicted P80 ≈ 680 − 380×PF (mm). Crusher gape limit is 450 mm P80. Explosives cost ~$1.05/kg, oversize secondary breakage costs ~$2.4/t affected. Recommend powder factor, pattern changes (burden × spacing), and quantify mine-to-mill value.',
    fallback: (s = {}) => {
      const pf = Number(s.value ?? 0.74);
      const p80 = Math.round(680 - pf * 380);
      return {
        headline: `At ${pf.toFixed(2)} kg/m³ predicted P80 is ~${p80} mm — ${p80 > 450 ? 'above' : 'inside'} the crusher envelope`,
        recommendations: [
          { action: p80 > 450 ? `Raise powder factor to ≥0.72 kg/m³ in fresh waste (P80 back under 450 mm)` : `Hold ${pf.toFixed(2)} kg/m³ but tighten pattern to 4.2 m × 4.8 m on the crusher-feed benches`, impact: p80 > 450 ? 'Eliminates ~80% of secondary breakage cost' : '+6% crusher throughput from finer feed', timeframe: 'Next blast design' },
          { action: 'Switch stemming to 12 mm aggregate on wet holes (currently drill cuttings)', impact: 'Cuts energy loss; ~5% better fragmentation at same PF', timeframe: '2 weeks' },
          { action: 'Use blast-movement monitoring on ore/waste contacts before adjusting dig limits', impact: 'Reduces ore loss ~1.2% on contact blasts', timeframe: '1 month' },
        ],
        valueImpactUSD: 640000,
        narrative: 'Powder factor is the cheapest crusher upgrade available: explosive energy costs ~$1/kg while downstream comminution of oversize costs multiples of that. The recommendation tunes PF per domain rather than pit-wide, keeping cost flat in soft saprolite while buying throughput where the crusher is the bottleneck.',
      };
    },
  },

  'payload': {
    title: 'Payload Optimisation',
    decisions: 'under/over loading feedback',
    href: '/payload.html',
    stage: 'Excavate', horizon: '4w', drivers: ['throughput'],
    pitch: 'Per-pass payload analytics close the loop between shovel operators and truck payload meters — killing both underloading (lost tonnes) and overloading (frame damage, tyre life).',
    site: 'EX-201/EX-202 backhoes loading HD785-7 fleet — Pit 2',
    kpis: [
      { label: 'Mean payload', value: 87.4, unit: 't', delta: 'rated 91 t', decimals: 1 },
      { label: 'Underload rate (<85%)', value: 14.2, unit: '%', delta: '−6 pts in 4 wks', decimals: 1 },
      { label: 'Overload events (>110%)', value: 9, unit: '/wk', delta: 'policy: <5' },
      { label: 'Tonnes lost to underload', value: 3120, unit: 't/wk', delta: '≈ $58k margin/wk' },
    ],
    charts: [
      { type: 'bar', title: 'Payload distribution (% of loads, last 7 days)',
        labels: ['<75 t', '75–82', '82–87', '87–92', '92–96', '96–100', '>100 t'], data: [4, 11, 22, 34, 19, 7, 3], color: 'amber' },
      { type: 'line', title: 'Mean payload trend (t, 12 wk)', unit: 't',
        series: [{ label: 'Mean payload', gen: { base: 84.5, drift: 0.26, noise: 0.6, period: 0, seed: 31 }, points: 12, color: 'green' }]},
    ],
    scenario: {
      type: 'range', label: 'Target fill factor', min: 90, max: 105, step: 1, value: 96, unit: '%',
      derive: (v) => {
        const tonnes = (91 * v / 100 * 168 * 6).toFixed(0);
        return { label: 'Projected weekly tonnes (6-truck fleet)', value: Number(tonnes).toLocaleString('en-US') + ' t', note: v > 100 ? '⚠ chronic overload — warranty & tyre risk' : 'within OEM 10/10/20 policy' };
      },
    },
    promptContext: 'Load & haul productivity at an Indonesian nickel mine: 2 backhoes loading six Komatsu HD785-7 trucks (91 t rated). Payload meter data shows underloading concentrated on night shift and on one operator crew. OEM 10/10/20 overload policy applies. Recommend operator feedback loops, bucket/pass-count standards, and quantify tonnes recovered.',
    fallback: (s = {}) => {
      const ff = Number(s.value ?? 96);
      return {
        headline: `Target ${ff}% fill factor: recover ~${Math.round((ff - 92) * 0.9 + 2.8)}k tonnes/week without adding a single truck`,
        recommendations: [
          { action: 'Standardise on 5-pass loading for saprolite (currently 4–6 passes, operator-dependent)', impact: '+3.4 t mean payload', timeframe: '1 week' },
          { action: 'Push real-time payload to the shovel cab display with last-pass weight projection', impact: 'Cuts underload rate from 14% to ~6%', timeframe: '2–3 weeks' },
          { action: 'Coach the two night-shift crews driving 60% of underloads; review bench floor condition at EX-202', impact: '+1.8 t mean payload on night shift', timeframe: '2 weeks' },
          { action: ff > 100 ? 'Pull target back to ≤100%: overload events void HD785 frame warranty under 10/10/20' : 'Audit payload meter calibration monthly against weighbridge', impact: 'Protects frame & tyre life', timeframe: 'Ongoing' },
        ],
        valueImpactUSD: 2100000,
        narrative: 'The fleet is leaving roughly one free truck of capacity on the table through underloading. Closing the loop between the payload meter and the loading operator is the highest-ROI fix in the load-and-haul chain — no capex, 4-week payback measured in pure incremental tonnes.',
      };
    },
  },

  'dispatch': {
    title: 'Dispatch Optimisation',
    decisions: 'truck movements',
    stage: 'Load & Haul', horizon: '4w', drivers: ['throughput'],
    pitch: 'AI dispatch re-assigns trucks dynamically as cycle conditions change — cutting shovel hang and truck queue time that fixed allocations leave on the table.',
    site: 'Pit 2 → ROM pad circuit, 6 × HD785-7 — Morowali',
    kpis: [
      { label: 'Avg cycle time', value: 22.4, unit: 'min', delta: '−1.8 min vs fixed dispatch', decimals: 1 },
      { label: 'Queue at shovel', value: 3.1, unit: 'min/cycle', delta: 'target ≤ 2.0', decimals: 1 },
      { label: 'Shovel hang time', value: 8.2, unit: '%', delta: '−4 pts', decimals: 1 },
      { label: 'Productivity', value: 1985, unit: 't/h', delta: '+9% vs last quarter' },
    ],
    charts: [
      { type: 'line', title: 'Fleet productivity (t/h, live)', unit: 't/h', live: true,
        series: [{ label: 'Tonnes/hour', gen: { base: 1950, drift: 0, noise: 55, period: 24, amp: 80, seed: 41 }, points: 40, color: 'amber' }]},
      { type: 'bar', title: 'Avg queue minutes per cycle by loading unit',
        labels: ['EX-201', 'EX-202', 'WL-301 (ROM)'], data: [3.8, 2.1, 4.6], color: 'red' },
    ],
    scenario: {
      type: 'range', label: 'Trucks assigned to circuit', min: 4, max: 9, step: 1, value: 6, unit: 'trucks',
      derive: (v) => {
        const th = Math.round(380 * v * (1 - Math.max(0, v - 6) * 0.07));
        return { label: 'Modelled circuit throughput', value: th.toLocaleString('en-US') + ' t/h', note: v > 6 ? 'queueing — diminishing returns past match point' : v < 6 ? 'shovel-limited below match point' : 'at theoretical match point' };
      },
    },
    promptContext: 'Open-pit truck dispatch at an Indonesian nickel mine: 2 excavators + ROM loader, six HD785-7 on a 22-minute cycle. Match point ≈ 6 trucks; queueing model shows ~7% marginal loss per truck beyond match. Recommend dynamic dispatch rules (re-assignment triggers, fuel/queue tradeoffs) and quantify throughput gain.',
    fallback: (s = {}) => {
      const n = Number(s.value ?? 6);
      return {
        headline: `${n} trucks: ${n > 6 ? 'over-trucked — re-deploy the surplus to waste circuit' : n < 6 ? 'under-trucked — shovels will hang' : 'matched — switch gains to dynamic re-assignment'}`,
        recommendations: [
          { action: 'Enable dynamic re-assignment: any truck arriving to a queue ≥2 re-routes to WL-301 ROM re-handle', impact: '−38% queue minutes fleet-wide', timeframe: 'Immediate (dispatch rule)' },
          { action: 'Stagger crib breaks: hot-seat changeover at the shovel keeps loading through shift change', impact: '+22 min effective loading/shift', timeframe: '1 week' },
          { action: n > 6 ? `Move ${n - 6} truck(s) to the waste pre-strip circuit where the digger is truck-starved` : 'Hold fleet at 6; buy throughput via payload (see Payload Optimisation) before adding trucks', impact: n > 6 ? 'Converts queue time into waste movement' : 'Avoids $0 capex', timeframe: 'Next shift plan' },
        ],
        valueImpactUSD: 1320000,
        narrative: 'The circuit is balanced on paper but loses ~10% of capacity to micro-queues and shift-change hang. Dynamic dispatch attacks exactly that loss: it does not add capacity, it stops capacity evaporating. Gains compound with the payload initiative on the same fleet.',
      };
    },
  },

  'recovery': {
    title: 'Recovery & Quality Optimisation',
    decisions: 'plant set-points',
    stage: 'Processing', horizon: '4w', drivers: ['cost', 'margin'],
    pitch: 'AI recommends plant set-points in real time from ore characteristics — recovering metal that fixed set-points leave in the tailings.',
    site: 'Ore preparation & RKEF feed plant — Morowali',
    kpis: [
      { label: 'Ni recovery', value: 89.6, unit: '%', delta: '+1.4 pts vs baseline', decimals: 1 },
      { label: 'Feed rate', value: 312, unit: 't/h', delta: 'design 320 t/h' },
      { label: 'Moisture (kiln feed)', value: 21.8, unit: '%', delta: 'target ≤ 22%', decimals: 1 },
      { label: 'Energy intensity', value: 418, unit: 'kWh/t Ni', delta: '−3% MoM' },
    ],
    charts: [
      { type: 'line', title: 'Ni recovery (%, 14 days)', unit: '%',
        series: [
          { label: 'AI set-points', gen: { base: 88.4, drift: 0.09, noise: 0.35, period: 0, seed: 51 }, points: 14, color: 'green' },
          { label: 'Fixed set-points (baseline)', gen: { base: 88.1, drift: 0, noise: 0.4, period: 0, seed: 52 }, points: 14, color: 'muted' },
        ]},
      { type: 'bar', title: 'Recovery loss Pareto (pts)',
        labels: ['Kiln moisture swings', 'Feed grade variability', 'Reductant ratio', 'Furnace tap timing'], data: [0.9, 0.7, 0.5, 0.3], color: 'red' },
    ],
    scenario: {
      type: 'range', label: 'Feed rate set-point', min: 280, max: 340, step: 5, value: 312, unit: 't/h',
      derive: (v) => {
        const rec = (91.5 - Math.pow(Math.max(0, v - 300), 1.35) * 0.045 - Math.max(0, 300 - v) * 0.01).toFixed(1);
        return { label: 'Modelled Ni recovery at set-point', value: rec + '%', note: v > 320 ? '⚠ beyond design — kiln residence time too short' : 'recovery–throughput tradeoff' };
      },
    },
    promptContext: 'Process plant optimisation for a nickel laterite RKEF line in Morowali. Recovery falls ~0.045×(feed−300)^1.35 pts past 300 t/h (kiln residence time). Ni price ~$16,500/t, payability 80%. The user picks a feed-rate set-point; recommend the recovery-vs-throughput optimum and supporting set-point changes (moisture control, reductant ratio).',
    fallback: (s = {}) => {
      const v = Number(s.value ?? 312);
      return {
        headline: `Optimum feed sits at 310–315 t/h — ${v > 318 ? 'pull back: marginal tonnes are costing recovery' : v < 305 ? 'push up: recovery headroom is not paying for lost throughput' : 'current set-point is in the optimum band'}`,
        recommendations: [
          { action: 'Close the kiln-moisture loop: AI set-point on dryer fuel valve from ore moisture sensor (currently operator-set hourly)', impact: '+0.6 pts recovery — biggest single lever', timeframe: '2 weeks' },
          { action: 'Tie reductant (coal) ratio to feed Ni:Fe from the blending model instead of daily assay', impact: '+0.3 pts recovery, −2% coal use', timeframe: '3 weeks' },
          { action: 'Hold feed at 312 t/h during grade peaks ≥1.85% Ni; allow 320 t/h only on limonite-heavy blends', impact: 'Captures metal when it is worth most', timeframe: 'Immediate rule' },
        ],
        valueImpactUSD: 3400000,
        narrative: 'One recovery point on this line is worth roughly $3.4M/year at current Ni prices — far more than the marginal tonnes gained by overfeeding the kiln. The AI optimum keeps throughput within design and spends the optimisation budget where the money is: moisture stability and reductant stoichiometry.',
      };
    },
  },

  'quality': {
    title: 'Quality Optimisation',
    decisions: 'plant set-points',
    stage: 'Processing', horizon: '4w', drivers: ['margin'],
    pitch: 'Grade variability is a hidden discount on every shipment. AI flattens product quality swings so contracts are met without giving away premium ore.',
    site: 'RKEF feed & FeNi product quality — Morowali',
    kpis: [
      { label: 'Product grade (FeNi)', value: 22.1, unit: '% Ni', delta: 'spec 22 ± 1%', decimals: 1 },
      { label: 'Spec compliance', value: 96.2, unit: '%', delta: '+5 pts in 8 wks', decimals: 1 },
      { label: 'Grade std-dev (feed)', value: 0.09, unit: '% Ni', delta: '−40% with blend control', decimals: 2 },
      { label: 'Penalty exposure', value: 84, unit: 'k$/mo', delta: '−$61k vs Q1' },
    ],
    charts: [
      { type: 'line', title: 'Feed grade variability (% Ni, hourly, 48 h)', unit: '% Ni', threshold: { value: 1.8, label: 'RKEF feed target' },
        series: [{ label: 'Feed grade', gen: { base: 1.81, drift: 0, noise: 0.035, period: 12, amp: 0.04, seed: 61 }, points: 48, color: 'amber' }]},
      { type: 'bar', title: 'Off-spec root causes (events, 90 days)',
        labels: ['Stockpile switching', 'Wet-season moisture', 'Assay lag', 'Pit grade surprise'], data: [14, 9, 7, 4], color: 'red' },
    ],
    scenario: {
      type: 'range', label: 'Grade control target', min: 1.70, max: 1.95, step: 0.01, value: 1.80, unit: '% Ni',
      derive: (v) => {
        const giveaway = Math.max(0, v - 1.8) * 5200000;
        const penalty = Math.max(0, 1.8 - v) * 3900000;
        return { label: 'Annualised giveaway + penalty at target', value: fmtUSD(giveaway + penalty), note: v > 1.8 ? 'grade giveaway above contract' : v < 1.8 ? 'penalty/rejection risk below spec' : 'on contract spec' };
      },
    },
    promptContext: 'Product quality control for a nickel RKEF operation: feed target 1.80% Ni, every 0.01% sustained giveaway ≈ $52k/yr, every 0.01% under-spec ≈ $39k/yr penalty exposure. Variability is driven by stockpile switching and wet-season moisture. Recommend control strategy (online analysers, blend rules, assay turnaround) for the chosen grade target.',
    fallback: (s = {}) => {
      const v = Number(s.value ?? 1.8);
      return {
        headline: `Hold the target at 1.80% Ni and attack variance — ${v !== 1.8 ? 'shifting the target ' + (v > 1.8 ? 'up buys insurance you are paying for in giveaway' : 'down trades penalties for short-term tonnage') : 'σ-reduction is worth more than target-shifting'}`,
        recommendations: [
          { action: 'Install/repair the online PGNAA analyser on the crusher discharge belt; drive blend corrections at 15-min cadence instead of 8-h assay lag', impact: '−45% feed grade σ', timeframe: '6 weeks' },
          { action: 'Forbid single-pile reclaim: enforce 2-pile minimum blend ratio in the FEL operator screen', impact: 'Eliminates the largest off-spec root cause', timeframe: 'Immediate rule' },
          { action: 'Wet-season mode: cap limonite fraction at 30% when stockpile moisture >24%', impact: 'Halves moisture-driven kiln upsets', timeframe: 'Seasonal rule' },
        ],
        valueImpactUSD: 980000,
        narrative: 'The plant is paying twice for variability: giveaway on the high side, penalty exposure on the low side. Cutting σ lets the operation run the target exactly on spec — the cheapest "grade increase" available, worth roughly $1M/yr without mining a single extra tonne.',
      };
    },
  },

  'haul': {
    title: 'Haul Optimisation',
    decisions: 'truck/rail movements',
    stage: 'Hauling', horizon: '4w', drivers: ['throughput'], href: '/haul.html',
    pitch: 'The 38-km mine-to-port haul is its own production system. AI tunes convoy spacing, speed profiles and fuel burn across the corridor.',
    site: 'Mine gate → Kendari port corridor — side-dump road train fleet',
    kpis: [
      { label: 'Corridor throughput', value: 41.2, unit: 'kt/day', delta: 'plan 40 kt/day', decimals: 1 },
      { label: 'Avg corridor speed', value: 38.4, unit: 'km/h', delta: '+2.1 km/h', decimals: 1 },
      { label: 'Fuel burn', value: 0.92, unit: 'L/t·100km', delta: '−6% with pacing', decimals: 2 },
      { label: 'Fleet utilisation', value: 83.7, unit: '%', delta: 'target 85%', decimals: 1 },
    ],
    charts: [
      { type: 'line', title: 'Tonnes hauled per shift (kt, 14 shifts)', unit: 'kt',
        series: [{ label: 'Day shift', gen: { base: 20.8, drift: 0.05, noise: 0.9, period: 0, seed: 71 }, points: 14, color: 'amber' },
                 { label: 'Night shift', gen: { base: 19.6, drift: 0.07, noise: 1.1, period: 0, seed: 72 }, points: 14, color: 'cyan' }]},
      { type: 'bar', title: 'Corridor delay causes (h/month)',
        labels: ['Village crossings', 'Wet road sections', 'Weighbridge queue', 'Breakdowns'], data: [46, 38, 29, 17], color: 'red' },
    ],
    scenario: {
      type: 'range', label: 'Convoy departure interval', min: 4, max: 15, step: 1, value: 8, unit: 'min',
      derive: (v) => {
        const tput = Math.round(60 / v * 110 * 22);
        return { label: 'Modelled corridor throughput', value: (tput / 1000).toFixed(1) + ' kt/day', note: v < 6 ? '⚠ bunching at village crossings & weighbridge' : 'stable flow' };
      },
    },
    promptContext: 'Mine-to-port hauling on a 38 km private road in Sulawesi using side-dump road trains (110 t payload). Weighbridge and two village crossings are the choke points; bunching below 6-minute departure intervals collapses corridor speed. Recommend pacing strategy, choke-point fixes and fuel optimisation for the chosen interval.',
    fallback: (s = {}) => {
      const v = Number(s.value ?? 8);
      return {
        headline: `${v}-minute departures: ${v < 6 ? 'bunching will eat the paper gain — fix the weighbridge first' : 'corridor is flow-stable; next gain is at the choke points'}`,
        recommendations: [
          { action: 'GPS-paced departures with dynamic spacing (tighten in free-flow sections, widen before crossings)', impact: '+1.4 kt/day at zero capex', timeframe: '2 weeks' },
          { action: 'Second weighbridge lane (or pre-weigh at the mine loadout)', impact: 'Removes the largest single delay (29 h/mo)', timeframe: '1 quarter' },
          { action: 'Speed-profile coaching from fuel telemetry: top decile drivers burn 11% less fuel at equal cycle time', impact: '−$0.7M/yr fuel', timeframe: '1 month' },
        ],
        valueImpactUSD: 2900000,
        narrative: 'The corridor behaves like a single machine: throughput is set by its slowest constraint, not by truck count. Pacing converts queue time into flow, and the weighbridge fix raises the ceiling. Fuel savings come free with smoother speed profiles.',
      };
    },
  },

  'shipping': {
    title: 'Shipping Optimisation',
    decisions: 'ship line-up / contracting',
    stage: 'Shipping', horizon: '4w', drivers: ['margin', 'cost'], href: '/shipping.html',
    pitch: 'AI lines up vessels, stockpiles and laycans so ore never waits for ships and ships never wait for ore — demurrage down, despatch up.',
    site: 'Morowali jetty + Kendari anchorage — barge & OGV program',
    kpis: [
      { label: 'Demurrage YTD', value: 1.84, unit: 'M$', delta: '−38% vs LY', decimals: 2 },
      { label: 'Vessel queue', value: 2, unit: 'OGVs', delta: 'avg wait 1.8 days' },
      { label: 'Loading rate', value: 14.2, unit: 'kt/day', delta: 'contract 12 kt/day', decimals: 1 },
      { label: 'Laycan compliance', value: 91, unit: '%', delta: '+9 pts with AI line-up' },
    ],
    charts: [
      { type: 'bar', title: 'Demurrage cost by month (k$)',
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [410, 380, 290, 310, 240, 210], color: 'red' },
      { type: 'line', title: 'Port stockpile cover vs vessel line-up (days, 30 d)', unit: 'days', threshold: { value: 4, label: 'Min safe cover' },
        series: [{ label: 'Stock cover', gen: { base: 6.5, drift: -0.02, noise: 0.5, period: 10, amp: 1.2, seed: 81 }, points: 30, color: 'amber' }]},
    ],
    scenario: {
      type: 'range', label: 'Laycan buffer', min: 0, max: 6, step: 1, value: 2, unit: 'days',
      derive: (v) => {
        const dem = Math.max(0, 3 - v) * 28000 * 12 + 120000;
        const inv = v * 95000;
        return { label: 'Annualised demurrage + inventory cost', value: fmtUSD(dem + inv), note: 'demurrage risk falls, stockpile carrying cost rises' };
      },
    },
    promptContext: 'Shipping & port logistics for an Indonesian nickel ore exporter: jetty loads barges to OGVs at anchorage, demurrage ~$28k/day, stockpile carrying cost ~$95k/yr per buffer day. Wet-season loading variability is the main laycan risk. The user picks a laycan buffer in days; recommend vessel line-up strategy and the demurrage-vs-inventory optimum.',
    fallback: (s = {}) => {
      const v = Number(s.value ?? 2);
      return {
        headline: `${v}-day buffer: ${v < 2 ? 'thin for wet season — one missed barge cycle cascades into demurrage' : v > 3 ? 'paying for insurance you rarely use — trim toward 2–3 days' : 'near the optimum for current loading variability'}`,
        recommendations: [
          { action: 'Probabilistic line-up: nominate laycans against P75 (not mean) barge-cycle forecasts during wet season', impact: '−$0.6M/yr demurrage', timeframe: 'Next nomination cycle' },
          { action: 'Pre-position one Handysize earlier when BMKG 7-day forecast shows >60% heavy-rain probability', impact: 'Protects laycan compliance in the worst month', timeframe: 'Seasonal rule' },
          { action: 'Renegotiate despatch/demurrage split on the 2 contracts where despatch is uncollected', impact: '+$180k/yr despatch earnings', timeframe: 'Next contract round' },
        ],
        valueImpactUSD: 820000,
        narrative: 'Demurrage is volatility cost, not bad luck. Sizing the buffer against the actual loading-rate distribution — and renominating early when weather shifts that distribution — converts an unpredictable penalty line into a managed tradeoff.',
      };
    },
  },

  'marketing': {
    title: 'Marketing Optimisation',
    decisions: 'spot volume / contracts',
    stage: 'Marketing', horizon: '4w', drivers: ['margin'], href: '/marketing.html',
    pitch: 'AI balances the contract book against the spot market — placing each parcel where realised price, counterparty risk and logistics cost net out best.',
    site: 'FeNi & ore sales book — Singapore trading desk',
    kpis: [
      { label: 'Realised premium', value: 2.1, unit: '%', delta: 'vs LME-linked index', decimals: 1 },
      { label: 'Spot share', value: 24, unit: '%', delta: 'policy band 15–35%' },
      { label: 'LME Ni (3M)', value: 16480, unit: 'US$/t', delta: '+3.2% MoM' },
      { label: 'Hedge ratio (next Q)', value: 62, unit: '%', delta: 'policy 50–70%' },
    ],
    charts: [
      { type: 'line', title: 'LME Ni 3M vs realised price (US$/t, 26 wk)', unit: 'US$/t',
        series: [{ label: 'LME 3M', gen: { base: 15900, drift: 25, noise: 280, period: 0, seed: 91 }, points: 26, color: 'muted' },
                 { label: 'Realised', gen: { base: 16200, drift: 26, noise: 250, period: 0, seed: 92 }, points: 26, color: 'amber' }]},
      { type: 'bar', title: 'Margin by channel (US$/t over index)',
        labels: ['LT contract A', 'LT contract B', 'Spot — China', 'Spot — EU'], data: [310, 260, 415, 380], color: 'green' },
    ],
    scenario: {
      type: 'range', label: 'Spot market share', min: 0, max: 50, step: 5, value: 25, unit: '%',
      derive: (v) => {
        const uplift = v * 1050 * 12 * (1 - v * v / 5000);
        return { label: 'Modelled annual uplift vs 100% contract', value: fmtUSD(uplift), note: v > 35 ? '⚠ outside board risk policy (15–35%)' : 'within policy band' };
      },
    },
    promptContext: 'Sales & marketing for an Indonesian FeNi producer: long-term contracts earn index +$260–310/t with volume certainty; spot parcels currently clear at index +$380–415/t but carry price and counterparty risk. Board policy caps spot at 15–35%. The user picks a spot share; recommend book structure, hedge ratio and parcel placement.',
    fallback: (s = {}) => {
      const v = Number(s.value ?? 25);
      return {
        headline: `${v}% spot: ${v > 35 ? 'above policy — the marginal premium does not pay for the tail risk' : v < 15 ? 'under-monetising the current spot premium — lift toward 25%' : 'inside the band; optimise placement rather than size'}`,
        recommendations: [
          { action: 'Place incremental spot parcels into the EU channel while the CBAM-driven premium holds (+$35/t over China spot)', impact: '+$0.4M/quarter at current volumes', timeframe: 'Next 2 parcels' },
          { action: 'Hedge 60–65% of next-quarter contract volume on LME 3M strength above $16,300', impact: 'Locks margin above budget price', timeframe: 'This week' },
          { action: 'Add a quarterly re-opener to LT contract B (lowest premium, longest tenor)', impact: 'Recaptures ~$50/t at renewal', timeframe: 'Next negotiation' },
        ],
        valueImpactUSD: 1700000,
        narrative: 'The book is structurally sound; the money is in placement discipline. Spot strength is cyclical — monetise it inside the policy band and use hedging, not contract mix, to manage the downside.',
      };
    },
  },

  'mine-plan': {
    title: 'Mine-plan Optimisation',
    decisions: 'medium-term block extraction sequence',
    stage: 'Exploration & mine dev.', horizon: '1y', drivers: ['margin'],
    pitch: 'AI searches millions of feasible block sequences against price, grade and geotech constraints — finding the extraction order that maximises margin, not just tonnes.',
    site: '12-month rolling plan — Pits 1 & 2, Morowali',
    kpis: [
      { label: 'Plan NPV uplift', value: 6.8, unit: '%', delta: 'vs manual sequence', decimals: 1 },
      { label: 'Strip ratio (next 12 mo)', value: 1.42, unit: 'w:o', delta: '−0.11 vs prior plan', decimals: 2 },
      { label: 'Blocks sequenced', value: 284, unit: '', delta: '38 scenarios evaluated' },
      { label: 'Plan compliance (last Q)', value: 87, unit: '%', delta: 'target ≥ 85%' },
    ],
    charts: [
      { type: 'line', title: 'Planned vs actual ex-pit grade (% Ni, 12 mo)', unit: '% Ni',
        series: [{ label: 'Plan', gen: { base: 1.82, drift: -0.004, noise: 0.015, period: 0, seed: 101 }, points: 12, color: 'muted' },
                 { label: 'Actual', gen: { base: 1.81, drift: -0.003, noise: 0.03, period: 0, seed: 102 }, points: 12, color: 'amber' }]},
      { type: 'bar', title: 'Margin by candidate sequence (NPV index, base = 100)',
        labels: ['Manual base', 'Grade-rush', 'Strip-deferral', 'AI optimum'], data: [100, 103, 104.5, 106.8], color: 'green' },
    ],
    scenario: {
      type: 'range', label: 'Cut-off grade', min: 1.3, max: 1.8, step: 0.05, value: 1.5, unit: '% Ni',
      derive: (v) => {
        const npv = (100 + (1.55 - Math.abs(v - 1.55)) * 18 - 2).toFixed(1);
        return { label: 'Plan NPV index at cut-off (base 100)', value: npv, note: v > 1.65 ? 'high-grading — sterilises future ore' : v < 1.4 ? 'diluting the kiln feed' : 'balanced cut-off' };
      },
    },
    promptContext: 'Medium-term (12-month) open-pit planning for a nickel laterite complex: cut-off grade drives the NPV/resource-life tradeoff (optimum near 1.55% Ni at current prices); geotech limits sink rate in Pit 2; RKEF feed must hold ≥1.8% Ni blend. Recommend extraction sequence principles and cut-off policy for the chosen value.',
    fallback: (s = {}) => {
      const v = Number(s.value ?? 1.5);
      return {
        headline: `Cut-off ${v.toFixed(2)}% Ni: ${v > 1.65 ? 'short-term NPV up, but you are sterilising transition ore you will want at higher prices' : v < 1.4 ? 'feed dilution will surface as recovery loss in the plant' : 'close to the price-consistent optimum — bank the sequencing gains'}`,
        recommendations: [
          { action: 'Sequence Pit 1 Block A2 ahead of B1: equivalent tonnes, 0.27% higher grade, same haul distance', impact: '+$2.1M margin in H1', timeframe: 'Next plan revision' },
          { action: 'Defer 1.8 Mt of Pit 2 pre-strip to Q3 (geotech sign-off obtained for staged cutback)', impact: 'Moves cost out of the high-price window', timeframe: 'This plan cycle' },
          { action: 'Make cut-off price-reactive: re-run the sequence monthly with the futures curve, band 1.45–1.65%', impact: 'Captures price upside automatically', timeframe: 'Standing process' },
        ],
        valueImpactUSD: 5200000,
        narrative: 'The biggest planning lever is not digging faster, it is digging in the right order. The AI sequence front-loads margin while honouring geotech and blend constraints, and a price-reactive cut-off keeps the plan honest as nickel moves.',
      };
    },
  },

  'mine-to-market': {
    title: 'Mine-to-market Optimisation',
    decisions: 'contract volume, quality & price',
    stage: 'Cross-chain', horizon: '1y', drivers: ['margin'],
    pitch: 'One optimisation across pit, plant, logistics and sales — because a decision that is optimal for one silo is rarely optimal for the P&L.',
    site: 'Integrated pit-to-customer model — Morowali complex',
    kpis: [
      { label: 'Blended margin', value: 38.4, unit: '%', delta: '+2.2 pts integrated vs silo', decimals: 1 },
      { label: 'Contract compliance', value: 98.1, unit: '%', delta: 'zero quality claims YTD', decimals: 1 },
      { label: 'Logistics cost', value: 11.8, unit: 'US$/t', delta: '−9% YoY', decimals: 1 },
      { label: 'Working capital in chain', value: 46, unit: 'M$', delta: '−$8M with flow planning' },
    ],
    charts: [
      { type: 'bar', title: 'Margin bridge: silo plans → integrated optimum (US$M/yr)',
        labels: ['Silo baseline', '+ Blend/grade', '+ Logistics flow', '+ Contract mix', 'Integrated'], data: [0, 4.2, 7.1, 9.6, 9.6], color: 'green' },
      { type: 'line', title: 'Contracted vs available volume (kt/mo, 12 mo)', unit: 'kt',
        series: [{ label: 'Contracted', gen: { base: 118, drift: 0.6, noise: 3, period: 0, seed: 111 }, points: 12, color: 'muted' },
                 { label: 'Production plan', gen: { base: 124, drift: 0.5, noise: 4, period: 0, seed: 112 }, points: 12, color: 'amber' }]},
    ],
    scenario: {
      type: 'range', label: 'Next-year contracted volume', min: 70, max: 100, step: 5, value: 85, unit: '% of plan',
      derive: (v) => {
        const risk = v > 92 ? 'production shortfall penalty risk in wet season' : v < 78 ? 'large spot exposure' : 'balanced commitment';
        return { label: 'Uncommitted (spot/flex) volume', value: (100 - v) + '% of plan', note: risk };
      },
    },
    promptContext: 'Integrated mine-to-market planning for an Indonesian nickel producer: contracting volume vs plan certainty (wet-season production σ ≈ 8%), quality commitments vs blend flexibility, and logistics flow. The user picks contracted volume as % of production plan; recommend contract book structure, quality bands and flex mechanisms.',
    fallback: (s = {}) => {
      const v = Number(s.value ?? 85);
      return {
        headline: `Contracting ${v}% of plan: ${v > 92 ? 'one bad wet season puts you in shortfall penalties — buy back flexibility' : v < 78 ? 'spot-heavy book; fine while premiums hold, fragile when they do not' : 'sound base-load — spend effort on flex clauses, not volume'}`,
        recommendations: [
          { action: 'Contract base-load at 80–85% with ±7.5% quarterly quantity tolerance (matches production σ)', impact: 'Eliminates structural shortfall risk', timeframe: 'Next contract round' },
          { action: 'Widen quality bands to 1.8 ±0.06% Ni in exchange for a $4/t discount on one LT contract — blend flexibility is worth more', impact: '+$1.1M/yr net of discount', timeframe: 'Renewal' },
          { action: 'Plan port stockpiles against the contract calendar, not pit output: flow-based planning cut working capital $8M in backtest', impact: 'Frees $8M working capital', timeframe: '2 quarters' },
        ],
        valueImpactUSD: 9600000,
        narrative: 'Each silo is already near its local optimum; the remaining money sits between the silos. Integrated optimisation prices flexibility correctly — what a quality band is worth to the plant, what a tolerance clause is worth to the mine — and writes those prices into the contract book.',
      };
    },
  },

  'asset-mgmt': {
    title: 'Asset Management Optimisation',
    decisions: 'frequency of preventative maintenance',
    stage: 'Cross-chain', horizon: '5y', drivers: ['throughput', 'cost'],
    pitch: 'AI sets preventive-maintenance frequency from observed failure curves per asset class — not OEM defaults — balancing intervention cost against failure risk over the asset life.',
    site: 'Fixed plant + mobile fleet asset base — Morowali complex',
    kpis: [
      { label: 'PM schedule compliance', value: 92.4, unit: '%', delta: 'target ≥ 90%', decimals: 1 },
      { label: 'Reactive maintenance share', value: 21, unit: '%', delta: 'down from 34% in 2 yrs' },
      { label: 'Component life used at change-out', value: 88, unit: '%', delta: 'vs 71% on fixed intervals' },
      { label: 'Maintenance cost', value: 4.18, unit: 'US$/t', delta: '−11% over 24 mo', decimals: 2 },
    ],
    charts: [
      { type: 'line', title: 'Failure rate vs PM interval — HD785 final drives (failures/10k h)', unit: '/10k h',
        series: [{ label: 'Observed failure rate', gen: { base: 1.2, drift: 0.16, noise: 0.12, period: 0, seed: 121 }, points: 12, color: 'red' }],
        xlabels: ['4k h', '5k', '6k', '7k', '8k', '9k', '10k', '11k', '12k', '13k', '14k', '15k h'] },
      { type: 'bar', title: 'Cost per operating hour by strategy (US$/h, fleet avg)',
        labels: ['Run-to-failure', 'OEM fixed interval', 'Usage-based', 'AI condition-based'], data: [188, 142, 126, 109], color: 'green' },
    ],
    scenario: {
      type: 'range', label: 'PM interval — final drives', min: 6, max: 16, step: 1, value: 11, unit: 'k hours',
      derive: (v) => {
        const cost = Math.round(60 / v * 38000 + Math.pow(Math.max(0, v - 9), 2.1) * 2100);
        return { label: 'Modelled annual cost per truck (PM + failure risk)', value: fmtUSD(cost), note: v > 13 ? '⚠ failure probability rising steeply' : v < 8 ? 'over-maintaining — discarding component life' : 'near the cost optimum' };
      },
    },
    promptContext: 'Long-term asset management for an Indonesian mining complex (HD785 fleet + fixed plant). Final-drive PM interval tradeoff: PM event ~$38k, in-service failure ~$165k + 3 days downtime; observed Weibull failure data steepens past ~12k hours. Recommend PM policy (interval vs condition-based), spares strategy, and 5-year cost impact for the chosen interval.',
    fallback: (s = {}) => {
      const v = Number(s.value ?? 11);
      return {
        headline: `${v}k-hour interval: ${v > 13 ? 'beyond the Weibull knee — failure risk now dominates the cost curve' : v < 8 ? 'throwing away ~30% of component life per cycle' : 'in the optimum band — next gain is condition-based triggers'}`,
        recommendations: [
          { action: 'Move final drives from fixed interval to condition-based change-out (oil particle count + vibration trigger)', impact: '+1,800 h average life per component at equal risk', timeframe: '1 quarter' },
          { action: 'Hold 2 exchange final drives in-country (currently 1): wet-season logistics make emergency import a 3-week exposure', impact: 'Cuts worst-case downtime from 21 to 4 days', timeframe: '2 months' },
          { action: 'Align PM frequency per asset class to observed Weibull β, reviewed annually with the reliability model', impact: '−$2.9M/yr fleet-wide vs OEM defaults', timeframe: 'Standing policy' },
        ],
        valueImpactUSD: 2900000,
        narrative: 'OEM intervals are calibrated for average global conditions, not this site\'s duty cycle. The observed failure data supports running components longer — but only with condition monitoring standing guard. The spares buffer is what makes the longer interval safe to run.',
      };
    },
  },

  'lop': {
    title: 'LOP Optimisation',
    decisions: 'long-term block extraction sequence',
    stage: 'Exploration & mine dev.', horizon: '+10y', drivers: ['npv'],
    pitch: 'Life-of-plan optimisation re-solves the whole-of-life extraction sequence under price and discount-rate uncertainty — the decisions worth the most and revisited the least.',
    site: 'Life-of-mine plan — Morowali complex (2026–2044)',
    kpis: [
      { label: 'LOM NPV (P50)', value: 2.84, unit: 'B$', delta: '+$210M vs prior LOM', decimals: 2 },
      { label: 'Mine life', value: 18, unit: 'yrs', delta: 'at 1.45% avg cut-off' },
      { label: 'Avg grade — first 5 yrs', value: 1.84, unit: '% Ni', delta: 'declining profile after Y8', decimals: 2 },
      { label: 'Scenarios evaluated', value: 1240, unit: '', delta: 'price × geotech × capex' },
    ],
    charts: [
      { type: 'line', title: 'Production & grade profile by year (kt Ni & % Ni)', unit: '',
        series: [{ label: 'Contained Ni (kt ×10)', gen: { base: 32, drift: -0.5, noise: 1.2, period: 0, seed: 131 }, points: 18, color: 'amber' },
                 { label: 'Avg grade (% Ni ×10)', gen: { base: 18.6, drift: -0.28, noise: 0.3, period: 0, seed: 132 }, points: 18, color: 'cyan' }],
        xlabels: ['Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10','Y11','Y12','Y13','Y14','Y15','Y16','Y17','Y18'] },
      { type: 'bar', title: 'NPV by LOM strategy (US$B, P50)',
        labels: ['Current LOM', 'Grade-decline smoothing', 'Early limonite HPAL', 'AI optimum'], data: [2.63, 2.71, 2.78, 2.84], color: 'green' },
    ],
    scenario: {
      type: 'range', label: 'Long-run Ni price assumption', min: 13000, max: 21000, step: 500, value: 16500, unit: 'US$/t',
      derive: (v) => {
        const npv = (2.84 + (v - 16500) / 1000 * 0.21).toFixed(2);
        return { label: 'LOM NPV at price deck (P50)', value: '$' + npv + 'B', note: v < 14500 ? 'pit shrinks — high-cost blocks fall out of the plan' : v > 19000 ? 'cutback 3 and HPAL expansion enter the money' : 'base-case plan holds' };
      },
    },
    promptContext: 'Life-of-mine planning for a nickel laterite complex (18-year horizon, saprolite RKEF + potential limonite HPAL). NPV sensitivity ≈ $210M per $1,000/t long-run Ni price. Key options: grade-decline smoothing, early HPAL on limonite, staged cutback 3. Recommend LOM strategy at the chosen price deck and which decisions to keep reversible.',
    fallback: (s = {}) => {
      const v = Number(s.value ?? 16500);
      return {
        headline: `At $${(v / 1000).toFixed(1)}k/t long-run: ${v > 19000 ? 'expansion options dominate — bring HPAL study forward' : v < 14500 ? 'shrink-to-core plan: defer cutback 3, hold optionality' : 'base plan is robust — invest in keeping options open, not in committing early'}`,
        recommendations: [
          { action: 'Smooth the Y8–Y12 grade decline by deferring 4 high-grade blocks from Y3–Y5 (NPV cost $18M, revenue-stability value larger under contract structure)', impact: 'Flattens the revenue cliff', timeframe: 'This LOM revision' },
          { action: v > 17500 ? 'Advance the limonite HPAL pre-feasibility — the stockpiled limonite becomes ore, not waste, above ~$17.5k' : 'Continue stockpiling limonite on the contingency pad (HPAL optionality, ~$0 holding cost)', impact: v > 17500 ? '+$140M NPV option' : 'Preserves a free call option', timeframe: 'Next study cycle' },
          { action: 'Keep cutback 3 as a staged decision with a Y6 gate tied to the realised price deck — do not pre-commit capex', impact: 'Avoids $90M of regret capex in the P25 case', timeframe: 'Governance rule' },
        ],
        valueImpactUSD: 210000000,
        narrative: 'At a 10+ year horizon the plan is a portfolio of options, not a schedule. The AI optimum is worth more mostly because it delays irreversible commitments to the moments when the price deck actually resolves — flexibility, priced properly, is the largest single line in the NPV bridge.',
      };
    },
  },

  'capex': {
    title: 'Optimise CAPEX Efficiency',
    decisions: 'where to allocate CAPEX',
    stage: 'Cross-chain', horizon: '+10y', drivers: ['npv'],
    pitch: 'AI ranks the capital pipeline by marginal NPV per dollar — across pits, plant, fleet and infrastructure — so the budget funds the best portfolio, not the loudest sponsor.',
    site: 'Capital portfolio 2026–2031 — Morowali complex',
    kpis: [
      { label: 'Capital pipeline', value: 740, unit: 'M$', delta: '23 candidate projects' },
      { label: 'Funded portfolio IRR', value: 31.4, unit: '%', delta: 'hurdle 15%', decimals: 1 },
      { label: 'NPV per capex $', value: 1.86, unit: 'x', delta: 'vs 1.52 prior round', decimals: 2 },
      { label: 'Schedule overrun (live projects)', value: 6, unit: '%', delta: 'industry median ~20%' },
    ],
    charts: [
      { type: 'bar', title: 'Candidate projects — IRR % (AI-ranked)',
        labels: ['Crusher 2 upgrade', 'Conveyor ext.', 'Fleet trolley-assist', 'HPAL study', 'Camp expansion', 'Port berth 2'], data: [44, 38, 31, 28, 12, 9], color: 'green' },
      { type: 'line', title: 'Portfolio NPV vs budget level (US$M)', unit: 'US$M',
        series: [{ label: 'Efficient frontier', gen: { base: 180, drift: 28, noise: 6, period: 0, seed: 141 }, points: 12, color: 'amber' }],
        xlabels: ['100', '150', '200', '250', '300', '350', '400', '450', '500', '550', '600', '650'] },
    ],
    scenario: {
      type: 'range', label: 'Annual capex budget', min: 100, max: 650, step: 25, value: 350, unit: 'M$',
      derive: (v) => {
        const npv = Math.round(180 + (v - 100) / 50 * 28 * (1 - Math.max(0, v - 400) / 900));
        return { label: 'Funded portfolio NPV', value: '$' + npv + 'M', note: v > 450 ? 'frontier flattening — marginal projects below hurdle' : 'on the steep part of the frontier' };
      },
    },
    promptContext: 'Capital allocation for an Indonesian mining complex: 23 candidate projects totalling $740M against a constrained annual budget. Frontier analysis shows diminishing returns past ~$400–450M/yr; execution capacity (owner team) is a binding constraint alongside cash. Recommend the funded portfolio at the chosen budget and the governance rules for re-ranking.',
    fallback: (s = {}) => {
      const v = Number(s.value ?? 350);
      return {
        headline: `$${v}M budget: fund the top ${Math.min(23, Math.round(v / 38))} projects — ${v > 450 ? 'the tail of this portfolio is below hurdle; return the cash or bank it' : 'every funded project clears the 15% hurdle with margin'}`,
        recommendations: [
          { action: 'Fund Crusher 2 upgrade and conveyor extension first: both debottleneck the same chain and their NPVs compound (+12% when funded together)', impact: '$118M combined NPV', timeframe: 'This budget cycle' },
          { action: 'Stage trolley-assist as a 2-truck pilot before fleet-wide rollout — the IRR is high but grid-supply risk is unpriced', impact: 'Caps downside at $9M vs $64M', timeframe: 'H2' },
          { action: 'Defer camp expansion and port berth 2 (below hurdle at current throughput); revisit if LOM expansion gates open', impact: 'Frees $85M for the frontier', timeframe: 'This cycle' },
          { action: 'Re-rank the portfolio quarterly with realised prices — a static annual ranking is how below-hurdle projects survive', impact: 'Keeps capital on the frontier', timeframe: 'Standing governance' },
        ],
        valueImpactUSD: 118000000,
        narrative: 'The portfolio frontier is steep up to roughly $400M and flat beyond it — the discipline that matters is not picking good projects, it is refusing fundable-but-marginal ones. Interdependency-aware ranking (projects that debottleneck the same chain) is where the AI adds value over a simple IRR sort.',
      };
    },
  },
};

export function getCase(id) {
  return USE_CASES[id] || null;
}
