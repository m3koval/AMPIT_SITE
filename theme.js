// ── AMP IT theme toggle ────────────────────────────────────────────────────
// Loaded just before </body>, so DOM is already available — no DOMContentLoaded needed.
// FOUC prevention is handled by the separate inline <script> in <head>.
(function () {
  function apply(t) {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('ampit-theme', t);
  }

  // Re-apply saved/preferred theme (backup in case inline script was cached away)
  var saved = localStorage.getItem('ampit-theme');
  var preferLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  apply(saved || (preferLight ? 'light' : 'dark'));

  // Wire toggle button — DOM is ready since this script is at bottom of <body>
  var btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', function () {
      apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }
})();
