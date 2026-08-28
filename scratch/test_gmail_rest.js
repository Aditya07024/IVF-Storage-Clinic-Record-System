const dotenv = require('dotenv');
dotenv.config({ path: './apps/backend/.env' });

const clientId = (process.env.GMAIL_CLIENT_ID || '').replace(/"/g, '').trim();
const clientSecret = (process.env.GMAIL_CLIENT_SECRET || '').replace(/"/g, '').trim();
const refreshToken = (process.env.GMAIL_REFRESH_TOKEN || '').replace(/"/g, '').trim();

async function testGmailRest() {
  // 1. Get Access Token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenRes.json();
  console.log('Token response:', tokenData);
  if (!tokenRes.ok || !tokenData.access_token) {
    return console.error('Failed to refresh access token:', tokenData);
  }

  const accessToken = tokenData.access_token;

  // 2. Construct MIME Message
  const mimeMessage = [
    `From: SRGH IVF Cryo Bank <srghivfcryo@gmail.com>`,
    `To: adityakumar07024@gmail.com`,
    `Subject: IVF Report via Official Gmail REST API`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    `Hello! This email was sent via Google Cloud Console Gmail REST API (Port 443 HTTPS).`,
  ].join('\n');

  const encodedMessage = Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // 3. Send Message via Gmail REST API (Port 443 HTTPS)
  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  const sendData = await sendRes.json();
  console.log('Send response status:', sendRes.status, sendData);
}

testGmailRest();
