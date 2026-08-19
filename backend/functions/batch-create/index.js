const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const TABLE = process.env.TABLE_NAME;
const BUCKET = process.env.UPLOADS_BUCKET;
const MAX_FILES = Number(process.env.MAX_FILES || 20);
const MAX_TOTAL_SIZE = Number(process.env.MAX_TOTAL_SIZE || 2 * 1024 ** 3);
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 2 * 1024 ** 3);
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Content-Type': 'application/json' };
const response = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

function validateFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_FILES) throw Object.assign(new Error(`Choose between 1 and ${MAX_FILES} files.`), { statusCode: 400 });
  let total = 0;
  for (const file of files) {
    if (!file || typeof file.fileName !== 'string' || !file.fileName.trim() || file.fileName.length > 255) throw Object.assign(new Error('Invalid file name.'), { statusCode: 400 });
    if (!Number.isSafeInteger(file.fileSize) || file.fileSize <= 0 || file.fileSize > MAX_FILE_SIZE) throw Object.assign(new Error('Invalid or oversized file.'), { statusCode: 413 });
    if (typeof file.contentType !== 'string' || file.contentType.length > 200) throw Object.assign(new Error('Invalid content type.'), { statusCode: 400 });
    total += file.fileSize;
    if (total > MAX_TOTAL_SIZE) throw Object.assign(new Error('Total upload size exceeds the limit.'), { statusCode: 413 });
  }
  return total;
}

exports.handler = async (event) => {
  if (event?.requestContext?.http?.method === 'OPTIONS') return response(204, null);
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    const files = body.files || [];
    const totalSize = validateFiles(files);
    const transferId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const ownerId = event.requestContext?.authorizer?.claims?.sub || event.requestContext?.authorizer?.jwt?.claims?.sub || 'guest';
    const fileItems = files.map(file => ({ fileName: file.fileName.trim(), fileSize: file.fileSize, contentType: file.contentType, objectKey: `uploads/${transferId}/${crypto.randomUUID()}` }));

    await docClient.send(new PutCommand({ TableName: TABLE, Item: { transferId, ownerId, status: 'pending', createdAt: new Date().toISOString(), expiresAt: expiresAt.toISOString(), ttl: Math.floor(expiresAt.getTime() / 1000), totalSize, files: fileItems, isBatch: true, downloadCount: 0 }, ConditionExpression: 'attribute_not_exists(transferId)' }));

    const uploads = await Promise.all(fileItems.map(async item => ({ fileName: item.fileName, uploadUrl: await getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: item.objectKey, ContentType: item.contentType }), { expiresIn: 900 }) })));
    return response(201, { success: true, data: { transferId, uploads, expiresAt: expiresAt.toISOString() } });
  } catch (error) {
    console.error('batch-create failed', { name: error.name, statusCode: error.statusCode });
    const statusCode = error.statusCode || (error instanceof SyntaxError ? 400 : 500);
    return response(statusCode, { success: false, error: { code: statusCode === 500 ? 'INTERNAL_ERROR' : statusCode === 413 ? 'FILE_TOO_LARGE' : 'INVALID_REQUEST', message: statusCode === 500 ? 'Unable to create transfer.' : error.message } });
  }
};