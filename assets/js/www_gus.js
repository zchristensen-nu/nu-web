/* Our global university system: the globe (DS organism gus-globe), lifted from 22a's globe scrolly, carrying the live campus list.
   One canvas, devicePixelRatio capped at 2, drawn only while the stage is on screen and something is changing. The globe rests on
   all 14 campuses; hovering or focusing a campus chip lights its pin. Choosing a campus (pin, chip or any #campus-<slug> link) turns
   the globe to it and opens its live card. Reduced motion: the camera cuts. Without this script the campus cards read in order.
   The pause control (WCAG 2.2.2): the globe turns by itself on the steps whose camera says `auto`. A MediaControl toggle,
   `[data-gus-pause]` anywhere inside the organism (made here, on the stage, when the markup has none), holds it still:
   aria-pressed="true" means held. It is shown as soon as this script runs and starts held under reduced motion.
   A page may set or adjust cameras in its data: `"views": {"all": {"lat": 40, "y": 0.9}}` is merged over VIEWS below.
   Runs only on its own page. */
(function () {
  'use strict';
  var root = document.querySelector('[data-gus-globe]');
  if (!root) return;
  var canvas = root.querySelector('canvas');
  var ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;

  var DATA = JSON.parse(root.querySelector('[data-gus-data]').textContent);
  var LAND = JSON.parse(root.querySelector('[data-gus-land]').textContent);
  var stage = root.querySelector('.nu-gus-globe__stage');
  var card = root.querySelector('.nu-gus-globe__card');
  var cardBody = card.querySelector('.nu-gus-globe__card-body');
  var chips = Array.prototype.slice.call(root.querySelectorAll('[data-gus-campus]'));
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RAD = Math.PI / 180;
  var CAMP = DATA.campuses, SLUGS = Object.keys(CAMP), HOME = DATA.view;
  /* Scroll steps (Zach 11-03: as immersive as 22a): each step is a camera and a layer. The hero rests on every campus and turns slowly;
     "Opportunity in motion" pulls in on the campuses; the employer partners step lights this fall's co-op placements around the world,
     sweeping east from Boston; the N.U.in step turns to Europe and lights its eight locations (22a's camera and pins). */
  var COOPS = DATA.coops || [], COOP_MAX = COOPS.reduce(function (m, d) { return Math.max(m, d[2]); }, 1);
  var ORDER = COOPS.map(function (d) { return ((((d[1] + 71.09) % 360) + 360) % 360) / 360; });
  var VIEWS = {
    /* The hero (Zach 11-04: heading centred above the globe): the globe centred under the copy, its top rising like a horizon. */
    /* latWide: the rest camera from 960px, where the globe rises from the window's foot: at lat 32 its crown was the Arctic and
       every East Coast campus sat under the fold (review r1: "rests on the pole"); at 10 the campuses from Miami to Vancouver and
       London stand in the window, under the chips. Phones keep lat 32 (their globe is whole, in a band of its own). */
    all: { lon: HOME[0], lat: 32, latWide: 10, k: 1.35, x: 0.5, y: 1.1, coops: 0.18, auto: true },
    campuses: { lon: -82, lat: 40, k: 1.3, x: 0.62, y: 0.52, coops: 0.06, auto: false },  /* 1.45 at 0.66 ran the sphere off the right edge */
    partners: { lon: -40, lat: 25, k: 1.05, x: 0.64, y: 0.52, coops: 1, auto: true, ignite: true },
    nuin: { lon: 5, lat: 48, k: 1.6, x: 0.64, y: 0.52, coops: 0.06, nuin: 1, auto: false }
  };
  Object.keys(DATA.views || {}).forEach(function (name) {   /* a page's own cameras, merged over the four above */
    var mine = DATA.views[name], base = VIEWS[name] || (VIEWS[name] = {});
    if ('lat' in mine && !('latWide' in mine)) delete base.latWide;   /* a page's own latitude is its latitude at every width */
    Object.keys(mine).forEach(function (key) { base[key] = mine[key]; });
  });
  var NUIN = DATA.nuin || [];
  var view = VIEWS.all, ignite = 1, igniteT0 = null, spinV = 0, spinOff = 0, layer = { coops: VIEWS.all.coops, nuin: 0 };

  /* colour and type from the band's mode roles */
  var cs = getComputedStyle(root);
  var tok = function (n) { return cs.getPropertyValue(n).trim(); };
  var INK = tok('--on-surface'), MUTED = tok('--on-surface-muted'), GROUND = tok('--surface'), RAISED = tok('--surface-raised'), RED = tok('--accent');
  var FONT = cs.fontFamily;

  var W = 0, H = 0, DPR = 1, TEXT_R = 0, GUTTER = 48;
  var latOf = function (v) { return window.innerWidth >= 960 && v.latWide != null ? v.latWide : v.lat; };
  view = Object.assign({}, VIEWS.all, { lat: latOf(VIEWS.all) });   /* the rest view until the steps are read */
  var cur = { lon: HOME[0], lat: latOf(VIEWS.all), k: 1.35, x: 0.5, y: 1.1 }, tgt = { lon: HOME[0], lat: latOf(VIEWS.all), k: 1.35, x: 0.5, y: 1.1 };
  var selected = null, hover = null, visible = false, raf = 0, dragging = null;
  var held = reduce, opener = null;   /* held: the pause control is pressed (the globe does not turn by itself); opener: what chose the open campus */

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    /* On wide screens the resting globe stays a gutter clear of the text column. */
    var tx = root.querySelectorAll('.nu-gus-globe__text')[1] || root.querySelector('.nu-gus-globe__text'), cr = canvas.getBoundingClientRect(), tr = tx.getBoundingClientRect();
    TEXT_R = tr.width ? tr.right - cr.left : 0;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    kick();
  }
  var wide = function () { return W >= 960; };
  function geom() {
    var R0 = wide() ? Math.min(W, H) * 0.42 : Math.min(W * 0.46, H * 0.27);
    var R = R0 * cur.k, cx = wide() ? W * cur.x : W * 0.5;
    /* Fitting beside the text fades out between zoom 1.05 and 1.45 rather than switching off at 1.05, which made the globe jump
       ~25px sideways and ~20px in size in one frame as the steps zoomed (Zach 11-04: "janky"). */
    /* ...and fades in as the camera leaves the centred hero (x 0.5 to 0.6), so that move has no jump either. */
    var fit = wide() && TEXT_R ? Math.max(0, Math.min(1, (1.45 - cur.k) / 0.4)) * Math.max(0, Math.min(1, (cur.x - 0.5) / 0.1)) : 0;
    if (fit) {
      var R2 = Math.min(R, (W - TEXT_R - GUTTER * 2) / 2), cx2 = Math.max(cx, TEXT_R + GUTTER + R2);
      R += (R2 - R) * fit; cx += (cx2 - cx) * fit;
    }
    return { R: R, cx: cx, cy: wide() ? H * cur.y : H * 0.3 };
  }
  function project(lat, lon, g) {
    var p = lat * RAD, l = lon * RAD, p0 = cur.lat * RAD, l0 = cur.lon * RAD;
    var cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0);
    return [g.cx + g.R * Math.cos(p) * Math.sin(l - l0), g.cy - g.R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0)), cosc];
  }

  function label(text, x, y, off) {
    ctx.font = (wide() ? '600 13px ' : '600 12px ') + FONT;
    ctx.textBaseline = 'middle';
    var w = ctx.measureText(text).width + 12, h = 22;
    var ox = off ? off[0] : 12, oy = off ? off[1] : 0;
    if (!wide() && off) { ox *= 0.75; oy *= 0.75; }
    var bx = ox < 0 ? x + ox - w + 6 : x + ox, by = y + oy - h / 2;
    if (off) {
      ctx.globalAlpha = 0.5; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ox < 0 ? bx + w : bx, y + oy); ctx.stroke();
    }
    bx = Math.max(4, Math.min(W - w - 4, bx));
    ctx.globalAlpha = 0.78; ctx.fillStyle = GROUND;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, w, h, h / 2); else ctx.rect(bx, by, w, h); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = INK; ctx.fillText(text, bx + 6, by + h / 2 + 0.5);
  }

  function draw() {
    var g = geom(), R = g.R, cx = g.cx, cy = g.cy, i, j, la, lo, q, pen;
    ctx.clearRect(0, 0, W, H);
    var sg = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
    sg.addColorStop(0, RAISED); sg.addColorStop(1, GROUND);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fillStyle = sg; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    ctx.strokeStyle = INK; ctx.globalAlpha = 0.05; ctx.lineWidth = 1;
    for (lo = -180; lo < 180; lo += 30) { ctx.beginPath(); pen = false; for (la = -90; la <= 90; la += 4) { q = project(la, lo, g); if (q[2] > 0) { pen ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); pen = true; } else pen = false; } ctx.stroke(); }
    for (la = -60; la <= 60; la += 30) { ctx.beginPath(); pen = false; for (lo = -180; lo <= 180; lo += 4) { q = project(la, lo, g); if (q[2] > 0) { pen ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); pen = true; } else pen = false; } ctx.stroke(); }
    /* land: visible runs joined along the horizon so rings that wrap the far side close properly (22a) */
    var horizon = function (a0, a1) { var d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; ctx.arc(cx, cy, R, a0, a0 + d, d < 0); };
    ctx.fillStyle = INK; ctx.strokeStyle = INK;
    ctx.beginPath();
    for (i = 0; i < LAND.length; i++) {
      var poly = LAND[i], started = false, first = null, last = null, exit = null;
      for (j = 0; j < poly.length; j++) {
        var s = project(poly[j][1], poly[j][0], g);
        if (s[2] > 0) {
          var a = Math.atan2(s[1] - cy, s[0] - cx);
          if (!started) { ctx.moveTo(s[0], s[1]); started = true; first = a; }
          else if (exit !== null) { horizon(exit, a); ctx.lineTo(s[0], s[1]); exit = null; } else ctx.lineTo(s[0], s[1]);
          last = a;
        } else if (started && exit === null) exit = last;
      }
      if (!started) continue;
      if (exit !== null) horizon(exit, first);
      ctx.closePath();
    }
    ctx.globalAlpha = 0.1; ctx.fill(); ctx.globalAlpha = 0.14; ctx.stroke();
    var tg = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, R * 0.2, cx - R * 0.45, cy - R * 0.5, R * 2.05);
    tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(0.55, 'rgba(0,0,0,0)'); tg.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fillStyle = tg; ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.16; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;

    /* co-op placements: small cartographic dots sized by count, igniting eastward from Boston on the partners step */
    if (layer.coops > 0.01) {
      var dots = new Path2D(), rings = new Path2D();
      ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      for (i = 0; i < COOPS.length; i++) {
        var d = COOPS[i], dp = project(d[0], d[1], g); if (dp[2] <= 0) continue;
        var ig = ignite >= 1 ? 1 : Math.max(0, Math.min(1, (ignite * 1.2 - ORDER[i]) / 0.15)); if (ig <= 0) continue;
        var dr = (1.6 + 6 * Math.sqrt(d[2] / COOP_MAX)) * Math.sqrt(cur.k), da = layer.coops * ig;
        if (ig >= 1) { dots.moveTo(dp[0] + dr, dp[1]); dots.arc(dp[0], dp[1], dr, 0, 7); if (dr > 4) { rings.moveTo(dp[0] + dr + 2.5, dp[1]); rings.arc(dp[0], dp[1], dr + 2.5, 0, 7); } continue; }
        ctx.beginPath(); ctx.arc(dp[0], dp[1], dr, 0, 7); ctx.globalAlpha = 0.72 * da; ctx.fill();
        if (dr > 4) { ctx.beginPath(); ctx.arc(dp[0], dp[1], dr + 2.5, 0, 7); ctx.globalAlpha = 0.25 * da; ctx.stroke(); }
      }
      ctx.globalAlpha = 0.72 * layer.coops; ctx.fill(dots); ctx.globalAlpha = 0.25 * layer.coops; ctx.stroke(rings);
      ctx.globalAlpha = 1;
    }

    /* N.U.in locations: hollow ink rings, named once the step has turned to Europe */
    if (layer.nuin > 0.01) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.globalAlpha = layer.nuin;
      NUIN.forEach(function (n) { var q = project(n[0], n[1], g); if (q[2] <= 0) return; ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, 7); ctx.stroke(); });
      ctx.globalAlpha = 1;
      if (layer.nuin > 0.6 && !selected) NUIN.forEach(function (n) { var q = project(n[0], n[1], g); if (q[2] > 0.05) label(n[2], q[0], q[1], n[3]); });
    }

    /* campuses: every pin solid ink with a soft halo and a ground-coloured ring, so it reads over land and over its neighbours
       (Zach 11-02: pins need to be more visible); the hovered one grows; the chosen one red with a ring in ink (the Night red rule) */
    SLUGS.forEach(function (sl) {
      var c = CAMP[sl], p = project(c.ll[0], c.ll[1], g); if (p[2] <= 0) return;
      var on = sl === selected, hi = sl === hover, r = on ? 7 : (hi ? 6.5 : 5.5);
      ctx.beginPath(); ctx.arc(p[0], p[1], r + 8, 0, 7); ctx.fillStyle = on ? RED : INK; ctx.globalAlpha = on || hi ? 0.28 : 0.16; ctx.fill();
      ctx.beginPath(); ctx.arc(p[0], p[1], r + 1.5, 0, 7); ctx.fillStyle = GROUND; ctx.globalAlpha = 1; ctx.fill();
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fillStyle = on ? RED : INK; ctx.fill();
      if (on) { ctx.beginPath(); ctx.arc(p[0], p[1], r + 4, 0, 7); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); }
    });
    (hover && hover !== selected ? [hover, selected] : [selected]).forEach(function (sl) {
      if (!sl) return;
      var c = CAMP[sl], p = project(c.ll[0], c.ll[1], g); if (p[2] <= 0.05) return;
      label(c.name, p[0], p[1], cur.k > 1.6 ? c.spread : null);
    });
  }

  var lastT = 0;
  function frame(now) {
    raf = 0;
    if (!visible) return;
    now = now || performance.now();
    var dt = Math.min(4, lastT ? (now - lastT) / 16.67 : 1); lastT = now;
    var ease = function (rate) { return 1 - Math.pow(1 - rate, dt); };
    var moving = false;
    if (!dragging && Math.abs(spinV) > 0.004) { spinOff += spinV * dt; spinV *= Math.pow(0.945, dt); moving = true; }
    else if (view.auto && !held && !dragging && !selected && !hover) { spinOff += 0.03 * dt; moving = true; }
    else if (!view.auto && !dragging && Math.abs(spinOff) > 0.02) { spinOff *= Math.pow(0.94, dt); moving = true; }  /* a held step settles back on its own longitude */
    if (!selected && !dragging) tgt.lon = view.lon + spinOff;
    ['coops', 'nuin'].forEach(function (key) {
      var to = view[key] || 0, dl = to - layer[key];
      if (Math.abs(dl) > 0.005 && !reduce) { layer[key] += dl * ease(0.08); moving = true; } else layer[key] = to;
    });
    if (igniteT0 !== null) { ignite = Math.min(1, (now - igniteT0) / 1800); if (ignite >= 1) igniteT0 = null; else moving = true; }
    ['lon', 'lat', 'k', 'x', 'y'].forEach(function (key) {
      var d = tgt[key] - cur[key];
      if (key === 'lon') { while (d > 180) d -= 360; while (d < -180) d += 360; }
      if (reduce || Math.abs(d) < (key === 'k' || key === 'x' || key === 'y' ? 0.002 : 0.02)) cur[key] = tgt[key];
      else { cur[key] += d * ease(0.085); moving = true; }
    });
    draw();
    if (moving || dragging) kick(); else lastT = 0;
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  /* The card's carousel (Zach 11-16), in a foot that stays in view while the card scrolls: the campus-type tabs (the chip groups,
     by their first word) and a RailControls pager: previous / next step through every campus in chip order, crossing into the next type (its tab follows); the
     count and the progress line are within the type. ArrowLeft / ArrowRight do the same while the card has focus. */
  var groupsEl = Array.prototype.slice.call(root.querySelectorAll('.nu-gus-globe__chip-group'));
  var ORDER = [], TYPE = {};
  chips.forEach(function (c) { var s = c.dataset.gusCampus; if (TYPE[s] !== undefined) return; ORDER.push(s); TYPE[s] = groupsEl.indexOf(c.closest('.nu-gus-globe__chip-group')); });
  var icon = function (n) { return '<svg class="nu-icon" aria-hidden="true"><use href="#i-' + n + '"></use></svg>'; };
  var types = document.createElement('div');
  types.className = 'nu-gus-globe__card-types'; types.setAttribute('role', 'group'); types.setAttribute('aria-label', 'Campus type');
  groupsEl.forEach(function (g, n) {
    var full = (g.querySelector('.nu-gus-globe__chip-label') || g).textContent.trim(), b = document.createElement('button');
    b.type = 'button'; b.className = 'nu-chip'; b.dataset.gusType = n; b.textContent = full.split(' ')[0]; b.setAttribute('aria-label', full);
    b.addEventListener('click', function () { var first = ORDER.filter(function (s) { return TYPE[s] === n; })[0]; if (first) openCard(first, false); });
    types.appendChild(b);
  });
  var pager = document.createElement('div');
  pager.className = 'nu-rail-controls nu-gus-globe__card-pager';
  pager.innerHTML = '<span class="nu-progress" aria-hidden="true"></span><span class="nu-text nu-text--meta nu-rail-controls__count" aria-live="polite"></span>'
    + '<div class="nu-rail-controls__paddles"><button class="nu-icon-button nu-icon-button--outline" type="button" aria-label="Previous campus" data-gus-move="-1">' + icon('arrow-left') + '</button>'
    + '<button class="nu-icon-button nu-icon-button--outline" type="button" aria-label="Next campus" data-gus-move="1">' + icon('arrow') + '</button></div>';
  var foot = document.createElement('div');
  foot.className = 'nu-gus-globe__card-foot';
  if (groupsEl.length > 1) foot.appendChild(types);
  if (ORDER.length > 1) foot.appendChild(pager);
  if (foot.children.length) card.appendChild(foot);
  var move = function (d) { if (!selected) return; var n = ORDER.length; openCard(ORDER[(ORDER.indexOf(selected) + d + n) % n], false); };
  Array.prototype.forEach.call(pager.querySelectorAll('[data-gus-move]'), function (b) { b.addEventListener('click', function () { move(+b.dataset.gusMove); }); });
  card.addEventListener('keydown', function (ev) {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault(); move(ev.key === 'ArrowLeft' ? -1 : 1);
  });
  function carousel(slug) {
    var t = TYPE[slug], mine = ORDER.filter(function (s) { return TYPE[s] === t; }), k = mine.indexOf(slug) + 1;
    Array.prototype.forEach.call(types.children, function (b) { b.setAttribute('aria-pressed', String(+b.dataset.gusType === t)); });
    pager.querySelector('.nu-rail-controls__count').textContent = k + ' of ' + mine.length;
    pager.querySelector('.nu-progress').style.setProperty('--value', k / mine.length);
  }

  function openCard(slug, focus) {
    var src = root.querySelector('#campus-' + slug);
    if (!src) return;
    selected = slug;
    var clone = src.cloneNode(true);
    clone.removeAttribute('id'); clone.removeAttribute('tabindex');
    Array.prototype.forEach.call(clone.querySelectorAll('[id]'), function (n) { n.id = 'card-' + n.id; });
    clone.setAttribute('aria-labelledby', 'card-campus-' + slug + '-h');
    cardBody.innerHTML = ''; cardBody.appendChild(clone);
    card.hidden = false; card.setAttribute('aria-label', CAMP[slug].name); root.classList.add('has-card');
    chips.forEach(function (c) { if (c.dataset.gusCampus === slug) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
    if (TYPE[slug] !== undefined) carousel(slug);
    var c = CAMP[slug];
    tgt.lon = c.ll[1]; tgt.lat = c.ll[0]; tgt.x = 0.56; tgt.y = 0.52; tgt.k = c.spread ? 2.8 : 1.8;
    kick();
    if (focus) card.querySelector('.nu-gus-globe__close').focus({ preventScroll: true });
  }
  function closeCard(restore) {
    if (card.hidden) return;
    var was = selected; card.hidden = true; root.classList.remove('has-card'); selected = null; cardBody.innerHTML = '';
    tgt.lon = view.lon + spinOff; tgt.lat = view.lat; tgt.k = view.k; tgt.x = view.x; tgt.y = view.y;
    chips.forEach(function (c) { c.removeAttribute('aria-current'); });
    /* focus goes back to what chose the campus, else to any control that names it (a chip, a rail link) */
    if (restore && was) { var ch = opener && opener.isConnected && !opener.closest('[hidden]') ? opener : root.querySelector('[data-gus-campus="' + was + '"]:not([hidden])'); if (ch) ch.focus({ preventScroll: true }); }
    opener = null;
    kick();
  }
  card.querySelector('.nu-gus-globe__close').addEventListener('click', function () { closeCard(true); });
  root.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !card.hidden) closeCard(true); });

  var chosenAt = 0;
  function choose(slug, viaKeyboard) {
    chosenAt = performance.now();
    var r = root.getBoundingClientRect();
    if (r.top > 4 || r.bottom < innerHeight - 4) window.scrollTo({ top: r.top + window.scrollY, behavior: reduce ? 'auto' : 'smooth' });
    openCard(slug, viaKeyboard);
  }
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="#campus-"]');
    if (!a) return;
    var slug = a.getAttribute('href').slice(8);
    if (!CAMP[slug]) return;
    ev.preventDefault();
    opener = root.contains(a) && !card.contains(a) ? a : null;
    choose(slug, ev.detail === 0);
  });
  chips.forEach(function (c) {
    var on = function () { hover = c.dataset.gusCampus; kick(); };
    var off = function () { if (hover === c.dataset.gusCampus) { hover = null; kick(); } };
    c.addEventListener('pointerenter', on); c.addEventListener('focus', on);
    c.addEventListener('pointerleave', off); c.addEventListener('blur', off);
  });

  /* pointer: drag turns the globe; a tap near a campus chooses it */
  canvas.addEventListener('pointerdown', function (ev) {
    dragging = { x: ev.clientX, y: ev.clientY, lon: cur.lon, lat: cur.lat, moved: false, id: ev.pointerId };
  });
  canvas.addEventListener('pointermove', function (ev) {
    if (!dragging) return;
    var dx = ev.clientX - dragging.x, dy = ev.clientY - dragging.y;
    if (!dragging.moved && Math.hypot(dx, dy) < 5) return;
    if (!dragging.moved) { dragging.moved = true; canvas.setPointerCapture(dragging.id); canvas.classList.add('is-dragging'); }
    var deg = 180 / (Math.PI * geom().R), lon = dragging.lon - dx * deg;
    dragging.v = lon - cur.lon;
    cur.lon = tgt.lon = lon; spinOff = lon - view.lon;
    cur.lat = tgt.lat = Math.max(-70, Math.min(75, dragging.lat + dy * deg));
    kick();
  });
  var up = function (ev) {
    if (!dragging) return;
    var d = dragging; dragging = null; canvas.classList.remove('is-dragging');
    if (d.moved) { if (!reduce) spinV = Math.max(-2, Math.min(2, d.v || 0)); kick(); return; }
    var r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, g = geom(), best = null, bd = 18;
    SLUGS.forEach(function (sl) { var p = project(CAMP[sl].ll[0], CAMP[sl].ll[1], g); if (p[2] <= 0) return; var dd = Math.hypot(p[0] - x, p[1] - y); if (dd < bd) { bd = dd; best = sl; } });
    if (best) { opener = null; choose(best, false); }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', function () { dragging = null; canvas.classList.remove('is-dragging'); });

  /* the pause control: one name, pressed = held; made here when the markup has none, so every globe has one */
  var pause = root.querySelector('[data-gus-pause]');
  if (!pause) {
    pause = document.createElement('button');
    pause.type = 'button';
    pause.className = 'nu-icon-button nu-icon-button--media nu-media-control__toggle nu-gus-globe__pause';
    pause.setAttribute('aria-label', 'Pause the globe');
    pause.setAttribute('data-gus-pause', '');
    pause.innerHTML = '<svg class="nu-icon" aria-hidden="true"><use href="#i-pause"></use></svg><svg class="nu-icon" aria-hidden="true"><use href="#i-play"></use></svg>';
    stage.appendChild(pause);
  }
  pause.hidden = false;
  pause.setAttribute('aria-pressed', String(held));
  pause.addEventListener('click', function () {
    held = !held;
    pause.setAttribute('aria-pressed', String(held));
    if (held) spinV = 0;
    kick();
  });

  /* only while on screen */
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); else closeCard(false); }).observe(stage);
  root.classList.add('is-live');
  var steps = Array.prototype.slice.call(root.querySelectorAll('[data-gus-step]'));
  /* Scroll drives the camera (Zach 11-04: "still behaving weird"; the camera used to jump only once a step crossed mid-screen, so text
     sat over the old view and then the globe lurched). Between two steps the camera and layers blend by how far the viewport's centre
     has travelled from one step's centre to the next (smoothstep), and the frame loop eases toward that, so the globe moves with the
     scroll. The text step nearest the centre is the active one. */
  var active = null;
  function mix(a, b, t) { return a + (b - a) * t; }
  function onScroll() {
    var vc = innerHeight / 2, cs = steps.map(function (st) { var r = st.getBoundingClientRect(); return (r.top + r.bottom) / 2; });
    var i = 0, t = 0, last = steps.length - 1;
    if (vc >= cs[last]) { i = Math.max(0, last - 1); t = last ? 1 : 0; }
    else if (vc > cs[0]) { while (i < last - 1 && vc >= cs[i + 1]) i++; t = (vc - cs[i]) / (cs[i + 1] - cs[i]); }
    t = t * t * (3 - 2 * t);
    var A = VIEWS[steps[i].dataset.gusStep] || VIEWS.all, B = VIEWS[(steps[i + 1] || steps[i]).dataset.gusStep] || A;
    var dl = B.lon - A.lon; while (dl > 180) dl -= 360; while (dl < -180) dl += 360;
    view = { lon: A.lon + dl * t, lat: mix(latOf(A), latOf(B), t), k: mix(A.k, B.k, t), x: mix(A.x, B.x, t), y: mix(A.y, B.y, t),
             coops: mix(A.coops || 0, B.coops || 0, t), nuin: mix(A.nuin || 0, B.nuin || 0, t), auto: (t < 0.5 ? A : B).auto };
    var el = t < 0.5 ? steps[i] : (steps[i + 1] || steps[i]);
    if (el !== active) {
      active = el;
      steps.forEach(function (s2) { if (s2 === el) s2.setAttribute('data-active', ''); else s2.removeAttribute('data-active'); });
      /* Moving on to another step closes an open campus card and hands the camera back to the tour (the card used to stay open,
         zoomed on its campus, while the steps changed under it). The scroll a choice itself starts doesn't count. */
      if (!card.hidden && performance.now() - chosenAt > 1200) closeCard(false);
      var v = VIEWS[el.dataset.gusStep];
      if (v && v.ignite && ignite >= 1 && igniteT0 === null && !v.lit) { v.lit = true; ignite = reduce ? 1 : 0; igniteT0 = reduce ? null : performance.now(); }
    }
    if (!selected) { tgt.lon = view.lon + spinOff; tgt.lat = view.lat; tgt.k = view.k; tgt.x = view.x; tgt.y = view.y; }
    kick();
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  resize();
  window.addEventListener('resize', resize);
  var m = /^#campus-([a-z-]+)$/.exec(location.hash);
  if (m && CAMP[m[1]]) choose(m[1], false);
})();
