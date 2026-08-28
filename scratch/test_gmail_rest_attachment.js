const dotenv = require('dotenv');
dotenv.config({ path: './apps/backend/.env' });

const clientId = (process.env.GMAIL_CLIENT_ID || '').replace(/"/g, '').trim();
const clientSecret = (process.env.GMAIL_CLIENT_SECRET || '').replace(/"/g, '').trim();
const refreshToken = (process.env.GMAIL_REFRESH_TOKEN || '').replace(/"/g, '').trim();

async function sendGmailRestAttachment() {
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
  if (!tokenRes.ok || !tokenData.access_token) {
    return console.error('Token refresh failed:', tokenData);
  }

  const accessToken = tokenData.access_token;
  const boundary = `====_Boundary_${Date.now()}_====`;

  const dummyPdf = Buffer.from('%PDF-1.4 Fake PDF Content for Testing');

  const mimeParts = [
    `From: SRGH IVF Cryo Bank <srghivfcryo@gmail.com>`,
    `To: adityakumar07024@gmail.com`,
    `Subject: IVF Storage Report (Gmail REST API)`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    `<h2>SRGH IVF Cryo Bank</h2><p>Attached is your official IVF Cryo Storage Summary Report.</p>`,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="IVF_Patient_Cryo_Report.pdf"`,
    `Content-Disposition: attachment; filename="IVF_Patient_Cryo_Report.pdf"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    dummyPdf.toString('base64'),
    ``,
    `--${boundary}--`,
  ].join('\r\n');

  const rawEncoded = Buffer.from(mimeParts)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawEncoded }),
  });

  const sendData = await sendRes.json();
  console.log('Attachment email status:', sendRes.status, sendData);
}

sendGmailRestAttachment();
