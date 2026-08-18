const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DYNAMODB_TABLE, S3_BUCKET, PRESIGNED_URL_EXPIRY } = require('../../shared/constants');

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

exports.handler = async (event) => {
  try {
    const transferId = event.pathParameters.id;
    const result = await docClient.send(new GetCommand({
      TableName: DYNAMODB_TABLE,
      Key: { transferId }
    }));
    const item = result.Item;
    if (!item) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Transfer not found' }) };
    }
    if (new Date(item.expiresAt) < new Date()) {
      return { statusCode: 410, body: JSON.stringify({ error: 'Transfer expired' }) };
    }
    if (item.status === 'pending') {
      return { statusCode: 202, body: JSON.stringify({ message: 'Upload still processing' }) };
    }

    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: item.objectKey,
      ResponseContentDisposition: `attachment; filename="${item.originalFileName}"`
    });
    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 min

    // Increment download count (async, no await)
    docClient.send(new UpdateCommand({
      TableName: DYNAMODB_TABLE,
      Key: { transferId },
      UpdateExpression: 'ADD downloadCount :inc',
      ExpressionAttributeValues: { ':inc': 1 }
    })).catch(() => {});

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        fileName: item.originalFileName,
        fileSize: item.fileSize,
        downloadUrl,
        expiresAt: item.expiresAt
      })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal error' })
    };
  }
};
