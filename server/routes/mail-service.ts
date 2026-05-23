import 'dotenv/config';
import nodemailer from 'nodemailer';

const GMAIL_HOST = 'sandbox.smtp.mailtrap.io';
const GMAIL_PORT = 587;
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_PASS = process.env.GMAIL_PASS || '';
const GMAIL_SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || GMAIL_USER || 'no-reply@example.com';
const GMAIL_SENDER_NAME = process.env.GMAIL_SENDER_NAME || 'CTBOOKING';

const transporter =
  GMAIL_USER && GMAIL_PASS
    ? nodemailer.createTransport({
        host: GMAIL_HOST,
        port: GMAIL_PORT,
        secure: false,
        auth: { user: GMAIL_USER, pass: GMAIL_PASS }
      })
    : null;

export async function sendMail(toEmail: string, subject: string, html: string) {
  if (!transporter) {
    throw new Error('Mail provider is not configured');
  }
  const info = await transporter.sendMail({
    from: `${GMAIL_SENDER_NAME} <${GMAIL_SENDER_EMAIL}>`,
    to: toEmail,
    subject,
    html
  });
  return info;
}

export function getMailConfig() {
  return {
    provider: 'gmail',
    host: GMAIL_HOST,
    port: GMAIL_PORT,
    has_user: Boolean(GMAIL_USER),
    has_pass: Boolean(GMAIL_PASS),
    sender_email: GMAIL_SENDER_EMAIL,
    sender_name: GMAIL_SENDER_NAME,
    configured: Boolean(transporter)
  };
}

export async function verifyMailProvider() {
  if (!transporter) {
    return { ok: false, message: 'Mail provider is not configured' };
  }
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || String(err) };
  }
}
