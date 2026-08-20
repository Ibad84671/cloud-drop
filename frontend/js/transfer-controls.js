(() => {
  'use strict';

  function init() {
    const input = document.getElementById('fileInput');
    const drop = document.getElementById('dropZone');
    const browse = document.getElementById('browseBtn');
    if (!input || !drop) return;
    if (drop.dataset.transferControls === '1') return;
    drop.dataset.transferControls = '1';

    const pick = event => {
      if (event) event.stopPropagation();
      input.click();
    };

    if (browse) browse.addEventListener('click', pick);

    drop.addEventListener('click', event => {
      if (event.target.closest('#browseBtn')) return;
      pick(event);
    });

    drop.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.defaultPrevented) {
        event.preventDefault();
        input.click();
      }
    });

    ['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      drop.classList.add('drag');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }));

    ['dragleave'].forEach(type => drop.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      if (!event.relatedTarget || !drop.contains(event.relatedTarget)) {
        drop.classList.remove('drag');
      }
    }));

    drop.addEventListener('drop', event => {
      event.preventDefault();
      event.stopPropagation();
      drop.classList.remove('drag');
      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;

      try {
        const dt = new DataTransfer();
        files.forEach(file => dt.items.add(file));
        input.files = dt.files;
      } catch (_) {}

      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    document.addEventListener('dragover', event => {
      event.preventDefault();
    });

    document.addEventListener('drop', event => {
      if (!drop.contains(event.target)) event.preventDefault();
    });

    // Avoid multiple site-level handlers interfering with the real transfer controls.
    const upload = document.getElementById('uploadBtn');
    if (upload) upload.type = 'button';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
