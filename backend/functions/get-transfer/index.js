const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});
const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET = process.env.UPLOADS_BUCKET;

exports.handler = async (event) => {
  try {
    const transferId = event.pathParameters.id;

    // DynamoDB se metadata lo
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { transferId }
    }));
    const item = result.Item;

    if (!item) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Transfer not found' }) };
    }
    if (item.status !== 'ready') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Upload not complete yet' }) };
    }
    if (new Date(item.expiresAt) < new Date()) {
      return { statusCode: 410, body: JSON.stringify({ error: 'Transfer expired' }) };
    }

    // Presigned download URL generate karo
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: item.objectKey,
      ResponseContentDisposition: `attachment; filename="${item.originalFileName}"`
    });
    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 min

    // Download count increment (fire and forget)
    docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { transferId },
      UpdateExpression: 'ADD downloadCount :inc',
      ExpressionAttributeValues: { ':inc': 1 }
    })).catch(() => {});

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        downloadUrl,
        fileName: item.originalFileName,
        fileSize: item.fileSize
      })
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