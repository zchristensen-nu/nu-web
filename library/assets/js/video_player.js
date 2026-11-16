/* Content films with designed controls (build/pages/_player.py). build.py links every build/js file on every page, so this does
   nothing unless a [data-player] is on the page. Without script the video keeps its native controls. */
(() => {
  const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
  document.querySelectorAll('[data-player]').forEach((root) => {
    const v = root.querySelector('video');
    const big = root.querySelector('.vp__play');
    const bar = root.querySelector('.vp__bar');
    const toggle = root.querySelector('.vp__toggle');
    const mute = root.querySelector('.vp__mute');
    const seek = root.querySelector('.vp__seek');
    const [now, total] = root.querySelectorAll('.vp__time');
    if (!v || !big || !bar) return;
    v.removeAttribute('controls');
    big.hidden = false;
    bar.hidden = false;

    const play = () => v.play().catch(() => {});
    const flip = () => (v.paused || v.ended ? play() : v.pause());
    let idle;
    const wake = () => {
      root.classList.remove('is-idle');
      clearTimeout(idle);
      if (!v.paused) idle = setTimeout(() => root.classList.add('is-idle'), 2500);
    };

    big.addEventListener('click', () => { play(); toggle.focus({ preventScroll: true }); });
    v.addEventListener('click', flip);
    toggle.addEventListener('click', flip);
    v.addEventListener('play', () => { root.classList.add('is-started', 'is-playing'); toggle.setAttribute('aria-label', 'Pause'); wake(); });
    v.addEventListener('pause', () => { root.classList.remove('is-playing'); toggle.setAttribute('aria-label', 'Play'); wake(); });
    v.addEventListener('ended', () => root.classList.remove('is-started'));
    v.addEventListener('loadedmetadata', () => { total.textContent = fmt(v.duration); });
    v.addEventListener('timeupdate', () => {
      const p = v.duration ? v.currentTime / v.duration : 0;
      seek.value = Math.round(p * 1000);
      root.style.setProperty('--vp-progress', `${p * 100}%`);
      now.textContent = fmt(v.currentTime);
    });
    seek.addEventListener('input', () => { if (v.duration) v.currentTime = (seek.value / 1000) * v.duration; });
    mute.addEventListener('click', () => {
      v.muted = !v.muted;
      mute.setAttribute('aria-pressed', String(v.muted));
      mute.setAttribute('aria-label', v.muted ? 'Unmute' : 'Mute');
    });
    root.querySelector('.vp__full').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else (root.requestFullscreen ? root.requestFullscreen() : v.webkitEnterFullscreen?.());
    });
    root.addEventListener('pointermove', wake);
    root.addEventListener('focusin', wake);
  });
})();
