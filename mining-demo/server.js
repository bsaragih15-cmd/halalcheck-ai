import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { maintenanceFallback, safetyFallback, productionFallback } from './data/fallbacks.js';
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
