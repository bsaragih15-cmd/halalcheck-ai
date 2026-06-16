/* OreSight AI — reusable guided-tour engine.
   Drop-in: <script src="/js/tour.js"></script> then
   OreTour.init({ label:'Guided tour', steps:[{sel,title,text,before?}, ...] });
   Injects a floating "Guided tour" button + a spotlight walkthrough.
   Steps whose selector is missing are skipped gracefully. */
(function () {
  if (window.OreTour) return;
  var css = ''
    + '.oretour-btn{position:fixed;left:16px;bottom:16px;z-index:3000;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;font-weight:700;border:1px solid #0f5c2c;background:#15803d;color:#fff;border-radius:22px;padding:8px 14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2);display:inline-flex;align-items:center;gap:6px}'
    + '.oretour-btn:hover{background:#1a9648}'
    + '.oretour-hl{position:fixed;z-index:3001;border:2px solid #5dd08a;border-radius:10px;box-shadow:0 0 0 9999px rgba(13,22,16,.55);pointer-events:none;transition:top .25s,left .25s,width .25s,height .25s}'
    + '.oretour-pop{position:fixed;z-index:3002;width:312px;max-width:92vw;background:#fbfaf6;border:1px solid #d8d4c7;border-radius:10px;box-shadow:0 14px 36px rgba(0,0,0,.26);padding:13px 15px;font-family:"Inter",system-ui,-apple-system,sans-serif;color:#1b231a}'
    + '.oretour-pop .tt{font-weight:800;font-size:15px;margin-bottom:5px;color:#0f5c2c;line-height:1.25}'
    + '.oretour-pop .tx{font-size:13px;color:#6b7464;line-height:1.45}'
    + '.oretour-pop .tr{display:flex;align-items:center;gap:8px;margin-top:12px}'
    + '.oretour-pop .tstep{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;color:#8a9282}'
    + '.oretour-pop .tsp{flex:1}'
    + '.oretour-pop button{font-size:12.5px;font-weight:600;border-radius:6px;padding:5px 11px;cursor:pointer;border:1px solid #d8d4c7;background:#f0eee6;color:#1b231a;font-family:inherit}'
    + '.oretour-pop button.prim{background:#15803d;border-color:#15803d;color:#fff}'
    + '.oretour-pop .tskip{border:none;background:none;color:#8a9282;font-weight:500;padding:5px 3px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var steps = [], i = -1, hl, pop;
  function build() {
    if (hl) return;
    hl = document.createElement('div'); hl.className = 'oretour-hl'; hl.style.display = 'none'; document.body.appendChild(hl);
    pop = document.createElement('div'); pop.className = 'oretour-pop'; pop.style.display = 'none'; document.body.appendChild(pop);
  }
  function present(s) { var e = s && document.querySelector(s.sel); return e && e.getBoundingClientRect().width > 0; }
  function position() {
    if (i < 0) return; var e = document.querySelector(steps[i].sel);
    if (!e) { return advance(1); }
    var r = e.getBoundingClientRect(), pad = 6;
    hl.style.display = 'block';
    hl.style.top = (r.top - pad) + 'px'; hl.style.left = (r.left - pad) + 'px';
    hl.style.width = (r.width + 2 * pad) + 'px'; hl.style.height = (r.height + 2 * pad) + 'px';
    pop.style.display = 'block';
    var pw = pop.offsetWidth || 312, ph = pop.offsetHeight || 150, vw = window.innerWidth, vh = window.innerHeight;
    var top = r.bottom + 12; if (top + ph > vh - 10) top = Math.max(10, r.top - ph - 12);
    var left = Math.min(Math.max(10, r.left + r.width / 2 - pw / 2), vw - pw - 10);
    pop.style.top = top + 'px'; pop.style.left = left + 'px';
  }
  function render() {
    var s = steps[i];
    pop.innerHTML = '<div class="tt">' + s.title + '</div><div class="tx">' + s.text + '</div>'
      + '<div class="tr"><span class="tstep">' + (i + 1) + ' / ' + steps.length + '</span><span class="tsp"></span>'
      + '<button class="tskip" data-a="skip">Skip</button>'
      + (i > 0 ? '<button data-a="prev">Back</button>' : '')
      + '<button class="prim" data-a="next">' + (i === steps.length - 1 ? 'Done' : 'Next →') + '</button></div>';
    pop.querySelector('[data-a=next]').onclick = function () { i === steps.length - 1 ? end() : go(i + 1); };
    pop.querySelector('[data-a=skip]').onclick = end;
    var pv = pop.querySelector('[data-a=prev]'); if (pv) pv.onclick = function () { go(i - 1); };
    position(); setTimeout(position, 260);
  }
  function go(n) { i = n; var s = steps[i]; if (s && s.before) { try { s.before(); } catch (e) {} } setTimeout(render, (s && s.before) ? 220 : 0); }
  function advance(d) { var n = i + d; if (n < 0 || n >= steps.length) return end(); go(n); }
  function start() { build(); var f = steps.findIndex(present); go(f < 0 ? 0 : f); window.addEventListener('resize', position); window.addEventListener('keydown', esc); }
  function end() { i = -1; if (hl) hl.style.display = 'none'; if (pop) pop.style.display = 'none'; window.removeEventListener('resize', position); window.removeEventListener('keydown', esc); }
  function esc(e) { if (e.key === 'Escape') end(); }

  window.OreTour = {
    init: function (opts) {
      steps = (opts && opts.steps) || [];
      var label = (opts && opts.label) || 'Guided tour';
      if (!(opts && opts.noButton)) {
        var b = document.createElement('button'); b.className = 'oretour-btn'; b.innerHTML = '▶ ' + label;
        b.onclick = start; document.body.appendChild(b);
      }
      window.OreTour.start = start; window.OreTour.end = end;
    }
  };
})();
