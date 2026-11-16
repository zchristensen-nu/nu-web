/* dx_media.js: behaviour for the media family of section patterns (build/pages/_dx_media.py; the styles are design-system
   components). build.py links every build/js file on every page after dx.js, so each block mounts only on its own hook and the
   markup is complete without it. Rails are the shared rail (dx.js, [data-dx-rail]); reveals, drift and hover are css/motion.css.

   FilmPlayer ([data-dx-player]) is the library's one film and lives in dx.js.
   [data-dx-logo-marquee]    LogoRow --marquee: closes the loop with hidden copies and shows the pause toggle; off under reduced motion. */
(function () {
  'use strict';
  var DX = window.DX;
  if (!DX || !DX.mount) return;
  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var onMotion = function (fn) { if (motion && motion.addEventListener) motion.addEventListener('change', fn); };

  /* ---------- LogoRow --marquee ---------- */
  DX.mount('[data-dx-logo-marquee]', function (root) {
    var list = root.querySelector('[data-dx-logo-marquee-track]');
    var toggle = root.querySelector('[data-dx-logo-marquee-toggle]');
    if (!list || !toggle) return;
    var originals = [].slice.call(list.children);
    if (!originals.length) return;
    var live = false;
    var clear = function () { [].slice.call(list.querySelectorAll('[data-dx-logo-marquee-copy]')).forEach(function (el) { el.remove(); }); };
    var fill = function () {
      // Enough copies of the set to cover the viewport once the first set has left it; the loop travels one set's width.
      clear();
      var copy = function () {
        originals.forEach(function (item) {
          var c = item.cloneNode(true);
          c.setAttribute('data-dx-logo-marquee-copy', '');
          c.setAttribute('aria-hidden', 'true');
          [].forEach.call(c.querySelectorAll('a,button'), function (el) { el.setAttribute('tabindex', '-1'); });
          list.appendChild(c);
        });
      };
      copy();
      var first = list.children[originals.length];
      var set = first.offsetLeft - originals[0].offsetLeft;
      if (set <= 0) return;
      var need = Math.ceil(list.parentElement.clientWidth / set);
      for (var n = 1; n < need; n++) copy();
      root.style.setProperty('--logo-row-shift', -set + 'px');
    };
    var start = function () { if (live || DX.reduced()) return; live = true; toggle.hidden = false; fill(); };
    var stop = function () { if (!live) return; live = false; toggle.hidden = true; clear(); root.style.removeProperty('--logo-row-shift'); };
    toggle.addEventListener('click', function () { toggle.setAttribute('aria-pressed', String(toggle.getAttribute('aria-pressed') !== 'true')); });
    onMotion(function () { if (DX.reduced()) stop(); else start(); });
    var resizing;
    window.addEventListener('resize', function () { window.clearTimeout(resizing); resizing = window.setTimeout(function () { if (live) fill(); }, DX.ms('--dur-fast')); });
    window.addEventListener('load', function () { if (live) fill(); });
    start();
  });
})();
