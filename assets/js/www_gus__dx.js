/* Global university system, the three takes: two small page behaviours. Each returns early unless its own element is on the page.
   1. Take A, the campus index ([data-gx-index] in a rail's header). Each name links to its card's title, so without script the
      page goes there. With script the rail brings that card to its front and focus moves to the card; the page does not jump
      (library request 15 asks the shared rail to take this).
   2. Take C, the globe's rail: the chosen campus is brought into view in the rail's own row, however it was chosen (a pin, the
      keyboard, a link elsewhere). The pause control and the return of focus are the organism's now (build/js/www_gus.js). */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var index = document.querySelector('[data-gx-index]');
  var rail = index && index.closest('[data-dx-rail]');
  var track = rail && rail.querySelector('[data-dx-rail-track]');
  if (track) {
    index.addEventListener('click', function (ev) {
      if (ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var a = ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
      var title = a && document.getElementById(a.hash.slice(1));
      var item = title && title.closest('li');
      if (!item || !track.contains(item)) return;
      ev.preventDefault();   /* the shared in-page glide (dx.js) stands down: the rail turns, the page stays */
      var left = item.getBoundingClientRect().left - track.firstElementChild.getBoundingClientRect().left;
      track.scrollTo({ left: left, behavior: reduce ? 'auto' : 'smooth' });
      track.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      var card = item.querySelector('a');
      if (card) card.focus({ preventScroll: true });
    });
  }

  var list = document.querySelector('[data-gus-globe].gx-globe .gx-rail__list');
  if (list) {
    new MutationObserver(function (changes) {
      changes.forEach(function (m) {
        if (m.target.getAttribute('aria-current') === 'true') list.scrollTo({ left: m.target.offsetLeft - list.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
      });
    }).observe(list, { attributes: true, attributeFilter: ['aria-current'], subtree: true });
  }
})();
