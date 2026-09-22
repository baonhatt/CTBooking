/**
 * Mail Service specifically designed for Brevo REST API
 */
export async function sendMail(toEmail: string, subject: string, html: string, env?: any) {
  const brevoKey = String(env?.BREVO_API_KEY || process.env.BREVO_API_KEY || '');
  
  if (!brevoKey) {
    throw new Error('BREVO_API_KEY không được cấu hình trong môi trường.');
  }

  const senderEmail = String(
    env?.BREVO_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL || 'no-reply@cinesphere.com.vn'
  );

  const senderName = String(
    env?.BREVO_SENDER_NAME || process.env.BREVO_SENDER_NAME || 'CINESPHERE'
  );

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
  if (!res.ok) {
    throw new Error(`Gửi email qua Brevo thất bại: ${res.status} ${bodyText}`);
  }

  return { ok: true, provider: 'brevo', status: res.status };
}
