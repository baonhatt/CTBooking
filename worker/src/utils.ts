import { Context } from "hono";

export const RL_MAX = 100;
export const RL_WINDOW_MS = 60_000;
export const attempts = new Map<string, number[]>();

export async function hmacHex(algo: "SHA-256" | "SHA-512", key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: algo }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  const bytes = new Uint8Array(signature as ArrayBuffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function logSystemError(context: string, error: any, payload?: any) {
  const timestamp = new Date().toISOString();
  const errorMsg = error?.message || String(error);
  const stack = error?.stack || "No stack trace";
  const safePayload = payload ? { ...payload } : "No payload";
  
  // Mask sensitive fields
  if (typeof safePayload === "object" && safePayload !== null) {
    if ("password" in safePayload) safePayload.password = "***";
    if ("token" in safePayload) safePayload.token = "***";
  }

  console.error(`[${timestamp}] [ERROR] [${context}]`);
  console.error(`Message: ${errorMsg}`);
  console.error(`Stack: ${stack}`);
  console.error(`Payload:`, JSON.stringify(safePayload, null, 2));
}

export async function sendMail(env: any, toEmail: string, subject: string, html: string): Promise<{ ok: boolean; status: number; body: string; provider: string; missing: string[] }> {
  const brevoKey = String(env.BREVO_API_KEY || "");
  const useBrevo = Boolean(brevoKey);
  if (useBrevo) {
    const senderEmailBrevo = String(env.BREVO_SENDER_EMAIL || "");
    const senderNameBrevo = String(env.BREVO_SENDER_NAME || "");
    const senderEmailFallback = String(env.GMAIL_SENDER_EMAIL || "no-reply@example.com");
    const senderNameFallback = String(env.GMAIL_SENDER_NAME || "CTBOOKING");
    const missing: string[] = [];
    if (!brevoKey) missing.push("BREVO_API_KEY");
    if (!senderEmailBrevo) missing.push("BREVO_SENDER_EMAIL");
    if (!senderNameBrevo) missing.push("BREVO_SENDER_NAME");
    const senderEmail = senderEmailBrevo || senderEmailFallback;
    const senderName = senderNameBrevo || senderNameFallback;
    const payload = {
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail }],
      subject,
      htmlContent: html,
    };
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": brevoKey },
      body: JSON.stringify(payload),
    });
    const bodyText = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, body: bodyText, provider: "brevo", missing };
  } else {
    const fromEmail = String(env.GMAIL_SENDER_EMAIL || env.GMAIL_USER || "no-reply@example.com");
    const fromName = String(env.GMAIL_SENDER_NAME || "CTBOOKING");
    const missing: string[] = [];
    if (!String(env.GMAIL_SENDER_EMAIL || env.GMAIL_USER || "")) missing.push("GMAIL_SENDER_EMAIL");
    if (!String(env.GMAIL_SENDER_NAME || "")) missing.push("GMAIL_SENDER_NAME");
    const payload = {
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [{ type: "text/html", value: html }],
    };
    const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const bodyText = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, body: bodyText, provider: "mailchannels", missing };
  }
}

export function formatCurrencyVi(amount: number): string {
  return `${Number(amount || 0).toLocaleString("vi-VN")}đ`;
}

export function getBookingEmailTemplate(baseUrl: string, data: {
  bookingCode: string;
  customerName: string;
  movieTitle: string;
  ticketCount: number;
  totalPrice: string;
  movieImage?: string;
  durationMin?: number | string;
  ticketPackageName?: string;
  expiryDate?: string | Date | null;
}): string {
  const imgSrc = data.movieImage?.startsWith("http") ? data.movieImage : `${baseUrl}${data.movieImage}`;
  // const imgHtml = data.movieImage ? `<img src="${imgSrc}" alt="${data.movieTitle}" class="movie-poster">` : "";
  const durationHtml = data.durationMin !== undefined && data.durationMin !== null ? `
                <div class="detail-row">
                    <span class="detail-label">Thời lượng:&nbsp;</span>
                    <span class="detail-value">${data.durationMin} phút</span>
                </div>` : ``;
  const pkgHtml = data.ticketPackageName ? `
              <div class="detail-row">
                  <span class="detail-label">Loại vé:&nbsp;</span>
                  <span class="detail-value">${data.ticketPackageName}</span>
              </div>` : ``;
  const expiryHtml = data.expiryDate ? `
              <div class="detail-row">
                  <span class="detail-label">Ngày hết hạn:&nbsp;</span>
                  <span class="detail-value">${(() => { try { const d = new Date(String(data.expiryDate)); const dd = String(d.getDate()).padStart(2,"0"); const mm = String(d.getMonth()+1).padStart(2,"0"); const yyyy = d.getFullYear(); const hh = String(d.getHours()).padStart(2,"0"); const mi = String(d.getMinutes()).padStart(2,"0"); return dd+"/"+mm+"/"+yyyy+" "+hh+":"+mi; } catch { return String(data.expiryDate); } })()}</span>
              </div>` : ``;
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xác nhận đặt vé - CINESPHERE</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 30px; }
        .greeting { font-size: 16px; color: #333; margin-bottom: 20px; }
        .booking-code-box { background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .booking-code-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .booking-code { font-size: 32px; font-weight: 700; color: #667eea; font-family: 'Courier New', monospace; letter-spacing: 2px; }
        .details-section { margin: 25px 0; }
        .section-title { font-size: 14px; font-weight: 600; color: #333; text-transform: uppercase; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 8px; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #666; font-weight: 500; }
        .detail-value { color: #333; font-weight: 600; }
        .price-highlight { color: #27ae60; font-size: 18px; }
        .movie-poster { width: 100%; max-width: 200px; margin: 15px auto; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        .footer p { margin: 5px 0; }
        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 15px 0; border-radius: 4px; font-size: 13px; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 CINESPHERE</h1>
            <p>Xác nhận đặt vé thành công</p>
        </div>
        <div class="content">
            <div class="greeting">
                Xin chào <strong>${data.customerName}</strong>,<br>
                Cảm ơn bạn đã đặt vé tại CINESPHERE. Vui lòng sử dụng mã đặt vé sau để check-in tại rạp.
            </div>
            <div class="booking-code-box">
                <div class="booking-code-label">Mã đặt vé của bạn</div>
                <div class="booking-code">${data.bookingCode}</div>
                <div style="font-size: 12px; color: #999; margin-top: 10px;">Vui lòng lưu lại mã này để check-in tại rạp</div>
            </div>
            <div class="details-section">
                <div class="section-title">Thông tin phim</div>
                <div class="detail-row">
                    <span class="detail-label">Tên phim:&nbsp;</span>
                    <span class="detail-value">${data.movieTitle}</span>
                </div>
                ${durationHtml}
            </div>
            <div class="details-section">
              <div class="section-title">Chi tiết đơn hàng</div>
              <div class="detail-row">
                  <span class="detail-label">Số lượng vé:&nbsp;</span>
                  <span class="detail-value">${data.ticketCount} vé</span>
              </div>
              ${pkgHtml}
              <div class="detail-row">
                  <span class="detail-label">Tổng tiền:&nbsp;</span>
                  <span class="detail-value">${data.totalPrice}</span>
              </div>
              ${expiryHtml}
            </div>
            <div class="warning">⏰ <strong>Lưu ý:</strong> Mang theo mã đặt vé để nhân viên xác nhận.</div>
        </div>
        <div class="footer">
            <p><strong>CINESPHERE - Rạp chiếu phim hiện đại</strong></p>
            <p>Email: cinesphere0629@gmail.com | Hotline: 1900-xxxx</p>
            <p style="margin-top: 15px; color: #999;">Đây là email tự động, vui lòng không trả lời email này.</p>
        </div>
    </div>
</body>
</html>
  `;
}

export function getWelcomeEmailTemplate(baseUrl: string, data: { customerName: string; email: string }): string {
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
          <div class="step"><div class="step-number">1</div><div>Đặt vé để trải nghiệm các bộ phim vũ trụ đa chiều</div></div>
          <div class="step"><div class="step-number">2</div><div>Nhận những ưu đãi mới mỗi ngày</div></div>
          <div class="step"><div class="step-number">3</div><div>Dễ dàng theo dõi các vé đã đặt của bạn</div></div>
        </div>
      </div>
      <div style="text-align:center; margin-top: 10px;">
        <a class="btn btn-primary" href="${homeUrl}" target="_blank">Đến Trang Chủ</a>
      </div>
      <div style="font-size: 13px; color: #6b7280; margin-top: 12px;">
        Cần hỗ trợ? Vui lòng liên hệ đội ngũ chăm sóc khách hàng của chúng tôi qua email: cinesphere0629@gmail.com.
      </div>
    </div>
    <div class="footer">CINESPHERE • Email: cinesphere0629@gmail.com • Hotline: 1900-xxxx</div>
  </div>
</body>
</html>
  `;
}

export function getResetPasswordEmailTemplate(baseUrl: string, link: string): string {
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

export async function sha1Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-1", enc.encode(input));
  const bytes = new Uint8Array(buf as ArrayBuffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hasCloudinary(env: any) {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || "");
  const apiKey = String(env.CLOUDINARY_API_KEY || "");
  const apiSecret = String(env.CLOUDINARY_API_SECRET || "");
  return Boolean(cloudName && apiKey && apiSecret);
}

export async function cloudinarySignedParams(env: any, params: Record<string, string | number>) {
  const apiKey = String(env.CLOUDINARY_API_KEY || "");
  const apiSecret = String(env.CLOUDINARY_API_SECRET || "");
  const keys = Object.keys(params).sort();
  const toSign = keys.map((k) => `${k}=${params[k]}`).join("&") + apiSecret;
  const signature = await sha1Hex(toSign);
  return { signature, api_key: apiKey };
}

export function optimizeCloudinaryUrl(url: string, width?: number) {
  if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) return url;
  const parts = url.split("/upload/");
  if (parts.length !== 2) return url;
  const transformations = ["f_auto", "q_auto"];
  if (width) transformations.push(`w_${width}`);
  const transformString = transformations.join(",");
  return `${parts[0]}/upload/${transformString}/${parts[1]}`;
}

export async function uploadCloudinaryImageDataURI(env: any, dataUri: string, folder: string) {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || "");
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    timestamp,
    folder,
    use_filename: "true",
    unique_filename: "false",
    overwrite: "true",
    transformation: "q_auto,f_webp,w_1280,c_limit",
  };
  const signed = await cloudinarySignedParams(env, params);
  const form = new FormData();
  form.append("file", dataUri);
  form.append("folder", folder);
  form.append("use_filename", "true");
  form.append("unique_filename", "false");
  form.append("overwrite", "true");
  form.append("timestamp", String(timestamp));
  form.append("api_key", signed.api_key);
  form.append("signature", signed.signature);
  form.append("transformation", "q_auto,f_webp,w_1280,c_limit");
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const res = await fetch(endpoint, { method: "POST", body: form });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(json?.error?.message || `Cloudinary ${res.status}`));
  return {
    url: String(json.secure_url || json.url || ""),
    width: Number(json.width || 0),
    height: Number(json.height || 0),
  };
}
