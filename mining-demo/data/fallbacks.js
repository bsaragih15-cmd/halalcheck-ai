// OreSight AI — canned fallback responses for the flagship demo endpoints.
// Returned whenever ANTHROPIC_API_KEY is missing or the live call fails, so
// the demo always produces a polished analysis. Template functions read the
// request so canned answers still react to user input.

// ── Maintenance ───────────────────────────────────────────────────────────────
export function maintenanceFallback({ assetId = 'HT-104', assetMeta = {}, telemetrySummary = {} } = {}) {
  const vib = Number(telemetrySummary.vibrationLast ?? 8.6);
  const critical = vib >= 7.1; // ISO 10816 zone D boundary used in the UI
  const warning = vib >= 4.5 && !critical;

  if (!critical && !warning) {
    return {
      healthScore: 92,
      failureProbability: 0.04,
      component: 'No degrading component identified',
      predictedFailureDays: null,
      severity: 'NORMAL',
      recommendedWindow: 'Next scheduled service (no advance required)',
      actions: [
        'Continue routine condition monitoring at current cadence',
        'Trend oil particle counts at next sample to confirm baseline',
      ],
      parts: [],
      costAvoidanceUSD: 0,
      narrative: `${assetId} telemetry is inside normal operating envelopes. Vibration ${vib.toFixed(1)} mm/s sits in ISO 10816 zone A/B and temperatures track ambient-corrected baselines. No intervention before the scheduled service is warranted.`,
    };
  }

  return {
    healthScore: critical ? 41 : 68,
    failureProbability: critical ? 0.78 : 0.32,
    component: 'Left final drive — outer bearing (spalling signature)',
    predictedFailureDays: critical ? 9 : 26,
    severity: critical ? 'CRITICAL' : 'WARNING',
    recommendedWindow: critical
      ? 'Sat 07:00–13:00 WITA (shift change + crusher maintenance overlap)'
      : 'Next 2-week PM window — align with scheduled 500-h service',
    actions: [
      'Pull oil sample from left final drive for ferrography (confirm bearing spall vs gear wear)',
      'Reduce unit to light-duty circuit (ROM re-handle) pending change-out — avoid 8% grade ramp',
      'Stage exchange final drive from Balikpapan warehouse (3-day logistics lead)',
      'Plan 6-h change-out with fitter crew B; crane already on site for crusher liner work',
    ],
    parts: [
      { part: 'Final drive assembly (exchange)', number: 'KMT 569-83-8D210X', status: 'In stock — Balikpapan DC' },
      { part: 'Outer bearing kit', number: 'KMT 569-33-1131K', status: 'In stock — site store' },
      { part: 'Duo-cone seal set', number: 'KMT 569-21-7440S', status: 'In stock — site store' },
    ],
    costAvoidanceUSD: critical ? 386000 : 214000,
    narrative: `${assetId} left final drive vibration has climbed to ${vib.toFixed(1)} mm/s RMS (ISO 10816 zone ${critical ? 'D — damage occurs' : 'C — restricted'}), with bearing temperature trending +9°C above fleet baseline at equal payload. The 2–4× shaft-speed energy pattern matches outer-race spalling. ${critical ? 'In-service failure on the ramp would cost ~$165k repair plus ~3 days of lost availability; a planned weekend change-out converts that into a 6-hour scheduled job.' : 'Degradation is early-stage: monitor at increased cadence and bundle the change-out with the next PM window.'}`,
  };
}

// ── Safety ────────────────────────────────────────────────────────────────────
const SAFETY_BY_SAMPLE = {
  'haul-road-fog': {
    severity: { level: 4, label: 'High potential (near miss — fatality potential)' },
    riskScore: { likelihood: 3, consequence: 5 },
    hazardCategories: ['Vehicle interaction', 'Low visibility operations', 'Fatigue exposure', 'Traffic management'],
    rootCauses: [
      'Fog procedure SOP-HR-014 not activated by OCE despite visibility below trigger',
      'Light vehicle stopped on running lane without delineation (cones/positive comms)',
      'Operator on 11th hour of shift — fatigue window overlapping lowest-alertness hours',
      'Congested radio channel degraded positive communication at curves',
    ],
    immediateActions: [
      'Stand down HR-2 until visibility >100 m or convoy procedure active',
      'Toolbox talk: LV exclusion from haul running lanes; mandatory delineation when stopped',
      'OCE to log visibility checks hourly during fog season with activation authority delegated to shift supervisor',
    ],
    preventiveActions: [
      'Install proximity detection / collision avoidance (CAS) on haul fleet and LVs interacting with HR-2',
      'Dedicated LV inspection windows outside loaded-haul peak flows',
      'Review shift/roster design against fatigue model for hours 10–12 of night shift',
      'Separate dispatch and emergency radio channels',
    ],
    complianceFlags: [
      { regulation: 'Kepmen ESDM 1827K/30/MEM/2018', clause: 'Appendix II — traffic management & mine road safety', status: 'GAP', note: 'Fog/visibility procedure existed but activation accountability failed (not triggered by OCE)' },
      { regulation: 'Permen ESDM 26/2018', clause: 'Art. 14 — implementation of SMKP by IUP holder', status: 'GAP', note: 'Hazard-reporting-to-control loop exceeded acceptable response time' },
      { regulation: 'SMKP Minerba — Element 6', clause: 'Operational control', status: 'PARTIAL', note: 'LV/HV segregation controls documented but not enforced on HR-2' },
      { regulation: 'ISO 45001:2018', clause: '8.1.2 — eliminating hazards / hierarchy of controls', status: 'PARTIAL', note: 'Reliance on administrative controls where engineering controls (CAS) are practicable' },
    ],
    narrative: 'This is a fatality-potential near miss: a loaded 91-tonne truck passing within 3 metres of a stationary light vehicle in 35 m visibility. The barrier failures are layered — procedure activation, lane discipline, fatigue and comms — which is exactly the pattern that precedes Indonesian haul-road fatalities in MIRM data. Treat the investigation at the severity of the potential consequence, not the actual outcome.',
  },
  'slope-cracks': {
    severity: { level: 5, label: 'Critical (imminent geotechnical hazard)' },
    riskScore: { likelihood: 4, consequence: 5 },
    hazardCategories: ['Ground/strata failure', 'Working under high wall', 'Rainfall-triggered instability'],
    rootCauses: [
      'Loading continued ~2.5 h after tension cracks first observed — trigger-action-response plan (TARP) not followed',
      'Radar velocity trend (1.8 mm/h, rising) not linked to automatic operational response below alarm threshold',
      'Heavy-rainfall trigger (96 mm/72 h) did not initiate proactive geotech inspection of crest areas',
      'Seepage at bench toe indicates elevated pore pressure — drainage controls insufficient for wet season',
    ],
    immediateActions: [
      'Maintain exclusion zone (already evacuated/barricaded); no re-entry below south wall pending geotech sign-off',
      'Drop SSR-2 alarm threshold to 1.0 mm/h for this sector; add visual monitoring each shift',
      'Survey-map crack network and install prisms/extensometers across the crack zone',
      'Divert surface water away from crest; pump standing water from bench 145',
    ],
    preventiveActions: [
      'Revise TARP so visual tension cracks alone trigger immediate evacuation of the under-wall area, independent of radar',
      'Wet-season rule: cumulative rainfall >75 mm/72 h triggers mandatory geotech crest inspection before loading resumes',
      'Install horizontal drains on south wall to relieve pore pressure; review bench design against wet-season strength parameters',
      'Geotech awareness training for supervisors and operators (crack recognition, reporting duty)',
    ],
    complianceFlags: [
      { regulation: 'Kepmen ESDM 1827K/30/MEM/2018', clause: 'Appendix II — geotechnical management & slope monitoring', status: 'GAP', note: 'Work continued under an identified geotechnical hazard; TARP response failed' },
      { regulation: 'Permen ESDM 26/2018', clause: 'Art. 12 — kaidah teknik pertambangan yang baik', status: 'GAP', note: 'Good mining practice requires hazard-triggered stop-work authority to function' },
      { regulation: 'SMKP Minerba — Element 2', clause: 'Risk management (IBPR)', status: 'PARTIAL', note: 'Rainfall trigger absent from slope-risk register' },
      { regulation: 'ISO 45001:2018', clause: '8.2 — emergency preparedness and response', status: 'PARTIAL', note: 'Evacuation executed but initiation was delayed' },
    ],
    narrative: 'Active deformation above an occupied loading area is a credible multiple-fatality scenario. The radar did its job; the management system did not — 2.5 hours of exposure after visual confirmation is the headline finding. The corrective set must make stop-work automatic on leading indicators (cracks, velocity trend, rainfall) rather than waiting for alarm thresholds tuned for normal conditions.',
  },
  'conveyor-guard': {
    severity: { level: 4, label: 'High potential (uncontrolled energy — entanglement potential)' },
    riskScore: { likelihood: 4, consequence: 4 },
    hazardCategories: ['Machine guarding', 'Energy isolation (LOTO)', 'Permit to work', 'Production pressure'],
    rootCauses: [
      'Task performed on live conveyor without isolation — LOTO procedure bypassed',
      'Guard removed under production pressure; supervisor instruction prioritised stockpile over isolation',
      'OCC stop-approval process perceived as too slow, incentivising live work',
      'No permit-to-work raised; task not risk-assessed (JSA absent)',
    ],
    immediateActions: [
      'Stop work authority briefing: no guard removal on energised conveyors under any circumstance',
      'Reinstate guard with fixings requiring tools; tag CV-103 tail area pending inspection',
      'Formal counselling/coaching of supervisor and fitter; capture statement on production-pressure instruction',
      'Review CCTV with crew as a learning case (11 minutes of full-speed exposure)',
    ],
    preventiveActions: [
      'Streamline OCC conveyor-stop approval to ≤10 minutes for maintenance isolation requests — remove the incentive to work live',
      'Install interlocked guards (guard removal trips the drive) on CV-103 pulleys',
      'Belt-cleaning standard: blocked-roller clearing only under full isolation with permit; provide remote water-lance alternative',
      'Audit permit-to-work compliance monthly; include contractor crews',
    ],
    complianceFlags: [
      { regulation: 'Kepmen ESDM 1827K/30/MEM/2018', clause: 'Appendix III — safe work systems (isolation, permit to work)', status: 'GAP', note: 'Live work on conveyor without isolation or permit' },
      { regulation: 'SMKP Minerba — Element 6', clause: 'Operational control — energy isolation', status: 'GAP', note: 'LOTO bypass with supervisor knowledge indicates systemic, not individual, failure' },
      { regulation: 'Permen ESDM 26/2018', clause: 'Art. 14 — SMKP implementation', status: 'PARTIAL', note: 'Production-pressure override of safety procedure points to leadership element weakness' },
      { regulation: 'ISO 45001:2018', clause: '5.4 — consultation & participation / stop-work', status: 'PARTIAL', note: 'Workers did not feel empowered to insist on isolation' },
    ],
    narrative: 'A steel bar ejected from a 4.2 m/s belt is a lethal projectile, and a hand following it into the nip point is an amputation or worse. The deeper finding is organisational: when the sanctioned route to stop a conveyor is slower than the production clock, live work becomes the de facto procedure. Fix the approval latency and interlock the guards — counselling alone will not hold.',
  },
  'fatigue-berm': {
    severity: { level: 3, label: 'Moderate (actual) / High potential (fatigue + tip head)' },
    riskScore: { likelihood: 4, consequence: 4 },
    hazardCategories: ['Operator fatigue', 'Tip head / edge protection', 'Alarm management'],
    rootCauses: [
      'Microsleep on 4th consecutive night shift — roster design concentrates fatigue risk at 03:00–05:00',
      'DSS fatigue alerts (3 in 90 min) displayed at dispatch but no escalation protocol acted on them',
      'Berm at tip head 1.1 m vs 1.6 m standard — degraded last line of defence',
      'No proactive fatigue intervention available on night shift (rotation, controlled nap, task swap)',
    ],
    immediateActions: [
      'Rebuild WD-North berms to ≥ half wheel height (1.6 m for HD785) before tipping resumes',
      'Operator stood down with fatigue assessment (non-punitive); short-nap protocol applied',
      'Dispatch instruction: 2+ DSS alerts in 60 min = mandatory radio contact + rest break',
    ],
    preventiveActions: [
      'Wire DSS alerts to an escalation SLA (contact within 5 min, supervisor decision logged)',
      'Review night-roster pattern (4th consecutive night is the statistical fatigue peak in DSS data)',
      'Berm-height verification on every dump-shift handover, recorded in pre-start checklist',
      'Trial fatigue-risk-informed task rotation after 02:00 (haul ↔ ancillary)',
    ],
    complianceFlags: [
      { regulation: 'Kepmen ESDM 1827K/30/MEM/2018', clause: 'Appendix II — dump/tip head management & edge protection', status: 'GAP', note: 'Berm height 1.1 m below the ≥half-wheel-height standard' },
      { regulation: 'SMKP Minerba — Element 3', clause: 'Health management — fatigue', status: 'PARTIAL', note: 'Fatigue technology installed but the response loop is open' },
      { regulation: 'ISO 45001:2018', clause: '6.1 — actions to address risks', status: 'PARTIAL', note: 'Known fatigue risk window not reflected in roster controls' },
    ],
    narrative: 'The actual damage is a mudguard; the potential is a truck over a tip head. Two independent barriers were degraded at once — the human (fatigue, unanswered alerts) and the physical (substandard berm). The cheap fix is the berm; the durable fix is closing the loop on the fatigue-monitoring system the site has already paid for.',
  },
};

export function safetyFallback({ sampleId, report = '' } = {}) {
  if (sampleId && SAFETY_BY_SAMPLE[sampleId]) return SAFETY_BY_SAMPLE[sampleId];

  // Generic-but-credible analysis for free-text reports.
  const text = report.toLowerCase();
  const cats = [];
  if (/(truck|haul|vehicle|lv|kendaraan)/.test(text)) cats.push('Vehicle interaction');
  if (/(slope|wall|crack|longsor|geotech|rain)/.test(text)) cats.push('Ground/strata stability');
  if (/(conveyor|guard|isolat|loto|belt)/.test(text)) cats.push('Machine guarding / energy isolation');
  if (/(fatigue|lelah|microsleep|night shift)/.test(text)) cats.push('Operator fatigue');
  if (/(blast|explosi|ledak)/.test(text)) cats.push('Explosives / blasting');
  if (cats.length === 0) cats.push('General operational hazard');

  return {
    severity: { level: 3, label: 'Moderate (pending investigation)' },
    riskScore: { likelihood: 3, consequence: 4 },
    hazardCategories: cats,
    rootCauses: [
      'Procedural barrier present but not consistently applied at the work front',
      'Hazard identification occurred but escalation to a control decision was delayed',
      'Supervision and task-risk controls not matched to the changed conditions described',
    ],
    immediateActions: [
      'Secure/barricade the affected area and stand down the directly involved equipment',
      'Brief the oncoming shift on the event and interim controls before work resumes',
      'Preserve evidence (telemetry, CCTV, statements) and open an ICAM investigation',
    ],
    preventiveActions: [
      'Update the IBPR (risk register) entry for this task with the observed failure mode',
      'Verify the relevant SOP trigger conditions and authority-to-stop are unambiguous',
      'Schedule a field leadership verification on the same task within 14 days',
    ],
    complianceFlags: [
      { regulation: 'Kepmen ESDM 1827K/30/MEM/2018', clause: 'Appendix II — operational safety requirements', status: 'REVIEW', note: 'Verify the applicable technical appendix controls for this task' },
      { regulation: 'SMKP Minerba — Element 2', clause: 'Risk management (IBPR)', status: 'PARTIAL', note: 'Event indicates the risk register entry needs revalidation' },
      { regulation: 'ISO 45001:2018', clause: '10.2 — incident, nonconformity & corrective action', status: 'OPEN', note: 'Formal investigation and corrective-action tracking required' },
    ],
    narrative: 'Based on the report narrative, the event pattern is a known hazard with a documented control that failed in application rather than in design. The investigation should focus on why the barrier was absent or bypassed at the moment of the event — workload, clarity of trigger conditions, and authority to stop work are the usual suspects in this class of incident.',
  };
}

// ── Production / blending ─────────────────────────────────────────────────────
export function productionFallback({ blend = {}, assays = {}, throughputTph = 312, target = 1.8 } = {}) {
  const grades = {
    sapHi: Number(assays.sapHi ?? 2.02),
    sapMed: Number(assays.sapMed ?? 1.74),
    limonite: Number(assays.limonite ?? 1.35),
  };
  const b = {
    sapHi: Number(blend.sapHi ?? 50),
    sapMed: Number(blend.sapMed ?? 35),
    limonite: Number(blend.limonite ?? 15),
  };
  const total = b.sapHi + b.sapMed + b.limonite || 100;
  const current = (b.sapHi * grades.sapHi + b.sapMed * grades.sapMed + b.limonite * grades.limonite) / total;

  // Recommended blend: clear the target with a small buffer while minimising
  // Saprolite HG draw. Fix limonite, then solve sapHi exactly:
  //   sapHi*(gHi-gMed) = 100*goal - 100*gMed + lim*(gMed-gLim)
  const goal = target + 0.02;
  const lim = Math.max(5, Math.min(30, current >= goal ? b.limonite + 5 : b.limonite - 5));
  let hi = (100 * goal - 100 * grades.sapMed + lim * (grades.sapMed - grades.limonite)) / (grades.sapHi - grades.sapMed);
  hi = Math.max(20, Math.min(85, Math.round(hi)));
  const rec = { sapHi: hi, sapMed: 100 - hi - lim, limonite: lim };
  const recGrade = (rec.sapHi * grades.sapHi + rec.sapMed * grades.sapMed + rec.limonite * grades.limonite) / 100;

  return {
    estimatedGradeNi: Number(current.toFixed(3)),
    recommendedBlend: { ...rec, grade: Number(recGrade.toFixed(3)) },
    forecast24h: {
      tonnes: Math.round(throughputTph * 22.5),
      grade: Number(recGrade.toFixed(2)),
      recoveryPct: 89.4,
    },
    bottleneck: 'CR-02 cone crusher at 94% utilisation — limits limonite-heavy blends (higher moisture, lower crushability)',
    recommendations: [
      current < target
        ? `Current blend runs ${(target - current).toFixed(2)} pts under the ${target}% Ni RKEF target — lift Saprolite HG to ~${rec.sapHi}% and pull limonite back to ~${rec.limonite}%`
        : `Current blend clears target by ${(current - target).toFixed(2)} pts — trade ~5% Saprolite HG for limonite to preserve high-grade pad life at equal spec`,
      'Draw Saprolite HG from stockpile SP-1 east face (1.94% assay) rather than fresh ex-pit to smooth grade variance',
      'Schedule CR-02 liner inspection during Saturday window — utilisation at 94% leaves no recovery headroom for upsets',
      'Hold limonite ≤30% while stockpile moisture is above 24% (wet-season kiln stability rule)',
    ],
    narrative: `At ${b.sapHi}/${b.sapMed}/${b.limonite} the blended feed grades ${current.toFixed(2)}% Ni against the ${target}% target. The recommended ${rec.sapHi}/${rec.sapMed}/${rec.limonite} mix holds spec with a small buffer while minimising consumption of the high-grade pad — the scarce resource in this system. CR-02 remains the binding constraint: every percentage point of limonite adds disproportionate load to the cone circuit, so blend changes should be sequenced with crusher maintenance in view.`,
  };
}
