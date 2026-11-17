/* dx_heroes.js: behaviour for the heroes family of section patterns (build/pages/_dx_heroes.py; design-system organisms
   chapter-rail, contents-bar, sibling-nav, call-list). Loads after dx.js; every block mounts on
   its own data attribute and does nothing on pages without it. The markup is complete without this file: contents are lists of
   anchor links, a SiblingNav is a row of links, numbers are tel: links. (Films in heroes and closers are the shared FilmPlayer:
   dx.js, [data-dx-player].)

   [data-dx-contents]  marks the link of the section being read (aria-current="location"), glides the list's one marker to it
                       ([data-indicator] on the list; the marker rests on the link's [data-dx-heroes-mark], or on the link),
                       keeps it in view in a sideways row (fading the side that has more: [data-dx-heroes-more]), feeds the
                       bar's name (a numeral bar's name follows the chip in hand: [data-dx-heroes-preview]), and glides to a chosen section (DX.glide).
   [data-dx-heroes-siblings]  a SiblingNav: its one marker rests under the current page and glides to the link under the mouse or
                       the keyboard; a row wider than its bar reports which side has more ([data-dx-heroes-more] on the list).
   [data-dx-copy]      copies a number to the clipboard and says so in place; the control returns by itself. */
(function () {
  'use strict';
  var DX = window.DX;
  if (!DX) return;

  /* A sideways row wider than its box says which side has more ([data-dx-heroes-more]: "start", "end" or both; the stylesheet
     fades that side). IntersectionObservers on the row's first and last items; nothing runs on scroll. A row that fits says
     nothing (no fade). */
  var ends = function (row, items) {
    if (!('IntersectionObserver' in window) || !items.length) return;
    var state = { start: false, end: false }, first = items[0], last = items[items.length - 1];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { state[en.target === first ? 'start' : 'end'] = en.intersectionRatio < 0.98; });
      if (first === last) state.start = false;
      row.setAttribute('data-dx-heroes-more', (state.start ? 'start ' : '') + (state.end ? 'end' : ''));
    }, { root: row, threshold: [0, 0.5, 0.98, 1] });
    io.observe(first);
    if (last !== first) io.observe(last);
  };

  /* Contents: one rule for every tracker (ChapterRail, ContentsBar). The section being read is
     the one whose heading most recently crossed the reading line: three tenths of the way down the window, never above the
     line a chosen section lands on (the root's scroll padding: everything that travels, plus air). Over the last stretch of
     the page the line runs down to the window's foot, so every section, however short or late, has a place where it is the
     current one, and the last is current at the page's end. IntersectionObservers on that line say when to look again, and
     the tracker looks whenever the page comes to rest (scrollend), the address changes (hashchange) or the window is
     resized; nothing runs on scroll. A chosen section (a contents link, any other link to it, the address) keeps the mark
     until the reader moves the page. */
  DX.mount('[data-dx-contents]', function (root) {
    var links = [].slice.call(root.querySelectorAll('a[href^="#"]'));
    var targets = links.map(function (a) { return document.getElementById(decodeURIComponent(a.hash.slice(1))); });
    if (!links.length || targets.indexOf(null) > -1 || !('IntersectionObserver' in window)) return;
    var name = root.querySelector('[data-dx-contents-current]');
    var row = root.querySelector('[data-indicator]');
    var marker = row && DX.indicator ? DX.indicator(row) : null;
    var doc = document.documentElement;
    // A link's name: its accessible name where the label is short (a numeral chip: "IX. Individual Rights"), else its text.
    var label = function (a) { return (a.getAttribute('aria-label') || a.textContent).replace(/\s+/g, ' ').trim(); };
    // A list longer than its box (a sideways row; the margin list in a short window; an open sheet) keeps the current link in
    // view inside the box, without moving the page.
    var keep = function (a) {
      var list = (a || links[0]).closest('ol,ul');
      if (!list) return;
      var how = DX.reduced() ? 'auto' : 'smooth';
      if (list.scrollWidth > list.clientWidth + 1) {  // a sideways row: the current link comes to its start (the row's own start above the first section)
        var left = a ? a.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft - (parseFloat(getComputedStyle(list).scrollPaddingLeft) || 0) : 0;
        list.scrollTo({ left: Math.max(0, left), behavior: how });
      }
      [list, root].some(function (box) {
        if (!box.clientHeight || box.scrollHeight <= box.clientHeight + 1 || !/auto|scroll/.test(getComputedStyle(box).overflowY)) return false;
        if (!a) { box.scrollTo({ top: 0, behavior: how }); return true; }
        var b = box.getBoundingClientRect(), r = a.getBoundingClientRect();
        if (r.top < b.top + r.height || r.bottom > b.bottom - r.height) box.scrollTo({ top: Math.max(0, box.scrollTop + r.top - b.top - (b.height - r.height) / 2), behavior: how });
        return true;
      });
    };
    var current = -2;
    var mark = function (index) {
      if (index === current) return;
      current = index;
      links.forEach(function (a, n) {
        if (n === index) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
      var a = links[index];
      if (marker) marker.to(a ? a.querySelector('[data-dx-heroes-mark]') || a : null);
      var shown = Math.max(index, 0);
      if (name) name.textContent = label(links[shown]);
      keep(a);
    };
    var landing = function () { return parseFloat(getComputedStyle(doc).scrollPaddingTop) || 0; };
    var base = function () { return Math.max(landing() + 8, Math.round(window.innerHeight * 0.3)); };
    var line = function () {
      var h = window.innerHeight, at = base(), left = Math.max(0, doc.scrollHeight - h - window.scrollY);  // left: how far the page can still move
      return left < h - at ? h - left : at;
    };
    // While the page glides to a chosen section the marker stays on that choice: the sections passing on the way are not "read".
    // Once it has landed the choice keeps the mark until the reader moves the page (a short section would otherwise hand it
    // straight to the next one, whose heading is already past the reading line).
    var gliding = 0, chosen = -1, held = -1, heldAt = 0;
    var look = function () {
      if (gliding) return;
      if (held > -1) {
        if (Math.abs(window.scrollY - heldAt) < 4) { mark(held); return; }
        held = -1;
      }
      var at = line(), index = -1;
      targets.forEach(function (t, n) { if (t.getClientRects().length && t.getBoundingClientRect().top <= at) index = n; });
      mark(index);
    };
    var settle = function () {
      if (!gliding) return;
      window.clearTimeout(gliding); gliding = 0;
      if (chosen > -1) {
        var top = targets[chosen].getBoundingClientRect().top;
        if (top > -4 && top < window.innerHeight) { held = chosen; heldAt = window.scrollY; }  // it landed in the window: it keeps the mark
        chosen = -1;
      }
      look();
    };
    var choose = function (n) {
      window.clearTimeout(gliding);
      gliding = window.setTimeout(settle, 2 * DX.ms('--dur-scene'));  // the longest a glide lasts; scrollend ends it sooner
      chosen = n; held = -1;
      mark(n);
    };
    var find = function (hash) {
      for (var n = 0; n < links.length; n++) if (hash && links[n].hash === hash) return n;
      return -1;
    };
    // Whenever the page comes to rest, look again: a jump (the scrollbar, a script, Home / End) can pass every section without
    // one crossing a line. Where the browser has no scrollend, a timer that restarts while the page moves says the same.
    var resting = 0;
    var rested = function () { if (gliding) settle(); else look(); };
    if ('onscrollend' in window) window.addEventListener('scrollend', rested);
    else window.addEventListener('scroll', function () { window.clearTimeout(resting); resting = window.setTimeout(rested, 150); }, { passive: true });
    // The lines: the reading line itself and two lower ones (the line's path over the page's last stretch), each a
    // one-pixel root, plus the window's own edges (a section entering or leaving). Rebuilt when the window changes.
    var watchers = [];
    var watch = function () {
      watchers.forEach(function (io) { io.disconnect(); });
      var h = window.innerHeight;
      watchers = [base(), Math.round(h * 0.55), Math.round(h * 0.8)].map(function (y) {
        return new IntersectionObserver(look, { root: DX.view, rootMargin: -y + 'px 0px ' + -(h - y - 1) + 'px 0px', threshold: 0 });
      });
      watchers.push(new IntersectionObserver(look, { threshold: [0, 1] }));
      watchers.forEach(function (io) { targets.forEach(function (t) { io.observe(t); }); });
    };
    // A choice glides to its section (native scrolling, honouring scroll-padding), keeps the address and moves focus there.
    links.forEach(function (a, n) {
      a.addEventListener('click', function (ev) {
        if (ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault();
        choose(n);
        DX.glide(targets[n], a.hash);
      });
    });
    // Any other link on the page to one of the sections, and the address itself (back, forward, a typed #hash), is a choice too.
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
      if (!a || root.contains(a) || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var n = find(a.hash);
      if (n > -1) choose(n);
    });
    window.addEventListener('hashchange', function () {
      var n = find(window.location.hash);
      if (n > -1) { if (n !== chosen) choose(n); } else look();
    });
    var sized = 0;
    // A sideways row (ChapterRail, ContentsBar on phones) fades the side that has more, so a clipped label reads as "more".
    if (row && /auto|scroll/.test(getComputedStyle(row).overflowX)) ends(row, [].slice.call(row.children));
    // A bar of short labels (numerals) names the section in hand while the pointer or the keyboard is on its chip, then
    // returns to the section being read.
    if (name && name.hasAttribute('data-dx-heroes-preview')) links.forEach(function (a) {
      var show = function () { name.textContent = label(a); };
      var back = function () { name.textContent = label(links[Math.max(current, 0)]); };
      a.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') show(); });
      a.addEventListener('pointerleave', back);
      a.addEventListener('focus', function () { if (a.matches(':focus-visible')) show(); });
      a.addEventListener('blur', back);
    });
    var resized = function () { window.clearTimeout(sized); sized = window.setTimeout(function () { watch(); look(); }, 120); };
    window.addEventListener('resize', resized);
    watch();
    var first = find(window.location.hash);
    if (first > -1) choose(first); else look();
  });

  /* Siblings: the one marker of a SiblingNav rests under the page being read and glides to the link under the mouse or the
     keyboard, then back (nothing follows a finger: touch has no hover). A row wider than its bar says which side has more
     (the stylesheet fades that side) and starts with the current page in view. Nothing runs on scroll. */
  DX.mount('[data-dx-heroes-siblings]', function (root) {
    var row = root.querySelector('[data-indicator]');
    if (!row) return;
    var links = [].slice.call(row.querySelectorAll('a'));
    var here = row.querySelector('[aria-current="page"]');
    var marker = DX.indicator(row);
    var rest = function () { marker.to(here ? here.querySelector('[data-dx-heroes-mark]') || here : null); };
    var point = function (a) { marker.to(a.querySelector('[data-dx-heroes-mark]') || a); };
    links.forEach(function (a) {
      a.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') point(a); });
      a.addEventListener('focus', function () { if (a.matches(':focus-visible')) point(a); });
      a.addEventListener('blur', rest);
    });
    row.addEventListener('pointerleave', rest);
    rest();
    if (here && row.scrollWidth > row.clientWidth + 1) {   // the current page starts in view, clear of the fades, without moving the page
      var fade = parseFloat(getComputedStyle(row).scrollPaddingLeft) || 0;
      var box = row.getBoundingClientRect(), at = here.getBoundingClientRect();
      if (at.left < box.left || at.right > box.right - fade) row.scrollLeft = Math.max(0, at.left - box.left + row.scrollLeft - fade);
    }
    ends(row, links.map(function (a) { return a.parentNode; }));
  });

  /* Copy: the number goes to the clipboard; the control reads "Copied" for a moment (both labels are in the markup, so its
     width never changes) and a status line tells assistive technology. A press while it still reads "Copied" copies again and
     restarts the moment. If the clipboard refuses, the number is selected instead, ready to copy by hand. */
  DX.mount('[data-dx-copy]', function (button) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;  // stays hidden: the number is still a link
    var label = button.querySelector('[data-dx-copy-label]');
    var done = button.getAttribute('data-dx-copied') || (label ? label.textContent : '');
    var scope = button.closest('.nu-section') || document;
    var status = scope.querySelector('[data-dx-copy-status]');
    var timer = 0;
    var rest = function () {
      button.removeAttribute('data-dx-copy-done');
      if (status && status.textContent === said) status.textContent = '';
    };
    var said = '';
    button.hidden = false;
    button.addEventListener('click', function () {
      var text = button.getAttribute('data-dx-copy');
      navigator.clipboard.writeText(text).then(function () {
        said = done + ' ' + text;
        button.setAttribute('data-dx-copy-done', '');
        if (status) { status.textContent = ''; status.textContent = said; }
        window.clearTimeout(timer);
        timer = window.setTimeout(rest, 2 * DX.ms('--dur-scene'));
      }).catch(function () {
        window.clearTimeout(timer);
        rest();
        var number = (button.closest('.nu-call-list__call') || button.parentNode).querySelector('a[href^="tel:"]');
        if (number && window.getSelection) { var range = document.createRange(); range.selectNodeContents(number); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
      });
    });
  });
})();
