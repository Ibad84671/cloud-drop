(() => {
  'use strict';

  function install() {
    const input = document.getElementById('fileInput');
    const drop = document.getElementById('dropZone');
    if (!input || !drop || drop.dataset.uploadFixInstalled === '1') return;
    drop.dataset.uploadFixInstalled = '1';

    const setFilesAndNotify = files => {
      const list = Array.from(files || []);
      if (!list.length) return;
      try {
        const transfer = new DataTransfer();
        list.forEach(file => transfer.items.add(file));
        input.files = transfer.files;
      } catch (_) {}
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    document.addEventListener('dragover', event => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }, true);

    document.addEventListener('drop', event => {
      if (!drop.contains(event.target)) event.preventDefault();
    }, true);

    drop.addEventListener('dragenter', event => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      drop.classList.add('drag');
    }, true);

    drop.addEventListener('dragover', event => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      drop.classList.add('drag');
    }, true);

    drop.addEventListener('dragleave', event => {
      event.preventDefault();
      if (!event.relatedTarget || !drop.contains(event.relatedTarget)) {
        drop.classList.remove('drag');
      }
    }, true);

    drop.addEventListener('drop', event => {
      event.preventDefault();
      drop.classList.remove('drag');
      setFilesAndNotify(event.dataTransfer?.files);
    }, true);

    drop.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      input.click();
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
