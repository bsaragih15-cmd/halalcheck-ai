/* ═══ MIND ID Control Tower — semantic data layer ═══
   Single source of truth for every tab (Financials · Capital · Operations ·
   Projects · Forecast · Stress · Allocate). All figures ILLUSTRATIVE, pending
   wiring to subsidiary submissions. Standard definitions per the Capital
   Project Monitoring PRD (EVM: SPI/CPI/EAC/VAC; RAG thresholds). */
window.TOWER={
 meta:{asOf:'30 Jun 2026',period:'FY2024 actual vs RKAP',source:'subsidiary submissions · illustrative',version:'v1.0'},
 subs: [
 {id:'ptfi',nm:'Freeport Indonesia',tic:'—',sec:'Copper · Gold',cm:'copper',frev:150,frevP:160,febitda:21.3,febitdaP:22.6,fnp:48.8,fnpP:52,rag:'amber',fdrv:'grade dilution + force majeure',margin:40,quart:1,ebScale:60,st:'red',own:'PTFI · MIND ID 51.2% / FCX 48.8%',ops:[{l:'Mill throughput',v:'~200 ktpd',d:'240 nameplate; all-underground'},{l:'Ore grade',v:'0.92% Cu',d:'+0.76 g/t Au — world-class'},{l:'Net cash cost',v:'~$0/lb',d:'C1 $2.71/lb − gold credits'},{l:'Block cave',v:'133 ktpd',d:'record 151,582 t/day'}],watch:'Lowest-cost copper, biggest earner — but the Sept-2025 mud rush cuts 2026 output ~35%.'},
 {id:'ptba',nm:'Bukit Asam',tic:'PTBA',sec:'Thermal coal',cm:'coal',frev:42.8,frevP:44,febitda:7.4,febitdaP:10.4,fnp:5.1,fnpP:6.5,rag:'red',fdrv:'coal price below budget',margin:19,quart:2,ebScale:14,st:'amber',own:'IDX: PTBA · MIND ID 65%',ops:[{l:'Coal production',v:'43.3 Mt',d:'record'},{l:'Strip ratio',v:'6.23×',d:'beat 6.44× target'},{l:'Cash cost',v:'~$53/t',d:'−6% YoY'},{l:'Realized',v:'$74/t',d:'−12% YoY ICI-3'}],watch:'Margin squeezed by coal price (−22% vs plan) despite record volume.'},
 {id:'antam',nm:'Antam',tic:'ANTM',sec:'Ni · Au · Bauxite',cm:'nickel',frev:69.2,frevP:50,febitda:6.5,febitdaP:7.4,fnp:3.6,fnpP:3.2,rag:'green',fdrv:'record gold trade; nickel soft',margin:10,quart:4,ebScale:12,st:'green',own:'IDX: ANTM · MIND ID 65%',ops:[{l:'Ferronickel',v:'20,103 TNi',d:'below 22.5k target'},{l:'Gold sold',v:'43.8 t',d:'record 1.41 Moz trade'},{l:'Gold revenue',v:'Rp 57.6 T',d:'+120% — drove top line'},{l:'Ni cost-curve',v:'Q4',d:'RKEF FeNi high-cost'}],watch:'Record revenue is gold-trading-driven; nickel economics soft & high-cost.'},
 {id:'inalum',nm:'Inalum',tic:'—',sec:'Aluminium',cm:'alu',frev:11.4,frevP:11,febitda:4.0,febitdaP:3.6,fnp:2.0,fnpP:1.5,rag:'green',fdrv:'low-cost hydro; vol +27%',margin:26,quart:1,ebScale:18,st:'green',own:'Unlisted · MIND ID 100%',ops:[{l:'Aluminium',v:'274 kt',d:'+27%; target ~900 kt'},{l:'Specific energy',v:'~14,000',d:'DC kWh/t'},{l:'Captive power',v:'~603 MW',d:'Asahan hydro — low-carbon'},{l:'Cost-curve',v:'Q1',d:'first-quartile resilience'}],watch:'Structurally advantaged (hydro, low carbon). EBITDA +213%. Watch growth execution.'},
 {id:'timah',nm:'Timah',tic:'TINS',sec:'Tin',cm:'tin',frev:10.9,frevP:9.5,febitda:1.3,febitdaP:1.0,fnp:1.2,fnpP:0.6,rag:'green',fdrv:'turnaround on price +17%',margin:16,quart:3,ebScale:8,st:'amber',own:'IDX: TINS · MIND ID 65%',ops:[{l:'Refined tin',v:'18,915 t',d:'+23% YoY'},{l:'Realized',v:'$31,181/t',d:'+17% YoY'},{l:'Net profit',v:'Rp 1.19 T',d:'+364% — reversed loss'},{l:'Reserve life',v:'<15 yr',d:'depletion the watch'}],watch:'Genuine turnaround, but tin is volatile and reserve life is the structural watch.'},
],
 commod: [
 {id:'coalhba',n:'Coal HBA',px:117,u:'/t',d:-1.4,sub:'ptba',sn:'Bukit Asam'},
 {id:'coalnew',n:'Coal Newc.',px:124,u:'/t',d:-0.8,sub:'ptba',sn:'Bukit Asam'},
 {id:'gold',n:'Gold',px:2335,u:'/oz',d:1.0,sub:'antam',sn:'Antam'},
 {id:'nickel',n:'Nickel LME',px:16578,u:'/t',d:-0.5,sub:'antam',sn:'Antam'},
 {id:'nickelore',n:'Nickel ore',px:52,u:'/wmt',d:-0.6,sub:'antam',sn:'Antam'},
 {id:'alu',n:'Alum. LME',px:2426,u:'/t',d:0.6,sub:'inalum',sn:'Inalum'},
 {id:'alumina',n:'Alumina',px:382,u:'/t',d:1.6,sub:'inalum',sn:'Inalum'},
 {id:'tin',n:'Tin LME',px:31189,u:'/t',d:-0.5,sub:'timah',sn:'Timah'},
 {id:'copper',n:'Copper LME',px:9675,u:'/t',d:-0.4,sub:'ptfi',sn:'Freeport',jv:1},
 {id:'bauxite',n:'Bauxite',px:57,u:'/t',d:0.5,sub:'antam',sn:'Antam'},
 {id:'idr',n:'USD / IDR',px:16000,u:'',d:0.0,sub:null,sn:null},
],
 kpi: [
 {l:'Revenue',a:145.2,p:132,y:107.9,q:[32.5,35.0,37.5,40.2],n:'Beat plan — on <b>gold trading</b>, not core mining.',flag:'⚠ low-margin trade'},
 {l:'EBITDA',a:40.5,p:45,y:36.8,q:[12.2,10.8,9.3,8.2],n:'Margin squeeze, <b>not volume</b>.',hero:1,margin:'Margin 34.1% → 27.9% · −6.2 pts'},
 {l:'Net profit',a:36.5,p:41,y:33.9,q:[10.8,9.6,8.4,7.7],n:'Feeds the <b>dividend &amp; State</b>.'},
 {l:'Free cash flow',a:18.0,p:22,y:20.5,q:[5.6,3.2,4.4,4.8],n:'Lower earnings + <b>Manyar/SGAR</b> capex.'},
 {l:'To State',a:90.4,p:88,y:82.1,q:[21.4,22.3,23.2,23.5],n:'<b>Royalty up</b> on PP19/2025.'}],
 ev: {ptba:-3.0,ptfi:-1.3,antam:-0.9,inalum:0.4,timah:0.3},
 subev: [{id:'ptba',l:'Bukit Asam',sub:'coal price'},{id:'ptfi',l:'Freeport',sub:'grade + force majeure'},{id:'antam',l:'Antam',sub:'nickel, net of gold'},{id:'inalum',l:'Inalum',sub:'+27% volume'},{id:'timah',l:'Timah',sub:'price turnaround'}],
 capalloc: [
 {l:'EBITDA',v:40.5,t:'b',sub:'group · vs RKAP 45'},
 {l:'Tax & interest',v:-9.0,sub:'cash tax + finance'},
 {l:'Working capital',v:-2.0,sub:'inventory + AR'},
 {l:'Sustaining capex',v:-11.5,sub:'maintain assets'},
 {l:'Free cash flow',v:18.0,t:'s',sub:'vs RKAP 22'},
 {l:'Growth capex',v:-12.0,sub:'Manyar · SGAR',col:'#9C6644'},
 {l:'Net debt drawn',v:5.0,sub:'funds the gap',col:'#7C766B'},
 {l:'Dividends',v:-9.0,sub:'State + minorities'},
 {l:'Net cash Δ',v:2.0,t:'a',sub:'retained'},
],
 ret: [
 {nm:'Freeport',ce:170,roic:14,wacc:10},
 {nm:'Inalum',ce:28,roic:11,wacc:9},
 {nm:'Timah',ce:8,roic:10,wacc:12},
 {nm:'Bukit Asam',ce:22,roic:9,wacc:12},
 {nm:'Antam',ce:40,roic:8,wacc:11},
],
 chist: [
 {y:'FY20',sus:9.0,div:7.0,grw:4.0},
 {y:'FY21',sus:9.5,div:8.0,grw:6.0},
 {y:'FY22',sus:10.0,div:11.0,grw:8.0},
 {y:'FY23',sus:11.0,div:10.0,grw:10.0},
 {y:'FY24',sus:11.5,div:9.0,grw:12.0},
],
 pipe: [
 {nm:'Manyar Cu smelter',own:'PTFI · Gresik',cap:5.5,pct:95,prod:'2024',irr:14},
 {nm:'SGAR alumina Ph.1',own:'Inalum/Antam',cap:3.5,pct:85,prod:'2025',irr:13},
 {nm:'Grasberg underground',own:'PTFI · block cave',cap:2.0,pct:70,prod:'ramp',irr:null},
 {nm:'Smelters · debottleneck',own:'Antam · Timah',cap:1.0,pct:55,prod:'’25–26',irr:12},
],
 ckpi: [
 {l:'Operating cash',a:29.5,p:31,u:'Rp T',q:[6.8,7.2,7.6,7.9],gd:'up',n:'EBITDA less tax & working capital.'},
 {l:'Free cash flow',a:18.0,p:22,u:'Rp T',q:[5.6,3.2,4.4,4.8],gd:'up',n:'Post-sustaining capex — below plan.'},
 {l:'Growth capex',a:12.0,p:10,u:'Rp T',q:[2.4,3.0,3.2,3.4],gd:'flat',n:'Manyar + SGAR — the build, ramping.'},
 {l:'Dividend paid',a:9.0,p:9.5,u:'Rp T',q:[2.1,2.2,2.3,2.4],gd:'flat',n:'To the State & minorities.'},
 {l:'Net debt / EBITDA',a:0.8,p:0.7,u:'×',dec:1,q:[0.55,0.6,0.7,0.8],gd:'down',n:'Rose on the draw; headroom to ~2.0×.'},
],
 ops: [
 {id:'ptfi',deliver:89,dv:'Grasberg mud rush',ltifr:0.42,fatal:0,life:25,ost:'fm',oq:[97,95,91,89]},
 {id:'ptba',deliver:101,dv:'record 43.3 Mt',ltifr:0.55,fatal:0,life:18,ost:'run',oq:[96,99,102,101]},
 {id:'antam',deliver:89,dv:'FeNi 20.1k / 22.5k TNi',ltifr:0.38,fatal:0,life:20,ost:'con',oq:[93,91,90,89]},
 {id:'inalum',deliver:127,dv:'+27% volume',ltifr:0.30,fatal:0,life:null,lifeNote:'smelter · feedstock-based',ost:'run',oq:[108,115,121,127]},
 {id:'timah',deliver:123,dv:'+23% refined tin',ltifr:0.61,fatal:0,life:14,ost:'run',oq:[104,112,118,123]},
],
 ohealth: [
 {id:'ptfi',ev:'Grasberg mud rush · Sep-2025',im:'2026 output ~−35%; ramp recovery through the year',st:'fm'},
 {id:'antam',ev:'RKEF FeNi below nameplate',im:'20.1k of 22.5k TNi; high-cost, curtailment under review',st:'con'},
 {id:'ptba',ev:'Record production',im:'43.3 Mt; strip ratio beat 6.23× vs 6.44×',st:'run'},
 {id:'inalum',ev:'Smelter ramp',im:'+27% volume toward ~900 kt; captive hydro',st:'run'},
 {id:'timah',ev:'Refined tin +23%',im:'operating well; <15-yr reserve life the structural watch',st:'run'},
],
 obuild: [
 {p:'Manyar Cu smelter',own:'Freeport · Gresik',pct:95,prod:'2024',st:'Commissioning'},
 {p:'SGAR alumina Ph.1',own:'Inalum/Antam · Mempawah',pct:85,prod:'2025',st:'Construction'},
 {p:'Grasberg underground',own:'Freeport · block cave',pct:70,prod:'ramping',st:'Ramp-up'},
 {p:'Smelters · debottleneck',own:'Antam · Timah',pct:55,prod:'’25–26',st:'In progress'},
],
 proj: [
 {id:'manyar',nm:'Manyar copper smelter',co:'Freeport',jv:1,stage:'Commissioning',gate:5,gates:6,budget:58,committed:57,spent:55,eac:60,pctP:98,pctA:95,fpS:2024,fpF:2024,spi:0.97,cpi:0.93,benCap:'600 kt Cu cathode',irrS:14,irrC:13,benSt:'ontrack',risk:'Commissioning ramp slower than plan; concentrate & acid logistics.',ragC:'a',ragS:'g',ragB:'g'},
 {id:'sgar1',nm:'SGAR alumina Ph.1',co:'Inalum/Antam',jv:0,stage:'Construction',gate:4,gates:6,budget:15,committed:13,spent:11,eac:16,pctP:88,pctA:85,fpS:2025,fpF:2025,spi:0.96,cpi:0.94,benCap:'1.0 Mtpa alumina',irrS:13,irrC:12,benSt:'ontrack',risk:'EPC labour availability + monsoon schedule pressure.',ragC:'a',ragS:'a',ragB:'g'},
 {id:'sgar2',nm:'SGAR alumina Ph.2',co:'Inalum/Antam',jv:0,stage:'FEED',gate:2,gates:6,budget:16,committed:2,spent:1,eac:16,pctP:8,pctA:8,fpS:2027,fpF:2027,spi:1.00,cpi:1.00,benCap:'+1.0 Mtpa alumina',irrS:13,irrC:13,benSt:'ontrack',risk:'FID pending; bauxite feedstock security.',ragC:'g',ragS:'g',ragB:'g'},
 {id:'grasberg',nm:'Grasberg underground',co:'Freeport',jv:1,stage:'Ramp-up',gate:5,gates:6,budget:40,committed:38,spent:34,eac:41,pctP:80,pctA:74,fpS:2023,fpF:2024,spi:0.93,cpi:0.98,benCap:'sustain ~1.6 Blb Cu',irrS:20,irrC:18,benSt:'atrisk',risk:'Sep-2025 mud rush — 2026 output ~−35%, ramp recovery through the year.',ragC:'g',ragS:'a',ragB:'a'},
 {id:'inalumx',nm:'Inalum smelter expansion',co:'Inalum',jv:0,stage:'Construction',gate:4,gates:6,budget:12,committed:8,spent:5,eac:12,pctP:45,pctA:44,fpS:2026,fpF:2026,spi:0.98,cpi:1.00,benCap:'→ ~900 kt aluminium',irrS:12,irrC:12,benSt:'ontrack',risk:'Captive power supply for the new pot line.',ragC:'g',ragS:'g',ragB:'g'},
 {id:'halmahera',nm:'Antam Halmahera nickel',co:'Antam',jv:0,stage:'Construction',gate:4,gates:6,budget:10,committed:9,spent:8,eac:12.5,pctP:70,pctA:55,fpS:2025,fpF:2026,spi:0.79,cpi:0.80,benCap:'FeNi / MHP lines',irrS:12,irrC:8,benSt:'atrisk',risk:'~Rp 2.5T overrun + ~12-month slip; high-cost RKEF economics under soft nickel.',ragC:'r',ragS:'r',ragB:'a'},
 {id:'dme',nm:'PTBA coal-to-DME',co:'Bukit Asam',jv:0,stage:'FEED · on hold',gate:2,gates:6,budget:33,committed:3,spent:2,eac:33,pctP:35,pctA:12,fpS:2027,fpF:0,spi:0.34,cpi:1.00,benCap:'1.4 Mtpa DME',irrS:10,irrC:4,benSt:'eroded',risk:'Technology partner exit; economics eroded vs LPG import parity — effectively stalled.',ragC:'a',ragS:'r',ragB:'r'},
 {id:'ptbare',nm:'PTBA renewables & power',co:'Bukit Asam',jv:0,stage:'Construction',gate:4,gates:6,budget:4,committed:3,spent:2,eac:4,pctP:60,pctA:58,fpS:2025,fpF:2025,spi:0.97,cpi:1.00,benCap:'~200 MW RE + solar',irrS:11,irrC:11,benSt:'ontrack',risk:'Grid interconnection & land acquisition.',ragC:'g',ragS:'g',ragB:'g'},
 {id:'timahtsl',nm:'Timah TSL furnace upgrade',co:'Timah',jv:0,stage:'Commissioning',gate:5,gates:6,budget:3,committed:3,spent:2.8,eac:3.1,pctP:95,pctA:92,fpS:2025,fpF:2025,spi:0.97,cpi:0.97,benCap:'modern low-cost tin smelting',irrS:12,irrC:12,benSt:'ontrack',risk:'Commissioning; feed-grade variability.',ragC:'g',ragS:'a',ragB:'g'},
 {id:'battery',nm:'Battery materials / HPAL',co:'MIND ID JV',jv:1,stage:'FEED',gate:2,gates:6,budget:20,committed:4,spent:2,eac:20,pctP:15,pctA:14,fpS:2028,fpF:2028,spi:0.93,cpi:1.00,benCap:'precursor / pCAM',irrS:15,irrC:14,benSt:'atrisk',risk:'Offtake commitments & partner alignment on the EV supply chain.',ragC:'g',ragS:'a',ragB:'a'},
],
 pmeta: {
 manyar:{type:'smelter',x:198.8,y:146.3,place:'Gresik, East Java',epc:'Chiyoda–PP',escore:4.1},
 sgar1:{type:'refinery',x:157.9,y:62.8,place:'Mempawah, W. Kalimantan',epc:'Chalieco (MCC)',escore:3.6},
 sgar2:{type:'refinery',x:150.5,y:64.6,place:'Mempawah, W. Kalimantan',epc:'FID pending',escore:3.4},
 grasberg:{type:'mine',x:470.4,y:111.9,place:'Tembagapura, Papua',epc:'PTFI in-house',escore:4.0},
 inalumx:{type:'smelter',x:51.9,y:29.4,place:'Kuala Tanjung, N. Sumatra',epc:'CHALCO / local',escore:3.8},
 halmahera:{type:'downstream',x:368.1,y:60.8,place:'Halmahera, N. Maluku',epc:'Lygend JV',escore:3.0},
 dme:{type:'downstream',x:100.5,y:108,place:'Tanjung Enim, S. Sumatra',epc:'Air Products (exited)',escore:2.4},
 ptbare:{type:'power',x:108.6,y:108.1,place:'Tanjung Enim, S. Sumatra',epc:'Local EPC',escore:3.7},
 timahtsl:{type:'smelter',x:126.1,y:90.6,place:'Bangka Island',epc:'Metso Outotec',escore:4.2},
 battery:{type:'downstream',x:302.6,y:99.1,place:'Morowali, C. Sulawesi',epc:'CATL consortium',escore:3.3},
},

 /* ── Stage 2 · FORECAST — driver-based projection inputs (transparent model, no ML) ── */
 forecast:{
  planFY25:44.0, planFY26:47.0,                       // RKAP EBITDA plans
  histQ:[12.2,10.8,9.3,8.2],                          // FY24 actual quarterly EBITDA
  quarters:['Q1-25','Q2-25','Q3-25','Q4-25','Q1-26','Q2-26','Q3-26','Q4-26'],
  // commodity forward paths — % vs FY24 exit price, per quarter (fx: + = weaker IDR)
  fwd:{coal:[-2,-4,-5,-6,-6,-5,-4,-3],nickel:[1,3,5,7,9,10,11,12],copper:[2,4,6,8,9,10,11,12],gold:[3,5,6,7,7,8,8,9],alu:[1,2,3,4,5,5,6,6],tin:[0,1,2,3,3,4,4,5],fx:[1,2,2,3,3,4,4,4]},
  // per-subsidiary quarterly EBITDA base (FY24 avg, Rp T) · price beta · gold beta · volume path (Grasberg FM profile in ptfi)
  paths:[
   {id:'ptfi',base:5.33,cm:'copper',beta:1.5,gbeta:0.4,vol:[0.99,0.97,0.92,0.84,0.68,0.74,0.84,0.94]},
   {id:'ptba',base:1.85,cm:'coal',beta:2.2,gbeta:0,vol:[1.00,1.00,1.01,1.01,1.02,1.02,1.02,1.02]},
   {id:'antam',base:1.63,cm:'nickel',beta:1.8,gbeta:0.5,vol:[0.97,0.97,0.98,0.99,1.00,1.02,1.04,1.05]},
   {id:'inalum',base:1.00,cm:'alu',beta:1.4,gbeta:0,vol:[1.04,1.07,1.10,1.13,1.16,1.20,1.24,1.28]},
   {id:'timah',base:0.33,cm:'tin',beta:1.5,gbeta:0,vol:[1.02,1.03,1.03,1.04,1.04,1.05,1.05,1.06]},
  ],
  fxBeta:0.25, volQ:0.045,                            // FX sensitivity · quarterly vol for the P10/P90 band
  belowEbitda:{taxInt:9.0,workingCap:1.0,sustaining:11.5}, // annual, to derive FCF
  divBase:9.0, growthCapexFY25:10.0, netDebt0:32.4,
 },
 /* ── Stage 3 · STRESS — correlated shock library (applied on top of forward curves) ── */
 scenarios:[
  {id:'coalcrash',nm:'Coal downturn',sub:'HBA/ICI −25%',sh:{coal:-25}},
  {id:'nickelglut',nm:'Nickel glut',sub:'LME −30% on supply wave',sh:{nickel:-30}},
  {id:'china',nm:'China slowdown',sub:'correlated demand shock',sh:{coal:-25,nickel:-20,copper:-15,alu:-12,tin:-10,fx:5}},
  {id:'idr',nm:'IDR shock',sub:'rupiah −12% (exporters partly hedge)',sh:{fx:12,coal:-5}},
  {id:'goldspike',nm:'Gold +20%',sub:'upside · safe-haven bid',sh:{gold:20,copper:5}},
  {id:'combined',nm:'Combined downside',sub:'China + credit + energy, correlated',sh:{coal:-30,nickel:-25,copper:-20,alu:-15,tin:-15,gold:8,fx:10}},
 ],
 /* ── Stage 4 · ALLOCATE — capital-move options vs hurdle rates ── */
 allocate:{
  costOfDebt:7.0, comfortLeverage:2.0,
  options:[
   {id:'sgar2',nm:'Fund SGAR alumina Ph.2 (FID)',type:'reinvest',capital:8,irr:13,hurdle:9.5,co:'Inalum/Antam',note:'import substitution; FEED done, FID-ready'},
   {id:'battery',nm:'Battery / HPAL JV top-up',type:'reinvest',capital:6,irr:15,hurdle:11,co:'MIND ID JV',note:'EV-chain optionality; partner & offtake gated'},
   {id:'halmahera',nm:'Halmahera completion capital',type:'fix',capital:2.5,irr:8,hurdle:11,co:'Antam',note:'finish-vs-pause; Rp 8T sunk, IRR below hurdle'},
   {id:'debt',nm:'Repay the Rp 5T revolver draw',type:'deleverage',capital:5,irr:7,hurdle:7,co:'Holding',note:'saves ~Rp 0.35T/yr interest; protects dividend cover'},
   {id:'divup',nm:'Dividend step-up (+Rp 2T)',type:'return',capital:2,irr:0,hurdle:0,co:'to State',note:'meets State expectation; consumes downside buffer'},
  ],
 },
 /* ── Decision log — prescriptions become tracked actions (closes the loop) ── */
 decisions:[
  {mv:'Hedge 40% of FY25 seaborne coal price',own:'Group Treasury',src:'Stress · coal downturn',due:'Q3-25',st:1},
  {mv:'Anchor FY25 dividend at the P10 cash floor',own:'CFO · Investment Committee',src:'Forecast · funding need',due:'Q3-25',st:0},
  {mv:'Pre-position Grasberg contingency before dividend cycle',own:'PMO · PTFI',src:'Operations · force majeure',due:'now',st:2},
  {mv:'Halmahera finish-vs-pause review to the IC',own:'Investment Committee',src:'Projects · CPI/SPI breach',due:'Q3-25',st:0},
  {mv:'FID decision — SGAR alumina Ph.2',own:'BOD',src:'Allocate · ranked #1 move',due:'Q4-25',st:0},
  {mv:'Engage ESDM on PP19/2025 royalty & DMO mix',own:'Gov Relations',src:'Financials · cost step-up',due:'H2-25',st:1},
 ],
};
