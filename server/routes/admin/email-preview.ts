import {
  getBookingEmailTemplate,
  getResetPasswordEmailTemplate,
  getWelcomeEmailTemplate,
  getOTPEmailTemplate,
  getStaffAccountCreatedTemplate,
  getStaffPasswordResetTemplate,
  getStaffPasswordChangeOTPTemplate
} from '../../lib/email-templates';

export async function getEmailPreviewImpl() {
  const templates = [
    {
      id: 'booking_movie',
      name: 'Đặt vé (Chỉ gói Phim)',
      html: getBookingEmailTemplate('https://cinesphere.com.vn', {
        customerName: 'Nguyễn Văn Phim',
        bookingCode: 'CS12345M',
        movieTitle: JSON.stringify(['Interstellar (IMAX)']),
        durationMin: JSON.stringify([169]),
        moviePackagesTableHtml: `
          <div class="section-title">Chi tiết gói xem phim</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                  <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0; font-size: 14px;"><strong>Gói VIP (x2)</strong></td>
                  <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0; font-size: 14px; text-align: right;">300.000đ</td>
              </tr>
          </table>
        `,
        branchName: 'CineSphere Quận 1',
        branchAddress: '123 Đường Điện Ảnh, Phường 1, Quận 1',
        branchPhone: '1900 1234',
        ticketCount: 2,
        bookingType: 'movie',
        originalTotal: 300000,
        totalPrice: 250000,
        discountAmt: 50000,
        voucherCode: 'FILM-50K',
        expiryDate: new Date(Date.now() + 86400000).toISOString()
      })
    },
    {
      id: 'booking_vr',
      name: 'Đặt vé (Chỉ Gói VR)',
      html: getBookingEmailTemplate('https://cinesphere.com.vn', {
        customerName: 'Lê Thế Giới Ảo',
        bookingCode: 'VR881239',
        vrTableHtml: `
          <div class="section-title">Chi tiết dịch vụ VR</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                  <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0; font-size: 14px;"><strong>VR Chém BeatSaber (30 phút)</strong></td>
                  <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0; font-size: 14px; text-align: right;">150.000đ</td>
              </tr>
          </table>
        `,
        branchName: 'CineSphere Gò Vấp',
        branchAddress: '456 Quang Trung, Phường 10, Gò Vấp',
        branchPhone: '1900 4567',
        ticketCount: 1,
        bookingType: 'vr',
        originalTotal: 150000,
        totalPrice: 150000,
        expiryDate: new Date(Date.now() + 86400000).toISOString()
      })
    },
    {
      id: 'booking_combo',
      name: 'Đặt vé (Combo Phim + VR)',
      html: getBookingEmailTemplate('https://cinesphere.com.vn', {
        customerName: 'Trần Đại Gia',
        bookingCode: 'CB998122',
        movieTitle: JSON.stringify(['Dune: Part Two']),
        durationMin: JSON.stringify([166]),
        moviePackagesTableHtml: `
          <div class="section-title">Chi tiết gói xem phim</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 10px;">
              <tr>
                  <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0; font-size: 14px;"><strong>Gói VIP (x2)</strong></td>
                  <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0; font-size: 14px; text-align: right;">300.000đ</td>
              </tr>
          </table>
        `,
        vrTableHtml: `
          <div class="section-title">Chi tiết dịch vụ VR</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                  <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0; font-size: 14px;"><strong>VR Khám phá vũ trụ (1 giờ)</strong></td>
                  <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0; font-size: 14px; text-align: right;">250.000đ</td>
              </tr>
          </table>
        `,
        branchName: 'CineSphere Quận 1',
        branchAddress: '123 Đường Điện Ảnh, Phường 1, Quận 1',
        ticketCount: 4,
        bookingType: 'combo_vr',
        originalTotal: 550000,
        totalPrice: 500000,
        discountAmt: 50000,
        voucherCode: 'COMBO_DEAL',
        expiryDate: new Date(Date.now() + 86400000 * 3).toISOString()
      })
    },
    {
      id: 'booking_edge_case',
      name: 'Đặt vé (Lỗi Data & Vô thời hạn)',
      html: getBookingEmailTemplate('https://cinesphere.com.vn', {
        // Missing many fields to test fallbacks
      })
    },
    {
      id: 'forgot_password_user',
      name: 'Quên mật khẩu (User)',
      html: getResetPasswordEmailTemplate('https://cinesphere.com.vn', 'https://cinesphere.com.vn/reset-password?token=mock_token_123')
    },
    {
      id: 'welcome_user',
      name: 'Chào mừng thành viên mới',
      html: getWelcomeEmailTemplate('https://cinesphere.com.vn', {
        customerName: 'Trần Thị B',
        email: 'tranthib@example.com'
      })
    },
    {
      id: 'otp_login',
      name: 'Mã OTP đăng nhập',
      html: getOTPEmailTemplate({
        customerName: 'Lê Văn C',
        email: 'levanc@example.com',
        otp: '829471',
        expiryMinutes: 10
      })
    },
    {
      id: 'staff_created',
      name: 'Tài khoản nhân viên mới',
      html: getStaffAccountCreatedTemplate({
        staffName: 'Hoàng Nhân Viên',
        email: 'hoangnv@cinesphere.com.vn',
        password: 'RandomPassword123!',
        loginUrl: 'https://cinesphere.com.vn/admin/login'
      })
    },
    {
      id: 'staff_reset',
      name: 'Reset mật khẩu nhân viên',
      html: getStaffPasswordResetTemplate({
        staffName: 'Nguyễn Quản Trị',
        email: 'nguyenqt@cinesphere.com.vn',
        newPassword: 'NewSecurePassword456@',
        loginUrl: 'https://cinesphere.com.vn/admin/login'
      })
    },
    {
      id: 'staff_otp',
      name: 'OTP đổi mật khẩu nhân viên',
      html: getStaffPasswordChangeOTPTemplate({
        staffName: 'Phạm Trưởng Ca',
        email: 'pham_admin@cinesphere.com.vn',
        otp: '381942',
        expiryMinutes: 15
      })
    }
  ];

  return { status: 'success', data: templates };
}
