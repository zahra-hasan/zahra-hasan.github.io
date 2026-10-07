// Loaded synchronously in <head> so the right theme is applied before paint.
(function () {
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem('theme'); } catch (e) {}
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = stored === 'light' || stored === 'dark' ? stored : prefersDark ? 'dark' : 'light';

  document.addEventListener('click', function (event) {
    var button = event.target instanceof Element && event.target.closest('[data-theme-toggle]');
    if (!button) return;
    var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
})();
