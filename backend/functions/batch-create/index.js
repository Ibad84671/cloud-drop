const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const TABLE = process.env.TABLE_NAME;
const BUCKET = process.env.UPLOADS_BUCKET;

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const files = body.files || [];
    if (!files.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No files provided' }) };
    }

    const transferId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const ttl = Math.floor(expiresAt.getTime() / 1000);
    const ownerId = event.requestContext?.authorizer?.claims?.sub || 'guest';

    const fileItems = files.map(f => ({
      fileName: f.fileName,
      fileSize: f.fileSize,
      contentType: f.contentType,
      objectKey: `uploads/${transferId}/${f.fileName}`
    }));

    await ddbDoc.send(new PutCommand({
      TableName: TABLE,
      Item: {
        transferId,
        ownerId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        ttl,
        files: fileItems,
        isBatch: true,
        downloadCount: 0
      }
    }));

    const presignedUrls = await Promise.all(fileItems.map(async (item) => {
      const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: item.objectKey,
        ContentType: item.contentType,
      });
      const url = await getSignedUrl(s3, command, { expiresIn: 900 });
      return { fileName: item.fileName, uploadUrl: url };
    }));

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ transferId, uploads: presignedUrls })
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};