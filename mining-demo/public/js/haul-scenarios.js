// Canonical Hauling Optimisation model — the single source of truth for the
// haul-circuit demo, shared by the browser console (public/js/haul.js) and the
// server-side API fallback (data/haul.js). DOM-free and framework-free.
//
// This is no longer a table of canned snapshots. The KPIs are *computed* from a
// circuit state (active trucks, loaders up, measured cycle time, payload, wet
// ramp, demand, hopper level): computeMetrics() derives delivered t/h, match
// factor, utilisation, the per-resource constraint bars and the binding
// constraint; optimise() runs a deterministic dispatch optimiser that returns
// the achievable rate, the merged recommended actions and the trade-off
// strategies; forecastStarve() Monte-Carlos the hopper to a real starve risk.
// buildMetrics(key) wires them together for a nominal scenario so the server
// fallback and the initial client render share the exact same numbers the live
// simulation will converge to.

export const BASE_DEMAND = 1900;
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const usd = (n) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.round(n / 1e3) + 'k');

// ── Physical parameters (calibrated so the balanced state ≈ 1,985 t/h) ─────────
export const PARAMS = {
  TRUCKS: 9, LOADERS: 2, PAYLOAD: 88,
  CT_NOM: 24,        // nominal truck cycle time, min
  LT_BAL: 5.33,      // loader interval giving MF=1 at 9 trucks / 2 loaders
  LT_SVC: 3.0,       // physical loader service time → 1 loader ≈ 1,760 t/h
  HOP_CAP_MIN: 19,   // a full surge hopper ≈ 19 min of demand buffer
  HOP_SETPOINT: 68,  // control setpoint, % full
  VALUE_PER_TPH: 18000, // $/yr value of one sustained t/h of delivered rate
  WET_CT: 1.10,      // wet ramp stretches cycle time
};

// Scenario = a perturbation of the nominal circuit, not a canned result.
export const SCENARIOS = {
  'optimise': { hop0: 68 },
  'truck-down': { downIds: ['HT-105'], hop0: 47 },
  'loader-down': { loaderDown: 'LD-2', hop0: 30 },
  'road-wet': { wet: true, hop0: 44 },
  'demand-surge': { demandMult: 1.16, payload: 92, cadence: 0.96, hop0: 38 },
};

export function nominalState(key) {
  const P = SCENARIOS[key] || SCENARIOS.optimise;
  const wet = !!P.wet;
  const demand = Math.round(BASE_DEMAND * (P.demandMult || 1));
  return {
    key, wet, demand,
    active: PARAMS.TRUCKS - (P.downIds ? P.downIds.length : 0),
    loadersUp: PARAMS.LOADERS - (P.loaderDown ? 1 : 0),
    cadence: P.cadence || 1,
    ct: PARAMS.CT_NOM * (wet ? PARAMS.WET_CT : 1) * (P.cadence || 1),
    payload: P.payload || PARAMS.PAYLOAD,
    hopLevel: P.hop0 ?? PARAMS.HOP_SETPOINT,
    downIds: P.downIds || [], loaderDown: P.loaderDown || null,
    demandMult: P.demandMult || 1,
  };
}

// ── computeMetrics: emergent KPIs from a circuit state ─────────────────────────
export function computeMetrics(s) {
  const { TRUCKS, CT_NOM, LT_BAL, LT_SVC } = PARAMS;
  const truckCap = s.active * s.payload * 60 / s.ct;          // t/h trucks can move
  const loaderCap = s.loadersUp * s.payload * 60 / LT_SVC;    // t/h loaders can serve
  const mf = (s.active * LT_BAL) / (s.loadersUp * s.ct);      // match factor
  const eff = 1 - Math.min(0.25, Math.max(0, mf - 1) * 0.13); // over-trucking queue loss
  const delivered = Math.min(truckCap, loaderCap) * eff;

  const nomCap = TRUCKS * s.payload * 60 / CT_NOM;
  const util = Math.round(Math.max(55, Math.min(99, delivered / nomCap * 88)));

  const bars = {
    loader: Math.round(Math.min(100, delivered / loaderCap * 100 + (s.loadersUp < PARAMS.LOADERS ? 12 : 0))),
    'haul-road': Math.round(Math.min(100, 71 * (s.ct / CT_NOM) * (s.wet ? 1.22 : 1))),
    'jetty-hopper': Math.round(Math.min(100, 64 * s.demand / BASE_DEMAND)),
    fleet: Math.round(Math.min(100, mf * 90)),
  };

  // Binding constraint: physical limits take priority, else the busiest resource.
  let binding;
  if (s.loadersUp < PARAMS.LOADERS) binding = 'loader';
  else if (s.wet && bars['haul-road'] >= bars.fleet) binding = 'haul-road';
  else if (s.active < TRUCKS || mf < 0.97) binding = 'fleet';
  else binding = Object.keys(bars).reduce((a, b) => (bars[b] > bars[a] ? b : a));

  const hopMin = Math.round(s.hopLevel / 100 * PARAMS.HOP_CAP_MIN);
  const cnote = {
    loader: 'All ore funnels through one loader — trucks bunch and queue (over-trucked).',
    'haul-road': 'Wet 8% ramp cuts traction — cycle time stretches and TKPH headroom thins.',
    'jetty-hopper': 'Barge loadout demand is pacing the circuit — hopper draw is the limit.',
    fleet: s.active < TRUCKS ? 'A truck out drops loaded count below the loaders’ feed rate — under-trucked.'
      : 'Fleet near balanced — loaders carry slack; small moves bank headroom.',
  }[binding];

  return { delivered: Math.round(delivered), demand: s.demand, mf: +mf.toFixed(2), util, binding, bars,
    hopPct: Math.round(s.hopLevel), hopMin, truckCap, loaderCap, cnote };
}

// ── optimise: deterministic dispatch optimiser + merged action plan ────────────
export function optimise(s, metrics) {
  const { CT_NOM, LT_SVC, VALUE_PER_TPH } = PARAMS;
  const liftPayload = Math.min(92, s.payload + 2);
  const under = s.active < PARAMS.TRUCKS || metrics.mf < 0.95;
  const cadenceGain = under ? 1.04 : 1.0;          // tighten spot time when under-trucked
  const truckCapOpt = s.active * liftPayload * 60 / s.ct * cadenceGain;
  const loaderCapOpt = s.loadersUp * liftPayload * 60 / LT_SVC * 0.99;
  const headroom = Math.max(metrics.demand, metrics.delivered) + 120;
  const optimised = Math.round(Math.min(truckCapOpt, loaderCapOpt, headroom));
  const current = metrics.delivered;
  const delta = optimised - current;

  let value = Math.max(1.8e6, Math.round(Math.abs(delta) * VALUE_PER_TPH));
  if (s.demandMult > 1) value += 3.5e6;            // demurrage protection on a laycan barge

  // Merged recommended actions: unit-level moves with quantified impact + horizon.
  const A = (unit, action, detail, delta, timeframe) => ({ unit, action, detail,
    delta: (typeof delta === 'number' ? (delta >= 0 ? '+' : '') + delta + ' t/h' : delta),
    deltaColor: (typeof delta === 'number' && delta < 0) ? '#c0392b' : '#16915a',
    tagColor: { reassign: '#0e7490', hold: '#b45309', release: '#15803d', refuel: '#a78b2e', reroute: '#7c5cff', payload: '#0f766e', surge: '#15803d', repair: '#c0392b', flag: '#6b7264', water: '#0e7490' }[action] || '#6b7264',
    timeframe });
  const marginal = Math.max(40, Math.round(delta));
  let actions, headlinePrefix, narrative;

  if (metrics.binding === 'loader') {
    const hold = Math.max(2, s.active - Math.round(s.loadersUp * CT_NOM / PARAMS.LT_BAL));
    actions = [
      A('HT-106', 'hold', `Park as spare — one loader can’t absorb ${s.active} trucks`, 0, 'now'),
      A(s.loaderDown || 'LD-2', 'repair', `Expedite repair — restores +${marginal} t/h marginal capacity`, marginal, 'ETA 90 min'),
      A('LD-1', 'payload', 'Lift to the 10/10/20 policy ceiling on the live loader', 40, 'now'),
    ];
    headlinePrefix = `${s.loaderDown || 'A loader'} down — single-loader cap holds delivery to ~${fmt(optimised)} t/h`;
    narrative = `With ${s.loaderDown || 'a loader'} out, the loader is the binding constraint: ${s.active} trucks chase one loader (MF ${metrics.mf}) and bunch the queue, yet delivery is capped near ${fmt(optimised)} t/h. Holding ${hold} trucks as spares restores MF toward 1.0 and cuts queue loss; the only path past the cap is bringing the loader back. Hopper buffer is the live risk at ${metrics.hopMin} min.`;
  } else if (metrics.binding === 'haul-road') {
    actions = [
      A('LD-1', 'payload', 'Trim to 88 t to protect tyre TKPH on the wet grade', -10, 'until dry'),
      A('FLEET', 'reroute', 'Eco-speed downhill, 22 km/h cap on the ramp', 35, 'now'),
      A('OPS', 'water', 'Schedule watering passes off-peak — dust control without traction loss', 30, 'now'),
    ];
    headlinePrefix = `Ramp wet — cycle time stretched, haul-road is the binding constraint`;
    narrative = `Watering the wet 8% ramp cuts traction, stretching cycle time to ${Math.round(s.ct)} min and pushing the haul-road to ${metrics.bars['haul-road']}% — the binding constraint. Capping ramp speed at 22 km/h and trimming payload to 88 t protects tyre TKPH in wet-season heat while recovering ~${fmt(delta)} t/h. Loaders and hopper still carry slack.`;
  } else if (s.demandMult > 1) {
    actions = [
      A('FLEET', 'surge', 'All 9 in circuit — defer crib breaks 30 min', 40, 'now'),
      A('LD-2', 'payload', 'Policy-ceiling payloads to chase demand', 20, 'now'),
      A('HOPPER', 'hold', 'Pre-build to 80% ahead of the forecast 14:00 swell', 0, '+2 h'),
    ];
    headlinePrefix = `Laycan-critical barge — demand ${fmt(s.demand)} t/h, surge the fleet to build buffer`;
    narrative = `A laycan-critical barge lifts loadout demand to ${fmt(s.demand)} t/h, making the fleet binding at full surge (~${fmt(optimised)} t/h). The optimiser deploys all nine trucks, defers crib breaks and pre-builds the hopper to 80% ahead of the window — accepting a small fuel-per-tonne penalty because protected demurrage dwarfs it.`;
  } else if (s.active < PARAMS.TRUCKS) {
    const downId = s.downIds[0] || 'HT-105';
    actions = [
      A('HT-104', 'reassign', 'Pull the LD-2 spare to LD-1 to refill its cadence', 45, 'now'),
      A('HT-102', 'release', 'End crib break early, return to the circuit now', 25, '+5 min'),
      A(downId, 'flag', 'Hand the cycle-time outlier to Maintenance', 0, 'this shift'),
    ];
    headlinePrefix = `${downId} down — delivered ${fmt(current)} t/h, ${fmt(metrics.demand - current)} below the ${fmt(metrics.demand)} line`;
    narrative = `A single truck loss pushes the fleet under-trucked (MF ${metrics.mf}), starving the loaders and dipping delivery ${fmt(metrics.demand - current)} t/h below barge demand. Reassigning the spare and ending one crib break early restores match factor toward 1.0 and lifts delivery back toward the ${fmt(metrics.demand)} line.`;
  } else {
    actions = [
      A('HT-103', 'refuel', 'Stagger refuel to 11:40 to avoid a feed dip', 0, 'rolling'),
      A('HT-108', 'hold', 'Brief hold — trim MF toward 1.0', 15, 'continuous'),
      A('LD-2', 'payload', 'Nudge mean payload to 89 t', 10, 'now'),
    ];
    headlinePrefix = `Delivered ${fmt(current)} t/h vs ${fmt(metrics.demand)} demand — meeting demand with headroom`;
    narrative = `The circuit is running balanced — MF ${metrics.mf}, delivery near the barge demand line, hopper buffer a healthy ${metrics.hopMin} min. The optimiser’s moves bank headroom: staggering refuels and trimming match factor toward 1.0 keep the queue minimal ahead of the 19:00 shift handover.`;
  }

  const headline = `${headlinePrefix} — optimiser lifts to ${fmt(optimised)} t/h.`;
  const strategies = {
    'protect-demand': { name: 'Protect demand', tag: '✓ recommended', desc: 'Hold delivery on the barge line; accept a touch more fuel.', rate: optimised, fuel: '+0.2 L/t', value: usd(value), optimised },
    'max-throughput': { name: 'Max throughput', tag: 'option', desc: 'Push delivered rate hard; risk queue + fuel/t.', rate: optimised + 60, fuel: '+0.5 L/t', value: usd(value * 1.15), optimised: optimised + 60 },
    'min-fuel': { name: 'Min fuel / tonne', tag: 'option', desc: 'Ease cadence to the demand line; lowest cost per tonne.', rate: Math.min(current, metrics.demand), fuel: '−0.3 L/t', value: usd(value * 0.85), optimised: Math.min(current, metrics.demand) },
  };
  // recs alias keeps the /api/haul/analyze response shape ({action,impact,timeframe}).
  const recs = actions.map((a) => ({ action: (a.unit && a.unit !== 'FLEET' && a.unit !== 'OPS' && a.unit !== 'HOPPER' ? a.unit + ' — ' : '') + a.detail, impact: a.delta, timeframe: a.timeframe }));
  return { current, optimised, value, actions, recs, strategies, headline, narrative };
}

// ── forecastStarve: Monte-Carlo hopper-starve risk over a 4h horizon ───────────
// `recoverTo` is the rate the crew/optimiser can hold the circuit at (the
// achievable/optimised rate). Trials drift delivery toward it between random
// truck/loader hiccups, so only an unrecoverable deficit (e.g. a loader down,
// which can't meet demand on one machine) reliably starves the hopper.
export function forecastStarve(s, metrics, recoverTo = metrics.delivered, trials = 400) {
  const capT = PARAMS.HOP_CAP_MIN / 60 * metrics.demand;     // tonnes at 100%
  const level0 = s.hopLevel / 100 * capT;
  const H = 4, STEP = 0.1;
  let starves = 0; const times = [];
  for (let t = 0; t < trials; t++) {
    let lvl = level0, deliv = metrics.delivered, starved = false;
    for (let h = 0; h < H; h += STEP) {
      if (Math.random() < 0.015) deliv *= (0.82 + Math.random() * 0.1); // random hiccup
      else deliv += (recoverTo - deliv) * 0.3;                          // recover toward achievable
      const net = deliv * (1 + (Math.random() - 0.5) * 0.06) - metrics.demand;
      lvl = Math.min(capT, lvl + net * STEP);
      if (lvl <= 0 && !starved) { starved = true; times.push(h); }
    }
    if (starved) starves++;
  }
  times.sort((a, b) => a - b);
  const med = times.length ? times[Math.floor(times.length / 2)] : null;
  return { starvePct: Math.round(starves / trials * 100), minToStarve: med != null ? Math.round(med * 60) : null };
}

// ── buildMetrics: nominal scenario → one merged snapshot (server + initial) ─────
export function buildMetrics(key) {
  const s = nominalState(key);
  const metrics = computeMetrics(s);
  const plan = optimise(s, metrics);
  const forecast = forecastStarve(s, metrics, plan.optimised);
  return {
    ...metrics, ...plan,
    starvePct: forecast.starvePct, minToStarve: forecast.minToStarve,
    wet: s.wet, down: s.downIds, loaderDown: s.loaderDown, demandMult: s.demandMult,
    moved: plan.actions.map((a) => a.unit).filter((u) => /^HT-\d/.test(u)),
    fa: plan.actions, // back-compat alias
    parsed: '',
  };
}
