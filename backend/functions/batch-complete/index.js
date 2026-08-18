const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const archiver = require('archiver');
const { PassThrough } = require('stream');

const s3 = new S3Client({});
const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BUCKET = process.env.UPLOADS_BUCKET;
const TABLE = process.env.TABLE_NAME;

exports.handler = async (event) => {
  try {
    const transferId = event.pathParameters.id;
    const prefix = `uploads/${transferId}/`;

    const listParams = { Bucket: BUCKET, Prefix: prefix };
    const listed = await s3.send(new ListObjectsV2Command(listParams));
    const objects = listed.Contents || [];
    if (objects.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No files found' }) };
    }

    const zipStream = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(zipStream);

    let totalSize = 0;
    for (const obj of objects) {
      const key = obj.Key;
      const fileName = key.replace(prefix, '');
      const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
      const response = await s3.send(getCmd);
      archive.append(response.Body, { name: fileName });
      totalSize += obj.Size || 0;
    }
    await archive.finalize();

    const zipKey = `zips/${transferId}.zip`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: zipKey,
      Body: zipStream,
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
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Zip created successfully' })
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