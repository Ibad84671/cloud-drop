const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'};
const out = (status, body) => ({statusCode:status,headers:{...cors,'Content-Type':'application/json'},body:JSON.stringify(body)});
exports.handler = async event => {
  try {
    if (event.httpMethod === 'OPTIONS') return out(204, '');
    const transferId = event.pathParameters?.id;
    const ownerId = event.requestContext?.authorizer?.claims?.sub;
    if (!transferId || !ownerId) return out(401,{error:'Unauthorized'});
    const result = await ddb.send(new GetCommand({TableName:process.env.TABLE_NAME,Key:{transferId}}));
    const item = result.Item;
    if (!item) return out(404,{error:'Transfer not found'});
    if (item.ownerId !== ownerId) return out(403,{error:'Forbidden'});
    await ddb.send(new DeleteCommand({TableName:process.env.TABLE_NAME,Key:{transferId}}));
    const keys = [item.objectKey,item.zipKey].filter(Boolean);
    await Promise.all(keys.map(Key => s3.send(new DeleteObjectCommand({Bucket:process.env.UPLOADS_BUCKET,Key}))));
    return out(200,{message:'Transfer deleted'});
  } catch (error) { console.error('delete-transfer',error); return out(500,{error:'Internal server error'}); }
};
