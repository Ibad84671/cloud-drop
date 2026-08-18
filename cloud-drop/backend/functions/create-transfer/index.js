const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const { validateFile } = require('../../shared/validation');
const { PRESIGNED_URL_EXPIRY, DEFAULT_EXPIRY_DAYS, DYNAMODB_TABLE, S3_BUCKET } = require('../../shared/constants');

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { fileName, fileSize, contentType } = body;

    validateFile(fileName, fileSize, contentType);

    const transferId = crypto.randomUUID();
    const objectKey = `uploads/${crypto.randomUUID()}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 86400000).toISOString();

    // Store metadata
    await docClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: {
        transferId,
        objectKey,
        originalFileName: fileName,
        fileSize,
        contentType,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt,
        downloadCount: 0,
        ownerId: event.requestContext?.authorizer?.claims?.sub || 'guest',
        ttl: Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_DAYS * 86400,
      }
    }));

    // Generate presigned upload URL
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_URL_EXPIRY });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferId,
        uploadUrl,
        expiresAt,
        downloadLink: `https://${event.headers.host}/t/${transferId}`
      })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
