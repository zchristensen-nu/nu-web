/* A specimen alone: the ground from ?mode= (light | dark), set before the pattern scripts run. A part (an atom or a molecule:
   .lb-frame--pad) tells the library its height, so its window fits it; a section keeps the window's own height. */
(function () {
  var f = document.querySelector('.lb-frame');
  if (!f) return;
  f.setAttribute('data-mode', document.documentElement.getAttribute('data-frame-mode'));
  if (!f.classList.contains('lb-frame--pad') || window.parent === window) return;
  var tell = function () { window.parent.postMessage({ lbHeight: Math.ceil(f.getBoundingClientRect().height) }, '*'); };
  if ('ResizeObserver' in window) new ResizeObserver(tell).observe(f);
  window.addEventListener('load', tell);
})();
