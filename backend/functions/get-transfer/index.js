const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET = process.env.UPLOADS_BUCKET;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try {
    console.log('GET TRANSFER EVENT:', JSON.stringify(event));

    const transferId = event?.pathParameters?.id;

    if (!transferId) {
      return response(400, {
        error: 'Missing transfer ID'
      });
    }

    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          transferId
        }
      })
    );

    const item = result.Item;

    if (!item) {
      return response(404, {
        error: 'Transfer not found',
        transferId
      });
    }

    if (item.status !== 'ready') {
      return response(400, {
        error: 'Upload not complete yet',
        status: item.status
      });
    }

    if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
      return response(410, {
        error: 'Transfer expired'
      });
    }

    let downloadUrl;
    let fileCount = 1;
    let totalSize = item.totalSize || 0;
    let zipFileName = 'archive.zip';

    /*
     * Batch transfer
     */
    if (item.isBatch && item.zipKey) {
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: item.zipKey,
        ResponseContentDisposition:
          `attachment; filename="${item.zipKey.split('/').pop()}"`
      });

      downloadUrl = await getSignedUrl(
        s3Client,
        command,
        { expiresIn: 300 }
      );

      fileCount = (item.files || []).length;
      zipFileName = item.zipKey.split('/').pop();
    }

    /*
     * Single-file transfer
     */
    else {
      if (!item.objectKey) {
        return response(500, {
          error: 'Transfer metadata is missing objectKey'
        });
      }

      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: item.objectKey,
        ResponseContentDisposition:
          `attachment; filename="${item.originalFileName || 'download'}"`
      });

      downloadUrl = await getSignedUrl(
        s3Client,
        command,
        { expiresIn: 300 }
      );

      totalSize = item.fileSize || 0;
      zipFileName = item.originalFileName || 'download';
    }

    /*
     * Increment download counter.
     * Do not block the actual download if this fails.
     */
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { transferId },
        UpdateExpression: 'ADD downloadCount :inc',
        ExpressionAttributeValues: {
          ':inc': 1
        }
      })
    ).catch((err) => {
      console.error('Download counter update failed:', err);
    });

    return response(200, {
      downloadUrl,
      fileName: zipFileName,
      fileSize: totalSize,
      fileCount,
      totalSize,
      zipFileName
    });

  } catch (error) {
    console.error('GET TRANSFER ERROR:', error);

    return response(500, {
      error: 'Internal server error',
      message: error.message
    });
  }
};