(() => {
  const toggle = document.getElementById('themeToggle');
  const root = document.documentElement;
  if (!toggle) return;

  const saved = localStorage.getItem('theme');
  const initial = saved === 'light' || saved === 'dark' ? saved : 'dark';
  root.setAttribute('data-theme', initial);
  toggle.setAttribute('aria-pressed', String(initial === 'dark'));

  toggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    toggle.setAttribute('aria-pressed', String(next === 'dark'));
  });
})();
