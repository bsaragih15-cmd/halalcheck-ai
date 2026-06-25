# Design handoff — alternative capital-allocation visualizations (Allocate / Stage 04)

> Paste everything below the line into Claude (design / artifact mode). It is self-contained.

---

## Brief

Build an **interactive HTML artifact** that mocks up **3–4 alternative ways to visualize capital allocation** for a mining-holding-company CEO dashboard ("MIND ID CEO Cockpit"). The "Allocate" tab decides how to deploy a **fixed discretionary pool of Rp 8.0T** across competing uses (capex projects, deleverage, a resilience buffer) to maximize value subject to guardrails. I want to compare visualization approaches side by side, then pick one to build into the real product. Use the **real data, palette, and semantics** below so the mockups look native to the cockpit.

Render all options on **one scrollable page**, each in its own titled panel with a one-line "what it's good for / blind spot" caption. Add a **dark/light theme toggle** (default dark). Self-contained: inline CSS + JS, inline SVG or `<canvas>`, no external libraries except Google Fonts (Inter + IBM Plex Mono). No build step.

## The job to be done

A holding company has **Rp 8.0T of discretionary capital** (from forecast dividend surplus + debt headroom). It must split that pool across **6 competing uses**. The CEO needs to see: **which use earns the most per next rupiah, where the pool runs out, what the mix does to leverage and resilience, and how a chosen mix trades value against safety.** The current UI is a **list of uses with ± steppers + allocation bars**, three **presets** (Max value / Balanced / Max resilience), **guardrail chips**, and an **efficient frontier** (value vs resilience). So DON'T re-propose those four. The gaps are **marginal value / opportunity cost** (which use to fund next) and **whole-pool composition at a glance** (how the 8.0T is carved up and where it flows).

## Options to prototype (and feel free to invent better ones)

1. **Marginal-return staircase (merit order)** — priority. Uses ranked left→right by IRR (or NPV-per-rupiah); **bar width = capital allocated, bar height = IRR**; a horizontal **hurdle line at 10%**; a vertical marker where **cumulative capital hits the Rp 8.0T pool**. Instantly shows what clears the hurdle, what's funded, and what gets cut.
2. **Mekko / 100%-width pool bar** — one bar = the whole 8.0T pool, segment widths = each use's allocation, colored by use; optional 2nd encoding (segment height or shade = strategic-fit score). Whole-pool composition in one glance.
3. **Capital Sankey** — pool flows left→right into the 6 uses, then into outcomes (NPV created, leverage change, resilience buffer). Shows capital routing and what each rupiah buys.
4. **Deploy map (bubble)** — **x = strategic fit (0–100)**, **y = IRR %**, **bubble size = allocation**; hurdle line at y=10%; quadrants (Fund / Strategic-but-dilutive / Cash-cow / Cut).

Already built — skip: efficient frontier (value vs resilience), preset buttons, ± steppers with allocation bars, guardrail chips.

## The data (illustrative, Rp = trillion)

**Pool: Rp 8.0T discretionary capital.** Group leverage now **1.2×**, cap **2.5×**, EBITDA **19.2T** (net debt ≈ lev × EBITDA). NPV hurdle rate **10%**. Stress-test requires a **resilience buffer ≥ Rp 2.5T**.

| Use | Subsidiary | Type | IRR | Strategic fit /100 | Max (Rp T) | Color | Note |
|---|---|---|---|---|---|---|---|
| Nickel / battery downstream | Antam | capex | **16%** | 95 | 2.5 | `#15a06d` | EV value chain · hilirisasi mandate |
| SGAR alumina refinery | Inalum · Antam | capex | **14%** | 90 | 3.0 | `#3f86cf` | cuts alumina import dependence |
| Ausmelt furnace upgrade | Timah | capex | **12%** | 50 | 1.0 | `#dc5a50` | tin recovery & unit cost |
| Coal gasification (DME) | PTBA | capex | **9%** | 60 | 2.0 | `#d9920f` | energy security · **below 10% hurdle → earns no NPV** |
| Deleverage (debt paydown) | Holding | delev | 7% | 30 | 4.0 | `#7d6be0` | avoided interest · cuts leverage |
| Resilience buffer | Holding | buffer | 0% | 20 | 4.0 | `#8b9a92` | cash held vs a stress breach |

**Presets (each sums to 8.0T):**
- **Max value** — buffer 2.5, nickel 2.5, sgar 3.0
- **Balanced** — buffer 2.5, nickel 2.5, sgar 1.5, delev 1.5
- **Max resilience** — buffer 3.5, delev 4.0, tin 0.5

## How the outputs compute (use these so numbers reconcile with the real model)

- **NPV created** = Σ over capex uses of `amount × max(0, IRR − 10%) × 5` (5-year horizon). DME (9%) and below-hurdle uses add **zero** NPV. (Max value ≈ Rp 1.35T; Balanced ≈ 1.05T; Max resilience ≈ 0.05T.)
- **Group leverage after** = `(1.2 × 19.2 + 0.4 × capexTotal − delev) / 19.2`. Capex adds leverage (0.4× per rupiah equity injected); deleverage subtracts rupiah-for-rupiah.
- **Strategic tilt** = capex-weighted average of strategic-fit scores, out of 100.
- **Resilience** = `buffer + 0.5 × delev`.

**Guardrails (green ✓ / red ✕):** resilience buffer ≥ Rp 2.5T · leverage ≤ 2.5× · total allocation ≤ Rp 8.0T pool.
**Snapshot KPIs:** NPV created · group leverage (was → now) · resilience buffer vs stress need · strategic tilt.

## Design system — match this exactly

Fonts: **Inter** (UI), **IBM Plex Mono** (all numbers). Panel radius ~12–13px. Subtle, data-dense, "Bloomberg-terminal-meets-fintech" feel — restrained, no heavy gradients on content.

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
Use the per-use colors (table above) for identity. Use green/amber/red only for go/no-go signals (above/below hurdle, guardrail pass/fail). The hurdle line and the "pool exhausted" marker should read as hard thresholds.

## Deliverable

One self-contained `.html` artifact. Each visualization in its own panel with a short caption naming its strength and its blind spot. Make the chosen-mix numbers (NPV, leverage, buffer) reconcile with the formulas above. Hover tooltips with the underlying numbers are a plus. Make it feel like a real cockpit tab, not a chart gallery.
