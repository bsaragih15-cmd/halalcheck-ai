# Design Brief — Blast Optimisation (OreSight AI)

> **Handover to Claude design.** Drill & blast console — fragmentation, mine-to-mill value & vibration control, AI-designed.

An interactive demo for the OreSight AI platform: a drill-and-blast console that designs the blast to a **target fragmentation** — the size distribution that feeds the crusher and mill fastest — while holding ground vibration and flyrock inside their limits. The AI predicts fragmentation from the bench geology, tunes powder factor / burden / spacing / timing, and prices the **mine-to-mill** throughput it unlocks. The upstream lever for the whole value chain.

| | |
|---|---|
| **Visual model** | Fragmentation size-distribution curve (predicted vs target P80) + bench hole-pattern as the hero |
| **Site** | Batu Hijau copper-gold open pit (hard rock) — consistent with the IROC Control Tower; nickel laterite is largely free-dig |
| **Setup** | ~15 m benches, 229 mm holes, bulk emulsion + electronic detonators, MWD-logged geology; gyratory crusher + SAG mill downstream |
| **Design system** | Reuse OreSight light/dark control-room language from FSP / Hauling |
| **Sources** | Orica BlastIQ & FRAGTrack; Maptek BlastLogic & BlastMCF; MWD-to-charge; image fragmentation (WipFrag/Split/Motion Metrics); mine-to-mill |

---

## 1 · Context & goal

Drill & blast is the **first transformation in the value chain**, and its product is **fragmentation** — the rock size distribution. That single output cascades downstream: well-controlled fragmentation lifts **shovel dig rate → truck payload → crusher / mill throughput** and lowers mill energy per tonne. This is the classic **mine-to-mill** lever — spend a little more energy in the blast to unlock disproportionate throughput at the plant — bounded by the safety governors of **ground vibration (PPV)**, airblast and **flyrock**.

**Goal:** a demo that reads as one product with FSP and the Hauling / Control Tower consoles — a live drill-and-blast screen where the AI does the design judgement (predict the fragmentation, tune the pattern and charge, price the downstream gain) and never proposes a design that breaches a vibration or flyrock limit.

### What benchmark practice does (research synthesis)

- **Orica BlastIQ** is the reference digital platform: it integrates design (SHOTPlus), delivery and measurement systems in real time for automated **powder-factor and fragmentation QC**. Its **FRAGTrack** measures fragmentation autonomously with stereoscopic cameras and a **deep-neural-net** model on shovels / conveyors.
- **Maptek BlastLogic** is the enterprise drill-&-blast repository — it links blast design to geology, geotech and the mine plan, optimises **charge plans and initiation timing**, and does **post-blast reconciliation** (planned vs actual). **BlastMCF** folds **cost, flyrock, fragmentation, powder factor and vibration models** into one design objective; Maptek now also offers **automated blast design**.
- **MWD (measure-while-drilling)** turns every hole into a rock-hardness / energy log, so the charge can be **varied to the geology** — heavier in hard zones, lighter in soft — instead of a single blanket powder factor.
- **Electronic detonators** make timing a precision lever: staggering inter-hole delays improves breakage *and* lowers peak particle velocity, so fragmentation and vibration are tuned together rather than traded.

---

## 2 · Metrics to adopt

### North-star KPIs (large, top band)

| Metric | Definition | Unit | Target band |
|---|---|---|---|
| **Powder factor** | Explosive energy per volume blasted | kg/m³ | design ~0.7–1.0 (hard rock) |
| **Predicted P80** | 80%-passing fragment size — the product that feeds the mill | mm | hit SAG-feed target |
| **Dig rate** | Shovel productivity — the live downstream proxy of good frag | bcm/h | maximise |
| **Vibration PPV vs limit** | Peak particle velocity at the nearest structure vs the legal cap | mm/s | ≤ limit (e.g. 25) |

### Supporting metrics (secondary band)

| Metric | Definition / why it matters | Unit |
|---|---|---|
| **% oversize / % fines** | Tails of the distribution — oversize stalls the dig & crusher; fines waste energy / cause loss | % |
| **Energy factor** | Explosive energy per tonne — the charge-to-rock match | MJ/t |
| **Burden × spacing** | The pattern geometry — the primary fragmentation lever | m |
| **Flyrock range** | Predicted throw vs the exclusion zone — a hard safety gate | m |
| **Drill & blast cost** | $/t for drilling + explosive — the spend being optimised | $/t |
| **Downstream uplift** | Crusher / mill throughput gain from better fragmentation (mine-to-mill) | t/h |

**Value model** (reuse FSP/Hauling approach): mine-to-mill throughput uplift × margin + avoided oversize re-handling, net of the marginal explosive cost — derived, never canned.

---

## 3 · Fragmentation & safety model · colour coding

The size-distribution curve, the bench pattern and the reconciliation view share one colour language, keyed to the target P80 band and the safety limits.

| Band | Meaning | Hex |
|---|---|---|
| **FINES** | Below target — over-blast: wasted energy, ore loss / dilution | `#b45309` |
| **ON-SPEC** | Within the target P80 band — feeds the mill cleanly | `#15803d` |
| **OVERSIZE** | Above target — slow dig, crusher choke | `#d97706` |
| **BOULDER** | Gross oversize — dig stall / secondary breakage | `#b91c1c` |
| **MWD HARD ZONE** | Hard rock from drilling log — charge-up candidate | `#7c3aed` |
| **LIMIT BREACH** | PPV or flyrock over limit — design rejected | `#991b1b` |

**Key design idea: aim for the band, not the finest.** The win is a distribution centred on the target P80 — fine enough to feed the mill fast, not so fine it wastes energy or loses ore — and every candidate design is gated by the PPV and flyrock limits before it can be recommended.

---

## 4 · Screen layout & components

Follow the FSP / Hauling skeleton: breadcrumb → demo-head → KPI row → dark control-room screen → AI panel + side panels. Components top to bottom:

| # | Component | Spec |
|---|---|---|
| 1 | **KPI row** | 4 north-star cards: powder factor (kg/m³), predicted P80 (mm), dig rate (bcm/h), PPV vs limit (mm/s). Deltas vs target / limit. |
| 2 | **Constraint (drum) strip** | Reuse FSP strip: binding constraint = fragmentation / vibration / flyrock / cost, with a "what governs this design" note. |
| 3 | **Fragmentation curve (HERO)** | Cumulative %-passing size-distribution curve: predicted vs target, with fines / on-spec / oversize bands and the P80 marker. The whole outcome in one chart; re-draws as the design changes. |
| 4 | **Bench blast pattern** | Plan-view hole grid (burden × spacing) coloured by MWD hardness / charge weight; electronic-detonator timing contours. The design canvas — drag powder factor / spacing and watch it react. |
| 5 | **Vibration & flyrock panel** | PPV-vs-limit gauge (predicted at nearest structure) + flyrock range vs exclusion zone. The safety gate, always visible. |
| 6 | **Post-blast reconciliation** | Planned vs actual fragmentation (image-measured) + muckpile movement; feeds the next design. Mirrors BlastLogic reconciliation. |
| 7 | **Scenario inject + free-form** | Presets (harder seam, structure nearby, wet holes, finer-feed demand) + NL box → AI re-designs. Mirror FSP / Hauling. |
| 8 | **AI panel + value** | renderAIResult-style: headline + design actions (burden / spacing / charge / timing) + recommendations + downstream uplift + value protected. |

Tabs (optional): **Fragmentation** (curve) · **Pattern** (design) · **Reconciliation** — mirroring FSP / Hauling.

---

## 5 · AI capabilities

- **Fragmentation prediction** — predict P80 and the size distribution from the design + MWD geology + rock mass (the FRAGTrack / Kuz-Ram-style core).
- **Design optimisation** — tune burden / spacing / powder factor / timing to hit the target P80 while holding PPV and flyrock inside limits.
- **Charge-to-geology** — use MWD hardness to vary powder factor hole-by-hole rather than a blanket value.
- **Vibration & flyrock gating** — every candidate design is checked against the structure PPV limit and the exclusion zone before it is offered; timing is staggered to cut peak velocity.
- **Mine-to-mill value** — translate the fragmentation into crusher / mill throughput uplift and price it net of explosive cost.
- **Post-blast reconciliation** — compare planned vs image-measured actual fragmentation and feed the learning into the next design.
- **Scenario re-design** — harder seam, nearby structure, wet holes, finer-feed demand → live re-solve with rationale.

---

## 6 · Claude prompt (drop-in for `server.js`)

House style (persona → exact JSON schema → domain rules → JSON-only). One endpoint `/api/blast/analyze`; the `{headline, recommendations[], valueImpactUSD, narrative}` core reuses `renderAIResult`, specialised fields drive the bespoke UI. Ship a deterministic `blastFallback()` so it runs with no API key.

```js
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
```

**Companion (optional, mirrors FSP/Hauling):** a small `BLAST_PARSE_PROMPT` behind `/api/blast/parse` turns a free-text note ("hard band on the north wall, house at 380 m") into a structured scenario the engine re-designs.

---

## 7 · Design system (reuse OreSight tokens)

| Token | Hex |
|---|---|
| On-spec / brand | `#15803d` |
| Fines | `#b45309` |
| Oversize | `#d97706` |
| Boulder | `#b91c1c` |
| MWD hard zone | `#7c3aed` |
| Control-room (dark) | `#10150f` |

- **Type:** Inter (UI) + JetBrains Mono (labels/data), already loaded.
- **Reuse verbatim:** `kpi-card`, `fsp-screen` / `fsp-tab` / `fsp-status`, `bottleneck-strip`, `ai-panel` + `renderAIResult`, `risk-item`, `copilot`, `freeform-row`, the haul gauge components.
- **New components:** fragmentation size-distribution curve (SVG, % passing + bands + P80 marker), bench hole-pattern grid (burden×spacing, MWD/charge colour, timing contours), PPV / flyrock gauges, planned-vs-actual reconciliation overlay.
- **Motion:** the fragmentation curve and pattern re-draw as powder factor / spacing change; the PPV & flyrock gauges swing and gate the design (a rejected design flashes the limit) — the demo's "aha".

---

## 8 · Build notes

- **Page:** `mining-demo/public/blast.html` + `js/blast.js`; **endpoint:** `/api/blast/analyze` (+ optional `/api/blast/parse`) in `server.js`; **fallback:** `data/blast.js` (deterministic).
- **Deterministic engine is source of truth** for the on-screen curve and pattern (always re-draws visibly); AI parses free-text and writes rationale on top — works fully with no API key.
- **Matrix wiring:** light up the "Blast Optimisation" cell (Drill & Blast stage) on the value-chain landing page as a LIVE DEMO linking to `/blast.html`.
- **Nav:** add a "Blast" link; cross-link from the Control Tower (Batu Hijau) and Blending / Recovery demos (mine-to-mill).

---

## Sources

- Orica BlastIQ — integrated drill-&-blast platform, powder-factor / fragmentation QC, SHOTPlus — orica.com/…/blastiq
- Orica FRAGTrack — autonomous fragmentation measurement (stereoscopic camera + deep neural net) — orica.com
- Maptek BlastLogic — enterprise drill-&-blast repository, charge / initiation design, post-blast reconciliation — maptek.com/products/blastlogic; maptek.com forge "reconciling post blast performance"
- Maptek BlastMCF — integrated cost / flyrock / fragmentation / powder-factor / vibration design models; automated blast design — maptek.com forge "BlastMCF"; im-mining.com 2024
- Fragmentation / photoanalysis & mine-to-mill (P80, SAG feed, image sizing) — WipFrag / Split / Motion Metrics; en.wikipedia.org Photoanalysis, Mill (grinding)
- Drill-&-blast software landscape (Orica, Maptek, MWD-to-charge) — miningsoftwarereviews.com drill-blast
