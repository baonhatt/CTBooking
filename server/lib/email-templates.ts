export function getBookingEmailTemplate(data: {
        bookingCode: string;
        customerName: string;
        movieTitle: string; // Nhận chuỗi JSON: "["Phim A", "Phim B"]"
        ticketCount: number;
        totalPrice: string;
        durationMin?: string; // Nhận chuỗi JSON: "[10, 12, 5]"
        ticketPackageName?: string;
        expiryDate?: string | Date;
<<<<<<< HEAD
=======
        branchName?: string;
        branchAddress?: string;
        branchPhone?: string;
        branchSettings?: string;
>>>>>>> preview
}): string {
        // 1. XỬ LÝ DỮ LIỆU JSON TỪ API
        let movieTitles: string[] = [];
        let durations: string[] = [];
        try {
                movieTitles = JSON.parse(data.movieTitle || '[]');
                durations = JSON.parse(data.durationMin || '[]');
        } catch (e) {
                // Fallback nếu không phải JSON
                movieTitles = data.movieTitle ? [data.movieTitle] : ['Chưa xác định'];
                durations = data.durationMin ? [data.durationMin] : ['--'];
        }

<<<<<<< HEAD
=======
        // Parse branch settings for hotline
        let hotline = data.branchPhone || '1900-xxxx';
        if (data.branchSettings) {
                try {
                        const settings = JSON.parse(data.branchSettings);
                        if (settings.hotline) hotline = settings.hotline;
                } catch (e) { }
        }

>>>>>>> preview
        // 2. TẠO LIST PHIM THEO LAYOUT MỚI
        const moviesHtml = movieTitles
                .map(
                        (title, i) => `
    <div style="padding: 12px 0; border-bottom: 1px dashed #eee; display: flex; justify-content: space-between; align-items: center;">
      <span style="color: #333; font-weight: 600;">🎬 ${title}</span>
      <span style="color: #666; font-size: 12px; background: #f5f5f5; padding: 2px 8px; border-radius: 4px;">${durations[i] || '--'} ph</span>
    </div>
  `
                )
                .join('');

        return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; }
        .wrapper { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 26px; letter-spacing: 1px; }
        .content { padding: 30px; line-height: 1.6; color: #444; }
        .code-box { background: #f0f4ff; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code-label { font-size: 12px; color: #667eea; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; }
        .code-value { font-size: 36px; font-weight: 800; color: #764ba2; font-family: monospace; letter-spacing: 3px; }
        .section-title { font-size: 14px; font-weight: bold; color: #764ba2; text-transform: uppercase; border-bottom: 2px solid #764ba2; padding-bottom: 5px; margin-top: 25px; }
        .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
        .label { color: #888; }
        .value { font-weight: 600; color: #222; }
        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #888; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="header">
            <h1>🎬 CINESPHERE</h1>
            <p style="margin: 5px 0 0; opacity: 0.8;">Xác nhận đặt vé thành công</p>
        </div>

        <div class="content">
            <p>Xin chào <strong>${data.customerName}</strong>,</p>
            <p>Cảm ơn bạn đã đặt vé tại CINESPHERE. Vui lòng sử dụng mã đặt vé sau để check-in tại rạp.</p>

            <div class="code-box">
                <div class="code-label">MÃ ĐẶT VÉ CỦA BẠN</div>
                <div class="code-value">${data.bookingCode}</div>
                <p style="font-size: 11px; color: #999; margin: 10px 0 0;">(Vui lòng lưu lại mã này để soát vé tại quầy)</p>
            </div>

            <div class="section-title">THÔNG TIN PHIM</div>
            <div style="margin-bottom: 20px;">
                ${moviesHtml}
            </div>

            <div class="section-title">CHI TIẾT ĐƠN HÀNG</div>
<<<<<<< HEAD
=======
            ${data.branchName ? `
            <div class="row">
                <span class="label">Chi nhánh:</span>
                <span class="value">${data.branchName}</span>
            </div>
            <div class="row">
                <span class="label">Địa chỉ:</span>
                <span class="value" style="font-size: 12px;">${data.branchAddress || ''}</span>
            </div>
            ` : ''}
>>>>>>> preview
            <div class="row">
                <span class="label">Số lượng vé:</span>
                <span class="value">${data.ticketCount} vé</span>
            </div>
            <div class="row">
                <span class="label">Loại vé:</span>
                <span class="value">${data.ticketPackageName || 'Vé đơn'}</span>
            </div>
            <div class="row">
                <span class="label">Tổng tiền:</span>
                <span class="value" style="color: #e63946;">${data.totalPrice}đ</span>
            </div>
            <div class="row">
                <span class="label">Ngày hết hạn:</span>
                <span class="value">${(function () {
                        try {
                                const d = new Date(String(data.expiryDate));
                                return (
                                        d.getDate().toString().padStart(2, '0') +
                                        '/' +
                                        (d.getMonth() + 1).toString().padStart(2, '0') +
                                        '/' +
                                        d.getFullYear() +
                                        ' ' +
                                        d.getHours().toString().padStart(2, '0') +
                                        ':' +
                                        d.getMinutes().toString().padStart(2, '0')
                                );
                        } catch {
                                return String(data.expiryDate);
                        }
                })()}</span>
            </div>

            <div style="background: #fff3cd; color: #856404; padding: 12px; border-radius: 4px; margin-top: 25px; font-size: 13px;">
                ⏰ <strong>Lưu ý:</strong> Mang theo mã đặt vé để nhân viên xác nhận.
            </div>
        </div>

        <div class="footer">
            <p><strong>CINESPHERE - Rạp chiếu phim hiện đại</strong></p>
<<<<<<< HEAD
            <p>Email: cinesphere0629@gmail.com | Hotline: 1900-xxxx</p>
=======
            <p>Email: cinesphere0629@gmail.com | Hotline: ${hotline}</p>
>>>>>>> preview
            <p style="margin-top: 10px; opacity: 0.6;">Đây là email tự động, vui lòng không trả lời email này.</p>
        </div>
    </div>
</body>
</html>
  `;
}

export function getResetPasswordEmailTemplate(link: string): string {
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
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background-color: #dc3545;
            color: white;
            text-decoration: none;
            border-radius: 4px;
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
        <div class="header">
            <h1>🎬 CINESPHERE</h1>
            <p>Yêu cầu Đặt lại Mật khẩu</p>
        </div>

        <div class="content">
            <div class="greeting">
                <h2 style="color: #007bff; margin-top: 0;">Yêu cầu Đặt lại Mật khẩu</h2>
                <p>Chào bạn,</p>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhấp vào nút dưới đây để tạo mật khẩu mới. Liên kết này sẽ hết hạn sau <strong>60 phút</strong>.</p>
            </div>

            <div class="btn-container">
                <a href="${link}" class="btn">Đặt lại Mật khẩu</a>
            </div>

            <div class="note">
                <p>Nếu bạn không yêu cầu thay đổi mật khẩu, vui lòng bỏ qua email này hoặc liên hệ với bộ phận hỗ trợ qua email "cinesphere0629@gmail.com" để được giúp đỡ.</p>
                <p>Trân trọng,<br>Đội ngũ Cinema App</p>
            </div>
        </div>

        <div class="footer">
            <p><strong>CINESPHERE - Rạp chiếu phim hiện đại</strong></p>
            <p>Email: cinesphere0629@gmail.com | Hotline: 1900-xxxx</p>
            <p style="margin-top: 15px; color: #999;">
                Đây là email tự động, vui lòng không trả lời email này.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

export function getWelcomeEmailTemplate(
        data: {
                customerName: string;
                email: string;
        },
        baseUrlStr?: string
): string {
        // Use provided baseUrl or fallback to env or default
        let baseUrl = baseUrlStr;
        if (!baseUrl && typeof process !== 'undefined' && process.env) {
                baseUrl = process.env.VITE_SERVER_BASE_URL;
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
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.95; }
    .content { padding: 26px; color: #1f2937; }
    .greeting { font-size: 16px; margin-bottom: 14px; }
    .card { background: #f8f9fa; border: 1px solid #e5e7eb; border-left: 4px solid #667eea; border-radius: 8px; padding: 16px; margin: 14px 0; }
    .steps { margin: 10px 0; }
    .step { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px dashed #e5e7eb; }
    .step:last-child { border-bottom: none; }
    .step-number { background: #667eea; color: white; width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; line-height: 28px; flex-shrink: 0; }
    .btn { display: inline-block; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .btn-secondary { background: #f3f4f6; color: #111827; border: 1px solid #e5e7eb; }
    .footer { background-color: #f9fafb; padding: 18px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CINESPHERE</h1>
      <p>Chào mừng đến CINESPHERE</p>
    </div>
    <div class="content">
      <div class="greeting">
        Xin chào <strong>${data.customerName}</strong>,<br>
        Tài khoản của bạn đã được tạo thành công với email <strong>${data.email}</strong>.<br>
        Vui lòng truy cập trang web của chúng tôi để có thể trải nghiệm đầy đủ các chức năng sau khi đăng nhập.
      </div>
      <div class="card">
        <div class="steps">
          <div class="step">
            <div class="step-number">1</div>
            <div>Đặt vé để trải nghiệm các bộ phim vũ trụ đa chiều</div>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <div>Nhận những ưu đãi mới mỗi ngày</div>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <div>Dễ dàng theo dõi các vé đã đặt của bạn</div>
          </div>
        </div>
      </div>
      <div style="text-align:center; margin-top: 10px;">
        <a class="btn btn-primary" href="${homeUrl}" target="_blank">Đến Trang Chủ</a>
      </div>
      <div style="font-size: 13px; color: #6b7280; margin-top: 12px;">
        Cần hỗ trợ? Vui lòng liên hệ đội ngũ chăm sóc khách hàng của chúng tôi qua email: cinesphere0629@gmail.com.
      </div>
    </div>
    <div class="footer">
      CINESPHERE • Email: cinesphere0629@gmail.com • Hotline: 1900-xxxx
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
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.95; }
    .content { padding: 30px; color: #1f2937; }
    .greeting { font-size: 16px; margin-bottom: 20px; }
    .otp-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0; }
    .otp-label { font-size: 13px; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 600; margin-bottom: 12px; letter-spacing: 1px; }
    .otp-value { font-size: 42px; font-weight: 800; color: #ffffff; font-family: monospace; letter-spacing: 8px; line-height: 1; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #856404; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎬 CINESPHERE</h1>
      <p>Xác Thực 2 Lớp</p>
    </div>

    <div class="content">
      <div class="greeting">
        Xin chào <strong>${data.customerName}</strong>,
      </div>

      <p style="font-size: 15px; line-height: 1.6;">
        Chúng tôi nhận được yêu cầu đăng nhập vào tài khoản của bạn. Để hoàn tất đăng nhập, vui lòng nhập mã xác thực sau:
      </p>

      <div class="otp-box">
        <div class="otp-label">Mã Xác Thực (OTP)</div>
        <div class="otp-value">${data.otp}</div>
      </div>

      <div class="warning">
        ⚠️ <strong>Lưu ý quan trọng:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Mã này sẽ hết hạn sau <strong>${data.expiryMinutes} phút</strong></li>
          <li>Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên CINESPHERE</li>
          <li>Nếu bạn không yêu cầu đăng nhập, vui lòng bỏ qua email này</li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
        Cần hỗ trợ? Vui lòng liên hệ đội ngũ chăm sóc khách hàng của chúng tôi qua email: cinesphere0629@gmail.com
      </p>
    </div>

    <div class="footer">
      <p><strong>CINESPHERE - Rạp chiếu phim hiện đại</strong></p>
      <p>Email: cinesphere0629@gmail.com | Hotline: 1900-xxxx</p>
      <p style="margin-top: 10px; opacity: 0.7;">Đây là email tự động, vui lòng không trả lời email này.</p>
    </div>
  </div>
</body>
</html>
  `;
}
<<<<<<< HEAD
=======

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
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 26px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 1px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 28px; color: #334155; }
    .greeting { font-size: 15px; margin-bottom: 16px; color: #1e293b; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; font-size: 13px; }
    .info-value { font-weight: 600; color: #0f172a; font-size: 13px; }
    .password-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
    .password-label { font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .password-value { font-size: 32px; font-weight: 800; color: #0f172a; font-family: monospace; letter-spacing: 4px; line-height: 1; }
    .warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #92400e; }
    .footer { background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
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

export function getStaffAccountCreatedTemplate(data: {
        staffName: string;
        email: string;
        password: string;
        loginUrl?: string;
}): string {
        const loginUrl = data.loginUrl || 'https://cinesphere.com.vn/admin/login';

        const content = `
      <div class="greeting">
        Xin chào <strong>${data.staffName}</strong>,
      </div>

      <p style="font-size: 15px; line-height: 1.6;">
        Tài khoản nhân viên của bạn đã được tạo thành công. Dưới đây là thông tin đăng nhập của bạn:
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${data.email}</span>
        </div>
      </div>

      <div class="password-box">
        <div class="password-label">Mật khẩu của bạn</div>
        <div class="password-value">${data.password}</div>
      </div>

      <div class="warning">
        ⚠️ <strong>Lưu ý quan trọng:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên</li>
          <li>Không chia sẻ mật khẩu này với bất kỳ ai</li>
          <li>Đăng nhập tại: <a href="${loginUrl}" style="color: #667eea;">${loginUrl}</a></li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
        Cần hỗ trợ? Vui lòng liên hệ quản trị viên hoặc đội ngũ hỗ trợ qua email: cinesphere0629@gmail.com
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
        const loginUrl = data.loginUrl || 'https://cinesphere.com.vn/admin/login';

        const content = `
      <div class="greeting">
        Xin chào <strong>${data.staffName}</strong>,
      </div>

      <p style="font-size: 15px; line-height: 1.6;">
        Mật khẩu của bạn đã được đặt lại. Dưới đây là thông tin đăng nhập mới:
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${data.email}</span>
        </div>
      </div>

      <div class="password-box">
        <div class="password-label">Mật khẩu mới của bạn</div>
        <div class="password-value">${data.newPassword}</div>
      </div>

      <div class="warning">
        ⚠️ <strong>Lưu ý quan trọng:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Vui lòng đổi mật khẩu ngay sau lần đăng nhập tiếp theo</li>
          <li>Không chia sẻ mật khẩu này với bất kỳ ai</li>
          <li>Đăng nhập tại: <a href="${loginUrl}" style="color: #667eea;">${loginUrl}</a></li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
        Cần hỗ trợ? Vui lòng liên hệ quản trị viên hoặc đội ngũ hỗ trợ qua email: cinesphere0629@gmail.com
      </p>
  `;

        return getStaffEmailLayout(content, 'Đặt lại mật khẩu nhân viên');
}

export function getStaffPasswordChangeOTPTemplate(data: {
        staffName: string;
        otp: string;
        expiryMinutes: number;
}): string {
        const content = `
      <div class="greeting">
        Xin chào <strong>${data.staffName}</strong>,
      </div>

      <p style="font-size: 15px; line-height: 1.6;">
        Chúng tôi nhận được yêu cầu thay đổi mật khẩu cho tài khoản của bạn. Để hoàn tất thay đổi, vui lòng nhập mã xác thực sau:
      </p>

      <div class="password-box">
        <div class="password-label">Mã Xác Thực (OTP)</div>
        <div class="password-value">${data.otp}</div>
      </div>

      <div class="warning">
        ⚠️ <strong>Lưu ý quan trọng:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Mã này sẽ hết hạn sau <strong>${data.expiryMinutes} phút</strong></li>
          <li>Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên CINESPHERE</li>
          <li>Nếu bạn không yêu cầu thay đổi mật khẩu, vui lòng bỏ qua email này</li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
        Cần hỗ trợ? Vui lòng liên hệ quản trị viên hoặc đội ngũ hỗ trợ qua email: cinesphere0629@gmail.com
      </p>
  `;

        return getStaffEmailLayout(content, 'Xác thực thay đổi mật khẩu');
}
>>>>>>> preview
