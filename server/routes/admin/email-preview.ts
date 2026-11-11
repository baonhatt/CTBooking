import {
  EMAIL_SUBJECTS,
  getBookingEmailTemplate,
  getResetPasswordEmailTemplate,
  getWelcomeEmailTemplate,
  getOTPEmailTemplate,
  getStaffAccountCreatedTemplate,
  getStaffPasswordResetTemplate,
  getStaffPasswordChangeOTPTemplate,
  getStaffLoginOTPTemplate
} from '../../lib/email-templates';
import { htmlToPlainText } from '../mail-service';
import { getEmailBrand } from '../../lib/email-layout';

const SAMPLE_SITE = 'https://cinesphere.com.vn';

interface PreviewTemplate {
  id: string;
  name: string;
  /** Who receives the mail */
  audience: 'user' | 'staff';
  /** The subject line the mail is really sent with */
  subject: string;
  /** False when no part of the app sends this mail yet */
  sent: boolean;
  html: string;
}

function with_text(template: PreviewTemplate) {
  return { ...template, text: htmlToPlainText(template.html) };
}

function build_samples(): PreviewTemplate[] {
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const in_three_days = new Date(Date.now() + 86400000 * 3).toISOString();

  const samples: PreviewTemplate[] = [
    {
      id: 'booking_movie',
      name: 'Đặt vé (Chỉ gói Phim)',
      audience: 'user',
      subject: EMAIL_SUBJECTS.bookingConfirmation('CS12345M'),
      sent: true,
      html: getBookingEmailTemplate(SAMPLE_SITE, {
        customerName: 'Nguyễn Văn Phim',
        bookingCode: 'CS12345M',
        movieTitle: JSON.stringify(['Interstellar (IMAX)']),
        durationMin: JSON.stringify([169]),
        packageLines: [{ name: 'Gói VIP', quantity: 2, unitPrice: 150000, lineTotal: 300000, discounted: true }],
        branchName: 'CineSphere Quận 1',
        branchAddress: '123 Đường Điện Ảnh, Phường 1, Quận 1',
        branchPhone: '1900 1234',
        ticketCount: 2,
        bookingType: 'movie',
        originalTotal: 300000,
        totalPrice: 250000,
        discountAmt: 50000,
        voucherCode: 'FILM-50K',
        expiryDate: tomorrow
      })
    },
    {
      id: 'booking_vr',
      name: 'Đặt vé (Chỉ Gói VR)',
      audience: 'user',
      subject: EMAIL_SUBJECTS.bookingConfirmation('VR881239'),
      sent: true,
      html: getBookingEmailTemplate(SAMPLE_SITE, {
        customerName: 'Lê Thế Giới Ảo',
        bookingCode: 'VR881239',
        vrLines: [{ name: 'VR Chém BeatSaber (30 phút)', quantity: 1, unitPrice: 150000, lineTotal: 150000 }],
        branchName: 'CineSphere Gò Vấp',
        branchAddress: '456 Quang Trung, Phường 10, Gò Vấp',
        branchPhone: '1900 4567',
        ticketCount: 1,
        bookingType: 'vr',
        originalTotal: 150000,
        totalPrice: 150000,
        expiryDate: tomorrow
      })
    },
    {
      id: 'booking_combo',
      name: 'Đặt vé (Combo Phim + VR)',
      audience: 'user',
      subject: EMAIL_SUBJECTS.bookingConfirmation('CB998122'),
      sent: true,
      html: getBookingEmailTemplate(SAMPLE_SITE, {
        customerName: 'Trần Đại Gia',
        bookingCode: 'CB998122',
        movieTitle: JSON.stringify(['Dune: Part Two', 'Blade Runner 2049']),
        durationMin: JSON.stringify([166, 164]),
        packageLines: [{ name: 'Gói VIP', quantity: 2, unitPrice: 150000, lineTotal: 300000, discounted: true }],
        vrLines: [{ name: 'VR Khám phá vũ trụ (1 giờ)', quantity: 1, unitPrice: 250000, lineTotal: 250000, discounted: true }],
        branchName: 'CineSphere Quận 1',
        branchAddress: '123 Đường Điện Ảnh, Phường 1, Quận 1',
        ticketCount: 4,
        bookingType: 'combo_vr',
        originalTotal: 550000,
        totalPrice: 500000,
        discountAmt: 50000,
        voucherCode: 'COMBO_DEAL',
        expiryDate: in_three_days
      })
    },
    {
      id: 'booking_edge_case',
      name: 'Đặt vé (Thiếu dữ liệu, không hạn dùng)',
      audience: 'user',
      subject: EMAIL_SUBJECTS.bookingConfirmation('(không rõ)'),
      sent: true,
      // Missing fields on purpose: shows the fallbacks
      html: getBookingEmailTemplate(SAMPLE_SITE, {})
    },
    {
      id: 'forgot_password_user',
      name: 'Quên mật khẩu',
      audience: 'user',
      subject: EMAIL_SUBJECTS.resetPassword,
      sent: true,
      html: getResetPasswordEmailTemplate(SAMPLE_SITE, `${SAMPLE_SITE}/reset-password?token=mock_token_123`)
    },
    {
      id: 'welcome_user',
      name: 'Chào mừng thành viên mới',
      audience: 'user',
      subject: EMAIL_SUBJECTS.welcome,
      sent: true,
      html: getWelcomeEmailTemplate(SAMPLE_SITE, { customerName: 'Trần Thị B', email: 'tranthib@example.com' })
    },
    {
      id: 'otp_login',
      name: 'Mã OTP đăng nhập',
      audience: 'user',
      subject: EMAIL_SUBJECTS.otp,
      sent: true,
      html: getOTPEmailTemplate({ customerName: 'Lê Văn C', email: 'levanc@example.com', otp: '829471', expiryMinutes: 10 })
    },
    {
      id: 'staff_login_otp',
      name: 'OTP đăng nhập nhân viên (2FA)',
      audience: 'staff',
      subject: EMAIL_SUBJECTS.staffLoginOtp,
      sent: true,
      html: getStaffLoginOTPTemplate({
        staffName: 'Nguyễn Quản Trị',
        email: 'nguyenqt@cinesphere.com.vn',
        otp: '604218',
        expiryMinutes: 5
      })
    },
    {
      id: 'staff_otp',
      name: 'OTP đổi mật khẩu nhân viên',
      audience: 'staff',
      subject: EMAIL_SUBJECTS.staffPasswordChangeOtp,
      sent: true,
      html: getStaffPasswordChangeOTPTemplate({
        staffName: 'Phạm Trưởng Ca',
        email: 'pham_admin@cinesphere.com.vn',
        otp: '381942',
        expiryMinutes: 5
      })
    },
    {
      id: 'staff_created',
      name: 'Tài khoản nhân viên mới',
      audience: 'staff',
      subject: EMAIL_SUBJECTS.staffAccountCreated,
      sent: true,
      html: getStaffAccountCreatedTemplate({
        staffName: 'Hoàng Nhân Viên',
        email: 'hoangnv@cinesphere.com.vn',
        password: 'RandomPassword123!',
        loginUrl: `${SAMPLE_SITE}/login`
      })
    },
    {
      id: 'staff_reset',
      name: 'Reset mật khẩu nhân viên',
      audience: 'staff',
      subject: EMAIL_SUBJECTS.staffPasswordReset,
      sent: true,
      html: getStaffPasswordResetTemplate({
        staffName: 'Nguyễn Quản Trị',
        email: 'nguyenqt@cinesphere.com.vn',
        newPassword: 'NewSecurePassword456@',
        loginUrl: `${SAMPLE_SITE}/login`
      })
    }
  ];
  return samples;
}

export async function getEmailPreviewImpl() {
  const templates = build_samples().map(with_text);

  const brand = getEmailBrand();
  return {
    status: 'success',
    data: templates,
    // Shown on the preview page so a missing setting is noticed before a customer sees it
    brand: {
      supportEmail: brand.supportEmail,
      hotline: brand.hotline,
      companyAddress: brand.companyAddress
    }
  };
}

/**
 * Sends one sample mail to the address typed on the preview page, so it can be checked in a real inbox.
 * Only staff with the email-logs permission reach this; the subject is marked [THỬ] and the body is sample data.
 */
/** One plain address: no spaces, no line breaks, no second address, no display name. */
const TEST_RECIPIENT_PATTERN = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']{2,}$/;
const TEST_RECIPIENT_MAX_LENGTH = 254;

export async function sendTestEmailImpl(
  templateId: string,
  toEmail: string,
  sendMailFn: (to: string, subject: string, html: string) => Promise<any>
) {
  const sample = build_samples().find((item) => item.id === templateId);
  if (!sample) return { status: 'error', message: 'Không tìm thấy mẫu email' };

  const recipient = String(toEmail || '').trim();
  if (!recipient) return { status: 'error', message: 'Hãy nhập email nhận thư thử' };
  if (recipient.length > TEST_RECIPIENT_MAX_LENGTH || !TEST_RECIPIENT_PATTERN.test(recipient)) {
    return { status: 'error', message: 'Email nhận thư thử không hợp lệ' };
  }

  await sendMailFn(recipient, `[THỬ] ${sample.subject}`, sample.html);
  return { status: 'success', message: `Đã gửi thư thử tới ${recipient}` };
}

