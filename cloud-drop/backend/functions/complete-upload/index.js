const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { DYNAMODB_TABLE } = require('../../shared/constants');

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

exports.handler = async (event) => {
  try {
    const transferId = event.pathParameters.id;
    await docClient.send(new UpdateCommand({
      TableName: DYNAMODB_TABLE,
      Key: { transferId },
      UpdateExpression: 'SET #status = :ready',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':ready': 'ready' }
    }));
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Upload completed' })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to complete' })
    };
  }
};
