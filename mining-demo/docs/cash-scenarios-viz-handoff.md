# Design handoff — Cash & Scenarios improvements (Stage 03)

> Paste everything below the line into Claude (design / artifact mode). It is self-contained.

---

## Brief

Build an **interactive HTML artifact** that mocks up **3–4 improvements to a scenario stress-testing module** for a mining-holding-company CEO dashboard ("MIND ID CEO Cockpit"). The "Cash & Scenarios" tab lets a treasurer dial macro drivers and watch them convert into the holding's residual cash, with a Monte Carlo distribution and a cheapest-mitigation recommendation. I want to compare candidate features side by side, then build the winners into the product. Use the **real model, palette, and semantics** below so the mockups look native to the cockpit.

Render the options on **one page**, each in its own titled panel with a one-line "what it's good for / blind spot" caption. **Dark/light theme toggle** (default dark). Self-contained: inline CSS + JS, inline SVG or `<canvas>`, only Google Fonts (Inter + IBM Plex Mono). No build step.

> **Hard layout constraint:** the real view must fit one viewport without scrolling. Favor **compact placements** — a strip under the controls, a right-rail card, or an *overlay on the existing waterfall* — over tall new cards. Call out the footprint of each option in its caption.

## The module today (don't re-propose these)

- **Scenario bar**: driver sliders + volatility regime + preset picker + **pin/compare** (already built — pin a scenario to a chip strip, click to restore).
- **Holding FCF waterfall**: opening cash → dividend upstreaming (stacked by subsidiary) → opex → interest → debt principal → capex → equity → residual Free Cash Flow, with the board cash-floor line.
- **Subsidiary cash bridges**: each subsidiary's baseline → scenario impact → residual upstreaming.
- **Right rail**: a Hold/Watch/Act recommendation with the cheapest mitigation package, and a model-aware "Driver Copilot".

The gaps are **prioritization** (which risk to hedge first), **the breaking point** (how far can a driver move before the floor breaks), and **making the recommendation visual**.

## Options to prototype (and invent better ones)

1. **Tornado / driver-sensitivity bar** ← priority. Swing each driver ±1σ around the current scenario; plot horizontal bars sorted by impact on residual FCF (or on breach probability). Answers "what do I hedge first." Compact — fits the rail or a short strip.
2. **Reverse stress test ("break-it" mode)** — for a chosen driver, solve for the level at which residual FCF first crosses the floor; show the breaking point and how much headroom remains ("China can fall to 86 before the floor breaks"). A small gauge/slider-with-marker, not a tall card.
3. **Mitigation overlay on the waterfall** — render the recommended action package as ghost "before → after" bars on the *existing* waterfall, so you see exactly which obligation the hedge / refinance / defer-capex moves. Zero new footprint — it's an overlay.
4. **Contagion strip** — it's a common-factor model: show how one shock (e.g. commodity cycle −1σ) hits all four subsidiaries together, undercutting "diversification protects the floor." A slim horizontal strip of per-subsidiary impact bars.

Already shipped — skip: scenario pin/compare, the FCF waterfall, subsidiary bridges, the Hold/Watch/Act recommendation card.

## The model (illustrative, cash in Rp trillion)

**Common-factor Monte Carlo.** Each driver has a macro loading (shared shock) and idiosyncratic vol; the **volatility regime** (CALM 0.6× / BASE 1× / STRESSED 1.7×) scales all vols. Outputs: residual Holding FCF distribution (**P10 / P50 / P90**), **FCF-at-Risk** (= central − P10), and **cash-floor breach probability** (% of paths below the floor).

| Driver | Range (base) | Effect | macro load | vol (σ) |
|---|---|---|---|---|
| China demand index | 78–122 (**100**) | coal, nickel, aluminium, tin offtake | +0.80 | 0.08 |
| USD / IDR | 14,500–18,000 (**16,000**) | natural hedge: export cash vs USD debt | −0.55 | 0.05 |
| Commodity price cycle | −40%…+40% (**0**) | broad commodity basket vs plan | +0.85 | 0.14 |
| Board cash floor | Rp 0–6T (**2.0**) | breach = residual FCF below this | — | — |
| Energy & power cost | −30%…+60% (**0**) | smelter power — hits Inalum hardest | +0.20 | 0.12 |
| Carbon policy | 0–100 (**20**) | tighter = weighs on thermal coal | — | — |
| Regulation (royalty/DMO) | −20…+40 (**0**) | tighter royalty / domestic obligation | — | — |
| Financing pressure | −50…+450 bps (**+100**) | credit-spread move on holding interest | — | — |

**Subsidiaries** (upstreaming baseline Rp T; factor betas [china, cycle, fx, energy, carbon, reg]):
- **PTBA** 3.5 — `[0.60, 0.95, 0.40, −0.10, −0.70, −0.55]` — coal price, DMO, carbon
- **Antam** 1.8 — `[0.45, 0.65, 0.35, −0.15, −0.10, −0.30]` — gold cushions nickel cyclicality
- **Inalum** 2.2 — `[0.50, 0.80, 0.30, −1.05, −0.30, −0.25]` — power cost & alumina input (energy-sensitive)
- **Timah** 0.3 — `[0.55, 1.00, 0.40, −0.10, −0.05, −0.60]` — tin price & offshore cost
- **Freeport** — copper · gold **JV, excluded from quantified cash**

A representative central case (BASE regime, plan drivers): residual Holding FCF ≈ **Rp 3.3T (P50)**, floor Rp 2.0T, breach ≈ **17%**; under STRESSED ≈ **3.2T / 29% breach**. Mitigation levers available to the recommendation: FX-debt hedge, refinancing, defer capex, accelerate a subsidiary special dividend.

## RAG / threshold semantics

- **Breach probability**: green < 10% · amber 10–25% · red > 25%.
- **Residual FCF vs floor**: green if comfortably above · red if P10 (or central) dips below the floor.
- Use these for the headline color of any gauge / bar.

## Design system — match this exactly

Fonts: **Inter** (UI), **IBM Plex Mono** (all numbers). Panel radius ~12–13px. Subtle, data-dense, "Bloomberg-terminal-meets-fintech" — restrained, no heavy gradients on content.

**Dark theme (default):**
```
bg #060c0b · panel #0b1614 · inset #0a1412 · ink #e2f5ef · muted #82a79e · faint #557067
border rgba(45,224,196,.15) · green #2fe0c0 · gold #f0a830 · red #ff5d6c · blue #36c5d6 · violet #8f9dff
```
**Light theme:**
```
bg #eef4ef · panel #fbfdf9 · inset #f2f7f2 · ink #16211d · muted #64756f · faint #8b9a92
border #c4d5cb · green #15a06d · gold #d9920f · red #dc5a50 · blue #3f86cf · violet #7d6be0
```
Subsidiary identity colors: PTBA `#d9920f` · Antam `#15a06d` · Inalum `#3f86cf` · Timah `#dc5a50` · Freeport `#7d6be0`. Use green/amber/red only for risk signals (breach severity, above/below floor).

## Deliverable

One self-contained `.html` artifact. Each option in its own panel with a strength/blind-spot caption **and its layout footprint** (rail / strip / overlay / card). Hover tooltips with the underlying numbers are a plus. Make it feel like a real cockpit tab, not a chart gallery.
