/* dx_flex.js: behaviour for the flex family of section patterns (build/pages/_dx_flex.py; the styles are design-system components:
   molecules/flex-frame, organisms/milestone-track, showcase-stage, photo-marquee). build.py links every build/js file on every page after dx.js, so each block mounts only on
   its own hook, and every pattern is complete without this file (its resting form).

   The scene clock. Scroll is native: nothing here moves the page. The pinned scenes (track, stage) are scenes: each measures its place on the page when the layout changes (load, fonts, resize), and an
   IntersectionObserver marks the ones near the window. While the reader scrolls, one requestAnimationFrame callback reads
   scrollY once and lets each live scene write transforms and opacity (and one custom property on a small element): no layout
   is read per frame. A scrubbed scene eases toward the scroll position (a short exponential follow, about 120ms), so a wheel's
   steps arrive as one glide; that follow is the only smoothing, and it stops when it has arrived. Reduced motion: no scene
   runs, every pattern keeps its resting form, and a change of the setting re-reads all of it.

   [data-dx-flex-track]      MilestoneTrack: pins and carries the row (from 960px, when it overflows); focus brings a card's place
                             into view.
   [data-dx-flex-stage]      ShowcaseStage: one item per segment; the dot pager; the rail in step; focus brings an item on stage.
   [data-dx-flex-marquee]    PhotoMarquee: closes the loop, shows the pause toggle, rests out of view.
   [data-dx-flex-cursor]     the pointer label (one per page, fine pointers only). */
(function () {
  'use strict';
  var DX = window.DX;
  if (!DX || !DX.mount) return;
  var mm = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: null }; };
  var wide = mm('(min-width:960px)'), fine = mm('(hover:hover) and (pointer:fine)'), motionQ = mm('(prefers-reduced-motion: reduce)');
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };                       // ease-out (cubic)
  var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function (fn) { return window.setTimeout(fn, 16); };

  /* ---------- the scene clock ---------- */
  var scenes = [], near = new Set(), ticking = false, last = 0, vh = window.innerHeight;
  var pinTop = function () { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pin-top')) || 0; };
  var docTop = function (el) { return el.getBoundingClientRect().top + window.scrollY; };
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { (en.target.__flexScenes || []).forEach(function (s) { if (en.isIntersecting) near.add(s); else near.delete(s); }); });
    kick();
  }, { rootMargin: '50% 0px 50% 0px' }) : null;
  function scene(el, s) {
    s.el = el; scenes.push(s);
    if (!el.__flexScenes) { el.__flexScenes = []; if (io) io.observe(el); }
    el.__flexScenes.push(s);
    if (!io) near.add(s);
    return s;
  }
  function frame(now) {
    ticking = false;
    var dt = last ? Math.min(64, now - last) : 16; last = now;
    var y = window.scrollY, more = false;
    near.forEach(function (s) { if (s.on && s.tick(y, dt)) more = true; });
    if (more) kick(); else last = 0;
  }
  function kick() { if (!ticking) { ticking = true; raf(frame); } }
  // Follow: move cur toward target with a ~120ms exponential ease; returns true while it is still travelling.
  function follow(s, target, dt, snap) {
    if (snap || s.cur == null) { s.cur = target; return false; }
    s.cur += (target - s.cur) * (1 - Math.exp(-dt / 120));
    if (Math.abs(target - s.cur) < 0.0004) { s.cur = target; return false; }
    return true;
  }
  var measuring;
  function measure() {
    vh = window.innerHeight;
    scenes.forEach(function (s) { if (s.setup) s.setup(); });
    scenes.forEach(function (s) { if (s.measure && s.on) s.measure(); });
    scenes.forEach(function (s) { s.cur = null; });
    kick();
  }
  function remeasure() { window.clearTimeout(measuring); measuring = window.setTimeout(measure, 120); }
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  [wide, motionQ, fine].forEach(function (q) { if (q.addEventListener) q.addEventListener('change', measure); });
  window.setTimeout(measure, 0);
  var live = function () { return !DX.reduced(); };
  // Jump the page so a scene shows progress p (focus and the pager); smooth unless the reader asks for less motion.
  function scrollToScene(s, p, smooth) {
    var y = s.start + p * s.dist;
    window.scrollTo({ top: y, behavior: smooth && live() ? 'smooth' : 'auto' });
  }

  /* ---------- MilestoneTrack ---------- */
  DX.mount('[data-dx-flex-track]', function (root) {
    var pin = root.querySelector('[data-dx-flex-track-pin]'), rail = root.querySelector('[data-dx-flex-track-rail]');
    var view = root.querySelector('[data-dx-flex-track-viewport]');
    if (!pin || !rail || !view) return;
    var items = [].slice.call(rail.children);
    var s = scene(root, {
      setup: function () {
        root.classList.remove('is-pinned'); root.style.removeProperty('--track-h'); rail.style.transform = '';
        this.on = live() && wide.matches;
        if (!this.on) return;
        root.classList.add('is-pinned');
        var dist = rail.scrollWidth - pin.clientWidth;
        if (dist < pin.clientWidth * .25) { root.classList.remove('is-pinned'); this.on = false; return; }   // a short track reads as a row
        this.dist = dist;
        root.style.setProperty('--track-h', (pin.clientHeight + dist) + 'px');
      },
      measure: function () { this.pt = pinTop(); this.start = docTop(root) - this.pt; },
      tick: function (y, dt) {
        var more = follow(this, clamp((y - this.start) / this.dist, 0, 1), dt);
        rail.style.transform = 'translate3d(' + (-this.cur * this.dist).toFixed(2) + 'px,0,0)';
        return more;
      }
    });
    // A card that takes focus inside the pinned track: bring its place on the page into view, centred.
    rail.addEventListener('focusin', function (ev) {
      if (!s.on) return;
      var li = ev.target.closest('.nu-milestone-track__item');
      if (!li) return;
      var x = li.offsetLeft + li.offsetWidth / 2 - pin.clientWidth / 2;
      view.scrollLeft = 0; pin.scrollLeft = 0;
      scrollToScene(s, clamp(x / s.dist, 0, 1), false);
      s.cur = null;
    });
    s.items = items;
  });

  /* ---------- The pointer label ---------- */
  var label = null, lx = 0, ly = 0, tx = 0, ty = 0, following = false;
  function cursorLoop() {
    lx += (tx - lx) * .25; ly += (ty - ly) * .25;
    label.style.transform = 'translate3d(' + (lx + 18).toFixed(1) + 'px,' + (ly + 18).toFixed(1) + 'px,0)';
    if (Math.abs(tx - lx) > .3 || Math.abs(ty - ly) > .3) raf(cursorLoop); else following = false;
  }
  document.addEventListener('pointerover', function (ev) {
    if (!fine.matches || DX.reduced() || ev.pointerType !== 'mouse') return;
    var host = ev.target.closest && ev.target.closest('[data-dx-flex-cursor]');
    if (!host) return;
    if (!label) { label = document.createElement('span'); label.className = 'nu-flex-cursor'; label.setAttribute('aria-hidden', 'true'); document.body.appendChild(label); }
    var g = host.closest('[data-mode]');
    if (g) label.setAttribute('data-mode', g.getAttribute('data-mode')); else label.removeAttribute('data-mode');
    label.textContent = host.getAttribute('data-dx-flex-cursor');
    lx = tx = ev.clientX; ly = ty = ev.clientY;
    cursorLoop();
    label.classList.add('is-on');
  });
  document.addEventListener('pointerout', function (ev) {
    if (!label) return;
    var host = ev.target.closest && ev.target.closest('[data-dx-flex-cursor]');
    if (host && !host.contains(ev.relatedTarget)) label.classList.remove('is-on');
  });
  document.addEventListener('pointermove', function (ev) {
    if (label && label.classList.contains('is-on')) { tx = ev.clientX; ty = ev.clientY; if (!following) { following = true; raf(cursorLoop); } }
  }, { passive: true });
  window.addEventListener('scroll', function () { if (label) label.classList.remove('is-on'); }, { passive: true });

  /* ---------- ShowcaseStage ---------- */
  DX.mount('[data-dx-flex-stage]', function (root) {
    var pin = root.querySelector('[data-dx-flex-stage-pin]');
    var subs = [].slice.call(root.querySelectorAll('[data-dx-flex-stage-subject]'));
    var items = [].slice.call(root.querySelectorAll('[data-dx-flex-stage-item]'));
    var pager = root.querySelector('[data-dx-flex-stage-pager]');
    var dots = [].slice.call(root.querySelectorAll('[data-dx-flex-stage-dot]'));
    var rail = root.querySelector('[data-dx-flex-stage-rail]');
    var entries = rail ? [].slice.call(rail.children) : [];
    var n = items.length, current = -1;
    if (!pin || !n) return;
    function show(k) {
      if (k === current) return;
      current = k;
      subs.forEach(function (el, j) { el.classList.toggle('is-on', j === k); });
      items.forEach(function (el, j) { el.classList.toggle('is-on', j === k); });
      entries.forEach(function (el, j) { el.classList.toggle('is-on', j === k); });
      dots.forEach(function (el, j) { if (j === k) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current'); });
    }
    var s = scene(root, {
      setup: function () {
        root.classList.remove('is-live'); root.style.removeProperty('--stage-h'); if (pager) pager.hidden = true;
        if (rail) rail.style.transform = '';
        [subs, items, entries].forEach(function (l) { l.forEach(function (el) { el.classList.remove('is-on'); }); });
        current = -1;
        this.on = live();
        if (!this.on) return;
        root.classList.add('is-live'); if (pager) pager.hidden = false;
        this.dist = pin.clientHeight * .85 * n;
        root.style.setProperty('--stage-h', (pin.clientHeight + this.dist) + 'px');
        show(0);
      },
      measure: function () {
        this.pt = pinTop(); this.start = docTop(root) - this.pt;
        if (rail) this.travel = Math.max(0, rail.scrollWidth - rail.parentElement.clientWidth);   // first entry on the left edge, last on the right
      },
      tick: function (y, dt) {
        var target = clamp((y - this.start) / this.dist, 0, 1);
        show(Math.min(n - 1, Math.floor(target * n)));
        var more = follow(this, target, dt);
        if (rail && this.travel) rail.style.transform = 'translate3d(' + (-this.cur * this.travel).toFixed(2) + 'px,0,0)';
        return more;
      }
    });
    dots.forEach(function (dot, k) {
      dot.addEventListener('click', function () { scrollToScene(s, (k + .5) / n, true); });
    });
    root.addEventListener('focusin', function (ev) {
      if (!s.on) return;
      var li = ev.target.closest('[data-dx-flex-stage-item]');
      if (!li) return;
      var k = items.indexOf(li);
      if (k !== current) { pin.scrollTop = 0; scrollToScene(s, (k + .5) / n, false); show(k); }
    });
  });

  /* ---------- PhotoMarquee ---------- */
  DX.mount('[data-dx-flex-marquee]', function (root) {
    var track = root.querySelector('[data-dx-flex-marquee-track]'), toggle = root.querySelector('[data-dx-flex-marquee-toggle]');
    if (!track || !toggle) return;
    var originals = [].slice.call(track.children), on = false;
    var clear = function () { [].slice.call(track.querySelectorAll('[data-dx-flex-marquee-copy]')).forEach(function (el) { el.remove(); }); };
    var fill = function () {
      clear();
      var add = function () {
        originals.forEach(function (it) {
          var c = it.cloneNode(true);
          c.setAttribute('data-dx-flex-marquee-copy', ''); c.setAttribute('aria-hidden', 'true');
          [].forEach.call(c.querySelectorAll('a,button,[tabindex]'), function (el) { el.setAttribute('tabindex', '-1'); });
          [].forEach.call(c.querySelectorAll('[id]'), function (el) { el.removeAttribute('id'); });
          track.appendChild(c);
        });
      };
      add();
      var set = track.children[originals.length].offsetLeft - originals[0].offsetLeft;
      if (set <= 0) return;
      var need = Math.ceil(root.clientWidth / set);
      for (var k = 0; k < need; k++) add();
      track.style.setProperty('--marquee-shift', -set + 'px');
    };
    var start = function () { if (on || DX.reduced()) return; on = true; root.classList.add('is-live'); toggle.hidden = false; fill(); };
    var stop = function () { if (!on) return; on = false; root.classList.remove('is-live'); toggle.hidden = true; clear(); track.style.removeProperty('--marquee-shift'); };
    toggle.addEventListener('click', function () {
      var paused = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.setAttribute('aria-label', toggle.getAttribute('aria-label').replace(paused ? /^Pause/ : /^Play/, paused ? 'Play' : 'Pause'));
    });
    if (motionQ.addEventListener) motionQ.addEventListener('change', function () { if (DX.reduced()) stop(); else start(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { root.classList.toggle('is-away', !en[0].isIntersecting); }).observe(root);
    var resizing;
    window.addEventListener('resize', function () { window.clearTimeout(resizing); resizing = window.setTimeout(function () { if (on) fill(); }, 200); });
    window.addEventListener('load', function () { if (on) fill(); });
    start();
  });
})();
