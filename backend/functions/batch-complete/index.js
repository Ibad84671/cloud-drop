const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const archiver = require('archiver');

exports.handler = async (event) => {
  try {
    const s3 = new S3Client({});
    const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const BUCKET = process.env.UPLOADS_BUCKET;
    const TABLE = process.env.TABLE_NAME;

    const transferId = event.pathParameters.id;
    const prefix = `uploads/${transferId}/`;

    const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
    const objects = listed.Contents || [];
    if (objects.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No files found' }) };
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('error', (err) => { throw err; });

    for (const obj of objects) {
      const key = obj.Key;
      const fileName = key.replace(prefix, '');
      const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      archive.append(response.Body, { name: fileName });
    }

    await archive.finalize();
    const zipBuffer = Buffer.concat(chunks);
    const totalSize = zipBuffer.length;

    const zipKey = `zips/${transferId}.zip`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: zipKey,
      Body: zipBuffer,
      ContentType: 'application/zip'
    }));

    await ddbDoc.send(new UpdateCommand({
      TableName: TABLE,
      Key: { transferId },
      UpdateExpression: 'SET #status = :ready, zipKey = :zipKey, totalSize = :totalSize',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':ready': 'ready',
        ':zipKey': zipKey,
        ':totalSize': totalSize
      }
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
      },
      body: JSON.stringify({ message: 'Zip created successfully' })
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};