const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET = process.env.UPLOADS_BUCKET;
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Content-Type': 'application/json' };
const response = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event?.requestContext?.http?.method === 'OPTIONS') return response(204, null);
  try {
    const transferId = event?.pathParameters?.id;
    if (!transferId || !/^[0-9a-f-]{36}$/i.test(transferId)) return response(400, { success: false, error: { code: 'INVALID_TRANSFER_ID', message: 'Invalid transfer ID.' } });

    const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { transferId } }));
    const item = result.Item;
    if (!item) return response(404, { success: false, error: { code: 'TRANSFER_NOT_FOUND', message: 'Transfer not found.' } });
    if (item.expiresAt && Date.parse(item.expiresAt) <= Date.now()) return response(410, { success: false, error: { code: 'TRANSFER_EXPIRED', message: 'Transfer expired.' } });
    if (item.status === 'ready') return response(200, { success: true, data: { transferId, status: 'ready' } });
    if (item.status !== 'pending') return response(409, { success: false, error: { code: 'INVALID_TRANSFER_STATE', message: 'Transfer cannot be completed from its current state.' } });

    if (!item.objectKey) return response(400, { success: false, error: { code: 'MISSING_OBJECT_KEY', message: 'Upload metadata is incomplete.' } });
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: item.objectKey }));
    } catch (error) {
      if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return response(409, { success: false, error: { code: 'UPLOAD_NOT_FOUND', message: 'The file has not finished uploading.' } });
      throw error;
    }

    const updated = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { transferId },
      UpdateExpression: 'SET #status = :ready, completedAt = :completedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':ready': 'ready', ':completedAt': new Date().toISOString() },
      ConditionExpression: '#status = :pending'
    }));

    return response(200, { success: true, data: { transferId, status: updated.Attributes?.status || 'ready' } });
  } catch (error) {
    console.error('complete-upload failed', { name: error.name });
    if (error.name === 'ConditionalCheckFailedException') return response(200, { success: true, data: { status: 'ready' } });
    return response(500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Unable to complete upload.' } });
  }
};