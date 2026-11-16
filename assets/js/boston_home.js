/* Boston campus: paddles for the "Beyond New England" row. The row is native scroll (touch, trackpad, keyboard) without this;
   the script shows the paddles and disables each at its end so a paddle never does nothing. Runs only on its own page. */
(function () {
  'use strict';
  var root = document.querySelector('[data-bos-strip]');
  if (!root) return;
  var track = root.querySelector('.bos-strip'), pads = root.querySelector('.bos-strip__paddles');
  var btns = pads.querySelectorAll('[data-bos-step]');
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ends() {
    btns[0].disabled = track.scrollLeft < 4;
    btns[1].disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    pads.hidden = track.scrollWidth <= track.clientWidth + 4;
  }
  Array.prototype.forEach.call(btns, function (b) {
    b.addEventListener('click', function () { track.scrollBy({ left: Number(b.dataset.bosStep) * track.clientWidth * 0.8, behavior: still ? 'auto' : 'smooth' }); });
  });
  track.addEventListener('scroll', ends, { passive: true });
  window.addEventListener('resize', ends);
  ends();
})();
