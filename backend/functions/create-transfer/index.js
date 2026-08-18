const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET = process.env.UPLOADS_BUCKET;

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { fileName, fileSize, contentType } = body;

    const transferId = crypto.randomUUID();
    const objectKey = `uploads/${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const ttl = Math.floor(expiresAt.getTime() / 1000);

    // DynamoDB mein metadata store karo
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        transferId,
        objectKey,
        originalFileName: fileName,
        fileSize,
        contentType,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        ttl,
        downloadCount: 0,
      }
    }));

    // Presigned S3 upload URL generate karo
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 min

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ transferId, uploadUrl })
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