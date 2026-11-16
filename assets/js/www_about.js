/* Campus row (www_about, www_academics): previous / next paddles for the native scrolling row. Without script the row still scrolls by
   touch, trackpad or keyboard; the paddles stay hidden. Each paddle disables itself at its end, so a paddle never does nothing. */
(function () {
  var rows = document.querySelectorAll('[data-wwa-campuses]');
  if (!rows.length) return;
  var still = matchMedia('(prefers-reduced-motion: reduce)');
  rows.forEach(function (row) {
    var track = row.querySelector('.wwa-campuses__track');
    var pads = row.querySelector('.wwa-campuses__paddles');
    var prev = pads.querySelector('[data-wwa-step="-1"]');
    var next = pads.querySelector('[data-wwa-step="1"]');
    var sync = function () {
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    };
    var step = function (dir) {
      var card = track.querySelector('.wwa-campuses__item');
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      var per = card ? card.getBoundingClientRect().width + gap : track.clientWidth;
      var n = Math.max(1, Math.floor((track.clientWidth - gap) / per));
      track.scrollBy({ left: dir * n * per, behavior: still.matches ? 'auto' : 'smooth' });
    };
    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    track.addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync);
    pads.hidden = false;
    sync();
  });
})();
