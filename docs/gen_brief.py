#!/usr/bin/env python3
"""Generate the Hauling Optimisation demo design-brief PDF (handover to Claude)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                HRFlowable, PageBreak, ListFlowable, ListItem)

# ── Palette (OreSight AI tokens) ──────────────────────────────────────────────
GREEN = colors.HexColor("#15803d")
GREEN_SOFT = colors.HexColor("#eaf3ec")
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
TAG = S("TAG", fontName="Helvetica-Bold", fontSize=8, textColor=GREEN, leading=11)
CELL = S("CELL", fontName="Helvetica", fontSize=8.2, textColor=INK, leading=11)
CELLB = S("CELLB", fontName="Helvetica-Bold", fontSize=8.2, textColor=INK, leading=11)
CELLH = S("CELLH", fontName="Helvetica-Bold", fontSize=8, textColor=WHITE, leading=11)
COVER_T = S("COVER_T", fontName="Helvetica-Bold", fontSize=30, textColor=INK, leading=34)
COVER_S = S("COVER_S", fontName="Helvetica", fontSize=12, textColor=MUTED, leading=17)

def bullets(items, style=BODY, color=GREEN):
    return ListFlowable(
        [ListItem(Paragraph(t, style), bulletColor=color, value="square") for t in items],
        bulletType="bullet", bulletFontSize=6, leftIndent=14, bulletOffsetY=1)

def rule(c=LINE, w=0.8, sb=4, sa=8):
    return HRFlowable(width="100%", thickness=w, color=c, spaceBefore=sb, spaceAfter=sa)

def table(data, col_widths, header=True, zebra=True, body_font=8.2):
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    cmds = [
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 7),
        ("RIGHTPADDING", (0,0), (-1,-1), 7),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LINEBELOW", (0,0), (-1,-1), 0.4, LINE),
    ]
    if header:
        cmds += [("BACKGROUND", (0,0), (-1,0), GREEN), ("LINEBELOW", (0,0), (-1,0), 0, GREEN)]
    if zebra:
        for r in range(1, len(data)):
            if r % 2 == 0:
                cmds.append(("BACKGROUND", (0,r), (-1,r), CREAM))
    t.setStyle(TableStyle(cmds))
    return t

# ── Page furniture ────────────────────────────────────────────────────────────
def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    # top accent
    canvas.setFillColor(GREEN); canvas.rect(0, h-6, w, 6, fill=1, stroke=0)
    if doc.page > 1:
        canvas.setFont("Helvetica-Bold", 8); canvas.setFillColor(GREEN)
        canvas.drawString(20*mm, h-14*mm, "OreSight AI")
        canvas.setFont("Helvetica", 8); canvas.setFillColor(MUTED)
        canvas.drawRightString(w-20*mm, h-14*mm, "Hauling Optimisation — Design Brief")
        canvas.setStrokeColor(LINE); canvas.line(20*mm, h-16*mm, w-20*mm, h-16*mm)
    canvas.setFont("Helvetica", 7.5); canvas.setFillColor(MUTED)
    canvas.drawString(20*mm, 12*mm, "OreSight AI · Operations Intelligence for Indonesian Mining · Confidential design brief")
    canvas.drawRightString(w-20*mm, 12*mm, f"{doc.page}")
    canvas.restoreState()

def swatch_row(rows):
    """rows: list of (color, label, hex)"""
    data = [[Paragraph(lbl, CELL), Paragraph(hx, MONO)] for (_, lbl, hx) in rows]
    t = Table([[ _chip(c) for (c,_,_) in rows ]] + [[ Paragraph(f"<b>{lbl}</b><br/><font face='Courier' size=7>{hx}</font>", CELL) for (c,lbl,hx) in rows]],
              colWidths=[len(rows)*[ (170)//len(rows) ]][0] if False else None)
    return t

def _chip(c):
    tb = Table([[""]], colWidths=[24*mm], rowHeights=[7*mm])
    tb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),c),("BOX",(0,0),(-1,-1),0.5,LINE)]))
    return tb

story = []

# ══ COVER ═════════════════════════════════════════════════════════════════════
story += [Spacer(1, 30*mm)]
story += [Paragraph("DESIGN BRIEF · HANDOVER TO CLAUDE", TAG)]
story += [Spacer(1, 6)]
story += [Paragraph("Hauling Optimisation", COVER_T)]
story += [Paragraph("Stockpile &rarr; Jetty haul circuit — AI dispatch &amp; bottleneck optimisation", COVER_S)]
story += [Spacer(1, 8)]
story += [rule(GREEN, 1.4, 2, 10)]
story += [Paragraph(
    "An interactive demo for the OreSight AI platform: a fleet of haul trucks shuttling nickel ore "
    "from the port stockpiles to the jetty surge hopper that feeds the barge loadout, with an AI "
    "dispatch brain that identifies the binding constraint, re-allocates the fleet, and re-plans "
    "live when a disruption hits. Sibling to the Future Scheduling Platform (FSP) and its upstream feeder.", BODY)]
story += [Spacer(1, 14)]
meta = Table([
    [Paragraph("<b>Visual model</b>", CELL), Paragraph("Looping route map (animated truck cycle), per the chosen direction", CELL)],
    [Paragraph("<b>Haul leg</b>", CELL), Paragraph("Port stockpile (SP-1 / SP-2) &rarr; jetty surge hopper (~4.2 km)", CELL)],
    [Paragraph("<b>Design system</b>", CELL), Paragraph("Reuse OreSight light/dark control-room language from FSP", CELL)],
    [Paragraph("<b>Sources</b>", CELL), Paragraph("Modular Mining DISPATCH, Wenco, Cat MineStar; Samsara / Geotab fleet telematics", CELL)],
    [Paragraph("<b>Date</b>", CELL), Paragraph("13 June 2026", CELL)],
], colWidths=[35*mm, 130*mm])
meta.setStyle(TableStyle([("LINEBELOW",(0,0),(-1,-1),0.4,LINE),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("VALIGN",(0,0),(-1,-1),"TOP")]))
story += [meta]
story += [PageBreak()]

# ══ 1. CONTEXT & GOAL ════════════════════════════════════════════════════════
story += [Paragraph("1 · Context &amp; goal", H1)]
story += [Paragraph(
    "The haul circuit is the <b>upstream feeder of the FSP chain</b>. A fleet of nine Komatsu HD785-7 "
    "haul trucks (91 t rated) carries ore ~4.2 km from two port stockpiles to the jetty surge hopper "
    "that feeds the barge loadout. The delivered rate must track the active barge's loadout demand "
    "(~1,900 t/h nominal). The hopper is a small surge bin: if it <b>starves</b>, barge loading stalls and "
    "the laycan / demurrage exposure FSP already models rises; if it <b>overflows</b>, trucks queue and spill. "
    "This direct coupling to FSP is the narrative spine of the demo.", BODY)]
story += [Paragraph(
    "The goal of the design is a demo that <i>feels like one product</i> with FSP: a live operations "
    "screen where the AI does the dispatch thinking — names the binding constraint, re-allocates trucks "
    "and loaders, and re-solves on disruption — not a static dashboard.", BODY)]

story += [Paragraph("What the industry does (research synthesis)", H2)]
story += [bullets([
    "<b>Real-time truck&ndash;loader&ndash;dump assignment</b> is the core of every mining FMS (Modular Mining DISPATCH, Wenco, Cat MineStar). Documented gains: DISPATCH cut truck idle from <b>210 to 38 h/month</b> and lifted ton-miles-per-hour <b>+29%</b> after dispatch recalibration.",
    "Systems classify each asset by <b>state</b> — loading, hauling, dumping, travelling, waiting/queuing, idle/parked — and colour-code it on a live map. Excessive queuing at load and dump is the headline productivity killer.",
    "<b>Match factor</b> (haul units vs loading units) is the canonical balance lever: ~1.0 balanced, &lt;1 loaders wait (under-trucked), &gt;1 trucks queue (over-trucked). Inadequate tyre <b>TKPH</b> is cited as ~62% of truck-bunching causes.",
    "Fleet telematics dashboards (Samsara, Geotab, Penske-class) lead with a <b>live map for the dispatcher</b>, then KPI cards. 2026 best practice: <b>4 'north-star' KPIs large at the top</b>, 4&ndash;6 supporting metrics in a secondary band; gauges, color-coded KPIs and bubble/colour encoding for urgency.",
]), ]

story += [PageBreak()]

# ══ 2. METRICS TO ADOPT ══════════════════════════════════════════════════════
story += [Paragraph("2 · Metrics to adopt", H1)]
story += [Paragraph("North-star KPIs (large, top band)", H2)]
story += [Paragraph("Four headline numbers, mirroring the FSP KPI row. These answer: are we meeting demand, and how efficiently?", BODY)]
ns = [
    [Paragraph("Metric", CELLH), Paragraph("Definition", CELLH), Paragraph("Unit", CELLH), Paragraph("Target band", CELLH)],
    [Paragraph("<b>Delivered rate vs demand</b>", CELL), Paragraph("Ore reaching the jetty hopper vs the active barge loadout demand", CELL), Paragraph("t/h", CELL), Paragraph("&ge; demand (~1,900)", CELL)],
    [Paragraph("<b>Match factor</b>", CELL), Paragraph("Assigned trucks ÷ trucks needed to keep loaders continuously loading", CELL), Paragraph("ratio", CELL), Paragraph("0.95 &ndash; 1.05", CELL)],
    [Paragraph("<b>Fleet utilisation</b>", CELL), Paragraph("Productive (loading/hauling/dumping) time ÷ available time", CELL), Paragraph("%", CELL), Paragraph("&gt; 85% (top &gt;78%)", CELL)],
    [Paragraph("<b>Hopper buffer</b>", CELL), Paragraph("Surge-bin level expressed as minutes-to-starve at current demand", CELL), Paragraph("% / min", CELL), Paragraph("keep &gt; 0; warn &lt;10 min", CELL)],
]
story += [table(ns, [33*mm, 78*mm, 16*mm, 38*mm])]

story += [Paragraph("Supporting metrics (secondary band)", H2)]
sup = [
    [Paragraph("Metric", CELLH), Paragraph("Definition / why it matters", CELLH), Paragraph("Unit", CELLH)],
    [Paragraph("<b>Cycle time</b>", CELL), Paragraph("Full loop: spot &rarr; load &rarr; haul loaded &rarr; dump &rarr; return empty (+ queue/TKPH delay)", CELL), Paragraph("min", CELL)],
    [Paragraph("<b>Queue / wait time</b>", CELL), Paragraph("Time trucks wait at loader + hopper; the primary loss to attack", CELL), Paragraph("min/cyc", CELL)],
    [Paragraph("<b>Payload compliance</b>", CELL), Paragraph("Loads inside the 10/10/20 policy (mean &le; rated; &le;10% &gt;1.1&times;; none &gt;1.2&times;)", CELL), Paragraph("%", CELL)],
    [Paragraph("<b>TKPH headroom</b>", CELL), Paragraph("Tyre tonne-km/h vs rating; margin protects against wet-season heat failures", CELL), Paragraph("%", CELL)],
    [Paragraph("<b>Fuel per tonne</b>", CELL), Paragraph("Litres burned per tonne delivered; idle + overload inflate it", CELL), Paragraph("L/t", CELL)],
    [Paragraph("<b>Loader utilisation</b>", CELL), Paragraph("Per-loader busy time; reveals loader-bound vs truck-bound state", CELL), Paragraph("%", CELL)],
    [Paragraph("<b>TMPH / productivity</b>", CELL), Paragraph("Ton-miles per hour (DISPATCH north-star); +29% achievable headline", CELL), Paragraph("idx", CELL)],
]
story += [table(sup, [32*mm, 117*mm, 16*mm])]
story += [Paragraph("Value model (reuse FSP approach): $ per extra tonne to the jetty + demurrage protected on the coupled barge + fuel saved + idle hours cut, derived from the numbers above — never a canned figure.", SMALL)]

story += [PageBreak()]

# ══ 3. TRUCK STATE MODEL & COLOUR ════════════════════════════════════════════
story += [Paragraph("3 · Truck-state model &amp; colour coding", H1)]
story += [Paragraph("Six states, colour-coded consistently across the route map, the dispatch table status dots, and the trend chart. Colours reuse the FSP Gantt block palette so the two demos read as one system.", BODY)]
states = [
    (GREEN, "LOADING", "At a stockpile loader (LD-1 / LD-2)"),
    (BLUE, "HAULING (loaded)", "On the ramp to the jetty hopper"),
    (AMBER, "QUEUING / WAITING", "Bunched at loader or hopper — the loss to minimise"),
    (PURPLE, "DUMPING", "Tipping into the jetty surge hopper"),
    (colors.HexColor("#94a3a0"), "RETURNING (empty)", "Back to the stockpile"),
    (RED, "DOWN / PARKED", "Breakdown, refuel, crib break — out of cycle"),
]
rows = [[Paragraph("State", CELLH), Paragraph("Meaning", CELLH), Paragraph("Swatch", CELLH)]]
for c, name, mean in states:
    chip = Table([[""]], colWidths=[18*mm], rowHeights=[5*mm]); chip.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),c),("BOX",(0,0),(-1,-1),0.5,LINE)]))
    rows.append([Paragraph(f"<b>{name}</b>", CELL), Paragraph(mean, CELL), chip])
story += [table(rows, [42*mm, 101*mm, 22*mm])]

story += [Paragraph("Cycle-time anatomy (for the trend / breakdown view)", H2)]
story += [Paragraph("Spot at loader &middot; load &middot; loaded travel &middot; spot at dump &middot; dump &middot; empty travel &middot; <b>queue delay</b> &middot; <b>TKPH delay</b>. The queue and TKPH segments are the AI's optimisation targets — surface them explicitly.", BODY)]

story += [PageBreak()]

# ══ 4. SCREEN LAYOUT & COMPONENTS ════════════════════════════════════════════
story += [Paragraph("4 · Screen layout &amp; components", H1)]
story += [Paragraph("Follow the FSP page skeleton: breadcrumb &rarr; demo-head (title + WITA clock + pitch) &rarr; KPI row &rarr; dark 'control-room' screen &rarr; AI panel + side panels. Components, top to bottom:", BODY)]

comp = [
    [Paragraph("#", CELLH), Paragraph("Component", CELLH), Paragraph("Spec", CELLH)],
    [Paragraph("1", CELLB), Paragraph("<b>KPI row</b>", CELL), Paragraph("4 north-star cards (delivered t/h vs demand, match factor, fleet utilisation, hopper buffer). Up/down deltas vs plan, like FSP.", CELL)],
    [Paragraph("2", CELLB), Paragraph("<b>Constraint (drum) strip</b>", CELL), Paragraph("Reuse FSP bottleneck strip: binding constraint = loader / haul-road / hopper / fleet, with utilisation bars and a 'constraint shifted X&rarr;Y' indicator on re-dispatch.", CELL)],
    [Paragraph("3", CELLB), Paragraph("<b>Looping route map (HERO)</b>", CELL), Paragraph("Animated SVG loop (same engine as FSP inload convoys): SP-1/SP-2 loaders &rarr; ramp &rarr; jetty hopper &rarr; return. Truck dots coloured by state; queue badges at loader and hopper; hopper level gauge on the jetty node. ~9 trucks circulating.", CELL)],
    [Paragraph("4", CELLB), Paragraph("<b>Disruption controls + free-form</b>", CELL), Paragraph("Preset buttons (truck down, loader down, road wet/ramp, demand surge) + NL box ('HT-105 down, ramp wet') &rarr; AI re-dispatches. Mirror FSP exactly.", CELL)],
    [Paragraph("5", CELLB), Paragraph("<b>Dispatch table</b>", CELL), Paragraph("Per-truck rows: id, state dot, assigned loader, last cycle (min), payload (t) vs rated, next AI action. Sortable feel; highlights moved/re-assigned units.", CELL)],
    [Paragraph("6", CELLB), Paragraph("<b>AI recommendation panel</b>", CELL), Paragraph("renderAIResult-style: headline + fleetActions (reassign/hold/refuel/reroute with &Delta;t/h) + recommendations + value protected. Live rationale on each re-dispatch.", CELL)],
    [Paragraph("7", CELLB), Paragraph("<b>Trend / gauges</b>", CELL), Paragraph("Delivered t/h vs demand line over the shift; match-factor dial; hopper-buffer gauge. Chart.js, FSP dark theme.", CELL)],
    [Paragraph("8", CELLB), Paragraph("<b>Risk radar + copilot</b>", CELL), Paragraph("Optional, as on FSP: forecast wet ramp / tyre TKPH / truck degradation (links to Maintenance demo); grounded Q&amp;A copilot over live fleet state.", CELL)],
]
story += [table(comp, [8*mm, 42*mm, 115*mm])]
story += [Paragraph("Tabs inside the control-room screen (optional): <b>Fleet board</b> (route map) · <b>Dispatch</b> (table) · <b>Trends</b> (charts) — mirroring FSP's UC2/UC1/UC3 tabs.", SMALL)]

story += [PageBreak()]

# ══ 5. AI CAPABILITIES ═══════════════════════════════════════════════════════
story += [Paragraph("5 · AI capabilities", H1)]
story += [bullets([
    "<b>Dynamic dispatch</b> — assign trucks to loaders/routes to match hopper demand with minimum queueing (match-factor driven).",
    "<b>Bottleneck detection</b> — name the binding constraint (loader / haul-road / hopper / fleet) and the marginal t/h of relieving it.",
    "<b>Payload &amp; tyre/fuel optimisation</b> — 10/10/20 policy compliance, TKPH headroom, eco-speed vs cycle-time trade-off.",
    "<b>Queue smoothing &amp; refuel/crib staggering</b> — keep loader feed and hopper level above the demand line.",
    "<b>Demand coupling to FSP</b> — when a barge is laycan-critical, surge the fleet to build hopper buffer ahead of its load window (and ahead of a forecast swell).",
    "<b>Disruption re-dispatch</b> — truck down, loader breakdown, wet ramp, demand surge &rarr; live re-solve with rationale (FSP-style).",
    "<b>Anomaly detection</b> — a cycle-time outlier flags a truck &rarr; hands off to the Maintenance demo.",
]), ]

story += [Paragraph("6 · Claude prompt (drop-in for server.js)", H1)]
story += [Paragraph("Same house style as the existing OreSight prompts (persona &rarr; exact JSON schema &rarr; domain rules &rarr; JSON-only). One endpoint, <font face='Courier'>/api/haul/analyze</font>, handles both 'optimise current state' and 'disruption re-dispatch' via an optional scenario in the user message. The <font face='Courier'>{headline, recommendations[], valueImpactUSD, narrative}</font> core reuses renderAIResult; the specialised fields drive the bespoke UI. Ship with a deterministic <font face='Courier'>haulFallback()</font> so it runs with no API key, exactly like the others.", BODY)]
prompt_lines = [
"HAUL_PROMPT = `You are OreSight AI's haulage dispatch optimiser for the port haul",
"circuit at a nickel laterite operation in Morowali, Central Sulawesi. A fleet of",
"nine Komatsu HD785-7 haul trucks (91 t rated payload) shuttles ore ~4.2 km from two",
"port stockpiles (SP-1 saprolite, SP-2 limonite blend) to the jetty surge hopper that",
"feeds the barge loadout. Two loaders work the stockpiles: LD-1 (Cat 992K wheel loader)",
"and LD-2 (Hitachi EX1900 excavator). Two 12-hour shifts (07:00/19:00 WITA). The",
"delivered rate must track the active barge loadout demand (~1,900 t/h): the hopper is a",
"small surge bin - if it starves, barge loading stalls and laycan/demurrage exposure",
"rises; if it overflows, trucks queue and spill.",
"",
"Given a JSON snapshot of the haul circuit (fleet status & cycle times, loader status,",
"haul-road/weather state, hopper level, and the barge loadout demand it must serve) -",
"and optionally a disruption scenario - produce a dispatch optimisation. Return JSON",
"with EXACTLY this structure:",
"",
"{",
'  "headline": "<one-line conclusion: current delivered rate vs demand>",',
'  "bindingConstraint": "loader" | "haul-road" | "jetty-hopper" | "fleet",',
'  "constraintNote": "<why this is the binding constraint, one line>",',
'  "currentRateTph": <number, ore delivered to the hopper now, t/h>,',
'  "optimisedRateTph": <number, achievable after the actions; >= currentRateTph>,',
'  "matchFactor": <number; 1.0 balanced, <1 loader-starved, >1 trucks queue>,',
'  "fleetActions": [',
'    {"unit": "<HT-104 / LD-2>", "action": "reassign|hold|release|refuel|reroute|payload",',
'     "detail": "<short specifics>", "deltaTph": <t/h gained or recovered>}',
'  ],',
'  "recommendations": [',
'    {"action": "<dispatch / road / payload / sequencing action>",',
'     "impact": "<quantified: t/h, queue-min, fuel-L, US$>", "timeframe": "<when>"}',
'  ],',
'  "forecastNext4h": {"tonnesToJetty": <int>, "hopperRisk": "starve|balanced|overflow",',
'     "hopperNote": "<one line>", "fuelLitres": <int>},',
'  "valueImpactUSD": <integer, annualised value of the optimisation set>,',
'  "narrative": "<3-4 sentences linking the moves to the barge demand & constraint>"',
"}",
"",
"Domain rules:",
"- Match factor MF ~ (assigned trucks)/(trucks needed to keep loaders loading). MF<0.9",
"  -> loaders wait (under-trucked: add/route trucks); MF>1.1 -> trucks bunch (over-",
"  trucked: hold/redeploy). Drive toward 0.95-1.05.",
"- The hopper is the pacemaker: optimisedRateTph tracks demand, not wasteful excess. If",
"  demand exceeds capacity, name the binding constraint and the marginal t/h to relieve it.",
"- Respect limits: 2 loaders, 9 trucks, 91 t rated. Apply the 10/10/20 payload policy",
"  (mean <= rated; <=10% of loads >1.1x; none >1.2x). Watch tyre TKPH in wet-season heat.",
"- Wet-season roads: watering cuts dust but reduces traction on the ~8% ramp; recommend",
"  watering passes and speed limits that protect cycle time without spillage.",
"- Stagger refuels and crib breaks so loader feed and hopper level never drop below the",
"  barge demand line.",
"- If a barge is flagged laycan-critical, prioritise building hopper buffer ahead of its",
"  load window - surge the fleet even at slightly higher fuel per tonne.",
"- deltaTph across fleetActions should reconcile with (optimisedRateTph - currentRateTph).",
"- 3-5 fleetActions and 3-4 recommendations, each concrete and quantified.",
"",
"IMPORTANT: Return ONLY valid JSON, no other text.`;",
]
prompt_box = Table([[Paragraph("<br/>".join(l.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;") or "&nbsp;" for l in prompt_lines), MONO)]], colWidths=[165*mm])
prompt_box.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#0f140e")),("TEXTCOLOR",(0,0),(-1,-1),colors.HexColor("#dfe5da")),
    ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,0),(-1,-1),9),
    ("BOX",(0,0),(-1,-1),0.6,GREEN)]))
# override mono colour inside dark box
MONO_LIGHT = S("MONO_LIGHT", parent=MONO, textColor=colors.HexColor("#dfe5da"))
prompt_box = Table([[Paragraph("<br/>".join((l or "&nbsp;").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;") for l in prompt_lines), MONO_LIGHT)]], colWidths=[165*mm])
prompt_box.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#0f140e")),
    ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,0),(-1,-1),9),
    ("BOX",(0,0),(-1,-1),0.6,GREEN)]))
story += [prompt_box]
story += [Paragraph("Companion (optional, mirrors FSP): a small HAUL_PARSE_PROMPT behind /api/haul/parse turns a free-text note ('HT-105 down, ramp wet') into a structured disruption the engine re-dispatches.", SMALL)]

story += [PageBreak()]

# ══ 7. DESIGN SYSTEM ═════════════════════════════════════════════════════════
story += [Paragraph("7 · Design system (reuse OreSight tokens)", H1)]
story += [Paragraph("Build in the existing styles.css language so the demo is visually identical to FSP. Core palette:", BODY)]
pal = [
    (GREEN, "Accent / brand", "#15803d"),
    (DARK, "Control-room screen", "#10150f"),
    (CREAM, "App background", "#f6f5ef"),
    (AMBER, "Warning / queue", "#b45309"),
    (BLUE, "Hauling / transit", "#0e7490"),
    (RED, "Down / critical", "#b91c1c"),
]
chips = [[_chip(c) for c,_,_ in pal]]
labels = [[Paragraph(f"<b>{lbl}</b><br/><font face='Courier' size=7>{hx}</font>", CELL) for _,lbl,hx in pal]]
paltab = Table(chips + labels, colWidths=[27*mm]*6)
paltab.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),5),("VALIGN",(0,0),(-1,-1),"TOP")]))
story += [paltab]
story += [Spacer(1,6)]
story += [bullets([
    "<b>Type:</b> Inter (UI) + JetBrains Mono (labels/data), already loaded. Mono uppercase for axis/stage labels.",
    "<b>Components to reuse verbatim:</b> kpi-card, fsp-screen / fsp-tab / fsp-status, bottleneck-strip, option-cards, gantt convoy animation engine, ai-panel + renderAIResult, risk-item, copilot, freeform-row.",
    "<b>New components:</b> looping-route SVG (loaders, ramp, hopper-with-gauge nodes), match-factor dial, hopper-buffer gauge, dispatch-table.",
    "<b>Motion:</b> truck dots animate continuously (requestAnimationFrame, like FSP convoys); on re-dispatch, re-assigned trucks pulse and the constraint strip updates with the X&rarr;Y shift.",
]), ]

story += [Paragraph("8 · Build notes", H1)]
story += [bullets([
    "<b>Page:</b> mining-demo/public/haul.html + js/haul.js; <b>endpoint:</b> /api/haul/analyze (+ optional /api/haul/parse) in server.js; <b>fallback:</b> data/haul.js (deterministic).",
    "<b>Deterministic engine is the source of truth</b> for the on-screen fleet (always re-dispatches visibly); AI parses free-text and writes rationale on top — works fully with no API key.",
    "<b>Matrix wiring:</b> promote the existing 'Haul Optimisation' (or 'Dispatch Optimisation') cell on the value-chain landing page to a LIVE DEMO linking to /haul.html.",
    "<b>Nav:</b> add a 'Hauling' link in the shared nav, between Scheduler (FSP) and Control Tower.",
]), ]

story += [Paragraph("Sources", H2)]
src = [
    "Komatsu / Modular Mining DISPATCH case study (idle 210&rarr;38 h/mo; +29% TMPH) — komatsu.com/en-us/case-studies/dispatch-fleet-management-system-helps-mine-optimize-its-haulage",
    "Wenco Mining Fleet Management — wencomine.com/our-solutions/mining-fleet-management",
    "Cat MineStar Solutions — cat.com/en_US/by-industry/mining/minestar-solutions.html",
    "DISPATCH Fleet Management — mining-technology.com/products/dispatch-fleet-management/",
    "Improving Shovel-Truck Productivity (match factor, UMaT) — conference.umat.edu.gh",
    "Truck Haulage: Selection, Cycle Time & Output (DGMS) — onlineminingexam.graphy.com",
    "Haul Trucks Queuing Prediction in Open Pit Mines (A. Soofastaei) — linkedin.com/pulse",
    "Fleet Management Dashboard KPIs & best practice — superblocks.com/blog/fleet-management-dashboard; geotab.com/blog/fleet-management-dashboard; samsara.com/products/telematics",
    "Modern Fleet Management UI/UX (north-star + supporting KPI pattern; utilisation >78%) — heavyvehicleinspection.com",
]
story += [bullets(src, style=SMALL, color=MUTED)]

# ── Build ─────────────────────────────────────────────────────────────────────
doc = SimpleDocTemplate("/home/user/halalcheck-ai/docs/hauling-optimisation-design-brief.pdf",
    pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=22*mm, bottomMargin=18*mm,
    title="OreSight AI — Hauling Optimisation Design Brief", author="OreSight AI")
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print("PDF written")
