const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({});

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { to, link, fileName } = body;

    const params = {
      Source: 'ibad84671@gmail.com', // CHANGE to a verified email in SES
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: `📎 ${fileName} shared via CloudDrop` },
        Body: {
          Text: { Data: `Download your file: ${link}` },
          Html: { Data: `<p>Your file <strong>${fileName}</strong> is ready to download.</p><p><a href="${link}">Download Now</a></p><p>This link expires in 7 days.</p>` }
        }
      }
    };

    await ses.send(new SendEmailCommand(params));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
      },
      body: JSON.stringify({ message: 'Email sent successfully' })
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