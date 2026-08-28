const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config({ path: './apps/backend/.env' });

const user = (process.env.SMTP_USER || 'srghivfcryo@gmail.com').trim();
const clientId = (process.env.GMAIL_CLIENT_ID || '').replace(/"/g, '').trim();
const clientSecret = (process.env.GMAIL_CLIENT_SECRET || '').replace(/"/g, '').trim();
const refreshToken = (process.env.GMAIL_REFRESH_TOKEN || '').replace(/"/g, '').trim();

console.log('Testing Gmail OAuth2 for user:', user);
console.log('Client ID:', clientId);
console.log('Client Secret length:', clientSecret.length);
console.log('Refresh Token length:', refreshToken.length);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: user,
    clientId: clientId,
    clientSecret: clientSecret,
    refreshToken: refreshToken,
  },
  debug: true,
  logger: true,
});

transporter.sendMail({
  from: `"SRGH IVF Cryo Bank" <${user}>`,
  to: 'adityakumar07024@gmail.com',
  subject: 'IVF System Test Email via Gmail OAuth2 API',
  text: 'Hello! This is an official test email using Google Cloud Console OAuth2 API.',
}, (err, info) => {
  if (err) {
    console.error('=== OAUTH2 ERROR ===', err);
  } else {
    console.log('=== OAUTH2 SUCCESS! === Message ID:', info.messageId);
  }
});
