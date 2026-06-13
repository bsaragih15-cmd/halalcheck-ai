#!/usr/bin/env python3
"""Generate the Pillar Optimisation demo design-brief PDF (handover to Claude)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                HRFlowable, PageBreak, ListFlowable, ListItem)

# ── Palette (OreSight AI tokens) ──────────────────────────────────────────────
GREEN = colors.HexColor("#15803d")
DARK = colors.HexColor("#10150f")
INK = colors.HexColor("#1d251f")
MUTED = colors.HexColor("#6e7468")
CREAM = colors.HexColor("#f6f5ef")
LINE = colors.HexColor("#e2e0d6")
AMBER = colors.HexColor("#b45309")
BLUE = colors.HexColor("#0e7490")
PURPLE = colors.HexColor("#7c3aed")
RED = colors.HexColor("#b91c1c")
WHITE = colors.white

styles = getSampleStyleSheet()
def S(name, **kw):
    base = kw.pop("parent", styles["Normal"])
    return ParagraphStyle(name, parent=base, **kw)

H1 = S("H1", fontName="Helvetica-Bold", fontSize=16, textColor=GREEN, spaceBefore=16, spaceAfter=6, leading=19)
H2 = S("H2", fontName="Helvetica-Bold", fontSize=12, textColor=INK, spaceBefore=12, spaceAfter=4, leading=15)
BODY = S("BODY", fontName="Helvetica", fontSize=9.5, textColor=INK, leading=14, spaceAfter=5)
SMALL = S("SMALL", fontName="Helvetica", fontSize=8, textColor=MUTED, leading=11)
MONO = S("MONO", fontName="Courier", fontSize=7.4, textColor=INK, leading=9.6)
MONO_LIGHT = S("MONO_LIGHT", fontName="Courier", fontSize=7.4, textColor=colors.HexColor("#dfe5da"), leading=9.6)
TAG = S("TAG", fontName="Helvetica-Bold", fontSize=8, textColor=GREEN, leading=11)
CELL = S("CELL", fontName="Helvetica", fontSize=8.2, textColor=INK, leading=11)
CELLH = S("CELLH", fontName="Helvetica-Bold", fontSize=8, textColor=WHITE, leading=11)
COVER_T = S("COVER_T", fontName="Helvetica-Bold", fontSize=30, textColor=INK, leading=34)
COVER_S = S("COVER_S", fontName="Helvetica", fontSize=12, textColor=MUTED, leading=17)

def bullets(items, style=BODY, color=GREEN):
    return ListFlowable(
        [ListItem(Paragraph(t, style), bulletColor=color, value="square") for t in items],
        bulletType="bullet", bulletFontSize=6, leftIndent=14, bulletOffsetY=1)

def rule(c=LINE, w=0.8, sb=4, sa=8):
    return HRFlowable(width="100%", thickness=w, color=c, spaceBefore=sb, spaceAfter=sa)

def table(data, col_widths, header=True, zebra=True):
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    cmds = [("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("LINEBELOW",(0,0),(-1,-1),0.4,LINE)]
    if header: cmds += [("BACKGROUND",(0,0),(-1,0),GREEN),("LINEBELOW",(0,0),(-1,0),0,GREEN)]
    if zebra:
        for r in range(1,len(data)):
            if r%2==0: cmds.append(("BACKGROUND",(0,r),(-1,r),CREAM))
    t.setStyle(TableStyle(cmds)); return t

def _chip(c, w=18):
    tb = Table([[""]], colWidths=[w*mm], rowHeights=[5*mm])
    tb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),c),("BOX",(0,0),(-1,-1),0.5,LINE)])); return tb

def header_footer(canvas, doc):
    canvas.saveState(); w,h = A4
    canvas.setFillColor(GREEN); canvas.rect(0,h-6,w,6,fill=1,stroke=0)
    if doc.page>1:
        canvas.setFont("Helvetica-Bold",8); canvas.setFillColor(GREEN); canvas.drawString(20*mm,h-14*mm,"OreSight AI")
        canvas.setFont("Helvetica",8); canvas.setFillColor(MUTED); canvas.drawRightString(w-20*mm,h-14*mm,"Pillar Optimisation — Design Brief")
        canvas.setStrokeColor(LINE); canvas.line(20*mm,h-16*mm,w-20*mm,h-16*mm)
    canvas.setFont("Helvetica",7.5); canvas.setFillColor(MUTED)
    canvas.drawString(20*mm,12*mm,"OreSight AI · Operations Intelligence for Indonesian Mining · Confidential design brief")
    canvas.drawRightString(w-20*mm,12*mm,f"{doc.page}"); canvas.restoreState()

story = []

# ══ COVER ═════════════════════════════════════════════════════════════════════
story += [Spacer(1,30*mm), Paragraph("DESIGN BRIEF · HANDOVER TO CLAUDE", TAG), Spacer(1,6)]
story += [Paragraph("Pillar Optimisation", COVER_T)]
story += [Paragraph("Underground geotechnical — extraction ratio vs ground stability, AI-monitored", COVER_S)]
story += [Spacer(1,8), rule(GREEN,1.4,2,10)]
story += [Paragraph(
    "An interactive demo for the OreSight AI platform: an underground bord-and-pillar panel where the AI "
    "balances <b>ore recovery against ground stability</b> — sizing and sequencing pillars to maximise the "
    "extraction ratio while holding every pillar's factor of safety above target, fused with live geotechnical "
    "monitoring (convergence, stress, microseismic). The optimisation counterpart to the Safety demo, and "
    "OreSight's first step from surface into underground ground-control.", BODY)]
story += [Spacer(1,14)]
meta = Table([
    [Paragraph("<b>Visual model</b>", CELL), Paragraph("Pillar FOS heat-map (plan-view pillar grid) as the hero, per the FSP/haul pattern", CELL)],
    [Paragraph("<b>Domain</b>", CELL), Paragraph("Bord-and-pillar panel, ~180 m depth, instrumented for convergence + microseismic", CELL)],
    [Paragraph("<b>Context note</b>", CELL), Paragraph("Pillars are an underground problem — framed as OreSight extending into underground coal (E. Kalimantan); adjust if a different setting is meant", CELL)],
    [Paragraph("<b>Design system</b>", CELL), Paragraph("Reuse OreSight light/dark control-room language from FSP", CELL)],
    [Paragraph("<b>Sources</b>", CELL), Paragraph("Lunder-Pakalnis / Salamon-Munro / Hedley-Grant pillar strength; Itasca, RocScience, Beck; Sintela / microseismic monitoring; ML pillar-stability literature", CELL)],
    [Paragraph("<b>Date</b>", CELL), Paragraph("13 June 2026", CELL)],
], colWidths=[33*mm, 132*mm])
meta.setStyle(TableStyle([("LINEBELOW",(0,0),(-1,-1),0.4,LINE),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("VALIGN",(0,0),(-1,-1),"TOP")]))
story += [meta, PageBreak()]

# ══ 1. CONTEXT & RESEARCH ════════════════════════════════════════════════════
story += [Paragraph("1 · Context &amp; goal", H1)]
story += [Paragraph(
    "In bord-and-pillar (room-and-pillar) mining, ore is extracted by driving roadways and leaving rock "
    "<b>pillars</b> to hold up the overburden. The central trade-off is recovery vs stability: shrink the pillars "
    "and you win ore but lose <b>factor of safety (FOS)</b>; over-size them and you sterilise reserves. Pillar "
    "optimisation finds the highest safe extraction ratio — and modern practice fuses that design with "
    "<b>live monitoring</b> so the as-mined ground confirms the as-designed assumption.", BODY)]
story += [Paragraph(
    "Goal: a demo that <i>feels like one product</i> with FSP and the hauling demo — a live geotechnical "
    "screen where the AI does the engineering judgement (which pillars are at risk, how much more can be "
    "safely recovered, what support/sequence makes it safe) and re-assesses when conditions change.", BODY)]

story += [Paragraph("What benchmark practice does (research synthesis)", H2)]
story += [bullets([
    "<b>Pillar strength is a width-to-height power law.</b> Standard formulas: <b>Lunder &amp; Pakalnis</b> (hard rock), <b>Salamon &amp; Munro</b> (coal), <b>Hedley &amp; Grant</b> &mdash; strength = K&middot;(w/h)^a. Pillar <b>stress</b> from the <b>tributary-area</b> method. <b>FOS = strength / stress</b>; accepted targets ~<b>1.6 for production pillars, 2.0 for barriers</b>.",
    "<b>The optimisation prize is real:</b> geometric optimisation has lifted recovery from <b>~44% to &gt;80%</b> safely; W/H ratio is the master lever (W/H &lt; 0.6 pillars are the problem children). Higher recovery levers: <b>backfill confinement</b>, and pillar-recovery methods (split-and-fender, pocket-and-wing, Christmas tree).",
    "<b>Monitoring stack (Sintela, Itasca, microseismic vendors):</b> roof-to-floor <b>convergence</b> meters, <b>extensometers</b> (in-rock displacement), <b>stress cells</b> and support <b>load cells</b>, and <b>microseismic</b> geophone arrays that triangulate fracturing <i>before</i> visible failure. Distributed fibre-optic sensing gives continuous coverage between geophones.",
    "<b>AI is proven here:</b> Random-Forest / SVM / ANN models predict pillar stability at <b>80&ndash;99% accuracy</b> from W/H, RMR and UCS; <b>hybrid frameworks</b> (empirical + numerical FLAC/RS2 + ML + real-time geophysics + probabilistic) improve predictions <b>15&ndash;20%</b> and target rockburst/subsidence risk.",
]), ]
story += [PageBreak()]

# ══ 2. METRICS ═══════════════════════════════════════════════════════════════
story += [Paragraph("2 · Metrics to adopt", H1)]
story += [Paragraph("North-star KPIs (large, top band)", H2)]
ns = [
    [Paragraph("Metric", CELLH), Paragraph("Definition", CELLH), Paragraph("Unit", CELLH), Paragraph("Target band", CELLH)],
    [Paragraph("<b>Panel min FOS</b>", CELL), Paragraph("Lowest pillar factor of safety (strength ÷ tributary stress) in the panel", CELL), Paragraph("ratio", CELL), Paragraph("&ge;1.6 prod; &ge;2.0 barrier", CELL)],
    [Paragraph("<b>Extraction ratio</b>", CELL), Paragraph("Areal ore extracted vs in-situ; the recovery being optimised", CELL), Paragraph("%", CELL), Paragraph("maximise s.t. FOS (44&rarr;80%+)", CELL)],
    [Paragraph("<b>Probability of failure</b>", CELL), Paragraph("Panel instability likelihood from FOS distribution + monitoring trend", CELL), Paragraph("%", CELL), Paragraph("low single digits", CELL)],
    [Paragraph("<b>Convergence rate</b>", CELL), Paragraph("Worst-station roof-to-floor closure speed; the live ground-truth", CELL), Paragraph("mm/day", CELL), Paragraph("stable/decelerating", CELL)],
]
story += [table(ns, [32*mm, 79*mm, 15*mm, 39*mm])]

story += [Paragraph("Supporting metrics (secondary band)", H2)]
sup = [
    [Paragraph("Metric", CELLH), Paragraph("Definition / why it matters", CELLH), Paragraph("Unit", CELLH)],
    [Paragraph("<b>W/H ratio</b>", CELL), Paragraph("Pillar width ÷ mining height &mdash; the master strength lever; &lt;0.6 is slender-risk", CELL), Paragraph("ratio", CELL)],
    [Paragraph("<b>Stress / strength</b>", CELL), Paragraph("Tributary stress as % of pillar strength (= 1/FOS); utilisation", CELL), Paragraph("%", CELL)],
    [Paragraph("<b>Microseismic activity</b>", CELL), Paragraph("Event rate, released energy, b-value &mdash; leading indicator of yielding", CELL), Paragraph("ev/h, J", CELL)],
    [Paragraph("<b>RMR / UCS</b>", CELL), Paragraph("Rock mass rating / uniaxial strength &mdash; key strength inputs", CELL), Paragraph("&ndash; / MPa", CELL)],
    [Paragraph("<b>Roof span</b>", CELL), Paragraph("Bord width vs stable-span limit; roof-fall governor in wide cuts", CELL), Paragraph("m", CELL)],
    [Paragraph("<b>Support load</b>", CELL), Paragraph("Bolt / prop load-cell reading vs capacity; is support taking design load", CELL), Paragraph("kN", CELL)],
]
story += [table(sup, [33*mm, 116*mm, 16*mm])]
story += [Paragraph("Value model (reuse FSP approach): tonnes of additional <i>safe</i> recovery &times; margin, net of support/backfill cost and risk-adjusted exposure &mdash; derived, never canned.", SMALL)]
story += [PageBreak()]

# ══ 3. PILLAR STATUS MODEL ═══════════════════════════════════════════════════
story += [Paragraph("3 · Pillar status model &amp; colour coding", H1)]
story += [Paragraph("The FOS heat-map and the pillar table share one colour language; the bands key off factor of safety against the 1.6 production target.", BODY)]
states = [
    (GREEN, "OK", "FOS &ge; 1.6 — within design"),
    (AMBER, "WATCH", "1.3 &le; FOS &lt; 1.6 — reduced margin / monitor"),
    (RED, "CRITICAL", "FOS &lt; 1.3 — support / no further extraction"),
    (BLUE, "BARRIER", "Barrier pillar (target FOS &ge; 2.0) — outlined"),
    (colors.HexColor("#d9d6ca"), "EXTRACTED", "Mined void / roadway (bord)"),
    (PURPLE, "YIELDING", "Microseismic / convergence flag overrides static FOS"),
]
rows = [[Paragraph("Status", CELLH), Paragraph("Meaning", CELLH), Paragraph("Swatch", CELLH)]]
for c,name,mean in states:
    rows.append([Paragraph(f"<b>{name}</b>", CELL), Paragraph(mean, CELL), _chip(c)])
story += [table(rows, [38*mm, 105*mm, 22*mm])]
story += [Paragraph(
    "Key design idea: <b>monitoring overrides geometry.</b> When convergence is accelerating or microseismic "
    "energy is rising (b-value falling) on a pillar, it reads YIELDING even if its static FOS looks acceptable "
    "&mdash; that fusion of design and live data is the demo's intelligence.", BODY)]
story += [PageBreak()]

# ══ 4. LAYOUT & COMPONENTS ═══════════════════════════════════════════════════
story += [Paragraph("4 · Screen layout &amp; components", H1)]
story += [Paragraph("Follow the FSP page skeleton: breadcrumb &rarr; demo-head &rarr; KPI row &rarr; dark control-room screen &rarr; AI panel + side panels. Components top to bottom:", BODY)]
comp = [
    [Paragraph("#", CELLH), Paragraph("Component", CELLH), Paragraph("Spec", CELLH)],
    [Paragraph("1", CELL), Paragraph("<b>KPI row</b>", CELL), Paragraph("4 north-star cards: panel min FOS, extraction ratio, probability of failure, worst convergence rate. Up/down deltas vs plan.", CELL)],
    [Paragraph("2", CELL), Paragraph("<b>Constraint (drum) strip</b>", CELL), Paragraph("Reuse FSP bottleneck strip: binding constraint = pillar-strength / roof-span / convergence / seismic, with a 'governs now' shift indicator on re-assess.", CELL)],
    [Paragraph("3", CELL), Paragraph("<b>Pillar FOS heat-map (HERO)</b>", CELL), Paragraph("Plan-view grid of pillars coloured by FOS band; barrier pillars outlined; rooms shown as void; sensor glyphs on instrumented pillars. Click a pillar &rarr; detail card. SVG, same render approach as the FSP Gantt.", CELL)],
    [Paragraph("4", CELL), Paragraph("<b>FOS &times; extraction trade-off curve</b>", CELL), Paragraph("The optimisation story: a Pareto curve of FOS vs extraction ratio with the current point and the AI-recommended point; target-FOS floor line. Chart.js.", CELL)],
    [Paragraph("5", CELL), Paragraph("<b>Scenario inject + free-form</b>", CELL), Paragraph("Presets (mine deeper, weak seam band, pillar recovery, rainfall/pore pressure, nearby blast) + NL box &rarr; AI re-assesses FOS map and recovery. Mirror FSP.", CELL)],
    [Paragraph("6", CELL), Paragraph("<b>Pillar table</b>", CELL), Paragraph("Per-pillar rows: id, W/H, FOS, stress/strength %, convergence, status dot, AI action. Highlights at-risk and re-designed pillars.", CELL)],
    [Paragraph("7", CELL), Paragraph("<b>Monitoring panels</b>", CELL), Paragraph("Convergence trend per station; microseismic event-rate / energy strip (plan scatter or sparkline). FSP dark theme.", CELL)],
    [Paragraph("8", CELL), Paragraph("<b>AI panel + risk gauge</b>", CELL), Paragraph("renderAIResult-style: headline + recommendations + monitoringActions + value; a probability-of-failure gauge. Live on each re-assess.", CELL)],
]
story += [table(comp, [7*mm, 43*mm, 115*mm])]
story += [Paragraph("Tabs (optional): <b>Stability map</b> · <b>Optimisation</b> (trade-off curve + table) · <b>Monitoring</b> &mdash; mirroring FSP's three tabs.", SMALL)]
story += [PageBreak()]

# ══ 5. AI + PROMPT ═══════════════════════════════════════════════════════════
story += [Paragraph("5 · AI capabilities", H1)]
story += [bullets([
    "<b>Stability assessment</b> &mdash; per-pillar FOS from W/H, RMR, UCS, depth; flag at-risk pillars (empirical + ML pattern).",
    "<b>Extraction-ratio optimisation</b> &mdash; the highest recovery that holds every pillar above target FOS; quantify the ore unlocked.",
    "<b>Design-vs-monitoring fusion</b> &mdash; weight live convergence / microseismic trends above static FOS when they disagree (the YIELDING override).",
    "<b>Support &amp; recovery engineering</b> &mdash; recommend backfill confinement, split-and-fender / pocket-and-wing recovery, bolting or barrier re-design, each with the FOS it holds.",
    "<b>Scenario re-assessment</b> &mdash; deeper mining, weak seam, rainfall/pore-pressure, blast vibration &rarr; live re-solve with rationale (FSP-style).",
    "<b>Probabilistic risk</b> &mdash; probability of failure from the FOS distribution and monitoring trend, not FOS alone.",
    "<b>Monitoring tasking</b> &mdash; tell the geotech team which pillars to instrument next and why (links to the Safety demo).",
]), ]

story += [Paragraph("6 · Claude prompt (drop-in for server.js)", H1)]
story += [Paragraph("House style (persona &rarr; exact JSON schema &rarr; domain rules &rarr; JSON-only). One endpoint <font face='Courier'>/api/pillar/analyze</font> handles 'assess + optimise current panel' and 'scenario re-assess' via an optional scenario. The <font face='Courier'>{headline, recommendations[], valueImpactUSD, narrative}</font> core reuses renderAIResult; specialised fields drive the bespoke UI. Ship a deterministic <font face='Courier'>pillarFallback()</font> so it runs with no API key.", BODY)]
pl = [
"PILLAR_PROMPT = `You are OreSight AI's geotechnical engineer for an underground",
"bord-and-pillar coal operation in East Kalimantan, Indonesia. A panel is developed at",
"~180 m depth in a 5.0 m seam; pillars sit on a regular grid with ~6.5 m roadways (bords).",
"Pillar strength follows a width-to-height power law (Salamon-Munro / Lunder-Pakalnis",
"style); pillar stress is estimated by the tributary-area method; FOS = strength / stress.",
"Target FOS >= 1.6 for production pillars, >= 2.0 for barrier pillars. The panel is",
"instrumented: roof-to-floor convergence stations, borehole extensometers, stress cells",
"and a microseismic geophone array.",
"",
"Given a JSON snapshot of a panel (pillar grid geometry & W/H ratios, rock-mass RMR/UCS,",
"depth, current extraction ratio, and live monitoring: convergence rates, stress-cell",
"loads, microseismic event rate/energy) - and optionally a scenario (deeper mining, weak",
"seam band, pillar recovery, rainfall/pore pressure, nearby blast) - assess stability and",
"optimise extraction. Return JSON with EXACTLY this structure:",
"",
"{",
'  "headline": "<conclusion: current panel FOS vs target and recovery opportunity>",',
'  "panelMinFOS": <number, lowest pillar factor of safety>,',
'  "extractionRatioPct": <number, current areal extraction>,',
'  "optimisedExtractionPct": <number, achievable while holding target FOS>,',
'  "bindingConstraint": "pillar-strength" | "roof-span" | "convergence" | "seismic",',
'  "constraintNote": "<why this governs, one line>",',
'  "atRiskPillars": [{"id":"P-12","fos":<n>,"whRatio":<n>,',
'     "stressStrengthPct":<n>,"status":"CRITICAL"|"WATCH"|"OK","note":"<short>"}],',
'  "probabilityOfFailurePct": <0-100>,',
'  "recommendations": [{"action":"<resize|sequence|backfill|support|destress>",',
'     "impact":"<quantified: FOS, recovery %, tonnes, US$>","timeframe":"<when>"}],',
'  "monitoringActions": [{"pillar":"P-12","instrument":"convergence|extensometer|',
'     stress-cell|microseismic|inspection","reason":"<short>"}],',
'  "valueImpactUSD": <integer, value of additional safe recovery net of cost, annualised>,',
'  "narrative": "<3-4 sentences linking geometry, monitoring and the FOS/recovery trade-off>"',
"}",
"",
"Domain rules:",
"- FOS = pillar strength / tributary-area stress; strength rises with W/H. Never recommend",
"  extraction that pushes any production pillar below FOS 1.6 or any barrier below 2.0.",
"- W/H ratio is the master geometric lever; flag W/H < 0.6 pillars as slender risks.",
"- Convergence acceleration and rising microseismic energy (falling b-value) are leading",
"  indicators of yielding - weight them ABOVE static FOS when they conflict.",
"- Higher-recovery levers: trim pillars only where FOS headroom allows; otherwise backfill",
"  confinement (raises strength), split-and-fender / pocket-and-wing recovery, or barrier",
"  re-design. State the FOS each option holds.",
"- Tie probabilityOfFailurePct to the FOS distribution AND the monitoring trend, not FOS",
"  alone.",
"- 3-5 atRiskPillars, 3-4 recommendations, 2-4 monitoringActions; each concrete & quantified.",
"",
"IMPORTANT: Return ONLY valid JSON, no other text.`;",
]
box = Table([[Paragraph("<br/>".join((l or "&nbsp;").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;") for l in pl), MONO_LIGHT)]], colWidths=[165*mm])
box.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#0f140e")),
    ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,0),(-1,-1),9),
    ("BOX",(0,0),(-1,-1),0.6,GREEN)]))
story += [box]
story += [Paragraph("Companion (optional, mirrors FSP): a small PILLAR_PARSE_PROMPT behind /api/pillar/parse turns a free-text note ('weak band in P-12 to P-15, water making') into a structured scenario the engine re-assesses.", SMALL)]
story += [PageBreak()]

# ══ 7. DESIGN SYSTEM + BUILD ═════════════════════════════════════════════════
story += [Paragraph("7 · Design system (reuse OreSight tokens)", H1)]
pal = [(GREEN,"FOS OK / brand","#15803d"),(AMBER,"Watch","#b45309"),(RED,"Critical","#b91c1c"),
       (BLUE,"Barrier / sensor","#0e7490"),(PURPLE,"Yielding","#7c3aed"),(DARK,"Control-room","#10150f")]
chips=[[_chip(c,27) for c,_,_ in pal]]
labels=[[Paragraph(f"<b>{lbl}</b><br/><font face='Courier' size=7>{hx}</font>", CELL) for _,lbl,hx in pal]]
pt=Table(chips+labels, colWidths=[27*mm]*6); pt.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),5),("VALIGN",(0,0),(-1,-1),"TOP")]))
story += [pt, Spacer(1,6)]
story += [bullets([
    "<b>Type:</b> Inter (UI) + JetBrains Mono (labels/data), already loaded.",
    "<b>Reuse verbatim:</b> kpi-card, fsp-screen / fsp-tab / fsp-status, bottleneck-strip, ai-panel + renderAIResult, risk-item, copilot, freeform-row, status-dot.",
    "<b>New components:</b> pillar FOS heat-map (SVG plan grid), FOS legend, FOS&times;extraction trade-off curve, convergence trend, microseismic strip, probability-of-failure gauge.",
    "<b>Motion:</b> on re-assess, re-designed pillars recolour with a transition and the constraint strip updates the 'governs now' shift &mdash; same feel as FSP block re-shuffle.",
]), ]

story += [Paragraph("8 · Build notes", H1)]
story += [bullets([
    "<b>Page:</b> mining-demo/public/pillar.html + js/pillar.js; <b>endpoint:</b> /api/pillar/analyze (+ optional /api/pillar/parse) in server.js; <b>fallback:</b> data/pillar.js (deterministic).",
    "<b>Deterministic engine is source of truth</b> for the on-screen FOS map (always re-solves visibly); AI parses free-text and writes rationale on top &mdash; works fully with no API key.",
    "<b>Matrix wiring:</b> add a 'Pillar / Ground-Control Optimisation' cell (geotech / mine-development horizon) on the value-chain landing page, LIVE DEMO, linking to /pillar.html.",
    "<b>Nav:</b> add a 'Pillar' link in the shared nav; cross-link from the Safety demo (shared geotech narrative).",
]), ]

story += [Paragraph("Sources", H2)]
src = [
    "Pillar design &amp; strength formulas (Lunder-Pakalnis, Salamon-Munro, Hedley-Grant; FOS 1.6/2.0) &mdash; scielo.org.za (hard-rock bord-and-pillar); ijirt.org IJIRT153013; link.springer.com 10.1007/s44288-025-00295-3",
    "Toward pillar design to prevent collapse of room-and-pillar mines &mdash; stacks.cdc.gov/view/cdc/9341",
    "Extraction-ratio / recovery optimisation (44&rarr;80%; W/H, split-and-fender, pocket-and-wing) &mdash; sciencedirect.com S2095268618301265; link.springer.com 10.1007/s12665-023-10801-w; scielo.org.za (backfill confinement)",
    "Monitoring: convergence, extensometers, stress/load cells, microseismic, fibre-optic &mdash; sintela.com; sciencedirect.com S2467967417300077 (microseismic, retreat room-and-pillar)",
    "ML / hybrid pillar-stability prediction (RF/SVM/ANN 80&ndash;99%; hybrid +15&ndash;20%) &mdash; sciencedirect.com S1474706525003857; ncbi.nlm.nih.gov PMC8871988 (logistic model trees); link.springer.com 10.1007/s00603-025-04841-w (cave-pillar ML)",
    "Numerical modelling context &mdash; Itasca (FLAC3D/3DEC), RocScience (RS2/Examine), Beck Engineering, Map3D",
]
story += [bullets(src, style=SMALL, color=MUTED)]

doc = SimpleDocTemplate("/home/user/halalcheck-ai/docs/pillar-optimisation-design-brief.pdf",
    pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=22*mm, bottomMargin=18*mm,
    title="OreSight AI — Pillar Optimisation Design Brief", author="OreSight AI")
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print("PDF written")
