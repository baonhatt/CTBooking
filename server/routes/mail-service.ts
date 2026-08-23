<<<<<<< HEAD
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
=======
/**
 * Universal Mail Service
 * Priority: 
 * 1. Brevo (if BREVO_API_KEY is present) - Used for Live/Preview
 * 2. Resend (if RESEND_API_KEY is present) - Used for Localhost
 */

export async function sendMail(
  toEmail: string,
  subject: string,
  html: string,
  env?: any
) {
  // Get keys from environment (Worker env or process.env)
  const brevoKey = String(env?.BREVO_API_KEY || process.env.BREVO_API_KEY || '');
  const resendKey = String(env?.RESEND_API_KEY || process.env.RESEND_API_KEY || '');

  const senderEmail = String(
    env?.BREVO_SENDER_EMAIL || 
    process.env.BREVO_SENDER_EMAIL || 
    env?.GMAIL_SENDER_EMAIL || 
    process.env.GMAIL_SENDER_EMAIL || 
    'no-reply@cinesphere.com.vn'
  );
  
  const senderName = String(
    env?.BREVO_SENDER_NAME || 
    process.env.BREVO_SENDER_NAME || 
    env?.GMAIL_SENDER_NAME || 
    process.env.GMAIL_SENDER_NAME || 
    'CINESPHERE'
  );

  // 1. Brevo (Priority for Live/Preview)
  if (brevoKey) {
    const payload = {
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail }],
      subject,
      htmlContent: html
    };
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': brevoKey },
      body: JSON.stringify(payload)
    });
    const bodyText = await res.text().catch(() => '');
    if (!res.ok) throw new Error(`Brevo failed: ${res.status} ${bodyText}`);
    return { ok: true, provider: 'brevo', status: res.status };
  }

  // 2. Resend (Priority for Localhost)
  if (resendKey) {
    const from = `${senderName} <${senderEmail}>`;
    const payload = { from, to: [toEmail], subject, html };
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`
      },
      body: JSON.stringify(payload)
    });
    const bodyText = await res.text().catch(() => '');
    if (!res.ok) throw new Error(`Resend failed: ${res.status} ${bodyText}`);
    return { ok: true, provider: 'resend', status: res.status };
  }

  throw new Error('No mail provider (Brevo/Resend) configured in environment');
>>>>>>> preview
}
