const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const archiver = require('archiver');

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BUCKET = process.env.UPLOADS_BUCKET;
const TABLE = process.env.TABLE_NAME;
const MAX_ARCHIVE_BYTES = Number(process.env.MAX_ARCHIVE_BYTES || 2 * 1024 ** 3);
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Content-Type': 'application/json' };
const response = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event?.requestContext?.http?.method === 'OPTIONS') return response(204, null);
  const transferId = event?.pathParameters?.id;
  if (!transferId || !/^[0-9a-f-]{36}$/i.test(transferId)) return response(400, { success: false, error: { code: 'INVALID_TRANSFER_ID', message: 'Invalid transfer ID.' } });

  try {
    const item = (await ddb.send(new GetCommand({ TableName: TABLE, Key: { transferId } }))).Item;
    if (!item) return response(404, { success: false, error: { code: 'TRANSFER_NOT_FOUND', message: 'Transfer not found.' } });
    if (item.expiresAt && Date.parse(item.expiresAt) <= Date.now()) return response(410, { success: false, error: { code: 'TRANSFER_EXPIRED', message: 'Transfer expired.' } });
    if (!item.isBatch) return response(409, { success: false, error: { code: 'INVALID_TRANSFER_TYPE', message: 'This is not a batch transfer.' } });
    if (item.status === 'ready' && item.zipKey) return response(200, { success: true, data: { transferId, status: 'ready' } });

    const prefix = `uploads/${transferId}/`;
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
    const objects = (listed.Contents || []).filter(object => object.Key && object.Size > 0);
    if (!objects.length) return response(409, { success: false, error: { code: 'UPLOADS_NOT_FOUND', message: 'No uploaded files were found.' } });
    if (objects.some(object => object.Size > MAX_ARCHIVE_BYTES)) return response(413, { success: false, error: { code: 'FILE_TOO_LARGE', message: 'Archive exceeds the configured size limit.' } });

    const chunks = [];
    const archive = archiver('zip', { zlib: { level: 6 } });
    const archiveError = new Promise((_, reject) => archive.once('error', reject));
    archive.on('data', chunk => chunks.push(chunk));

    for (const object of objects) {
      const key = object.Key;
      const fileName = key.slice(prefix.length).replace(/[\\/]/g, '_').slice(0, 255) || 'file';
      const responseObject = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      archive.append(responseObject.Body, { name: fileName });
    }
    await archive.finalize();
    await Promise.race([archiveError, new Promise(resolve => archive.once('end', resolve))]);

    const zipBuffer = Buffer.concat(chunks);
    if (zipBuffer.length > MAX_ARCHIVE_BYTES) return response(413, { success: false, error: { code: 'ARCHIVE_TOO_LARGE', message: 'Generated archive exceeds the configured size limit.' } });
    const zipKey = `zips/${transferId}.zip`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: zipKey, Body: zipBuffer, ContentType: 'application/zip' }));

    await ddb.send(new UpdateCommand({ TableName: TABLE, Key: { transferId }, UpdateExpression: 'SET #status = :ready, zipKey = :zipKey, totalSize = :totalSize, completedAt = :completedAt', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':ready': 'ready', ':zipKey': zipKey, ':totalSize': zipBuffer.length, ':completedAt': new Date().toISOString() }, ConditionExpression: '#status = :pending' }));
    return response(200, { success: true, data: { transferId, status: 'ready' } });
  } catch (error) {
    console.error('batch-complete failed', { name: error.name });
    if (error.name === 'ConditionalCheckFailedException') return response(200, { success: true, data: { transferId, status: 'ready' } });
    return response(500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Unable to finalize transfer.' } });
  }
};