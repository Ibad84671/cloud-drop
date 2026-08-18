const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  try {
    const transferId = event.pathParameters.id;

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { transferId },
      UpdateExpression: 'SET #status = :ready',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':ready': 'ready' }
    }));

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Upload completed successfully' })
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