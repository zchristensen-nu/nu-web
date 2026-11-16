/* The component library (build/pages/_library.py): find a component, the phone menu, the specimen's ground and width, copy. */
(function () {
  /* find: filters the side list by name as you type */
  var input = document.querySelector('[data-lb-filter]'), none = document.querySelector('[data-lb-none]');
  if (input) input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase(), any = false;
    [].forEach.call(document.querySelectorAll('.lb-nav__group'), function (g) {
      var shown = 0;
      [].forEach.call(g.querySelectorAll('.lb-nav__link'), function (a) {
        var on = !q || a.getAttribute('data-name').indexOf(q) > -1;
        a.parentNode.hidden = !on; if (on) shown++;
      });
      [].forEach.call(g.querySelectorAll('.lb-nav__sub'), function (u) {   // a family stays while one of its layouts matches
        if (u.querySelector('li:not([hidden])')) { if (u.parentNode.hidden) shown++; u.parentNode.hidden = false; }
      });
      g.hidden = !shown; if (shown) any = true;
    });
    none.hidden = any;
  });
  var current = document.querySelector('.lb-nav__link[aria-current="page"]');
  var navList = document.querySelector('.lb-nav');   // the side list scrolls to the page in hand; the page itself does not move
  if (current && navList) navList.scrollTop = current.offsetTop - navList.offsetTop - navList.clientHeight / 2;

  /* the phone menu */
  var menu = document.querySelector('.lb-menu'), side = document.querySelector('.lb-side');
  if (menu) menu.addEventListener('click', function () {
    var open = !side.classList.contains('is-open');
    side.classList.toggle('is-open', open); menu.setAttribute('aria-expanded', String(open));
    if (open && input) input.focus();
  });

  /* the specimens: each a window of 1440 x 900 scaled to the column, or a phone of 390 x 844 at its size. One width and ground
     for the whole page (a merge set's members switch together). A part (an atom or a molecule) fits its own height. */
  var stages = [].slice.call(document.querySelectorAll('.lb-stage'));
  if (!stages.length) return;
  var WIN = { 1440: 900, 390: 844 };
  var state = { w: window.matchMedia('(max-width: 720px)').matches ? 390 : 1440 };
  try { var keep = JSON.parse(sessionStorage.getItem('lb')) || {}; if (keep.w) state.w = keep.w; } catch (err) { /* private window */ }
  if (!document.querySelector('[data-width]')) state.w = 1440;   // a foundation sheet: drawn for the wide window only
  var views = stages.map(function (st) {
    var frame = st.querySelector('[data-lb-frame]');
    return { st: st, view: st.querySelector('[data-lb-view]'), frame: frame, fitted: 0,
             mode: new URL(frame.getAttribute('src'), location.href).searchParams.get('mode') || 'light' };
  });
  window.addEventListener('message', function (ev) {
    views.forEach(function (v) { if (ev.source === v.frame.contentWindow && ev.data && ev.data.lbHeight) { v.fitted = ev.data.lbHeight; fit(v); } });
  });
  function fit(v) {
    v.view.setAttribute('data-w', state.w);
    var h = v.fitted || WIN[state.w], room = v.view.clientWidth;
    v.frame.style.width = state.w + 'px'; v.frame.style.height = h + 'px';
    var k = state.w === 1440 ? Math.min(1, room / 1440) : Math.min(1, (room - 32) / 390);
    v.frame.style.transform = k < 1 ? 'scale(' + k + ')' : '';
    v.view.style.height = state.w === 1440 ? Math.round(h * k) + 'px' : (k < 1 ? Math.round(h * k) + 48 + 'px' : '');
    [].forEach.call(v.st.querySelectorAll('[data-width]'), function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-width')) === state.w)); });
    [].forEach.call(v.st.querySelectorAll('[data-ground]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ground') === v.mode)); });
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-width],[data-ground]');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-width')) {
      state.w = Number(b.getAttribute('data-width'));
      try { sessionStorage.setItem('lb', JSON.stringify({ w: state.w })); } catch (err) { /* */ }
      views.forEach(function (v) { v.fitted = 0; fit(v); });
    } else {
      var v = views.filter(function (x) { return x.st.contains(b); })[0];
      v.mode = b.getAttribute('data-ground'); v.fitted = 0;
      v.frame.src = 'frame.html?c=' + v.frame.getAttribute('data-slug') + '&mode=' + v.mode;
      fit(v);
    }
  });
  window.addEventListener('resize', function () { views.forEach(fit); });
  views.forEach(fit);

  /* copy the markup */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-lb-copy]');
    if (!b) return;
    var text = document.getElementById(b.getAttribute('data-lb-copy')).textContent, label = b.textContent;
    var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = label; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy the markup', text); });
    else window.prompt('Copy the markup', text);
  });
})();
