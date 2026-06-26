# Design handoff — alternative subsidiary-performance visualizations

> Paste everything below the line into Claude (design / artifact mode). It is self-contained.

---

## Brief

Build an **interactive HTML artifact** that mocks up **3–4 alternative ways to visualize subsidiary performance** for a mining-holding-company CEO dashboard ("MIND ID CEO Cockpit"). I want to compare visualization approaches side by side, then pick one to build into the real product. Use the **real data, palette, and semantics** below so the mockups look native to the existing cockpit.

Render all options on **one scrollable page**, each in its own titled panel with a one-line "what it's good for / blind spot" caption. Add a **dark/light theme toggle** (default dark). Self-contained: inline CSS + JS, inline SVG or `<canvas>`, no external libraries except Google Fonts (Inter + IBM Plex Mono). No build step.

## The job to be done

A holding company owns 5 subsidiaries. The CEO needs to see, at a glance: **who is off-plan, who is trending the wrong way, and who actually matters** (a small subsidiary beating plan is less important than a large one missing it). The current scorecard is a row-per-subsidiary table with **bullet charts (actual vs plan) + YTD sparklines (momentum)** already built — so DON'T re-propose those. The gap is **materiality** (size/contribution) and **cross-subsidiary comparison at a glance**.

## Options to prototype (and feel free to invent better ones)

1. **Contribution treemap** — one rectangle per subsidiary, **area = share of group EBITDA (or dividend)**, **color = performance vs plan (RAG)**. This is the priority — it fixes the "small-green-vs-big-red" blind spot.
2. **Risk/return quadrant** — bubble scatter: **x = performance vs plan**, **y = leverage (× of cap)**, **bubble size = EBITDA**. Quadrant labels: Healthy / Watch / Act / Over-levered.
3. **Heatmap matrix** — subsidiaries (rows) × metrics (cols: EBITDA, Dividend, Leverage, + key ops), cells colored RAG. Compact, scan for red clusters.
4. **Diverging variance bars** — center line = plan (100%), bars extend left (under) / right (over), so the sign and size of the miss is directional.

Skip radar/spider charts — they make cross-subsidiary comparison harder.

## The data (illustrative, Rp = trillion)

Group totals: EBITDA **19.2 / 20.6T plan (93%)** · Dividends upstreamed **4.0 / 4.4T (91%)** · Group leverage **1.1×** (cap 2.5×) · Flags: **1 red, 2 amber**.

| Subsidiary | Commodity | EBITDA a/p (Rp T) | Dividend a/p (Rp T) | Leverage (cap 2.5×) | Status | Brand color |
|---|---|---|---|---|---|---|
| PTBA   | Thermal coal           | 7.4 / 7.7 (96%)  | 1.8 / 1.9 | 1.1× | WATCH   | `#d9920f` |
| Antam  | Gold · nickel · bauxite| 6.5 / 7.1 (92%)  | 1.0 / 1.0 | 0.6× | WATCH   | `#15a06d` |
| Inalum | Aluminium              | 4.0 / 4.5 (89%)  | 0.9 / 1.2 | 1.8× | ACT     | `#3f86cf` |
| Timah  | Tin                    | 1.3 / 1.25 (104%)| 0.3 / 0.3 | 0.9× | ON PLAN | `#dc5a50` |
| Freeport | Copper · gold (JV)   | — visibility only, **excluded from quantified cash** | — | — | JV | `#7d6be0` |

Key ops (for the heatmap, % of plan unless noted; ↓ = lower is better):
- PTBA: Coal output 31/31.5 Mt · Cash cost 74 vs 70 $/t ↓ · Realized vs ICI 98% · DMO 100%
- Antam: Gold 101% · Ferronickel 92% · Nickel ore 99%
- Inalum: Aluminium output 94% · Smelter utilisation 95% · Power cost 114% ↓ (the binding red)
- Timah: Tin metal 106% · Ore grade 100% · Cash cost 98% ↓

## RAG semantics (apply consistently)

- **"Higher is better" metrics** (EBITDA, dividend, output): green if actual ≥ 98% of plan · amber if ≥ 90% · red if < 90%.
- **"Lower is better" metrics** (cash cost, power cost): green if ≤ 100.1% of plan · amber if ≤ 110% · red above.
- **Leverage**: green if < 1.5× (0.6 × cap) · amber if < 2.5× (cap) · red at/above cap.
- **Subsidiary status = worst-of** all its metrics (one red metric ⇒ ACT).

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
Use RAG colors for performance encoding; use the per-subsidiary brand colors (table above) only for identity dots/labels, not for performance.

## Deliverable

One self-contained `.html` artifact. Each visualization in its own panel with a short caption naming its strength and its blind spot. Hover tooltips showing the underlying numbers are a plus. Make it feel like a real cockpit tab, not a chart gallery.
