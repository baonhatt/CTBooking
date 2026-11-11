// ============================================================
// CINESPHERE - Email templates
//
// In this file, in order:
//   1. SUBJECTS          one place for every subject line
//   2. SMALL HELPERS     list parsing, money and date formatting
//   3. CUSTOMER MAILS    booking confirmation, reset password, welcome, OTP
//   4. STAFF MAILS       account created, password reset, password-change OTP, login OTP
//
// The page frame, colours and building blocks live in email-layout.ts. A template here only decides
// WHAT it says: build the body from the components and hand it to renderEmailShell().
// HOW TO ADD A MAIL: add its subject below, write get<Name>Template(), add a sample in admin/email-preview.ts,
// and add its email_type to mail-queue.ts and EmailLogsContent.tsx.
// ============================================================

import {
  escapeHtml,
  escapeAttr,
  getEmailBrand,
  renderEmailShell,
  emailGreeting,
  emailParagraph,
  emailParagraphHtml,
  emailCodeBox,
  emailInfoTable,
  emailSectionTitle,
  emailCallout,
  emailButton,
  emailLinkFallback,
  emailItemTable,
  emailListTable,
  emailPriceSummary,
  type ItemLine,
  type EmailTheme
} from './email-layout';

export { escapeHtml, escapeAttr };

// ---- SUBJECTS ----

export const EMAIL_SUBJECTS = {
  welcome: '🎉 Chào mừng bạn đến CINESPHERE',
  resetPassword: 'Đặt lại mật khẩu - CINESPHERE',
  otp: '🔐 Mã Xác Thực - CINESPHERE',
  staffLoginOtp: '🔐 Mã Xác Thực Đăng Nhập (2FA) - CINESPHERE',
  staffPasswordChangeOtp: '🔐 Mã Xác Thực Thay Đổi Mật Khẩu - CINESPHERE',
  staffAccountCreated: '👤 Tài khoản CINESPHERE Admin của bạn đã được tạo',
  staffPasswordReset: '🔑 Mật khẩu CINESPHERE Admin đã được đặt lại',
  bookingConfirmation: (orderCode: string | number) => `Xác nhận đặt vé thành công cho đơn #${orderCode}`
};

// ---- SMALL HELPERS ----

/** A JSON array in a string ('["A","B"]'), or a single plain value ("A"), as a list of strings. */
function parse_list(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map((item) => String(item));
  const text = String(value);
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    return [String(parsed)];
  } catch {
    return [text];
  }
}

/** 250000 -> "250.000"; text such as "250.000" is kept; missing -> "0" */
function format_amount(value: unknown): string {
  if (typeof value === 'number') return value.toLocaleString('vi-VN');
  const text = String(value ?? '').trim();
  return text || '0';
}

function format_expiry(value: unknown): string {
  try {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    const day = date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    return `${time} ${day}`;
  } catch {
    return String(value);
  }
}

function booking_type_label(bookingType: unknown): string {
  if (bookingType === 'combo_vr') return 'Gói Combo Phim + VR';
  if (bookingType === 'vr') return 'Gói Giải trí VR';
  return 'Gói Vé Phim';
}

// ---- CUSTOMER MAILS ----

/** Package / VR lines the confirmation mail shows as tables. The caller builds them from the booking. */
export interface BookingEmailData {
  bookingCode?: string;
  customerName?: string;
  /** JSON array text, a plain title, or nothing */
  movieTitle?: string;
  /** JSON array text in the same order as movieTitle */
  durationMin?: unknown;
  ticketCount?: number;
  totalPrice?: number | string;
  originalTotal?: number | string;
  discountAmt?: number;
  voucherCode?: string | null;
  expiryDate?: string | null;
  bookingType?: string;
  branchName?: string | null;
  branchAddress?: string | null;
  branchPhone?: string | null;
  branchSettings?: string | null;
  packageLines?: ItemLine[];
  vrLines?: ItemLine[];
  /** Shown instead of the VR table when a combo has no VR detail rows */
  vrEmptyNotice?: boolean;
  /** Older callers pass ready-made HTML; it is still accepted */
  moviePackagesTableHtml?: string;
  vrTableHtml?: string;
}

function resolve_hotline(data: BookingEmailData): string {
  let hotline = String(data.branchPhone || '').trim();
  if (data.branchSettings) {
    try {
      const settings = JSON.parse(data.branchSettings);
      if (settings.hotline) hotline = String(settings.hotline);
    } catch {}
  }
  return hotline;
}

export function getBookingEmailTemplate(baseUrlOrData: any, maybeData?: any): string {
  const data: BookingEmailData =
    typeof baseUrlOrData === 'object' && baseUrlOrData !== null ? baseUrlOrData : maybeData || {};
  const baseUrl = (typeof baseUrlOrData === 'string' ? baseUrlOrData : getEmailBrand().clientBaseUrl).replace(/\/+$/, '');

  const movieTitles = parse_list(data.movieTitle);
  const durations = parse_list(data.durationMin);
  const code = data.bookingCode || 'KHÔNG RÕ';

  // Package / VR sections
  const packageSection = data.packageLines?.length
    ? emailItemTable('Danh sách gói vé đã chọn', data.packageLines)
    : data.moviePackagesTableHtml || '';
  const vrSection = data.vrLines?.length
    ? emailItemTable('🎮 Trải nghiệm VR kèm theo', data.vrLines)
    : data.vrEmptyNotice
      ? emailItemTable('🎮 Trải nghiệm VR kèm theo', [], 'Không có chi tiết gói VR')
      : data.vrTableHtml || '';
  const moviesSection =
    movieTitles.length > 0
      ? emailListTable(
          'Phim tự chọn trong gói',
          movieTitles.map((title, index) => ({ text: title, note: `${durations[index] || '--'} phút` }))
        )
      : '';

  // Order details
  const detailRows = [];
  if (data.branchName) {
    detailRows.push({ label: 'Chi nhánh', valueHtml: escapeHtml(data.branchName) });
    if (data.branchAddress) {
      detailRows.push({
        label: 'Địa chỉ',
        valueHtml: `<span style="font-size:13px;font-weight:600;color:#475569;">${escapeHtml(data.branchAddress)}</span>`
      });
    }
  }
  detailRows.push({
    label: 'Số lượng vé',
    valueHtml: `<span style="display:inline-block;padding:2px 10px;border-radius:4px;background-color:#e0e7ff;font-size:13px;font-weight:700;color:#4338ca;">${escapeHtml(data.ticketCount || 0)} VÉ</span>`
  });
  detailRows.push({ label: 'Loại vé', valueHtml: escapeHtml(booking_type_label(data.bookingType)) });
  if (data.expiryDate) {
    detailRows.push({
      label: 'Hạn sử dụng',
      valueHtml: `<span style="color:#dc2626;">${escapeHtml(format_expiry(data.expiryDate))}</span>`
    });
  }

  const totalText = format_amount(data.totalPrice);
  const originalText = format_amount(data.originalTotal ?? data.totalPrice);
  const discount = Number(data.discountAmt || 0);
  const discountLabel = data.voucherCode ? `Giảm giá (${data.voucherCode})` : 'Giảm giá';

  const expiryNotice = data.expiryDate
    ? emailCallout({
        tone: 'danger',
        title: 'Lưu ý về hạn sử dụng',
        bodyHtml: `Vé có hạn sử dụng đến <strong>${escapeHtml(format_expiry(data.expiryDate))}</strong>. Quá hạn, mã vé sẽ không còn hiệu lực và không được hoàn tiền.`
      })
    : '';

  const bodyHtml = [
    emailGreeting(data.customerName || 'Quý khách'),
    emailParagraph('Đơn hàng của bạn đã được xác nhận. Vui lòng xuất trình mã đặt vé dưới đây cho nhân viên Cinesphere tại quầy.'),
    emailCodeBox({ label: 'Mã đặt vé của bạn', value: code }),
    packageSection,
    vrSection,
    moviesSection,
    emailSectionTitle('Chi tiết đơn hàng'),
    emailInfoTable(detailRows),
    emailPriceSummary({
      originalText,
      discountText: discount > 0 ? discount.toLocaleString('vi-VN') : '',
      discountLabel,
      totalText
    }),
    expiryNotice,
    emailButton('Xem vé của tôi', `${baseUrl}/account`)
  ].join('\n');

  return renderEmailShell({
    theme: 'customer',
    title: 'Xác nhận đặt vé',
    preheader: `Mã đặt vé của bạn: ${code}. Xuất trình mã này tại quầy.`,
    bodyHtml,
    // The order details already show the branch address, so the company address is only a fallback
    showAddress: !String(data.branchAddress || '').trim(),
    hotlineOverride: resolve_hotline(data)
  });
}

export function getResetPasswordEmailTemplate(link: string): string;
export function getResetPasswordEmailTemplate(baseUrl: string, link: string): string;
export function getResetPasswordEmailTemplate(arg1: string, arg2?: string): string {
  const link = arg2 || arg1;
  const brand = getEmailBrand();

  const bodyHtml = [
    emailGreeting('bạn'),
    emailParagraphHtml(
      'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm nút bên dưới để tạo mật khẩu mới. Liên kết hết hạn sau <strong>60 phút</strong>.'
    ),
    emailButton('Đặt lại mật khẩu', link),
    emailLinkFallback(link),
    emailCallout({
      tone: 'neutral',
      bodyHtml: `Không phải bạn yêu cầu? Hãy bỏ qua email này, mật khẩu của bạn vẫn giữ nguyên. Cần giúp đỡ, liên hệ ${escapeHtml(brand.supportEmail)}.`
    })
  ].join('\n');

  return renderEmailShell({
    theme: 'customer',
    title: 'Đặt lại mật khẩu',
    preheader: 'Bấm vào liên kết để tạo mật khẩu mới. Liên kết hết hạn sau 60 phút.',
    bodyHtml
  });
}

export function getWelcomeEmailTemplate(data: { customerName: string; email: string }, baseUrlStr?: string): string;
export function getWelcomeEmailTemplate(baseUrlStr: string, data: { customerName: string; email: string }): string;
export function getWelcomeEmailTemplate(arg1: any, arg2?: any): string {
  const data: { customerName: string; email: string } = typeof arg1 === 'string' ? arg2 : arg1;
  const baseUrl = String((typeof arg1 === 'string' ? arg1 : arg2) || getEmailBrand().clientBaseUrl).replace(/\/+$/, '');

  const benefits = [
    'Đặt vé để trải nghiệm các bộ phim vũ trụ đa chiều',
    'Nhận những ưu đãi mới mỗi ngày',
    'Dễ dàng theo dõi các vé đã đặt của bạn'
  ];
  const benefitRows = benefits
    .map(
      (text, index) => `<tr>
    <td width="40" valign="middle" style="padding:8px 0;${index < benefits.length - 1 ? 'border-bottom:1px dashed #e2e8f0;' : ''}">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" valign="middle" width="28" height="28" bgcolor="#667eea" style="width:28px;height:28px;border-radius:8px;background-color:#667eea;font-size:14px;font-weight:700;color:#ffffff;">${index + 1}</td>
      </tr></table>
    </td>
    <td valign="middle" style="padding:8px 0 8px 12px;${index < benefits.length - 1 ? 'border-bottom:1px dashed #e2e8f0;' : ''}font-size:14px;color:#1e293b;">${escapeHtml(text)}</td>
  </tr>`
    )
    .join('');

  const bodyHtml = [
    emailGreeting(data.customerName || 'Quý khách'),
    emailParagraphHtml(`Tài khoản của bạn đã được tạo thành công với email <strong>${escapeHtml(data.email || 'của bạn')}</strong>.`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;"><tr><td style="padding:10px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${benefitRows}</table>
    </td></tr></table>`,
    emailButton('Đến trang chủ đặt vé', `${baseUrl}/`)
  ].join('\n');

  return renderEmailShell({
    theme: 'customer',
    title: 'Chào mừng thành viên mới',
    preheader: 'Tài khoản CINESPHERE của bạn đã sẵn sàng. Đặt vé ngay hôm nay.',
    bodyHtml
  });
}

export function getOTPEmailTemplate(data: {
  customerName: string;
  email: string;
  otp: string;
  expiryMinutes: number;
}): string {
  const bodyHtml = [
    emailGreeting(data.customerName || 'Quý khách'),
    emailParagraphHtml(
      `Chúng tôi nhận được yêu cầu đăng nhập vào tài khoản <strong>${escapeHtml(data.email)}</strong>. Nhập mã xác thực (OTP) sau để tiếp tục:`
    ),
    emailCodeBox({ label: 'Mã xác thực (OTP)', value: data.otp }),
    emailCallout({
      tone: 'warning',
      title: 'Lưu ý quan trọng',
      items: [
        `Mã hết hạn sau <strong>${escapeHtml(data.expiryMinutes)} phút</strong>.`,
        'Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên CINESPHERE.',
        'Nếu không phải bạn đăng nhập, hãy bỏ qua email này.'
      ]
    })
  ].join('\n');

  return renderEmailShell({
    theme: 'customer',
    title: 'Mã xác thực 2 lớp',
    preheader: `Mã của bạn là ${data.otp}. Hết hạn sau ${data.expiryMinutes} phút.`,
    bodyHtml
  });
}

// ---- STAFF MAILS ----

const STAFF_THEME: EmailTheme = 'staff';

function default_staff_login_url(): string {
  return `${getEmailBrand().clientBaseUrl}/login`;
}

function staff_account_block(email: string): string {
  return emailInfoTable([{ label: 'Email', valueHtml: escapeHtml(email || '') }]);
}

function staff_login_link_item(loginUrl: string): string {
  return `Truy cập <a href="${escapeAttr(loginUrl)}" style="color:#d97706;font-weight:600;">Trang đăng nhập hệ thống</a>.`;
}

export function getStaffAccountCreatedTemplate(data: {
  staffName: string;
  email: string;
  password: string;
  loginUrl?: string;
}): string {
  const loginUrl = data.loginUrl || default_staff_login_url();

  const bodyHtml = [
    emailGreeting(data.staffName || 'Nhân viên'),
    emailParagraph('Tài khoản nhân viên của bạn đã được tạo. Dưới đây là thông tin đăng nhập:'),
    staff_account_block(data.email),
    emailCodeBox({ label: 'Mật khẩu của bạn', value: data.password, theme: STAFF_THEME, kind: 'password' }),
    emailCallout({
      tone: 'warning',
      title: 'Lưu ý quan trọng',
      items: ['Đổi mật khẩu ngay sau lần đăng nhập đầu tiên.', 'Không chia sẻ mật khẩu này với bất kỳ ai.', staff_login_link_item(loginUrl)]
    })
  ].join('\n');

  return renderEmailShell({
    theme: STAFF_THEME,
    title: 'Tài khoản nhân viên mới',
    preheader: 'Tài khoản quản trị của bạn đã được tạo.',
    bodyHtml
  });
}

export function getStaffPasswordResetTemplate(data: {
  staffName: string;
  email: string;
  newPassword: string;
  loginUrl?: string;
}): string {
  const loginUrl = data.loginUrl || default_staff_login_url();

  const bodyHtml = [
    emailGreeting(data.staffName || 'Nhân viên'),
    emailParagraph('Mật khẩu của bạn đã được đặt lại. Dưới đây là thông tin đăng nhập mới:'),
    staff_account_block(data.email),
    emailCodeBox({ label: 'Mật khẩu mới của bạn', value: data.newPassword, theme: STAFF_THEME, kind: 'password' }),
    emailCallout({
      tone: 'warning',
      title: 'Lưu ý quan trọng',
      items: ['Đổi mật khẩu ngay sau lần đăng nhập tiếp theo.', 'Không chia sẻ mật khẩu này với bất kỳ ai.', staff_login_link_item(loginUrl)]
    })
  ].join('\n');

  return renderEmailShell({
    theme: STAFF_THEME,
    title: 'Đặt lại mật khẩu nhân viên',
    preheader: 'Mật khẩu quản trị của bạn đã được đặt lại.',
    bodyHtml
  });
}

export function getStaffPasswordChangeOTPTemplate(data: {
  staffName: string;
  email: string;
  otp: string;
  expiryMinutes: number;
}): string {
  const bodyHtml = [
    emailGreeting(data.staffName || 'Nhân viên'),
    emailParagraphHtml(
      `Để tiếp tục đổi mật khẩu cho tài khoản <strong>${escapeHtml(data.email)}</strong>, nhập mã xác thực (OTP) sau trên hệ thống:`
    ),
    emailCodeBox({ label: 'Mã xác thực (OTP)', value: data.otp, theme: STAFF_THEME }),
    emailCallout({
      tone: 'warning',
      title: 'Lưu ý quan trọng',
      items: [
        `Mã hết hạn sau <strong>${escapeHtml(data.expiryMinutes)} phút</strong>.`,
        'Mã OTP là thông tin bảo mật, tuyệt đối không chia sẻ.',
        'Nếu bạn không đổi mật khẩu, tài khoản có thể đang gặp rủi ro. Hãy báo ngay cho quản trị viên.'
      ]
    })
  ].join('\n');

  return renderEmailShell({
    theme: STAFF_THEME,
    title: 'Xác thực đổi mật khẩu',
    preheader: `Mã của bạn là ${data.otp}. Hết hạn sau ${data.expiryMinutes} phút.`,
    bodyHtml
  });
}

export function getStaffLoginOTPTemplate(data: {
  staffName?: string;
  email: string;
  otp: string;
  expiryMinutes: number;
}): string {
  const bodyHtml = [
    emailGreeting(data.staffName || data.email),
    emailParagraphHtml(
      `Một thiết bị đang đăng nhập vào tài khoản quản trị <strong>${escapeHtml(data.email)}</strong>. Bảo mật 2 lớp (2FA) đang bật, hãy dùng mã dưới đây để hoàn tất đăng nhập:`
    ),
    emailCodeBox({ label: 'Mã đăng nhập (OTP)', value: data.otp, theme: STAFF_THEME }),
    emailCallout({
      tone: 'danger',
      title: 'Lưu ý quan trọng',
      items: [
        `Mã hết hạn sau <strong>${escapeHtml(data.expiryMinutes)} phút</strong>.`,
        'Tuyệt đối không chia sẻ mã này cho bất kỳ ai.',
        'Nếu không phải bạn đăng nhập, <strong>mật khẩu có thể đã bị lộ</strong>. Hãy đổi mật khẩu ngay và báo cho quản trị viên.'
      ]
    })
  ].join('\n');

  return renderEmailShell({
    theme: STAFF_THEME,
    title: 'Mã xác thực bảo mật 2FA',
    preheader: `Mã đăng nhập của bạn là ${data.otp}. Hết hạn sau ${data.expiryMinutes} phút.`,
    bodyHtml
  });
}
