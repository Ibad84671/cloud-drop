const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET = process.env.UPLOADS_BUCKET;
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 2 * 1024 ** 3);
const MAX_NAME_LENGTH = 255;
const PRESIGNED_URL_EXPIRY = 900;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json'
};

const response = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

function validateFile(fileName, fileSize, contentType) {
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > MAX_NAME_LENGTH) {
    throw Object.assign(new Error('Invalid file name.'), { statusCode: 400 });
  }
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
    throw Object.assign(new Error('File is too large or invalid.'), { statusCode: 413 });
  }
  if (typeof contentType !== 'string' || contentType.length > 200) {
    throw Object.assign(new Error('Invalid content type.'), { statusCode: 400 });
  }
}

exports.handler = async (event) => {
  if (event?.requestContext?.http?.method === 'OPTIONS') return response(204, null);

  try {
    if (!TABLE_NAME || !BUCKET) throw new Error('Service configuration is incomplete.');
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    const { fileName, fileSize, contentType } = body;
    validateFile(fileName, fileSize, contentType);

    const transferId = crypto.randomUUID();
    const objectKey = `uploads/${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const ownerId = event.requestContext?.authorizer?.claims?.sub || event.requestContext?.authorizer?.jwt?.claims?.sub || 'guest';

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        transferId,
        objectKey,
        originalFileName: fileName.trim(),
        fileSize,
        contentType,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        ttl: Math.floor(expiresAt.getTime() / 1000),
        downloadCount: 0,
        ownerId
      },
      ConditionExpression: 'attribute_not_exists(transferId)'
    }));

    const uploadUrl = await getSignedUrl(s3Client, new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      ContentType: contentType
    }), { expiresIn: PRESIGNED_URL_EXPIRY });

    return response(201, { success: true, data: { transferId, uploadUrl, expiresAt: expiresAt.toISOString() } });
  } catch (error) {
    console.error('create-transfer failed', { name: error.name, statusCode: error.statusCode });
    const statusCode = error.statusCode || (error instanceof SyntaxError ? 400 : 500);
    return response(statusCode, { success: false, error: { code: statusCode === 400 ? 'INVALID_REQUEST' : statusCode === 413 ? 'FILE_TOO_LARGE' : 'INTERNAL_ERROR', message: statusCode === 500 ? 'Unable to create transfer.' : error.message } });
  }
};