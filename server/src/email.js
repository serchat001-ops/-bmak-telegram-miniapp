const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@bmak.finance';
  if (!t) {
    console.warn('[Email] SMTP not configured. Would send to', to, 'subject:', subject);
    return { skipped: true };
  }
  const info = await t.sendMail({ from: `B_MAK <${from}>`, to, subject, html, text });
  console.log('[Email] Sent to', to, 'id:', info.messageId);
  return { sent: true, id: info.messageId };
}

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

module.exports = { sendMail, isConfigured };
