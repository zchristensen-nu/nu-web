/* co-op page: the "Watch video" pill plays the co-op film in place (with sound, native controls). build.py links every build/js file on
   every page, so this returns at once unless the film is on the page. Without script the pill links to the video file. */
(() => {
  const root = document.querySelector('[data-coop-film]');
  if (!root) return;
  const video = root.querySelector('video');
  const play = root.querySelector('[data-coop-play]');
  if (!video || !play) return;
  play.addEventListener('click', (ev) => {
    ev.preventDefault();
    video.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    video.play().catch(() => {});
    video.focus({ preventScroll: true });
  });
})();
