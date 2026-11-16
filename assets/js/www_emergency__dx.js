/* www_emergency__dx.js: page behaviour for the three takes of Emergency information (build/pages/www_emergency__a/b/c.py).
   One thing: paper. A closed disclosure (NU Alert's two parts) opens for printing and closes again afterwards, in every
   browser; the print rules in build/css/www_emergency__dx.css do the same where ::details-content can be styled.
   Returns at once on any other page. Request: build/reports/dx-library-requests/www_emergency.md (print). */
(function () {
  'use strict';
  var items = document.querySelectorAll('details.pg-emergency-dx');
  if (!items.length) return;
  var closed = [];
  var open = function () {
    Array.prototype.forEach.call(items, function (d) { if (!d.open) { closed.push(d); d.open = true; } });
  };
  var restore = function () { closed.forEach(function (d) { d.open = false; }); closed = []; };
  window.addEventListener('beforeprint', open);
  window.addEventListener('afterprint', restore);
  if (window.matchMedia) {
    var mq = window.matchMedia('print');
    var change = function () { if (mq.matches) open(); else restore(); };
    if (mq.addEventListener) mq.addEventListener('change', change); else if (mq.addListener) mq.addListener(change);
  }
})();
