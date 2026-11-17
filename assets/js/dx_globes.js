/* dx_globes.js: the globes family (build/pages/_dx_globes.py; organisms globe-view, globe-horizon, globe-orbit, globe-tour,
   globe-chapters). Every pattern reads without this file: the names are the content and the globe is a still picture.
     Globe (the one renderer): an orthographic sphere drawn per pixel by one WebGL shader from the land field
       ([data-dx-globes-land], once a page), hairline limb, and
       one clean surface style per globe (data-dx-globes-style): "solid" (lit land, hairline coast), "flat" (the default;
       two exact flat tones), "studio" (one wide soft light, land a hair lighter than the sea), "ink" (the continents as a
       near-black silhouette, near-white on Night), "mono" (land and sea one tone apart, the marks larger). Never a
       texture: no grain, noise, paper, halftone or hatching (Zach 11-13: sleek and clean). Marks in a 2D layer over
       it; labels in the DOM. Never lines between places: no arcs, routes or connections (Zach 11-13). Colours are the
       ground's tokens, read again when the ground changes. Draws only while on screen and while something changes;
       devicePixelRatio capped at 2. No WebGL: the still stays.
     [data-dx-globes-horizon]   GlobeHorizon: scroll position (read, never set) chooses the beat; the camera eases to it.
     [data-dx-globes-orbit]     GlobeOrbit: drift (pause control), drag with a little carry, a name in hand flies to its campus.
     [data-dx-globes-tour]      GlobeTour: a tablist of names (Chips with the one gliding marker); each step flies the globe.
     [data-dx-globes-chapters]  GlobeChapters: the chapter in the middle of the window frames its campuses.
   Reduced motion: no drift, no flights (the globe cuts), no pinning (CSS); each pattern shows its complete still state. */
(function () {
  'use strict';
  var DX = window.DX;
  if (!DX || !DX.mount) return;
  var RAD = Math.PI / 180, DEG = 180 / Math.PI;

  /* ---------------------------------------------------------------- the land mask: one image for every globe on the page */
  var MASK = null, waiting = [];
  function mask(cb) {
    if (MASK && MASK.complete && MASK.naturalWidth) { cb(MASK); return; }
    waiting.push(cb);
    if (MASK) return;
    var src = document.querySelector('[data-dx-globes-land]');
    if (!src) return;
    MASK = new Image();
    MASK.onload = function () { var w = waiting; waiting = []; w.forEach(function (f) { f(MASK); }); };
    MASK.src = JSON.parse(src.textContent);
  }

  /* ---------------------------------------------------------------- colour: a token as [r, g, b] (0-1) */
  var probe = null;
  function rgb(el, value) {
    if (!probe) { probe = document.createElement('span'); probe.style.display = 'none'; }
    el.appendChild(probe);
    probe.style.color = value;
    var m = getComputedStyle(probe).color.match(/[\d.]+/g) || [0, 0, 0];
    el.removeChild(probe);
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, a) { return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a == null ? 1 : a) + ')'; }
  function lum(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }

  /* ---------------------------------------------------------------- the shader */
  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var STYLES = { solid: 0, flat: 1, studio: 2, ink: 3, mono: 4 };
  var FS = [
    '#extension GL_OES_standard_derivatives : enable',
    '#ifdef LOD',
    '#extension GL_EXT_shader_texture_lod : enable',
    '#endif',
    'precision highp float;',
    'uniform vec2 c;uniform float r,dpr,shade,dark,style;uniform mat3 m;uniform sampler2D land;',
    'uniform vec3 sea,ground,lnd,line,ink,lens;',
    /* the land field at a screen point: x (0.5 = the coast); z the point's depth */
    'vec3 at(vec2 fc){',
    '  vec2 p=(fc-c)/r;float z=sqrt(max(0.,1.-dot(p,p)));vec3 w=m*vec3(p,z);',
    '  vec2 uv=vec2(atan(w.x,w.z)/6.2831853+.5,.5-asin(clamp(w.y,-1.,1.))/3.1415927);',
    '#ifdef LOD',
    /* the level comes from the sphere's size, not from screen derivatives: those jump across the antimeridian seam */
    '  float lv=max(0.,log2(651.9/r*inversesqrt(max(z,.04))));',
    '  return vec3(texture2DLodEXT(land,uv,lv).r,0.,z);',
    '#else',
    '  return vec3(texture2D(land,uv).r,0.,z);',
    '#endif',
    '}',
    'void main(){',
    '  vec2 p=(gl_FragCoord.xy-c)/r;float d=length(p);float px=1./r;',
    '  if(d>1.+2.*px)discard;',
    '  float cover=1.-smoothstep(1.-px,1.+px,d);',
    '  vec3 f=at(gl_FragCoord.xy);float k=f.x,z=f.z;vec3 n=vec3(p,z);',
    '  float fw=clamp(fwidth(k)*.75,.001,.25);',
    '  float isl=smoothstep(.5-fw,.5+fw,k);',
    '  float coast=1.-smoothstep(fw*.5,fw*1.6,abs(k-.5));',
    '  float lam=clamp(dot(n,normalize(vec3(-.42,.5,.76))),0.,1.);',
    '  vec3 col;float rim=1.;',
    '  if(style<.5){',                                         /* solid: lit land             */
    '    col=mix(sea,lnd,isl);col=mix(col,line,coast*.2);',
    '    col=mix(col,dark>.5?ground*.6:ink,(1.-lam)*shade);',
    '  }else if(style<1.5){',                                  /* flat: two exact tones and the limb, nothing else */
    '    col=mix(dark>.5?mix(ground,ink,.04):mix(ground,ink,.025),mix(ground,ink,dark>.5?.13:.2),isl);',
    '  }else if(style<2.5){',                                  /* studio: one wide soft light, land a hair lighter than the sea */
    '    float g=.5+.5*dot(n,normalize(vec3(-.5,.62,.6)));g=g*g*(3.-2.*g);',
    '    vec3 sea0=mix(ground,ink,dark>.5?.06:.12),land0=mix(ground,ink,dark>.5?.17:.035);',
    '    col=mix(sea0,land0,isl);',
    '    col=dark>.5?mix(col,ink,g*.07):mix(col,ink,(1.-g)*.07);',
    '  }else if(style<3.5){',                                  /* ink: the continents as a clean silhouette on the ground */
    '    col=mix(mix(ground,ink,.03),mix(ground,ink,dark>.5?.82:.86),isl);',
    '  }else{',                                                /* mono: land and sea one tone apart */
    '    col=mix(mix(ground,ink,dark>.5?.06:.045),mix(ground,ink,dark>.5?.16:.15),isl);',
    '  }',
    '  float limb=1.-smoothstep(0.,px*dpr*.9,abs(d-1.+px*dpr*.6));',
    '  col=mix(col,line,limb*.85*rim);',
    '  if(lens.z>0.){float ld=length(gl_FragCoord.xy-lens.xy);if(ld>lens.z+1.)discard;',
    '    cover*=1.-smoothstep(lens.z-1.,lens.z,ld);col=mix(col,line,(1.-smoothstep(0.,dpr*.9,abs(ld-lens.z+dpr*.6)))*.85);}',
    '  gl_FragColor=vec4(col*cover,cover);',
    '}'].join('\n');

  function compile(gl, lod) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, (lod ? '#define LOD\n' : '') + FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  /* ---------------------------------------------------------------- geometry */
  function vec(lat, lon) { var p = lat * RAD, l = lon * RAD; return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)]; }
  function unvec(v) { var n = Math.hypot(v[0], v[1], v[2]) || 1; return { lat: Math.asin(v[1] / n) * DEG, lon: Math.atan2(v[0], v[2]) * DEG }; }
  function angle(a, b) { var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; return Math.acos(Math.max(-1, Math.min(1, d))); }
  function wrap(d) { return ((d + 540) % 360) - 180; }
  function lerpCam(a, b, t) {
    return { lon: a.lon + wrap(b.lon - a.lon) * t, lat: a.lat + (b.lat - a.lat) * t, cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, r: a.r + (b.r - a.r) * t };
  }
  function same(a, b) { return Math.abs(wrap(a.lon - b.lon)) < 0.01 && Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.cx - b.cx) < 0.2 && Math.abs(a.cy - b.cy) < 0.2 && Math.abs(a.r - b.r) < 0.2; }
  var easeOut = function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };          /* --ease-out, near enough */
  var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* where the camera must sit for a point to land at screen (tx, ty) with the sphere centred at (cx, cy), radius r */
  function aim(lat, lon, cx, cy, r, tx, ty) {
    var pc = lat * RAD, X = (tx - cx) / r, Y = (cy - ty) / r;
    var cxl = Math.cos(pc), dl = Math.asin(Math.max(-0.95, Math.min(0.95, X / Math.max(cxl, 0.05))));
    var a = Math.sin(pc), b = Math.cos(pc) * Math.cos(dl), h = Math.hypot(a, b), phi = Math.atan2(b, a);
    var p0 = Math.acos(Math.max(-1, Math.min(1, Y / h))) - phi;
    return { lon: lon - dl * DEG, lat: Math.max(-80, Math.min(80, p0 * DEG)), cx: cx, cy: cy, r: r };
  }
  /* the centre of a set of places and its spread (radians) */
  function centre(places) {
    var s = [0, 0, 0];
    places.forEach(function (p) { var v = vec(p.lat, p.lon); s[0] += v[0]; s[1] += v[1]; s[2] += v[2]; });
    var c = unvec(s), cv = vec(c.lat, c.lon), spread = 0;
    places.forEach(function (p) { spread = Math.max(spread, angle(cv, vec(p.lat, p.lon))); });
    return { lat: c.lat, lon: c.lon, spread: spread };
  }
  /* ---------------------------------------------------------------- Globe: one view, one camera */
  function Globe(el, places, opts) {
    var g = this;
    g.el = el; g.opts = opts || {}; g.places = places;
    g.still = el.querySelector('.nu-globe-view__still');
    g.glc = el.querySelector('.nu-globe-view__gl');
    g.inkc = el.querySelector('.nu-globe-view__ink');
    g.labels = el.querySelector('.nu-globe-view__labels');
    g.ctx = g.inkc.getContext('2d');
    g.cam = { lon: 0, lat: 0, cx: 0, cy: 0, r: 1 };
    g.W = 0; g.H = 0; g.dpr = 1; g.visible = false; g.raf = 0; g.ready = false;
    var st = el.getAttribute('data-dx-globes-style'); g.style = st in STYLES ? STYLES[st] : 1;  // flat is the default (Zach 11-13)
    var gl = null;
    try { gl = g.glc.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' }); } catch (err) { gl = null; }
    if (!gl || !gl.getExtension('OES_standard_derivatives')) return;
    g.lod = !!gl.getExtension('EXT_shader_texture_lod');
    try { g.prog = compile(gl, g.lod); } catch (err) { if (window.console) console.error('dx globes', err); return; }
    g.gl = gl;
    gl.useProgram(g.prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(g.prog, 'a');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    g.u = {};
    ['c', 'r', 'dpr', 'shade', 'dark', 'style', 'm', 'land', 'sea', 'ground', 'lnd', 'line', 'ink', 'lens'].forEach(function (n) { g.u[n] = gl.getUniformLocation(g.prog, n); });
    g.colours();
    /* labels: one per place, shown on demand */
    g.label = {};
    places.forEach(function (p) {
      var s = document.createElement('span');
      s.className = 'nu-text nu-globe-view__label'; s.textContent = p.name; s.hidden = true;
      g.labels.appendChild(s); g.label[p.key] = s;
    });
    mask(function (M) {
      var max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      function upload(unit, im) {
        var src = im;
        if (max < im.naturalWidth) {
          src = document.createElement('canvas'); src.width = max; src.height = max / 2;
          src.getContext('2d').drawImage(im, 0, 0, max, max / 2);
        }
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, src);
        if (g.lod) gl.generateMipmap(gl.TEXTURE_2D);   /* small globes read a smaller level: no shimmer on the coasts */
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, g.lod ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      upload(0, M);
      gl.uniform1i(g.u.land, 0);
      g.ready = true;
      g.size();
      el.classList.add('is-live');
      g.kick();
    });
    if (window.ResizeObserver) new ResizeObserver(function () { g.size(); }).observe(el); else window.addEventListener('resize', function () { g.size(); });
    new IntersectionObserver(function (es) {
      g.visible = es[es.length - 1].isIntersecting;
      if (g.visible) g.kick();
    }, { root: DX.view, rootMargin: '10% 0px' }).observe(el);
    /* the ground can change under it (Night on a section, the reader's scheme) */
    new MutationObserver(function () { g.colours(); g.kick(true); }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-mode'] });
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { g.colours(); g.kick(); });
  }
  Globe.prototype.colours = function () {
    var el = this.el, cs = getComputedStyle(el);
    var surface = rgb(el, cs.getPropertyValue('--surface').trim() || '#fff'), ink = rgb(el, cs.getPropertyValue('--on-surface').trim() || '#000');
    var dark = lum(surface) < 0.4;
    this.dark = dark;
    this.col = {
      ground: surface, ink: ink, red: rgb(el, cs.getPropertyValue('--accent').trim() || '#c8102e'),
      sea: mix(surface, ink, dark ? 0.045 : 0.03),
      land: mix(surface, ink, dark ? 0.2 : 0.13),
      line: mix(surface, ink, dark ? 0.5 : 0.5)
    };
  };
  Globe.prototype.size = function () {
    var g = this, b = g.el.getBoundingClientRect();
    g.dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.W = b.width; g.H = b.height;
    [g.glc, g.inkc].forEach(function (c) { c.width = Math.max(1, Math.round(g.W * g.dpr)); c.height = Math.max(1, Math.round(g.H * g.dpr)); });
    g.ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    var s = g.still.getBoundingClientRect();
    g.base = { cx: s.left - b.left + s.width / 2, cy: s.top - b.top + s.height / 2, r: s.width / 2 };
    if (g.opts.resize) g.opts.resize(g);
    g.kick(true);
  };
  /* a point on the sphere (alt: height above it, in radii) → [x, y, z (toward the reader), shown] */
  Globe.prototype.project = function (lat, lon, alt, cam) {
    cam = cam || this.cam;
    var v = typeof lat === 'object' ? lat : vec(lat, lon);
    if (typeof lat === 'object') alt = lon;
    var l0 = cam.lon * RAD, p0 = cam.lat * RAD, cl = Math.cos(l0), sl = Math.sin(l0), cp = Math.cos(p0), sp = Math.sin(p0);
    var k = 1 + (alt || 0);
    var x = (cl * v[0] - sl * v[2]) * k, y = (-sp * sl * v[0] + cp * v[1] - sp * cl * v[2]) * k, z = (cp * sl * v[0] + sp * v[1] + cp * cl * v[2]) * k;
    var shown = z > 0 || x * x + y * y > 1;
    return [cam.cx + cam.r * x, cam.cy - cam.r * y, z, shown];
  };
  Globe.prototype.kick = function (now) {
    var g = this;
    if (now === true && g.visible) { g.frame(performance.now()); return; }
    if (!g.raf && g.visible && g.ready) g.raf = requestAnimationFrame(function (t) { g.raf = 0; g.frame(t); });
  };
  Globe.prototype.frame = function (now) {
    var g = this;
    if (!g.ready || !g.W) return;
    var more = g.opts.tick ? g.opts.tick(now, g) : false;
    g.draw();
    if (more) g.kick();
  };
  Globe.prototype.draw = function () {
    var g = this, gl = g.gl, cam = g.cam, d = g.dpr, c = g.col;
    gl.viewport(0, 0, g.glc.width, g.glc.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    var l0 = cam.lon * RAD, p0 = cam.lat * RAD, cl = Math.cos(l0), sl = Math.sin(l0), cp = Math.cos(p0), sp = Math.sin(p0);
    /* rows of world→view, given to GL column by column: the uniform is view→world */
    gl.uniformMatrix3fv(g.u.m, false, [cl, 0, -sl, -sp * sl, cp, -sp * cl, cp * sl, sp, cp * cl]);
    gl.uniform2f(g.u.c, cam.cx * d, (g.H - cam.cy) * d);
    gl.uniform1f(g.u.r, cam.r * d);
    gl.uniform1f(g.u.dpr, d);
    gl.uniform1f(g.u.style, g.style);
    gl.uniform1f(g.u.shade, g.dark ? 0.35 : 0.1);
    gl.uniform1f(g.u.dark, g.dark ? 1 : 0);
    gl.uniform3fv(g.u.sea, c.sea); gl.uniform3fv(g.u.ground, c.ground); gl.uniform3fv(g.u.lnd, c.land);
    gl.uniform3fv(g.u.line, c.line); gl.uniform3fv(g.u.ink, c.ink);
    /* lens: the globe closes in inside its resting disc, so a close view is still a round object, never a cropped box */
    var lens = g.opts.lens && g.base;
    gl.uniform3f(g.u.lens, lens ? g.base.cx * d : 0, lens ? (g.H - g.base.cy) * d : 0, lens ? g.base.r * d : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    var ctx = g.ctx;
    ctx.clearRect(0, 0, g.W, g.H);
    if (lens) { ctx.save(); ctx.beginPath(); ctx.arc(g.base.cx, g.base.cy, g.base.r, 0, 7); ctx.clip(); }
    if (g.opts.ink) g.opts.ink(ctx, g);
    if (lens) ctx.restore();
  };
  /* marks: keys in `lit` red (with a ground ring), the rest a small ink point; `ring`: the one in hand gets an ink ring */
  Globe.prototype.marks = function (lit, ring, rest) {
    var g = this, ctx = g.ctx, c = g.col;
    var restA = rest == null ? 0.7 : rest;
    /* the lit marks last, so a mark in hand is never under a neighbour's ring */
    g.places.slice().sort(function (a, b) { return (lit && lit[a.key] ? 1 : 0) - (lit && lit[b.key] ? 1 : 0); }).forEach(function (p) {
      var q = g.project(p.lat, p.lon); p.q = q;
      if (q[2] <= 0.03) return;
      /* lit[key]: true, or 0-1 while a mark rises in (it grows and turns from ink to red) */
      var big = g.style === STYLES.mono ? 1.15 : 1;
      var on = lit && lit[p.key] ? +lit[p.key] : 0, rr = (2.5 + 1.5 * on) * big;
      if (!on && !restA) return;
      /* a crisp round mark: a ground ring (so it reads on land and sea), then the dot */
      ctx.beginPath(); ctx.arc(q[0], q[1], rr + 2, 0, 7); ctx.fillStyle = on > 0.5 ? css(c.ground) : css(g.style === STYLES.ink ? c.ink : c.ground, restA + (1 - restA) * on); ctx.fill();
      ctx.beginPath(); ctx.arc(q[0], q[1], rr, 0, 7); ctx.fillStyle = css(g.style === STYLES.ink ? c.ground : c.ink, restA * (1 - on)); ctx.fill();
      if (on) { ctx.beginPath(); ctx.arc(q[0], q[1], rr, 0, 7); ctx.fillStyle = css(c.red, on); ctx.fill(); }
      if (ring === p.key) { ctx.beginPath(); ctx.arc(q[0], q[1], rr + 6, 0, 7); ctx.strokeStyle = css(c.ink, 0.9); ctx.lineWidth = 1; ctx.stroke(); }
    });
  };
  /* labels: the keys given, each beside its mark, clear of the others and inside the view; `side` prefers right or left */
  /* labels: the keys given, each beside its mark, clear of the others, of every mark and inside the view. Marks closer than
     a fingertip share one label ("Boston · Burlington · Nahant"), set beside the group, never over a mark. */
  Globe.prototype.names = function (keys, opts) {
    var g = this, boxes = [], show = {}, groups = [];
    opts = opts || {};
    (keys || []).forEach(function (k) { show[k] = true; });
    var pad = opts.pad || 1;  // flat is the default (Zach 11-13)
    function seen(p) {
      var q = p.q || g.project(p.lat, p.lon);
      var out = g.opts.lens && g.base && Math.hypot(q[0] - g.base.cx, q[1] - g.base.cy) > g.base.r - 6;
      return !(out || q[2] <= 0.08 || q[0] < 0 || q[0] > g.W || q[1] < 0 || q[1] > g.H) && q;
    }
    /* every mark in view is an obstacle (the named ones always; the others give way when nothing else fits) */
    var marks = [], soft = [];
    g.places.forEach(function (p) { var q = seen(p); if (q) (show[p.key] ? marks : soft).push({ x0: q[0] - 7, y0: q[1] - 7, x1: q[0] + 7, y1: q[1] + 7 }); });
    var lens = g.opts.lens && g.base;
    function inside(r) {
      if (!lens) return r.x0 >= pad && r.x1 <= g.W - pad && r.y0 >= 0 && r.y1 <= g.H;
      return [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]].every(function (c) { return Math.hypot(c[0] - g.base.cx, c[1] - g.base.cy) < g.base.r - 4; });
    }
    function clear(r, list) { return !list.some(function (b) { return !(r.x1 + 3 < b.x0 || r.x0 - 3 > b.x1 || r.y1 + 2 < b.y0 || r.y0 - 2 > b.y1); }); }
    g.places.forEach(function (p) {
      var q = show[p.key] && seen(p);
      if (!q) return;
      var near = groups.filter(function (gr) { return gr.ps.some(function (o) { return Math.hypot(o.q[0] - q[0], o.q[1] - q[1]) < 18; }); })[0];
      if (near) near.ps.push(p); else groups.push({ ps: [p] });
    });
    /* a group whose joined label cannot be placed is named one by one instead */
    var used = {}, queue = groups.slice();
    function place(gr) {
      var lead = gr.ps[0], el = g.label[lead.key], text = gr.ps.map(function (p) { return p.name; }).join(' · ');
      if (el.textContent !== text) el.textContent = text;
      used[lead.key] = true;
      el.hidden = false;
      var xs = gr.ps.map(function (p) { return p.q[0]; }), ys = gr.ps.map(function (p) { return p.q[1]; });
      var bx0 = Math.min.apply(null, xs), bx1 = Math.max.apply(null, xs), by0 = Math.min.apply(null, ys), by1 = Math.max.apply(null, ys), cy = (by0 + by1) / 2;
      var w = el.offsetWidth, h = el.offsetHeight, d = 11;
      var spots = [[bx1 + d, cy - h / 2], [bx0 - d - w, cy - h / 2], [bx1 + d - 4, by0 - h - 4], [bx0 - d - w + 4, by0 - h - 4],
                   [bx1 + d - 4, by1 + 4], [bx0 - d - w + 4, by1 + 4], [(bx0 + bx1) / 2 - w / 2, by0 - h - d], [(bx0 + bx1) / 2 - w / 2, by1 + d],
                   [bx1 + d + 10, cy - h * 1.5 - 4], [bx0 - d - 10 - w, cy - h * 1.5 - 4], [bx1 + d + 10, cy + h / 2 + 4], [bx0 - d - 10 - w, cy + h / 2 + 4]];
      if (opts.side === 'left') spots = [spots[1], spots[0]].concat(spots.slice(2));
      var hit = null;
      for (var pass = 0; pass < 2 && !hit; pass++) {
        var avoid = boxes.concat(marks, pass ? [] : soft);
        for (var s = 0; s < spots.length && !hit; s++) {
          var r = { x0: spots[s][0], y0: spots[s][1] }; r.x1 = r.x0 + w; r.y1 = r.y0 + h;
          if (inside(r) && clear(r, avoid)) hit = r;
        }
      }
      if (!hit) {
        el.hidden = true; delete used[lead.key];
        if (gr.ps.length > 1) gr.ps.forEach(function (p) { queue.push({ ps: [p] }); });
        return;
      }
      boxes.push(hit);
      el.style.transform = 'translate(' + Math.round(hit.x0) + 'px,' + Math.round(hit.y0) + 'px)';
    }
    while (queue.length) place(queue.shift());
    g.places.forEach(function (p) { if (!used[p.key]) g.label[p.key].hidden = true; });
  };

  /* shared: read a pattern's places */
  function placesOf(root) {
    var data = JSON.parse(root.querySelector('[data-dx-globes-data]').textContent);
    var places = data.places.map(function (p) { return { key: p[0], lat: p[1], lon: p[2], name: p[3] }; });
    var by = {}; places.forEach(function (p) { by[p.key] = p; });
    return { data: data, places: places, by: by };
  }
  /* a camera that moves toward a target with time-based damping (tau ms): no frame rate in the feel */
  function damp(cur, tgt, dt, tau) {
    var k = 1 - Math.exp(-dt / tau);
    var n = lerpCam(cur, tgt, k);
    cur.lon = n.lon; cur.lat = n.lat; cur.cx = n.cx; cur.cy = n.cy; cur.r = n.r;
    if (same(cur, tgt)) { cur.lon = tgt.lon; cur.lat = tgt.lat; cur.cx = tgt.cx; cur.cy = tgt.cy; cur.r = tgt.r; return false; }
    return true;
  }
  function set(list, key, attr) { list.forEach(function (a) { if (a.getAttribute('data-dx-globes-key') === key) a.setAttribute(attr, 'true'); else a.removeAttribute(attr); }); }

  /* ---------------------------------------------------------------- GlobeHorizon */
  DX.mount('[data-dx-globes-horizon]', function (root) {
    var P = placesOf(root), places = P.places, by = P.by;
    var track = root.querySelector('.nu-globe__track'), stage = root.querySelector('.nu-globe__stage');
    var beatEls = Array.prototype.slice.call(root.querySelectorAll('.nu-globe__beat'));
    var links = Array.prototype.slice.call(root.querySelectorAll('[data-dx-globes-key]'));
    var bar = root.querySelector('.nu-globe__progress');
    var groups = P.data.beats.map(function (keys) { return keys.map(function (k) { return by[k]; }); });
    var figure = beatEls.length > groups.length;
    var N = groups.length + 2;                               /* the horizon at rest, each beat, the whole (beside the figure) */
    var cams = [], target = null, last = 0, forced = -1, hand = null, beat = -1;
    var still = DX.reduced();
    function phone(g) { return g.W < 720; }
    function cameras(g) {
      var W = g.W, H = g.H, b = g.base, ph = phone(g);
      var rest = { lon: P.data.view[0], lat: P.data.view[1], cx: b.cx, cy: b.cy, r: b.r };
      cams = [rest];
      groups.forEach(function (grp) {
        /* the sphere's top stays under the beat's names (a space-7 and more below a five-name list) */
        var c = centre(grp), r = b.r * (ph ? 1.15 : 1.1), top = ph ? H * 0.42 : H * 0.5;
        cams.push(aim(c.lat, c.lon, W / 2, top + r, r, ph ? W * 0.5 : W * 0.66, ph ? H * 0.7 : H * 0.7));
      });
      /* the whole set: a northern cap rising from the foot of the stage (never the southern oceans), beside the figure */
      var rr = ph ? W * 0.9 : Math.min(W * 0.36, H * 0.86);
      cams.push({ lon: ph ? -86 : P.data.view[0], lat: 12, cx: ph ? W / 2 : W * 0.64, cy: ph ? H * 0.98 : H * 1.02, r: rr });
      if (!figure) cams[cams.length - 1].cx = W / 2;
    }
    function progress() {
      if (still) return 0;
      var t = track.getBoundingClientRect(), span = t.height - window.innerHeight;
      return span > 0 ? Math.max(0, Math.min(1, -t.top / span)) : 0;
    }
    function goal(p) {
      var b = p * (N - 1), i = Math.min(N - 2, Math.floor(b)), f = b - i;
      var e = easeInOut(smooth(0.18, 0.82, f));
      return { cam: lerpCam(cams[i], cams[i + 1], e), at: Math.round(b) };
    }
    function show(n) {
      if (n === beat) return;
      beat = n;
      stage.setAttribute('data-beat', n);
      beatEls.forEach(function (li, k) { li.classList.toggle('is-current', k + 1 === n); });
    }
    var g = new Globe(root.querySelector('.nu-globe-view'), places, {
      resize: function (g) { cameras(g); g.cam = Object.assign({}, still ? cams[0] : goal(progress()).cam); last = 0; },
      tick: function (now, g) {
        var dt = last ? Math.min(64, now - last) : 16; last = now;
        var p = progress(), at;
        if (forced >= 0) { target = cams[forced]; at = forced; }
        else { var o = goal(p); target = o.cam; at = o.at; }
        show(still ? 0 : at);
        if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
        if (still) { g.cam = Object.assign({}, cams[0]); return false; }
        return damp(g.cam, target, dt, 140);
      },
      ink: function (ctx, g) {
        var lit = {}, n = beat;
        if (still || n === N - 1 || n === 0) places.forEach(function (p) { lit[p.key] = true; });
        else (groups[n - 1] || []).forEach(function (p) { lit[p.key] = true; });
        g.marks(lit, hand, 0.55);
        g.names(hand ? [hand] : [], { pad: 8 });   /* one naming layer: the beat's own list names its campuses */
      }
    });
    if (!g.gl) return;
    window.addEventListener('scroll', function () { if (!root.contains(document.activeElement)) forced = -1; g.kick(); }, { passive: true });
    links.forEach(function (a) {
      var k = a.getAttribute('data-dx-globes-key');
      var li = a.closest('.nu-globe__beat'), n = beatEls.indexOf(li) + 1;
      a.addEventListener('focus', function () { if (!still && !a.matches(':hover')) forced = n; hand = k; g.kick(); });
      a.addEventListener('blur', function () { hand = null; g.kick(); });
      a.addEventListener('pointerenter', function (ev) { if (ev.pointerType !== 'touch') { hand = k; g.kick(); } });
      a.addEventListener('pointerleave', function () { if (document.activeElement !== a) { hand = null; g.kick(); } });
    });
    root.classList.add('is-live');
  });

  /* ---------------------------------------------------------------- GlobeOrbit */
  DX.mount('[data-dx-globes-orbit]', function (root) {
    var P = placesOf(root), places = P.places, by = P.by;
    var links = Array.prototype.slice.call(root.querySelectorAll('[data-dx-globes-key]'));
    var pause = root.querySelector('[data-dx-globes-pause]');
    var still = DX.reduced(), held = still, hover = false, drag = null, vel = 0, velLat = 0;
    var active = null, flight = null, last = 0;
    var DRIFT = 0.004;                                             /* degrees a millisecond: one turn in about a minute and a half */
    var g = new Globe(root.querySelector('.nu-globe-view'), places, {
      resize: function (g) { var b = g.base; g.cam.cx = b.cx; g.cam.cy = b.cy; g.cam.r = b.r; if (!g._set) { g.cam.lon = P.data.view[0]; g.cam.lat = P.data.view[1]; g._set = 1; } },
      tick: function (now, g) {
        var dt = last ? Math.min(64, now - last) : 16; last = now;
        var more = false;
        if (flight) {
          var t = Math.min(1, (now - flight.t0) / flight.d), k = easeOut(t);
          g.cam.lon = flight.from.lon + wrap(flight.to.lon - flight.from.lon) * k; g.cam.lat = flight.from.lat + (flight.to.lat - flight.from.lat) * k;
          if (t >= 1) flight = null; more = true;
        } else if (!drag && (Math.abs(vel) > 0.0005 || Math.abs(velLat) > 0.0005)) {
          g.cam.lon -= vel * dt; g.cam.lat = Math.max(-50, Math.min(60, g.cam.lat + velLat * dt));
          vel *= Math.exp(-dt / 320); velLat *= Math.exp(-dt / 320); more = true;
        } else if (!drag && !held && !hover && !active) { g.cam.lon += DRIFT * dt; more = true; }
        return more && g.visible;
      },
      ink: function (ctx, g) {
        var lit = {};
        if (active) lit[active] = true;
        g.marks(lit, active, 0.85);
        g.names(active ? [active] : [], { pad: 4 });
      }
    });
    if (!g.gl) return;
    function choose(k) {
      if (k === active) return;
      active = k; set(links, k, 'aria-current');
      if (k) {
        var p = by[k], to = { lon: p.lon, lat: P.data.frame === 'cap' ? p.lat - 28 : Math.max(32, Math.min(50, p.lat)) };   /* always from the north */
        if (still) { g.cam.lon = to.lon; g.cam.lat = to.lat; } else flight = { from: { lon: g.cam.lon, lat: g.cam.lat }, to: to, t0: performance.now(), d: DX.ms('--dur-scene', root) || 1200 };
        vel = velLat = 0;
      }
      g.kick();
    }
    links.forEach(function (a) {
      var k = a.getAttribute('data-dx-globes-key');
      a.addEventListener('pointerenter', function (ev) { if (ev.pointerType !== 'touch') choose(k); });
      a.addEventListener('focus', function () { choose(k); });
      a.addEventListener('pointerleave', function () { if (document.activeElement !== a) choose(null); });
      a.addEventListener('blur', function () { choose(null); });
    });
    /* drag: horizontal turns, vertical tilts; touch scrolls the page vertically as ever (touch-action: pan-y) */
    var view = g.el;
    view.addEventListener('pointerdown', function (ev) {
      drag = { x: ev.clientX, y: ev.clientY, t: performance.now() }; vel = velLat = 0; flight = null;
      try { view.setPointerCapture(ev.pointerId); } catch (err) { /* nothing */ }
      view.classList.add('is-dragging');
    });
    view.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var now = performance.now(), dt = Math.max(1, now - drag.t), dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      var dl = dx / g.cam.r * DEG, dp = ev.pointerType === 'touch' ? 0 : dy / g.cam.r * DEG;
      g.cam.lon -= dl; g.cam.lat = Math.max(-50, Math.min(60, g.cam.lat + dp));
      vel = vel * 0.6 + (dl / dt) * 0.4; velLat = velLat * 0.6 + (dp / dt) * 0.4;
      drag.x = ev.clientX; drag.y = ev.clientY; drag.t = now;
      g.kick();
    });
    function end() { if (!drag) return; drag = null; view.classList.remove('is-dragging'); if (still) vel = velLat = 0; last = 0; g.kick(); }
    view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
    view.addEventListener('pointerenter', function (ev) { if (ev.pointerType !== 'touch') hover = true; });
    view.addEventListener('pointerleave', function () { hover = false; last = 0; g.kick(); });
    if (pause) {
      pause.hidden = still;
      pause.setAttribute('aria-pressed', held ? 'true' : 'false');
      pause.addEventListener('click', function () { held = !held; pause.setAttribute('aria-pressed', held ? 'true' : 'false'); last = 0; g.kick(); });
    }
    root.classList.add('is-live');
  });

  /* ---------------------------------------------------------------- GlobeTour */
  DX.mount('[data-dx-globes-tour]', function (root) {
    var P = placesOf(root), places = P.places, by = P.by;
    var panels = Array.prototype.slice.call(root.querySelectorAll('.nu-globe__panel'));
    var tabsBox = root.querySelector('.nu-globe__tabs'), steps = root.querySelector('.nu-globe__steps');
    var index = root.querySelector('[data-dx-globes-index]');
    if (!panels.length || !tabsBox) return;
    var still = DX.reduced(), cur = -1, flight = null, last = 0;
    function camFor(g, p) {
      var b = g.base, ph = g.W < 720;
      /* seen from the north: the camera at 40°N over the campus's longitude, so the band the campuses live in fills the sphere */
      return { lon: p.lon, lat: Math.max(36, Math.min(48, p.lat + 6)), cx: b.cx, cy: b.cy, r: b.r };
    }
    var g = new Globe(root.querySelector('.nu-globe-view'), places, {
      resize: function (g) { if (cur >= 0) { flight = null; Object.assign(g.cam, camFor(g, places[cur])); } },
      tick: function (now) {
        if (!flight) return false;
        var t = Math.min(1, (now - flight.t0) / flight.d), k = easeInOut(t);
        var c = lerpCam(flight.from, flight.to, k);
        /* a little rise in the middle of a long flight: the camera pulls back, then settles */
        var lift = Math.sin(Math.PI * k) * Math.min(0.14, flight.w * 0.12);
        c.r = c.r * (1 - lift);
        Object.assign(g.cam, c);
        flight.k = k;
        if (t >= 1) { flight = null; return false; }
        return true;
      },
      ink: function (ctx, g) {
        var lit = {}; if (cur >= 0) lit[places[cur].key] = true;
        g.marks(lit, cur >= 0 && !flight ? places[cur].key : null, 0.4);
        g.names(cur >= 0 && !flight ? [places[cur].key] : [], { pad: 8 });
      }
    });
    /* the tablist: names as tabs, each panel its tabpanel (the panel's own heading carries the name) */
    tabsBox.setAttribute('role', 'tablist');
    var marker = null;
    var lab = root.getAttribute('aria-labelledby'); if (lab) tabsBox.setAttribute('aria-labelledby', lab);
    var tabs = panels.map(function (li) {
      var b = document.createElement('button'), k = li.getAttribute('data-dx-globes-key');
      b.type = 'button'; b.className = 'nu-chip nu-globe__tab'; b.id = li.id + '-tab'; b.textContent = by[k].name;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', li.id); b.setAttribute('aria-selected', 'false'); b.tabIndex = -1;
      li.setAttribute('role', 'tabpanel'); li.setAttribute('aria-labelledby', b.id); li.tabIndex = 0;
      tabsBox.appendChild(b);
      return b;
    });
    function select(n, focus) {
      n = (n + panels.length) % panels.length;
      if (n === cur) return;
      var prev = cur;
      cur = n;
      tabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === n ? 'true' : 'false'); t.tabIndex = k === n ? 0 : -1; });
      panels.forEach(function (li, k) { li.hidden = k !== n; });
      if (index) index.textContent = String(n + 1);
      if (marker) marker.to(tabs[n]);
      if (focus) tabs[n].focus();
      if (!g.gl || !g.base) return;
      var to = camFor(g, places[n]);
      if (prev < 0 || still || !g.W) { Object.assign(g.cam, to); g.kick(); return; }
      var w = angle(vec(places[prev].lat, places[prev].lon), vec(places[n].lat, places[n].lon));
      flight = { from: Object.assign({}, g.cam), to: to, t0: performance.now(), d: (DX.ms('--dur-scene', root) || 1200) * (0.8 + Math.min(0.6, w)), w: w, k: 0 };
      g.kick();
    }
    tabs.forEach(function (t, n) {
      t.addEventListener('click', function () { select(n); });
      t.addEventListener('keydown', function (ev) {
        var k = ev.key, to = k === 'ArrowRight' || k === 'ArrowDown' ? n + 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? n - 1 : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : null;
        if (to === null) return;
        ev.preventDefault(); select(to, true);
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-dx-globes-step]'), function (b) {
      b.addEventListener('click', function () { select(cur + parseInt(b.getAttribute('data-dx-globes-step'), 10)); });
    });
    tabsBox.hidden = false; if (steps) steps.hidden = false;
    marker = DX.indicator && tabsBox.hasAttribute('data-indicator') ? DX.indicator(tabsBox) : null;   /* the system's one gliding pill */
    if (marker && cur >= 0) marker.to(tabs[cur]);
    root.classList.add('is-live');
    var lead = panels.filter(function (li) { return li.hasAttribute('data-dx-globes-lead'); })[0];
    select(Math.max(0, panels.indexOf(lead)));
  });

  /* ---------------------------------------------------------------- GlobeChapters
     The reading line is the middle of the window. A chapter is current from the moment its top crosses the line until the next
     one's does (the first is current from the start, the last to the end), read from layout on every scroll frame, never from
     an IntersectionObserver race. The camera is scrubbed by the same position: between the middles of two chapters it travels
     (eased, with a slight pull-back on long moves) from one chapter's framing to the next, then damps onto it, so the globe
     moves with the reader's hand. While the section enters and leaves, the sphere rises and grows a little (depth); at rest
     it drifts a fraction of a degree, and a chapter's marks rise in from ink to red as it lands. */
  DX.mount('[data-dx-globes-chapters]', function (root) {
    var P = placesOf(root), places = P.places, by = P.by;
    var chapters = Array.prototype.slice.call(root.querySelectorAll('[data-dx-globes-chapter]'));
    var links = Array.prototype.slice.call(root.querySelectorAll('[data-dx-globes-key]'));
    var groups = P.data.chapters.map(function (keys) { return keys.map(function (k) { return by[k]; }); });
    var still = DX.reduced(), cur = -1, hand = null, last = 0, cams = [], glow = {}, t0 = performance.now();
    places.forEach(function (p) { glow[p.key] = 0; });
    function frame(g, n) {
      var b = g.base, c = centre(groups[n]);
      /* close in until the set fills about two thirds of the disc, never past 1.6 times; always seen from the north */
      var r = Math.max(b.r, Math.min(b.r * 1.6, b.r * 0.62 / Math.max(Math.sin(c.spread), 0.04)));   /* the limb stays in view */
      var a = aim(Math.max(c.lat, 34), c.lon, b.cx, b.cy, r, b.cx, b.cy);
      return a;
    }
    function where() {
      var line = window.innerHeight / 2, mids = chapters.map(function (ch) { var r = ch.getBoundingClientRect(); return { top: r.top, mid: r.top + Math.min(r.height, window.innerHeight * 0.6) / 2 }; });
      var n = 0;
      mids.forEach(function (m, k) { if (m.top <= line) n = k; });
      /* the scrub: which pair of middles the line sits between, and how far */
      var b = 0;
      if (line <= mids[0].mid) b = 0;
      else if (line >= mids[mids.length - 1].mid) b = mids.length - 1;
      else for (var k = 0; k < mids.length - 1; k++) if (line >= mids[k].mid && line < mids[k + 1].mid) { b = k + (line - mids[k].mid) / (mids[k + 1].mid - mids[k].mid); break; }
      /* depth: 0 while the section is still below or long gone, 1 while it holds the window */
      var rr = root.getBoundingClientRect(), H = window.innerHeight;
      var enter = smooth(H, H * 0.35, rr.top), leave = smooth(0, -H * 0.5, rr.bottom - H);
      return { n: n, b: b, depth: Math.min(enter, 1 - leave) };
    }
    var g = new Globe(root.querySelector('.nu-globe-view'), places, {
      lens: true,
      resize: function (g) { cams = groups.map(function (grp, n) { return frame(g, n); }); last = 0; var o = goal(g); Object.assign(g.cam, o); },
      tick: function (now, g) {
        var dt = last ? Math.min(64, now - last) : 16; last = now;
        var o = goal(g), w = where();
        if (w.n !== cur) choose(w.n);
        var more = false;
        places.forEach(function (p) {
          var want = cur >= 0 && groups[cur].indexOf(p) >= 0 ? 1 : 0;
          if (still) glow[p.key] = want;
          else if (Math.abs(glow[p.key] - want) > 0.005) { glow[p.key] += (want - glow[p.key]) * (1 - Math.exp(-dt / 220)); more = true; } else glow[p.key] = want;
        });
        if (still) { Object.assign(g.cam, o); return false; }
        return damp(g.cam, o, dt, 120) || more || g.visible;   /* the drift keeps a quiet frame going while in view */
      },
      ink: function (ctx, g) {
        g.marks(glow, hand, 0.45);
        g.names(hand ? [hand] : (cur >= 0 ? groups[cur].filter(function (p) { return glow[p.key] > 0.6; }).map(function (p) { return p.key; }) : []), { pad: 4 });
      }
    });
    if (!g.gl) return;
    function goal(g) {
      if (!cams.length) return Object.assign({}, g.cam);
      var w = where(), i = Math.min(cams.length - 1, Math.floor(w.b)), f = w.b - i, j = Math.min(cams.length - 1, i + 1);
      var e = easeInOut(smooth(0.1, 0.9, f)), c = lerpCam(cams[i], cams[j], e);
      /* a long move pulls back a little in the middle, as a camera would */
      var dist = Math.abs(wrap(cams[j].lon - cams[i].lon)) + Math.abs(cams[j].lat - cams[i].lat);
      c.r *= 1 - Math.sin(Math.PI * e) * Math.min(0.22, dist / 300);
      if (!still) {
        c.lon += Math.sin((performance.now() - t0) / 5200) * 0.6;          /* the drift: a fraction of a degree, slow */
        c.r *= 0.9 + 0.1 * w.depth; c.cy += (1 - w.depth) * g.base.r * 0.12;   /* depth as the section enters and leaves */
      }
      return c;
    }
    function choose(n) {
      cur = n;
      chapters.forEach(function (c, k) { c.classList.toggle('is-current', k === n); });
    }
    window.addEventListener('scroll', function () { g.kick(); }, { passive: true });
    links.forEach(function (a) {
      var k = a.getAttribute('data-dx-globes-key');
      a.addEventListener('focus', function () { hand = k; g.kick(); });
      a.addEventListener('blur', function () { hand = null; g.kick(); });
      a.addEventListener('pointerenter', function (ev) { if (ev.pointerType !== 'touch') { hand = k; g.kick(); } });
      a.addEventListener('pointerleave', function () { if (document.activeElement !== a) { hand = null; g.kick(); } });
    });
    root.classList.add('is-live');
  });
})();
