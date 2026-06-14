# Design Brief — Payload Optimisation (OreSight AI)

> **Handover to Claude design.** In-pit hauler + loader payload console — truck-factor, 10/10/20 compliance & pass-matching, AI-coached.

An interactive demo for the OreSight AI platform: a load-and-haul payload console that tightens the **truck-factor distribution** — loading every HD785-7 just under rated, consistently — by closing the loader-to-truck feedback loop. The AI finds where under/over-loading concentrates (crew, shift, shovel), fixes the pass match, and quantifies the tonnes and cost-per-tonne at stake. The in-pit complement to the Hauling (stockpile→jetty) dispatch console.

| | |
|---|---|
| **Visual model** | Payload-distribution histogram (rated / 110% / 120% lines) as the hero |
| **Fleet** | HD785-7 haul trucks (91 t rated) loaded by a wheel loader + excavator; VIMS-class payload meters, loader bucket-weighing |
| **Governing policy** | Caterpillar 10/10/20 payload policy (mean ≤100% · ≤10% over 110% · none over 120%) |
| **Design system** | Reuse OreSight light/dark control-room language from FSP & Hauling |
| **Sources** | Cat 10/10/20 & VIMS Payload; Komatsu Payload Management; Loadrite / Argus bucket-weighing; Wenco / Hexagon / Modular payload analytics |

---

## 1 · Context & goal

Every haul cycle costs the same whether the truck is full or not — so the cheapest tonnes in the pit are the ones recovered by **loading accurately**. The lever is the **truck factor** (mean payload per load) and, more subtly, its **consistency**: a tight distribution centred just under rated beats occasional heavy loads. Underloading silently leaves a free truck of capacity on the table; overloading buys tonnes with tyre (TKPH), frame and component life. Payload optimisation finds the safe centre and holds it.

**Goal:** a demo that reads as one product with FSP and the Hauling console — a live load-and-haul screen where the AI does the supervisory judgement (which crew/shift/shovel is drifting, what pass count and bucket fill fix it, what it is worth) and closes the loop back to the loader operator.

### What benchmark practice does (research synthesis)

- **The 10/10/20 policy is the industry yardstick** (Caterpillar): across any 3-shift window the **mean payload must not exceed 100%** of rated, **no more than 10% of loads may exceed 110%**, and **no single load may exceed 120%**. It is the safe envelope every payload dashboard scores against.
- **Payload meters + loader bucket-weighing close the loop.** Truck VIMS-class monitors log load time, payload and TKPH/overload alarms; loader systems (Loadrite, Argus, Cat/Komatsu Payload) weigh *each bucket* and give the operator **immediate feedback to trim the last pass** — the single biggest driver of consistent loads.
- **Pass matching is the geometry of a good load:** the best match fills the truck to target in **3–4 even passes**; consistent fill factors near **95–100%** beat the erratic ~90% of un-instrumented loading.
- **The prize is large and well documented:** loading accurately to within ~10% of capacity delivers **8–12% productivity** gains and lowers cost-per-tonne; the loss almost always concentrates by **operator / crew / shift**, so the fix is a targeted feedback loop, not a blanket target.

---

## 2 · Metrics to adopt

### North-star KPIs (large, top band)

| Metric | Definition | Unit | Target band |
|---|---|---|---|
| **Truck factor** | Mean payload per load across the fleet | t/load | just under 91 (≈88–90) |
| **10/10/20 compliance** | Mean ≤100%, ≤10% over 110%, none over 120% of rated | pass | PASS |
| **Payload CV** | Coefficient of variation of payload — the consistency score | % | tight, <~6% |
| **Lost + risk tonnes** | Recoverable under-load gap + tonnes carried as overload | t/day | minimise; risk → 0 |

### Supporting metrics (secondary band)

| Metric | Definition / why it matters | Unit |
|---|---|---|
| **Overload rate** | Share of loads > 110% rated — the 10/10/20 amber band | % |
| **Underload rate** | Share of loads < 90% rated — the silent capacity loss | % |
| **Pass count** | Passes to fill a truck; 3–4 even is the productive match | passes |
| **Bucket fill factor** | Bucket payload vs rated bucket — loader-side consistency | % |
| **TKPH headroom** | Tyre tonne-km/h vs rating; overload erodes it in wet-season heat | % |
| **Cost per tonne** | Haulage $/t — the number underloading quietly inflates | $/t |

**Value model** (reuse FSP/Hauling approach): recovered tonnes (closing the under-load gap to target) × margin, net of the tyre / structural cost of any overload — derived, never canned.

---

## 3 · Load-band model & colour coding

The histogram, the operator table and the truck-factor trend share one colour language, keyed to the 10/10/20 envelope against rated payload (91 t).

| Band | Meaning | Hex |
|---|---|---|
| **UNDERLOAD** | < 90% rated — lost haulage capacity | `#b45309` |
| **ON-TARGET** | 90–100% rated — the safe centre to hold | `#15803d` |
| **UPPER-OK** | 100–110% rated — within policy, watch the mean | `#0e7490` |
| **OVER-110** | 110–120% rated — counts against the 10% limit | `#d97706` |
| **OVER-120** | > 120% rated — policy breach; tyre / frame risk | `#b91c1c` |
| **SCALE-DRIFT** | meter calibration anomaly — exclude & flag | `#7c3aed` |

**Key design idea: consistency over peak.** The win is squeezing the distribution toward the on-target band and nudging the mean up to just under rated — not chasing heavy loads. Reducing CV is what safely lifts the truck factor.

---

## 4 · Screen layout & components

Follow the FSP / Hauling skeleton: breadcrumb → demo-head → KPI row → dark control-room screen → AI panel + side panels. Components top to bottom:

| # | Component | Spec |
|---|---|---|
| 1 | **KPI row** | 4 north-star cards: truck factor (t/load), 10/10/20 compliance (PASS/MARGINAL/FAIL), payload CV, lost+risk tonnes. Deltas vs target. |
| 2 | **Constraint (drum) strip** | Reuse FSP strip: binding issue = underloading / overloading / pass-mismatch / fill-factor / scale-drift, with a "where it concentrates" note. |
| 3 | **Payload histogram (HERO)** | Distribution of loads vs % rated, green/amber/red bands, with vertical lines at 100 / 110 / 120% and a mean marker. The whole story in one chart; animates as loads stream in. |
| 4 | **Truck-factor trend** | Mean payload over the shift vs the rated and target lines; shows the distribution tightening after a coaching action. |
| 5 | **Operator / crew league table** | Per operator/crew/shift: mean payload, CV, 10/10/20 status, lost t/day — sortable; surfaces the drifting crew. The diagnostic table. |
| 6 | **Loader pass-match panel** | Per shovel/loader: pass count, bucket fill factor, dig rate, and the live **trim-pass** feedback the operator sees (bucket weights toward a target). |
| 7 | **Scenario inject + free-form** | Presets (night-shift drift, new operator, wet ore swell, scale miscalibration) + NL box → AI re-assesses. Mirror FSP / Hauling. |
| 8 | **AI panel + value** | renderAIResult-style: headline + operator actions (coach / pass-count / fill-target / calibrate, with Δt/day) + recommendations + pass-match + value protected. |

Tabs (optional): **Distribution** (histogram) · **Operators** (league table) · **Loaders** (pass-match) — mirroring FSP / Hauling.

---

## 5 · AI capabilities

- **Distribution diagnosis** — score the fleet against 10/10/20, compute truck factor and CV, and locate where under/over-loading concentrates (operator / crew / shift / shovel).
- **Pass-match optimisation** — recommend the pass count and bucket fill target that fills each truck to target in 3–4 even passes.
- **Loader feedback loop** — turn bucket weights into a live **trim-pass** recommendation the operator acts on before dumping.
- **Operator coaching targets** — convert the diagnosis into named, quantified coaching actions, not blanket targets.
- **Overload guardrail** — separate recoverable under-load tonnes from overload *risk* tonnes; never trade tyre/frame life for tonnage.
- **Scale-drift / anomaly detection** — flag payload-meter calibration drift and exclude it from the stats.
- **Value & cost-per-tonne** — quantify recovered tonnes, the 8–12% productivity headroom, and the $/t impact.

---

## 6 · Claude prompt (drop-in for `server.js`)

House style (persona → exact JSON schema → domain rules → JSON-only). One endpoint `/api/payload/analyze`; the `{headline, recommendations[], valueImpactUSD, narrative}` core reuses `renderAIResult`, specialised fields drive the bespoke UI. Ship a deterministic `payloadFallback()` so it runs with no API key.

```js
const PAYLOAD_PROMPT = `You are OreSight AI's load-and-haul productivity engineer for a nickel laterite open pit in Morowali, Central Sulawesi. The fleet is Komatsu HD785-7 haul trucks (91 t rated payload) loaded by two units — LD-1 (Cat 992K wheel loader) and an EX1900 excavator — over two 12-hour shifts (07:00/19:00 WITA). Trucks carry VIMS-class payload meters; loaders carry bucket-weighing (Loadrite/Argus class). Caterpillar's 10/10/20 payload policy governs: over any 3-shift window the MEAN payload must not exceed 100% rated, no more than 10% of loads may exceed 110%, and no single load may exceed 120%. Underloading wastes haulage; overloading costs tyres (TKPH), frames and components.

Given a JSON payload-performance summary (per-fleet, per-operator/crew and per-shovel distribution stats, pass counts, bucket fill factor, targets) — and optionally a focus — assess compliance and optimise payload. Return JSON with EXACTLY this structure:

{
  "headline": "<conclusion: truck factor vs rated and the main opportunity>",
  "truckFactorT": <number, mean payload t/load across the fleet>,
  "tenTenTwenty": {"meanPctRated": <number>, "pctOver110": <number>, "pctOver120": <number>, "status": "PASS" | "MARGINAL" | "FAIL"},
  "payloadCvPct": <number, coefficient of variation of payload>,
  "bindingIssue": "underloading" | "overloading" | "pass-mismatch" | "fill-factor" | "scale-drift",
  "issueNote": "<where the loss concentrates: crew/shift/shovel, one line>",
  "lostTonnesPerDay": <integer, recoverable from closing the gap to target>,
  "riskTonnesPerDay": <integer, tonnes carried as overload>,
  "operatorActions": [{"who": "<operator/crew/shovel id>", "action": "coach|pass-count|fill-target|calibrate", "detail": "<short>", "deltaTpd": <tonnes/day recovered>}],
  "recommendations": [{"action": "<specific>", "impact": "<quantified: t/day, %, US$, tyre>", "timeframe": "<when>"}],
  "passMatch": {"recommendedPasses": <int>, "bucketFillTargetPct": <number>, "note": "<one line>"},
  "valueImpactUSD": <integer, annualised value of recovered tonnes net of risk>,
  "narrative": "<3-4 sentences linking distribution, 10/10/20 and the loader loop>"
}

Domain rules:
- Consistency beats peak: the goal is a TIGHT distribution centred just under rated, not occasional heavy loads. Reducing CV is what safely lifts the mean truck factor.
- 10/10/20 status is PASS only if meanPctRated<=100 AND pctOver110<=10 AND pctOver120==0; otherwise MARGINAL or FAIL.
- Best pass match fills the truck to target in 3-4 EVEN passes; recommend pass count and bucket fill target accordingly (consistent ~95-100% fill beats erratic ~90%).
- Underloading concentrates by operator/crew/shift — name it and make the fix a real-time bucket-weight + trim-pass feedback loop, not a blanket target.
- Overloading is never the fix for underloading: quantify riskTonnes separately and never trade tyre TKPH / frame life for tonnage.
- Accurate loading within ~10% yields ~8-12% productivity; tie lostTonnes and value to it.
- 3-5 operatorActions and 3-4 recommendations, each concrete and quantified.

IMPORTANT: Return ONLY valid JSON, no other text.`;
```

**Companion (optional, mirrors FSP/Hauling):** a small `PAYLOAD_PARSE_PROMPT` behind `/api/payload/parse` turns a free-text note ("night crew light on SH-02") into a structured focus the engine re-assesses.

---

## 7 · Design system (reuse OreSight tokens)

| Token | Hex |
|---|---|
| On-target / brand | `#15803d` |
| Underload | `#b45309` |
| Upper-OK | `#0e7490` |
| Over-110 | `#d97706` |
| Over-120 | `#b91c1c` |
| Control-room (dark) | `#10150f` |

- **Type:** Inter (UI) + JetBrains Mono (labels/data), already loaded.
- **Reuse verbatim:** `kpi-card`, `fsp-screen` / `fsp-tab` / `fsp-status`, `bottleneck-strip`, `ai-panel` + `renderAIResult`, `risk-item`, `copilot`, `freeform-row`, `haul-table`.
- **New components:** payload histogram (SVG bars + threshold lines + mean marker), truck-factor trend, operator league table, loader pass-match / trim-pass feedback widget.
- **Motion:** the histogram re-bins and the trend extends as loads stream in; after a coaching action the distribution visibly tightens toward the on-target band — the demo's "aha".

---

## 8 · Build notes

- **Page:** `mining-demo/public/payload.html` + `js/payload.js`; **endpoint:** `/api/payload/analyze` (+ optional `/api/payload/parse`) in `server.js`; **fallback:** `data/payload.js` (deterministic).
- **Deterministic engine is source of truth** for the on-screen distribution (always re-bins visibly); AI parses free-text and writes rationale on top — works fully with no API key.
- **Matrix wiring:** light up the "Payload Optimisation" (Load & Haul) cell on the value-chain landing page as a LIVE DEMO linking to `/payload.html`.
- **Nav:** add a "Payload" link; cross-link from the Hauling and Maintenance demos (shared fleet, TKPH).

---

## Sources

- Caterpillar 10/10/20 payload guidelines & payload placement — cat.com / Cat Mining Trucks Payload Guidelines (AEXQ0250)
- Cat VIMS Payload Monitor & production reporting (load/haul/dump cycle, histograms) — cat.com/…/technology/…/vims; Cat Connect Payload (CM20170118-57947)
- Komatsu Payload Management — komatsu.com/…/loading-and-haulage/payload-management
- Loader bucket-weighing / trim-pass feedback (Argus, Loadrite) — austineng.com "getting payload matching right"; cim.org "automated supervision"
- Accurate-loading productivity (8–12%; within 10%) & underloading case — wingfieldscale.com case study; discoveryalert.com.au surge-loader fill factor
- Payload-management providers & analytics (Wenco, Hexagon, Modular, Loadrite, RCT, Epiroc CR, Trimble) — verifiedmarketresearch.com payload-management-system market; mining-technology.com fleet-management buyers guide
