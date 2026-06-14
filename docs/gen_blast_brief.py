#!/usr/bin/env python3
"""Generate the Blast Optimisation demo design-brief PDF (handover to Claude)."""
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
        canvas.setFont("Helvetica",8); canvas.setFillColor(MUTED); canvas.drawRightString(w-20*mm,h-14*mm,"Blast Optimisation — Design Brief")
        canvas.setStrokeColor(LINE); canvas.line(20*mm,h-16*mm,w-20*mm,h-16*mm)
    canvas.setFont("Helvetica",7.5); canvas.setFillColor(MUTED)
    canvas.drawString(20*mm,12*mm,"OreSight AI · Operations Intelligence for Indonesian Mining · Confidential design brief")
    canvas.drawRightString(w-20*mm,12*mm,f"{doc.page}"); canvas.restoreState()

story = []
# ══ COVER ═════════════════════════════════════════════════════════════════════
story += [Spacer(1,30*mm), Paragraph("DESIGN BRIEF · HANDOVER TO CLAUDE", TAG), Spacer(1,6)]
story += [Paragraph("Blast Optimisation", COVER_T)]
story += [Paragraph("Drill &amp; blast — fragmentation, mine-to-mill value &amp; vibration control, AI-designed", COVER_S)]
story += [Spacer(1,8), rule(GREEN,1.4,2,10)]
story += [Paragraph(
    "An interactive demo for the OreSight AI platform: a drill-and-blast console that designs the blast to a "
    "<b>target fragmentation</b> — the size distribution that feeds the crusher and mill fastest — while holding "
    "ground vibration and flyrock inside their limits. The AI predicts fragmentation from the bench geology, tunes "
    "powder factor / burden / spacing / timing, and prices the <b>mine-to-mill</b> throughput it unlocks. The "
    "upstream lever for the whole value chain.", BODY)]
story += [Spacer(1,14)]
meta = Table([
    [Paragraph("<b>Visual model</b>", CELL), Paragraph("Fragmentation size-distribution curve (predicted vs target P80) + bench hole-pattern as the hero", CELL)],
    [Paragraph("<b>Site</b>", CELL), Paragraph("Batu Hijau copper-gold open pit (hard rock) — consistent with the IROC Control Tower; nickel laterite is largely free-dig", CELL)],
    [Paragraph("<b>Setup</b>", CELL), Paragraph("~15 m benches, 229 mm holes, bulk emulsion + electronic detonators, MWD-logged geology; gyratory crusher + SAG mill downstream", CELL)],
    [Paragraph("<b>Design system</b>", CELL), Paragraph("Reuse OreSight light/dark control-room language from FSP / Hauling", CELL)],
    [Paragraph("<b>Sources</b>", CELL), Paragraph("Orica BlastIQ &amp; FRAGTrack; Maptek BlastLogic &amp; BlastMCF; MWD-to-charge; image fragmentation (WipFrag/Split/Motion Metrics); mine-to-mill", CELL)],
    [Paragraph("<b>Date</b>", CELL), Paragraph("14 June 2026", CELL)],
], colWidths=[34*mm, 131*mm])
meta.setStyle(TableStyle([("LINEBELOW",(0,0),(-1,-1),0.4,LINE),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("VALIGN",(0,0),(-1,-1),"TOP")]))
story += [meta, PageBreak()]

# ══ 1. CONTEXT ════════════════════════════════════════════════════════════════
story += [Paragraph("1 · Context &amp; goal", H1)]
story += [Paragraph(
    "Drill &amp; blast is the <b>first transformation in the value chain</b>, and its product is <b>fragmentation</b> "
    "— the rock size distribution. That single output cascades downstream: well-controlled fragmentation lifts "
    "<b>shovel dig rate &rarr; truck payload &rarr; crusher / mill throughput</b> and lowers mill energy per tonne. "
    "This is the classic <b>mine-to-mill</b> lever — spend a little more energy in the blast to unlock "
    "disproportionate throughput at the plant — bounded by the safety governors of <b>ground vibration (PPV)</b>, "
    "airblast and <b>flyrock</b>.", BODY)]
story += [Paragraph(
    "Goal: a demo that reads as one product with FSP and the Hauling / Control Tower consoles — a live drill-and-blast "
    "screen where the AI does the design judgement (predict the fragmentation, tune the pattern and charge, price the "
    "downstream gain) and never proposes a design that breaches a vibration or flyrock limit.", BODY)]
story += [Paragraph("What benchmark practice does (research synthesis)", H2)]
story += [bullets([
    "<b>Orica BlastIQ</b> is the reference digital platform: it integrates design (SHOTPlus), delivery and measurement systems in real time for automated <b>powder-factor and fragmentation QC</b>. Its <b>FRAGTrack</b> measures fragmentation autonomously with stereoscopic cameras and a <b>deep-neural-net</b> model on shovels / conveyors.",
    "<b>Maptek BlastLogic</b> is the enterprise drill-&amp;-blast repository — it links blast design to geology, geotech and the mine plan, optimises <b>charge plans and initiation timing</b>, and does <b>post-blast reconciliation</b> (planned vs actual). <b>BlastMCF</b> folds <b>cost, flyrock, fragmentation, powder factor and vibration models</b> into one design objective; Maptek now also offers <b>automated blast design</b>.",
    "<b>MWD (measure-while-drilling)</b> turns every hole into a rock-hardness / energy log, so the charge can be <b>varied to the geology</b> — heavier in hard zones, lighter in soft — instead of a single blanket powder factor.",
    "<b>Electronic detonators</b> make timing a precision lever: staggering inter-hole delays improves breakage <i>and</i> lowers peak particle velocity, so fragmentation and vibration are tuned together rather than traded.",
]), ]
story += [PageBreak()]

# ══ 2. METRICS ════════════════════════════════════════════════════════════════
story += [Paragraph("2 · Metrics to adopt", H1)]
story += [Paragraph("North-star KPIs (large, top band)", H2)]
ns = [
    [Paragraph("Metric", CELLH), Paragraph("Definition", CELLH), Paragraph("Unit", CELLH), Paragraph("Target band", CELLH)],
    [Paragraph("<b>Powder factor</b>", CELL), Paragraph("Explosive energy per volume blasted", CELL), Paragraph("kg/m³", CELL), Paragraph("design ~0.7–1.0 (hard rock)", CELL)],
    [Paragraph("<b>Predicted P80</b>", CELL), Paragraph("80%-passing fragment size — the product that feeds the mill", CELL), Paragraph("mm", CELL), Paragraph("hit SAG-feed target", CELL)],
    [Paragraph("<b>Dig rate</b>", CELL), Paragraph("Shovel productivity — the live downstream proxy of good frag", CELL), Paragraph("bcm/h", CELL), Paragraph("maximise", CELL)],
    [Paragraph("<b>Vibration PPV vs limit</b>", CELL), Paragraph("Peak particle velocity at the nearest structure vs the legal cap", CELL), Paragraph("mm/s", CELL), Paragraph("&le; limit (e.g. 25)", CELL)],
]
story += [table(ns, [33*mm, 79*mm, 16*mm, 38*mm])]
story += [Paragraph("Supporting metrics (secondary band)", H2)]
sup = [
    [Paragraph("Metric", CELLH), Paragraph("Definition / why it matters", CELLH), Paragraph("Unit", CELLH)],
    [Paragraph("<b>% oversize / % fines</b>", CELL), Paragraph("Tails of the distribution — oversize stalls the dig & crusher; fines waste energy / cause loss", CELL), Paragraph("%", CELL)],
    [Paragraph("<b>Energy factor</b>", CELL), Paragraph("Explosive energy per tonne — the charge-to-rock match", CELL), Paragraph("MJ/t", CELL)],
    [Paragraph("<b>Burden × spacing</b>", CELL), Paragraph("The pattern geometry — the primary fragmentation lever", CELL), Paragraph("m", CELL)],
    [Paragraph("<b>Flyrock range</b>", CELL), Paragraph("Predicted throw vs the exclusion zone — a hard safety gate", CELL), Paragraph("m", CELL)],
    [Paragraph("<b>Drill &amp; blast cost</b>", CELL), Paragraph("$/t for drilling + explosive — the spend being optimised", CELL), Paragraph("$/t", CELL)],
    [Paragraph("<b>Downstream uplift</b>", CELL), Paragraph("Crusher / mill throughput gain from better fragmentation (mine-to-mill)", CELL), Paragraph("t/h", CELL)],
]
story += [table(sup, [33*mm, 116*mm, 16*mm])]
story += [Paragraph("Value model (reuse FSP/Hauling approach): mine-to-mill throughput uplift &times; margin + avoided oversize re-handling, net of the marginal explosive cost — derived, never canned.", SMALL)]
story += [PageBreak()]

# ══ 3. STATUS MODEL ═══════════════════════════════════════════════════════════
story += [Paragraph("3 · Fragmentation &amp; safety model · colour coding", H1)]
story += [Paragraph("The size-distribution curve, the bench pattern and the reconciliation view share one colour language, keyed to the target P80 band and the safety limits.", BODY)]
states = [
    (AMBER, "FINES", "Below target — over-blast: wasted energy, ore loss / dilution"),
    (GREEN, "ON-SPEC", "Within the target P80 band — feeds the mill cleanly"),
    (colors.HexColor("#d97706"), "OVERSIZE", "Above target — slow dig, crusher choke"),
    (RED, "BOULDER", "Gross oversize — dig stall / secondary breakage"),
    (colors.HexColor("#7c3aed"), "MWD HARD ZONE", "Hard rock from drilling log — charge-up candidate"),
    (colors.HexColor("#991b1b"), "LIMIT BREACH", "PPV or flyrock over limit — design rejected"),
]
rows = [[Paragraph("Band", CELLH), Paragraph("Meaning", CELLH), Paragraph("Swatch", CELLH)]]
for c,name,mean in states: rows.append([Paragraph(f"<b>{name}</b>", CELL), Paragraph(mean, CELL), chip(c)])
story += [table(rows, [36*mm, 107*mm, 22*mm])]
story += [Paragraph("Key design idea: <b>aim for the band, not the finest.</b> The win is a distribution centred on the target P80 — fine enough to feed the mill fast, not so fine it wastes energy or loses ore — and every candidate design is gated by the PPV and flyrock limits before it can be recommended.", BODY)]
story += [PageBreak()]

# ══ 4. LAYOUT ═════════════════════════════════════════════════════════════════
story += [Paragraph("4 · Screen layout &amp; components", H1)]
story += [Paragraph("Follow the FSP / Hauling skeleton: breadcrumb &rarr; demo-head &rarr; KPI row &rarr; dark control-room screen &rarr; AI panel + side panels. Components top to bottom:", BODY)]
comp = [
    [Paragraph("#", CELLH), Paragraph("Component", CELLH), Paragraph("Spec", CELLH)],
    [Paragraph("1", CELL), Paragraph("<b>KPI row</b>", CELL), Paragraph("4 north-star cards: powder factor (kg/m³), predicted P80 (mm), dig rate (bcm/h), PPV vs limit (mm/s). Deltas vs target / limit.", CELL)],
    [Paragraph("2", CELL), Paragraph("<b>Constraint (drum) strip</b>", CELL), Paragraph("Reuse FSP strip: binding constraint = fragmentation / vibration / flyrock / cost, with a 'what governs this design' note.", CELL)],
    [Paragraph("3", CELL), Paragraph("<b>Fragmentation curve (HERO)</b>", CELL), Paragraph("Cumulative % -passing size-distribution curve: predicted vs target, with fines / on-spec / oversize bands and the P80 marker. The whole outcome in one chart; re-draws as the design changes.", CELL)],
    [Paragraph("4", CELL), Paragraph("<b>Bench blast pattern</b>", CELL), Paragraph("Plan-view hole grid (burden × spacing) coloured by MWD hardness / charge weight; electronic-detonator timing contours. The design canvas — drag powder factor / spacing and watch it react.", CELL)],
    [Paragraph("5", CELL), Paragraph("<b>Vibration &amp; flyrock panel</b>", CELL), Paragraph("PPV-vs-limit gauge (predicted at nearest structure) + flyrock range vs exclusion zone. The safety gate, always visible.", CELL)],
    [Paragraph("6", CELL), Paragraph("<b>Post-blast reconciliation</b>", CELL), Paragraph("Planned vs actual fragmentation (image-measured) + muckpile movement; feeds the next design. Mirrors BlastLogic reconciliation.", CELL)],
    [Paragraph("7", CELL), Paragraph("<b>Scenario inject + free-form</b>", CELL), Paragraph("Presets (harder seam, structure nearby, wet holes, finer-feed demand) + NL box &rarr; AI re-designs. Mirror FSP / Hauling.", CELL)],
    [Paragraph("8", CELL), Paragraph("<b>AI panel + value</b>", CELL), Paragraph("renderAIResult-style: headline + design actions (burden / spacing / charge / timing) + recommendations + downstream uplift + value protected.", CELL)],
]
story += [table(comp, [7*mm, 44*mm, 115*mm])]
story += [Paragraph("Tabs (optional): <b>Fragmentation</b> (curve) · <b>Pattern</b> (design) · <b>Reconciliation</b> — mirroring FSP / Hauling.", SMALL)]
story += [PageBreak()]

# ══ 5. AI + PROMPT ════════════════════════════════════════════════════════════
story += [Paragraph("5 · AI capabilities", H1)]
story += [bullets([
    "<b>Fragmentation prediction</b> — predict P80 and the size distribution from the design + MWD geology + rock mass (the FRAGTrack / Kuz-Ram-style core).",
    "<b>Design optimisation</b> — tune burden / spacing / powder factor / timing to hit the target P80 while holding PPV and flyrock inside limits.",
    "<b>Charge-to-geology</b> — use MWD hardness to vary powder factor hole-by-hole rather than a blanket value.",
    "<b>Vibration &amp; flyrock gating</b> — every candidate design is checked against the structure PPV limit and the exclusion zone before it is offered; timing is staggered to cut peak velocity.",
    "<b>Mine-to-mill value</b> — translate the fragmentation into crusher / mill throughput uplift and price it net of explosive cost.",
    "<b>Post-blast reconciliation</b> — compare planned vs image-measured actual fragmentation and feed the learning into the next design.",
    "<b>Scenario re-design</b> — harder seam, nearby structure, wet holes, finer-feed demand &rarr; live re-solve with rationale.",
]), ]
story += [Paragraph("6 · Claude prompt (drop-in for server.js)", H1)]
story += [Paragraph("House style (persona &rarr; exact JSON schema &rarr; domain rules &rarr; JSON-only). One endpoint <font face='Courier'>/api/blast/analyze</font>; the <font face='Courier'>{headline, recommendations[], valueImpactUSD, narrative}</font> core reuses renderAIResult, specialised fields drive the bespoke UI. Ship a deterministic <font face='Courier'>blastFallback()</font> so it runs with no API key.", BODY)]
pl = [
"BLAST_PROMPT = `You are OreSight AI's drill-and-blast engineer for the Batu Hijau",
"copper-gold open pit (hard rock), Sumbawa, Indonesia. Benches are ~15 m, drilled on",
"229 mm holes and charged with bulk emulsion and electronic detonators. Bench geology is",
"logged by MWD (rock hardness / specific energy). Downstream is a primary gyratory crusher",
"feeding a SAG mill - fragmentation drives shovel dig rate and mill throughput (mine-to-",
"mill). Safety governors: a ground-vibration PPV limit at the nearest structure, a flyrock",
"exclusion zone, and airblast.",
"",
"Given a JSON bench/blast snapshot (MWD hardness, current design: burden, spacing, hole",
"diameter, bench height, stemming, sub-drill, powder factor, timing; target P80; downstream",
"demand; nearest-structure distance and PPV limit) - and optionally a scenario - optimise",
"the blast. Return JSON with EXACTLY this structure:",
"{",
'  "headline": "<conclusion: predicted fragmentation vs target and the move>",',
'  "powderFactorKgM3": <number>,',
'  "predictedP80mm": <number, 80%-passing fragment size>,',
'  "fragmentation": {"pctOversize": <number>, "pctFines": <number>,',
'     "targetP80mm": <number>},',
'  "bindingConstraint": "fragmentation" | "vibration" | "flyrock" | "cost",',
'  "constraintNote": "<what governs this design, one line>",',
'  "designActions": [{"param": "burden|spacing|hole-diameter|stemming|',
'     sub-drill|charge|timing", "change": "<from -> to>", "reason": "<short>",',
'     "effect": "<short>"}],',
'  "vibration": {"predictedPpvMmS": <number>, "limitMmS": <number>,',
'     "status": "OK" | "WATCH" | "BREACH"},',
'  "flyrock": {"predictedRangeM": <number>, "exclusionM": <number>,',
'     "status": "OK" | "WATCH" | "BREACH"},',
'  "downstreamUpliftTph": <integer, crusher/mill throughput gain>,',
'  "recommendations": [{"action": "<specific>",',
'     "impact": "<quantified: P80, t/h, US$, mm/s>", "timeframe": "<when>"}],',
'  "valueImpactUSD": <integer, annualised mine-to-mill value net of explosive cost>,',
'  "narrative": "<3-4 sentences linking design, fragmentation and downstream",',
'     within the vibration / flyrock limits>"',
"}",
"",
"Domain rules:",
"- Fragmentation is the product: tune powder factor, burden/spacing and timing toward the",
"  target P80. Finer (within reason) lifts dig rate and mill throughput, but watch fines -",
"  over-blasting wastes energy and can cause ore loss / dilution. Aim for the band.",
"- Match charge to rock: use MWD hardness to vary powder factor hole-by-hole (heavier in",
"  hard zones, lighter in soft).",
"- Safety governs absolutely: never recommend a design whose predicted PPV exceeds the",
"  structure limit or whose flyrock range exceeds the exclusion zone. Name the binding",
"  constraint and back off powder factor / re-time / add stemming instead.",
"- Electronic-detonator timing controls fragmentation AND vibration: stagger inter-hole",
"  delays to lower peak particle velocity while improving breakage.",
"- Quantify the downstream: tie value to crusher/mill throughput uplift and avoided",
"  oversize re-handling, net of the marginal explosive cost.",
"- 3-5 designActions and 3-4 recommendations, each concrete and quantified.",
"",
"IMPORTANT: Return ONLY valid JSON, no other text.`;",
]
box = Table([[Paragraph("<br/>".join((l or "&nbsp;").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;") for l in pl), MONO_LIGHT)]], colWidths=[165*mm])
box.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#0f140e")),("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,0),(-1,-1),9),("BOX",(0,0),(-1,-1),0.6,GREEN)]))
story += [box]
story += [Paragraph("Companion (optional, mirrors FSP/Hauling): a small BLAST_PARSE_PROMPT behind /api/blast/parse turns a free-text note ('hard band on the north wall, house at 380 m') into a structured scenario the engine re-designs.", SMALL)]
story += [PageBreak()]

# ══ 7. DESIGN SYSTEM + BUILD ══════════════════════════════════════════════════
story += [Paragraph("7 · Design system (reuse OreSight tokens)", H1)]
pal = [(GREEN,"On-spec / brand","#15803d"),(AMBER,"Fines","#b45309"),(colors.HexColor("#d97706"),"Oversize","#d97706"),(RED,"Boulder","#b91c1c"),(colors.HexColor("#7c3aed"),"MWD hard","#7c3aed"),(DARK,"Control-room","#10150f")]
chips=[[chip(c,27) for c,_,_ in pal]]
labels=[[Paragraph(f"<b>{lbl}</b><br/><font face='Courier' size=7>{hx}</font>", CELL) for _,lbl,hx in pal]]
pt=Table(chips+labels, colWidths=[27*mm]*6); pt.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),5),("VALIGN",(0,0),(-1,-1),"TOP")]))
story += [pt, Spacer(1,6)]
story += [bullets([
    "<b>Type:</b> Inter (UI) + JetBrains Mono (labels/data), already loaded.",
    "<b>Reuse verbatim:</b> kpi-card, fsp-screen / fsp-tab / fsp-status, bottleneck-strip, ai-panel + renderAIResult, risk-item, copilot, freeform-row, the haul gauge components.",
    "<b>New components:</b> fragmentation size-distribution curve (SVG, % passing + bands + P80 marker), bench hole-pattern grid (burden×spacing, MWD/charge colour, timing contours), PPV / flyrock gauges, planned-vs-actual reconciliation overlay.",
    "<b>Motion:</b> the fragmentation curve and pattern re-draw as powder factor / spacing change; the PPV & flyrock gauges swing and gate the design (a rejected design flashes the limit) — the demo's 'aha'.",
]), ]
story += [Paragraph("8 · Build notes", H1)]
story += [bullets([
    "<b>Page:</b> mining-demo/public/blast.html + js/blast.js; <b>endpoint:</b> /api/blast/analyze (+ optional /api/blast/parse) in server.js; <b>fallback:</b> data/blast.js (deterministic).",
    "<b>Deterministic engine is source of truth</b> for the on-screen curve and pattern (always re-draws visibly); AI parses free-text and writes rationale on top — works fully with no API key.",
    "<b>Matrix wiring:</b> light up the 'Blast Optimisation' cell (Drill &amp; Blast stage) on the value-chain landing page as a LIVE DEMO linking to /blast.html.",
    "<b>Nav:</b> add a 'Blast' link; cross-link from the Control Tower (Batu Hijau) and Blending / Recovery demos (mine-to-mill).",
]), ]
story += [Paragraph("Sources", H2)]
src = [
    "Orica BlastIQ — integrated drill-&amp;-blast platform, powder-factor / fragmentation QC, SHOTPlus — orica.com/.../blastiq",
    "Orica FRAGTrack — autonomous fragmentation measurement (stereoscopic camera + deep neural net) — orica.com",
    "Maptek BlastLogic — enterprise drill-&amp;-blast repository, charge / initiation design, post-blast reconciliation — maptek.com/products/blastlogic; maptek.com forge 'reconciling post blast performance'",
    "Maptek BlastMCF — integrated cost / flyrock / fragmentation / powder-factor / vibration design models; automated blast design — maptek.com forge 'BlastMCF'; im-mining.com 2024",
    "Fragmentation / photoanalysis &amp; mine-to-mill (P80, SAG feed, image sizing) — WipFrag / Split / Motion Metrics; en.wikipedia.org Photoanalysis, Mill (grinding)",
    "Drill-&amp;-blast software landscape (Orica, Maptek, MWD-to-charge) — miningsoftwarereviews.com drill-blast",
]
story += [bullets(src, style=SMALL, color=MUTED)]

doc = SimpleDocTemplate("/home/user/halalcheck-ai/docs/blast-optimisation-design-brief.pdf", pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=22*mm, bottomMargin=18*mm, title="OreSight AI — Blast Optimisation Design Brief", author="OreSight AI")
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print("PDF written")
