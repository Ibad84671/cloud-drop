const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'};
const out = (status, body) => ({statusCode:status,headers:{...cors,'Content-Type':'application/json'},body:JSON.stringify(body)});
exports.handler = async event => {
  try {
    if (event.httpMethod === 'OPTIONS') return out(204, '');
    const ownerId = event.requestContext?.authorizer?.claims?.sub;
    if (!ownerId) return out(401, {error:'Unauthorized'});
    const result = await ddb.send(new QueryCommand({TableName:process.env.TABLE_NAME,IndexName:'OwnerIndex',KeyConditionExpression:'ownerId=:ownerId',ExpressionAttributeValues:{':ownerId':ownerId},Limit:50,ScanIndexForward:false}));
    return out(200, {items:result.Items || [], nextKey:result.LastEvaluatedKey || null});
  } catch (error) { console.error('list-transfers',error); return out(500,{error:'Internal server error'}); }
};
