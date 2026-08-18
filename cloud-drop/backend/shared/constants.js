module.exports = {
  MAX_FILE_SIZE: 2 * 1024 ** 3, // 2GB
  PRESIGNED_URL_EXPIRY: 900,    // 15 minutes
  DEFAULT_EXPIRY_DAYS: 30,
  DYNAMODB_TABLE: process.env.TABLE_NAME || 'CloudDrop-Metadata',
  S3_BUCKET: process.env.UPLOADS_BUCKET || 'clouddrop-uploads',
};
