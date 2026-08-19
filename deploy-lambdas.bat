@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo 🚀 DEPLOYING BATCH LAMBDAS
echo ==========================================

cd /d C:\CloudDrop

echo.
echo 📝 Writing correct BatchCreate code...
(
echo const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
echo const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
echo const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
echo const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
echo const crypto = require('crypto');
echo const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
echo const s3 = new S3Client({});
echo const TABLE = process.env.TABLE_NAME;
echo const BUCKET = process.env.UPLOADS_BUCKET;
echo exports.handler = async (event) => {
echo   try {
echo     const body = JSON.parse(event.body);
echo     const files = body.files || [];
echo     if (!files.length) return { statusCode: 400, body: JSON.stringify({ error: 'No files' }) };
echo     const transferId = crypto.randomUUID();
echo     const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
echo     const ttl = Math.floor(expiresAt.getTime() / 1000);
echo     const ownerId = event.requestContext?.authorizer?.claims?.sub || 'guest';
echo     const fileItems = files.map(f => ({
echo       fileName: f.fileName,
echo       fileSize: f.fileSize,
echo       contentType: f.contentType,
echo       objectKey: `uploads/${transferId}/${f.fileName}`
echo     }));
echo     await ddbDoc.send(new PutCommand({
echo       TableName: TABLE,
echo       Item: {
echo         transferId, ownerId, status: 'pending',
echo         createdAt: new Date().toISOString(), expiresAt: expiresAt.toISOString(), ttl,
echo         files: fileItems, isBatch: true, downloadCount: 0
echo       }
echo     }));
echo     const presignedUrls = await Promise.all(fileItems.map(async (item) => {
echo       const command = new PutObjectCommand({ Bucket: BUCKET, Key: item.objectKey, ContentType: item.contentType });
echo       const url = await getSignedUrl(s3, command, { expiresIn: 900 });
echo       return { fileName: item.fileName, uploadUrl: url };
echo     }));
echo     return {
echo       statusCode: 200,
echo       headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token' },
echo       body: JSON.stringify({ transferId, uploads: presignedUrls })
echo     };
echo   } catch (error) {
echo     console.error(error);
echo     return {
echo       statusCode: 500,
echo       headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token' },
echo       body: JSON.stringify({ error: error.message })
echo     };
echo   }
echo };
) > backend\functions\batch-create\index.js

echo.
echo 📝 Writing correct BatchComplete code...
(
echo const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
echo const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
echo const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
echo const archiver = require('archiver');
echo exports.handler = async (event) => {
echo   try {
echo     const s3 = new S3Client({});
echo     const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
echo     const BUCKET = process.env.UPLOADS_BUCKET;
echo     const TABLE = process.env.TABLE_NAME;
echo     const transferId = event.pathParameters.id;
echo     const prefix = `uploads/${transferId}/`;
echo     const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
echo     const objects = listed.Contents || [];
echo     if (objects.length === 0) {
echo       return { statusCode: 400, body: JSON.stringify({ error: 'No files found' }) };
echo     }
echo     const archive = archiver('zip', { zlib: { level: 9 } });
echo     const chunks = [];
echo     archive.on('data', (chunk) => chunks.push(chunk));
echo     archive.on('error', (err) => { throw err; });
echo     for (const obj of objects) {
echo       const key = obj.Key;
echo       const fileName = key.replace(prefix, '');
echo       const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
echo       archive.append(response.Body, { name: fileName });
echo     }
echo     await archive.finalize();
echo     const zipBuffer = Buffer.concat(chunks);
echo     const totalSize = zipBuffer.length;
echo     const zipKey = `zips/${transferId}.zip`;
echo     await s3.send(new PutObjectCommand({
echo       Bucket: BUCKET,
echo       Key: zipKey,
echo       Body: zipBuffer,
echo       ContentType: 'application/zip'
echo     }));
echo     await ddbDoc.send(new UpdateCommand({
echo       TableName: TABLE,
echo       Key: { transferId },
echo       UpdateExpression: 'SET #status = :ready, zipKey = :zipKey, totalSize = :totalSize',
echo       ExpressionAttributeNames: { '#status': 'status' },
echo       ExpressionAttributeValues: {
echo         ':ready': 'ready',
echo         ':zipKey': zipKey,
echo         ':totalSize': totalSize
echo       }
echo     }));
echo     return {
echo       statusCode: 200,
echo       headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token' },
echo       body: JSON.stringify({ message: 'Zip created successfully' })
echo     };
echo   } catch (error) {
echo     console.error(error);
echo     return {
echo       statusCode: 500,
echo       headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token' },
echo       body: JSON.stringify({ error: error.message })
echo     };
echo   }
echo };
) > backend\functions\batch-complete\index.js

echo.
echo 🔍 Getting function names...
for /f "delims=" %%a in ('aws cloudformation list-stack-resources --stack-name clouddrop-dev --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function' && contains(PhysicalResourceId,'BatchCreate')].PhysicalResourceId" --output text') do set "CREATE_FUNC=%%a"
for /f "delims=" %%b in ('aws cloudformation list-stack-resources --stack-name clouddrop-dev --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function' && contains(PhysicalResourceId,'BatchComplete')].PhysicalResourceId" --output text') do set "COMPLETE_FUNC=%%b"

echo BatchCreate: %CREATE_FUNC%
echo BatchComplete: %COMPLETE_FUNC%

echo.
echo 📦 Installing dependencies in BatchCreate...
cd backend\functions\batch-create
if exist package.json (npm install) else (echo {} > package.json && npm install archiver)
powershell Compress-Archive -Path .\* -DestinationPath .\function.zip -Force
aws lambda update-function-code --function-name %CREATE_FUNC% --zip-file fileb://function.zip
cd ..\..

echo.
echo 📦 Installing dependencies in BatchComplete...
cd backend\functions\batch-complete
if exist package.json (npm install) else (echo {} > package.json && npm install archiver)
powershell Compress-Archive -Path .\* -DestinationPath .\function.zip -Force
aws lambda update-function-code --function-name %COMPLETE_FUNC% --zip-file fileb://function.zip
cd ..\..

echo.
echo ✅ Lambda functions updated! Wait 2 minutes.
echo 🌐 Open: https://d1u5o1m6ezamg5.cloudfront.net
pause