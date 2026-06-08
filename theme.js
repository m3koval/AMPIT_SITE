// ── AMP IT theme toggle ────────────────────────────────────────────────────
// Reads localStorage → falls back to OS preference → defaults to dark.
// Runs immediately (script tag in <head>) to prevent flash of wrong theme.
(function () {
  var saved = localStorage.getItem('ampit-theme');
  var preferLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  var theme = saved || (preferLight ? 'light' : 'dark');
  document.documentElement.dataset.theme = theme;

  // Wire up the toggle button once the DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;

    function apply(t) {
      document.documentElement.dataset.theme = t;
      localStorage.setItem('ampit-theme', t);
    }

    btn.addEventListener('click', function () {
      apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  });
})();
