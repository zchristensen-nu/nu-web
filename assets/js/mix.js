/* mix.js: the shuffle pages (build/pages/el_home__mix.py, build/pages/_mixsplit.py). Each [data-mix-slot] holds every design of
   one section, the shown one without `hidden`. The page reads as one page: no chrome between sections. One small button sits in
   the window's corner and follows the section in view; it opens a panel with that section's designs (pick one, or step with
   previous / next), the count of changes, "Copy the list" and "Start over". While the panel is open, the section it acts on is
   outlined. Picks are kept in this browser (localStorage). A hero the header floats over (data-mix-over) keeps the header over
   it. Each design sits in its own wrapper, so section.css cannot see its neighbours: `seams` gives the edges between places the
   gaps the system gives siblings. Without script: the current page. */
(function () {
  var root = document.querySelector('[data-mix]');
  if (!root) return;
  var key = 'mix:' + root.getAttribute('data-mix');
  var slots = [].slice.call(document.querySelectorAll('[data-mix-slot]'));
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch (err) { saved = {}; }

  function opts(slot) { return [].slice.call(slot.querySelectorAll(':scope > [data-mix-opt]')); }
  function shown(slot) { return opts(slot).filter(function (o) { return !o.hidden; })[0]; }
  function name(slot) { return slot.getAttribute('data-mix-name'); }

  /* ---------- seams: the gaps section.css gives two sibling sections, across the wrappers ---------- */
  var GROUND = '[data-mode],.nu-section--sunken';
  function secs(slot) {
    var out = [];
    (function walk(el) { [].forEach.call(el.children, function (c) { if (c.classList.contains('nu-section')) out.push(c); else if (c.classList.contains('mx-wrap')) walk(c); }); })(shown(slot));
    return out;
  }
  var SEAM = ['mx-pb-0', 'mx-pb-gap', 'mx-ruled'];
  function seams() {   // classes of one-class weight (mix.css), so a component's own padding still wins, as on an assembled page
    slots.forEach(function (slot) { secs(slot).forEach(function (c) { c.classList.remove.apply(c.classList, SEAM); }); });
    slots.forEach(function (slot, n) {
      var mine = secs(slot), last = mine[mine.length - 1], next = n < slots.length - 1 ? secs(slots[n + 1])[0] : null;
      if (!last || !next) return;
      var lg = last.matches(GROUND), ng = next.matches(GROUND);
      var nFlushTop = next.matches('.nu-section--flush,.nu-section--flush-top,.nu-section--flush-stack');
      var lFlushBottom = last.matches('.nu-section--flush,.nu-section--flush-bottom');
      // the upper section's foot (section.css rules 1, 2, 4): nothing above a plain neighbour, the ground-edge gap above a ground
      var ground = function (el) { return el.getAttribute('data-mode') || (el.classList.contains('nu-section--sunken') ? 'sunken' : ''); };
      if (lFlushBottom) { /* keeps its 0 */ }
      else if (nFlushTop) last.classList.add('mx-pb-gap');
      else if (lg && ng && ground(last) === ground(next)) last.classList.add('mx-pb-0');   // one ground, one band (rule 5)
      else if (ng && !lg) last.classList.add('mx-pb-gap');                                 // a plain section above a ground (rule 4)
      else if (!lg && !ng) last.classList.add('mx-pb-0');
      // --ruled under a plain section: the chapter gap with its hairline midway (the "Ruled" rule)
      if (!lg && !ng && !lFlushBottom && !nFlushTop && next.matches('.nu-section--ruled')) next.classList.add('mx-ruled');
    });
  }

  /* ---------- showing a design ---------- */
  function over() {
    var on = shown(slots[0]).hasAttribute('data-mix-over'), top = document.querySelector('.st-top');
    if (top) top.classList.toggle('st-top--over', on);
    var a = document.querySelector('.nu-header-stack'), b = document.querySelector('.nu-global-header');
    if (a) a.classList.toggle('nu-header-stack--over-media', on);
    if (b) b.classList.toggle('nu-global-header--over-media', on);
  }
  function show(slot, pick, keep) {
    var list = opts(slot), next = list.filter(function (o) { return o.getAttribute('data-mix-opt') === pick; })[0];
    if (!next) return;
    var before = keep ? slot.getBoundingClientRect().top : 0;
    list.forEach(function (o) { o.hidden = o !== next; o.classList.remove('mx-on'); });
    if (slot === slots[0]) over();
    seams();
    if (keep) window.scrollBy(0, slot.getBoundingClientRect().top - before);
    window.dispatchEvent(new Event('resize'));   // patterns set up while hidden measure again
    var k = slot.getAttribute('data-mix-slot');
    if (pick === 'current') delete saved[k]; else saved[k] = pick;
    try { localStorage.setItem(key, JSON.stringify(saved)); } catch (err) { /* a private window: picks last the visit */ }
  }

  /* A final page (data-mix-final): one design per place, fixed. The seams still run; no saved picks, no control. */
  if (root.hasAttribute('data-mix-final')) { over(); seams(); return; }
  slots.forEach(function (slot) { var p = saved[slot.getAttribute('data-mix-slot')]; if (p) show(slot, p, false); });
  over(); seams();

  /* ---------- the control ---------- */
  var ICON = '<svg class="nu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h3.5c2.2 0 3.6 1 4.8 2.9l1.4 2.2c1.2 1.9 2.6 2.9 4.8 2.9H21M3 17h3.5c1.3 0 2.3-.4 3.1-1.1M14.4 8.1c.8-.7 1.8-1.1 3.1-1.1H21M18 4l3 3-3 3M18 14l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ui = document.createElement('div');
  ui.className = 'mx-ctl';
  ui.setAttribute('data-mode', 'dark');
  ui.innerHTML = '<div class="mx-panel" id="mx-panel" role="dialog" aria-labelledby="mx-panel-name" hidden>'
    + '<div class="mx-panel__head"><p class="mx-panel__name" id="mx-panel-name"></p><span class="mx-panel__count"></span></div>'
    + '<ul class="mx-panel__opts" role="list"></ul>'
    + '<div class="mx-panel__foot"><p class="mx-panel__note" role="status"></p>'
    + '<div class="mx-panel__acts"><button class="mx-link" type="button" data-copy>Copy the list</button><button class="mx-link" type="button" data-reset>Start over</button></div></div>'
    + '</div>'
    + '<div class="mx-bar"><button class="mx-tool" type="button" data-step="-1" aria-label="Previous design"><svg class="nu-icon" aria-hidden="true"><use href="#i-chevron-left"></use></svg></button>'
    + '<button class="mx-fab" type="button" aria-expanded="false" aria-controls="mx-panel">' + ICON + '</button>'
    + '<button class="mx-tool" type="button" data-step="1" aria-label="Next design"><svg class="nu-icon" aria-hidden="true"><use href="#i-chevron-right"></use></svg></button></div>';
  document.body.appendChild(ui);
  var fab = ui.querySelector('.mx-fab'), panel = ui.querySelector('.mx-panel'), list = ui.querySelector('.mx-panel__opts');
  var note = ui.querySelector('.mx-panel__note'), target = slots[0];

  function changed() { var n = Object.keys(saved).length; return n ? n + (n === 1 ? ' section changed' : ' sections changed') : 'Every section as it is today'; }
  function render() {
    var all = opts(target), on = shown(target), at = all.indexOf(on) + 1;
    ui.querySelector('.mx-panel__name').textContent = name(target);
    ui.querySelector('.mx-panel__count').textContent = at + ' of ' + all.length;
    fab.setAttribute('aria-label', 'Shuffle “' + name(target) + '”, design ' + at + ' of ' + all.length);
    fab.title = 'Shuffle: ' + name(target);
    [].forEach.call(ui.querySelectorAll('[data-step]'), function (b) { b.setAttribute('aria-label', (b.getAttribute('data-step') < 0 ? 'Previous' : 'Next') + ' design for “' + name(target) + '”'); });
    list.innerHTML = all.map(function (o) {
      return '<li><button class="mx-row" type="button" aria-pressed="' + (o === on) + '" data-pick="' + o.getAttribute('data-mix-opt') + '">'
        + '<span>' + o.getAttribute('data-mix-label').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span><svg class="nu-icon" aria-hidden="true"><use href="#i-check"></use></svg></button></li>';
    }).join('');
    note.textContent = changed();
    slots.forEach(function (s) { shown(s).classList.toggle('mx-on', !panel.hidden && s === target); });
  }
  function inView() {   // the place under the line a third of the way down the window
    var y = window.innerHeight * 0.35;
    return slots.filter(function (s) { var r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; })[0] || target;
  }
  function open(on) {
    panel.hidden = !on; fab.setAttribute('aria-expanded', String(on)); ui.classList.toggle('is-open', on);
    if (on) target = inView();
    render();
    if (on) (list.querySelector('[aria-pressed="true"]') || list.querySelector('button')).focus();
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; var t = inView(); if (t !== target) { target = t; render(); } });
  }, { passive: true });

  fab.addEventListener('click', function () { open(panel.hidden); });
  ui.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b || b === fab) return;
    if (b.hasAttribute('data-pick')) { var p = b.getAttribute('data-pick'); show(target, p, true); render(); list.querySelector('[data-pick="' + p + '"]').focus(); }
    if (b.hasAttribute('data-step')) {
      var all = opts(target), n = all.indexOf(shown(target)) + Number(b.getAttribute('data-step'));
      show(target, all[(n + all.length) % all.length].getAttribute('data-mix-opt'), true); render();
    }
    if (b.hasAttribute('data-reset')) { slots.forEach(function (s) { show(s, 'current', false); }); render(); }
    if (b.hasAttribute('data-copy')) {
      var text = document.title.split(' · ')[0] + ', shuffle\n' + slots.map(function (s) { return name(s) + ': ' + shown(s).getAttribute('data-mix-label'); }).join('\n');
      var done = function () { note.textContent = 'Copied. Paste it in a comment or the chat.'; };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy the list', text); });
      else window.prompt('Copy the list', text);
    }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !panel.hidden) { open(false); fab.focus(); } });
  document.addEventListener('click', function (ev) { if (!panel.hidden && !ui.contains(ev.target)) open(false); });
  render();
})();
