const { MAX_FILE_SIZE } = require('./constants');

function validateFile(fileName, fileSize, contentType) {
  if (!fileName || typeof fileName !== 'string') throw new Error('Invalid file name');
  if (!fileSize || fileSize > MAX_FILE_SIZE) throw new Error('File too large (max 2GB)');
  if (fileSize <= 0) throw new Error('Empty file');
  // Block executable/binary by extension (basic security)
  const ext = fileName.split('.').pop().toLowerCase();
  const blocked = ['exe', 'bat', 'cmd', 'sh', 'js', 'vbs', 'ps1'];
  if (blocked.includes(ext)) throw new Error('File type not allowed');
  return true;
}

module.exports = { validateFile };
