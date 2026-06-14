// Canonical Hauling Optimisation scenario data — the single source of truth for
// the deterministic haul-circuit demo. Both the browser console (public/js/haul.js)
// and the server-side API fallback (data/haul.js) import buildMetrics() from here,
// so the headline / rates / match-factor / recommendations / narrative copy can
// never drift between client and server. DOM-free and framework-free by design.

export const BASE_DEMAND = 1900;
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const usd = (n) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.round(n / 1e3) + 'k');

// Fleet-action tag colours (light theme) — presentation that travels with the data.
const TAG = { reassign: '#0e7490', hold: '#b45309', release: '#15803d', refuel: '#a78b2e', reroute: '#7c5cff', payload: '#0f766e', surge: '#15803d' };
const fa = (unit, action, detail, delta) => ({ unit, action, detail, delta: (delta >= 0 ? '+' : '') + delta + ' t/h', deltaColor: delta >= 0 ? '#16915a' : '#c0392b', tagColor: TAG[action] || '#6b7264' });

// buildMetrics(key) → the full deterministic circuit snapshot for a scenario.
// Returns delivered/demand rates, the binding constraint, per-resource utilisation
// bars, fleet actions, recommendations, the narrative and the three trade-off
// strategies. The server fallback maps a subset of these onto the API response.
export function buildMetrics(key) {
  const D = BASE_DEMAND;
  let s;
  if (key === 'truck-down') {
    s = { demand: D, delivered: 1815, mf: 0.92, util: 84, hopPct: 41, hopMin: 7, binding: 'fleet', starvePct: 9,
      bars: { loader: 70, 'haul-road': 68, 'jetty-hopper': 58, fleet: 95 },
      cnote: 'One truck out drops the loaded count below the loaders’ feed rate — under-trucked.',
      headline: 'HT-105 down — delivered 1,815 t/h, 85 below the 1,900 demand line. Re-balance recovers it.',
      current: 1815, optimised: 1900, baseFuel: 0.1,
      fa: [fa('HT-104', 'reassign', 'Pull from LD-2 spare to LD-1 to refill its cadence', 45), fa('HT-102', 'release', 'End crib break early, return to circuit now', 25), fa('HT-107', 'payload', 'Lift to 90 t within 10/10/20 policy', 15)],
      recs: [{ action: 'Re-balance fleet 5/3 across loaders', impact: '+85 t/h, queue −2 min/cyc', timeframe: 'now' }, { action: 'Stagger HT-103 refuel to 11:40', impact: 'holds feed above demand line', timeframe: '+25 min' }, { action: 'Flag HT-105 outlier to Maintenance', impact: 'pre-empts a second failure', timeframe: 'this shift' }],
      value: 1.9e6,
      narrative: 'A single truck loss pushes the fleet under-trucked (MF 0.92), starving the loaders and dipping delivery 85 t/h below barge demand. Reassigning the LD-2 spare and ending one crib break early restores match factor to ~1.0 and lifts delivery back to the 1,900 line.',
      moved: ['HT-104', 'HT-102'], down: ['HT-105'], loaderDown: null, wet: false, parsed: 'Parsed: 1 truck DOWN (HT-105) → re-balance' };
  } else if (key === 'loader-down') {
    s = { demand: D, delivered: 1560, mf: 1.28, util: 79, hopPct: 28, hopMin: 5, binding: 'loader', starvePct: 46,
      bars: { loader: 100, 'haul-road': 60, 'jetty-hopper': 47, fleet: 72 },
      cnote: 'All ore funnels through LD-1 — trucks bunch and queue (over-trucked on one loader).',
      headline: 'LD-2 down — single-loader cap holds delivery to ~1,740 t/h. Hold trucks to kill the queue.',
      current: 1560, optimised: 1740, baseFuel: 0.0,
      fa: [fa('HT-106', 'hold', 'Park as spare — LD-1 can’t absorb 9 trucks', 0), fa('HT-108', 'hold', 'Stage at SP-1; release as LD-1 frees', 0), fa('HT-103', 'payload', 'Max policy payload to lift per-cycle tonnes', 40)],
      recs: [{ action: 'Hold 3 trucks — run LD-1 at MF 1.0', impact: 'queue 6→2 min/cyc, +180 t/h', timeframe: 'now' }, { action: 'Expedite LD-2 repair', impact: 'restores +180 t/h marginal capacity', timeframe: 'ETA 90 min' }, { action: 'Surge payload to policy ceiling on LD-1', impact: '+40 t/h within 10/10/20', timeframe: 'now' }],
      value: 4.2e6,
      narrative: 'With LD-2 out, the loader is the binding constraint: nine trucks chasing one loader drives MF to 1.28 and bunches the queue, yet delivery is capped at ~1,740 t/h. Holding three trucks as spares restores MF to ~1.0; the only path past the cap is bringing LD-2 back. Hopper buffer is the live risk at 5 minutes.',
      moved: ['HT-106', 'HT-107', 'HT-108', 'HT-109', 'HT-101'], down: [], loaderDown: 'LD-2', wet: false, parsed: 'Parsed: LOADER DOWN (LD-2) → hold 3, expedite repair' };
  } else if (key === 'road-wet') {
    s = { demand: D, delivered: 1735, mf: 0.97, util: 83, hopPct: 44, hopMin: 8, binding: 'haul-road', starvePct: 18,
      bars: { loader: 74, 'haul-road': 96, 'jetty-hopper': 60, fleet: 88 },
      cnote: 'Wet 8% ramp cuts traction — cycle time stretches and TKPH headroom thins.',
      headline: 'Ramp wet — cycle time +2.4 min stretches the haul-road to the binding constraint.',
      current: 1735, optimised: 1880, baseFuel: 0.2,
      fa: [fa('LD-1', 'payload', 'Trim to 88 t to protect tyre TKPH on the wet grade', -10), fa('HT-102', 'reroute', 'Eco-speed downhill, 22 km/h cap on ramp', 35), fa('HT-105', 'reroute', 'Speed discipline — no bunching on grade', 30)],
      recs: [{ action: 'Schedule watering passes off-peak', impact: 'dust control without traction loss, +90 t/h', timeframe: 'now' }, { action: 'Cap ramp speed at 22 km/h', impact: 'protects TKPH, fuel −0.4 L/t', timeframe: 'now' }, { action: 'Trim payload to 88 t on wet cycles', impact: 'tyre-failure risk down, holds cadence', timeframe: 'until dry' }],
      value: 2.6e6,
      narrative: 'Watering the wet 8% ramp cuts traction, stretching cycle time and pushing the haul-road to 96% — the binding constraint. Capping ramp speed at 22 km/h and trimming payload to 88 t protects tyre TKPH in wet-season heat while recovering ~145 t/h. The loaders and hopper still have slack.',
      moved: ['HT-102', 'HT-105'], down: [], loaderDown: null, wet: true, parsed: 'Parsed: RAMP WET → watering + speed cap' };
  } else if (key === 'demand-surge') {
    const dd = Math.round(D * 1.16);
    s = { demand: dd, delivered: 2080, mf: 1.04, util: 92, hopPct: 35, hopMin: 6, binding: 'fleet', starvePct: 34,
      bars: { loader: 90, 'haul-road': 85, 'jetty-hopper': 78, fleet: 97 },
      cnote: 'Laycan-critical barge lifts demand to ' + fmt(dd) + ' t/h — fleet is now binding.',
      headline: 'Laycan-critical barge — demand ' + fmt(dd) + ' t/h. Surge the fleet to build buffer ahead of the window.',
      current: 2080, optimised: 2150, baseFuel: 0.3,
      fa: [fa('HT-106', 'surge', 'All 9 in circuit — defer crib breaks 30 min', 40), fa('HT-108', 'surge', 'Hold zero spares, max cadence', 20), fa('LD-2', 'payload', 'Policy-ceiling payloads to chase demand', 10)],
      recs: [{ action: 'Surge all 9 trucks, defer crib breaks', impact: '+70 t/h, builds hopper buffer', timeframe: 'now' }, { action: 'Accept +0.3 L/t fuel to chase demand', impact: 'demurrage protection outweighs fuel', timeframe: 'this barge' }, { action: 'Pre-build hopper to 80% before swell', impact: 'covers forecast 14:00 swell stall', timeframe: '+2 h' }],
      value: 5.6e6,
      narrative: 'A laycan-critical barge lifts loadout demand to ' + fmt(dd) + ' t/h, making the fleet binding at full surge (~2,150 t/h). The AI deploys all nine trucks, defers crib breaks, and pre-builds the hopper to 80% ahead of the window and a forecast 14:00 swell — accepting a small fuel-per-tonne penalty because protected demurrage dwarfs it.',
      moved: ['HT-106', 'HT-108'], down: [], loaderDown: null, wet: false, parsed: 'Parsed: DEMAND SURGE (laycan-critical) → fleet surge' };
  } else {
    s = { demand: D, delivered: 1985, mf: 1.01, util: 88, hopPct: 68, hopMin: 13, binding: 'fleet', starvePct: 1,
      bars: { loader: 82, 'haul-road': 71, 'jetty-hopper': 64, fleet: 90 },
      cnote: 'Fleet near balanced — loaders carry slack; small moves bank headroom.',
      headline: 'Delivered 1,985 t/h vs 1,900 demand — meeting demand with 4% headroom.',
      current: 1985, optimised: 2010, baseFuel: 0.2,
      fa: [fa('HT-103', 'refuel', 'Stagger refuel to 11:40 to avoid feed dip', 0), fa('HT-108', 'hold', 'Brief hold — trim MF from 1.04 toward 1.0', 15), fa('LD-2', 'payload', 'Nudge mean payload to 89 t', 10)],
      recs: [{ action: 'Stagger refuels & crib breaks', impact: 'keeps feed above demand, +25 t/h', timeframe: 'rolling' }, { action: 'Hold MF in 0.98–1.03 band', impact: 'queue under 2 min/cyc', timeframe: 'continuous' }, { action: 'Bank hopper buffer to 75% pre-handover', impact: 'covers 19:00 handover gap', timeframe: '+3 h' }],
      value: 2.4e6,
      narrative: 'The circuit is running balanced — MF 1.01, delivery 4% above the barge demand line, hopper buffer a healthy 13 minutes. The AI’s moves here bank headroom: staggering refuels and trimming match factor toward 1.0 keep the queue minimal ahead of the 19:00 shift handover.',
      moved: [], down: [], loaderDown: null, wet: false, parsed: '' };
  }
  const rate = s.optimised, val = s.value;
  s.strategies = {
    'protect-demand': { name: 'Protect demand', tag: '✓ recommended', desc: 'Hold delivery on the barge line; accept a touch more fuel.', rate, fuel: (s.baseFuel >= 0 ? '+' : '') + s.baseFuel.toFixed(1) + ' L/t', value: usd(val), optimised: rate },
    'max-throughput': { name: 'Max throughput', tag: 'option', desc: 'Push delivered rate hard; risk queue + fuel/t.', rate: rate + 60, fuel: '+' + (s.baseFuel + 0.3).toFixed(1) + ' L/t', value: usd(val * 1.15), optimised: rate + 60 },
    'min-fuel': { name: 'Min fuel / tonne', tag: 'option', desc: 'Ease cadence to the demand line; lowest cost per tonne.', rate: s.current, fuel: (s.baseFuel - 0.5).toFixed(1) + ' L/t', value: usd(val * 0.85), optimised: s.current },
  };
  return s;
}
