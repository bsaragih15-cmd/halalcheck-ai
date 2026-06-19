# Design Brief — MIND ID CEO Cockpit: AI, Simulation & Live Data (OreSight AI)

> **Handover / roadmap.** Turning the CEO Cockpit from a deterministic financial twin with a *canned* AI layer into a live, probabilistic, AI-driven executive decision system — grounded in real public data.

The CEO Cockpit (`mining-demo/public/cockpit.html`) is a self-contained executive dashboard for **PT Bukit Asam (PTBA)** — a coal producer under the **MIND ID** mining holding. It already has excellent bones: a fast in-browser driver model, analytics (EBITDA bridge, tornado, sensitivity matrix, netback waterfall, thesis stress chain), and UI slots explicitly shaped for AI output and live data. This brief defines how to fill those slots.

| | |
|---|---|
| **Asset modelled** | PTBA (Tanjung Enim coal; ports Tarahan & Kertapati) within MIND ID |
| **Holding** | MIND ID — also Antam (nickel/gold), Timah (tin), Inalum (aluminium/bauxite), Freeport-Indonesia (copper) stake |
| **Current state** | Deterministic in-browser model (`DCLogic`); AI brief / Chief of Staff / exception monitor / decision engine are templated placeholders; as-of strip (HBA, USD/IDR, Capesize) is static |
| **Design system** | Keep the existing cockpit visual language (executive metric bar, as-of strip, four-column narrative, scenario playground) |
| **Backend pattern** | Reuse the repo's Claude `/api` pattern (`server.js` `/api/check`, cached system prompt, JSON-only output) |

---

## 1 · Context & goal

The cockpit answers one CEO question per column: **What is the world doing to PTBA? · How is PTBA operating? · What does PTBA mean for MIND ID? · What should we do?** The model that links them is sound but **deterministic and offline** — every input is a single number and the "AI" is templated text.

**Goal:** make the cockpit (a) **probabilistic** — show risk, not just point estimates; (b) **live** — driven by real public market/macro/weather data; (c) **genuinely AI-driven** — a grounded, cited Chief of Staff that reasons over model state + data; and (d) **portfolio-wide** — MIND ID, not PTBA alone. Every output must remain *derived and explainable*, never canned.

### Current driver model (the asset to build on)

`DCLogic` computes, from a base case `B.*` and live scenario overrides:
- **Inputs:** coal price (HBA reference), USD/IDR, China demand, DMO share & price, production Mt, domestic/export split, freight, royalty rate, cash cost, capex, EV/EBITDA multiple.
- **Outputs:** realized netback, EBITDA bridge, FCF, dividend pool, MIND ID dividend, equity value — plus tornado, coal-price × FX sensitivity matrix, netback waterfall, thesis stress chain.

This is a working financial twin; the upgrades below wrap it in uncertainty, live inputs and AI reasoning rather than replacing it.

---

## 2 · Workstream A — Simulation (point estimates → probability)

Today every slider is a single value. The highest-value analytical lift is **uncertainty**.

| Capability | What it adds | Effort | Infra |
|---|---|---|---|
| **Monte Carlo** over `DCLogic` | Sample HBA, FX, China demand, freight from distributions → EBITDA / dividend **P10–P50–P90**, probability of breaching the board dividend band, **Cash-Flow-at-Risk** | Low | Client-side (model is already JS) |
| **Stochastic paths** | Mean-reverting coal price (Ornstein–Uhlenbeck), correlated FX & freight via one correlation matrix, instead of independent shocks | Low–Med | Client-side |
| **Reverse stress test** | Solve for *the combination of shocks that breaks the dividend thesis* — the boundary, not a guess | Med | Client-side / `/api` |
| **AI scenario generation** | Claude composes internally-consistent named scenarios ("China stimulus + La Niña supply hit + IDR weakness"), maps them to driver settings + rationale, runs them | Med | `/api` + Claude |
| **Optimisation / decision search** | Given objectives (max dividend s.t. policy band + capex), search the decision space for the recommended posture — turns the Decision Engine from display into solver | Med–High | `/api` |
| **Backtest / nowcast** | Replay the model on historical quarters to validate calibration ("if we'd run this in Q2…") | Med | `/api` + data |

**Recommended first move:** client-side **Monte Carlo** — biggest analytical lift, no new infrastructure, drops straight into the existing in-browser model. Render P10/P50/P90 fans on the EBITDA/dividend cards and a breach-probability readout against the board policy band.

### Distribution defaults (starting calibration)
- **Coal price (HBA / ICI):** mean-reverting, ~25–35% annualised vol; anchor to the monthly HBA print.
- **USD/IDR:** ~6–9% annualised vol; mild negative correlation to coal (commodity-FX).
- **China demand:** scenario-weighted (policy-driven, fat tails) rather than Gaussian.
- **Freight (Capesize):** high vol, seasonal; weak positive correlation to coal demand.

---

## 3 · Workstream B — Live public-data connectors (make "as-of" real)

Each cockpit node maps to a real, mostly public feed. Serve them through a cached **`/api/cockpit/feeds`** aggregator (server-side to handle CORS + keys), with graceful fallback to the current static values when a feed is unavailable — mirroring how `/api/check` already degrades to deterministic fallbacks.

| Cockpit node | Feed(s) | Cadence | Notes |
|---|---|---|---|
| Coal benchmark (HBA/ICI) | ESDM **HBA**; ICE Newcastle / API4 futures; Qinhuangdao port stocks | Monthly + daily | HBA is the regulated Indonesian reference |
| FX | **USD/IDR** (Bank Indonesia / public FX) | Daily | Single largest swing factor with coal |
| Freight | Baltic **Capesize** index | Daily | Already a slot in the as-of strip |
| China demand | China customs coal imports; NBS power generation; Caixin PMI | Monthly | The demand-center driver |
| Supply / weather | **BMKG** rainfall; **NOAA ENSO/La Niña** | Daily/seasonal | Rain drives production & rail/barge logistics |
| Regulatory | ESDM **DMO** price/volume; **PNBP** royalty; RKAB | Event | DMO & royalty are netback levers |
| Shipping / AIS | Vessel line-up at Tarahan / Kertapati | Real-time | Real loadings / demurrage |
| Carbon / ESG | Carbon price; CBAM signals | Daily/event | Model already carries `carbonCost` |
| Equity | PTBA.JK price; peers; analyst consensus | Daily | Market read on the thesis |

Add a **data-freshness badge** per node (live / stale / fallback) so the CEO always knows whether a number is real-time or modelled.

---

## 4 · Workstream C — The AI "Chief of Staff" (fill the placeholder slots)

The Executive Brief, Chief of Staff, exception monitor and decision engine are structured for AI (`Brief.situation`, `Brief.actions`, `Brief.sources`) but currently templated.

1. **Live executive brief** — `/api/cockpit/brief` returns structured JSON (situation → implication → recommended actions → cited sources), grounded in the live model state + connected feeds. Reuses the `/api/check` pattern (cached system prompt, JSON-only, fallback).
2. **Multi-agent desk** — specialist agents mapped to the cockpit's four columns: **Market**, **Operations**, **Regulatory/Policy**, **Treasury/Portfolio** — synthesised by a Chief of Staff. Clean, legible architecture that matches the existing layout.
3. **RAG over a corpus** — PTBA/MIND ID filings, IDX disclosures, ESDM regulations, earnings transcripts, analyst notes → grounded answers with provenance (the UI already renders a `sources` region).
4. **Conversational cockpit** — natural-language queries ("What happens to the MIND ID dividend if HBA falls to $90 and IDR hits 17,000?") set drivers, run the Monte Carlo, and narrate the result.
5. **Exception detection + decision memos** — AI explains operational exceptions (probable cause) and auto-drafts the board dividend/capex memo with evidence and a dissenting view.
6. **Trust layer** — confidence calibration, data-freshness, and an explicit **grounded-vs-extrapolated** flag. Non-negotiable for a CEO-facing tool.

---

## 5 · Workstream D — Portfolio extension (the biggest strategic gap)

The cockpit is branded **MIND ID** but models only **PTBA**. Extending the twin to the full holding — Antam (nickel/gold), Timah (tin), Inalum (aluminium/bauxite), the Freeport copper stake — with **cross-commodity correlation, consolidated NAV & dividend, and an AI capital-allocation advisor** across subsidiaries is what makes the "MIND ID Portfolio" column real rather than a single-asset roll-up. LME nickel/tin/aluminium/copper and gold feeds plug into the same `/api/cockpit/feeds` aggregator.

---

## 6 · Sequencing (impact × effort)

1. **Client-side Monte Carlo** on the existing model — P10/P50/P90 dividend + breach probability. High value, low effort, no backend.
2. **Live AI Executive Brief** via `/api/cockpit/brief` — reuses the repo's Claude pattern, fills the most visible placeholder.
3. **Three real feeds** (HBA, USD/IDR, Capesize) to make the as-of strip live, with fallback + freshness badges.
4. **Multi-agent Chief of Staff** + RAG corpus.
5. **MIND ID portfolio extension** + capital-allocation advisor.

### Plumbing caveat
The page is a **bundled standalone** (compiled React export), so live AI/data wiring means either rebuilding it from source or adding the model/sim/`/api` logic alongside it. The **Monte Carlo specifically** can drop into the existing in-browser model **without a rebuild** — which is why it leads the sequence.

---

## 7 · Guardrails

- **Derived, never canned** — every figure traces to the model or a cited source.
- **Fallbacks everywhere** — a dead feed or AI timeout degrades to the current deterministic values, never a blank panel (the repo already follows this discipline).
- **Provenance & freshness** on every AI claim and live number.
- **Policy bands as hard gates** — recommendations respect the board's dividend/risk policy (e.g. the existing 15–35% spot-share band) and flag breaches rather than hiding them.
