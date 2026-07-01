import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { maintenanceFallback, safetyFallback, productionFallback } from './data/fallbacks.js';
import { parseDisruptionFallback, copilotFallback } from './data/fsp.js';
import { haulFallback, haulParseFallback, haulCopilotFallback } from './data/haul.js';
import { irocFallback, irocParseFallback, irocCopilotFallback } from './data/iroc.js';
import { blastFallback, blastParseFallback, blastCopilotFallback } from './data/blast.js';
import { shippingFallback, shippingDisruptionFallback, shippingCopilotFallback } from './data/shipping.js';
import { cockpitBriefFallback } from './data/cockpit.js';
import { boardReadFallback, scenarioFallback, capitalCopilotFallback, opsCopilotFallback } from './data/portfolio.js';
import { USE_CASES } from './public/js/usecases.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const MODEL = 'claude-opus-4-8';
let authFailed = false; // flips the health badge to Demo Mode on a bad key
const aiMode = () => (client && !authFailed ? 'live' : 'simulated');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(join(__dirname, 'public')));
app.get('/', (req, res) => res.redirect('/index.html'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const simulatedLatency = () => sleep(900 + Math.random() * 700);

// ── Abuse / cost protection ───────────────────────────────────────────────────
// These public endpoints each call Claude, so an unthrottled caller could run up
// the Anthropic bill. We add a lightweight per-IP fixed-window rate limit plus a
// short-lived response cache keyed on the exact prompt. Both are in-memory: on
// serverless each warm instance keeps its own state (no cross-instance sharing),
// a deliberate trade-off for a zero-dependency demo — swap in a shared store
// (e.g. Vercel KV) if you need globally enforced limits.
const RL_WINDOW_MS = 60_000;            // window length
const RL_MAX = Number(process.env.HAUL_RL_MAX) || 40; // requests/window/IP
const rlHits = new Map();               // ip -> { count, resetAt }

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}
function rateLimit(req, res, next) {
  const now = Date.now();
  if (rlHits.size > 5000) for (const [k, v] of rlHits) if (now > v.resetAt) rlHits.delete(k);
  const ip = clientIp(req);
  let e = rlHits.get(ip);
  if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + RL_WINDOW_MS }; rlHits.set(ip, e); }
  e.count++;
  res.setHeader('X-RateLimit-Limit', RL_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RL_MAX - e.count));
  if (e.count > RL_MAX) {
    res.setHeader('Retry-After', Math.ceil((e.resetAt - now) / 1000));
    return res.status(429).json({ error: 'Rate limit exceeded — please slow down and retry shortly.' });
  }
  next();
}
// Throttle the AI POST endpoints only; /api/health (GET) stays free for the badge.
app.use((req, res, next) => (req.method === 'POST' && req.path.startsWith('/api/') ? rateLimit(req, res, next) : next()));

// Short-TTL cache of live model responses, keyed on label + prompt hash. Repeated
// identical requests (e.g. the five fixed haul scenarios) reuse one inference.
const CACHE_TTL_MS = Number(process.env.HAUL_CACHE_TTL_MS) || 10 * 60_000;
const respCache = new Map();            // key -> { at, value }
const hashStr = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const cacheKey = (label, systemPrompt, userMessage) => `${label}|${hashStr(systemPrompt + ' ' + userMessage)}`;

// ── Core helper: live Claude call with unbreakable fallback ───────────────────
async function askClaude({ systemPrompt, userMessage, fallback, label }) {
  if (!client) {
    await simulatedLatency(); // feels like inference, never errors
    console.log(`[${label}] simulated (no API key)`);
    return { ...fallback, source: 'simulated' };
  }

  // Serve an identical recent inference from cache to cut latency and API cost.
  const key = cacheKey(label, systemPrompt, userMessage);
  const hit = respCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    console.log(`[${label}] cache hit`);
    return { ...hit.value, source: 'live', cached: true };
  }

  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 2048,
        // System prompt is identical per endpoint — cacheable when long enough
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      },
      { timeout: 25_000 },
    );

    const rawText = response.content.find((b) => b.type === 'text')?.text ?? '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in model response');
    const result = JSON.parse(jsonMatch[0]);

    const u = response.usage;
    console.log(`[${label}] live | in: ${u.input_tokens} | cache_read: ${u.cache_read_input_tokens ?? 0} | cache_write: ${u.cache_creation_input_tokens ?? 0} | out: ${u.output_tokens}`);
    // Cache the successful inference; prune expired entries when the map grows.
    respCache.set(key, { at: Date.now(), value: result });
    if (respCache.size > 500) for (const [k, v] of respCache) if (Date.now() - v.at >= CACHE_TTL_MS) respCache.delete(k);
    return { ...result, source: 'live' };
  } catch (err) {
    // Demo guarantee: any failure degrades to the canned analysis, never a 500.
    if (err instanceof Anthropic.AuthenticationError) authFailed = true;
    console.error(`[${label}] live call failed (${err.constructor?.name ?? 'Error'}: ${err.message}) — serving fallback`);
    await sleep(300);
    return { ...fallback, source: 'simulated' };
  }
}

// ── System prompts (persona → exact JSON schema → domain rules → JSON only) ──
const MAINTENANCE_PROMPT = `You are OreSight AI's senior reliability engineer for a nickel laterite mining operation in Morowali, Central Sulawesi, Indonesia. The fleet: six Komatsu HD785-7 haul trucks (HT-101..HT-106, 91 t rated), CR-01 primary jaw crusher, CR-02 cone crusher, one overland conveyor. Operations run two 12-hour shifts changing at 07:00 and 19:00 WITA.

Given a JSON telemetry summary for one asset, diagnose its condition and return JSON with EXACTLY this structure:

{
  "healthScore": <0-100 integer>,
  "failureProbability": <0-1 number, probability of in-service failure within 30 days>,
  "component": "<most likely degrading component, or 'No degrading component identified'>",
  "predictedFailureDays": <integer days to predicted functional failure, or null>,
  "severity": "NORMAL" | "WARNING" | "CRITICAL",
  "recommendedWindow": "<specific maintenance window, referencing WITA shift changes>",
  "actions": ["<3-5 concrete maintenance actions in priority order>"],
  "parts": [{"part": "<name>", "number": "<plausible OEM part number>", "status": "<stock status>"}],
  "costAvoidanceUSD": <integer, planned-vs-unplanned cost difference>,
  "narrative": "<3-4 sentence engineering narrative for the maintenance planner>"
}

Domain rules:
- Vibration severity per ISO 10816: zone A/B <4.5 mm/s RMS (normal), zone C 4.5-7.1 (restricted/WARNING), zone D >7.1 (damage occurs/CRITICAL).
- Typical HD785-7 failure modes: final drive bearings, wheel motor, hydraulic pump drive, front suspension cylinders. Rising vibration + bearing temperature at equal payload indicates bearing spall.
- Unplanned final-drive failure ≈ $165k repair + ~3 days lost availability (~$74k/day margin); planned change-out ≈ 6 h in a scheduled window.
- Recommend windows aligned to 07:00/19:00 WITA shift changes and weekend maintenance overlaps.
- Wet-season logistics: parts from Balikpapan take ~3 days; flag staging early.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const SAFETY_PROMPT = `You are OreSight AI's HSE analyst specialising in Indonesian mining safety regulation — Kepmen ESDM 1827K/30/MEM/2018 (technical guidelines for good mining practice), Permen ESDM 26/2018 (good mining practice & supervision), SMKP Minerba (mining safety management system, per Permen ESDM 38/2014), and ISO 45001:2018.

Given a mining incident/hazard report, analyse it and return JSON with EXACTLY this structure:

{
  "severity": {"level": <1-5 integer>, "label": "<severity label incl. actual vs potential>"},
  "riskScore": {"likelihood": <1-5>, "consequence": <1-5>},
  "hazardCategories": ["<2-4 hazard categories>"],
  "rootCauses": ["<3-4 root/systemic causes, not blame statements>"],
  "immediateActions": ["<2-4 actions for the next 24-48 h>"],
  "preventiveActions": ["<3-4 systemic corrective actions>"],
  "complianceFlags": [{"regulation": "<regulation name>", "clause": "<specific clause/appendix>", "status": "GAP" | "PARTIAL" | "REVIEW" | "OK", "note": "<one line>"}],
  "narrative": "<3-4 sentence analysis for the KTT (mine technical head), severity-of-potential focused>"
}

Domain rules:
- Severity 1=minor, 2=low, 3=moderate, 4=high potential (serious injury/fatality potential), 5=critical/imminent danger. Rate near-misses by POTENTIAL consequence.
- riskScore uses a 5x5 matrix: likelihood x consequence.
- Include AT LEAST 2 complianceFlags citing specific Indonesian regulations (Kepmen ESDM 1827K appendices, Permen ESDM 26/2018 articles, SMKP elements) plus ISO 45001 where relevant.
- Root causes must be systemic (procedures, design, supervision, production pressure, fatigue management) — never just "operator error".

IMPORTANT: Return ONLY valid JSON, no other text.`;

const PRODUCTION_PROMPT = `You are OreSight AI's mine-to-mill production optimisation engineer for a nickel laterite operation in Morowali feeding an RKEF smelter line. Feed target: >=1.80% Ni blended grade. Ore sources (stockpile assays): Saprolite HG 2.02% Ni, Saprolite MG 1.74% Ni, Limonite 1.35% Ni. Plant design throughput 320 t/h; CR-02 cone crusher runs ~94% utilisation and struggles with limonite-heavy (wet, plastic) blends. Wet-season rule: limonite <=30% when stockpile moisture >24%.

Given the current blend percentages, assays and throughput, return JSON with EXACTLY this structure:

{
  "estimatedGradeNi": <number, weighted-average % Ni of the user's blend>,
  "recommendedBlend": {"sapHi": <int %>, "sapMed": <int %>, "limonite": <int %>, "grade": <number % Ni>},
  "forecast24h": {"tonnes": <int>, "grade": <number>, "recoveryPct": <number>},
  "bottleneck": "<the binding constraint and why>",
  "recommendations": ["<3-4 specific, quantified recommendations>"],
  "narrative": "<3-4 sentence narrative connecting blend, grade target and the bottleneck>"
}

Domain rules:
- recommendedBlend percentages MUST sum to exactly 100 and its grade MUST equal the weighted average of the assays (show consistency).
- Clear the 1.80% target with a small buffer (~0.01-0.03) while minimising Saprolite HG consumption (scarce resource).
- forecast24h.tonnes ~ throughput x ~22.5 effective hours.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const USECASE_PROMPT = `You are an OreSight AI mining optimisation analyst supporting Indonesian mining operations (nickel laterite in Morowali, Central Sulawesi; coal in East Kalimantan). You will be given a use-case context and a user scenario; produce a concise, credible, quantified recommendation set as if from a deployed operations-AI product.

Return JSON with EXACTLY this structure:

{
  "headline": "<one-line conclusion reacting to the user's scenario value>",
  "recommendations": [{"action": "<specific action>", "impact": "<quantified impact>", "timeframe": "<when>"}],
  "valueImpactUSD": <integer, annualised value of the recommendation set>,
  "narrative": "<3-4 sentence narrative tying the recommendations together>"
}

Rules:
- 3-4 recommendations, each concrete and quantified (tonnes, %, US$, hours).
- React explicitly to the scenario value the user chose (it is provided in the message).
- Stay realistic for Indonesian mining operations; reference site specifics where given.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const FSP_PARSE_PROMPT = `You convert a mine-logistics dispatcher's free-text disruption note into ONE structured schedule constraint for the Morowali nickel barge chain. Resources: jetty berths JET-1 / JET-2 (load four barges), barges BG-3101..BG-3104, floating transshipment crane FC-1, ocean vessels MV-ANOA (loading now, laycan ends ~hour 38) and MV-CELEBES (queued). The published schedule spans a 48-hour horizon and "now" is ~hour 14.5.

Return JSON with EXACTLY this structure:

{
  "resourceId": "JET-1" | "JET-2" | "FC-1" | "BG-3101" | "BG-3102" | "BG-3103" | "BG-3104" | "MV-ANOA" | "MV-CELEBES",
  "kind": "outage" | "slowdown" | "hold" | "eta",
  "start": <hour 0-48 when it begins; default 15 if unspecified>,
  "dur": <duration in hours; for kind "eta" use a signed hour shift, negative = earlier>,
  "magnitudePct": <0-100, percent of capacity lost; 100 for a full outage; ~40 for typical swell>,
  "barge": <a barge id if a specific barge is affected, else null>,
  "label": "<=16 character UPPERCASE label for the Gantt block>",
  "title": "<one-line plain-English restatement of the disruption>"
}

Mapping rules:
- Weather / swell / wind / sea state → kind "slowdown" on FC-1.
- Tug / pilot / mooring shortage → kind "slowdown" on FC-1 (the chain throttles at transshipment).
- A barge engine / mechanical fault → kind "hold" with that barge in "barge".
- A berth, loader or jetty-side equipment failure → kind "outage" on that jetty.
- A vessel arriving earlier or later → kind "eta" on that vessel (negative dur = earlier).
- If several things are described, pick the single most material constraint.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const HAUL_PROMPT = `You are OreSight AI's haulage dispatch optimiser for the port haul circuit at a nickel laterite operation in Morowali, Central Sulawesi. A fleet of nine Komatsu HD785-7 haul trucks (91 t rated payload) shuttles ore ~4.2 km from two port stockpiles (SP-1 saprolite via LD-1 Cat 992K, SP-2 limonite via LD-2 Hitachi EX1900) up an ~8% ramp to the jetty surge hopper that feeds the barge loadout. Two 12-hour shifts (07:00/19:00 WITA). The delivered rate must track the active barge loadout demand (~1,900 t/h): the hopper is a small surge bin — if it starves, barge loading stalls and laycan/demurrage exposure rises; if it overflows, trucks queue and spill.

Given a JSON snapshot of the haul circuit and a disruption scenario, produce a dispatch optimisation. Return JSON with EXACTLY this structure:

{
  "headline": "<one-line conclusion: current delivered rate vs demand and the recommended move>",
  "bindingConstraint": "loader" | "haul-road" | "jetty-hopper" | "fleet",
  "currentRateTph": <number, ore delivered to the hopper now, t/h>,
  "optimisedRateTph": <number, achievable after the actions; >= currentRateTph>,
  "matchFactor": <number; 1.0 balanced, <1 loader-starved, >1 trucks queue>,
  "recommendations": [{"action": "<dispatch / road / payload / sequencing action>", "impact": "<quantified: t/h, queue-min, fuel-L, US$>", "timeframe": "<when>"}],
  "valueImpactUSD": <integer, annualised value of the optimisation set>,
  "narrative": "<3-4 sentences linking the moves to the barge loadout demand and the binding constraint>"
}

Domain rules:
- Match factor MF ~ (assigned trucks)/(trucks needed to keep loaders loading). MF<0.9 → loaders wait (under-trucked); MF>1.1 → trucks bunch and queue (over-trucked). Drive toward 0.95–1.05.
- The hopper is the pacemaker: optimisedRateTph tracks demand, not wasteful excess. If demand exceeds capacity, name the binding constraint and the marginal t/h of relieving it.
- Respect limits: 2 loaders, 9 trucks, 91 t rated. Apply the 10/10/20 payload policy; watch tyre TKPH in wet-season heat on the ramp.
- When a barge is laycan-critical, prioritise building hopper buffer ahead of its load window even at slightly higher fuel per tonne.
- 3-4 recommendations, each concrete and quantified.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const HAUL_PARSE_PROMPT = `You convert a haul-dispatch controller's free-text note into ONE of five scenarios the OreSight haul-circuit engine can run, for a Morowali port haul circuit (9 HD785-7 trucks, loaders LD-1/LD-2, jetty surge hopper, ~1,900 t/h barge demand).

Choose the single best scenarioKey:
- "truck-down" — a haul truck out of service / fault / refuel / crib (fleet under-trucked)
- "loader-down" — a loader (LD-1/LD-2, wheel loader or excavator) down or impaired (loader constraint)
- "road-wet" — wet ramp / rain / traction / grade issue (haul-road constraint)
- "demand-surge" — a laycan-critical barge / rush / higher loadout demand (fleet surge)
- "optimise" — no material disruption; hold the balanced plan

Return JSON with EXACTLY this structure:
{
  "scenarioKey": "truck-down" | "loader-down" | "road-wet" | "demand-surge" | "optimise",
  "interpretation": "<one-line restatement starting with 'Parsed:' of what was understood and the dispatch response>"
}
IMPORTANT: Return ONLY valid JSON, no other text.`;

const HAUL_COPILOT_PROMPT = `You are the OreSight Hauling Optimisation copilot for a Morowali port haul circuit (9 HD785-7 trucks → two stockpile loaders → jetty surge hopper feeding a barge loadout; ~1,900 t/h demand; match-factor target 0.95–1.05). Answer the controller's question in 2-3 sentences, grounded ONLY in the provided live-state JSON. If the question sets a target delivery rate, reason about what it takes to reach it given the binding constraint. Be concrete and quantified.

Return JSON with EXACTLY this structure:
{
  "answer": "<2-3 sentence grounded answer>"
}
IMPORTANT: Return ONLY valid JSON, no other text.`;

const IROC_PROMPT = `You are OreSight AI's duty controller for the IROC (Integrated Operations Centre) of the Batu Hijau copper-gold open pit, Sumbawa, Indonesia. The chain runs pit → primary gyratory crusher → SAG mill. The fleet: ~8 haul trucks (CAT-301..308, some AHS/autonomous), two electric shovels (SH-01, SH-02), waste dumps WD-1/WD-2. A controller manages exceptions against one integrated plan — they do not drive machines.

Given a disruption and a live-state JSON, produce an exception-management response. Return JSON with EXACTLY this structure:

{
  "headline": "<one-line situation + the recommended move>",
  "rootCause": "<2-3 sentence diagnosis of what happened and why it matters>",
  "bindingConstraint": "loader" | "haul-road" | "crusher" | "mill" | "geotech" | "weather" | "fleet",
  "productionImpact": {"lostKt": <number, kilotonnes at risk this shift>, "planPct": <number, signed % vs plan>},
  "actions": [{"action": "<specific action>", "impact": "<quantified result>", "owner": "Dispatch" | "Maintenance" | "Process" | "Geotech" | "Geology" | "OCE"}],
  "traceUnit": "<unit id to highlight on the map, or null>",
  "draftedComms": "<a concise radio/dispatch message to broadcast to operators>",
  "narrative": "<3-4 sentence controller's rationale tying the actions to the constraint and the plan>"
}

Rules:
- A controller does exception management: diagnose, quantify the impact on the plan, prioritise actions with a clear owner, and broadcast one clear message.
- Safety (geotech / weather) overrides production — evacuate / hold first, preserve dig rate second.
- Think across the chain: a crusher choke or mill trip is a downstream constraint that ripples back up the pit; slow or reroute the fleet to match, don't just bank idle stockpile.
- 3-4 actions, each concrete, quantified and owned. draftedComms must be radio-brief.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const IROC_PARSE_PROMPT = `You convert an IROC controller's free-text note into ONE of these disruption ids for the Batu Hijau pit-to-plant chain: "shovel-down" (a shovel/loader/face fault), "road-block" (haul-road blocked / rockfall / reroute), "crusher-choke" (gyratory crusher choke / feed bin), "slope-alarm" (slope radar / geotech / wall), "storm-hold" (lightning / storm / weather), "mill-trip" (SAG mill trip / grinding). Pick the single best match.

Return JSON with EXACTLY this structure:
{
  "disruptionId": "shovel-down" | "road-block" | "crusher-choke" | "slope-alarm" | "storm-hold" | "mill-trip",
  "interpretation": "<one-line restatement starting with 'Parsed:'>"
}
IMPORTANT: Return ONLY valid JSON, no other text.`;

const IROC_COPILOT_PROMPT = `You are the OreSight IROC ops copilot for the Batu Hijau copper-gold pit (pit → gyratory crusher → SAG mill; ~8 trucks, 2 shovels). Answer the controller's question in 2-3 sentences, grounded ONLY in the provided live-state JSON. Be concrete and quantified; reason about risk to the production plan and where to deploy the fleet.

Return JSON with EXACTLY this structure:
{ "answer": "<2-3 sentence grounded answer>" }
IMPORTANT: Return ONLY valid JSON, no other text.`;

const FSP_COPILOT_PROMPT = `You are the OreSight Future Scheduling Platform copilot for a Morowali nickel barge-logistics chain (jetty berths → four barges → floating crane FC-1 → ocean vessels; one published 48-hour plan; demurrage ~$28k/day). Answer the planner's question in 2-4 sentences, grounded ONLY in the provided plan-state JSON. Be concrete and quantified, and reference the bottleneck and the laycan buffer where relevant. Do not invent resources that are not in the state.

Return JSON with EXACTLY this structure:

{
  "answer": "<2-4 sentence grounded answer>"
}

IMPORTANT: Return ONLY valid JSON, no other text.`;

const BLAST_PROMPT = `You are OreSight AI's drill-and-blast engineer for the Batu Hijau copper-gold open pit (hard rock), Sumbawa, Indonesia. Benches are ~15 m, drilled on 229 mm holes and charged with bulk emulsion and electronic detonators. Bench geology is logged by MWD (rock hardness / specific energy). Downstream is a primary gyratory crusher feeding a SAG mill — fragmentation drives shovel dig rate and mill throughput (mine-to-mill). Safety governors: a ground-vibration PPV limit at the nearest structure, a flyrock exclusion zone, and airblast.

Given a JSON bench/blast snapshot (MWD hardness, current design: burden, spacing, hole diameter, bench height, stemming, sub-drill, powder factor, timing; target P80; downstream demand; nearest-structure distance and PPV limit) — and optionally a scenario — optimise the blast. Return JSON with EXACTLY this structure:

{
  "headline": "<conclusion: predicted fragmentation vs target and the move>",
  "powderFactorKgM3": <number>,
  "predictedP80mm": <number, 80%-passing fragment size>,
  "fragmentation": {"pctOversize": <number>, "pctFines": <number>, "targetP80mm": <number>},
  "bindingConstraint": "fragmentation" | "vibration" | "flyrock" | "cost",
  "constraintNote": "<what governs this design, one line>",
  "designActions": [{"param": "burden|spacing|hole-diameter|stemming|sub-drill|charge|timing", "change": "<from -> to>", "reason": "<short>", "effect": "<short>"}],
  "vibration": {"predictedPpvMmS": <number>, "limitMmS": <number>, "status": "OK" | "WATCH" | "BREACH"},
  "flyrock": {"predictedRangeM": <number>, "exclusionM": <number>, "status": "OK" | "WATCH" | "BREACH"},
  "downstreamUpliftTph": <integer, crusher/mill throughput gain>,
  "recommendations": [{"action": "<specific>", "impact": "<quantified: P80, t/h, US$, mm/s>", "timeframe": "<when>"}],
  "valueImpactUSD": <integer, annualised mine-to-mill value net of explosive cost>,
  "narrative": "<3-4 sentences linking design, fragmentation and downstream within the vibration / flyrock limits>"
}

Domain rules:
- Fragmentation is the product: tune powder factor, burden/spacing and timing toward the target P80. Finer (within reason) lifts dig rate and mill throughput, but watch fines — over-blasting wastes energy and can cause ore loss / dilution. Aim for the band.
- Match charge to rock: use MWD hardness to vary powder factor hole-by-hole (heavier in hard zones, lighter in soft).
- Safety governs absolutely: never recommend a design whose predicted PPV exceeds the structure limit or whose flyrock range exceeds the exclusion zone. Name the binding constraint and back off powder factor / re-time / add stemming instead.
- Electronic-detonator timing controls fragmentation AND vibration: stagger inter-hole delays to lower peak particle velocity while improving breakage.
- Quantify the downstream: tie value to crusher/mill throughput uplift and avoided oversize re-handling, net of the marginal explosive cost.
- 3-5 designActions and 3-4 recommendations, each concrete and quantified.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const BLAST_PARSE_PROMPT = `You convert a drill-and-blast engineer's free-text note into ONE of five scenarios the OreSight blast engine can run, for the Batu Hijau hard-rock open pit (15 m benches, 229 mm holes, bulk emulsion + electronic detonators, MWD-logged geology; target P80 ~250 mm feeding a gyratory crusher + SAG mill).

Choose the single best scenarioKey:
- "harder-seam" — MWD logs a hard / stiff band or seam (charge-to-geology constraint)
- "structure-near" — a house / structure / wall / village near the bench tightens the PPV cap (vibration constraint)
- "wet-holes" — water / groundwater / flooded holes forcing emulsion + re-deck (flyrock / cost constraint)
- "finer-feed" — the plant / SAG / crusher pulls a finer feed / more throughput (fragmentation target drops)
- "optimise" — no material change; hold the balanced design

Return JSON with EXACTLY this structure:
{
  "scenarioKey": "harder-seam" | "structure-near" | "wet-holes" | "finer-feed" | "optimise",
  "interpretation": "<one-line restatement starting with 'Parsed:' of what was understood and the design response>"
}
IMPORTANT: Return ONLY valid JSON, no other text.`;

const BLAST_COPILOT_PROMPT = `You are the OreSight Blast Optimisation copilot for the Batu Hijau hard-rock open pit (15 m benches, 229 mm holes, bulk emulsion + electronic dets; fragmentation feeds a gyratory crusher + SAG mill; target P80 with PPV and flyrock safety gates). Answer the engineer's question in 2-3 sentences, grounded ONLY in the provided live-design JSON (predicted P80, target, powder factor, PPV vs limit, flyrock vs exclusion, % fines / oversize, mine-to-mill value). Be concrete and quantified. Never propose a design that breaches the PPV or flyrock limit.

Return JSON with EXACTLY this structure:
{ "answer": "<2-3 sentence grounded answer>" }
IMPORTANT: Return ONLY valid JSON, no other text.`;

const SHIPPING_PROMPT = `You are OreSight AI's shipping & port-logistics optimiser for a nickel ore exporter: ore is loaded onto tug-towed barges at the Morowali jetty and transshipped to ocean-going vessels (OGVs) at the Kendari anchorage by floating cranes FC-1/FC-2 (~18–50 kt/day each). You optimise the demurrage-versus-stockpile-carrying-cost trade-off by tuning the laycan buffer and re-sequencing the vessel line-up. The annualised cost curve is total(b) = 900000·e^(−0.45·b) + 140000·b dollars, where b is the laycan buffer in days; its analytic minimum is the cost-optimising buffer. Two product grades: saprolite and limonite. Current practice over-buffers at ~3.8 days. The binding constraint is usually the floating-crane rate, then the barge cycle, then stockpile cover, then the tidal window.

Given a JSON snapshot (the user's chosen buffer, the current-practice buffer, the computed optimum buffer and the cost breakdown, the live vessel line-up with laycan status and forecast demurrage/despatch, and the binding constraint), produce a recommendation. Return JSON with EXACTLY this structure:

{
  "headline": "<one-line conclusion: the recommended buffer and the resulting total annualised cost>",
  "recommendedBufferDays": <number, the cost-minimising laycan buffer in days>,
  "costCurrentUSD": <integer, annualised cost at current practice>,
  "costOptimisedUSD": <integer, annualised cost at the recommended buffer>,
  "valueImpactUSD": <integer, annual saving vs current practice>,
  "actions": ["<2-3 concrete fleet actions in plain language; you MAY wrap a key vessel name or number in <b>...</b>>"],
  "narrative": "<3-4 sentence explainable rationale tying the buffer, the demurrage/carrying trade-off and the at-risk vessel together>"
}

Domain rules:
- The recommended buffer must be the cost-minimising buffer from the provided cost curve (≈2.4 days); trimming from 3.8 d toward it cuts carrying cost faster than it adds demurrage.
- Actions must be concrete and reference the actual line-up (e.g. hold a named late vessel, prioritise a named grade's barge cycle to protect cover, pull a floating-crane slot forward only once cover clears the minimum).
- Keep every figure consistent with the supplied numbers — the recommendation must read as explainable, not a black box.
- 2-3 actions.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const SHIPPING_DISRUPTION_PROMPT = `You are OreSight AI's shipping control tower for the Morowali jetty + Kendari anchorage barge/OGV transshipment chain (floating cranes FC-1/FC-2; OGVs MV Borneo Star, MV Sulawesi Dawn, MV Hai Long 7, MV Cape Kendari; saprolite + limonite grades; minimum safe stockpile cover 4.0 days). Convert a scheduler's free-text disruption note into a live re-dispatch response.

Return JSON with EXACTLY this structure:

{
  "scenarioKey": "fc2" | "rain" | "late" | "tide" | "general",
  "title": "<=24 character label for the disruption",
  "text": "<one short paragraph: the re-dispatch action and its quantified impact; begin with a <b>...</b> tag naming the disruption (e.g. <b>FC-2 down.</b>); reference grade cycles, cover, laycan and demurrage/despatch in dollars>"
}

Mapping rules:
- floating crane / FC-1 / FC-2 fault → "fc2": re-route barge cycles to the surviving crane, quantify the slip and added demurrage.
- rain / moisture / TML / wet barges → "rain": pause loading to re-test, protect cover, load tested grade first.
- vessel arriving early / capesize early → "late": no FC slot, convert demurrage into despatch by accelerating barge cycles.
- neap tide / draft / swell → "tide": deep-draft window shrinks, cap the capesize load, top off on the next spring tide.
- anything else → "general": re-solve holding the floating-crane constraint and protecting minimum cover.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const SHIPPING_COPILOT_PROMPT = `You are the OreSight Shipping Optimisation copilot for the Morowali jetty + Kendari anchorage barge/OGV program (floating cranes FC-1/FC-2; cost curve total(b)=900000·e^(−0.45·b)+140000·b; cost-optimising laycan buffer ≈2.4 d; current practice 3.8 d; binding constraint the floating-crane rate at ~94% utilisation; at-risk vessel MV Cape Kendari driving ~$128k demurrage). Answer the scheduler's question in 2-3 sentences, grounded ONLY in the provided live-state JSON. Be concrete and quantified. If the question sets a demurrage/cost target, reason about whether it is achievable against the cost floor at the optimal buffer. You MAY wrap a key figure or vessel name in <b>...</b>.

Return JSON with EXACTLY this structure:
{ "answer": "<2-3 sentence grounded answer, may contain <b> tags>" }
IMPORTANT: Return ONLY valid JSON, no other text.`;

const COCKPIT_BRIEF_PROMPT = `You are the AI Chief of Staff to the Group CEO of MIND ID (Mining Industry Indonesia / MIND ID), the holding company of Indonesia's state-owned mining enterprises. You focus on PT Bukit Asam (PTBA), the coal subsidiary. Earnings flow to MIND ID as a dividend at 65.93% ownership; the board sets a dividend floor.

You are given the live output of a Monte Carlo "dividend-at-risk" model: the central market view (HBA/ICI coal benchmark in US$/t, USD/IDR, China demand index, Capesize freight in US$/t), any mitigation levers the CEO has applied (coal-price hedge %, FX hedge %, domestic-mix shift, cost-reduction program), and the resulting distribution of the dividend to MIND ID (P10/P50/P90 in Rp trillion), the probability it breaches the board floor, cash-flow-at-risk (P50−P5), and a driver-attribution ranking.

Produce a board-grade executive brief. Return JSON with EXACTLY this structure:

{
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "posture": "DEFENSIVE" | "BALANCED" | "CONSTRUCTIVE",
  "situation": "<2-3 sentences: where PTBA stands today, citing the median dividend, the P10-P90 band and the breach probability>",
  "implication": "<1-2 sentences: what it means for the MIND ID consolidated dividend and the PTBA equity thesis>",
  "actions": [{"action": "<specific CEO/board action>", "rationale": "<one line, grounded in the numbers>"}],
  "risks": ["<2-3 top risks, each one line>"],
  "opportunities": ["<1-2 upside opportunities, each one line>"],
  "sources": ["<2-3 model references / data points the brief rests on>"]
}

Domain rules:
- Ground EVERY claim in the numbers provided — quote the median, the band, the breach probability and the dominant driver. Never invent figures.
- The dominant driver in the attribution ranking is where CEO attention buys the most risk reduction; lead the actions there.
- Realistic CEO levers: price/FX hedging, anchoring the payout to a conservative percentile, DMO/royalty engagement with ESDM, unit-cost programs, and capital allocation across the MIND ID portfolio. 3-4 actions.
- If mitigations are already applied, acknowledge the improvement (breach probability before vs after) rather than re-recommending them.
- Posture: DEFENSIVE if breach probability is high or the median is near/below the floor; CONSTRUCTIVE if cover is comfortable; BALANCED otherwise.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const BOARD_READ_PROMPT = `You are the AI Chief of Staff to the Group CEO of MIND ID (Mining Industry Indonesia), the Indonesian state mining holding that owns PT Bukit Asam (PTBA, coal), PT Antam (nickel/gold/bauxite), PT Inalum (aluminium), a 51% stake in PT Freeport Indonesia (copper/gold, Grasberg), and PT Timah (tin).

You are given the live Portfolio Control Tower state: the group roll-up (revenue, EBITDA, contribution to State, on-track/watch/risk counts, group safety) and a per-subsidiary scorecard (status, production vs guidance, unit cost, cost-curve quartile, EBITDA margin, net-profit move, and a one-line note).

Write a sharp, board-grade "morning read" — what a CEO needs in 20 seconds. Return JSON with EXACTLY this structure:
{
  "headline": "<one punchy sentence — the single most important truth about the portfolio today>",
  "read": "<3-4 sentences: what's really going on beneath the headline numbers. Name the assets. Distinguish a flattering top line from the underlying economics.>",
  "watchlist": [{"asset": "<name>", "why": "<one line, grounded in its status/note>"}],
  "oneThing": "<the single most valuable action or stress test to run next>",
  "posture": "CONSTRUCTIVE" | "BALANCED" | "WATCHFUL"
}

Domain rules:
- Ground every claim in the provided numbers — quote revenue, the on/watch/risk split, quartiles, margins. Never invent figures.
- Be honest about quality of earnings: e.g. a record top line driven by low-margin gold trading is not the same as strong mining economics.
- The cost-curve quartile is the resilience tell: Q1 assets survive the price cycle; Q4 assets are first to go underwater.
- Lead the reader to the concentration of risk (the RISK-flagged asset) and the cash-floor stress test.
- 2-3 watchlist items, most severe first. Crisp, not corporate.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const SCENARIO_PROMPT = `You are the Scenario Copilot for MIND ID's Portfolio Control Tower. The CEO types a natural-language commodity/market shock; you parse it into structured driver deltas and explain, grounded in the portfolio, which assets are exposed.

MIND ID assets and their commodities: Bukit Asam = thermal coal (cost-curve Q2); Antam = nickel ferronickel (Q4, high-cost) + gold (trading) + bauxite; Inalum = aluminium (Q1, captive hydro, low-cost); Freeport Indonesia = copper + gold (Q1; net cash cost ~$0/lb because Grasberg gold credits offset the copper cash cost — so it is unusually resilient to copper price falls but is the group's largest earnings stream); Timah = tin (Q3).

Return JSON with EXACTLY this structure:
{
  "drivers": [{"name": "<e.g. Copper price>", "change": "<e.g. -30%>"}],
  "exposed": [{"asset": "<name>", "effect": "<one line: how this asset is hit or protected>", "severity": "positive" | "low" | "medium" | "high"}],
  "verdict": "ACT" | "WATCH" | "HOLD" | "UNCLEAR",
  "impact": "<2-3 sentences: the net read on group cash and where the concentration is. End by pointing to the full cash-floor Stress Test.>"
}

Domain rules:
- Parse every commodity and FX move you can find (e.g. "copper -30%", "rupiah weakens 10%", "coal falls 20%").
- A high-cost (Q4) asset under a price fall is the one that goes underwater / curtails first — flag severity "high". A Q1 asset under the same fall compresses margin but survives — "medium" or "low".
- A weaker rupiah flatters reported IDR earnings on USD-priced exports (partly offsetting commodity weakness) but adds variance.
- verdict ACT if any asset is pushed toward curtailment or the group cash floor is threatened; WATCH if margins compress materially; HOLD if cover comfortably holds; UNCLEAR if no shock could be parsed.
- Never invent specific dividend figures — direct the user to the Monte-Carlo Stress Test to size the cash impact.

IMPORTANT: Return ONLY valid JSON, no other text.`;

const CAPITAL_COPILOT_PROMPT = `You are the AI Chief of Staff to MIND ID's Group CEO, answering questions about the FY2024 capital-allocation picture shown on the Capital tab of the Portfolio Control Tower. Answer in 2-3 sentences, grounded ONLY in the provided state JSON. Be concrete and quantified (Rp T). You MAY wrap a key figure in <b>...</b>.

The state describes: how operating cash was generated and deployed (EBITDA → operating cash → sustaining capex → free cash flow → growth capex, debt drawn, dividend → net cash); returns by subsidiary (ROIC vs WACC, capital employed, economic profit); capital discipline ratios; and the growth-project pipeline (Manyar copper smelter, SGAR alumina, Grasberg underground). The central story: FCF covers the dividend ~2.0x, but the Rp 12T downstreaming build is part debt-funded; only Freeport clearly earns above its cost of capital (~96% of group economic profit); leverage stays low (~0.8x net debt/EBITDA); the watch item is concentration in Freeport.

Return JSON with EXACTLY this structure:
{ "answer": "<2-3 sentences, grounded in the state; may use <b>...</b>>" }

IMPORTANT: Return ONLY valid JSON, no other text.`;

const OPS_COPILOT_PROMPT = `You are the AI Operations copilot to MIND ID's Group CEO, answering questions about the FY2024 PHYSICAL operational state of the operating companies (Freeport/PTFI copper-gold, Bukit Asam/PTBA coal, Antam nickel/gold, Inalum aluminium, Timah tin). Answer in 2-3 sentences, grounded ONLY in the provided state JSON. Stay physical — output vs plan, safety (LTIFR, fatalities), mine life, operational status (running / constrained / force majeure), disruptions, and growth-build progress. Do NOT discuss money (cost, margin, EBITDA, dividend) — that lives on other tabs. You MAY wrap a key figure or company name in <b>...</b>.

Central operational picture: the fleet runs well (records at Bukit Asam, Inalum, Timah); the two exceptions are Freeport (force majeure from the Grasberg mud rush, 2026 output ~-35%) and Antam (RKEF ferronickel below nameplate). Zero fatalities across the portfolio. Timah's ~14-yr reserve life is the one structural watch. Growth build: Manyar Cu smelter 95%, SGAR alumina 85%, Grasberg underground ramping.

Return JSON with EXACTLY this structure:
{ "answer": "<2-3 sentences, physical/operational only; may use <b>...</b>>" }

IMPORTANT: Return ONLY valid JSON, no other text.`;

// ── Endpoints ─────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, aiMode: aiMode() }));

// CEO Cockpit: AI Chief-of-Staff executive brief over the Monte Carlo state.
app.post('/api/cockpit/brief', async (req, res) => {
  const body = req.body || {};
  const result = await askClaude({
    label: `cockpit:brief:${body.regime ?? 'base'}`,
    systemPrompt: COCKPIT_BRIEF_PROMPT,
    userMessage: `Live dividend-at-risk state:\n${JSON.stringify(body, null, 2).slice(0, 6000)}\n\nReturn only valid JSON.`,
    fallback: cockpitBriefFallback(body),
  });
  res.json(result);
});

// Portfolio Control Tower: AI "Board Read" — group-level narrative over the
// Tier 0/1 scorecard state the cockpit posts.
app.post('/api/portfolio/board-read', async (req, res) => {
  const body = req.body || {};
  const result = await askClaude({
    label: 'portfolio:board-read',
    systemPrompt: BOARD_READ_PROMPT,
    userMessage: `Live MIND ID portfolio state (group roll-up + per-subsidiary scorecard):\n${JSON.stringify(body, null, 2).slice(0, 6000)}\n\nReturn only valid JSON.`,
    fallback: boardReadFallback(body),
  });
  res.json(result);
});

// Portfolio Control Tower: Scenario Copilot — parse a natural-language commodity
// shock into driver deltas + a grounded read of which assets are exposed.
app.post('/api/portfolio/scenario', async (req, res) => {
  const body = req.body || {};
  const result = await askClaude({
    label: 'portfolio:scenario',
    systemPrompt: SCENARIO_PROMPT,
    userMessage: `CEO question / scenario: "${String(body.query || '').slice(0, 400)}"\n\nPortfolio context:\n${JSON.stringify(body.subs || [], null, 2).slice(0, 4000)}\n\nReturn only valid JSON.`,
    fallback: scenarioFallback(body),
  });
  res.json(result);
});

// Portfolio Control Tower: Capital Copilot — grounded Q&A over the capital-allocation state.
app.post('/api/portfolio/capital-copilot', async (req, res) => {
  const { question, state } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'A question is required' });
  const result = await askClaude({
    label: 'portfolio:capital-copilot',
    systemPrompt: CAPITAL_COPILOT_PROMPT,
    userMessage: `Capital-allocation state:\n${JSON.stringify(state || {}, null, 2).slice(0, 4000)}\n\nCEO question: ${question.trim().slice(0, 400)}\n\nReturn only valid JSON.`,
    fallback: capitalCopilotFallback({ question }),
  });
  res.json(result);
});

// Portfolio Control Tower: Operations Copilot — company-aware Q&A over the physical operational state.
app.post('/api/portfolio/ops-copilot', async (req, res) => {
  const { question, state } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'A question is required' });
  const result = await askClaude({
    label: 'portfolio:ops-copilot',
    systemPrompt: OPS_COPILOT_PROMPT,
    userMessage: `Operational state:\n${JSON.stringify(state || {}, null, 2).slice(0, 4000)}\n\nCEO question: ${question.trim().slice(0, 400)}\n\nReturn only valid JSON.`,
    fallback: opsCopilotFallback({ question }),
  });
  res.json(result);
});

// Serve the AISStream key from an env var so it never lives in the (public) repo.
// AISStream is a browser-side WebSocket, so the key is necessarily client-visible
// in use; this only keeps it out of source control. Set AISSTREAM_API_KEY in Vercel.
app.get('/api/aisstream-key', (req, res) => res.json({ key: process.env.AISSTREAM_API_KEY || '' }));

// Small fetch-with-timeout for the external data proxies below.
async function fetchJSON(url, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { signal: ctrl.signal }); return await r.json(); }
  finally { clearTimeout(t); }
}
const witaHM = (unixSec) => new Date((unixSec + 8 * 3600) * 1000).toISOString().slice(11, 16);

// Tide proxy (WorldTides). Key in env; falls back to a synthetic spring-neap reading.
app.get('/api/tide', async (req, res) => {
  const key = process.env.WORLDTIDES_API_KEY;
  const fallback = { source: 'model', current: 1.4, springNeap: 'neap',
    extremes: [{ type: 'High', height: 2.1, dt: '14:40' }, { type: 'Low', height: 0.6, dt: '21:10' }] };
  if (!key) return res.json(fallback);
  try {
    const lat = -3.95, lon = 122.72;
    const d = await fetchJSON(`https://www.worldtides.info/api/v3?heights&extremes&lat=${lat}&lon=${lon}&key=${key}`);
    const extremes = (d.extremes || []).slice(0, 4).map((e) => ({ type: e.type, height: +(+e.height).toFixed(2), dt: witaHM(e.dt) }));
    const current = (d.heights && d.heights[0]) ? +(+d.heights[0].height).toFixed(2) : fallback.current;
    res.json({ source: extremes.length ? 'live' : 'model', current, extremes: extremes.length ? extremes : fallback.extremes });
  } catch (e) { res.json({ ...fallback, error: String(e.message || e) }); }
});

// Market proxy. Provider chain: metals.dev (free tier, LME base metals) →
// metals-api (paid, optional) → a reference price you can set via env
// (NICKEL_REF_USD, e.g. this month's Indonesia HMA or World Bank nickel).
app.get('/api/market', async (req, res) => {
  const ref = Number(process.env.NICKEL_REF_USD) || 16500;
  const bunker = Number(process.env.BUNKER_VLSFO_USD) || 600;
  const fallback = { source: 'ref', provider: 'Indonesia HMA', nickelUSD: ref, bunkerVLSFO: bunker };

  // 1) metals.dev — free tier, returns base metals in USD/metric-tonne
  const md = process.env.METALS_DEV_API_KEY;
  if (md) {
    try {
      const d = await fetchJSON(`https://api.metals.dev/v1/latest?api_key=${md}&currency=USD&unit=mt`);
      const ni = d && d.metals ? (d.metals.nickel ?? d.metals.lme_nickel) : null;
      if (ni) return res.json({ source: 'live', provider: 'metals.dev', nickelUSD: Math.round(ni), bunkerVLSFO: bunker });
    } catch (e) { /* fall through */ }
  }
  // 2) metals-api — paid for nickel, kept for compatibility if a key exists
  const ma = process.env.METALS_API_KEY;
  if (ma) {
    try {
      const d = await fetchJSON(`https://metals-api.com/api/latest?access_key=${ma}&base=USD&symbols=NI`);
      const r = d && d.rates ? (d.rates.NI ?? d.rates.XNI) : null;
      const ni = r ? (r > 100 ? r : 1 / r) : null;
      if (ni) return res.json({ source: 'live', provider: 'metals-api', nickelUSD: Math.round(ni), bunkerVLSFO: bunker });
    } catch (e) { /* fall through */ }
  }
  res.json(fallback);
});

app.post('/api/maintenance/analyze', async (req, res) => {
  const { assetId, assetMeta, telemetrySummary } = req.body || {};
  const result = await askClaude({
    label: `maintenance:${assetId ?? '?'}`,
    systemPrompt: MAINTENANCE_PROMPT,
    userMessage: `Diagnose this asset from its telemetry summary:\n${JSON.stringify({ assetId, assetMeta, telemetrySummary }, null, 2)}\n\nReturn only valid JSON.`,
    fallback: maintenanceFallback(req.body || {}),
  });
  res.json(result);
});

app.post('/api/safety/analyze', async (req, res) => {
  const { report, sampleId } = req.body || {};
  if (!report || !report.trim()) {
    return res.status(400).json({ error: 'Incident report text is required' });
  }
  const result = await askClaude({
    label: `safety:${sampleId ?? 'free-text'}`,
    systemPrompt: SAFETY_PROMPT,
    userMessage: `Analyse this incident report:\n\n${report.trim().slice(0, 8000)}\n\nReturn only valid JSON.`,
    fallback: safetyFallback({ sampleId, report }),
  });
  res.json(result);
});

app.post('/api/production/analyze', async (req, res) => {
  const { blend, assays, throughputTph, target } = req.body || {};
  const result = await askClaude({
    label: 'production:blend',
    systemPrompt: PRODUCTION_PROMPT,
    userMessage: `Optimise this blend:\n${JSON.stringify({ blend, assays, throughputTph, target }, null, 2)}\n\nReturn only valid JSON.`,
    fallback: productionFallback(req.body || {}),
  });
  res.json(result);
});

app.post('/api/usecase/analyze', async (req, res) => {
  const { caseId, scenario } = req.body || {};
  const uc = USE_CASES[caseId];
  if (!uc) return res.status(400).json({ error: `Unknown caseId: ${caseId}` });

  const fallback = typeof uc.fallback === 'function'
    ? uc.fallback(scenario || {})
    : (typeof USE_CASES['control-tower'].fallback === 'function' ? USE_CASES['control-tower'].fallback(scenario || {}) : {});

  const result = await askClaude({
    label: `usecase:${caseId}`,
    systemPrompt: USECASE_PROMPT,
    userMessage: [
      `Use case: ${uc.title} (${uc.stage}, decision horizon ${uc.horizon})`,
      `Context: ${uc.promptContext ?? uc.pitch ?? ''}`,
      `Site: ${uc.site ?? 'Indonesian mining operation'}`,
      `User scenario: ${JSON.stringify(scenario ?? {})}`,
      '',
      'Return only valid JSON.',
    ].join('\n'),
    fallback,
  });
  res.json(result);
});

// FSP: parse a free-text disruption into a structured schedule constraint.
app.post('/api/fsp/parse', async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Disruption text is required' });
  const result = await askClaude({
    label: 'fsp:parse',
    systemPrompt: FSP_PARSE_PROMPT,
    userMessage: `Dispatcher note:\n"""${text.trim().slice(0, 600)}"""\n\nReturn only valid JSON.`,
    fallback: parseDisruptionFallback(text),
  });
  res.json(result);
});

// Hauling: dispatch optimisation rationale for a disruption scenario.
app.post('/api/haul/analyze', async (req, res) => {
  const { scenario } = req.body || {};
  const result = await askClaude({
    label: `haul:${scenario?.disruptionId ?? 'optimise'}`,
    systemPrompt: HAUL_PROMPT,
    userMessage: `Optimise this haul-circuit scenario:\n${JSON.stringify(scenario ?? {}, null, 2)}\n\nReturn only valid JSON.`,
    fallback: haulFallback(scenario || {}),
  });
  res.json(result);
});

// Hauling: parse a free-text disruption into a runnable scenario.
app.post('/api/haul/parse', async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Disruption text is required' });
  const result = await askClaude({
    label: 'haul:parse',
    systemPrompt: HAUL_PARSE_PROMPT,
    userMessage: `Controller note:\n"""${text.trim().slice(0, 500)}"""\n\nReturn only valid JSON.`,
    fallback: haulParseFallback(text),
  });
  res.json(result);
});

// Hauling: dispatch copilot Q&A grounded in the live circuit state.
app.post('/api/haul/copilot', async (req, res) => {
  const { question, state } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'A question is required' });
  const result = await askClaude({
    label: 'haul:copilot',
    systemPrompt: HAUL_COPILOT_PROMPT,
    userMessage: `Live state:\n${JSON.stringify(state || {}, null, 2)}\n\nController question: ${question.trim().slice(0, 400)}\n\nReturn only valid JSON.`,
    fallback: haulCopilotFallback({ question, state }),
  });
  res.json(result);
});

// IROC: duty-controller exception analysis for a disruption.
app.post('/api/iroc/analyze', async (req, res) => {
  const { scenario } = req.body || {};
  const result = await askClaude({
    label: `iroc:${scenario?.disruptionId ?? '?'}`,
    systemPrompt: IROC_PROMPT,
    userMessage: `Disruption + live state:\n${JSON.stringify(scenario ?? {}, null, 2)}\n\nReturn only valid JSON.`,
    fallback: irocFallback(scenario || {}),
  });
  res.json(result);
});

// IROC: parse a free-text disruption into a runnable id.
app.post('/api/iroc/parse', async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Disruption text is required' });
  const result = await askClaude({
    label: 'iroc:parse',
    systemPrompt: IROC_PARSE_PROMPT,
    userMessage: `Controller note:\n"""${text.trim().slice(0, 500)}"""\n\nReturn only valid JSON.`,
    fallback: irocParseFallback(text),
  });
  res.json(result);
});

// IROC: ops copilot Q&A grounded in the live state.
app.post('/api/iroc/copilot', async (req, res) => {
  const { question, state } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'A question is required' });
  const result = await askClaude({
    label: 'iroc:copilot',
    systemPrompt: IROC_COPILOT_PROMPT,
    userMessage: `Live state:\n${JSON.stringify(state || {}, null, 2)}\n\nController question: ${question.trim().slice(0, 400)}\n\nReturn only valid JSON.`,
    fallback: irocCopilotFallback({ question, state }),
  });
  res.json(result);
});

// Blast: drill-and-blast design optimisation for a scenario / live design.
app.post('/api/blast/analyze', async (req, res) => {
  const { design, scenario } = req.body || {};
  const key = scenario?.scenarioKey || scenario?.disruptionId || 'optimise';
  const result = await askClaude({
    label: `blast:${key}`,
    systemPrompt: BLAST_PROMPT,
    userMessage: `Optimise this blast design + scenario:\n${JSON.stringify({ design, scenario }, null, 2)}\n\nReturn only valid JSON.`,
    fallback: blastFallback({ ...(scenario || {}), design }),
  });
  res.json(result);
});

// Blast: parse a free-text bench note into a runnable scenario.
app.post('/api/blast/parse', async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Bench note text is required' });
  const result = await askClaude({
    label: 'blast:parse',
    systemPrompt: BLAST_PARSE_PROMPT,
    userMessage: `Engineer note:\n"""${text.trim().slice(0, 500)}"""\n\nReturn only valid JSON.`,
    fallback: blastParseFallback(text),
  });
  res.json(result);
});

// Blast: design copilot Q&A grounded in the live design state.
app.post('/api/blast/copilot', async (req, res) => {
  const { question, state } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'A question is required' });
  const result = await askClaude({
    label: 'blast:copilot',
    systemPrompt: BLAST_COPILOT_PROMPT,
    userMessage: `Live design state:\n${JSON.stringify(state || {}, null, 2)}\n\nEngineer question: ${question.trim().slice(0, 400)}\n\nReturn only valid JSON.`,
    fallback: blastCopilotFallback({ question, state }),
  });
  res.json(result);
});

// FSP: scheduling copilot Q&A grounded in the live plan state.
app.post('/api/fsp/copilot', async (req, res) => {
  const { question, state } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'A question is required' });
  const result = await askClaude({
    label: 'fsp:copilot',
    systemPrompt: FSP_COPILOT_PROMPT,
    userMessage: `Plan state:\n${JSON.stringify(state || {}, null, 2)}\n\nPlanner question: ${question.trim().slice(0, 400)}\n\nReturn only valid JSON.`,
    fallback: copilotFallback({ question, state }),
  });
  res.json(result);
});

// Shipping: laycan-buffer + line-up recommendation for the chosen scenario.
app.post('/api/shipping/analyze', async (req, res) => {
  const { scenario } = req.body || {};
  const result = await askClaude({
    label: `shipping:buffer:${scenario?.buffer ?? '?'}`,
    systemPrompt: SHIPPING_PROMPT,
    userMessage: `Optimise this shipping scenario:\n${JSON.stringify(scenario ?? {}, null, 2)}\n\nReturn only valid JSON.`,
    fallback: shippingFallback(scenario || {}),
  });
  res.json(result);
});

// Shipping: free-text (or preset) disruption → live re-dispatch response.
app.post('/api/shipping/disruption', async (req, res) => {
  const { text, scenarioKey } = req.body || {};
  if ((!text || !text.trim()) && !scenarioKey) return res.status(400).json({ error: 'A disruption description or preset is required' });
  const result = await askClaude({
    label: `shipping:disruption:${scenarioKey || 'free'}`,
    systemPrompt: SHIPPING_DISRUPTION_PROMPT,
    userMessage: `Scheduler note:\n"""${(text || scenarioKey || '').toString().trim().slice(0, 500)}"""\n\nReturn only valid JSON.`,
    fallback: shippingDisruptionFallback({ text, scenarioKey }),
  });
  res.json(result);
});

// Shipping: line-up copilot Q&A grounded in the live state.
app.post('/api/shipping/copilot', async (req, res) => {
  const { question, state } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'A question is required' });
  const result = await askClaude({
    label: 'shipping:copilot',
    systemPrompt: SHIPPING_COPILOT_PROMPT,
    userMessage: `Live state:\n${JSON.stringify(state || {}, null, 2)}\n\nScheduler question: ${question.trim().slice(0, 400)}\n\nReturn only valid JSON.`,
    fallback: shippingCopilotFallback({ question, state }),
  });
  res.json(result);
});

// ── Start ─────────────────────────────────────────────────────────────────────
// Exported for serverless platforms (Vercel imports the app from api/index.js);
// listens only when launched directly (npm run start:mining).
export default app;

if (process.argv[1] === __filename) {
  const PORT = process.env.MINING_PORT || 3003;
  app.listen(PORT, () => {
    console.log(`\n✅ OreSight AI demo running at http://localhost:${PORT}`);
    console.log(`🤖 AI mode: ${aiMode()}${aiMode() === 'simulated' ? ' (set ANTHROPIC_API_KEY for live analysis — demo works fully without it)' : ''}\n`);
  });
}
