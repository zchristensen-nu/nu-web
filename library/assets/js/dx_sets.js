/* dx_sets.js: behaviour for the sets family of section patterns (build/pages/_dx_sets.py; styles in the design system's
   components/organisms). Loads after dx.js; every block mounts on its own data attribute and does nothing on pages without it.
   The markup reads in order without this file; each block only moves state the styles already understand.

   [data-dx-stage-tabs]     StageTabs: the pills become a tablist over one stage (roles, aria-selected, inert; arrows, Home,
                            End; the address takes the panel's id and a matching address opens that panel). One marker glides
                            between the pills (DX.indicator); the styles cross-fade the panels. Every state is a function of the
                            selected index alone, so rapid clicks and key repeat cannot leave it between two states.
                            ="titles": no pills; each panel's title becomes a button (aria-expanded) in a ruled list beside the
                            stage; the current row (its copy and title) is aria-current, the other rows' text and pictures are
                            inert. Every row's text shares one slot under the list (the styles), so nothing moves on a change.
   [data-dx-sticky-scenes]  StickyScenes: marks the chapter whose first line has risen to the pinned frame's top aria-current and points
                            the progress mark at it (DX.indicator). IntersectionObserver only: nothing runs while the page scrolls.
   [data-dx-index-rows]     IndexRows: marks the first picture current (which switches the pinned frame on); the row under the
                            pointer or holding focus puts its picture in the frame; on touch the row crossing the middle of the
                            window does.
   [data-dx-sets-disclose]  IndexRows --disclose with rows grouped by name (exclusive): a row above the clicked one closes with no
                            glide and the page is held by the same amount, so the clicked row stays where it was clicked.
   [data-dx-name-wall]      NameWall: the same for a name, its picture and its caption (marking a name current switches the
                            pinned form on).
   (Filmstrip, MixedRail and PosterRail use the shared rail, [data-dx-rail], in dx.js. A film in a media slot is the shared
   FilmPlayer, [data-dx-player], in dx.js: it pauses by itself inside an inert panel.) */
(function () {
  'use strict';
  var DX = window.DX;
  if (!DX || !DX.mount) return;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var pointer = window.matchMedia ? window.matchMedia('(hover: hover)') : { matches: true };
  var wide = window.matchMedia ? window.matchMedia('(min-width: 960px)') : { matches: true };
  // Transitions switch on only once a pattern has settled into its enhanced state, so nothing animates at load.
  var settle = function (root) {
    window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { root.setAttribute('data-dx-live', ''); }); });
  };
  // Move aria-current="true" to the nth element of each list.
  var mark = function (lists, n) {
    lists.forEach(function (list) {
      each(list, function (el, k) { if (k === n) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current'); });
    });
  };

  // The name or row crossing the middle of the window (the first, where several share a line), for touch screens from 960px,
  // where nothing hovers. `use` says whether crossing should choose right now.
  var crossing = function (items, set, use) {
    if (!('IntersectionObserver' in window)) return;
    var on = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var n = Array.prototype.indexOf.call(items, en.target);
        if (en.isIntersecting) on[n] = true; else delete on[n];
      });
      if (!use()) return;
      var keys = Object.keys(on).map(Number);
      if (keys.length) set(Math.min.apply(null, keys));
    }, { root: DX.view, rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    each(items, function (item) { io.observe(item); });
  };
  var byTouch = function () { return wide.matches && !pointer.matches; };

  /* ---------- StageTabs, tabs="titles": every title shows; the current row is open ---------- */
  var stageTitles = function (root) {
    var panels = Array.prototype.slice.call(root.querySelectorAll('.nu-tabs__stage > .nu-tabs__panel'));
    if (panels.length < 2) return;
    var part = function (cls) { return panels.map(function (p) { return p.querySelector(cls); }); };
    var copies = part('.nu-tabs__copy'), medias = part('.nu-tabs__media'), leads = part('.nu-tabs__lead');
    var titles = part('.nu-tabs__title');
    if (titles.some(function (t) { return !t; })) return;
    var current = -1;
    var picks = titles.map(function (title, n) {
      var pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'nu-tabs__pick';
      while (title.firstChild) pick.appendChild(title.firstChild);
      title.appendChild(pick);
      // No aria-controls: the site kit's generic disclosure takes over any button that has both it and aria-expanded.
      title.setAttribute('data-hover', '');            // the row's hairline draws under the pointer and stays drawn while it is current
      title.setAttribute('data-hover-line', '');
      pick.addEventListener('click', function () { select(n, { address: true }); });
      return pick;
    });
    var select = function (n, opts) {
      if (n === current) return;
      current = n;
      panels.forEach(function (panel, k) {
        var on = k === n;
        copies[k].setAttribute('aria-current', String(on));
        titles[k].setAttribute('aria-current', String(on));
        picks[k].setAttribute('aria-expanded', String(on));
        if (on) picks[k].setAttribute('aria-disabled', 'true'); else picks[k].removeAttribute('aria-disabled');   // one row is always open
        [medias[k], leads[k]].forEach(function (el) { if (!el) return; if (on) el.removeAttribute('inert'); else el.setAttribute('inert', ''); });
      });
      if (DX.filmSync) DX.filmSync();
      if (opts && opts.address && window.history && window.history.replaceState) window.history.replaceState(window.history.state, '', '#' + panels[n].id);
    };
    var fromAddress = function () {
      var id = window.location.hash.slice(1);
      for (var n = 0; n < panels.length; n++) if (panels[n].id === id) return n;
      return -1;
    };
    var start = fromAddress();
    select(start < 0 ? 0 : start);
    // Every row's text stands in one cell under the list (the styles), so the cell is as tall as the longest and nothing on
    // the page moves when the row changes: no height to reserve here.
    var land = function () { root.scrollIntoView({ block: 'start' }); };
    if (start >= 0) { land(); window.addEventListener('load', land); }
    window.addEventListener('hashchange', function () { var n = fromAddress(); if (n >= 0) { select(n); land(); } });
    settle(root);
  };

  /* ---------- StageTabs ---------- */
  DX.mount('[data-dx-stage-tabs]', function (root) {
    var list = root.querySelector('.nu-tabs__controls');
    if (!list) {   // one item: its stage stands with no tabs; tabs="titles": the titles are the controls
      if (root.getAttribute('data-dx-stage-tabs') === 'titles') stageTitles(root);
      return;
    }
    var tabs = Array.prototype.slice.call(list.querySelectorAll('.nu-tabs__tab'));
    var panels = tabs.map(function (t) { return document.getElementById((t.getAttribute('href') || '').slice(1)); });
    if (tabs.length < 2 || panels.some(function (p) { return !p; })) return;
    var current = -1;
    var marker = DX.indicator && list.hasAttribute('data-indicator') ? DX.indicator(list) : null;   // the one pill that glides

    list.setAttribute('role', 'tablist');
    if (root.getAttribute('aria-labelledby')) list.setAttribute('aria-labelledby', root.getAttribute('aria-labelledby'));
    tabs.forEach(function (tab, n) {
      tab.setAttribute('role', 'tab');
      if (!tab.id) tab.id = panels[n].id + '-tab';
      tab.setAttribute('aria-controls', panels[n].id);
      panels[n].setAttribute('role', 'tabpanel');
      panels[n].setAttribute('aria-labelledby', tab.id);
      if (!panels[n].querySelector('a[href],button')) panels[n].tabIndex = 0;   // a panel with nothing to focus is itself a stop
    });

    var reveal = function (tab) {   // keep the selected pill inside its own scrolling row; never scroll the page
      var a = tab.getBoundingClientRect(), b = list.getBoundingClientRect();
      var pad = parseFloat(window.getComputedStyle(list).paddingLeft) || 0;
      if (a.left < b.left + pad) list.scrollBy({ left: a.left - b.left - pad, behavior: DX.reduced() ? 'auto' : 'smooth' });
      else if (a.right > b.right - pad) list.scrollBy({ left: a.right - b.right + pad, behavior: DX.reduced() ? 'auto' : 'smooth' });
    };
    var select = function (n, opts) {
      if (n === current) return;
      current = n;
      tabs.forEach(function (tab, k) {
        tab.setAttribute('aria-selected', String(k === n));
        tab.tabIndex = k === n ? 0 : -1;
        // A panel that is not showing is inert: out of reach, and the state the styles read. (It keeps its box, so the stage
        // holds the tallest panel; `hidden` would take it out of the layout.)
        if (k === n) panels[k].removeAttribute('inert'); else panels[k].setAttribute('inert', '');
      });
      if (marker) marker.to(tabs[n]);
      reveal(tabs[n]);
      if (DX.filmSync) DX.filmSync();   // a film in a panel that is no longer showing pauses (dx.js also watches `inert`)
      if (opts && opts.address && window.history && window.history.replaceState) {
        window.history.replaceState(window.history.state, '', '#' + panels[n].id);
      }
    };
    var fromAddress = function () {
      var id = window.location.hash.slice(1);
      for (var n = 0; n < panels.length; n++) if (panels[n].id === id) return n;
      return -1;
    };

    tabs.forEach(function (tab, n) {
      tab.addEventListener('click', function (ev) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;   // a new tab or window opens the panel's address as usual
        ev.preventDefault();
        select(n, { address: true });
      });
      tab.addEventListener('keydown', function (ev) {
        var to = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? (n + 1) % tabs.length
          : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? (n - 1 + tabs.length) % tabs.length
          : ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1
          : ev.key === ' ' || ev.key === 'Spacebar' ? n : -1;
        if (to < 0) return;
        ev.preventDefault();
        select(to, { address: true });
        tabs[to].focus({ preventScroll: true });
      });
    });

    var start = fromAddress();
    select(start < 0 ? 0 : start);
    // An address that names a panel opens it and lands on the section (heading, tabs and stage), not part-way down the stage.
    var land = function () { root.scrollIntoView({ block: 'start' }); };
    if (start >= 0) { land(); window.addEventListener('load', land); }
    window.addEventListener('hashchange', function () {
      var n = fromAddress();
      if (n >= 0) { select(n); land(); }
    });
    settle(root);
  });

  /* ---------- StickyScenes ---------- */
  DX.mount('[data-dx-sticky-scenes]', function (root) {
    var items = root.querySelectorAll('.nu-sticky-scenes__item');
    var copies = root.querySelectorAll('.nu-sticky-scenes__copy');
    var progress = root.querySelector('.nu-sticky-scenes__progress');
    if (items.length < 2 || !('IntersectionObserver' in window)) return;
    var marker = progress && DX.indicator ? DX.indicator(progress) : null;   // the progress mark: one segment that glides
    var shown = -1;
    var set = function (n) {
      if (n === shown) return;
      shown = n;
      mark([items], n);
      if (marker) marker.to(progress.children[n] || null);
    };
    set(0);
    // The line a chapter takes over at: the pinned frame's top edge (Zach 11-16: at the middle of the window, a portrait frame
    // and compact chapters meant the second chapter had already passed the line when the frame pinned, so the first picture was
    // never seen whole). The last chapter whose first line has risen to the frame's top is the one showing, so every chapter
    // holds its picture for one whole step, and the frame lets go at the same line. Where nothing pins (phones), the middle of
    // the window. The observed zone runs from far above the window down to the line, so a jump (an anchor, Home) reads like a
    // scroll; it is measured again when the window changes size.
    var heads = Array.prototype.map.call(copies, function (c) { return c.firstElementChild || c; });
    var media = root.querySelector('.nu-sticky-scenes__media');
    var passed = [], io = null;
    var watch = function () {
      if (io) io.disconnect();
      passed = [];
      var pinned = media && getComputedStyle(media).position === 'sticky';
      var line = pinned ? parseFloat(getComputedStyle(media).top) + 2 : window.innerHeight / 2;
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { passed[heads.indexOf(en.target)] = en.isIntersecting; });
        var n = 0;
        for (var k = 0; k < heads.length; k++) if (passed[k]) n = k;
        set(n);
      }, { root: DX.view, rootMargin: '99999px 0px ' + -Math.max(0, Math.round(window.innerHeight - line)) + 'px 0px', threshold: 0 });
      heads.forEach(function (h) { io.observe(h); });
    };
    watch();
    var sized = 0;
    window.addEventListener('resize', function () { clearTimeout(sized); sized = setTimeout(watch, 150); });
    // Focus inside a chapter (Tab reaches its link before its first line crosses the middle) makes it the chapter showing.
    each(copies, function (copy, n) { copy.addEventListener('focusin', function () { set(n); }); });
    settle(root);
  });

  /* ---------- IndexRows ---------- */
  DX.mount('[data-dx-index-rows]', function (root) {
    var rows = root.querySelectorAll('.nu-index-rows__row');
    var pics = root.querySelectorAll('.nu-index-rows__picture');
    if (!pics.length || pics.length !== rows.length) return;
    var set = function (n) { mark([pics], n); };
    set(0);   // a current picture is what switches the pinned frame on (the rows carry thumbnails without it)
    each(rows, function (row, n) {
      row.addEventListener('pointerenter', function (ev) { if (ev.pointerType !== 'touch') set(n); });
      row.addEventListener('focus', function () { set(n); });
    });
    // Rows that are not links cannot take focus, so with those the row crossing the middle of the window chooses for everyone.
    var passive = !root.querySelector('a.nu-index-rows__row');
    crossing(rows, set, function () { return byTouch() || (passive && wide.matches); });
  });

  /* ---------- IndexRows --disclose, rows grouped by name (exclusive=True) ----------
     Opening a row closes the open one. When that one is above the row the reader clicked, it closes with no glide and the
     page is held by the same amount in the same frame, so the clicked row stays where it was clicked; its own panel glides
     open as usual. (A row closing below the clicked one moves nothing the reader holds.) */
  DX.mount('[data-dx-sets-disclose]', function (root) {
    var rows = Array.prototype.slice.call(root.querySelectorAll('details'));
    rows.forEach(function (row, n) {
      var summary = row.querySelector('summary');
      if (!summary) return;
      summary.addEventListener('click', function (ev) {
        if (row.open || ev.defaultPrevented) return;
        var above = rows.slice(0, n).filter(function (r) { return r.open; });
        if (!above.length) return;
        var before = summary.getBoundingClientRect().top;
        above.forEach(function (r) { r.setAttribute('data-disclose-still', ''); });   // css/motion.css: no glide
        window.requestAnimationFrame(function () {   // after the browser has opened this row and closed the other
          var moved = summary.getBoundingClientRect().top - before;
          if (Math.abs(moved) > 1) window.scrollBy({ top: moved, behavior: 'instant' });
          window.requestAnimationFrame(function () { above.forEach(function (r) { r.removeAttribute('data-disclose-still'); }); });
        });
      });
    });
  });

  /* ---------- NameWall ---------- */
  DX.mount('[data-dx-name-wall]', function (root) {
    var names = root.querySelectorAll('.nu-name-wall__name');
    var pics = root.querySelectorAll('.nu-name-wall__picture');
    var caps = root.querySelectorAll('.nu-name-wall__caption');
    if (names.length < 2 || pics.length !== names.length) return;
    var set = function (n) { mark([names, pics, caps], n); };
    var lead = 0;
    each(pics, function (pic, n) { if (pic.getAttribute('aria-current') === 'true') lead = n; });
    set(lead);   // a current name is what switches the pinned form on (without it the wall is a plain list)
    each(names, function (name, n) {
      name.addEventListener('pointerenter', function (ev) { if (ev.pointerType !== 'touch' && wide.matches) set(n); });
      name.addEventListener('focus', function () { if (wide.matches) set(n); });
    });
    crossing(names, set, byTouch);
  });

  /* Filmstrip and MixedRail: the rail itself ([data-dx-rail]) is shared behaviour and lives in dx.js. */
})();
