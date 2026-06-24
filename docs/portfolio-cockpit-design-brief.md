# Design Brief — MIND ID Portfolio Cockpit (OreSight AI)

> **Roadmap.** Elevate the single-asset PTBA CEO Cockpit into a **holding-company portfolio cockpit** for the MIND ID Group CEO/CIO — portfolio NAV and risk, consolidated dividend-at-risk, capital allocation, and the national downstreaming (hilirisasi) mandate, all AI-assisted.

The existing cockpit and its Monte Carlo simulator model **one asset** (PT Bukit Asam, coal). MIND ID is the holding company for Indonesia's state mining enterprises across **six-plus commodities** with very different cycles. This brief defines the portfolio-level view: what it shows, the visualizations, the AI use cases, the data, and the model architecture — and how it extends what is already built.

| | |
|---|---|
| **Audience** | MIND ID Group CEO / CIO / Board (holding-company level) |
| **Scope** | Multi-asset, multi-commodity portfolio — coal, nickel, copper, gold, tin, bauxite/aluminium |
| **Builds on** | `cockpit-montecarlo.html` (correlated Monte Carlo dividend-at-risk + AI Chief-of-Staff brief) and `docs/cockpit-ai-design-brief.md` |
| **Design system** | Reuse the cockpit's dark executive language (metric bar, as-of strip, narrative columns) |
| **Backend** | Reuse the `askClaude` `/api` pattern (cached prompt, deterministic fallback) |

---

## 1 · The framing shift

The PTBA cockpit answers "how is this asset doing?". The portfolio cockpit answers four **holding-company** questions:

1. **What is the portfolio worth, and what is it exposed to?** — NAV, commodity mix, concentration.
2. **What is the consolidated dividend / cash, and how at-risk is it?** — group dividend-at-risk.
3. **Where should the next rupiah of capital go?** — capital allocation across subsidiaries and projects.
4. **Are we delivering the national mandate?** — downstreaming (hilirisasi), critical minerals, energy transition.

Question 4 is unique to MIND ID: it is not only a financial holding but the steward of Indonesia's strategic minerals. Coal throws off cash **now**; nickel/copper/bauxite are the **transition** growth bets. The portfolio's job is to fund the second with the first — and the cockpit should make that trade-off legible.

## 2 · The portfolio (so the views are concrete)

| Subsidiary | Commodity | Primary cycle driver |
|---|---|---|
| **PTBA** (Bukit Asam) | Coal | China power demand, HBA/ICI, energy transition (structurally declining) |
| **ANTAM** (Aneka Tambang) | Nickel, gold, bauxite, ferronickel | EV batteries, gold safe-haven |
| **Vale Indonesia** (MIND ID stake) | Nickel | EV / stainless steel |
| **Freeport Indonesia** (MIND ID 51%) | Copper, gold | Electrification, grid build-out |
| **Timah** (TINS) | Tin | Electronics, solder |
| **Inalum** | Aluminium / alumina | Construction, lightweighting, downstream value-add |

The diversity is the point: different commodities peak at different times, so the **group** dividend is steadier than any single asset — and that diversification benefit is something the cockpit should quantify, not assume.

---

## 3 · Hero visualizations

The views that would change a board conversation, each tied to the decision it supports:

| # | Visualization | What it shows | Decision it supports |
|---|---|---|---|
| 1 | **Portfolio treemap / bubble grid** | One tile per asset; size = NAV (or EBITDA), colour = momentum vs plan, commodity glyph | "Where is my value and what's moving" — the landing hero |
| 2 | **Consolidated dividend bridge** | Waterfall: each subsidiary's dividend contribution → group dividend to the state | Who carries the payout this year (today PTBA; later nickel/copper) |
| 3 | **Commodity-exposure sunburst** | Group EBITDA by Commodity → Subsidiary → Market | Reveals hidden concentration (e.g. EBITDA riding on two commodities + China) |
| 4 | **Cross-commodity correlation heatmap / network** | Coal vs nickel vs copper vs gold vs FX | The diversification story; gold as hedge, coal+nickel both lean on China |
| 5 | **Portfolio dividend-at-risk fan** | Group Monte Carlo with the full correlation matrix → P10/P50/P90 + diversification benefit | The analytical centerpiece — group risk < sum of standalone risks |
| 6 | **Risk-contribution bars** | Decompose group volatility into each asset's *contribution* to it | Where hedging buys the most group-level stability |
| 7 | **Capital-allocation Sankey** | Operating cash → dividends / debt paydown / capex by project (HPAL, smelters, SGAR alumina, battery JV) | The "where the money goes" board view |
| 8 | **Hilirisasi value-chain map** | Ore → smelter → refined metal → battery/aluminium, with value-add captured at each step | Quantifies the downstreaming thesis the government cares about |
| 9 | **Return-vs-risk bubble (frontier)** | Each asset/project on expected return vs risk; bubble = capital; efficient frontier overlay | Is the portfolio optimally weighted? |
| 10 | **Indonesia asset map** | Geographic, production/disruption status per site (weather, regulatory) | Operational situational awareness |

**Landing hero recommendation:** the treemap (1) + consolidated dividend bridge (2) + group dividend-at-risk fan (5) on one screen — value, payout, and risk in a single glance.

---

## 4 · AI use cases

- **Group Chief of Staff (multi-agent).** A per-commodity analyst agent (coal, nickel, copper, gold, tin) each reads its market + asset; a **CIO synthesizer** rolls them into one board brief ("portfolio posture is X because nickel oversupply offsets a constructive copper view"). Direct extension of the brief already shipped.
- **Capital-allocation optimizer.** Given a capex budget and the strategic mandate (downstreaming, dividend floor, leverage cap), solve for the allocation across subsidiaries/projects that maximizes risk-adjusted NPV. The single most valuable holding-level AI feature.
- **Cross-commodity scenario generation.** Claude composes internally-consistent group scenarios ("EV demand surge + China property slump + IDR weakness + nickel oversupply") and runs them through every asset twin at once.
- **Diversification & natural-hedge finder.** Surfaces where commodities offset (coal cash funds nickel capex; gold cushions a base-metals drawdown) and where to add hedges.
- **M&A / divestment screening.** "Increase the Vale stake? Divest thermal coal?" modelled against the portfolio with a transition-risk lens.
- **Downstreaming (hilirisasi) economics.** Model ore-export-ban → smelter → battery-supply-chain value capture, and the optimal sequencing of smelter / HPAL / alumina investments.
- **Transition & ESG navigator.** Coal phase-down path vs critical-minerals ramp; group carbon exposure; CBAM impact on aluminium/steel inputs; a 2030/2045 portfolio projection.
- **Sovereign / strategic lens.** Critical-minerals security, supply commitments to the national battery ecosystem, and China-demand concentration as a geopolitical exposure.
- **Conversational portfolio Q&A.** "What happens to the state dividend if nickel falls 20% and gold rallies?" → re-runs the group Monte Carlo and narrates.

---

## 5 · Data & model architecture

- **Per-asset twins.** One `DCLogic`-style model per subsidiary (PTBA's is the template), consolidated by **ownership %** into a holding model → group revenue, EBITDA, dividend, NAV.
- **One correlation matrix** across coal / nickel / copper / gold / tin / aluminium + USD/IDR + freight drives the portfolio Monte Carlo — this is what produces the diversification benefit (group P10 is *higher* than the sum of standalone P10s).
- **Feeds** (via a cached `/api/portfolio/feeds` aggregator, fallback + freshness badges): LME nickel/tin/aluminium/copper, gold, coal (HBA/ICI/Newcastle), USD/IDR, freight, China macro, plus each subsidiary's production/financials from IDX disclosures.

## 6 · How it extends what is built

The simulator already has the engine — a correlated Monte Carlo with a dividend-at-risk output and an AI brief. **Portfolio mode** =
1. swap PTBA's single `DCLogic` for an array of per-commodity twins,
2. expand the 4×4 correlation matrix to ~7×7,
3. aggregate by ownership %,
4. add the treemap + dividend bridge as the new hero, and
5. promote the AI brief to the **CIO synthesizer**.

## 7 · Phasing

1. **Portfolio NAV/EBITDA treemap + commodity-exposure sunburst** — high visual impact, mostly static. The landing hero.
2. **Group dividend-at-risk Monte Carlo** with the diversification benefit quantified — extends the existing simulator.
3. **Capital-allocation optimizer** + risk-contribution decomposition.
4. **Hilirisasi / transition layer** — downstreaming value-chain and the 2030/2045 portfolio projection.

## 8 · Guardrails

- **Derived, never canned** — every figure traces to an asset twin or a cited source.
- **Fallbacks everywhere** — a dead feed or AI timeout degrades to deterministic values, never a blank panel.
- **Provenance & freshness** on every AI claim and live number.
- **Strategic mandate as a hard constraint** — capital-allocation recommendations respect the dividend floor, leverage cap, and downstreaming commitments, and flag breaches rather than hiding them.
- **Illustrative, not investment advice** — the cockpit is a decision-support twin calibrated to public order-of-magnitude figures.
