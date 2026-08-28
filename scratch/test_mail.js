const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config({ path: './apps/backend/.env' });

const user = (process.env.SMTP_USER || 'srghivfcryo@gmail.com').trim();
const pass = (process.env.SMTP_PASS || '').trim();

console.log('Testing user:', user);
console.log('Testing pass length:', pass.length, 'raw pass:', JSON.stringify(pass));

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user, pass },
  debug: true,
  logger: true,
});

transporter.sendMail({
  from: `"SRGH IVF Cryo Bank" <${user}>`,
  to: 'adityakumar07024@gmail.com',
  subject: 'IVF System Test Email',
  text: 'Hello! This is a test email from SRGH IVF Cryo Bank.',
}, (err, info) => {
  if (err) {
    console.error('=== SMTP ERROR DETAILS ===', err);
  } else {
    console.log('=== SUCCESS! === Message ID:', info.messageId);
  }
});
