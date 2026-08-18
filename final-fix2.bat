@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo 🚀 CLOUDDROP FINAL FIX 2
echo ==========================================

cd /d C:\CloudDrop

echo.
echo 🔍 Getting new API Gateway URL...
for /f "delims=" %%i in ('aws cloudformation describe-stacks --stack-name clouddrop-dev --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayURL'].OutputValue" --output text') do set "API_URL=%%i"
echo API URL: !API_URL!

set "API_ID=!API_URL:~8!"
for /f "delims=." %%a in ("!API_ID!") do set "API_ID=%%a"
echo API ID: !API_ID!

echo.
echo 📝 Updating frontend files with new API URL...
powershell -Command "(Get-Content frontend\index.html) -replace 'const API_BASE = .*;', 'const API_BASE = ''!API_URL!'';' | Set-Content frontend\index.html"
powershell -Command "(Get-Content frontend\dashboard.html) -replace 'const API_BASE = .*;', 'const API_BASE = ''!API_URL!'';' | Set-Content frontend\dashboard.html"
powershell -Command "(Get-Content frontend\t.html) -replace 'const API_BASE = .*;', 'const API_BASE = ''!API_URL!'';' | Set-Content frontend\t.html"

echo.
echo 📝 Writing correct Lambda code using PowerShell...

powershell -Command @"
$code = @'
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const TABLE = process.env.TABLE_NAME;
const BUCKET = process.env.UPLOADS_BUCKET;
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const files = body.files || [];
    if (!files.length) return { statusCode: 400, body: JSON.stringify({ error: 'No files' }) };
    const transferId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const ttl = Math.floor(expiresAt.getTime() / 1000);
    const ownerId = event.requestContext?.authorizer?.claims?.sub || 'guest';
    const fileItems = files.map(f => ({
      fileName: f.fileName,
      fileSize: f.fileSize,
      contentType: f.contentType,
      objectKey: `uploads/${transferId}/${f.fileName}`
    }));
    await ddbDoc.send(new PutCommand({
      TableName: TABLE,
      Item: {
        transferId, ownerId, status: 'pending',
        createdAt: new Date().toISOString(), expiresAt: expiresAt.toISOString(), ttl,
        files: fileItems, isBatch: true, downloadCount: 0
      }
    }));
    const presignedUrls = await Promise.all(fileItems.map(async (item) => {
      const command = new PutObjectCommand({ Bucket: BUCKET, Key: item.objectKey, ContentType: item.contentType });
      const url = await getSignedUrl(s3, command, { expiresIn: 900 });
      return { fileName: item.fileName, uploadUrl: url };
    }));
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token' },
      body: JSON.stringify({ transferId, uploads: presignedUrls })
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
'@
$code | Out-File -Encoding utf8 backend\functions\batch-create\index.js
"@

powershell -Command @"
$code = @'
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
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token' },
      body: JSON.stringify({ message: 'Zip created successfully' })
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
'@
$code | Out-File -Encoding utf8 backend\functions\batch-complete\index.js
"@

echo.
echo 📦 Packaging and deploying BatchCreate...
cd backend\functions\batch-create
if not exist package.json (echo {} > package.json)
npm install archiver --save
powershell Compress-Archive -Path .\* -DestinationPath .\function.zip -Force
for /f "delims=" %%a in ('aws cloudformation list-stack-resources --stack-name clouddrop-dev --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function' && contains(PhysicalResourceId,'BatchCreate')].PhysicalResourceId" --output text') do set "CREATE_FUNC=%%a"
aws lambda update-function-code --function-name !CREATE_FUNC! --zip-file fileb://function.zip
cd ..\..

echo.
echo 📦 Packaging and deploying BatchComplete...
cd backend\functions\batch-complete
if not exist package.json (echo {} > package.json)
npm install archiver --save
powershell Compress-Archive -Path .\* -DestinationPath .\function.zip -Force
for /f "delims=" %%b in ('aws cloudformation list-stack-resources --stack-name clouddrop-dev --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function' && contains(PhysicalResourceId,'BatchComplete')].PhysicalResourceId" --output text') do set "COMPLETE_FUNC=%%b"
aws lambda update-function-code --function-name !COMPLETE_FUNC! --zip-file fileb://function.zip
cd ..\..

echo.
echo 🔧 Adding S3 CORS...
powershell -Command "$cors='{\"CORSRules\":[{\"AllowedOrigins\":[\"*\"],\"AllowedMethods\":[\"PUT\",\"GET\",\"HEAD\"],\"AllowedHeaders\":[\"*\"],\"ExposeHeaders\":[\"ETag\"],\"MaxAgeSeconds\":3000}]}'; $cors | Out-File -Encoding utf8 cors.json"
aws s3api put-bucket-cors --bucket clouddrop-uploads-dev-502263855269 --cors-configuration file://cors.json

echo.
echo 🔧 Adding API Gateway CORS for all endpoints...
for /f "delims=" %%r in ('aws apigateway get-resources --rest-api-id !API_ID! --query "items[?path=='/batch'].id" --output text') do set "BATCH_RES=%%r"
for /f "delims=" %%r in ('aws apigateway get-resources --rest-api-id !API_ID! --query "items[?path=='/transfer'].id" --output text') do set "TRANSFER_RES=%%r"
for /f "delims=" %%r in ('aws apigateway get-resources --rest-api-id !API_ID! --query "items[?path=='/transfer/{id}'].id" --output text') do set "TRANSFER_ID_RES=%%r"
for /f "delims=" %%r in ('aws apigateway get-resources --rest-api-id !API_ID! --query "items[?path=='/transfer/{id}/complete'].id" --output text') do set "COMPLETE_RES=%%r"

call :add_cors !BATCH_RES! "POST,OPTIONS"
call :add_cors !TRANSFER_RES! "POST,OPTIONS"
call :add_cors !TRANSFER_ID_RES! "GET,DELETE,OPTIONS"
call :add_cors !COMPLETE_RES! "POST,OPTIONS"

aws apigateway create-deployment --rest-api-id !API_ID! --stage-name prod

echo.
echo 📁 Syncing frontend...
aws s3 sync frontend/ s3://clouddrop-frontend-dev-502263855269 --delete

echo.
echo 📡 Invalidating CloudFront...
aws cloudfront create-invalidation --distribution-id E36VRQE8KQEE3F --paths "/*"

echo.
echo ==========================================
echo ✅ ALL DONE! Wait 2 minutes.
echo 🌐 Open: https://d1u5o1m6ezamg5.cloudfront.net
echo ==========================================
pause
exit /b

:add_cors
set "RES_ID=%1"
set "METHODS=%2"
aws apigateway put-method --rest-api-id !API_ID! --resource-id %RES_ID% --http-method OPTIONS --authorization-type NONE
aws apigateway put-integration --rest-api-id !API_ID! --resource-id %RES_ID% --http-method OPTIONS --type MOCK --request-templates "{\"application/json\":\"{\\\"statusCode\\\":200}\"}"
aws apigateway put-method-response --rest-api-id !API_ID! --resource-id %RES_ID% --http-method OPTIONS --status-code 200 --response-parameters "{\"method.response.header.Access-Control-Allow-Origin\":true,\"method.response.header.Access-Control-Allow-Methods\":true,\"method.response.header.Access-Control-Allow-Headers\":true}"
aws apigateway put-integration-response --rest-api-id !API_ID! --resource-id %RES_ID% --http-method OPTIONS --status-code 200 --response-parameters "{\"method.response.header.Access-Control-Allow-Origin\":\"'*'\",\"method.response.header.Access-Control-Allow-Methods\":\"'%METHODS%'\",\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\"}"
exit /b