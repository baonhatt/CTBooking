// ============================================================
// CINESPHERE - Email layout kit
//
// In this file, in order:
//   1. ESCAPING          escapeHtml / escapeAttr (every outside value goes through these)
//   2. BRAND CONFIG      support email, hotline, address, site URL (set once per request from the worker env)
//   3. THEMES            colours for the customer mails and the staff mails
//   4. SHELL             renderEmailShell: the one page frame every mail uses (table layout, inline styles)
//   5. COMPONENTS        greeting, paragraph, code box, info table, callout, button, item table, price summary
//
// HOW TO ADD A MAIL: build the body with the components below and wrap it with renderEmailShell().
// Never write a new <html> page by hand, and never rely on <style> classes for anything that matters:
// Gmail app and Outlook strip or ignore them, so every important rule is written inline.
// ============================================================

// ---- ESCAPING ----

/** Makes a value safe to put in HTML text or in a quoted attribute. Missing values become an empty string. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A link for href="...": only https (or http on localhost for development). Anything else becomes "#". */
export function escapeAttr(url: unknown): string {
  const text = String(url ?? '').trim();
  const allowed = /^https:\/\//i.test(text) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(text);
  return allowed ? escapeHtml(text) : '#';
}

// ---- BRAND CONFIG ----

export interface EmailBrand {
  /** Shown in the footer and used as the Reply-To address */
  supportEmail: string;
  /** Empty means "not configured": the footer then leaves the hotline out instead of printing a placeholder */
  hotline: string;
  /** Empty means "not configured": the footer then leaves the address out */
  companyAddress: string;
  /** Public website, used for buttons such as "Xem vé của tôi" */
  clientBaseUrl: string;
}

const DEFAULT_SUPPORT_EMAIL = 'cinesphere0629@gmail.com';
const DEFAULT_CLIENT_BASE_URL = 'https://cinesphere.com.vn';

function read_process_env(key: string): string {
  if (typeof process === 'undefined' || !process.env) return '';
  return String(process.env[key] || '').trim();
}

/** Contact details taken from the default branch (Quản lý chi nhánh). Used when the env does not set them. */
export type BranchBrandFallback = Partial<Pick<EmailBrand, 'supportEmail' | 'hotline' | 'companyAddress'>>;

let branch_fallback: BranchBrandFallback = {};

/** Remembers the default branch's contact details for the next configureEmailBrand() call. */
export function setBranchBrandFallback(fallback: BranchBrandFallback): void {
  branch_fallback = { ...fallback };
}

/** Order of preference: env setting, then the default branch, then the built-in default. */
function read_brand(env?: any): EmailBrand {
  const pick = (key: string) => String(env?.[key] || '').trim() || read_process_env(key);
  return {
    supportEmail: pick('SUPPORT_EMAIL') || branch_fallback.supportEmail || DEFAULT_SUPPORT_EMAIL,
    hotline: pick('SUPPORT_HOTLINE') || branch_fallback.hotline || '',
    companyAddress: pick('COMPANY_ADDRESS') || branch_fallback.companyAddress || '',
    clientBaseUrl: (pick('VITE_CLIENT_BASE_URL') || DEFAULT_CLIENT_BASE_URL).replace(/\/+$/, '')
  };
}

let current_brand: EmailBrand = read_brand();

/**
 * Reads the brand settings from the worker env (c.env). Call it once per request, before a template is built.
 * On Cloudflare Workers the settings are not always in process.env, so the worker passes its env here.
 */
export function configureEmailBrand(env?: any): EmailBrand {
  current_brand = read_brand(env);
  return current_brand;
}

export function getEmailBrand(): EmailBrand {
  return current_brand;
}

// ---- THEMES ----

export type EmailTheme = 'customer' | 'staff';

interface ThemeColors {
  headerSolid: string;
  headerGradient: string;
  headerTitle: string;
  headerSubtitle: string;
  accent: string;
  accentDark: string;
  accentSoft: string;
  pageBackground: string;
}

const THEMES: Record<EmailTheme, ThemeColors> = {
  customer: {
    headerSolid: '#667eea',
    headerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    headerTitle: '#ffffff',
    headerSubtitle: '#e0e7ff',
    accent: '#667eea',
    accentDark: '#4338ca',
    accentSoft: '#eef2ff',
    pageBackground: '#f4f6fb'
  },
  staff: {
    headerSolid: '#1e293b',
    headerGradient: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
    headerTitle: '#ffffff',
    headerSubtitle: '#cbd5e1',
    accent: '#3b82f6',
    accentDark: '#1d4ed8',
    accentSoft: '#eff6ff',
    pageBackground: '#f1f5f9'
  }
};

const FONT_STACK = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO_STACK = "'Courier New', Consolas, monospace";

type CalloutTone = 'info' | 'warning' | 'danger' | 'neutral';

const CALLOUT_COLORS: Record<CalloutTone, { background: string; border: string; text: string }> = {
  info: { background: '#eff6ff', border: '#3b82f6', text: '#1e3a8a' },
  warning: { background: '#fffbeb', border: '#f59e0b', text: '#92400e' },
  danger: { background: '#fef2f2', border: '#ef4444', text: '#991b1b' },
  neutral: { background: '#f8fafc', border: '#cbd5e1', text: '#475569' }
};

export function getThemeColors(theme: EmailTheme): ThemeColors {
  return THEMES[theme];
}

// ---- SHELL ----

export interface EmailShellOptions {
  theme: EmailTheme;
  /** The <title> of the page and the small line under the brand name in the header */
  title: string;
  /** Hidden text that mail apps show next to the subject in the inbox list */
  preheader?: string;
  bodyHtml: string;
  /** The address line is useful on a receipt; short mails (codes, links) leave it out */
  showAddress?: boolean;
  /** A hotline for the branch the booking was made at; falls back to the company hotline */
  hotlineOverride?: string;
}

function render_preheader(text: string): string {
  if (!text) return '';
  // The extra &zwnj;&nbsp; run stops the mail app from pulling body text into the preview
  const padding = '&zwnj;&nbsp;'.repeat(40);
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(text)}${padding}</div>`;
}

function render_footer(theme: EmailTheme, options: EmailShellOptions): string {
  const brand = getEmailBrand();
  const lines: string[] = [];

  if (theme === 'staff') {
    lines.push(`<strong style="color:#475569;">CINESPHERE Admin Portal</strong> &bull; Hệ thống quản trị nội bộ`);
    lines.push(`Cần hỗ trợ? Liên hệ đội ngũ IT: ${escapeHtml(brand.supportEmail)}`);
    lines.push('Email tự động từ hệ thống quản trị.');
  } else {
    lines.push(`<strong style="color:#475569;">CINESPHERE</strong> &bull; Trải nghiệm điện ảnh vũ trụ`);
    if (options.showAddress && brand.companyAddress) {
      lines.push(`Trụ sở: ${escapeHtml(brand.companyAddress)}`);
    }
    const hotline = String(options.hotlineOverride || brand.hotline || '').trim();
    const contact = [`Email: ${escapeHtml(brand.supportEmail)}`];
    if (hotline) contact.push(`Hotline: ${escapeHtml(hotline)}`);
    lines.push(contact.join(' &nbsp;|&nbsp; '));
    lines.push('Đây là email tự động. Cần hỗ trợ, hãy trả lời email này hoặc liên hệ theo thông tin trên.');
  }

  const rows = lines.map((line) => `<div style="margin:0 0 6px;">${line}</div>`).join('');
  return `<td style="padding:22px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:#94a3b8;">${rows}</td>`;
}

/** The one page frame for every email. Table layout and inline styles, so it holds up in Gmail, Outlook and Apple Mail. */
export function renderEmailShell(options: EmailShellOptions): string {
  const colors = getThemeColors(options.theme);
  const brandName = options.theme === 'staff' ? 'CINESPHERE ADMIN' : 'CINESPHERE';

  return `<!DOCTYPE html>
<html lang="vi" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(options.title)} - CINESPHERE</title>
  <style>
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    @media only screen and (max-width: 620px) {
      .cs-pad { padding-left: 18px !important; padding-right: 18px !important; }
      .cs-code { font-size: 32px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${colors.pageBackground};">
  ${render_preheader(options.preheader || '')}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${colors.pageBackground};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td align="center" style="padding:30px 24px;background-color:${colors.headerSolid};background-image:${colors.headerGradient};font-family:${FONT_STACK};">
              <div style="font-size:26px;font-weight:800;letter-spacing:3px;color:${colors.headerTitle};line-height:1.2;">&#127916; ${brandName}</div>
              <div style="margin-top:8px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${colors.headerSubtitle};">${escapeHtml(options.title)}</div>
            </td>
          </tr>
          <tr>
            <td class="cs-pad" style="padding:32px 28px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:#334155;">
              ${options.bodyHtml}
            </td>
          </tr>
          <tr>
            ${render_footer(options.theme, options)}
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---- COMPONENTS ----

/** "Xin chào <name>," */
export function emailGreeting(name: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;color:#1e293b;">Xin chào <strong>${escapeHtml(name)}</strong>,</p>`;
}

/** A paragraph. The text is plain: it is escaped here. Use emailParagraphHtml when it holds markup you wrote yourself. */
export function emailParagraph(text: string): string {
  return emailParagraphHtml(escapeHtml(text));
}

export function emailParagraphHtml(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">${html}</p>`;
}

export function emailSectionTitle(text: string, theme: EmailTheme = 'customer'): string {
  const colors = getThemeColors(theme);
  return `<div style="margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid ${colors.accentSoft};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#475569;">${escapeHtml(text)}</div>`;
}

export interface CodeBoxOptions {
  label: string;
  value: string;
  theme?: EmailTheme;
  /** A booking code is read letter by letter, an OTP digit by digit, a password is shown as written */
  kind?: 'code' | 'password';
}

/** The big framed code: booking code, OTP or a password. */
export function emailCodeBox(options: CodeBoxOptions): string {
  const colors = getThemeColors(options.theme || 'customer');
  const isPassword = options.kind === 'password';
  const valueStyle = isPassword
    ? `font-family:${MONO_STACK};font-size:24px;font-weight:700;letter-spacing:1px;word-break:break-all;`
    : `font-family:${MONO_STACK};font-size:38px;font-weight:800;letter-spacing:8px;padding-left:8px;`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
  <tr>
    <td align="center" style="padding:22px 16px;background-color:${colors.accentSoft};border:2px dashed ${colors.accent};border-radius:10px;">
      <div style="margin-bottom:10px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${escapeHtml(options.label)}</div>
      <div class="cs-code" style="${valueStyle}line-height:1.1;color:${colors.accentDark};">${escapeHtml(options.value)}</div>
    </td>
  </tr>
</table>`;
}

export interface InfoRow {
  label: string;
  /** Already-safe HTML (escape outside values yourself) */
  valueHtml: string;
}

/** Label / value rows, right-aligned values, as a table. */
export function emailInfoTable(rows: InfoRow[]): string {
  const body = rows
    .map(
      (row, index) => `<tr>
    <td style="padding:11px 0;${index < rows.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : ''}font-size:14px;color:#64748b;">${escapeHtml(row.label)}</td>
    <td align="right" style="padding:11px 0 11px 12px;${index < rows.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : ''}font-size:14px;font-weight:700;color:#1e293b;">${row.valueHtml}</td>
  </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${body}</table>`;
}

export interface CalloutOptions {
  tone: CalloutTone;
  /** Plain text, bold, first line */
  title?: string;
  /** Plain-text bullet points */
  items?: string[];
  /** Or a free paragraph of safe HTML */
  bodyHtml?: string;
}

/** A coloured note with a left bar: warnings, tips, security notes. */
export function emailCallout(options: CalloutOptions): string {
  const colors = CALLOUT_COLORS[options.tone];
  const title = options.title ? `<div style="margin:0 0 6px;font-weight:700;">${escapeHtml(options.title)}</div>` : '';
  const items =
    options.items && options.items.length > 0
      ? `<ul style="margin:0;padding-left:18px;">${options.items.map((item) => `<li style="margin:3px 0;">${item}</li>`).join('')}</ul>`
      : '';
  const body = options.bodyHtml ? `<div>${options.bodyHtml}</div>` : '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
  <tr>
    <td style="padding:14px 16px;background-color:${colors.background};border-left:4px solid ${colors.border};border-radius:6px;font-size:13px;line-height:1.6;color:${colors.text};">
      ${title}${items}${body}
    </td>
  </tr>
</table>`;
}

/** A button that stays a button in Outlook (the colour is on the cell, not only on the link). */
export function emailButton(label: string, url: string, theme: EmailTheme = 'customer'): string {
  const colors = getThemeColors(theme);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto;">
  <tr>
    <td align="center" bgcolor="${colors.accent}" style="border-radius:8px;background-color:${colors.accent};">
      <a href="${escapeAttr(url)}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

/** The link in plain text under a button, for mail apps that block buttons. */
export function emailLinkFallback(url: string): string {
  // A link that would not be accepted as a button target (not https) is not shown as text either
  if (escapeAttr(url) === '#') return '';
  return `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#94a3b8;word-break:break-all;">Nếu nút không bấm được, hãy sao chép liên kết này vào trình duyệt:<br><a href="${escapeAttr(url)}" style="color:#667eea;">${escapeHtml(url)}</a></p>`;
}

export function emailMutedNote(html: string): string {
  return `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">${html}</p>`;
}

export interface ItemLine {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Shows the small "ĐƯỢC GIẢM" tag */
  discounted?: boolean;
}

function format_money(amount: number): string {
  return amount > 0 ? `${amount.toLocaleString('vi-VN')}đ` : '--';
}

/** Package / VR rows: name, quantity, unit price, line total. */
export function emailItemTable(title: string, lines: ItemLine[], emptyText = ''): string {
  const tag = `<span style="display:inline-block;margin-left:6px;padding:1px 5px;border:1px solid #fda4af;border-radius:3px;background-color:#fff1f2;font-size:10px;font-weight:700;color:#e11d48;">ĐƯỢC GIẢM</span>`;
  const headCell = (label: string, align: string) =>
    `<th align="${align}" style="padding:9px 10px;background-color:#f1f5f9;font-size:12px;font-weight:700;color:#475569;text-align:${align};">${label}</th>`;
  const cell = (html: string, align: string) =>
    `<td align="${align}" style="padding:10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;text-align:${align};">${html}</td>`;

  const rows =
    lines.length > 0
      ? lines
          .map(
            (line) => `<tr>
    ${cell(`${escapeHtml(line.name)}${line.discounted ? tag : ''}`, 'left')}
    ${cell(escapeHtml(line.quantity), 'center')}
    ${cell(format_money(line.unitPrice), 'right')}
    ${cell(format_money(line.lineTotal), 'right')}
  </tr>`
          )
          .join('')
      : `<tr><td colspan="4" align="center" style="padding:12px;font-size:13px;font-style:italic;color:#94a3b8;">${escapeHtml(emptyText)}</td></tr>`;

  return `${emailSectionTitle(title)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
  <tr>${headCell('Gói', 'left')}${headCell('SL', 'center')}${headCell('Đơn giá', 'right')}${headCell('Thành tiền', 'right')}</tr>
  ${rows}
</table>`;
}

/** A plain list with a right-hand note per row (used for the movies included in a package). */
export function emailListTable(title: string, rows: { text: string; note?: string }[]): string {
  const body = rows
    .map(
      (row, index) => `<tr>
    <td style="padding:9px 0;${index < rows.length - 1 ? 'border-bottom:1px dashed #e2e8f0;' : ''}font-size:14px;font-weight:600;color:#334155;">&#127916;&nbsp;${escapeHtml(row.text)}</td>
    <td align="right" style="padding:9px 0 9px 12px;${index < rows.length - 1 ? 'border-bottom:1px dashed #e2e8f0;' : ''}font-size:12px;color:#94a3b8;white-space:nowrap;">${escapeHtml(row.note || '')}</td>
  </tr>`
    )
    .join('');
  return `${emailSectionTitle(title)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${body}</table>`;
}

export interface PriceSummaryOptions {
  originalText: string;
  discountText?: string;
  discountLabel?: string;
  totalText: string;
}

/** "Tạm tính / Giảm giá / Tổng thanh toán". Amounts arrive formatted ("250.000"). */
export function emailPriceSummary(options: PriceSummaryOptions): string {
  const discountRow = options.discountText
    ? `<tr>
    <td style="padding:8px 0;font-size:14px;color:#64748b;">${escapeHtml(options.discountLabel || 'Giảm giá')}</td>
    <td align="right" style="padding:8px 0;font-size:14px;font-weight:700;color:#16a34a;">-${escapeHtml(options.discountText)}đ</td>
  </tr>`
    : '';
  const originalRow = options.discountText
    ? `<tr>
    <td style="padding:8px 0;font-size:14px;color:#64748b;">Tạm tính</td>
    <td align="right" style="padding:8px 0;font-size:14px;font-weight:700;color:#1e293b;">${escapeHtml(options.originalText)}đ</td>
  </tr>`
    : '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;">
  ${originalRow}
  ${discountRow}
  <tr>
    <td colspan="2" style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;background-color:#eef2ff;border-left:4px solid #4f46e5;border-radius:6px;">
        <tr>
          <td style="padding:13px 14px;font-size:14px;font-weight:600;color:#475569;">Tổng thanh toán</td>
          <td align="right" style="padding:13px 14px;font-size:20px;font-weight:800;color:#4338ca;">${escapeHtml(options.totalText)}đ</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
