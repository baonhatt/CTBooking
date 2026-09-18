// ============================================================
// CINESPHERE — Email Templates (FIXED VERSION)
// Các thay đổi so với bản gốc, xem chi tiết ghi chú "// FIX:" ở từng vị trí:
//  1. Fallback dữ liệu null/undefined từ DB (không còn hiện "undefined")
//  2. Sửa bug VITE_SERVER_BASE_URL -> VITE_CLIENT_BASE_URL trong welcome email
//  3. Thêm background-color fallback cho mọi linear-gradient (Outlook)
//  4. Đổi .step (welcome) và .info-row (staff) từ flex sang <table> (Outlook)
//  5. Inline CSS cho các phần tử quan trọng: button, otp-box, password-box
//  6. Thống nhất 1 màu CTA button (#667eea) cho toàn hệ thống
//  7. Thêm địa chỉ trụ sở công ty ở footer (CAN-SPAM) cho email khách hàng
//  8. Trích xuất hotline/email hỗ trợ thành hằng số dùng chung (còn hardcode
//     giá trị mặc định, nhưng đọc từ ENV trước — dễ đổi 1 chỗ duy nhất)
// ============================================================

// ---- Hằng số dùng chung (đọc từ ENV nếu có, fallback về giá trị mặc định) ----
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'cinesphere0629@gmail.com';
const DEFAULT_HOTLINE = process.env.SUPPORT_HOTLINE || '1900-xxxx';
const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || '123 Đường Điện Ảnh, Phường 1, Quận 1, TP. Hồ Chí Minh';
const BRAND_SOLID = '#667eea'; // màu solid fallback khi gradient không chạy (Outlook)
const BRAND_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

export function getBookingEmailTemplate(baseUrlOrData: any, maybeData?: any): string {
  const data = typeof baseUrlOrData === 'object' && baseUrlOrData !== null ? baseUrlOrData : maybeData || {};
  const baseUrl =
    typeof baseUrlOrData === 'string' ? baseUrlOrData : process.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';

  // 1. XỬ LÝ PARSE JSON CHO DANH SÁCH PHIM
  let movieTitles: string[] = [];
  let durations: string[] = [];

  try {
    movieTitles = JSON.parse(data.movieTitle || '[]');
    durations = JSON.parse(String(data.durationMin) || '[]');
  } catch (e) {
    movieTitles = data.movieTitle ? [data.movieTitle] : [];
    durations = data.durationMin ? [String(data.durationMin)] : [];
  }

  // Parse branch settings for hotline
  let hotline = data.branchPhone || DEFAULT_HOTLINE;
  if (data.branchSettings) {
    try {
      const settings = JSON.parse(data.branchSettings);
      if (settings.hotline) hotline = settings.hotline;
    } catch (e) {}
  }

  // 2. TẠO HTML DANH SÁCH PHIM — dạng table (tương thích Gmail/Outlook tốt hơn flex)
  const moviesListHtml =
    movieTitles.length > 0
      ? `
    <div class="section-title">DANH SÁCH PHIM TỰ CHỌN TRONG GÓI</div>
    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 6px 15px; margin-bottom: 20px; border: 1px solid #edf2f7;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
        ${movieTitles
          .map(
            (title, index) => `
        <tr>
            <td style="padding: 10px 0; ${index < movieTitles.length - 1 ? 'border-bottom: 1px dashed #e2e8f0;' : ''} font-size: 14px; color: #2d3748; font-weight: 600;">
                🎬&nbsp;${title}
            </td>
            <td style="padding: 10px 0; ${index < movieTitles.length - 1 ? 'border-bottom: 1px dashed #e2e8f0;' : ''} font-size: 12px; color: #a0aec0; white-space: nowrap; text-align: right; padding-left: 12px;">
                ${durations[index] || '--'} phút
            </td>
        </tr>
        `
          )
          .join('')}
        </table>
    </div>
  `
      : '';

  // 3. HÀNG "CHI NHÁNH" / "ĐỊA CHỈ"
  const branchHtml = data.branchName
    ? `
    <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f7fafc; color: #718096; font-weight: 500;">Chi nhánh:</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f7fafc; color: #1a202c; font-weight: 700; text-align: right;">${data.branchName}</td>
    </tr>
    <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f7fafc; color: #718096; font-weight: 500;">Địa chỉ:</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f7fafc; color: #4a5568; font-weight: 700; font-size: 12px; text-align: right;">${data.branchAddress || ''}</td>
    </tr>`
    : ``;

  // 4. HÀNG "NGÀY HẾT HẠN"
  const expiryHtml = data.expiryDate
    ? `
    <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f7fafc; color: #718096; font-weight: 500;">Ngày hết hạn:</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f7fafc; color: #e53e3e; font-weight: 700; text-align: right;">${(() => {
          try {
            const d = new Date(String(data.expiryDate));
            return (
              d.toLocaleDateString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh'
              }) +
              ' ' +
              d.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Ho_Chi_Minh'
              })
            );
          } catch {
            return String(data.expiryDate);
          }
        })()}</td>
    </tr>`
    : ``;

  // 5. PHẦN TIỀN
  // FIX: thêm ?? 0 để tránh gọi .toLocaleString trên undefined và tránh in "undefined" ra hoá đơn
  const rawOriginal = data.originalTotal ?? data.totalPrice ?? 0;
  const originalTotalStr = typeof rawOriginal === 'number' ? rawOriginal.toLocaleString('vi-VN') : rawOriginal || 0;
  const finalTotalStr =
    typeof data.totalPrice === 'number' ? data.totalPrice.toLocaleString('vi-VN') : data.totalPrice || 0;

  const priceSummaryHtml = `
    <tr>
        <td style="padding: 12px 0; border-bottom: 1px dashed #e2e8f0; color: #718096; font-size: 14px;">Tổng tiền:</td>
        <td style="padding: 12px 0; border-bottom: 1px dashed #e2e8f0; color: #1a202c; font-weight: 700; font-size: 15px; text-align: right;">${originalTotalStr}đ</td>
    </tr>
    ${
      data.discountAmt && data.discountAmt > 0
        ? `
    <tr>
        <td style="padding: 12px 0; border-bottom: 1px dashed #e2e8f0; color: #718096; font-size: 14px;">Giảm giá${data.voucherCode ? ` (${data.voucherCode})` : ''}:</td>
        <td style="padding: 12px 0; border-bottom: 1px dashed #e2e8f0; color: #38a169; font-weight: 700; font-size: 15px; text-align: right;">-${data.discountAmt.toLocaleString('vi-VN')}đ</td>
    </tr>
    `
        : ''
    }
    <tr>
        <td colspan="2" style="padding: 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background: #eef2ff; border-left: 4px solid #4f46e5; margin: 10px 0; border-radius: 6px;">
                <tr>
                    <td style="padding: 12px 14px; color: #4a5568; font-weight: 600; font-size: 14px;">Tổng thanh toán:</td>
                    <td style="padding: 12px 14px; color: #4338ca; font-weight: 800; font-size: 19px; text-align: right;">${finalTotalStr}đ</td>
                </tr>
            </table>
        </td>
    </tr>
  `;

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden; }
        .header { background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT}; color: white; padding: 40px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 30px; letter-spacing: 2px; text-transform: uppercase; }
        .content { padding: 30px; }
        .booking-code-box { background-color: #f0f4ff; border: 2px dashed #667eea; padding: 25px; margin: 20px 0; border-radius: 10px; text-align: center; }
        .booking-code { font-size: 40px; font-weight: 800; color: #667eea; font-family: 'Courier New', monospace; letter-spacing: 5px; }
        .section-title { font-size: 13px; font-weight: 700; color: #4a5568; text-transform: uppercase; margin: 25px 0 15px; border-bottom: 2px solid #edf2f7; padding-bottom: 8px; }
        .footer { background-color: #f8f9fa; padding: 25px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header" style="background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT};">
            <h1>CINESPHERE</h1>
            <p style="margin-top: 5px; opacity: 0.9;">XÁC NHẬN ĐẶT VÉ THÀNH CÔNG</p>
        </div>
        <div class="content">
            <div style="font-size: 16px; color: #2d3748; margin-bottom: 20px;">
                Xin chào <strong>${data.customerName || 'Quý khách'}</strong>,<br>
                Đơn hàng của bạn đã được xác nhận. Vui lòng xuất trình mã vé dưới đây tại quầy soát vé.
            </div>
            
            <div class="booking-code-box">
                <div style="font-size: 12px; color: #718096; margin-bottom: 8px; font-weight: bold;">MÃ ĐẶT VÉ CỦA BẠN</div>
                <div class="booking-code">${data.bookingCode || 'KHÔNG RÕ'}</div>
            </div>

            ${data.moviePackagesTableHtml || ''}
            ${data.vrTableHtml || ''}
            ${moviesListHtml}

            <div class="section-title">Chi tiết đơn hàng</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">
                ${branchHtml}
                <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f7fafc; color: #718096; font-weight: 500;">Số lượng vé:</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f7fafc; text-align: right;">
                        <span style="background: #e0e7ff; color: #4338ca; padding: 3px 10px; border-radius: 4px; font-weight: 700; font-size: 13px;">${data.ticketCount || 0} VÉ</span>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f7fafc; color: #718096; font-weight: 500;">Loại vé:</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f7fafc; color: #4a5568; font-weight: 700; text-align: right;">${data.bookingType === 'combo_vr' ? 'Gói Combo Phim + VR' : data.bookingType === 'vr' ? 'Gói Giải trí VR' : 'Gói Vé Phim'}</td>
                </tr>
                ${priceSummaryHtml}
                ${expiryHtml}
            </table>

            ${data.expiryDate ? `
            <div style="background-color: #fff5f5; border-left: 4px solid #e53e3e; padding: 15px; margin-top: 30px; border-radius: 6px;">
                <p style="margin: 0; font-size: 13px; color: #c53030; line-height: 1.5;">
                    ⏳ <strong>Lưu ý quan trọng:</strong> Vé của bạn có thời hạn sử dụng giới hạn. Vượt quá <strong>Ngày hết hạn</strong> được ghi ở biên nhận, mã vé sẽ tự động bị huỷ quyền truy cập và không được hoàn tiền.
                </p>
            </div>
            ` : ''}

            <div style="background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 15px; margin-top: ${data.expiryDate ? '15px' : '30px'}; border-radius: 6px;">
                <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
                    🎫 <strong>Hướng dẫn:</strong> Vui lòng xuất trình mã đặt vé này cho nhân viên Cinesphere tại quầy để được xác nhận.
                </p>
            </div>
        </div>
        <div class="footer">
            <p><strong>CINESPHERE - TRẢI NGHIỆM ĐIỆN ẢNH VŨ TRỤ</strong></p>
            <p>Trụ sở: ${COMPANY_ADDRESS}</p>
            <p>Email: ${SUPPORT_EMAIL} | Hotline: ${hotline}</p>
            <p style="margin-top: 15px;">Đây là email tự động, vui lòng không trả lời.</p>
        </div>
    </div>
</body>
</html>`;
}

export function getResetPasswordEmailTemplate(link: string): string;
export function getResetPasswordEmailTemplate(baseUrl: string, link: string): string;
export function getResetPasswordEmailTemplate(arg1: string, arg2?: string): string {
  const link = arg2 || arg1;
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Đặt lại Mật khẩu - CINESPHERE</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background-color: ${BRAND_SOLID};
            background-image: ${BRAND_GRADIENT};
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header p {
            margin: 8px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
            color: #333;
        }
        .greeting {
            font-size: 16px;
            margin-bottom: 20px;
        }
        .btn-container {
            text-align: center;
            margin: 30px 0;
        }
        /* FIX: đổi màu button từ đỏ (#dc3545 - gây cảm giác "xoá/lỗi") sang màu brand thống nhất */
        .btn {
            display: inline-block;
            padding: 12px 28px;
            background-color: ${BRAND_SOLID};
            background-image: ${BRAND_GRADIENT};
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #eee;
        }
        .footer p {
            margin: 5px 0;
        }
        .note {
            font-size: 14px;
            color: #666;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header" style="background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT};">
            <h1>🎬 CINESPHERE</h1>
            <p>Yêu cầu Đặt lại Mật khẩu</p>
        </div>

        <div class="content">
            <div class="greeting">
                <p style="font-size: 16px; margin-top: 0;">Chào bạn,</p>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhấp vào nút dưới đây để tạo mật khẩu mới. Liên kết này sẽ hết hạn sau <strong>60 phút</strong>.</p>
            </div>

            <div class="btn-container">
                <!-- FIX: inline CSS đầy đủ trên thẻ <a> để không phụ thuộc <style> bị strip -->
                <a href="${link}" class="btn" style="display: inline-block; padding: 14px 34px; background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Đặt lại Mật khẩu</a>
            </div>

            <div class="note">
                <p>Nếu bạn không yêu cầu thay đổi mật khẩu, vui lòng bỏ qua email này hoặc liên hệ với bộ phận hỗ trợ qua email "${SUPPORT_EMAIL}" để được giúp đỡ.</p>
                <p>Trân trọng,<br>Đội ngũ CINESPHERE</p>
            </div>
        </div>

        <div class="footer">
            <p><strong>CINESPHERE - Rạp chiếu phim hiện đại</strong></p>
            <p>Trụ sở: ${COMPANY_ADDRESS}</p>
            <p>Email: ${SUPPORT_EMAIL} | Hotline: ${DEFAULT_HOTLINE}</p>
            <p style="margin-top: 15px; color: #999;">
                Đây là email tự động, vui lòng không trả lời email này.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

export function getWelcomeEmailTemplate(data: { customerName: string; email: string }, baseUrlStr?: string): string;
export function getWelcomeEmailTemplate(baseUrlStr: string, data: { customerName: string; email: string }): string;
export function getWelcomeEmailTemplate(arg1: any, arg2?: any): string {
  let data: { customerName: string; email: string };
  let baseUrlStr: string | undefined;

  if (typeof arg1 === 'string') {
    baseUrlStr = arg1;
    data = arg2;
  } else {
    data = arg1;
    baseUrlStr = arg2;
  }

  let baseUrl = baseUrlStr;
  if (!baseUrl && typeof process !== 'undefined' && process.env) {
    // FIX: bug — trước đây dùng VITE_SERVER_BASE_URL (trỏ về API/backend), khiến nút
    // "Đến Trang Chủ" dẫn khách tới URL API (JSON/404) thay vì giao diện web thật.
    baseUrl = process.env.VITE_CLIENT_BASE_URL;
  }
  if (!baseUrl) baseUrl = 'https://cinesphere.com.vn';

  const homeUrl = `${baseUrl}/`;
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chào mừng - CINESPHERE</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fb; margin:0; padding:0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); overflow: hidden; }
    .header { background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT}; color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.95; }
    .content { padding: 26px; color: #1f2937; }
    .greeting { font-size: 16px; margin-bottom: 14px; }
    .card { background: #f8f9fa; border: 1px solid #e5e7eb; border-left: 4px solid #667eea; border-radius: 8px; padding: 16px; margin: 14px 0; }
    .btn { display: inline-block; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .btn-primary { background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT}; color: white; }
    .footer { background-color: #f9fafb; padding: 18px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header" style="background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT};">
      <h1>CINESPHERE</h1>
      <p>Chào mừng đến CINESPHERE</p>
    </div>
    <div class="content">
      <div class="greeting">
        Xin chào <strong>${data.customerName || 'Quý khách'}</strong>,<br>
        Tài khoản của bạn đã được tạo thành công với email <strong>${data.email || 'của bạn'}</strong>.<br>
        Vui lòng truy cập trang web của chúng tôi để có thể trải nghiệm đầy đủ các chức năng sau khi đăng nhập.
      </div>
      <div class="card">
        <!-- FIX: đổi từ <div style="display:flex"> (vỡ trên Outlook) sang <table> -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; width: 40px; vertical-align: middle;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT}; width: 28px; height: 28px; border-radius: 8px; text-align: center; vertical-align: middle; color: #ffffff; font-size: 14px; font-weight: 700;">1</td>
              </tr></table>
            </td>
            <td style="padding: 10px 0 10px 12px; border-bottom: 1px dashed #e5e7eb; font-size: 14px; color: #1f2937; vertical-align: middle;">Đặt vé để trải nghiệm các bộ phim vũ trụ đa chiều</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px dashed #e5e7eb; width: 40px; vertical-align: middle;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT}; width: 28px; height: 28px; border-radius: 8px; text-align: center; vertical-align: middle; color: #ffffff; font-size: 14px; font-weight: 700;">2</td>
              </tr></table>
            </td>
            <td style="padding: 10px 0 10px 12px; border-bottom: 1px dashed #e5e7eb; font-size: 14px; color: #1f2937; vertical-align: middle;">Nhận những ưu đãi mới mỗi ngày</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; width: 40px; vertical-align: middle;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT}; width: 28px; height: 28px; border-radius: 8px; text-align: center; vertical-align: middle; color: #ffffff; font-size: 14px; font-weight: 700;">3</td>
              </tr></table>
            </td>
            <td style="padding: 10px 0 10px 12px; font-size: 14px; color: #1f2937; vertical-align: middle;">Dễ dàng theo dõi các vé đã đặt của bạn</td>
          </tr>
        </table>
      </div>
      <div style="text-align:center; margin-top: 20px; margin-bottom: 15px;">
        <a class="btn btn-primary" href="${homeUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT}; color: #ffffff;">Đến Trang Chủ Đặt Vé</a>
      </div>
      <div style="font-size: 13px; color: #6b7280; margin-top: 12px;">
        Cần hỗ trợ? Vui lòng liên hệ đội ngũ chăm sóc khách hàng của chúng tôi qua email: ${SUPPORT_EMAIL}.
      </div>
    </div>
    <div class="footer">
      CINESPHERE • Trụ sở: ${COMPANY_ADDRESS} • Email: ${SUPPORT_EMAIL} • Hotline: ${DEFAULT_HOTLINE}
    </div>
  </div>
</body>
</html>
  `;
}

export function getOTPEmailTemplate(data: {
  customerName: string;
  email: string;
  otp: string;
  expiryMinutes: number;
}): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã Xác Thực - CINESPHERE</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); overflow: hidden; }
    .header { background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT}; color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.95; }
    .content { padding: 30px; color: #1f2937; }
    .greeting { font-size: 16px; margin-bottom: 20px; }
    .otp-box { background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT}; border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0; }
    .otp-label { font-size: 13px; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 600; margin-bottom: 12px; letter-spacing: 1px; }
    .otp-value { font-size: 42px; font-weight: 800; color: #ffffff; font-family: monospace; letter-spacing: 8px; line-height: 1; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #856404; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header" style="background-color: ${BRAND_SOLID}; background-image: ${BRAND_GRADIENT};">
      <h1>🎬 CINESPHERE</h1>
      <p>Xác Thực 2 Lớp</p>
    </div>

    <div class="content">
      <div class="greeting">
        Xin chào <strong>${data.customerName || 'Quý khách'}</strong>,
      </div>

      <p style="font-size: 15px; line-height: 1.6;">
        Chúng tôi nhận được yêu cầu đăng nhập đối với tài khoản <strong>${data.email}</strong>. Để hoàn tất quá trình này, vui lòng nhập mã xác thực (OTP) sau:
      </p>

      <!-- FIX: inline background-color + background-image trực tiếp trên box để không phụ thuộc <style> -->
      <div class="otp-box" style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0;">
        <div class="otp-label" style="font-size: 13px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Mã Xác Thực (OTP)</div>
        <div class="otp-value" style="font-size: 42px; font-weight: 800; color: #1e293b; font-family: monospace; letter-spacing: 12px; line-height: 1; padding-left: 12px;">${data.otp}</div>
      </div>

      <div class="warning" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #856404;">
        ⚠️ <strong>Lưu ý quan trọng:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Mã này sẽ hết hạn sau <strong>${data.expiryMinutes} phút</strong></li>
          <li>Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên CINESPHERE</li>
          <li>Nếu bạn không yêu cầu đăng nhập, vui lòng bỏ qua email này</li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
        Cần hỗ trợ? Vui lòng liên hệ đội ngũ chăm sóc khách hàng của chúng tôi qua email: ${SUPPORT_EMAIL}
      </p>
    </div>

    <div class="footer">
      <p><strong>CINESPHERE - Rạp chiếu phim hiện đại</strong></p>
      <p>Trụ sở: ${COMPANY_ADDRESS}</p>
      <p>Email: ${SUPPORT_EMAIL} | Hotline: ${DEFAULT_HOTLINE}</p>
      <p style="margin-top: 10px; opacity: 0.7;">Đây là email tự động, vui lòng không trả lời email này.</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Shared mail layout for staff emails
function getStaffEmailLayout(content: string, subtitle: string): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CINESPHERE Admin System</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); overflow: hidden; }
    .header { background-color: #1e293b; background-image: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 26px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 1px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 28px; color: #334155; }
    .greeting { font-size: 15px; margin-bottom: 16px; color: #1e293b; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .password-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
    .password-label { font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .password-value { font-size: 32px; font-weight: 800; color: #0f172a; font-family: monospace; letter-spacing: 1px; line-height: 1; }
    .warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #92400e; }
    .footer { background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header" style="background-color: #1e293b; background-image: linear-gradient(135deg, #1e293b 0%, #334155 100%);">
      <h1>🎬 CINESPHERE ADMIN</h1>
      <p>${subtitle}</p>
    </div>

    <div class="content">
      ${content}
    </div>

    <div class="footer">
      <p><strong>CINESPHERE Admin Portal</strong> • Hệ thống quản trị nội bộ</p>
      <p style="margin-top: 6px; opacity: 0.8;">Đây là email tự động từ hệ thống quản trị, vui lòng không trả lời.</p>
    </div>
  </div>
</body>
</html>
  `;
}

// FIX: helper dùng chung để render 1 hàng "label: value" bằng <table> thay vì
// <div style="display:flex; justify-content:space-between">, tránh vỡ trên Outlook
function staffInfoRow(label: string, value: string): string {
  return `
    <tr>
        <td style="padding: 10px 10px 10px 0; border-bottom: 1px dashed #e2e8f0; color: #64748b; font-size: 13px; width: 60px;">${label}</td>
        <td style="padding: 10px 0; border-bottom: 1px dashed #e2e8f0; color: #0f172a; font-weight: 700; font-size: 14px;">${value}</td>
    </tr>`;
}

export function getStaffAccountCreatedTemplate(data: {
  staffName: string;
  email: string;
  password: string;
  loginUrl?: string;
}): string {
  const loginUrl = data.loginUrl || 'https://cinesphere.com.vn/login';

  const content = `
      <div class="greeting">
        Xin chào <strong>${data.staffName || 'Nhân viên'}</strong>,
      </div>

      <p style="font-size: 15px; line-height: 1.6;">
        Tài khoản nhân viên của bạn đã được tạo thành công. Dưới đây là thông tin đăng nhập của bạn:
      </p>

      <div class="info-box">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          ${staffInfoRow('Email:', data.email || '')}
        </table>
      </div>

      <div class="password-box" style="background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
        <div class="password-label" style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Mật khẩu của bạn</div>
        <div class="password-value" style="font-size: 28px; font-weight: 800; color: #0f172a; font-family: 'Segoe UI', Tahoma, Verdana, sans-serif; letter-spacing: 1px; line-height: 1; overflow-wrap: break-word; word-break: break-all;">${data.password}</div>
      </div>

      <div class="warning" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #92400e;">
        ⚠️ <strong>Lưu ý quan trọng:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên</li>
          <li>Không chia sẻ mật khẩu này với bất kỳ ai</li>
          <li>Truy cập <a href="${loginUrl}" style="color: #d97706; font-weight: 600; text-decoration: underline;">Trang Đăng Nhập Hệ Thống</a></li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
        Cần hỗ trợ? Vui lòng liên hệ quản trị viên hoặc đội ngũ hỗ trợ qua email: ${SUPPORT_EMAIL}
      </p>
  `;

  return getStaffEmailLayout(content, 'Tài khoản nhân viên mới');
}

export function getStaffPasswordResetTemplate(data: {
  staffName: string;
  email: string;
  newPassword: string;
  loginUrl?: string;
}): string {
  const loginUrl = data.loginUrl || 'https://cinesphere.com.vn/login';

  const content = `
      <div class="greeting">
        Xin chào <strong>${data.staffName || 'Nhân viên'}</strong>,
      </div>

      <p style="font-size: 15px; line-height: 1.6;">
        Mật khẩu của bạn đã được đặt lại. Dưới đây là thông tin đăng nhập mới:
      </p>

      <div class="info-box">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          ${staffInfoRow('Email:', data.email || '')}
        </table>
      </div>

      <div class="password-box" style="background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
        <div class="password-label" style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Mật khẩu mới của bạn</div>
        <div class="password-value" style="font-size: 28px; font-weight: 800; color: #0f172a; font-family: 'Segoe UI', Tahoma, Verdana, sans-serif; letter-spacing: 1px; line-height: 1; overflow-wrap: break-word; word-break: break-all;">${data.newPassword}</div>
      </div>

      <div class="warning" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #92400e;">
        ⚠️ <strong>Lưu ý quan trọng:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Vui lòng đổi mật khẩu ngay sau lần đăng nhập tiếp theo</li>
          <li>Không chia sẻ mật khẩu này với bất kỳ ai</li>
          <li>Truy cập <a href="${loginUrl}" style="color: #d97706; font-weight: 600; text-decoration: underline;">Trang Đăng Nhập Hệ Thống</a></li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
        Cần hỗ trợ? Vui lòng liên hệ quản trị viên hoặc đội ngũ hỗ trợ qua email: ${SUPPORT_EMAIL}
      </p>
  `;

  return getStaffEmailLayout(content, 'Đặt lại mật khẩu nhân viên');
}

export function getStaffPasswordChangeOTPTemplate(data: {
  staffName: string;
  email: string;
  otp: string;
  expiryMinutes: number;
}): string {
  const content = `
      <div class="greeting">
        Xin chào <strong>${data.staffName || 'Nhân viên'}</strong>,
      </div>

      <p style="font-size: 15px; line-height: 1.6;">
        Để tiếp tục quá trình bảo mật 2 lớp cho tài khoản <strong>${data.email}</strong>, vui lòng nhập mã xác thực (OTP) sau đây trên hệ thống:
      </p>

      <div class="password-box" style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0;">
        <div class="password-label" style="font-size: 13px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Mã Xác Thực (OTP)</div>
        <div class="password-value" style="font-size: 42px; font-weight: 800; color: #1e293b; font-family: monospace; letter-spacing: 12px; line-height: 1; padding-left: 12px;">${data.otp}</div>
      </div>

      <div class="warning" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #92400e;">
        ⚠️ <strong>Lưu ý quan trọng:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Mã này sẽ hết hạn sau <strong>${data.expiryMinutes} phút</strong></li>
          <li>Mã OTP là thông tin bảo mật, tuyệt đối không chia sẻ cho người khác</li>
          <li>Nếu bạn không thực hiện đổi mật khẩu, hệ thống có thể đang gặp rủi ro</li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
        Cần hỗ trợ? Vui lòng liên hệ quản trị viên hoặc đội ngũ hỗ trợ qua email: ${SUPPORT_EMAIL}
      </p>
  `;

  return getStaffEmailLayout(content, 'Xác thực thay đổi mật khẩu');
}

export function getStaffLoginOTPTemplate(data: { staffName?: string; email: string; otp: string; expiryMinutes: number }): string {
  const staffName = data.staffName || data.email;
  const content = `
      <div class="greeting">
        Xin chào <strong>${staffName}</strong>,
      </div>

      <p style="font-size: 15px; line-height: 1.6;">
        Một thiết bị đang cố gắng đăng nhập vào tài khoản Quản trị viên <strong>${data.email}</strong> của bạn.
        <br/><br/>
        Trạng thái Bảo Mật 2 Lớp (2FA) đang bật. Vui lòng sử dụng mã xác thực (OTP) bên dưới để hoàn tất đăng nhập:
      </p>

      <div class="password-box" style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0;">
        <div class="password-label" style="font-size: 13px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Mã Đăng Nhập (OTP)</div>
        <div class="password-value" style="font-size: 42px; font-weight: 800; color: #4338ca; font-family: monospace; letter-spacing: 12px; line-height: 1; padding-left: 12px;">${data.otp}</div>
      </div>

      <div class="warning" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #92400e;">
        ⚠️ <strong>Lưu ý quan trọng:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Mã này sẽ hết hạn sau <strong>${data.expiryMinutes} phút</strong></li>
          <li>Mã OTP là thông tin bảo mật, tuyệt đối không chia sẻ cho bất kỳ ai.</li>
          <li>Nếu bạn không phải là người đang cố đăng nhập, <strong>mật khẩu của bạn đã bị lộ!</strong> Vui lòng đổi mật khẩu ngay lập tức.</li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
        Hệ thống tự động phát hiện đăng nhập khả nghi? Liên hệ đội ngũ IT: ${SUPPORT_EMAIL}
      </p>
  `;

  return getStaffEmailLayout(content, 'Mã Xác Thực Bảo Mật (2FA)');
}
