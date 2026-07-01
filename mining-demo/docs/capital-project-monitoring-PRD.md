# PRD — Capital Project Monitoring ("Project Control Tower")

**Product:** MIND ID Project Control Tower — portfolio-level monitoring & governance of strategic capital projects across the operating companies.
**Status:** Draft for review · **Owner:** Holding Strategy / PMO · **Companion to:** Portfolio Control Tower (Financials · Capital · Operations).
**Decisions locked (brainstorm):** serves **both tiers** (Holding PMO + BOD); scope = **strategic megaprojects**; dimensions = **cost & schedule + benefits realization + risk & issues + stage-gate governance**; delivery = **this PRD, then an MVP demo module**.

---

## 1. Summary
MIND ID is deploying tens of Rp-trillion into a strategic downstreaming/hilirisasi build — smelters, refineries, mine expansions, power — spread across five operating companies. There is no single, comparable, holding-level view of whether those projects are on **budget, schedule, scope**, whether they will **deliver their business case**, and what needs **board escalation**. The Project Control Tower gives the Holding PMO a controls-grade workspace that rolls up into a BOD exception view — one source of truth, standard definitions, early warning.

It sits **above** subsidiary project-management tools (Primavera/MS Project/SAP PS); it does not replace scheduling or execution — it governs.

## 2. Problem & context
- **Capital wave, fragmented visibility.** Each subsidiary runs and reports its megaprojects differently (different % complete definitions, cost baselines, stage-gates). The holding cannot compare or aggregate.
- **Late surprises.** Cost overruns and schedule slippage typically surface at reporting cycles, after the point of cheap intervention.
- **Benefits go untracked.** Once a project is sanctioned (FID), the business case (capacity, IRR, import-substitution, value-add) is rarely tracked to realization.
- **Board can't govern at altitude.** The BOD lacks an exception-based view: which few projects need attention, and why.
- **Strategic stakes.** These projects carry national objectives (hilirisasi, import substitution, EV supply chain) and feed the group dividend / State contribution — so overruns and delays are strategic, not just operational.

## 3. Objectives & success metrics
| Objective | Success metric |
|---|---|
| Single source of truth for strategic projects | 100% of in-scope projects reported monthly on a standard schema |
| Earlier warning on cost/schedule breach | Median time from breach-onset to board flag ↓ (target: flag ≥1 reporting cycle earlier) |
| Faster intervention on red projects | Time from "red" to board decision ↓ |
| Benefits realized vs business case | % of completed projects meeting sanctioned capacity/IRR |
| Portfolio delivery health | % of projects on-budget (CPI ≥ 0.95) and on-schedule (SPI ≥ 0.95) |

## 4. Users & personas (two tiers, one system)
| Persona | Role | Cadence | Primary need | View |
|---|---|---|---|---|
| **Holding PMO / Project Governance Office** | Power user — aggregates, standardizes, challenges subsidiaries | Weekly / continuous | Controls depth: S-curves, EAC, variance, gate status, risk register | **PMO workspace** (full detail) |
| **BOD / Board Project Committee** | Governance & escalation | Monthly | Exceptions only: which projects are red, why, decision needed, benefits at risk | **Board exception view** (roll-up) |
| **Subsidiary project directors** | Data providers + own project view | Monthly submission | Low-friction submission; see their projects in group context | Project detail (own) |
| **State / Danantara (stakeholder)** | Strategic & benefits reporting | Quarterly | Benefits realization, strategic KPIs | Read-only benefits summary |

**Design principle:** one data model, two altitudes. The PMO workspace is the system of record; the Board view is a curated exception layer over the same data (no separate spreadsheets).

## 5. Scope
**In scope — strategic megaprojects:** board-sanctioned or above a capex threshold (e.g. **> Rp 500B** / **> ~US$30M**) — the ~10–20 projects that matter to the group. Full lifecycle: **FID → detailed design → construction → commissioning → ramp-up → benefits realization** (tracked ~2 years post-completion).

**Out of scope:** day-to-day scheduling & execution (stays in subsidiary tools); sustaining/small capex (may appear later as a single roll-up line per subsidiary); procurement/contract management.

**Illustrative portfolio (to validate the model):**
| Project | Company | Type | Sanctioned (illustrative) | First production | Strategic objective |
|---|---|---|---|---|---|
| Manyar copper smelter | Freeport/PTFI | Smelter | ~US$3.7B | 2024 | Copper downstreaming, domestic value-add |
| SGAR alumina Ph.1 | Inalum + Antam | Refinery | ~US$1.0B | 2025 | Bauxite→alumina, import substitution |
| SGAR alumina Ph.2 | Inalum + Antam | Refinery | TBD | ~2027 | Scale alumina self-sufficiency |
| Grasberg underground | Freeport/PTFI | Mine dev | multi-year | ramping | Sustain copper/gold output |
| Inalum smelter expansion | Inalum | Smelter | TBD | ~2026 | Aluminium capacity → ~900 kt |
| Antam Halmahera/RKEF nickel | Antam | Processing | TBD | phased | Nickel downstreaming |
| PTBA coal downstreaming (DME/gasification) | Bukit Asam | Downstream | TBD | TBD | Coal value-add, energy security |
| PTBA renewables / power | Bukit Asam | Power | TBD | phased | Energy transition |
| Timah TSL furnace upgrade | Timah | Smelter | TBD | ~2025 | Tin processing modernization |
| Battery materials / HPAL (JV) | MIND ID JVs | Downstream | TBD | phased | EV supply chain |

## 6. Key questions the product answers (jobs-to-be-done)
**Board tier:** Which projects need my attention, and why? · Are we on budget & schedule at portfolio level? · Will we get the promised value? · What's the total capital committed vs at risk? · What decisions are escalated to me?
**PMO tier:** For each project — what's the cost variance (EAC vs budget) and schedule variance (SPI)? · Where is contingency being drawn? · Which gate is it at and is it slipping? · What are the top risks and mitigations? · Is the forecast (EAC / forecast first-production) credible?

## 7. Functional requirements

### 7.1 Portfolio dashboard (both tiers)
- All in-scope projects on one screen with a **RAG heatmap across three axes: Cost · Schedule · Benefit**, plus overall status.
- Portfolio totals: **capital sanctioned · committed · spent · remaining · forecast overrun**.
- Board view = exceptions first (reds/ambers, escalations); PMO view = full grid, sortable/filterable by company, stage, RAG.

### 7.2 Cost & schedule (project controls spine)
- **S-curve:** planned vs actual vs forecast (EAC) cumulative spend over time.
- **Cost:** sanctioned budget · committed · actual · **EAC (Estimate at Completion)** · **VAC (Variance at Completion)** · contingency drawn/remaining.
- **Schedule:** % complete (planned vs actual) · key milestones with baseline/forecast/actual dates · slippage (days) · forecast first-production vs sanctioned.
- **Earned-value metrics:** **SPI** (schedule performance index), **CPI** (cost performance index), with RAG thresholds.

### 7.3 Benefits realization
- Business case captured **at sanction** and tracked: **capacity** (e.g. ktpa), **IRR/NPV at sanction vs current estimate**, first-production date, and **strategic KPIs** (import substitution Rp/USD, value-add captured, jobs, ESG).
- Status: on-track / at-risk / eroded; post-completion tracking (~2 yrs) to confirm the case was delivered.

### 7.4 Risk & issues
- Per-project **top risks** (likelihood × impact) with owner, mitigation, trend.
- **Portfolio risk register** roll-up; escalation flags; issues (realized risks) log.

### 7.5 Stage-gate governance
- Lifecycle **stage/gate** status (FID → FEED → construction → commissioning → ramp → BAU), gate approval dates (baseline vs actual), **change orders** and **funding drawdown** vs approved.

### 7.6 Alerts & exceptions
- Threshold-based flags: CPI/SPI < 0.90, VAC overrun > X%, milestone slip > Y days, contingency > Z% drawn, benefit downgrade, gate overdue. Feed the board exception view.

### 7.7 AI project copilot
- Ask-the-data chatbot (as built on Capital/Operations tabs): "Why is Manyar over budget?", "Which projects slip in 2025?", "Total overrun exposure?" — grounded in the project state.

## 8. Data model (per project)
```
project {
  id, name, company, sector, type,             // identity
  strategicObjective, businessCaseSummary,      // why
  stage, gate, gateApprovals[],                 // governance
  budgetSanctioned, committed, actual, eac, vac, contingency{drawn,remaining},  // cost
  pctComplete{planned, actual}, milestones[{name, baseline, forecast, actual}], // schedule
  firstProduction{sanctioned, forecast, actual},
  spi, cpi,                                      // earned value
  benefits{capacity, irrSanction, irrCurrent, strategicKPIs[]}, benefitStatus,  // benefits
  risks[{title, likelihood, impact, owner, mitigation, trend}], issues[],       // risk
  ragCost, ragSchedule, ragBenefit, ragOverall, // status
  lastUpdated, source
}
```
**Reference data / taxonomy (the hard, essential part):** standard definitions of % complete, EAC method, stage-gate names, RAG thresholds, and EVM formulas — enforced across subsidiaries so numbers are comparable.
**Cadence:** monthly board cycle; PMO updates continuous. **Source:** subsidiary PMOs → holding (Phase 1 manual/template; later integration to SAP PS/Primavera).

## 9. Metric definitions (standardized)
- **CPI** = Earned Value ÷ Actual Cost (≥1 good). **SPI** = Earned Value ÷ Planned Value.
- **EAC** = Estimate at Completion (forecast final cost). **VAC** = Budget − EAC (negative = overrun).
- **RAG (illustrative):** Green CPI & SPI ≥ 0.95; Amber 0.90–0.95; Red < 0.90 or gate overdue or benefit eroded.
- **Benefit status:** On-track / At-risk / Eroded vs sanctioned capacity & IRR.

## 10. UX / views
- **Board exception view:** exceptions-first cards/list — red/amber projects, one-line "why", decision needed, benefit-at-risk; portfolio totals band.
- **PMO workspace:** full sortable grid (heatmap) → project detail (S-curve, cost table, milestones, gates, risks, benefits).
- **Project detail:** the single-project deep view used by both tiers and the subsidiary director.
- Consistent with the Portfolio Control Tower design system (mineral-terminal theme, IBM Plex, RAG language).

## 11. Non-functional
- **Confidentiality:** Freeport is a JV (51/49) — some project data is sensitive/contractual; role-based access & redaction.
- **Data quality & assurance:** submission validation, variance-vs-last-cycle checks, PMO sign-off before board view.
- **Integration (later):** SAP PS / Primavera / subsidiary PMO systems.
- **Auditability:** baseline vs forecast history; who changed what.

## 12. Phasing / roadmap
- **Phase 1 — MVP (demo module in Control Tower):** portfolio dashboard (Cost×Schedule×Benefit heatmap + totals) + project detail (S-curve, EAC/VAC, milestones, stage-gate, top risks, benefits) for ~8–12 strategic projects. Illustrative data. Board exception view + PMO grid.
- **Phase 2:** alerts/exceptions engine, benefits-realization tracker, portfolio risk register, AI project copilot.
- **Phase 3:** integration with subsidiary systems, predictive overrun/slip forecasting, stage-gate workflow & approvals.

## 13. Risks & resolved decisions
**Open risks**
- **Data standardization** across subsidiaries is the make-or-break (definitions of % complete, EAC). — *the real product risk.*
- **Adoption:** subsidiaries may resist holding scrutiny; needs low-friction submission + clear value back to them.

**Resolved (this iteration)**
- **Threshold for "strategic":** in scope = **sanctioned value ≥ Rp 1T, OR board-designated strategic** (regardless of size). Captures the ~10–15 megaprojects that move the group; smaller/sustaining capex aggregates as one roll-up line per subsidiary later.
- **JV data rights (assumed):** for JV projects (Freeport 51/49), the holding sees **summary cost/schedule/benefit + RAG only**; detailed contractor/commercial data is redacted. JV projects are marked "JV — summary". To be confirmed against the shareholder agreement.
- **Benefits sign-off (assumed):** the **Holding Investment Committee** signs off realized benefits at defined checkpoints — **first production, +12 months, +24 months** — on subsidiary submissions validated by the PMO.

## 14. MVP acceptance (what "done" looks like for Phase 1)
A single "Projects" tab where the BOD sees, in one screen, which strategic projects are red/amber and why, the total capital committed vs overrun exposure, and can open any project to a controls-grade detail (S-curve, EAC/VAC, milestones, gate, risks, benefits) — all on standard, comparable definitions.
