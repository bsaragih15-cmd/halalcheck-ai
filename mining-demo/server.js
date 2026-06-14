import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { maintenanceFallback, safetyFallback, productionFallback } from './data/fallbacks.js';
import { parseDisruptionFallback, copilotFallback } from './data/fsp.js';
import { haulFallback, haulParseFallback, haulCopilotFallback } from './data/haul.js';
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

// ── Core helper: live Claude call with unbreakable fallback ───────────────────
async function askClaude({ systemPrompt, userMessage, fallback, label }) {
  if (!client) {
    await simulatedLatency(); // feels like inference, never errors
    console.log(`[${label}] simulated (no API key)`);
    return { ...fallback, source: 'simulated' };
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

const FSP_COPILOT_PROMPT = `You are the OreSight Future Scheduling Platform copilot for a Morowali nickel barge-logistics chain (jetty berths → four barges → floating crane FC-1 → ocean vessels; one published 48-hour plan; demurrage ~$28k/day). Answer the planner's question in 2-4 sentences, grounded ONLY in the provided plan-state JSON. Be concrete and quantified, and reference the bottleneck and the laycan buffer where relevant. Do not invent resources that are not in the state.

Return JSON with EXACTLY this structure:

{
  "answer": "<2-4 sentence grounded answer>"
}

IMPORTANT: Return ONLY valid JSON, no other text.`;

// ── Endpoints ─────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, aiMode: aiMode() }));

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
