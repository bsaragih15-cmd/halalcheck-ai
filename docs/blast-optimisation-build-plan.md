# Build Plan — Blast Optimisation (handoff to Claude design)

> Companion to `blast-optimisation-design-brief.md`. The brief is **what it looks
> like**; this is **how to build it** so it wires up exactly like the existing
> live demos (Hauling, FSP, IROC/Control Tower). Read both before starting.

**Goal:** promote the `blast` use-case from a templated matrix card to a
dedicated **live demo** at `/blast.html`, matching the FSP / Hauling skeleton:
breadcrumb → KPI row → constraint strip → dark control-room screen (fragmentation
curve + bench pattern + safety gauges) → AI panel + scenario injects + copilot.

The hero is the **fragmentation size-distribution curve** (predicted vs target
P80, fines/on-spec/oversize bands); the design canvas is the **bench hole
pattern** (burden × spacing, coloured by MWD hardness / charge); the always-on
safety gate is the **PPV + flyrock** pair. Every recommendation is gated by the
vibration and flyrock limits before it is offered.

---

## 1 · Files to create / change

| Action | Path | Mirrors | Purpose |
|---|---|---|---|
| **new** | `mining-demo/public/blast.html` | `public/haul.html` | The page: header, KPI row, screen, rails, AI panel, copilot, freeform row |
| **new** | `mining-demo/public/js/blast.js` | `public/js/haul.js` | Page controller: render, slider/scenario wiring, fetch, draw curve + pattern + gauges |
| **new** | `mining-demo/public/js/blast-scenarios.js` | `public/js/haul-scenarios.js` | **Canonical deterministic engine** — single source of truth for on-screen state |
| **new** | `mining-demo/data/blast.js` | `data/haul.js` | Server fallbacks (`blastFallback`, `blastParseFallback`, `blastCopilotFallback`) — import from the canonical engine, never re-derive |
| **edit** | `mining-demo/server.js` | haul/iroc endpoints | Add `BLAST_PROMPT` + `BLAST_PARSE_PROMPT` + `BLAST_COPILOT_PROMPT` and three endpoints |
| **edit** | `mining-demo/public/js/usecases.js` | `haul` case (line ~417) | Flip `blast` to `flagship: true, href: '/blast.html'` so the matrix cell becomes a LIVE DEMO link |
| **edit** | nav in each page header | existing nav links | Add a "Blast" link; cross-link from Control Tower & Blending (mine-to-mill) |

**Reuse verbatim** (do not re-implement): `kpi-card`, `fsp-screen`/`fsp-tab`/
`fsp-status`, `bottleneck-strip`, `ai-panel` + `renderAIResult`, `risk-item`,
`copilot`, `freeform-row`, and the haul gauge components. Design tokens and fonts
are already loaded — see brief §7.

---

## 2 · Architecture rule (the one that matters)

**The deterministic engine in `blast-scenarios.js` is the source of truth for
everything drawn on screen.** It computes the fragmentation curve, P80, powder
factor, pattern, PPV and flyrock for any `{design, scenario}` input. The page
always re-draws from it (so sliders/scenarios react instantly, with no API
key), and `data/blast.js` imports the same `buildMetrics()` so the server
fallback can never drift from the client.

Claude (the API) sits **on top**: it parses free-text into a scenario, writes
the rationale/headline/recommendations, and prices the value — but it does not
own the numbers on the chart. This is exactly the haul pattern
(`data/haul.js` → `buildMetrics(disruptionId)`), and it is why every demo
"works fully without an API key" (server.js:73).

```
slider / scenario / NL note
   │
   ▼
blast-scenarios.js  buildMetrics({design, scenario})  ──► curve, pattern, P80, PPV, flyrock, value
   │  (client draws directly)                              │ (server fallback imports the same)
   ▼                                                       ▼
blast.js renders ◄────────── /api/blast/analyze (Claude rationale on top) ──── data/blast.js
```

---

## 3 · Endpoints (add to `server.js`)

Follow the `askClaude({systemPrompt, userMessage, fallback, label})` helper
(server.js:69) — it already gives caching, rate-limit, 25s timeout, and the
unbreakable fallback. Three endpoints, mirroring haul:

| Endpoint | Body | Fallback | Notes |
|---|---|---|---|
| `POST /api/blast/analyze` | `{ design, scenario }` | `blastFallback(scenario)` | Main optimise call. `BLAST_PROMPT` already drafted in brief §6 — drop in verbatim |
| `POST /api/blast/parse` | `{ text }` | `blastParseFallback(text)` | NL note → scenario (`harder-seam` / `structure-near` / `wet-holes` / `finer-feed` / `optimise`). 400 if empty |
| `POST /api/blast/copilot` | `{ question, state }` | `blastCopilotFallback({question,state})` | 2-3 sentence answer grounded ONLY in live-state JSON. 400 if empty |

Model is `claude-opus-4-8` (server.js:17). The analyze response schema is the
JSON in brief §6 (headline, powderFactorKgM3, predictedP80mm, fragmentation,
bindingConstraint, designActions[], vibration, flyrock, downstreamUpliftTph,
recommendations[], valueImpactUSD, narrative). `{headline, recommendations[],
valueImpactUSD, narrative}` feed `renderAIResult`; the rest drive the bespoke UI.

Write the two parse/copilot prompts in house style (persona → exact JSON
schema → rules → "Return ONLY valid JSON"), matching `HAUL_PARSE_PROMPT` /
`HAUL_COPILOT_PROMPT`.

---

## 4 · Deterministic engine — `blast-scenarios.js`

The physics can be light but must be **internally consistent and visibly
reactive**. Suggested toy model (tune for plausibility, not a thesis):

- **Inputs (design):** burden, spacing, hole diameter (229 mm), bench height
  (~15 m), stemming, sub-drill, powder factor (kg/m³), inter-hole timing (ms),
  plus MWD hardness profile across the bench and target P80.
- **P80 ≈ a − b·PF** form (the existing card uses `P80 ≈ 680 − 380×PF`,
  usecases.js:228 — reuse as the spine, then modulate by burden×spacing and rock
  hardness). Build the full %-passing curve around P80 (e.g. Rosin–Rammler) so
  fines / on-spec / oversize bands fall out.
- **PPV** rises with charge-per-delay and falls with timing spread / distance to
  the nearest structure; **flyrock range** rises with PF and falls with
  stemming. Both compared against a limit → `OK | WATCH | BREACH`.
- **Value:** mine-to-mill uplift (throughput t/h from finer feed × margin) +
  avoided oversize re-handling, **net of marginal explosive cost**. Same
  derive-never-canned discipline as FSP/Hauling (brief §2).

Export `buildMetrics({design, scenario})` returning a flat object the page draws
from and the fallback maps onto the API schema (mirror `haulFallback`,
data/haul.js:9). Provide the 4 scenario presets as deterministic deltas on the
baseline design (harder seam → charge up in hard zone + watch PPV; structure
near → tighten PPV limit, back off PF / re-time; wet holes → re-deck / stemming;
finer-feed → lift PF toward fines watch).

---

## 5 · Page layout — `blast.html` (top → bottom)

Reuse the haul.html shell (header with OS logo back-link, live clock, Live
badge; body grid `1.4fr | 1fr` = screen+KPIs | AI rail).

1. **KPI row** (4 north-star cards): powder factor kg/m³ · predicted P80 mm ·
   dig rate bcm/h · PPV vs limit mm/s. Deltas vs target / limit.
2. **Constraint strip** (`bottleneck-strip`): binding = fragmentation / vibration
   / flyrock / cost + "what governs this design" note.
3. **HERO — fragmentation curve** (new SVG): cumulative %-passing vs size,
   predicted line vs target band, P80 marker, fines/on-spec/oversize/boulder
   shading. Re-draws on every design change.
4. **Bench pattern** (new SVG): plan-view hole grid (burden × spacing) coloured
   by MWD hardness / charge; electronic-detonator timing contours. The drag
   canvas.
5. **Safety panel** (reuse haul gauges): PPV-vs-limit gauge + flyrock range vs
   exclusion gauge — always visible; a rejected design flashes the limit.
6. **Reconciliation** (optional 3rd tab): planned vs image-measured actual
   fragmentation + muckpile movement, feeding the next design.
7. **Scenario injects + freeform** (`freeform-row`): 4 presets + NL box →
   `/api/blast/parse` → re-solve.
8. **AI panel** (`renderAIResult`) + **copilot** (`/api/blast/copilot`).

Tabs (mirror FSP/Hauling): **Fragmentation** · **Pattern** · **Reconciliation**.

**The "aha":** dragging powder factor / spacing re-draws the curve AND swings the
PPV + flyrock gauges together — fragmentation and safety move at once, and a
limit breach visibly rejects the design (brief §7 motion).

---

## 6 · Matrix + nav wiring

- In `usecases.js`, the `blast` case (~line 203) currently renders as a templated
  card. Add `flagship: true` and `href: '/blast.html'` (mirror the `haul` case,
  usecases.js:417) so the Drill & Blast cell at `4w / span [3,3]` renders as a
  **LIVE DEMO** link instead of IN DEV. Keep the existing kpis/charts as the
  card preview if the template still reads them; the dedicated page supersedes
  them on click.
- Add a **Blast** entry to the top nav on each page header (next to Hauling /
  Control Tower / Blending).
- Cross-link: from Control Tower (Batu Hijau, same site) and from Blending /
  Recovery (mine-to-mill story).

---

## 7 · Build order (suggested phases)

1. **Engine first** — `blast-scenarios.js` with `buildMetrics()` + 4 presets;
   verify numbers are consistent (curve integrates, PPV/flyrock gate sanely).
2. **Server** — add the 3 prompts + 3 endpoints + `data/blast.js` fallbacks
   (import the engine). Confirm each returns valid JSON with no API key.
3. **Page shell** — `blast.html` from the haul shell: header, KPI row, tabs,
   rails, freeform, copilot, AI panel via `renderAIResult`.
4. **Hero visuals** — fragmentation curve SVG + bench pattern SVG + safety
   gauges, all driven by the engine; wire sliders → live re-draw.
5. **Wire AI** — `/analyze` rationale into the panel; `/parse` for the NL box;
   `/copilot` for Q&A. Loading/skeleton states like haul.
6. **Matrix + nav** — flip the `blast` case to a flagship live link; add nav +
   cross-links.
7. **Verify** — run `npm run start:mining` (port 3003), click through all 4
   scenarios + free-text + a few slider drags, with and without `ANTHROPIC_API_KEY`.

---

## 8 · Acceptance checks

- [ ] `/blast.html` loads and reads as one product with `/haul.html` and `/fsp.html`.
- [ ] Fragmentation curve + bench pattern + PPV/flyrock gauges all re-draw live
      when a design slider moves — **no API key required**.
- [ ] No recommended design ever shows PPV or flyrock over limit (the gate holds).
- [ ] All 4 scenario presets + a free-text note produce a coherent re-design.
- [ ] Copilot answers are grounded in the on-screen state.
- [ ] With no `ANTHROPIC_API_KEY`, everything still works (fallbacks); with a
      key, the AI panel/headline/value come from Claude.
- [ ] Drill & Blast matrix cell shows **LIVE DEMO** and links to `/blast.html`.
- [ ] Value is derived (throughput uplift net of explosive cost), never canned.

---

## Open questions for the design pass

1. **Reconciliation tab** — ship in v1, or stub it and land in a fast-follow?
   (The curve + pattern + safety gates are the core demo; reconciliation is the
   "learns from every blast" proof and can follow.)
2. **Hole-by-hole charge** — show variable charge per hole from MWD (richer,
   more differentiated) vs a single domain powder factor (simpler)? Brief §5
   leans variable; confirm appetite.
3. **Tabs vs single scroll** — match FSP/Hauling tabs, or put curve + pattern
   side-by-side on one screen for a denser "1 view"? The original ask was
   "what could be done in 1 view," which argues for side-by-side.
