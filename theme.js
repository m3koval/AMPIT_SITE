// ── AMP IT theme toggle ────────────────────────────────────────────────────
// Uses setAttribute (more reliable than dataset in Safari).
// FOUC prevention is handled by the separate inline <script> in <head>.
(function () {
  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('ampit-theme', t); } catch (e) {}
  }

  // Re-apply saved/preferred theme
  var saved;
  try { saved = localStorage.getItem('ampit-theme'); } catch (e) {}
  var preferLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  apply(saved || (preferLight ? 'light' : 'dark'));

  // Wire toggle button — DOM is ready since this script is at bottom of <body>
  var btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      apply(current === 'light' ? 'dark' : 'light');
    });
  }
})();
