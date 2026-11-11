import { getEmailBrand } from '../lib/email-layout';

/**
 * Mail Service specifically designed for Brevo REST API
 */

/** Words and entities turned back into plain characters when an HTML mail is converted to text. */
const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&bull;': '•',
  '&zwnj;': ''
};

/**
 * Makes the plain-text twin of an HTML mail. Mail apps and spam filters like a mail that has both,
 * and it stays readable where HTML is not shown (watches, text-only clients).
 */
export function htmlToPlainText(html: string): string {
  const withoutHidden = html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<div style="display:none[\s\S]*?<\/div>/gi, '');

  const withLinks = withoutHidden.replace(
    /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return href && href !== '#' && text !== href ? `${text} (${href})` : text;
    }
  );

  return withLinks
    .replace(/<\/(tr|p|div|h[1-6]|li|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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

  // Replies go to the support mailbox, since the sender address is a no-reply one
  const replyToEmail = String(env?.BREVO_REPLY_TO_EMAIL || process.env.BREVO_REPLY_TO_EMAIL || getEmailBrand().supportEmail);

  const payload = {
    sender: { email: senderEmail, name: senderName },
    replyTo: { email: replyToEmail, name: senderName },
    to: [{ email: toEmail }],
    subject,
    htmlContent: html,
    textContent: htmlToPlainText(html)
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
