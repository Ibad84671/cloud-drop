// Direct-to-S3 Upload Handler
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

async function handleFiles(files) {
  if (!files.length) return;
  const file = files[0];
  if (file.size > 2 * 1024 ** 3) {
    alert('File exceeds 2GB limit.');
    return;
  }
  // 1. Get presigned URL from API
  const res = await fetch(`${API_BASE}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type
    })
  });
  const data = await res.json();
  // 2. Upload directly to S3
  const uploadRes = await fetch(data.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type }
  });
  if (uploadRes.ok) {
    // 3. Complete upload
    await fetch(`${API_BASE}/transfer/${data.transferId}/complete`, { method: 'POST' });
    document.getElementById('share-link').value = `${window.location.origin}/t/${data.transferId}`;
    document.getElementById('upload-result').style.display = 'block';
  }
}
