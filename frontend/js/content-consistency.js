(() => {
  'use strict';

  function install() {
    const hero = document.querySelector('.left .eyebrow');
    if (hero && hero.textContent.trim() === 'SHARE WITHOUT LIMITS') {
      hero.textContent = 'SHARE WITHOUT HASSLE';
    }

    document.querySelectorAll('.strip-item').forEach(item => {
      const strong = item.querySelector('strong');
      const span = item.querySelector('span');
      if (!strong || !span) return;
      if (strong.textContent.trim() === 'No limits') {
        strong.textContent = 'Large file transfers';
        span.textContent = 'Up to 2GB per transfer';
      }
    });

    const note = document.querySelector('.drop-note');
    if (note) note.textContent = 'Up to 2GB per transfer · Up to 100 files';

    const limit = document.querySelector('.limit-text');
    if (limit && limit.textContent.trim() === 'No files selected.') {
      limit.textContent = 'Up to 2GB per transfer · Up to 100 files';
    }

    document.querySelectorAll('body *').forEach(node => {
      if (node.children.length === 0 && node.textContent.trim() === 'No limits') {
        node.textContent = 'Large file transfers';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
