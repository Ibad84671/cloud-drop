const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({});
const SOURCE = process.env.SES_SOURCE_EMAIL;
const MAX_NAME_LENGTH = 180;
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Content-Type': 'application/json' };
const response = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

exports.handler = async event => {
  if (event?.requestContext?.http?.method === 'OPTIONS') return response(204, null);
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    const to = String(body.to || '').trim();
    const link = String(body.link || '').trim();
    const fileName = String(body.fileName || 'files').trim();
    if (!SOURCE || !emailPattern.test(to) || to.length > 254) return response(400, { success: false, error: { code: 'INVALID_EMAIL', message: 'Enter a valid recipient email.' } });
    if (!/^https:\/\//i.test(link) || link.length > 2048) return response(400, { success: false, error: { code: 'INVALID_LINK', message: 'Invalid transfer link.' } });
    if (!fileName || fileName.length > MAX_NAME_LENGTH) return response(400, { success: false, error: { code: 'INVALID_FILE_NAME', message: 'Invalid file name.' } });

    await ses.send(new SendEmailCommand({
      Source: SOURCE,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: `${fileName} shared via CloudDrop`, Charset: 'UTF-8' },
        Body: {
          Text: { Data: `A file transfer has been shared with you. Download it here: ${link}\n\nThis link expires with the transfer.`, Charset: 'UTF-8' },
          Html: { Data: `<p>A file transfer has been shared with you.</p><p><strong>${escapeHtml(fileName)}</strong></p><p><a href="${escapeHtml(link)}">Download files</a></p><p>This link expires with the transfer.</p>`, Charset: 'UTF-8' }
        }
      }
    }));
    return response(200, { success: true, data: { sent: true } });
  } catch (error) {
    console.error('send-email failed', { name: error.name });
    return response(500, { success: false, error: { code: 'EMAIL_SEND_FAILED', message: 'Unable to send the transfer email.' } });
  }
};