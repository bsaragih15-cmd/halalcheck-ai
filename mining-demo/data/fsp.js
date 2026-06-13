// Server-side fallbacks for the Future Scheduling Platform AI endpoints:
// natural-language disruption parsing and the scheduling copilot. Used whenever
// ANTHROPIC_API_KEY is absent or a live call fails, so the demo always responds.

// Map free-text mentions to a chain resource id.
const RES_ALIASES = [
  { rx: /(berth\s*1|jetty\s*1|jet-?\s*1|\bb1\b)/i, res: 'JET-1' },
  { rx: /(berth\s*2|jetty\s*2|jet-?\s*2|\bb2\b)/i, res: 'JET-2' },
  { rx: /(crane|transship|transshipment|fc-?\s*1|floating)/i, res: 'FC-1' },
  { rx: /(3101)/i, res: 'BG-3101' },
  { rx: /(3102)/i, res: 'BG-3102' },
  { rx: /(3103)/i, res: 'BG-3103' },
  { rx: /(3104)/i, res: 'BG-3104' },
  { rx: /(anoa)/i, res: 'MV-ANOA' },
  { rx: /(celebes)/i, res: 'MV-CELEBES' },
];

// Heuristic NL → structured constraint. Mirrors the schema the live model emits.
export function parseDisruptionFallback(text = '') {
  const t = String(text).toLowerCase();
  const numAfter = (re, d) => { const m = t.match(re); return m ? parseFloat(m[1]) : d; };
  const dur = numAfter(/(\d+(?:\.\d+)?)\s*(?:h\b|hr|hour)/, 4);

  let res = null;
  for (const a of RES_ALIASES) if (a.rx.test(t)) { res = a.res; break; }

  let kind = 'outage';
  let magnitudePct = 100;
  let label = 'DISRUPTION';
  let etaShift = null; // signed hours for kind "eta": negative = earlier

  if (/(swell|weather|wind|wave|storm|monsoon|sea state)/.test(t)) {
    kind = 'slowdown'; res = res || 'FC-1';
    magnitudePct = numAfter(/(\d+)\s*%/, 40); label = 'WEATHER SLOWDOWN';
  } else if (/(early|earlier|ahead of schedule)/.test(t) && /(arriv|eta|vessel|mv|ship)/.test(t)) {
    kind = 'eta'; res = res || 'MV-CELEBES'; label = 'ETA EARLIER'; etaShift = -dur;
  } else if (/(late|delay|slip).*(arriv|eta|vessel)|(arriv|eta|vessel).*(late|delay)/.test(t)) {
    kind = 'eta'; res = res || 'MV-CELEBES'; label = 'ETA LATER'; etaShift = dur;
  } else if (/(slow|reduce|reduced|rate|throughput|congest|capacity|%)/.test(t)) {
    kind = 'slowdown'; res = res || 'FC-1'; magnitudePct = numAfter(/(\d+)\s*%/, 30); label = 'SLOWDOWN';
  } else if (res && res.startsWith('BG')) {
    kind = 'hold'; label = 'BARGE HOLD';
  } else if (/(tug|pilot|mooring)/.test(t)) {
    kind = 'slowdown'; res = res || 'FC-1'; magnitudePct = 35; label = 'TUG SHORTAGE';
  } else {
    res = res || 'JET-2'; label = 'OUTAGE';
  }

  if (res && res.startsWith('BG') && kind !== 'hold') kind = 'hold';
  res = res || 'JET-2';
  const barge = res.startsWith('BG') ? res : null;

  return {
    resourceId: res,
    kind,
    start: 15,
    dur: kind === 'eta' ? (etaShift ?? dur) : dur,
    magnitudePct,
    barge,
    label,
    title: `${String(text).trim().slice(0, 90)} — parsed as ${kind} on ${res}${kind === 'slowdown' ? ` (−${magnitudePct}%)` : ''} for ${dur} h`,
    parsed: 'heuristic',
  };
}

// Heuristic copilot answers grounded in the supplied plan state.
export function copilotFallback({ question = '', state = {} } = {}) {
  const q = String(question).toLowerCase();
  const drum = state.drum || 'FC-1';
  const slack = typeof state.laycanSlackH === 'number' ? state.laycanSlackH : 8;
  const slackTxt = `${slack.toFixed(1)} h`;
  const adh = state.adherence != null ? `${state.adherence}%` : '94.2%';

  if (/bottleneck|constraint|drum|binding|limit/.test(q)) {
    return { answer: `The binding constraint this shift is ${drum} — it carries the highest utilisation in the chain, so every idle hour there is throughput the whole system cannot recover. The plan staggers the four barges ~3.5 h apart specifically to keep ${drum} continuously fed; relieving it (a second crane pass or a spare barge) is what moves the bottleneck and unlocks more tonnes.` };
  }
  if (/laycan|demurrage|anoa|vessel|slack|buffer/.test(q)) {
    return { answer: `MV Anoa is holding ${slackTxt} of laycan buffer right now. As long as completion stays inside that window there is no demurrage exposure (rate ~$28k/day). The re-planner sequences loads by laycan exposure rather than first-come-first-served — that ordering is what protects the buffer when a disruption hits.` };
  }
  if (/what if|early|late|arrive|eta|delay/.test(q)) {
    return { answer: `Shift a vessel's ETA and the platform re-solves the 48-h plan against the new laycan window, then re-checks the ${drum} feed and the buffer. Try the free-form box — e.g. "MV Celebes arrives 6 h early" — to see the re-solve and the rationale for what moves and what holds.` };
  }
  if (/adherence|on plan|variance|performance/.test(q)) {
    return { answer: `Schedule adherence is tracking ${adh} over the last 7 days, ~11 points above the legacy hand-of-shift process. Adherence holds because re-plans are published to every resource as one plan in minutes, removing the side-channel improvisation that used to drift the schedule through a shift.` };
  }
  return { answer: `The published plan keeps ${drum} fed with ${slackTxt} of laycan buffer on MV Anoa and is tracking ${adh} adherence. Ask about the bottleneck, laycan/demurrage exposure, schedule adherence, or pose a "what if" on a vessel ETA or a resource outage.` };
}
