#!/usr/bin/env python3
"""Generate the Payload Optimisation demo design-brief PDF (handover to Claude)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                HRFlowable, PageBreak, ListFlowable, ListItem)

GREEN = colors.HexColor("#15803d"); DARK = colors.HexColor("#10150f"); INK = colors.HexColor("#1d251f")
MUTED = colors.HexColor("#6e7468"); CREAM = colors.HexColor("#f6f5ef"); LINE = colors.HexColor("#e2e0d6")
AMBER = colors.HexColor("#b45309"); BLUE = colors.HexColor("#0e7490"); RED = colors.HexColor("#b91c1c"); WHITE = colors.white

styles = getSampleStyleSheet()
def S(name, **kw):
    base = kw.pop("parent", styles["Normal"]); return ParagraphStyle(name, parent=base, **kw)
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
    return ListFlowable([ListItem(Paragraph(t, style), bulletColor=color, value="square") for t in items], bulletType="bullet", bulletFontSize=6, leftIndent=14, bulletOffsetY=1)
def rule(c=LINE, w=0.8, sb=4, sa=8): return HRFlowable(width="100%", thickness=w, color=c, spaceBefore=sb, spaceAfter=sa)
def table(data, col_widths, header=True, zebra=True):
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    cmds = [("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("LINEBELOW",(0,0),(-1,-1),0.4,LINE)]
    if header: cmds += [("BACKGROUND",(0,0),(-1,0),GREEN),("LINEBELOW",(0,0),(-1,0),0,GREEN)]
    if zebra:
        for r in range(1,len(data)):
            if r%2==0: cmds.append(("BACKGROUND",(0,r),(-1,r),CREAM))
    t.setStyle(TableStyle(cmds)); return t
def chip(c, w=18):
    tb = Table([[""]], colWidths=[w*mm], rowHeights=[5*mm]); tb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),c),("BOX",(0,0),(-1,-1),0.5,LINE)])); return tb
def header_footer(canvas, doc):
    canvas.saveState(); w,h = A4
    canvas.setFillColor(GREEN); canvas.rect(0,h-6,w,6,fill=1,stroke=0)
    if doc.page>1:
        canvas.setFont("Helvetica-Bold",8); canvas.setFillColor(GREEN); canvas.drawString(20*mm,h-14*mm,"OreSight AI")
        canvas.setFont("Helvetica",8); canvas.setFillColor(MUTED); canvas.drawRightString(w-20*mm,h-14*mm,"Payload Optimisation — Design Brief")
        canvas.setStrokeColor(LINE); canvas.line(20*mm,h-16*mm,w-20*mm,h-16*mm)
    canvas.setFont("Helvetica",7.5); canvas.setFillColor(MUTED)
    canvas.drawString(20*mm,12*mm,"OreSight AI · Operations Intelligence for Indonesian Mining · Confidential design brief")
    canvas.drawRightString(w-20*mm,12*mm,f"{doc.page}"); canvas.restoreState()

story = []
# ══ COVER ═════════════════════════════════════════════════════════════════════
story += [Spacer(1,30*mm), Paragraph("DESIGN BRIEF · HANDOVER TO CLAUDE", TAG), Spacer(1,6)]
story += [Paragraph("Payload Optimisation", COVER_T)]
story += [Paragraph("In-pit hauler + loader — truck-factor, 10/10/20 compliance &amp; pass-matching, AI-coached", COVER_S)]
story += [Spacer(1,8), rule(GREEN,1.4,2,10)]
story += [Paragraph(
    "An interactive demo for the OreSight AI platform: a load-and-haul payload console that tightens the "
    "<b>truck-factor distribution</b> — loading every HD785-7 just under rated, consistently — by closing the "
    "loader-to-truck feedback loop. The AI finds where under/over-loading concentrates (crew, shift, shovel), "
    "fixes the pass match, and quantifies the tonnes and cost-per-tonne at stake. The in-pit complement to the "
    "Hauling (stockpile&rarr;jetty) dispatch console.", BODY)]
story += [Spacer(1,14)]
meta = Table([
    [Paragraph("<b>Visual model</b>", CELL), Paragraph("Payload-distribution histogram (rated / 110% / 120% lines) as the hero", CELL)],
    [Paragraph("<b>Fleet</b>", CELL), Paragraph("HD785-7 haul trucks (91 t rated) loaded by a wheel loader + excavator; VIMS-class payload meters, loader bucket-weighing", CELL)],
    [Paragraph("<b>Governing policy</b>", CELL), Paragraph("Caterpillar 10/10/20 payload policy (mean ≤100% · ≤10% over 110% · none over 120%)", CELL)],
    [Paragraph("<b>Design system</b>", CELL), Paragraph("Reuse OreSight light/dark control-room language from FSP &amp; Hauling", CELL)],
    [Paragraph("<b>Sources</b>", CELL), Paragraph("Cat 10/10/20 &amp; VIMS Payload; Komatsu Payload Management; Loadrite / Argus bucket-weighing; Wenco / Hexagon / Modular payload analytics", CELL)],
    [Paragraph("<b>Date</b>", CELL), Paragraph("14 June 2026", CELL)],
], colWidths=[34*mm, 131*mm])
meta.setStyle(TableStyle([("LINEBELOW",(0,0),(-1,-1),0.4,LINE),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("VALIGN",(0,0),(-1,-1),"TOP")]))
story += [meta, PageBreak()]

# ══ 1. CONTEXT ════════════════════════════════════════════════════════════════
story += [Paragraph("1 · Context &amp; goal", H1)]
story += [Paragraph(
    "Every haul cycle costs the same whether the truck is full or not — so the cheapest tonnes in the pit are the "
    "ones recovered by <b>loading accurately</b>. The lever is the <b>truck factor</b> (mean payload per load) and, "
    "more subtly, its <b>consistency</b>: a tight distribution centred just under rated beats occasional heavy loads. "
    "Underloading silently leaves a free truck of capacity on the table; overloading buys tonnes with tyre (TKPH), "
    "frame and component life. Payload optimisation finds the safe centre and holds it.", BODY)]
story += [Paragraph(
    "Goal: a demo that reads as one product with FSP and the Hauling console — a live load-and-haul screen where "
    "the AI does the supervisory judgement (which crew/shift/shovel is drifting, what pass count and bucket fill "
    "fix it, what it is worth) and closes the loop back to the loader operator.", BODY)]
story += [Paragraph("What benchmark practice does (research synthesis)", H2)]
story += [bullets([
    "<b>The 10/10/20 policy is the industry yardstick</b> (Caterpillar): across any 3-shift window the <b>mean payload must not exceed 100%</b> of rated, <b>no more than 10% of loads may exceed 110%</b>, and <b>no single load may exceed 120%</b>. It is the safe envelope every payload dashboard scores against.",
    "<b>Payload meters + loader bucket-weighing close the loop.</b> Truck VIMS-class monitors log load time, payload and TKPH/overload alarms; loader systems (Loadrite, Argus, Cat/Komatsu Payload) weigh <i>each bucket</i> and give the operator <b>immediate feedback to trim the last pass</b> — the single biggest driver of consistent loads.",
    "<b>Pass matching is the geometry of a good load:</b> the best match fills the truck to target in <b>3–4 even passes</b>; consistent fill factors near <b>95–100%</b> beat the erratic ~90% of un-instrumented loading.",
    "<b>The prize is large and well documented:</b> loading accurately to within ~10% of capacity delivers <b>8–12% productivity</b> gains and lowers cost-per-tonne; the loss almost always concentrates by <b>operator / crew / shift</b>, so the fix is a targeted feedback loop, not a blanket target.",
]), ]
story += [PageBreak()]

# ══ 2. METRICS ════════════════════════════════════════════════════════════════
story += [Paragraph("2 · Metrics to adopt", H1)]
story += [Paragraph("North-star KPIs (large, top band)", H2)]
ns = [
    [Paragraph("Metric", CELLH), Paragraph("Definition", CELLH), Paragraph("Unit", CELLH), Paragraph("Target band", CELLH)],
    [Paragraph("<b>Truck factor</b>", CELL), Paragraph("Mean payload per load across the fleet", CELL), Paragraph("t/load", CELL), Paragraph("just under 91 (≈88–90)", CELL)],
    [Paragraph("<b>10/10/20 compliance</b>", CELL), Paragraph("Mean ≤100%, ≤10% over 110%, none over 120% of rated", CELL), Paragraph("pass", CELL), Paragraph("PASS", CELL)],
    [Paragraph("<b>Payload CV</b>", CELL), Paragraph("Coefficient of variation of payload — the consistency score", CELL), Paragraph("%", CELL), Paragraph("tight, &lt;~6%", CELL)],
    [Paragraph("<b>Lost + risk tonnes</b>", CELL), Paragraph("Recoverable under-load gap + tonnes carried as overload", CELL), Paragraph("t/day", CELL), Paragraph("minimise; risk &rarr; 0", CELL)],
]
story += [table(ns, [33*mm, 78*mm, 16*mm, 38*mm])]
story += [Paragraph("Supporting metrics (secondary band)", H2)]
sup = [
    [Paragraph("Metric", CELLH), Paragraph("Definition / why it matters", CELLH), Paragraph("Unit", CELLH)],
    [Paragraph("<b>Overload rate</b>", CELL), Paragraph("Share of loads &gt; 110% rated — the 10/10/20 amber band", CELL), Paragraph("%", CELL)],
    [Paragraph("<b>Underload rate</b>", CELL), Paragraph("Share of loads &lt; 90% rated — the silent capacity loss", CELL), Paragraph("%", CELL)],
    [Paragraph("<b>Pass count</b>", CELL), Paragraph("Passes to fill a truck; 3–4 even is the productive match", CELL), Paragraph("passes", CELL)],
    [Paragraph("<b>Bucket fill factor</b>", CELL), Paragraph("Bucket payload vs rated bucket — loader-side consistency", CELL), Paragraph("%", CELL)],
    [Paragraph("<b>TKPH headroom</b>", CELL), Paragraph("Tyre tonne-km/h vs rating; overload erodes it in wet-season heat", CELL), Paragraph("%", CELL)],
    [Paragraph("<b>Cost per tonne</b>", CELL), Paragraph("Haulage $/t — the number underloading quietly inflates", CELL), Paragraph("$/t", CELL)],
]
story += [table(sup, [33*mm, 116*mm, 16*mm])]
story += [Paragraph("Value model (reuse FSP/Hauling approach): recovered tonnes (closing the under-load gap to target) &times; margin, net of the tyre / structural cost of any overload — derived, never canned.", SMALL)]
story += [PageBreak()]

# ══ 3. STATUS MODEL ═══════════════════════════════════════════════════════════
story += [Paragraph("3 · Load-band model &amp; colour coding", H1)]
story += [Paragraph("The histogram, the operator table and the truck-factor trend share one colour language, keyed to the 10/10/20 envelope against rated payload (91 t).", BODY)]
states = [
    (AMBER, "UNDERLOAD", "&lt; 90% rated — lost haulage capacity"),
    (GREEN, "ON-TARGET", "90–100% rated — the safe centre to hold"),
    (BLUE, "UPPER-OK", "100–110% rated — within policy, watch the mean"),
    (colors.HexColor("#d97706"), "OVER-110", "110–120% rated — counts against the 10% limit"),
    (RED, "OVER-120", "&gt; 120% rated — policy breach; tyre / frame risk"),
    (colors.HexColor("#7c3aed"), "SCALE-DRIFT", "meter calibration anomaly — exclude &amp; flag"),
]
rows = [[Paragraph("Band", CELLH), Paragraph("Meaning", CELLH), Paragraph("Swatch", CELLH)]]
for c,name,mean in states: rows.append([Paragraph(f"<b>{name}</b>", CELL), Paragraph(mean, CELL), chip(c)])
story += [table(rows, [34*mm, 109*mm, 22*mm])]
story += [Paragraph("Key design idea: <b>consistency over peak.</b> The win is squeezing the distribution toward the on-target band and nudging the mean up to just under rated — not chasing heavy loads. Reducing CV is what safely lifts the truck factor.", BODY)]
story += [PageBreak()]

# ══ 4. LAYOUT ═════════════════════════════════════════════════════════════════
story += [Paragraph("4 · Screen layout &amp; components", H1)]
story += [Paragraph("Follow the FSP / Hauling skeleton: breadcrumb &rarr; demo-head &rarr; KPI row &rarr; dark control-room screen &rarr; AI panel + side panels. Components top to bottom:", BODY)]
comp = [
    [Paragraph("#", CELLH), Paragraph("Component", CELLH), Paragraph("Spec", CELLH)],
    [Paragraph("1", CELL), Paragraph("<b>KPI row</b>", CELL), Paragraph("4 north-star cards: truck factor (t/load), 10/10/20 compliance (PASS/MARGINAL/FAIL), payload CV, lost+risk tonnes. Deltas vs target.", CELL)],
    [Paragraph("2", CELL), Paragraph("<b>Constraint (drum) strip</b>", CELL), Paragraph("Reuse FSP strip: binding issue = underloading / overloading / pass-mismatch / fill-factor / scale-drift, with a 'where it concentrates' note.", CELL)],
    [Paragraph("3", CELL), Paragraph("<b>Payload histogram (HERO)</b>", CELL), Paragraph("Distribution of loads vs % rated, green/amber/red bands, with vertical lines at 100 / 110 / 120% and a mean marker. The whole story in one chart; animates as loads stream in.", CELL)],
    [Paragraph("4", CELL), Paragraph("<b>Truck-factor trend</b>", CELL), Paragraph("Mean payload over the shift vs the rated and target lines; shows the distribution tightening after a coaching action.", CELL)],
    [Paragraph("5", CELL), Paragraph("<b>Operator / crew league table</b>", CELL), Paragraph("Per operator/crew/shift: mean payload, CV, 10/10/20 status, lost t/day — sortable; surfaces the drifting crew. The diagnostic table.", CELL)],
    [Paragraph("6", CELL), Paragraph("<b>Loader pass-match panel</b>", CELL), Paragraph("Per shovel/loader: pass count, bucket fill factor, dig rate, and the live <b>trim-pass</b> feedback the operator sees (bucket weights toward a target).", CELL)],
    [Paragraph("7", CELL), Paragraph("<b>Scenario inject + free-form</b>", CELL), Paragraph("Presets (night-shift drift, new operator, wet ore swell, scale miscalibration) + NL box &rarr; AI re-assesses. Mirror FSP / Hauling.", CELL)],
    [Paragraph("8", CELL), Paragraph("<b>AI panel + value</b>", CELL), Paragraph("renderAIResult-style: headline + operator actions (coach / pass-count / fill-target / calibrate, with Δt/day) + recommendations + pass-match + value protected.", CELL)],
]
story += [table(comp, [7*mm, 44*mm, 115*mm])]
story += [Paragraph("Tabs (optional): <b>Distribution</b> (histogram) · <b>Operators</b> (league table) · <b>Loaders</b> (pass-match) — mirroring FSP / Hauling.", SMALL)]
story += [PageBreak()]

# ══ 5. AI + PROMPT ════════════════════════════════════════════════════════════
story += [Paragraph("5 · AI capabilities", H1)]
story += [bullets([
    "<b>Distribution diagnosis</b> — score the fleet against 10/10/20, compute truck factor and CV, and locate where under/over-loading concentrates (operator / crew / shift / shovel).",
    "<b>Pass-match optimisation</b> — recommend the pass count and bucket fill target that fills each truck to target in 3–4 even passes.",
    "<b>Loader feedback loop</b> — turn bucket weights into a live <b>trim-pass</b> recommendation the operator acts on before dumping.",
    "<b>Operator coaching targets</b> — convert the diagnosis into named, quantified coaching actions, not blanket targets.",
    "<b>Overload guardrail</b> — separate recoverable under-load tonnes from overload <i>risk</i> tonnes; never trade tyre/frame life for tonnage.",
    "<b>Scale-drift / anomaly detection</b> — flag payload-meter calibration drift and exclude it from the stats.",
    "<b>Value &amp; cost-per-tonne</b> — quantify recovered tonnes, the 8–12% productivity headroom, and the $/t impact.",
]), ]
story += [Paragraph("6 · Claude prompt (drop-in for server.js)", H1)]
story += [Paragraph("House style (persona &rarr; exact JSON schema &rarr; domain rules &rarr; JSON-only). One endpoint <font face='Courier'>/api/payload/analyze</font>; the <font face='Courier'>{headline, recommendations[], valueImpactUSD, narrative}</font> core reuses renderAIResult, specialised fields drive the bespoke UI. Ship a deterministic <font face='Courier'>payloadFallback()</font> so it runs with no API key.", BODY)]
pl = [
"PAYLOAD_PROMPT = `You are OreSight AI's load-and-haul productivity engineer for a",
"nickel laterite open pit in Morowali, Central Sulawesi. The fleet is Komatsu HD785-7",
"haul trucks (91 t rated payload) loaded by two units - LD-1 (Cat 992K wheel loader)",
"and an EX1900 excavator - over two 12-hour shifts (07:00/19:00 WITA). Trucks carry",
"VIMS-class payload meters; loaders carry bucket-weighing (Loadrite/Argus class).",
"Caterpillar's 10/10/20 payload policy governs: over any 3-shift window the MEAN payload",
"must not exceed 100% rated, no more than 10% of loads may exceed 110%, and no single",
"load may exceed 120%. Underloading wastes haulage; overloading costs tyres (TKPH),",
"frames and components.",
"",
"Given a JSON payload-performance summary (per-fleet, per-operator/crew and per-shovel",
"distribution stats, pass counts, bucket fill factor, targets) - and optionally a focus",
"- assess compliance and optimise payload. Return JSON EXACTLY:",
"{",
'  "headline": "<conclusion: truck factor vs rated and the main opportunity>",',
'  "truckFactorT": <number, mean payload t/load across the fleet>,',
'  "tenTenTwenty": {"meanPctRated": <number>, "pctOver110": <number>,',
'     "pctOver120": <number>, "status": "PASS" | "MARGINAL" | "FAIL"},',
'  "payloadCvPct": <number, coefficient of variation of payload>,',
'  "bindingIssue": "underloading" | "overloading" | "pass-mismatch" |',
'     "fill-factor" | "scale-drift",',
'  "issueNote": "<where the loss concentrates: crew/shift/shovel, one line>",',
'  "lostTonnesPerDay": <integer, recoverable from closing the gap to target>,',
'  "riskTonnesPerDay": <integer, tonnes carried as overload>,',
'  "operatorActions": [{"who": "<operator/crew/shovel id>",',
'     "action": "coach|pass-count|fill-target|calibrate", "detail": "<short>",',
'     "deltaTpd": <tonnes/day recovered>}],',
'  "recommendations": [{"action": "<specific>",',
'     "impact": "<quantified: t/day, %, US$, tyre>", "timeframe": "<when>"}],',
'  "passMatch": {"recommendedPasses": <int>, "bucketFillTargetPct": <number>,',
'     "note": "<one line>"},',
'  "valueImpactUSD": <integer, annualised value of recovered tonnes net of risk>,',
'  "narrative": "<3-4 sentences linking distribution, 10/10/20 and the loader loop>"',
"}",
"",
"Domain rules:",
"- Consistency beats peak: the goal is a TIGHT distribution centred just under rated, not",
"  occasional heavy loads. Reducing CV is what safely lifts the mean truck factor.",
"- 10/10/20 status is PASS only if meanPctRated<=100 AND pctOver110<=10 AND pctOver120==0;",
"  otherwise MARGINAL or FAIL.",
"- Best pass match fills the truck to target in 3-4 EVEN passes; recommend pass count and",
"  bucket fill target accordingly (consistent ~95-100% fill beats erratic ~90%).",
"- Underloading concentrates by operator/crew/shift - name it and make the fix a real-time",
"  bucket-weight + trim-pass feedback loop, not a blanket target.",
"- Overloading is never the fix for underloading: quantify riskTonnes separately and never",
"  trade tyre TKPH / frame life for tonnage.",
"- Accurate loading within ~10% yields ~8-12% productivity; tie lostTonnes and value to it.",
"- 3-5 operatorActions and 3-4 recommendations, each concrete and quantified.",
"",
"IMPORTANT: Return ONLY valid JSON, no other text.`;",
]
box = Table([[Paragraph("<br/>".join((l or "&nbsp;").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;") for l in pl), MONO_LIGHT)]], colWidths=[165*mm])
box.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#0f140e")),("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,0),(-1,-1),9),("BOX",(0,0),(-1,-1),0.6,GREEN)]))
story += [box]
story += [Paragraph("Companion (optional, mirrors FSP/Hauling): a small PAYLOAD_PARSE_PROMPT behind /api/payload/parse turns a free-text note ('night crew light on SH-02') into a structured focus the engine re-assesses.", SMALL)]
story += [PageBreak()]

# ══ 7. DESIGN SYSTEM + BUILD ══════════════════════════════════════════════════
story += [Paragraph("7 · Design system (reuse OreSight tokens)", H1)]
pal = [(GREEN,"On-target / brand","#15803d"),(AMBER,"Underload","#b45309"),(BLUE,"Upper-OK","#0e7490"),(colors.HexColor("#d97706"),"Over-110","#d97706"),(RED,"Over-120","#b91c1c"),(DARK,"Control-room","#10150f")]
chips=[[chip(c,27) for c,_,_ in pal]]
labels=[[Paragraph(f"<b>{lbl}</b><br/><font face='Courier' size=7>{hx}</font>", CELL) for _,lbl,hx in pal]]
pt=Table(chips+labels, colWidths=[27*mm]*6); pt.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),5),("VALIGN",(0,0),(-1,-1),"TOP")]))
story += [pt, Spacer(1,6)]
story += [bullets([
    "<b>Type:</b> Inter (UI) + JetBrains Mono (labels/data), already loaded.",
    "<b>Reuse verbatim:</b> kpi-card, fsp-screen / fsp-tab / fsp-status, bottleneck-strip, ai-panel + renderAIResult, risk-item, copilot, freeform-row, haul-table.",
    "<b>New components:</b> payload histogram (SVG bars + threshold lines + mean marker), truck-factor trend, operator league table, loader pass-match / trim-pass feedback widget.",
    "<b>Motion:</b> the histogram re-bins and the trend extends as loads stream in; after a coaching action the distribution visibly tightens toward the on-target band — the demo's 'aha'.",
]), ]
story += [Paragraph("8 · Build notes", H1)]
story += [bullets([
    "<b>Page:</b> mining-demo/public/payload.html + js/payload.js; <b>endpoint:</b> /api/payload/analyze (+ optional /api/payload/parse) in server.js; <b>fallback:</b> data/payload.js (deterministic).",
    "<b>Deterministic engine is source of truth</b> for the on-screen distribution (always re-bins visibly); AI parses free-text and writes rationale on top — works fully with no API key.",
    "<b>Matrix wiring:</b> light up the 'Payload Optimisation' (Load &amp; Haul) cell on the value-chain landing page as a LIVE DEMO linking to /payload.html.",
    "<b>Nav:</b> add a 'Payload' link; cross-link from the Hauling and Maintenance demos (shared fleet, TKPH).",
]), ]
story += [Paragraph("Sources", H2)]
src = [
    "Caterpillar 10/10/20 payload guidelines &amp; payload placement &mdash; cat.com / scribd AEXQ0250 (Cat Mining Trucks Payload Guidelines)",
    "Cat VIMS Payload Monitor &amp; production reporting (load/haul/dump cycle, histograms) &mdash; cat.com/.../technology/.../vims; Cat Connect Payload (CM20170118-57947)",
    "Komatsu Payload Management &mdash; komatsu.com/.../loading-and-haulage/payload-management",
    "Loader bucket-weighing / trim-pass feedback (Argus, Loadrite) &mdash; austineng.com 'getting payload matching right'; cim.org 'automated supervision'",
    "Accurate-loading productivity (8&ndash;12%; within 10%) &amp; underloading case &mdash; wingfieldscale.com case study; discoveryalert.com.au surge-loader fill factor",
    "Payload-management providers &amp; analytics (Wenco, Hexagon, Modular, Loadrite, RCT, Epiroc CR, Trimble) &mdash; verifiedmarketresearch.com payload-management-system market; mining-technology.com fleet-management buyers guide",
]
story += [bullets(src, style=SMALL, color=MUTED)]

doc = SimpleDocTemplate("/home/user/halalcheck-ai/docs/payload-optimisation-design-brief.pdf", pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=22*mm, bottomMargin=18*mm, title="OreSight AI — Payload Optimisation Design Brief", author="OreSight AI")
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print("PDF written")
