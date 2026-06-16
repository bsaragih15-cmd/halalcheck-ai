/* Marketing Optimiser — shared interactive logic (light-theme prototypes).
   Drives the clock, animated parcels, objective × strategy optimiser,
   spot/contract mix dial and disruption re-allocation. Element lookups are
   guarded so the same script powers all three layout variants. */
(function () {
  const $ = (id) => document.getElementById(id);

  // clock (WITA)
  const clockEl = $('clock');
  function tick() {
    if (!clockEl) return;
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    clockEl.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  tick();
  setInterval(tick, 1000);

  // animate parcels along lanes
  [
    { el: 'p1', from: [200, 152], to: [360, 228], dur: 5200 },
    { el: 'p2', from: [300, 205], to: [150, 150], dur: 6000 },
    { el: 'p3', from: [230, 362], to: [360, 258], dur: 6400 },
    { el: 'p4', from: [560, 178], to: [660, 170], dur: 4600 },
  ].forEach((p) => {
    const node = $(p.el);
    if (!node) return;
    let start = null;
    function frame(t) {
      if (!start) start = t;
      const k = ((t - start) % p.dur) / p.dur;
      const x = p.from[0] + (p.to[0] - p.from[0]) * k;
      const y = p.from[1] + (p.to[1] - p.from[1]) * k;
      node.style.left = (x / 1000 * 100) + '%';
      node.style.top = y + 'px';
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });

  // ── state-driven optimiser: objective × contracting strategy ──
  const state = { obj: 'netback', strat: 'balanced', mix: 72, bindDenom: 't sap' };

  const stratBase = {
    balanced: { opt: 81.2, yr: 4.2, cargo: 74, mix: 72 },
    lock: { opt: 79.8, yr: 3.6, cargo: 66, mix: 88 },
    spot: { opt: 83.2, yr: 4.7, cargo: 86, mix: 52 },
  };
  const objAdj = {
    netback: { dOpt: 0, mYr: 1.00, unit: '$/wmt' },
    revenue: { dOpt: 2.4, mYr: 1.28, unit: '$/wmt gross' },
    constraint: { dOpt: -0.9, mYr: 1.08, unit: '$/wmt' },
    riskadj: { dOpt: -2.3, mYr: 0.90, unit: '$/wmt' },
  };
  const A = (pill, cls, id, desc, crd, delta, zero) => ({ pill, cls, id, desc, crd, delta, zero });
  const objMeta = {
    netback: {
      cap: '· netback-ranked',
      note: '<b>Netback to mine gate</b> — revenue less freight, TC/RC, royalty &amp; penalties. The marketing-native objective; balances price capture against cost-to-serve.',
      lead: (o) => 'Netback <em>' + o + ' $/wmt</em> vs 70.83 HPM floor — capturing premium net of cost-to-serve — optimiser holds margin with spec headroom.',
      narr: 'Optimising <b>netback to mine gate</b>: every cargo is ranked on price less freight, treatment charges, the grade-linked PNBP royalty and penalties. The book stays balanced at blend 1.00, ~7.6 $/wmt above the HPM floor, with the limonite parcel held for the acid-tight HPAL window.',
      acts: [A('BLEND', 'blend', 'Cargo C-14', 'Lift MgO toward 2.0 to raise payable Ni', 'rolling', '+0.0', true),
        A('HOLD', 'hold', 'LIM-1', 'Hold limonite parcel for HPAL premium window', '6h', '+0.3'),
        A('ALLOCATE', 'alloc', 'SAP-1', 'Re-allocate 8 kt saprolite NPI → matte customer', 'now', '+0.4')],
    },
    revenue: {
      cap: '· top-line-ranked',
      note: '<b>Revenue / top line</b> — maximise price × volume, ignoring cost-to-serve. Pushes spot &amp; volume; <b>margin runs ~$0.7M below netback</b> on freight + penalties.',
      lead: (o) => 'Top-line mode — realised <em>' + o + ' $/wmt gross</em>, chasing peak premium and volume. Margin trails netback; use only when cash-in, not margin, is the goal.',
      narr: 'Optimising <b>revenue</b>: the solver pushes the highest-premium spot stainless and lifts MHP volume regardless of cost-to-serve. Top line climbs, but distant-port freight and a +0.5 spec penalty erode margin by ~$0.7M versus the netback plan — a deliberate volume-over-margin call.',
      acts: [A('ALLOCATE', 'alloc', 'Spot pool', 'Push 12 kt to peak-premium spot stainless', 'now', '+1.9'),
        A('BLEND', 'blend', 'Cargo C-19', 'Max-volume blend, accept +0.5 penalty', 'rolling', '+1.1'),
        A('HOLD', 'hold', 'Matte slack', 'Defer matte nomination, reopen to spot', '8h', '+0.6')],
    },
    constraint: {
      cap: '· margin-per-constraint',
      note: '<b>Margin per tonne of the binding constraint</b> — saprolite supply today. Result: <b>lock the cheap tonnes, sell the scarce grade to spot.</b>',
      lead: (o) => 'Per-constraint mode — maximising margin on each tonne of the <em>binding</em> resource. Net realisation ' + o + ' $/wmt, but the routing flips toward scarce-grade spot.',
      narr: 'Optimising <b>margin per tonne of saprolite</b> (the binding constraint): the solver values the scarce high-grade ore at its shadow price, so it <b>sells the 1.9% saprolite to spot</b> rather than locking it cheap, and contracts the low-grade and limonite tonnes instead. Counter-intuitive but correct — it banks the constraint\'s opportunity value.',
      acts: [A('SPOT', 'alloc', 'SAP-1 hi-grade', 'Sell scarce 1.9% saprolite to spot, not contract', 'now', '+0.6'),
        A('CONTRACT', 'hold', 'Low-grade + LIM', 'Lock low-grade & limonite tonnes on offtake', '—', '+0.2'),
        A('ROUTE', 'blend', 'Avoid acid', 'Favour RKEF cargoes while acid binds', 'rolling', '+0.3')],
    },
    riskadj: {
      cap: '· floor-secured',
      note: '<b>Risk-adjusted margin</b> — maximise expected margin subject to a revenue floor. Trades premium for certainty; <b>revenue-at-risk −38%.</b>',
      lead: (o) => 'Risk-adjusted — realised <em>' + o + ' $/wmt</em>, premium traded for a secured floor. Best when covenants or cash cover demand revenue certainty.',
      narr: 'Optimising <b>risk-adjusted margin</b>: the solver caps spot exposure and hedges QP M+1 to hold a revenue floor that covers cash opex. Expected realisation steps down, but revenue-at-risk falls ~38% — the right call into volatile windows or when financing covenants require certainty.',
      acts: [A('CONTRACT', 'alloc', 'Tsingshan +', 'Extend NPI offtake +10 kt, lock the floor', 'now', '+0.0', true),
        A('HEDGE', 'hold', 'QP M+1', 'Hedge 60% of spot exposure on LME', 'now', '−0.2'),
        A('HOLD', 'blend', 'Spot cap', 'Cap spot at 16% of book', 'now', '+0.0', true)],
    },
  };

  function fmtPrem(mix) { const p = Math.round((1500 + (100 - mix) * 16) / 10) * 10; return '$' + p.toLocaleString(); }

  function renderMix() {
    const c = state.mix, s = 100 - c;
    if ($('mixC')) { $('mixC').style.width = c + '%'; $('mixC').textContent = 'CONTRACT ' + c + '%'; }
    if ($('mixS')) $('mixS').textContent = 'SPOT ' + s + '%';
    if ($('premV')) $('premV').innerHTML = fmtPrem(c) + '<span style="font-size:10px;color:#9aa091">/wmt</span>';
    const cover = Math.min(98, c + 12);
    if ($('coverV')) $('coverV').textContent = cover + '%';
    const tag = $('safeTag');
    if (tag) {
      if (c > 82) { tag.className = 'safetag warn'; tag.innerHTML = '⚠ Contracted ' + c + '% &gt; P90 supply (82%) — cover-buying risk if mine plan slips'; }
      else { tag.className = 'safetag ok'; tag.innerHTML = '✓ Within P90 supply cover — no over-contract risk'; }
    }
  }

  function render() {
    const b = stratBase[state.strat] || stratBase.balanced;
    const adj = objAdj[state.obj], m = objMeta[state.obj];
    const opt = (b.opt + adj.dOpt).toFixed(1);
    if ($('optVal')) $('optVal').innerHTML = opt + '<span class="u">' + adj.unit + '</span>';
    if ($('valYr')) $('valYr').textContent = '$' + (b.yr * adj.mYr).toFixed(1) + 'M';
    if ($('aiLead')) $('aiLead').innerHTML = m.lead(opt);
    if ($('objNote')) $('objNote').innerHTML = m.note;
    if ($('narr')) $('narr').innerHTML = m.narr;
    if ($('actCap')) $('actCap').textContent = m.cap;
    if ($('denomLab')) $('denomLab').textContent = state.bindDenom;
    if ($('cargoFill')) $('cargoFill').style.height = b.cargo + '%';
    if ($('cargoPct')) $('cargoPct').textContent = b.cargo + '%';
    if ($('actWrap')) $('actWrap').innerHTML = m.acts.map((a) =>
      '<div class="act"><span class="a-pill ' + a.cls + '">' + a.pill + '</span>' +
      '<div class="a-body"><div class="a-id">' + a.id + '</div><div class="a-desc">' + a.desc + ' <span class="crd">· ' + a.crd + '</span></div></div>' +
      '<div class="a-delta' + (a.zero ? ' zero' : '') + '">' + a.delta + ' $/wmt</div></div>').join('');
    document.querySelectorAll('#objSel button').forEach((x) => x.classList.toggle('on', x.dataset.o === state.obj));
    document.querySelectorAll('.strat').forEach((x) => x.classList.toggle('on', x.dataset.s === state.strat));
  }

  document.querySelectorAll('#objSel button').forEach((btn) => btn.addEventListener('click', () => { state.obj = btn.dataset.o; render(); }));
  document.querySelectorAll('.strat').forEach((s) => s.addEventListener('click', () => {
    state.strat = s.dataset.s; state.mix = stratBase[s.dataset.s].mix;
    if ($('mixSlider')) $('mixSlider').value = state.mix;
    renderMix(); render();
  }));
  if ($('mixSlider')) $('mixSlider').addEventListener('input', (e) => {
    state.mix = +e.target.value; state.strat = 'custom';
    document.querySelectorAll('.strat').forEach((x) => x.classList.remove('on'));
    renderMix();
  });
  renderMix(); render();

  // disruptions
  const DIS = {
    lme: '<b>LME −5% → $17.5k/t.</b> Payable capture slips to 0.89; optimiser pivots toward <b>contract-protected tonnes</b> and defers spot saprolite. Cobalt-rich limonite cushions realised by ~0.6 $/wmt. Recommend holding QP fixing for the rebound.',
    reject: '<b>Cargo rejected — MgO above 2.2 spec.</b> Re-blend SAP-1 with 12% limonite to pull MgO to 1.9; C-14 re-clears in 4h. Demurrage exposure $38k if laycan slips — prioritise blend over throughput now.',
    laycan: '<b>Vessel laycan slip 36h.</b> Stockpile cover still 11d, no starve risk. Optimiser re-sequences: load battery MHP cargo first, hold NPI parcel — preserves premium and avoids $52k demurrage.',
    acid: '<b>Sulphuric acid shortage — HPAL throughput −18%.</b> Binding constraint shifts to <b>HPAL acid</b>. Re-allocate limonite to stockpile, lift saprolite→NPI to defend offtake fill. MHP premium window deferred; realised holds at 77.9 $/wmt.',
  };
  function applyDis(txt) { if ($('narr')) $('narr').innerHTML = txt; }
  document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
    applyDis(DIS[c.dataset.d]);
    if (c.dataset.d === 'acid') {
      state.bindDenom = 'unit acid';
      if ($('bindName')) $('bindName').textContent = 'HPAL acid';
      if (state.obj === 'constraint' && $('denomLab')) $('denomLab').textContent = state.bindDenom;
    }
  }));
  if ($('disGo')) $('disGo').addEventListener('click', () => {
    const v = ($('disInput').value || '').trim();
    if (v) applyDis('<b>Re-dispatch · "' + v.replace(/</g, '&lt;') + '"</b> — optimiser re-solves the blend and allocation against current specs, offtake commitments and laycan windows, then re-ranks the recommended actions to defend realised price above the HPM floor.');
  });
  if ($('disInput')) $('disInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('disGo').click(); });
  if ($('disReset')) $('disReset').addEventListener('click', () => {
    if ($('disInput')) $('disInput').value = '';
    state.bindDenom = 't sap';
    if ($('bindName')) $('bindName').textContent = 'Saprolite supply';
    render();
  });
  document.querySelectorAll('.toggle button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.toggle button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
  }));
})();
