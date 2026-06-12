// OreSight AI — sample incident reports for the Safety & Compliance demo.
// Shared between the browser (chips that fill the textarea) and the server
// (fallback analyses are keyed by sample id in data/fallbacks.js).

export const SAMPLE_INCIDENTS = [
  {
    id: 'haul-road-fog',
    title: 'Haul road near-miss — fog',
    tag: 'Near miss',
    text: `INCIDENT REPORT — PT KBC Coal Mining, East Kalimantan
Date: 2026-06-08 | Shift: Night (19:00–07:00) | Time of event: 04:40 WITA
Location: Haul road HR-2, km 7+200 (S-curve, 8% grade)

Narrative: Loaded HD785 (unit DT-412, operator on 11th hour of shift) was descending HR-2 in dense fog, visibility estimated 30–40 m. A light vehicle (LV-08, surveyor crew) had stopped on the running lane to check a slumped windrow, hazard lights on but no cones/delineators placed. DT-412 operator saw the LV at approx. 35 m, braked and swerved to the over-take lane, passing within an estimated 3 m of the LV. No contact, no injuries. Both units stood down pending investigation.

Conditions: Dense fog since 03:30, road watering completed 02:00 (road surface wet), radio channel 2 congested with dispatch traffic. Fog procedure (SOP-HR-014: convoy + 40 km/h cap + positive comms at curve) had not been activated by the OCE.`,
  },
  {
    id: 'slope-cracks',
    title: 'Pit slope tension cracks',
    tag: 'Geotech',
    text: `GEOTECHNICAL HAZARD REPORT — Morowali Nickel Operations, Central Sulawesi
Date: 2026-06-10 | Shift: Day | Reported: 09:15 WITA by pit supervisor
Location: Pit 2, south wall, between bench 145 and 130, above active loading area

Narrative: Following 96 mm cumulative rainfall over the past 72 hours, a series of tension cracks (aperture 20–60 mm, mapped length ~85 m) was observed 4–6 m behind the crest of bench 145, directly above the area where EX-202 and three trucks were loading saprolite. Slope radar (SSR-2) shows cumulative deformation of 38 mm over 48 h with velocity increasing to 1.8 mm/h overnight (alarm threshold 2.0 mm/h). Seepage observed at the bench 130 toe. Loading operations continued for approx. 2.5 hours after first visual observation before the geotech engineer was notified and the area was evacuated and barricaded.`,
  },
  {
    id: 'conveyor-guard',
    title: 'Conveyor guard removed while running',
    tag: 'Energy isolation',
    text: `INCIDENT REPORT — Ore Preparation Plant, Morowali
Date: 2026-06-09 | Shift: Day | Time of event: 14:20 WITA
Location: Overland conveyor CV-103, tail pulley area

Narrative: During production, a maintenance fitter removed the tail-pulley guard on CV-103 to clear a material build-up on the return roller while the conveyor was RUNNING, using a steel bar. The bar was caught by the moving belt and ejected, striking the handrail approx. 0.5 m from the fitter's position. No injury. The conveyor was not isolated; no permit-to-work was raised. The fitter stated the supervisor had asked for the blockage to be cleared "before the stockpile runs empty" and that stopping CV-103 requires OCC approval which "takes too long". CCTV confirms the guard was off for approx. 11 minutes with the belt at full speed (4.2 m/s).`,
  },
  {
    id: 'fatigue-berm',
    title: 'Night-shift fatigue — berm contact',
    tag: 'Fatigue',
    text: `INCIDENT REPORT — PT KBC Coal Mining, East Kalimantan
Date: 2026-06-11 | Shift: Night | Time of event: 03:55 WITA
Location: Waste dump WD-North, tip head 3

Narrative: Empty HD785 (unit DT-407) drifted left while reversing to tip head 3 and made contact with the windrow/berm at approx. 8 km/h, riding partially up the berm before stopping. Operator (4th consecutive night shift, 2nd roster week) admitted to a microsleep of "a few seconds". Fatigue camera (DSS) recorded 3 distraction/eye-closure alerts in the preceding 90 minutes; alerts were routed to the dispatch screen but not acted on. No injury; minor damage to left rear mudguard. Berm height at tip head measured 1.1 m (standard: ≥ half wheel height = 1.6 m for HD785).`,
  },
];

export function getSample(id) {
  return SAMPLE_INCIDENTS.find((s) => s.id === id) || null;
}
