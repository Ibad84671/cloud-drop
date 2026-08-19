const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET = process.env.UPLOADS_BUCKET;
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Content-Type': 'application/json' };
const response = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
const safeFileName = name => String(name || 'download').replace(/[\r\n"\\/]/g, '_').slice(0, 180) || 'download';

exports.handler = async event => {
  if (event?.requestContext?.http?.method === 'OPTIONS') return response(204, null);
  try {
    const transferId = event?.pathParameters?.id;
    if (!transferId || !/^[0-9a-f-]{36}$/i.test(transferId)) return response(400, { success: false, error: { code: 'INVALID_TRANSFER_ID', message: 'Invalid transfer ID.' } });
    const item = (await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { transferId } }))).Item;
    if (!item) return response(404, { success: false, error: { code: 'TRANSFER_NOT_FOUND', message: 'Transfer not found.' } });
    if (item.expiresAt && Date.parse(item.expiresAt) <= Date.now()) return response(410, { success: false, error: { code: 'TRANSFER_EXPIRED', message: 'Transfer expired.' } });
    if (item.status !== 'ready') return response(409, { success: false, error: { code: 'TRANSFER_NOT_READY', message: 'This transfer is not ready for download.' } });

    let key;
    let fileName;
    let fileSize = item.fileSize || item.totalSize || 0;
    let fileCount = 1;
    if (item.isBatch && item.zipKey) {
      key = item.zipKey;
      fileName = safeFileName(item.zipKey.split('/').pop());
      fileCount = Array.isArray(item.files) ? item.files.length : 0;
    } else {
      key = item.objectKey;
      fileName = safeFileName(item.originalFileName);
    }
    if (!key || !key.startsWith(item.isBatch ? `zips/${transferId}` : 'uploads/')) return response(500, { success: false, error: { code: 'INVALID_STORAGE_REFERENCE', message: 'Transfer storage metadata is invalid.' } });

    const downloadUrl = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET, Key: key, ResponseContentDisposition: `attachment; filename="${fileName}"` }), { expiresIn: 300 });
    docClient.send(new UpdateCommand({ TableName: TABLE_NAME, Key: { transferId }, UpdateExpression: 'ADD downloadCount :inc', ExpressionAttributeValues: { ':inc': 1 } })).catch(error => console.error('download counter update failed', { name: error.name }));
    return response(200, { success: true, data: { downloadUrl, fileName, fileSize, fileCount, expiresAt: item.expiresAt } });
  } catch (error) {
    console.error('get-transfer failed', { name: error.name });
    return response(500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Unable to prepare download.' } });
  }
};