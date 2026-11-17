/* dx.js: the shared behaviour of the design system's section patterns and motion layer (homepage/design-system/css/motion.css;
   docs/BUILDER-GUIDE.md, "Section patterns"). build.py links every build/js file on every page, so everything here returns early
   unless its hook is on the page. Nothing here runs per frame while the page scrolls: scroll-linked effects are CSS scroll-driven
   animations, and state changes come from IntersectionObserver.

   DX.mount(selector, init)  run init(root) once for each element matching selector; the convention for a pattern's own behaviour:
                             DX.mount('[data-dx-<family>-<name>]', function (root) { ... });  (a hook belongs to one file: build/dxcheck.py)
   DX.reduced()              true while the reader asks for reduced motion (re-read it; it can change).
   DX.ms(token[, el])        a duration token in milliseconds, read from the stylesheet (never hard-code a time).
   DX.indicator(row)         the one moving marker of a row of choices ([data-indicator]): returns { to(item | null), refresh() }.
   DX.glide(target[, hash])  glide to an element (instant under reduced motion), keep the address, move focus there.
   Reveal                    [data-reveal] and the children of [data-reveal-stagger] arrive once as they scroll into view. Only
                             elements below the fold at load are armed, so nothing flashes and the page reads in order without
                             this file; anything passed in a jump arrives too.
   [data-rise]               opt-in: a hero headline's lines rise once on load behind a line mask.
   [data-dx-rail]            a sideways rail: paddles that disable at the ends, a progress line, a count of the items in
                             view ("1–3 of 10"), 1:1 mouse drag, an item focused by the keyboard brought wholly into view
                             ([data-dx-rail-track], -controls, -progress, -count, -prev, -next; the script sets -on while the
                             rail can travel and -dragging during a drag). Controls show only when the rail can travel at
                             least one item's width.
   [data-film-poster]        an <img> over a <video>: fades out when the film's first frame plays.
   [data-dx-player]          FilmPlayer (molecules/film-player; _dx.film), the one film of the library. "loop": a muted loop that
                             plays only while it is in view and showing (never under reduced motion), with one pause toggle that
                             is always shown. "sound": plays in place on click, with a control bar. The poster is held until the
                             film shows a picture (data-film-start: the second its picture begins; a loop first starts there).
                             data-film-state on the root: idle | playing | paused | ended. DX.filmSync() re-reads every loop.
   In-page links             a link to an id on the same page glides there (per click; there is no global smooth scrolling).
   Deep links                a page opened with a #hash lands on its target again once the web fonts are in (they re-wrap the text
                             above it), unless the reader has touched the page.
   Disclosure                every <details>: a #hash inside a closed row opens it; [data-disclose-all] (and Accordion's toggle) is
                             Expand all / Collapse all for its [data-disclose-group]; [data-disclose-long] keeps a long open row's
                             summary in view; rows print open. DX.discloseTo(element) opens the rows around an element. */
(function () {
  'use strict';
  var DX = window.DX = window.DX || {};
  // The root every scroll trigger measures against: this document's own window. With no root, a page inside a cross-origin frame
  // (the claude.ai artifact) is measured against the top window and its rootMargin is ignored, so a line drawn partway down the
  // window became the window's edge: StickyScenes changed chapter as soon as the next heading came into view (Zach 11-17).
  // Older browsers that refuse a document root keep the implicit one.
  DX.view = (function () { try { new IntersectionObserver(function () {}, { root: document }); return document; } catch (e) { return null; } })();
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function (fn) { return window.setTimeout(fn, 16); };
  DX.reduced = function () { return mq.matches; };
  DX.ms = function (token, el) {
    var v = window.getComputedStyle(el || document.documentElement).getPropertyValue(token).trim();
    var n = parseFloat(v) || 0;
    return /ms$/.test(v) ? n : n * 1000;
  };
  DX.mount = function (selector, init) {
    var roots = document.querySelectorAll(selector);
    for (var n = 0; n < roots.length; n++) {
      var root = roots[n];
      if (root.__dx && root.__dx[selector]) continue;
      (root.__dx = root.__dx || {})[selector] = true;
      try { init(root); } catch (err) { if (window.console) console.error('dx: ' + selector, err); }
    }
  };

  /* ---------- Indicator: one marker that glides between the items of a row ---------- */
  DX.indicator = function (row) {
    var current = null, live = false;
    var place = function () {
      if (!current || !current.isConnected) { row.removeAttribute('data-indicator-on'); return; }
      var r = row.getBoundingClientRect(), c = current.getBoundingClientRect();
      var w = Math.max(row.scrollWidth, row.clientWidth), h = Math.max(row.scrollHeight, row.clientHeight);
      var left = c.left - r.left - row.clientLeft + row.scrollLeft, top = c.top - r.top - row.clientTop + row.scrollTop;
      var set = function (name, v) { row.style.setProperty(name, v.toFixed(2) + 'px'); };
      set('--indicator-span', w);
      set('--indicator-start', left);
      set('--indicator-end', w - left - c.width);
      set('--indicator-top', top);
      set('--indicator-bottom', h - top - c.height);
      row.setAttribute('data-indicator-on', '');
    };
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(row);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    return {
      to: function (item) {
        current = item || null;
        place();
        if (!live && current) { live = true; raf(function () { raf(function () { row.setAttribute('data-indicator-live', ''); }); }); }
      },
      refresh: place
    };
  };

  /* ---------- Glide: a chosen section comes to the top of the window, the address follows, focus moves there ----------
     A glide never keeps the reader waiting: the browser's own glide takes about half a second a screen (1.5s across a long
     page), so a target farther than a screen and a half is reached by a jump to one screen short of it and a glide over
     that last screen (about 0.5s). Nearer targets glide the whole way (0.6s at most). */
  DX.glide = function (target, hash) {
    if (!target || !target.scrollIntoView) return;
    if (DX.discloseTo) DX.discloseTo(target);     // a target inside a closed row: the row opens first
    var waiting = target.closest('.is-waiting');   // a section still waiting to arrive is shown at once: the reader asked for it
    if (waiting) waiting.classList.remove('is-waiting');
    if (!DX.reduced()) {
      var h = window.innerHeight, root = document.documentElement;
      var pad = (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
      var to = Math.max(0, Math.min(root.scrollHeight - h, target.getBoundingClientRect().top + window.scrollY - pad));
      var far = to - window.scrollY;
      if (Math.abs(far) > 1.5 * h) window.scrollTo(window.scrollX, to - (far > 0 ? h : -h));   // instant: the root has no smooth scroll-behavior
    }
    target.scrollIntoView({ behavior: DX.reduced() ? 'auto' : 'smooth', block: 'start' });
    if (hash && window.history && window.history.pushState) window.history.pushState(null, '', hash);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target.closest ? ev.target.closest('main a[href^="#"]') : null;
    if (!a || a.getAttribute('role') === 'tab' || a.hash.length < 2) return;
    var target = document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!target || target.closest('[hidden]')) return;
    ev.preventDefault();
    DX.glide(target, a.hash);
  });

  /* ---------- Film: the poster gives way to the film on its first frame ---------- */
  document.addEventListener('playing', function (ev) {
    var frame = ev.target && ev.target.parentElement;
    if (frame && !frame.hasAttribute('data-dx-player') && !frame.hasAttribute('data-film-playing') && frame.querySelector(':scope > [data-film-poster]')) frame.setAttribute('data-film-playing', '');
  }, true);

  /* ---------- FilmPlayer: the one film behaviour of the library (molecules/film-player; _dx.film) ---------- */
  var onMotion = function (fn) { if (mq.addEventListener) mq.addEventListener('change', fn); };
  var clock = function (s) { return isFinite(s) ? Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2) : '0:00'; };
  // A play() the reader interrupts (a second click, a pause) rejects with AbortError: that is not a failure.
  var attempt = function (video, failed) {
    var p = video.play();
    if (p && p.catch) p.catch(function (err) { if (failed && !(err && err.name === 'AbortError')) failed(); });
  };
  var loops = [];
  DX.filmSync = function () { loops.forEach(function (fn) { fn(); }); };   // after a pattern shows or hides a film itself
  // A loop inside something made inert (a tab panel that is not showing) rests; it is re-read whenever inert changes.
  if ('MutationObserver' in window) {
    var inertWatch = function () {
      if (loops.length) new MutationObserver(DX.filmSync).observe(document.body, { attributes: true, attributeFilter: ['inert', 'hidden'], subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inertWatch);
    else window.setTimeout(inertWatch, 0);
  }
  DX.mount('[data-dx-player]', function (root) {
    var video = root.querySelector('video');
    // The toggle is the player's own, or (a pattern that places it elsewhere: _dx.film(control=False) + _dx.film_control())
    // the one in the same section that belongs to no player.
    var toggle = root.querySelector('[data-dx-player-toggle]');
    if (!toggle) {
      toggle = [].filter.call((root.closest('.nu-section') || document).querySelectorAll('[data-dx-player-toggle]'), function (el) {
        return !el.closest('[data-dx-player]') && !el.__dxFilm;
      })[0];
      if (toggle) toggle.__dxFilm = true;
    }
    if (!video || !toggle) return;
    var state = function (s) { if (root.getAttribute('data-film-state') !== s) root.setAttribute('data-film-state', s); };
    video.removeAttribute('controls');

    // The poster hands off to the film only when the film shows a picture: past data-film-start (the second its picture
    // begins, for a film that opens on black) and a short hold; with no start given, once the frame is no longer black
    // where it can be read, and never later than two scene lengths. (A film that fades up from black would otherwise cross-fade to black.)
    var start = Math.max(0, parseFloat(root.getAttribute('data-film-start')) || 0);
    var hold = DX.ms('--film-player-hold', root) / 1000;
    var wait = 2 * DX.ms('--dur-scene', root) / 1000;
    var probe = null;
    var lit = function () {
      try {
        if (!probe) { probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); probe.canvas.width = 16; probe.canvas.height = 9; }
        probe.drawImage(video, 0, 0, 16, 9);
        var d = probe.getImageData(0, 0, 16, 9).data, sum = 0;
        for (var n = 0; n < d.length; n += 4) sum += d[n] * 0.2126 + d[n + 1] * 0.7152 + d[n + 2] * 0.0722;
        return sum / (d.length / 4) > 40;   // of 255: a frame this dark is still the fade from black
      } catch (err) { return true; }        // a frame that cannot be read (another origin) counts as a picture
    };
    var handoff = function () {
      if (root.hasAttribute('data-film-playing') || video.paused || video.ended) return;
      var t = video.currentTime - start;
      if (t >= hold && (start > 0 || t >= wait || lit())) root.setAttribute('data-film-playing', '');
    };
    video.addEventListener('timeupdate', handoff);

    if (root.getAttribute('data-dx-player') === 'loop') {
      // The reader's wish (the toggle) and the page's (in view, showing, motion allowed) decide together.
      var wanted = !DX.reduced();
      var inView = false;
      video.muted = true;
      toggle.hidden = false;
      if (toggle.parentElement && toggle.parentElement.hidden) toggle.parentElement.hidden = false;
      var show = function () {
        var paused = video.paused;
        toggle.setAttribute('aria-pressed', String(paused));
        state(paused ? 'paused' : 'playing');
      };
      var apply = function () {
        if (wanted && inView && !root.closest('[inert],[hidden]')) attempt(video, function () { wanted = false; });
        else if (!video.paused) video.pause();
      };
      // A film that opens on black starts where its picture begins (the first time only: it then loops whole, as it was cut).
      if (start) video.addEventListener('loadedmetadata', function () { if (video.currentTime < start) video.currentTime = start; }, { once: true });
      toggle.addEventListener('click', function () { wanted = video.paused; apply(); });
      video.addEventListener('play', show);
      video.addEventListener('pause', show);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          inView = entries[entries.length - 1].isIntersecting;
          apply();
        }, { threshold: 0.25 }).observe(root);
      } else { inView = true; apply(); }
      onMotion(function () { wanted = !DX.reduced(); apply(); });
      loops.push(apply);
      toggle.setAttribute('aria-pressed', 'true');
      state('paused');
      return;
    }

    var play = root.querySelector('[data-dx-player-play]');
    var bar = root.querySelector('[data-dx-player-bar]');
    if (!play || !bar) { video.setAttribute('controls', ''); return; }
    var seek = bar.querySelector('[data-dx-player-seek]');
    var fill = bar.querySelector('[data-dx-player-fill]');
    var now = bar.querySelector('[data-dx-player-now]');
    var total = bar.querySelector('[data-dx-player-total]');
    var mute = bar.querySelector('[data-dx-player-mute]');
    var captions = bar.querySelector('[data-dx-player-captions]');
    var full = bar.querySelector('[data-dx-player-full]');
    var name = play.getAttribute('aria-label') || '';
    play.hidden = false;
    bar.hidden = false;
    state('idle');

    var flip = function () { if (video.paused || video.ended) attempt(video); else video.pause(); };
    var rest;
    var wake = function () {
      root.removeAttribute('data-film-rest');
      window.clearTimeout(rest);
      if (!video.paused) rest = window.setTimeout(function () { root.setAttribute('data-film-rest', ''); }, DX.ms('--dur-scene', root) * 2);
    };
    // The played part of the seek line and the time: the bar only scales, and the time is written when it changes.
    var shown = '';
    var paint = function () {
      var p = video.duration ? video.currentTime / video.duration : 0;
      if (fill) fill.style.setProperty('--film-progress', p.toFixed(4));
      var t = clock(video.currentTime);
      if (t === shown) return;
      shown = t;
      if (now) now.textContent = t;
      if (seek) seek.setAttribute('aria-valuetext', t + ' of ' + clock(video.duration));
    };
    play.addEventListener('click', function () {
      state('playing');  // the bar shows at once, so the press is answered and focus has somewhere to go
      toggle.setAttribute('aria-pressed', 'false');
      attempt(video, function () { state(video.ended ? 'ended' : 'idle'); play.focus({ preventScroll: true }); });
      toggle.focus({ preventScroll: true });
    });
    video.addEventListener('click', flip);
    toggle.addEventListener('click', flip);
    video.addEventListener('play', function () { state('playing'); play.setAttribute('aria-label', name); toggle.setAttribute('aria-pressed', 'false'); wake(); });
    video.addEventListener('pause', function () { if (!video.ended) state('paused'); toggle.setAttribute('aria-pressed', 'true'); wake(); });
    video.addEventListener('ended', function () {
      // Back to the poster, in the same cross-fade, with the play mark; focus goes back to it if the bar held it.
      var held = bar.contains(document.activeElement);
      state('ended');
      root.removeAttribute('data-film-playing');
      root.removeAttribute('data-film-rest');
      window.clearTimeout(rest);
      play.setAttribute('aria-label', name.replace(/^Play the film/, 'Play the film again'));
      if (held) play.focus({ preventScroll: true });
    });
    video.addEventListener('loadedmetadata', function () { if (total) total.textContent = clock(video.duration); paint(); });
    video.addEventListener('timeupdate', function () {
      if (seek && !root.hasAttribute('data-film-seeking')) seek.value = Math.round((video.duration ? video.currentTime / video.duration : 0) * 1000);
      paint();
    });
    if (seek) {
      seek.addEventListener('input', function () {
        root.setAttribute('data-film-seeking', '');
        if (video.duration) video.currentTime = (seek.value / 1000) * video.duration;
        if (fill) fill.style.setProperty('--film-progress', (seek.value / 1000).toFixed(4));
      });
      var settle = function () { root.removeAttribute('data-film-seeking'); };
      seek.addEventListener('change', settle);
      seek.addEventListener('blur', settle);
    }
    if (mute) mute.addEventListener('click', function () { video.muted = !video.muted; mute.setAttribute('aria-pressed', String(video.muted)); });
    else {
      // A film built without a captions track has no sound control (_dx.film): it stays muted whatever asks for sound.
      video.muted = true;
      video.addEventListener('volumechange', function () { if (!video.muted) video.muted = true; });
    }
    // Captions: shown only when the film carries a track; the button is the track's on and off.
    var tracks = [].filter.call(video.textTracks || [], function (t) { return t.kind === 'captions' || t.kind === 'subtitles'; });
    if (captions && tracks.length) {
      captions.hidden = false;
      var on = tracks.some(function (t) { return t.mode === 'showing'; });
      captions.setAttribute('aria-pressed', String(on));
      captions.addEventListener('click', function () {
        on = !on;
        tracks.forEach(function (t, n) { t.mode = on && n === 0 ? 'showing' : 'hidden'; });
        captions.setAttribute('aria-pressed', String(on));
      });
    }
    if (full) {
      // The iPhone's own full screen brings native controls (and their sound): a silent film offers only the frame's.
      if (!root.requestFullscreen && (!mute || !video.webkitEnterFullscreen)) full.hidden = true;
      full.addEventListener('click', function () {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (root.requestFullscreen) root.requestFullscreen();
        else if (mute && video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      });
    }
    root.addEventListener('pointermove', wake);
    root.addEventListener('focusin', wake);
    root.addEventListener('keydown', wake);
  });

  /* ---------- Rails ---------- */
  DX.mount('[data-dx-rail]', function (root) {
    var track = root.querySelector('[data-dx-rail-track]');
    var prev = root.querySelector('[data-dx-rail-prev]');
    var next = root.querySelector('[data-dx-rail-next]');
    var progress = root.querySelector('[data-dx-rail-progress]');
    var controls = root.querySelector('[data-dx-rail-controls]');
    if (!track) return;
    // The line follows the scroll itself where the browser can drive it, except under reduced motion: there it is set from
    // here when the scroll comes to rest, and does not move while the rail does (molecules/rail-controls.css stops the drive).
    var drives = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()') && CSS.supports('timeline-scope: --x'));
    var behavior = function () { return DX.reduced() ? 'auto' : 'smooth'; };
    var pads = function () {
      var cs = window.getComputedStyle(track);
      return { left: parseFloat(cs.paddingLeft) || 0, right: parseFloat(cs.paddingRight) || 0 };
    };
    var starts = function () {   // each item's scroll position when it sits on the content edge
      var box = track.getBoundingClientRect(), pad = pads().left, max = track.scrollWidth - track.clientWidth;
      return Array.prototype.map.call(track.children, function (el) {
        return Math.min(max, Math.max(0, el.getBoundingClientRect().left - box.left + track.scrollLeft - pad));
      });
    };
    // A paddle at its end is disabled. If it holds the keyboard's focus at that moment it stays focusable and says so
    // (aria-disabled) until focus leaves it, so the keyboard never drops out of the rail and never jumps to the other paddle.
    var setDisabled = function (button, off) {
      if (!button) return;
      if (off && document.activeElement === button) { button.disabled = false; button.setAttribute('aria-disabled', 'true'); return; }
      button.removeAttribute('aria-disabled');
      button.disabled = off;
    };
    var off = function (button) { return button.disabled || button.getAttribute('aria-disabled') === 'true'; };
    var count = root.querySelector('[data-dx-rail-count]');
    var counted = '';
    var sync = function () {   // state, not animation: called when the rail's size changes and when a scroll comes to rest
      var max = track.scrollWidth - track.clientWidth;
      var items = track.children, box = track.getBoundingClientRect(), p = pads(), narrow = Infinity, first = -1, last = -1;
      for (var n = 0; n < items.length; n++) {
        var r = items[n].getBoundingClientRect();
        if (r.width) narrow = Math.min(narrow, r.width);
        if (r.left >= box.left + p.left - 1 && r.right <= box.right - p.right + 1) { if (first < 0) first = n; last = n; }
      }
      // Controls only when the rail can travel at least one item's width: for a sliver of overflow the cut-off item says
      // enough, and swipe, drag and the keyboard still reach it.
      if (controls) controls.hidden = max <= 1 || max < narrow - 1;
      // The rail drags only when there is somewhere to go (the grab cursor: molecules/rail-controls.css).
      if (max > 1) root.setAttribute('data-dx-rail-on', ''); else root.removeAttribute('data-dx-rail-on');
      setDisabled(prev, track.scrollLeft <= 1);
      setDisabled(next, track.scrollLeft >= max - 1);
      if (count) {   // which items are wholly in view on the content width, of how many: "1–3 of 10" (the leading one when none is)
        if (first < 0) for (var k = 0; k < items.length; k++) { if (items[k].getBoundingClientRect().right > box.left + p.left + 1) { first = last = k; break; } }
        var text = first < 0 ? '' : (first === last ? String(first + 1) : (first + 1) + '–' + (last + 1)) + ' of ' + items.length;
        if (text !== counted) { counted = text; count.textContent = text; }
      }
      if (progress) {
        var share = track.scrollWidth ? track.clientWidth / track.scrollWidth : 1;
        progress.style.setProperty('--rail-start', share.toFixed(4));
        if (!drives || DX.reduced()) progress.style.setProperty('--value', (max > 0 ? (track.scrollLeft + track.clientWidth) / track.scrollWidth : 1).toFixed(4));
      }
    };
    [prev, next].forEach(function (button) {
      if (button) button.addEventListener('blur', function () { if (button.getAttribute('aria-disabled') === 'true') setDisabled(button, true); });
    });
    var page = function (dir) {
      var p = pads(), span = track.clientWidth - p.left - p.right, at = track.scrollLeft, list = starts(), to;
      if (dir > 0) {   // the first item that is not yet fully in view becomes the first one showing
        var box = track.getBoundingClientRect();
        to = list[list.length - 1];
        for (var n = 0; n < track.children.length; n++) {
          if (list[n] > at + 1 && track.children[n].getBoundingClientRect().right > box.right - p.right + 1) { to = list[n]; break; }
        }
      } else {         // back by one screenful, landing on an item's edge
        to = 0;
        for (var k = 0; k < list.length; k++) { if (list[k] >= at - span - 1) { to = list[k]; break; } }
      }
      track.scrollTo({ left: to, behavior: behavior() });
    };
    if (prev) prev.addEventListener('click', function () { if (!off(prev)) page(-1); });
    if (next) next.addEventListener('click', function () { if (!off(next)) page(1); });
    // The ends: the first and last items report when they are wholly in view (no scroll listener). Where the browser cannot
    // drive the progress line from the scroll itself, the line is set when the scroll comes to rest.
    if ('IntersectionObserver' in window && track.children.length) {
      var io = new IntersectionObserver(sync, { root: track, threshold: [0, 0.5, 0.98, 1] });
      io.observe(track.firstElementChild);
      io.observe(track.lastElementChild);
    }
    var resting = 0;
    var rest = function () { window.clearTimeout(resting); resting = window.setTimeout(sync, 90); };
    if ('onscrollend' in window) track.addEventListener('scrollend', sync);
    else track.addEventListener('scroll', rest, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(sync).observe(track);
    else window.addEventListener('resize', sync);
    window.addEventListener('load', sync);
    sync();
    // The keyboard: an item that takes focus while it is cut off by either edge comes wholly into view, on the content edge
    // (never for a pointer's focus: the rail must not move under a click or at the start of a drag).
    track.addEventListener('focusin', function (ev) {
      var t = ev.target;
      if (!t.matches || !t.matches(':focus-visible')) return;
      var item = t;
      while (item && item.parentElement !== track) item = item.parentElement;
      if (!item) return;
      var box = track.getBoundingClientRect(), p = pads(), r = item.getBoundingClientRect();
      if (r.left >= box.left + p.left - 1 && r.right <= box.right - p.right + 1) return;
      track.scrollTo({ left: starts()[Array.prototype.indexOf.call(track.children, item)], behavior: behavior() });
    });

    // Drag with the mouse, 1:1. Touch and trackpads already scroll the rail natively.
    var drag = null;
    var settleTimer = 0;
    var restore = function () { track.style.scrollSnapType = ''; };
    track.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
    track.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
      window.clearTimeout(settleTimer);
      drag = { x: ev.clientX, left: track.scrollLeft, moved: false, last: ev.clientX, v: 0, t: ev.timeStamp };
    });
    window.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 6) return;
      if (!drag.moved) {
        drag.moved = true;
        track.style.scrollSnapType = 'none';
        root.setAttribute('data-dx-rail-dragging', '');   // the grabbing cursor, over the cards too (molecules/rail-controls.css)
        track.style.userSelect = 'none';
      }
      var dt = Math.max(1, ev.timeStamp - drag.t);
      drag.v = (ev.clientX - drag.last) / dt;
      drag.last = ev.clientX;
      drag.t = ev.timeStamp;
      track.scrollLeft = drag.left - dx;
    });
    var release = function () {
      if (!drag) return;
      var d = drag;
      drag = null;
      if (!d.moved) return;
      root.removeAttribute('data-dx-rail-dragging');
      track.style.userSelect = '';
      // Land on the item edge nearest to where the throw would carry the rail, then hand back to native snapping.
      var aim = track.scrollLeft - d.v * DX.ms('--dur-fast'), list = starts(), to = list[0] || 0;
      list.forEach(function (s) { if (Math.abs(s - aim) < Math.abs(to - aim)) to = s; });
      track.scrollTo({ left: to, behavior: behavior() });
      settleTimer = window.setTimeout(restore, DX.reduced() ? 0 : DX.ms('--dur-slow'));
      // The click that ends a drag is not a click on the card under the pointer.
      var swallow = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
      track.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(function () { track.removeEventListener('click', swallow, { capture: true }); }, 0);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  });

  /* ---------- Disclosure: the one behaviour of everything that folds (css/motion.css "Disclosure") ----------
     Rows are native <details> ([data-disclose]; an AccordionItem is one): they fold and read without this block. It adds:
     open on #hash (a row, its summary, or anything inside a closed row; every <details> on the page), Expand all / Collapse all
     ([data-disclose-all] or .nu-accordion__toggle, for the rows of its [data-disclose-group] / .nu-accordion), a summary that
     stays in view over a long open row ([data-disclose-long]), rows open on paper (beforeprint), and DX.discloseTo(element). */
  var still = function (el, fn) {   // change rows with no glide: the result is in place at once (a jump target must not move)
    el.setAttribute('data-disclose-still', '');
    fn();
    raf(function () { raf(function () { el.removeAttribute('data-disclose-still'); }); });
  };
  DX.discloseTo = function (el) {   // open every closed <details> around el (el may be the row, its summary, or inside either)
    var opened = false, d = el && el.closest ? (el.nodeName === 'DETAILS' ? el : el.closest('details')) : null;
    for (; d; d = d.parentElement ? d.parentElement.closest('details') : null) {
      if (!d.open) { opened = true; (function (row) { still(row, function () { row.open = true; }); })(d); }
    }
    return opened;
  };
  var pinTop = function () {   // the root's scroll padding: --pin-top plus one step of air, in px
    return parseFloat(window.getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  };
  var toHash = function () {
    if (window.location.hash.length < 2) return;
    var target = null;
    try { target = document.getElementById(decodeURIComponent(window.location.hash.slice(1))); } catch (err) { return; }
    if (target && DX.discloseTo(target)) target.scrollIntoView({ block: 'start' });   // the row is open now: land on it
  };
  window.addEventListener('hashchange', toHash);
  // A long open row keeps its summary in view (CSS); long is read once the row has finished opening.
  var long = function (d) {
    if (d.getAttribute('data-disclose-long') === 'keep') return;
    if (d.open && d.getBoundingClientRect().height > window.innerHeight) d.setAttribute('data-disclose-long', '');
    else d.removeAttribute('data-disclose-long');
  };
  var allControls = [];
  document.addEventListener('toggle', function (ev) {   // toggle does not bubble: capture
    var d = ev.target;
    if (!d || d.nodeName !== 'DETAILS') return;
    if (d.matches('[data-disclose],.nu-accordion-item')) window.setTimeout(function () { long(d); }, d.open ? DX.ms('--dur-base') + 60 : 0);
    allControls.forEach(function (c) { c(); });
  }, true);
  // Closing a row whose summary is travelling (its top is above the window): the row comes back to the top of the window
  // instead of leaving the reader in whatever followed it.
  document.addEventListener('click', function (ev) {
    var sum = ev.target.closest ? ev.target.closest('summary') : null, d = sum && sum.parentElement;
    if (!d || d.nodeName !== 'DETAILS' || !d.open || !d.hasAttribute('data-disclose-long') || ev.defaultPrevented) return;
    var top = d.getBoundingClientRect().top, pad = pinTop();
    if (top >= pad - 1) return;
    ev.preventDefault();
    still(d, function () { d.open = false; });
    window.scrollBy(0, d.getBoundingClientRect().top - pad);
  });
  // Paper: every row open, then back as it was.
  var printed = [];
  window.addEventListener('beforeprint', function () {
    Array.prototype.forEach.call(document.querySelectorAll('details:not([open])'), function (d) {
      d.setAttribute('data-disclose-still', ''); d.open = true; printed.push(d);
    });
  });
  window.addEventListener('afterprint', function () {
    printed.forEach(function (d) { d.open = false; raf(function () { d.removeAttribute('data-disclose-still'); }); });
    printed = [];
  });
  function disclosure() {
    DX.mount('[data-disclose-all],.nu-accordion__toggle', function (btn) {
      var named = btn.getAttribute('data-disclose-all');
      var group = (named && document.getElementById(named)) || btn.closest('[data-disclose-group],.nu-accordion') || btn.closest('.nu-section') || document.querySelector('main');
      var rows = function () { return group ? Array.prototype.slice.call(group.querySelectorAll('details')) : []; };
      // rows that close each other (<details name>) cannot all be open: no control is offered
      if (rows().length < 2 || rows().some(function (d) { return d.hasAttribute('name'); })) return;
      var label = btn.querySelector('[data-disclose-all-label]');
      if (!label) for (var n = btn.childNodes.length - 1; n >= 0 && !label; n--) if (btn.childNodes[n].nodeType === 3 && btn.childNodes[n].textContent.trim()) label = btn.childNodes[n];
      var words = [btn.getAttribute('data-disclose-open') || 'Expand all', btn.getAttribute('data-disclose-close') || 'Collapse all'];
      var read = function () {
        var open = rows().every(function (d) { return d.open; });
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (label && label.textContent.trim() !== words[open ? 1 : 0]) label.textContent = words[open ? 1 : 0];
      };
      btn.removeAttribute('aria-controls');   // the rows are found by the group, and no other script may take the button over
      btn.addEventListener('click', function (ev) {
        ev.stopImmediatePropagation();
        var open = btn.getAttribute('aria-expanded') !== 'true', before = btn.getBoundingClientRect().top;
        still(group, function () { rows().forEach(function (d) { d.open = open; }); });
        window.scrollBy(0, btn.getBoundingClientRect().top - before);   // the control stays under the finger
        read();
        rows().forEach(long);
      });
      allControls.push(read);
      read();
      btn.hidden = false;
    });
    toHash();
  }

  /* ---------- Rise: a hero headline's lines, once, on load ---------- */
  function rise() {
    DX.mount('[data-rise]', function (h) {
      if (DX.reduced() || h.getBoundingClientRect().top > window.innerHeight) return;
      var original = h.innerHTML;
      var plain = Array.prototype.every.call(h.childNodes, function (n) { return n.nodeType === 3 || n.nodeName === 'BR'; });
      var lines = [];
      if (plain && document.createRange) {   // read the lines the browser made, then set each as its own masked line
        var range = document.createRange(), line = null, top = null;
        Array.prototype.forEach.call(h.childNodes, function (node) {
          if (node.nodeType !== 3) return;
          var re = /\S+/g, m;
          while ((m = re.exec(node.textContent))) {
            range.setStart(node, m.index);
            range.setEnd(node, m.index + m[0].length);
            var y = Math.round(range.getBoundingClientRect().top);
            if (top === null || Math.abs(y - top) > 2) { line = []; lines.push(line); top = y; }
            line.push(m[0]);
          }
        });
      }
      var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
      var html = lines.length > 1
        ? lines.map(function (words, n) { return '<span class="dx-line" style="--rise-i:' + Math.min(n, 3) + '"><span>' + esc(words.join(' ')) + '</span></span>'; }).join(' ')
        : '<span class="dx-line"><span>' + original + '</span></span>';
      h.innerHTML = html;
      window.setTimeout(function () { h.innerHTML = original; }, DX.ms('--dur-slow') + 4 * DX.ms('--reveal-stagger') + 80);
    });
  }

  /* ---------- Reveal ---------- */
  function reveal() {
    // Pictures don't animate (Zach 11-17: "drop the image animations. it's weird how some do it and some don't"): an unmask stands still.
    var targets = document.querySelectorAll('[data-reveal]:not([data-reveal="unmask"]),[data-reveal-stagger]');
    if (!targets.length || DX.reduced() || !('IntersectionObserver' in window)) return;
    var waiting = [];
    var fold = window.innerHeight;
    Array.prototype.forEach.call(targets, function (el) {
      if (el.getBoundingClientRect().top < fold) return;  // already in view at load: leave it as it is
      if (el.hasAttribute('data-reveal-stagger') && el.children.length <= 6) {  // a short row steps in (four steps at most); a long one arrives as one
        for (var n = 0; n < el.children.length; n++) el.children[n].style.setProperty('--reveal-i', Math.min(n, 3));
      }
      el.classList.add('is-waiting');
      waiting.push(el);
    });
    if (!waiting.length) return;
    var hold = DX.ms('--dur-scene') + 4 * DX.ms('--reveal-stagger') + 50;
    // Anything whose top has come into the window, or been passed (a jump to an anchor or the end of the page), arrives.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) show(en.target); });
    }, { root: DX.view, rootMargin: '99999px 0px -8% 0px', threshold: 0 });
    function show(el) {
      io.unobserve(el);
      waiting = waiting.filter(function (w) { return w !== el; });
      el.classList.add('is-revealing');
      el.classList.remove('is-waiting');
      window.setTimeout(function () { el.classList.remove('is-revealing'); }, hold);
    }
    var all = function () { waiting.slice().forEach(function (el) { io.unobserve(el); el.classList.remove('is-waiting'); }); waiting = []; };
    waiting.forEach(function (el) { io.observe(el); });
    window.addEventListener('beforeprint', all);
    if (mq.addEventListener) mq.addEventListener('change', function () { if (mq.matches) all(); });
  }

  /* ---------- Deep links: land again once the web fonts are in ----------
     A page opened with a #hash is scrolled by the browser while the fallback face is up; when FF Real Head arrives the text
     above re-wraps and, where the browser does not anchor the scroll (Safari), the target is no longer where it landed. Once
     the fonts are ready the target is brought back to its place (the root's scroll-padding still clears the bars): once, and
     only if the address still names it and the reader has not touched the page since. base.css fits the fallback face to
     FF Real Head, so this is a correction of a line or two, not a jump. */
  (function () {
    var hash = window.location.hash;
    if (hash.length < 2 || !document.fonts || !document.fonts.ready) return;
    var touched = false, events = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    var touch = function () { touched = true; };
    events.forEach(function (n) { window.addEventListener(n, touch, true); });
    var land = function () {
      events.forEach(function (n) { window.removeEventListener(n, touch, true); });
      if (touched || window.location.hash !== hash) return;
      var target = null;
      try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (err) { /* not an id */ }
      if (target) raf(function () { target.scrollIntoView(); });
    };
    var wait = function () { document.fonts.ready.then(land); };  // after load: before it, `ready` can resolve with no font asked for yet
    if (document.readyState === 'complete') wait();
    else window.addEventListener('load', wait);
  })();

  var start = function () { disclosure(); rise(); reveal(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
