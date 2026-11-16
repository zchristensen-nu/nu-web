/* dx_maps.js: the maps family (build/pages/_dx_maps.py; organisms campus-globe, campus-atlas, map-wall).
   Every pattern reads without this file: the names are the content and each map is a still picture drawn at build time.
     [data-dx-maps-globe]   CampusGlobe: one canvas globe that turns (one ease of --dur-scene) to the name in hand; a mark under the
                            pointer or a tap lights its name (aria-current). Drawn only while on screen and changing. The tour
                            (opt-in) visits each place in turn while nobody is pointing; [data-dx-maps-pause] holds it
                            (aria-pressed="true" = held; held from the start under reduced motion). Reduced motion: the globe cuts.
     [data-dx-maps-atlas]   CampusAtlas: the names become a vertical tablist (arrows, Home, End), the entries' details one panel
                            each beside the map; a mark chooses its place; labels are placed so that none collides.
     [data-dx-maps-wall]    MapWall: a name in hand lights its place. */
(function () {
  'use strict';
  var DX = window.DX;
  if (!DX || !DX.mount) return;
  var RAD = Math.PI / 180;

  function keyOf(text) { return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  /* "hot": the place under the pointer or focus, on every mark that carries its key */
  function heat(root, key) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-dx-maps-mark]'), function (m) {
      if (m.getAttribute('data-dx-maps-mark') === key) m.setAttribute('data-hot', ''); else m.removeAttribute('data-hot');
    });
  }
  /* a list of links carrying data-dx-maps-key: pointer and focus call fn(key | null) */
  function follow(root, sel, fn) {
    var links = root.querySelectorAll(sel);
    Array.prototype.forEach.call(links, function (a) {
      var k = a.getAttribute('data-dx-maps-key');
      a.addEventListener('pointerenter', function (ev) { if (ev.pointerType !== 'touch') fn(k, a); });
      a.addEventListener('focus', function () { fn(k, a); });
      a.addEventListener('pointerleave', function (ev) { if (ev.pointerType !== 'touch' && document.activeElement !== a) fn(null, a); });
      a.addEventListener('blur', function () { fn(null, a); });
    });
    return links;
  }

  /* ---------------------------------------------------------------- CampusGlobe */
  var LAND = null;
  DX.mount('[data-dx-maps-globe]', function (root) {
    var canvas = root.querySelector('.nu-globe__canvas');
    var ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    if (!LAND) { var src = document.querySelector('[data-dx-maps-land]'); if (!src) return; LAND = JSON.parse(src.textContent); }
    var DATA = JSON.parse(root.querySelector('[data-dx-maps-data]').textContent);
    var PLACES = DATA.places.map(function (p) { return { key: p[0], lat: p[1], lon: p[2], name: p[3] }; });
    var BY = {}; PLACES.forEach(function (p) { BY[p.key] = p; });
    var links = Array.prototype.slice.call(root.querySelectorAll('.nu-globe__link'));
    var label = root.querySelector('.nu-globe__label');
    var pause = root.querySelector('[data-dx-maps-pause]');
    var cs = getComputedStyle(root), INK, GROUND, RED;
    function colours() { cs = getComputedStyle(root); INK = cs.getPropertyValue('--on-surface').trim(); GROUND = cs.getPropertyValue('--surface').trim(); RED = cs.getPropertyValue('--accent').trim(); }
    colours();
    var rest = { lon: DATA.view[0], lat: DATA.view[1] }, cur = { lon: rest.lon, lat: rest.lat }, from = null, to = null, t0 = 0;
    var active = null, hot = null, W = 0, R = 0, visible = false, raf = 0;
    var held = DX.reduced(), touching = false, timer = 0;

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; R = W / 2 - 1;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(W * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function project(lat, lon) {
      var p = lat * RAD, l = lon * RAD, p0 = cur.lat * RAD, l0 = cur.lon * RAD;
      var c = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0);
      return [W / 2 + R * Math.cos(p) * Math.sin(l - l0), W / 2 - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0)), c];
    }
    function rimArc(a0, a1) {
      var d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      ctx.arc(W / 2, W / 2, R, a0, a0 + d, d < 0);
    }
    function draw() {
      if (!W) return;
      var cx = W / 2, i, j;
      ctx.clearRect(0, 0, W, W);
      ctx.beginPath(); ctx.arc(cx, cx, R, 0, 7);
      ctx.fillStyle = INK; ctx.globalAlpha = 0.04; ctx.fill();
      ctx.strokeStyle = INK; ctx.globalAlpha = 0.16; ctx.lineWidth = 1; ctx.stroke();
      /* land: the visible runs of each ring, closed along the horizon by the shorter arc (as _geo.globe_still draws the still) */
      ctx.beginPath();
      for (i = 0; i < LAND.length; i++) {
        var ring = LAND[i], runs = [], run = [];
        for (j = 0; j < ring.length; j++) {
          var q = project(ring[j][1], ring[j][0]);
          if (q[2] > 0) run.push(q); else if (run.length) { runs.push(run); run = []; }
        }
        if (run.length) { if (runs.length && project(ring[0][1], ring[0][0])[2] > 0) runs[0] = run.concat(runs[0]); else runs.push(run); }
        if (!runs.length) continue;
        var whole = runs.length === 1 && runs[0].length === ring.length;
        for (j = 0; j < runs.length; j++) {
          var r = runs[j];
          r.forEach(function (pt, n) { if (n === 0 && j === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]); });
          if (!whole) {
            var last = r[r.length - 1], next = runs[(j + 1) % runs.length][0];
            rimArc(Math.atan2(last[1] - cx, last[0] - cx), Math.atan2(next[1] - cx, next[0] - cx));
          }
        }
        ctx.closePath();
      }
      ctx.globalAlpha = 0.11; ctx.fillStyle = INK; ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      /* the places: ink dots ringed in the ground; the one in hand red with an ink ring; the hot one larger */
      var shown = null;
      PLACES.forEach(function (p) {
        var q = project(p.lat, p.lon); p.q = q; if (q[2] <= 0.02) return;
        var on = p.key === active, big = on || p.key === hot, rr = big ? 5 : 3.5;
        ctx.beginPath(); ctx.arc(q[0], q[1], rr + 2, 0, 7); ctx.fillStyle = GROUND; ctx.fill();
        ctx.beginPath(); ctx.arc(q[0], q[1], rr, 0, 7); ctx.fillStyle = on ? RED : INK; ctx.fill();
        if (on) { ctx.beginPath(); ctx.arc(q[0], q[1], rr + 4.5, 0, 7); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
      });
      shown = hot ? BY[hot] : active ? BY[active] : null;
      if (shown && shown.q && shown.q[2] > 0.1) {
        if (label.textContent !== shown.name) label.textContent = shown.name;
        label.hidden = false;
        var lw = label.offsetWidth, lh = label.offsetHeight, x = shown.q[0] + 14, y = shown.q[1] - lh / 2;
        if (x + lw > W) x = shown.q[0] - 14 - lw;
        label.style.translate = Math.round(Math.max(0, x)) + 'px ' + Math.round(y) + 'px';
      } else label.hidden = true;
    }
    var ease = function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
    function frame(now) {
      raf = 0;
      if (!to) return;
      var d = DX.ms('--dur-scene', root) || 1, t = Math.min(1, (now - t0) / d), k = ease(t);
      var dl = ((to.lon - from.lon + 540) % 360) - 180;
      cur.lon = from.lon + dl * k; cur.lat = from.lat + (to.lat - from.lat) * k;
      draw();
      if (t < 1 && visible) raf = requestAnimationFrame(frame); else { cur.lon = to.lon; cur.lat = to.lat; to = null; draw(); }
    }
    function turn(p) {
      var target = p ? { lon: p.lon, lat: Math.max(-40, Math.min(50, p.lat * 0.75)) } : rest;
      if (DX.reduced() || !visible) { cur.lon = target.lon; cur.lat = target.lat; to = null; draw(); return; }
      from = { lon: cur.lon, lat: cur.lat }; to = target; t0 = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function choose(key, turnTo) {
      active = key;
      links.forEach(function (a) { if (a.getAttribute('data-dx-maps-key') === key) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      if (turnTo !== false) turn(BY[key]); else draw();
    }
    follow(root, '.nu-globe__link', function (k) { if (k) { stopTour(); choose(k); } else resumeTour(); });
    /* a mark under the pointer lights its name; a click or tap chooses it */
    function near(ev) {
      var b = canvas.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top, best = null, bd = 22 * 22;
      PLACES.forEach(function (p) { if (!p.q || p.q[2] <= 0.02) return; var dx = p.q[0] - x, dy = p.q[1] - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = p; } });
      return best;
    }
    canvas.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'touch') return;
      var p = near(ev), k = p ? p.key : null;
      canvas.style.cursor = p ? 'pointer' : '';
      if (k !== hot) {
        hot = k; draw();
        links.forEach(function (a) { if (a.getAttribute('data-dx-maps-key') === k) a.setAttribute('data-hot', ''); else a.removeAttribute('data-hot'); });
      }
    });
    canvas.addEventListener('pointerleave', function () { hot = null; links.forEach(function (a) { a.removeAttribute('data-hot'); }); draw(); });
    canvas.addEventListener('click', function (ev) { var p = near(ev); if (p) { stopTour(); choose(p.key); } });

    /* the tour (opt-in): one place after another while in view, nobody pointing and not held */
    function tick() {
      timer = 0;
      if (!DATA.tour || held || touching || !visible) return;
      var n = (PLACES.findIndex(function (p) { return p.key === active; }) + 1) % PLACES.length;
      choose(PLACES[n].key);
      timer = setTimeout(tick, DX.ms('--dur-loop', root) + DX.ms('--dur-scene', root));
    }
    function stopTour() { touching = true; clearTimeout(timer); timer = 0; }
    function resumeTour() { touching = false; if (!timer && DATA.tour && !held) timer = setTimeout(tick, DX.ms('--dur-loop', root)); }
    root.addEventListener('pointerenter', function () { if (DATA.tour) stopTour(); });
    root.addEventListener('pointerleave', function () { if (DATA.tour && !root.contains(document.activeElement)) resumeTour(); });
    if (pause) {
      if (!DATA.tour) pause.parentNode.remove();
      else {
        pause.hidden = false;
        pause.setAttribute('aria-pressed', held ? 'true' : 'false');
        pause.addEventListener('click', function () {
          held = !held; pause.setAttribute('aria-pressed', held ? 'true' : 'false');
          if (held) { clearTimeout(timer); timer = 0; } else { touching = false; tick(); }
        });
      }
    }

    root.classList.add('is-live');
    new IntersectionObserver(function (es) {
      visible = es[es.length - 1].isIntersecting;
      if (visible) { draw(); if (DATA.tour && !held && !timer && !touching) timer = setTimeout(tick, DX.ms('--dur-base', root)); }
    }, { threshold: 0.2 }).observe(root);
    if (window.ResizeObserver) new ResizeObserver(size).observe(canvas); else window.addEventListener('resize', size);
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { colours(); draw(); });
    size();
  });

  /* ---------------------------------------------------------------- CampusAtlas */
  DX.mount('[data-dx-maps-atlas]', function (root) {
    var items = Array.prototype.slice.call(root.querySelectorAll('.nu-campus-atlas__item'));
    var panels = root.querySelector('.nu-campus-atlas__panels');
    var map = root.querySelector('.nu-campus-atlas__map');
    var list = root.querySelector('.nu-campus-atlas__items');
    var marks = Array.prototype.slice.call(root.querySelectorAll('[data-dx-maps-mark]'));
    if (!items.length || !panels) return;
    list.setAttribute('role', 'tablist'); list.setAttribute('aria-orientation', 'vertical');
    var lab = root.getAttribute('aria-labelledby'); if (lab) list.setAttribute('aria-labelledby', lab);
    var tabs = items.map(function (li) {
      var h = li.querySelector('.nu-campus-atlas__name'), detail = li.querySelector('.nu-campus-atlas__detail');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'nu-campus-atlas__choose'; b.id = detail.id + '-tab';
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', detail.id); b.setAttribute('aria-selected', 'false'); b.tabIndex = -1;
      b.setAttribute('data-hover', ''); b.setAttribute('data-hover-line', '');
      while (h.firstChild) b.appendChild(h.firstChild);
      li.setAttribute('role', 'presentation');
      li.replaceChild(b, h);   /* the heading's text moves into the tab; the panel carries the name as its own title */
      detail.setAttribute('role', 'tabpanel'); detail.setAttribute('aria-labelledby', b.id); detail.tabIndex = 0; detail.hidden = true;
      panels.appendChild(detail);
      b._key = li.getAttribute('data-dx-maps-key');
      return b;
    });
    var current = null;
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      marks.forEach(function (m) { if (m.getAttribute('data-dx-maps-mark') === tab._key) m.setAttribute('aria-current', 'true'); else m.removeAttribute('aria-current'); });
      current = tab;
      if (focus) tab.focus();
      place();
    }
    tabs.forEach(function (t, n) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (ev) {
        var k = ev.key, to = k === 'ArrowDown' || k === 'ArrowRight' ? (n + 1) % tabs.length : k === 'ArrowUp' || k === 'ArrowLeft' ? (n - 1 + tabs.length) % tabs.length
          : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : -1;
        if (to < 0) return;
        ev.preventDefault(); select(tabs[to], true);
      });
      t.addEventListener('pointerenter', function (ev) { if (ev.pointerType !== 'touch') heat(root, t._key); });
      t.addEventListener('pointerleave', function () { heat(root, null); });
    });
    /* the map: the nearest mark within a fingertip chooses its place */
    function near(ev) {
      var best = null, bd = 24 * 24;
      marks.forEach(function (m) { var b = m.getBoundingClientRect(), dx = b.left - ev.clientX, dy = b.top - ev.clientY, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = m; } });
      return best;
    }
    map.addEventListener('click', function (ev) {
      var m = near(ev); if (!m) return;
      var t = tabs.filter(function (x) { return x._key === m.getAttribute('data-dx-maps-mark'); })[0];
      if (t) select(t);
    });
    map.addEventListener('pointermove', function (ev) { if (ev.pointerType === 'touch') return; var m = near(ev); map.style.cursor = m ? 'pointer' : 'default'; heat(root, m ? m.getAttribute('data-dx-maps-mark') : null); });
    map.addEventListener('pointerleave', function () { heat(root, null); });

    /* labels: each tries eight spots round its dot, chosen first, then by crowding; one that cannot stand clear is left off */
    var GAP = 6;
    function place() {
      var boxes = [], labels = [];
      marks.forEach(function (m) {
        var l = m.querySelector('[data-dx-maps-label]'); if (!l) return;
        l.hidden = false; l.style.translate = '0 0';
        labels.push({ m: m, l: l, w: l.offsetWidth, h: l.offsetHeight, frame: m.offsetParent || map });
      });
      /* every dot is an obstacle (in map coordinates) */
      var mb = map.getBoundingClientRect();
      var dots = marks.map(function (m) { var b = m.getBoundingClientRect(); return { x: b.left - mb.left, y: b.top - mb.top }; });
      function frameBox(f) { var b = f.getBoundingClientRect(); return { x0: b.left - mb.left, y0: b.top - mb.top, x1: b.right - mb.left, y1: b.bottom - mb.top }; }
      var inset = root.querySelector('.nu-campus-atlas__inset'), insetBox = inset ? frameBox(inset) : null;
      function crowd(o) { return dots.filter(function (d) { return Math.abs(d.x - o.x) < 60 && Math.abs(d.y - o.y) < 30; }).length; }
      labels.forEach(function (o) { var b = o.m.getBoundingClientRect(); o.x = b.left - mb.left; o.y = b.top - mb.top; o.f = frameBox(o.frame); o.n = crowd(o); });
      labels.sort(function (a, b) { return (b.m.getAttribute('aria-current') === 'true') - (a.m.getAttribute('aria-current') === 'true') || b.n - a.n; });
      labels.forEach(function (o) {
        var d = GAP + 4, w = o.w, h = o.h;
        var spots = [[d, -h / 2], [-d - w, -h / 2], [-w / 2, -d - h], [-w / 2, d], [d - 2, -d - h + 4], [-d - w + 2, -d - h + 4], [d - 2, d - 4], [-d - w + 2, d - 4]];
        var hit = null;
        for (var s = 0; s < spots.length && !hit; s++) {
          var r = { x0: o.x + spots[s][0], y0: o.y + spots[s][1] }; r.x1 = r.x0 + w; r.y1 = r.y0 + h;
          if (r.x0 < o.f.x0 + 2 || r.x1 > o.f.x1 - 2 || r.y0 < o.f.y0 + 2 || r.y1 > o.f.y1 - 2) continue;
          if (o.frame === map && insetBox && !(r.x1 < insetBox.x0 || r.x0 > insetBox.x1 || r.y1 < insetBox.y0 || r.y0 > insetBox.y1)) continue;
          var clash = boxes.some(function (b) { return !(r.x1 + 2 < b.x0 || r.x0 - 2 > b.x1 || r.y1 + 1 < b.y0 || r.y0 - 1 > b.y1); }) ||
            dots.some(function (p) { return p.x > r.x0 - 5 && p.x < r.x1 + 5 && p.y > r.y0 - 5 && p.y < r.y1 + 5; });
          if (!clash) hit = { r: r, s: spots[s] };
        }
        if (!hit) { o.l.hidden = true; return; }
        boxes.push(hit.r);
        o.l.style.translate = Math.round(hit.s[0]) + 'px ' + Math.round(hit.s[1]) + 'px';
      });
    }
    root.classList.add('is-live');
    panels.hidden = false;
    var lead = items.filter(function (li) { return li.hasAttribute('data-dx-maps-lead'); })[0];
    select(tabs[Math.max(0, items.indexOf(lead))]);
    if (window.ResizeObserver) new ResizeObserver(function () { place(); }).observe(map); else window.addEventListener('resize', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  });

  /* ---------------------------------------------------------------- MapWall */
  DX.mount('[data-dx-maps-wall]', function (root) {
    follow(root, '[data-dx-maps-key]', function (k) { heat(root, k); });
  });
})();
