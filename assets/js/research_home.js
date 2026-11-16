/* research.northeastern.edu home: behaviour for QuestionPath, ThemeExplorer and AwardScale. Progressive enhancement only: with no
   script every beat, theme, project and bar is already on the page, in order. Native scroll always; IntersectionObserver, no scroll
   handlers; transforms and opacity only. build.py links this file on every page, so it leaves at once unless its root is here. */
(() => {
  const root = document.querySelector('.un-res');
  if (!root) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const set = (el, on, attr = 'data-active') => (on ? el.setAttribute(attr, '') : el.removeAttribute(attr));

  /* ThemeExplorer: WAI-ARIA tabs over the themes; a pressed-button picker over each theme's projects */
  root.querySelectorAll('[data-theme-explorer]').forEach((ex) => {
    const list = ex.querySelector('.nu-theme-explorer__tabs');
    const tabs = [...ex.querySelectorAll('[data-theme-tab]')];
    const panels = tabs.map((t) => ex.querySelector(`#re-theme-${t.dataset.themeTab}`));
    if (!list || !tabs.length || panels.some((p) => !p)) return;

    // Tabs and picks carry aria-controls; clicks stop here so the kit's generic aria-controls disclosure (site.js) never toggles them.
    ex.addEventListener('click', (ev) => { if (ev.target.closest('[data-theme-tab], [data-project]')) ev.stopPropagation(); });
    list.setAttribute('role', 'tablist');
    list.hidden = false;
    tabs.forEach((t, n) => {
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-controls', panels[n].id);
      panels[n].setAttribute('role', 'tabpanel');
      panels[n].setAttribute('aria-labelledby', t.id);
      panels[n].tabIndex = 0;
    });
    // Unchosen themes and projects: inert and [data-off] (the component's CSS takes them out of the layout).
    const off = (el, on) => { el.inert = on; set(el, on, 'data-off'); };
    const choose = (n, focus) => {
      tabs.forEach((t, k) => {
        t.setAttribute('aria-selected', String(k === n));
        t.tabIndex = k === n ? 0 : -1;
        off(panels[k], k !== n);
      });
      if (focus) tabs[n].focus();
    };
    tabs.forEach((t, n) => {
      t.addEventListener('click', () => choose(n, false));
      t.addEventListener('keydown', (ev) => {
        const last = tabs.length - 1;
        const to = { ArrowRight: n === last ? 0 : n + 1, ArrowLeft: n === 0 ? last : n - 1, Home: 0, End: last }[ev.key];
        if (to === undefined) return;
        ev.preventDefault();
        choose(to, true);
      });
    });

    panels.forEach((panel) => {
      const picker = panel.querySelector('.nu-theme-explorer__picker');
      const picks = [...panel.querySelectorAll('[data-project]')];
      const projects = picks.map((b) => panel.querySelector(`#${b.getAttribute('aria-controls')}`));
      if (!picker || !picks.length || projects.some((p) => !p)) return;
      picker.hidden = false;
      const pick = (n) => picks.forEach((b, k) => { b.setAttribute('aria-pressed', String(k === n)); off(projects[k], k !== n); });
      picks.forEach((b, n) => b.addEventListener('click', () => pick(n)));
      pick(0);
    });

    ex.setAttribute('data-enhanced', '');
    choose(0, false);
  });

  /* AwardScale: bars draw out from zero once the scale is in view (not at all under reduced motion) */
  root.querySelectorAll('[data-award-scale]').forEach((sc) => {
    if (still.matches || !('IntersectionObserver' in window)) return;
    const rows = sc.querySelector('.nu-award-scale__rows');
    if (!rows || rows.getBoundingClientRect().top < innerHeight * 0.85) return; // already on screen: leave it drawn
    sc.setAttribute('data-armed', '');
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { sc.setAttribute('data-shown', ''); io.disconnect(); }
    }, { rootMargin: '0px 0px -20% 0px' });
    io.observe(rows);
  });
})();
