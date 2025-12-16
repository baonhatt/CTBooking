import bcrypt from "bcryptjs";

const attempts = new Map<string, number[]>();
const RL_MAX = 5;
const RL_WINDOW_MS = 60_000;

async function hmacHex(algo: "SHA-256" | "SHA-512", key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: algo }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  const bytes = new Uint8Array(signature as ArrayBuffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Gửi email qua Brevo hoặc MailChannels tùy theo biến môi trường
 * - Ưu tiên Brevo nếu có `BREVO_API_KEY`
 * - Fallback MailChannels khi không có Brevo
 */
async function sendMail(env: any, toEmail: string, subject: string, html: string): Promise<{ ok: boolean; status: number; body: string; provider: string; missing: string[] }> {
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

function formatCurrencyVi(amount: number): string {
  return `${Number(amount || 0).toLocaleString("vi-VN")}đ`;
}

function getBookingEmailTemplate(baseUrl: string, data: {
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
  const imgHtml = data.movieImage ? `<img src="${imgSrc}" alt="${data.movieTitle}" class="movie-poster">` : "";
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
            ${imgHtml}
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
            <p>Email: support@cinesphere.com | Hotline: 1900-xxxx</p>
            <p style="margin-top: 15px; color: #999;">Đây là email tự động, vui lòng không trả lời email này.</p>
        </div>
    </div>
</body>
</html>
  `;
}

function getWelcomeEmailTemplate(baseUrl: string, data: { customerName: string; email: string }): string {
  const accountUrl = `${baseUrl}/account`;
  const bookingUrl = `${baseUrl}/booking`;
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
        Cần hỗ trợ? Vui lòng liên hệ đội ngũ chăm sóc khách hàng của chúng tôi.
      </div>
    </div>
    <div class="footer">CINESPHERE • Email: support@cinesphere.com • Hotline: 1900-xxxx</div>
  </div>
</body>
</html>
  `;
}

function getResetPasswordEmailTemplate(baseUrl: string, link: string): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đặt lại mật khẩu - CINESPHERE</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fb; margin:0; padding:0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 26px; color: #1f2937; }
    .greeting { font-size: 16px; margin-bottom: 14px; }
    .card { background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 8px; padding: 16px; margin: 14px 0; color: #856404; }
    .btn { display: inline-block; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .footer { background-color: #f9fafb; padding: 18px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>CINESPHERE</h1></div>
    <div class="content">
      <div class="greeting">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</div>
      <div class="card">Liên kết sẽ hết hạn sau 1 giờ.</div>
      <div style="text-align:center;margin:20px 0;"><a class="btn btn-primary" href="${link}" target="_blank">Đặt lại Mật khẩu</a></div>
      <div style="font-size: 13px; color: #6b7280; margin-top: 12px;">Nếu bạn không yêu cầu thay đổi mật khẩu, vui lòng bỏ qua email này.</div>
    </div>
    <div class="footer">CINESPHERE • Email: support@cinesphere.com • Hotline: 1900-xxxx</div>
  </div>
</body>
</html>
  `;
}

/**
 * Tạo SHA-1 hex cho chuỗi đầu vào
 * Dùng để ký request Cloudinary (legacy signature)
 */
async function sha1Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-1", enc.encode(input));
  const bytes = new Uint8Array(buf as ArrayBuffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Kiểm tra cấu hình Cloudinary bắt buộc
 */
function hasCloudinary(env: any) {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || "");
  const apiKey = String(env.CLOUDINARY_API_KEY || "");
  const apiSecret = String(env.CLOUDINARY_API_SECRET || "");
  return Boolean(cloudName && apiKey && apiSecret);
}

/**
 * Ký tham số upload Cloudinary theo chuẩn `api_sign_request`
 */
async function cloudinarySignedParams(env: any, params: Record<string, string | number>) {
  const apiKey = String(env.CLOUDINARY_API_KEY || "");
  const apiSecret = String(env.CLOUDINARY_API_SECRET || "");
  const keys = Object.keys(params).sort();
  const toSign = keys.map((k) => `${k}=${params[k]}`).join("&") + apiSecret;
  const signature = await sha1Hex(toSign);
  return { signature, api_key: apiKey };
}

/**
 * Upload ảnh base64 (data URI) lên Cloudinary với transform giống Express:
 * - `q_auto`, `f_webp`, `w_1280`, `c_limit`
 * Trả về URL an toàn (secure_url) và kích thước
 */
async function uploadCloudinaryImageDataURI(env: any, dataUri: string, folder: string) {
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
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(json?.error?.message || `Cloudinary ${res.status}`));
  return {
    url: String(json.secure_url || json.url || ""),
    width: Number(json.width || 0),
    height: Number(json.height || 0),
  };
}

export default {
  async fetch(request: Request, env: any) {
    const origin = request.headers.get("Origin") || "";
    const allowed = new Set([
      "https://cinesphere.com.vn",
      "https://www.cinesphere.com.vn",
      "https://cinema-pages.pages.dev",
    ]);
    const allowOrigin = origin && allowed.has(origin) ? origin : "https://cinesphere.com.vn";
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        request.headers.get("Access-Control-Request-Headers") ||
        "Content-Type,Authorization,Accept,Origin,Referer",
      "Access-Control-Expose-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    } as Record<string, string>;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const r2Base = String(env.R2_PUBLIC_BASE || "");
    const r2Enabled = String(env.R2_PUBLIC_ENABLED || "").toLowerCase() === "true";
    const json = (data: any, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...cors } });
    const notFound = () => new Response("Not found", { status: 404, headers: cors });
    const badRequest = (message = "Bad Request") => json({ message }, 400);
    const methodNotAllowed = () => json({ message: "Method Not Allowed" }, 405);
    const noStoreHeaders = { ...cors, "Cache-Control": "no-store" };
    const rlKey = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateLimitCheck = (max = RL_MAX, windowMs = RL_WINDOW_MS) => {
      const now = Date.now();
      const list = attempts.get(rlKey) ?? [];
      const filtered = list.filter((ts) => now - ts < windowMs);
      if (filtered.length >= max) {
        return { ok: false, remaining: 0, windowMs };
      }
      filtered.push(now);
      attempts.set(rlKey, filtered);
      const remaining = Math.max(0, max - filtered.length);
      return { ok: true, remaining, windowMs };
    };
    if (url.pathname === "/") return json({ ok: true, service: "cinema-worker", time: Date.now() });
    if (url.pathname === "/api/ping" && request.method === "GET") return json({ message: "ping" });
    if (url.pathname === "/api/admin/cloudinary/sign" && request.method === "POST") {
      try {
        if (!hasCloudinary(env)) return json({ message: "Thiếu cấu hình Cloudinary" }, 400);
        const body = await request.json().catch(() => null);
        const folder = String(body?.folder || "");
        const resourceType = String(body?.resource_type || "");
        if (!folder || !resourceType) return json({ message: "Thiếu tham số cần thiết" }, 400);
        const timestamp = Math.floor(Date.now() / 1000);
        const params = {
          timestamp,
          folder,
          use_filename: "true",
          unique_filename: "false",
          overwrite: "true",
        } as Record<string, string | number>;
        const signed = await cloudinarySignedParams(env, params);
        return json({ timestamp, signature: signed.signature, api_key: signed.api_key });
      } catch (err: any) {
        return json({ message: String(err?.message || "Internal error") }, 500);
      }
    }
    if (url.pathname === "/api/users/profile" && request.method === "GET") {
      const email = url.searchParams.get("email");
      if (!email) return badRequest("Thiếu email");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(String(email)).first();
      if (!acc) return json({ message: "Không tìm thấy tài khoản" }, 404);
      const user = await env.cinema_db.prepare(`SELECT * FROM users WHERE id = ?`).bind(Number((acc as any).user_id)).first();
      return json({
        id: user?.id ?? Number((acc as any).user_id),
        fullname: user?.fullname ?? "N/A",
        phone: user?.phone ?? "N/A",
        gender: user?.gender ?? null,
        dob: user?.dob ?? null,
        email: String(email),
        is_active: Boolean((acc as any)?.is_active ?? true),
        login_type: (acc as any)?.login_type || "email",
        user_created_at: user?.created_at ?? null,
        user_updated_at: user?.updated_at ?? null,
        account_created_at: (acc as any)?.created_at ?? null,
      });
    }
    if (url.pathname === "/api/admin/uploads/video" && request.method === "POST") {
      try {
        const form = await request.formData();
        const file = form.get("file") as File | null;
        if (!file) return json({ message: "Thiếu tệp video" }, 400);
        const mime = String(file.type || "application/octet-stream").toLowerCase();
        if (!mime.startsWith("video/")) return json({ message: "Chỉ chấp nhận tệp video" }, 400);
        if (hasCloudinary(env)) {
          const cloudName = String(env.CLOUDINARY_CLOUD_NAME || "");
          const timestamp = Math.floor(Date.now() / 1000);
          const folder = String(env.CLOUDINARY_UPLOAD_FOLDER || "ctbooking/videos");
          const params = {
            timestamp,
            folder,
            use_filename: "true",
            unique_filename: "false",
            overwrite: "true",
            eager: "q_auto,w_1280,h_720,c_limit,f_mp4,vc_h264",
            eager_async: "true",
          };
          const signed = await cloudinarySignedParams(env, params);
          const cf = new FormData();
          cf.append("file", file);
          cf.append("folder", folder);
          cf.append("use_filename", "true");
          cf.append("unique_filename", "false");
          cf.append("overwrite", "true");
          cf.append("timestamp", String(timestamp));
          cf.append("api_key", signed.api_key);
          cf.append("signature", signed.signature);
          cf.append("eager", "q_auto,w_1280,h_720,c_limit,f_mp4,vc_h264");
          cf.append("eager_async", "true");
          const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
          const resp = await fetch(endpoint, { method: "POST", body: cf });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) return json({ message: String(data?.error?.message || `Cloudinary ${resp.status}`) }, 500);
          return json({
            public_id: String(data.public_id || ""),
            url: String(data.secure_url || data.url || ""),
            bytes: Number(data.bytes || file.size || 0),
            duration: typeof data.duration === "number" ? data.duration : undefined,
            format: String(data.format || ""),
            width: typeof data.width === "number" ? data.width : undefined,
            height: typeof data.height === "number" ? data.height : undefined,
          });
        }
        if (!env.r2_cinemastore) return json({ message: "Thiếu R2 bucket hoặc Cloudinary" }, 500);
        const ext = (() => {
          const e = (file.name || "").split(".").pop()?.toLowerCase() || "";
          if (e) return e;
          if (mime.includes("mp4")) return "mp4";
          if (mime.includes("webm")) return "webm";
          if (mime.includes("mov")) return "mov";
          return "bin";
        })();
        const key = `uploads/videos/video_${Date.now()}.${ext}`;
        const arr = new Uint8Array(await file.arrayBuffer());
        await env.r2_cinemastore.put(key, arr, { httpMetadata: { contentType: mime } });
        return json({
          public_id: key,
          url: `/${key}`,
          bytes: Number(file.size || arr.byteLength || 0),
          format: ext,
        });
      } catch (err: any) {
        return json({ message: String(err?.message || "Upload error") }, 500);
      }
    }
    if (url.pathname === "/api/getActiveMovies" && request.method === "POST") {
      const stmt = env.cinema_db.prepare(
        `SELECT id, title, description, cover_image, detail_images, genres, rating, duration_min, release_date, is_active FROM movies WHERE is_active = 1 ORDER BY release_date DESC;`,
      );
      const result = await stmt.all();
      const rows = Array.isArray(result.results) ? result.results : [];
      const activeMovies = rows.map((m: any) => ({
        id: Number(m.id),
        title: String(m.title || ""),
        description: m.description ?? "",
        cover_image: m.cover_image ?? "",
        detail_images: (() => {
          const v = m.detail_images;
          if (v === null || v === undefined) return "[]";
          try { return typeof v === "string" ? v : JSON.stringify(v); } catch { return "[]"; }
        })(),
        genres: (() => {
          const v = m.genres;
          if (v === null || v === undefined) return "[]";
          try { return typeof v === "string" ? v : JSON.stringify(v); } catch { return "[]"; }
        })(),
        rating: (() => { try { const r = m.rating; return r === null || r === undefined ? "0" : String(r); } catch { return "0"; } })(),
        duration_min: (() => { try { return Number(m.duration_min ?? 0); } catch { return 0; } })(),
        release_date: m.release_date ?? null,
        price: 0,
      }));
      return json({ activeMovies });
    }
    if (url.pathname === "/api/movies" && request.method === "GET") {
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 10);
      const q = String(url.searchParams.get("q") || "");
      const sortKeyRaw = String(url.searchParams.get("sort") || "updated_at").toLowerCase();
      const dir = String(url.searchParams.get("dir") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
      const offset = (page - 1) * pageSize;
      const allowedSort = new Set(["updated_at", "release_date", "title", "rating"]);
      const sortKey = allowedSort.has(sortKeyRaw) ? sortKeyRaw : "updated_at";
      const whereParts: string[] = [];
      const bind: any[] = [];
      if (q) {
        whereParts.push(`(title LIKE ? OR description LIKE ?)`);
        const like = `%${q}%`;
        bind.push(like, like);
      }
      const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
      const totalRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM movies ${where}`).bind(...bind).first();
      const total = Number((totalRow as any)?.c || 0);
      const rows = await env.cinema_db
        .prepare(`SELECT id, title, description, cover_image, genres, rating, duration_min, is_active, release_date, created_at, updated_at FROM movies ${where} ORDER BY ${sortKey} ${dir} LIMIT ? OFFSET ?`)
        .bind(...bind, pageSize, offset)
        .all();
      const items = Array.isArray(rows.results) ? (rows.results as any[]).map((m: any) => {
        const ci = m?.cover_image;
        return {
          ...m,
          cover_image: (() => {
            if (typeof ci === "string" && ci.startsWith("/uploads/")) {
              if (r2Enabled && r2Base) return `${r2Base}/${ci.replace(/^\//, "")}`;
              return `${url.origin}${ci}`;
            }
            return ci;
          })(),
        };
      }) : [];
      return json({ items, page, pageSize, total });
    }
    if (url.pathname === "/api/movies" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.title) return badRequest("Thiếu tiêu đề phim");
      const now = new Date().toISOString();
      const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
      const savedCover = await (async () => {
        try {
          if (hasCloudinary(env) && typeof body.cover_image_base64 === "string" && body.cover_image_base64.startsWith("data:")) {
            const folder = "ctbooking/images/movies";
            const r = await uploadCloudinaryImageDataURI(env, body.cover_image_base64, folder);
            return r.url;
          }
          if (env.r2_cinemastore && typeof body.cover_image_base64 === "string" && body.cover_image_base64.startsWith("data:")) {
            const m = body.cover_image_base64.match(/^data:(.+);base64,(.+)$/);
            if (!m) return body.cover_image ?? null;
            const mime = String(m[1] || "application/octet-stream").toLowerCase();
            const raw = String(m[2] || "");
            const bstr = atob(raw);
            const bytes = new Uint8Array(bstr.length);
            for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i);
            if (bytes.length > MAX_IMAGE_SIZE) return "__TOO_LARGE__";
            const ext = mime.includes("webp") ? "webp" : mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpeg" : mime.includes("jpg") ? "jpg" : "bin";
            const key = `uploads/movies/movie_${Date.now()}.${ext}`;
            await env.r2_cinemastore.put(key, bytes, { httpMetadata: { contentType: mime } });
            return `/${key}`;
          }
          return body.cover_image ?? null;
        } catch { return body.cover_image ?? null; }
      })();
      if (savedCover === "__TOO_LARGE__") return json({ message: "Ảnh vượt quá 5MB, vui lòng chọn ảnh nhỏ hơn" }, 413);
      const processedDetailImages = await (async () => {
        const di = body.detail_images;
        if (hasCloudinary(env) && Array.isArray(di)) {
          const out: string[] = [];
          for (const img of di as any[]) {
            if (typeof img === "string" && /^data:.*;base64,/.test(img)) {
              try {
                const rr = await uploadCloudinaryImageDataURI(env, img, "ctbooking/images/movies/details");
                out.push(rr.url);
              } catch {
                out.push(String(img));
              }
            } else {
              out.push(String(img));
            }
          }
          return out;
        }
        return di;
      })();
      const stmt = env.cinema_db.prepare(
        `INSERT INTO movies (title, description, cover_image, detail_images, genres, rating, duration_min, is_active, release_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        String(body.title),
        body.description ?? null,
        savedCover,
        typeof processedDetailImages === "string" ? processedDetailImages : JSON.stringify(processedDetailImages ?? []),
        typeof body.genres === "string" ? body.genres : JSON.stringify(body.genres ?? []),
        body.rating ?? null,
        body.duration_min ?? null,
        body.is_active ?? 1,
        body.release_date ?? null,
        now,
        now,
      );
      const res = await stmt.run();
      const id = res.success ? Number((res.meta as any).last_row_id ?? 0) : 0;
      const movie = await env.cinema_db.prepare(`SELECT * FROM movies WHERE id = ?`).bind(id).first();
      return json({ movie }, 201);
    }
    if (/^\/api\/movies\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const movie = await env.cinema_db.prepare(`SELECT * FROM movies WHERE id = ?`).bind(id).first();
      if (!movie) return notFound();
      const ci = (movie as any)?.cover_image;
      const mapped = {
        ...(movie as any),
        cover_image: (() => {
          if (typeof ci === "string" && ci.startsWith("/uploads/")) {
            if (r2Enabled && r2Base) return `${r2Base}/${ci.replace(/^\//, "")}`;
            return `${url.origin}${ci}`;
          }
          return ci;
        })(),
      };
      return json(mapped);
    }
    if (/^\/api\/movies\/\d+$/.test(url.pathname) && request.method === "PUT") {
      const id = Number(url.pathname.split("/").pop());
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const now = new Date().toISOString();
      const oldRow = await env.cinema_db.prepare(`SELECT cover_image FROM movies WHERE id = ?`).bind(id).first();
      const oldCover = String((oldRow as any)?.cover_image || "");
      const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
      const coverUpdate = await (async () => {
        try {
          if (hasCloudinary(env) && typeof body.cover_image_base64 === "string" && body.cover_image_base64.startsWith("data:")) {
            const folder = "ctbooking/images/movies";
            const r = await uploadCloudinaryImageDataURI(env, body.cover_image_base64, folder);
            return r.url;
          }
          if (env.r2_cinemastore && typeof body.cover_image_base64 === "string" && body.cover_image_base64.startsWith("data:")) {
            const m = body.cover_image_base64.match(/^data:(.+);base64,(.+)$/);
            if (!m) return body.cover_image ?? null;
            const mime = String(m[1] || "application/octet-stream").toLowerCase();
            const raw = String(m[2] || "");
            const bstr = atob(raw);
            const bytes = new Uint8Array(bstr.length);
            for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i);
            if (bytes.length > MAX_IMAGE_SIZE) return "__TOO_LARGE__";
            const ext = mime.includes("webp") ? "webp" : mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpeg" : mime.includes("jpg") ? "jpg" : "bin";
            const key = `uploads/movies/movie_${Date.now()}.${ext}`;
            await env.r2_cinemastore.put(key, bytes, { httpMetadata: { contentType: mime } });
            return `/${key}`;
          }
          if (body.cover_image !== undefined) return body.cover_image ?? null;
          return undefined;
        } catch { return undefined; }
      })();
      if (coverUpdate === "__TOO_LARGE__") return json({ message: "Ảnh vượt quá 5MB, vui lòng chọn ảnh nhỏ hơn" }, 413);
      const detailImagesUpdate = await (async () => {
        const di = body.detail_images;
        if (hasCloudinary(env) && Array.isArray(di)) {
          const out: string[] = [];
          for (const img of di as any[]) {
            if (typeof img === "string" && /^data:.*;base64,/.test(img)) {
              try {
                const rr = await uploadCloudinaryImageDataURI(env, img, "ctbooking/images/movies/details");
                out.push(rr.url);
              } catch {
                out.push(String(img));
              }
            } else {
              out.push(String(img));
            }
          }
          return out;
        }
        return di === undefined ? undefined : di;
      })();
      await env.cinema_db.prepare(
        `UPDATE movies SET title = COALESCE(?, title), description = COALESCE(?, description), cover_image = COALESCE(?, cover_image), detail_images = COALESCE(?, detail_images), genres = COALESCE(?, genres), rating = COALESCE(?, rating), duration_min = COALESCE(?, duration_min), is_active = COALESCE(?, is_active), release_date = COALESCE(?, release_date), updated_at = ? WHERE id = ?`,
      ).bind(
        body.title ?? null,
        body.description ?? null,
        coverUpdate === undefined ? null : coverUpdate,
        detailImagesUpdate === undefined
          ? null
          : typeof detailImagesUpdate === "string"
            ? detailImagesUpdate
            : JSON.stringify(detailImagesUpdate ?? null),
        typeof body.genres === "string" ? body.genres : JSON.stringify(body.genres ?? null),
        body.rating ?? null,
        body.duration_min ?? null,
        body.is_active ?? null,
        body.release_date ?? null,
        now,
        id,
      ).run();
      if (env.r2_cinemastore && typeof coverUpdate === "string" && coverUpdate !== oldCover && oldCover.startsWith("/uploads/")) {
        const oldKey = oldCover.replace(/^\//, "");
        try { await env.r2_cinemastore.delete(oldKey); } catch {}
      }
      const movie = await env.cinema_db.prepare(`SELECT * FROM movies WHERE id = ?`).bind(id).first();
      return json({ movie });
    }
    if (url.pathname === "/api/admin/site-media" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => null);
        if (!body || !body.section || !body.type || !body.url) return json({ message: "Thiếu section/type/url" }, 400);
        const stmt = env.cinema_db.prepare(
          `INSERT INTO site_media (section, type, title, description, public_id, url, format, width, height, duration, display_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          String(body.section),
          String(body.type),
          body.title ? String(body.title) : null,
          body.description ? String(body.description) : null,
          body.public_id ? String(body.public_id) : null,
          String(body.url),
          body.format ? String(body.format) : null,
          body.width !== undefined ? Number(body.width) : null,
          body.height !== undefined ? Number(body.height) : null,
          body.duration !== undefined ? Number(body.duration) : null,
          body.display_order !== undefined ? Number(body.display_order) : 0,
          typeof body.is_active === "boolean" ? body.is_active : true,
          new Date().toISOString(),
          new Date().toISOString(),
        );
        const res = await stmt.run();
        const id = res.success ? Number((res.meta as any).last_row_id ?? 0) : 0;
        const item = await env.cinema_db.prepare(`SELECT * FROM site_media WHERE id = ?`).bind(id).first();
        return json({ item });
      } catch (err: any) {
        return json({ message: String(err?.message || "Internal error") }, 500);
      }
    }
    if (url.pathname === "/api/site-media" && request.method === "GET") {
      try {
        const section = url.searchParams.get("section");
        const type = url.searchParams.get("type");
        const active = url.searchParams.get("active");
        const whereParts: string[] = [];
        const bind: any[] = [];
        if (section) { whereParts.push("section = ?"); bind.push(String(section)); }
        if (type) { whereParts.push("type = ?"); bind.push(String(type)); }
        if (active !== null && active !== undefined) { whereParts.push("is_active = ?"); bind.push(String(active) === "true" ? 1 : 0); }
        const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
        const rows = await env.cinema_db
          .prepare(`SELECT * FROM site_media ${where} ORDER BY display_order ASC, created_at DESC`)
          .bind(...bind)
          .all();
        const items = Array.isArray(rows.results) ? rows.results : [];
        return json({ items });
      } catch (err: any) {
        return json({ message: String(err?.message || "Internal error") }, 500);
      }
    }
    if (url.pathname.startsWith("/uploads/") && request.method === "GET") {
      const key = url.pathname.slice(1);
      try {
        const range = request.headers.get("Range");
        const obj = range
          ? (() => {
              const m = range.match(/bytes=(\d+)-(\d+)?/);
              const start = m ? Number(m[1]) : 0;
              const end = m && m[2] ? Number(m[2]) : undefined;
              const length = end !== undefined && end >= start ? end - start + 1 : undefined;
              return env.r2_cinemastore.get(key, { range: { offset: start, length } });
            })()
          : env.r2_cinemastore.get(key);
        if (!obj) return notFound();
        const ext = key.split(".").pop()?.toLowerCase() || "";
        const ctMeta = (obj as any).httpMetadata?.contentType || "";
        let ct = ctMeta || "";
        if (!ct || ct === "application/octet-stream") {
          const map: Record<string, string> = {
            mp4: "video/mp4",
            m4v: "video/mp4",
            webm: "video/webm",
            mov: "video/quicktime",
            mkv: "video/x-matroska",
            mp3: "audio/mpeg",
            wav: "audio/wav",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
          };
          ct = map[ext] || "application/octet-stream";
        }
        const total = Number((obj as any).size || 0);
        const headers = { "Content-Type": ct, "Cache-Control": "public, max-age=31536000, immutable", "Accept-Ranges": "bytes", ...cors } as Record<string, string>;
        if (range && total > 0) {
          const m = range.match(/bytes=(\d+)-(\d+)?/);
          const start = m ? Number(m[1]) : 0;
          const end = m && m[2] ? Number(m[2]) : total - 1;
          headers["Content-Range"] = `bytes ${start}-${end}/${total}`;
          headers["Content-Length"] = String(end - start + 1);
          return new Response((obj as any).body, { status: 206, headers });
        }
        if (total > 0) headers["Content-Length"] = String(total);
        return new Response((obj as any).body, { headers });
      } catch {
        return notFound();
      }
    }
    if (url.pathname === "/api/debug/uploads/videos" && request.method === "GET") {
      try {
        const list = await env.r2_cinemastore.list({ prefix: "uploads/videos/" });
        const keys = Array.isArray((list as any)?.objects) ? (list as any).objects.map((o: any) => o.key) : [];
        return json({ keys });
      } catch {
        return json({ keys: [] });
      }
    }
    if (url.pathname.startsWith("/uploads/") && request.method === "HEAD") {
      const key = url.pathname.slice(1);
      try {
        const meta = await env.r2_cinemastore.head(key);
        if (!meta) return notFound();
        const ext = key.split(".").pop()?.toLowerCase() || "";
        const ctMeta = (meta as any).httpMetadata?.contentType || "";
        let ct = ctMeta || "";
        if (!ct || ct === "application/octet-stream") {
          const map: Record<string, string> = {
            mp4: "video/mp4",
            m4v: "video/mp4",
            webm: "video/webm",
            mov: "video/quicktime",
            mkv: "video/x-matroska",
            mp3: "audio/mpeg",
            wav: "audio/wav",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
          };
          ct = map[ext] || "application/octet-stream";
        }
        const total = Number((meta as any).size || 0);
        const headers = { "Content-Type": ct, "Cache-Control": "public, max-age=31536000, immutable", "Accept-Ranges": "bytes", ...cors } as Record<string, string>;
        if (total > 0) headers["Content-Length"] = String(total);
        return new Response(null, { status: 200, headers });
      } catch {
        return notFound();
      }
    }
    if (/^\/api\/movies\/\d+$/.test(url.pathname) && request.method === "DELETE") {
      const id = Number(url.pathname.split("/").pop());
      await env.cinema_db.prepare(`DELETE FROM movies WHERE id = ?`).bind(id).run();
      return json({ ok: true });
    }
    if (/^\/api\/movies\/detail\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const movie = await env.cinema_db.prepare(`SELECT * FROM movies WHERE id = ?`).bind(id).first();
      if (!movie) return notFound();
      const statsRow = await env.cinema_db
        .prepare(`SELECT SUM(ticket_count) as total_tickets, SUM(total_price) as total_revenue, COUNT(*) as successful_bookings FROM bookings WHERE movie_id = ? AND payment_status IN ('paid')`)
        .bind(id)
        .first();
      const totalTicketsSold = Number((statsRow as any)?.total_tickets || 0);
      const totalRevenue = Number((statsRow as any)?.total_revenue || 0);
      const successfulBookings = Number((statsRow as any)?.successful_bookings || 0);
      const mapped = {
        id: (movie as any).id,
        title: (movie as any).title,
        description: (movie as any).description || "Không có mô tả",
        cover_image: (() => {
          const ci = (movie as any).cover_image || null;
          if (typeof ci === "string" && ci.startsWith("/uploads/")) {
            if (r2Enabled && r2Base) return `${r2Base}/${ci.replace(/^\//, "")}`;
            return `${url.origin}${ci}`;
          }
          return ci;
        })(),
        genres: (() => {
          const v = (movie as any).genres;
          try { return typeof v === "string" ? JSON.parse(v) : Array.isArray(v) ? v : []; } catch { return []; }
        })(),
        rating: Number((movie as any).rating ?? 0),
        duration_min: Number((movie as any).duration_min ?? 0),
        price: 0,
        is_active: Boolean((movie as any).is_active !== 0),
        release_date: (movie as any).release_date || null,
        created_at: (movie as any).created_at,
        updated_at: (movie as any).updated_at,
        stats: {
          totalTicketsSold,
          totalRevenue,
          successfulBookings,
        },
      };
      return json(mapped);
    }
    if (url.pathname === "/api/tickets" && request.method === "GET") {
      const res = await env.cinema_db.prepare(`SELECT * FROM ticket_packages ORDER BY display_order ASC, price ASC`).all();
      const items = Array.isArray(res.results) ? res.results : [];
      return json({ items });
    }
    if (url.pathname === "/api/tickets/active" && request.method === "GET") {
      const res = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE is_active = 1 ORDER BY display_order ASC, price ASC`).all();
      const items = Array.isArray(res.results) ? res.results : [];
      return json({ items });
    }
    if (/^\/api\/tickets\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const item = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE id = ?`).bind(id).first();
      if (!item) return notFound();
      return json(item);
    }
    if (url.pathname === "/api/tickets" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.name || !body.price) return badRequest("Thiếu dữ liệu");
      const now = new Date().toISOString();
      const res = await env.cinema_db.prepare(`INSERT INTO ticket_packages (name, code, description, price, features, type, min_group_size, max_group_size, is_member_only, is_active, display_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        body.name, body.code ?? null, body.description ?? null, body.price, typeof body.features === "string" ? body.features : JSON.stringify(body.features ?? null), body.type ?? null, body.min_group_size ?? null, body.max_group_size ?? null, body.is_member_only ? 1 : 0, body.is_active ? 1 : 1, body.display_order ?? 0, now, now,
      ).run();
      const id = Number((res.meta as any).last_row_id ?? 0);
      const item = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE id = ?`).bind(id).first();
      return json({ item }, 201);
    }
    if (/^\/api\/tickets\/\d+$/.test(url.pathname) && request.method === "PUT") {
      const id = Number(url.pathname.split("/").pop());
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const now = new Date().toISOString();
      await env.cinema_db.prepare(`UPDATE ticket_packages SET name = COALESCE(?, name), code = COALESCE(?, code), description = COALESCE(?, description), price = COALESCE(?, price), features = COALESCE(?, features), type = COALESCE(?, type), min_group_size = COALESCE(?, min_group_size), max_group_size = COALESCE(?, max_group_size), is_member_only = COALESCE(?, is_member_only), is_active = COALESCE(?, is_active), display_order = COALESCE(?, display_order), updated_at = ? WHERE id = ?`).bind(
        body.name ?? null, body.code ?? null, body.description ?? null, body.price ?? null, typeof body.features === "string" ? body.features : JSON.stringify(body.features ?? null), body.type ?? null, body.min_group_size ?? null, body.max_group_size ?? null, body.is_member_only == null ? null : body.is_member_only ? 1 : 0, body.is_active == null ? null : body.is_active ? 1 : 0, body.display_order ?? null, now, id,
      ).run();
      const item = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE id = ?`).bind(id).first();
      return json({ item });
    }
    if (/^\/api\/tickets\/\d+$/.test(url.pathname) && request.method === "DELETE") {
      const id = Number(url.pathname.split("/").pop());
      await env.cinema_db.prepare(`DELETE FROM ticket_packages WHERE id = ?`).bind(id).run();
      return json({ ok: true });
    }
    if (url.pathname === "/api/toys" && request.method === "GET") {
      const res = await env.cinema_db.prepare(`SELECT * FROM toys ORDER BY updated_at DESC, id DESC`).all();
      const items = Array.isArray(res.results) ? res.results : [];
      return json({ items });
    }
    if (url.pathname === "/api/toys/active" && request.method === "GET") {
      const res = await env.cinema_db.prepare(`SELECT * FROM toys WHERE status = 'active' ORDER BY created_at DESC`).all();
      const items = Array.isArray(res.results) ? res.results : [];
      return json({ items });
    }
    if (/^\/api\/toys\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const item = await env.cinema_db.prepare(`SELECT * FROM toys WHERE id = ?`).bind(id).first();
      if (!item) return notFound();
      return json(item);
    }
    if (url.pathname === "/api/toys" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.name) return badRequest("Thiếu dữ liệu");
      const now = new Date().toISOString();
      const res = await env.cinema_db.prepare(`INSERT INTO toys (name, category, price, stock, status, image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        body.name, body.category ?? null, body.price ?? 0, body.stock ?? 0, body.status ?? "active", body.image_url ?? null, now, now,
      ).run();
      const id = Number((res.meta as any).last_row_id ?? 0);
      const item = await env.cinema_db.prepare(`SELECT * FROM toys WHERE id = ?`).bind(id).first();
      return json({ item }, 201);
    }
    if (/^\/api\/toys\/\d+$/.test(url.pathname) && request.method === "PUT") {
      const id = Number(url.pathname.split("/").pop());
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const now = new Date().toISOString();
      await env.cinema_db.prepare(`UPDATE toys SET name = COALESCE(?, name), category = COALESCE(?, category), price = COALESCE(?, price), stock = COALESCE(?, stock), status = COALESCE(?, status), image_url = COALESCE(?, image_url), updated_at = ? WHERE id = ?`).bind(
        body.name ?? null, body.category ?? null, body.price ?? null, body.stock ?? null, body.status ?? null, body.image_url ?? null, now, id,
      ).run();
      const item = await env.cinema_db.prepare(`SELECT * FROM toys WHERE id = ?`).bind(id).first();
      return json({ item });
    }
    if (/^\/api\/toys\/\d+$/.test(url.pathname) && request.method === "DELETE") {
      const id = Number(url.pathname.split("/").pop());
      await env.cinema_db.prepare(`DELETE FROM toys WHERE id = ?`).bind(id).run();
      return json({ ok: true });
    }
    if (url.pathname === "/api/forget-password" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const email = body?.email;
      if (!email) return badRequest("Thiếu email");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(email).first();
      if (!acc) return json({ status: "error", message: "Email không tồn tại!" }, 400);
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      const token = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
      const expiredAt = new Date(Date.now() + 3600 * 1000).toISOString();
      await env.cinema_db
        .prepare(`INSERT INTO tokens (account_id, type, token, expired_at, created_at) VALUES (?, 'reset_password', ?, ?, ?)`)
        .bind(Number((acc as any).id), token, expiredAt, new Date().toISOString())
        .run();
      const base = String(env.VITE_SERVER_BASE_URL || env.UPSTREAM_BASE || "https://cinesphere.com.vn");
      const link = `${base}/reset-password?token=${token}`;
      const html = getResetPasswordEmailTemplate(base, link);
      try {
        const result = await sendMail(env, String(email), "Đặt lại mật khẩu - CTBOOKING", html);
        if (!result.ok) return json({ status: "error", message: "Gửi email thất bại", detail: { status: result.status, body: result.body, provider: result.provider, missing: result.missing } }, 502);
      } catch (e) {
        return json({ status: "error", message: "Gửi email thất bại" }, 502);
      }
      return json({ status: "success", message: "Đã gửi yêu cầu đặt lại mật khẩu", link });
    }
    if (url.pathname === "/api/reset-password" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const token = body?.token;
      const newPassword = body?.newPassword;
      if (!token || !newPassword) return badRequest("Thiếu dữ liệu");
      const nowIso = new Date().toISOString();
      const tokenRecord = await env.cinema_db
        .prepare(`SELECT * FROM tokens WHERE token = ? AND type = 'reset_password' AND expired_at >= ? LIMIT 1`)
        .bind(token, nowIso)
        .first();
      if (!tokenRecord) return json({ status: "error", message: "Token không hợp lệ hoặc đã hết hạn!" }, 400);
      const hashed = await bcrypt.hash(String(newPassword), 10);
      await env.cinema_db.prepare(`UPDATE accounts SET password = ? WHERE id = ?`).bind(hashed, Number((tokenRecord as any).account_id)).run();
      await env.cinema_db.prepare(`DELETE FROM tokens WHERE id = ?`).bind(Number((tokenRecord as any).id)).run();
      return json({ status: "success", message: "Mật khẩu đã được đặt lại thành công!" });
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.email || !body.password) return badRequest("Thiếu thông tin đăng nhập");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(body.email).first();
      if (!acc || !acc.password) return json({ status: "error", message: "Email không tồn tại!" }, 400);
      const ok = await bcrypt.compare(String(body.password), String(acc.password));
      if (!ok) return json({ status: "error", message: "Mật khẩu không đúng!" }, 400);
      const user = await env.cinema_db.prepare(`SELECT * FROM users WHERE id = ?`).bind(Number(acc.user_id)).first();
      return json({ status: "success", message: "Đăng nhập thành công!", user: { username: user?.fullname ?? null, email: body.email } });
    }
    if (url.pathname === "/api/register" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.email || !body.password) return badRequest("Thiếu dữ liệu");
      const existed = await env.cinema_db.prepare(`SELECT id FROM accounts WHERE email = ?`).bind(body.email).first();
      if (existed) return json({ status: "error", message: "Email đã tồn tại!" }, 400);
      const now = new Date().toISOString();
      const userRes = await env.cinema_db.prepare(`INSERT INTO users (fullname, phone, created_at, updated_at) VALUES (?, ?, ?, ?)`).bind(body.name ?? null, body.phone ?? null, now, now).run();
      const userId = Number((userRes.meta as any).last_row_id ?? 0);
      const hashed = await bcrypt.hash(String(body.password), 10);
      await env.cinema_db.prepare(`INSERT INTO accounts (user_id, email, password, login_type, is_active, created_at, updated_at) VALUES (?, ?, ?, 'email', 1, ?, ?)`).bind(userId, body.email, hashed, now, now).run();
      try {
        const displayName = typeof body.name === "string" && body.name.trim() ? body.name : String(body.email).split("@")[0];
        const base = String(env.VITE_SERVER_BASE_URL || env.UPSTREAM_BASE || "https://cinesphere.com.vn");
        const html = getWelcomeEmailTemplate(base, { customerName: displayName, email: String(body.email) });
        await sendMail(env, String(body.email), "🎉 Chào mừng bạn đến CINESPHERE", html);
      } catch {}
      const username = typeof body.name === "string" && body.name.trim() ? String(body.name).trim() : String(body.email).split("@")[0];
      return json({ status: "success", message: "Đăng ký thành công!", user: { id: userId, email: String(body.email), username } }, 201);
    }
    if (url.pathname === "/api/users" && request.method === "GET") {
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 10);
      const q = String(url.searchParams.get("q") ?? "");
      const offset = (page - 1) * pageSize;
      const where = q ? `%${q}%` : null;
      const base = q
        ? `SELECT u.*, (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) as total_bookings, (SELECT email FROM accounts a WHERE a.user_id = u.id LIMIT 1) as email, (SELECT is_active FROM accounts a WHERE a.user_id = u.id LIMIT 1) as is_active FROM users u WHERE u.fullname LIKE ? OR u.phone LIKE ? ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
        : `SELECT u.*, (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) as total_bookings, (SELECT email FROM accounts a WHERE a.user_id = u.id LIMIT 1) as email, (SELECT is_active FROM accounts a WHERE a.user_id = u.id LIMIT 1) as is_active FROM users u ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
      const stmt = q
        ? env.cinema_db.prepare(base).bind(where, where, pageSize, offset)
        : env.cinema_db.prepare(base).bind(pageSize, offset);
      const res = await stmt.all();
      const items = Array.isArray(res.results) ? res.results : [];
      const countRes = q
        ? await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM users WHERE fullname LIKE ? OR phone LIKE ?`).bind(where, where).first()
        : await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM users`).first();
      const total = Number((countRes as any)?.c ?? 0);
      return json({ items, page, pageSize, total });
    }
    if (/^\/api\/users\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const base = await env.cinema_db
        .prepare(
          `SELECT u.*, 
            (SELECT email FROM accounts a WHERE a.user_id = u.id LIMIT 1) as email,
            (SELECT is_active FROM accounts a WHERE a.user_id = u.id LIMIT 1) as is_active,
            (SELECT login_type FROM accounts a WHERE a.user_id = u.id LIMIT 1) as login_type,
            (SELECT created_at FROM accounts a WHERE a.user_id = u.id LIMIT 1) as account_created_at
          FROM users u WHERE u.id = ?`,
        )
        .bind(id)
        .first();
      if (!base) return notFound();
      const totalRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE user_id = ?`).bind(id).first();
      const bookings = await env.cinema_db
        .prepare(
          `SELECT b.id, b.ticket_count, b.total_price, b.payment_method, b.payment_status, b.created_at, m.title as movie_title, t.name as ticket_package_name
           FROM bookings b 
           LEFT JOIN movies m ON m.id = b.movie_id 
           LEFT JOIN ticket_packages t ON t.id = b.ticket_package_id 
           WHERE b.user_id = ? 
           ORDER BY b.created_at DESC 
           LIMIT 10`,
        )
        .bind(id)
        .all();
      const recent_bookings = (bookings.results || []).map((b: any) => ({
        id: b.id,
        movie_title: b.movie_title || "N/A",
        ticket_count: Number(b.ticket_count || 0),
        total_price: Number(b.total_price || 0),
        payment_method: b.payment_method || "",
        payment_status: b.payment_status || "",
        created_at: b.created_at,
      }));
      return json({
        id: (base as any).id,
        fullname: (base as any).fullname || "N/A",
        phone: (base as any).phone || "N/A",
        email: (base as any).email || "N/A",
        avatar: (base as any).avatar || null,
        is_active: Boolean((base as any).is_active ?? true),
        login_type: (base as any).login_type || "email",
        account_created_at: (base as any).account_created_at,
        user_created_at: (base as any).created_at,
        user_updated_at: (base as any).updated_at,
        recent_bookings,
        total_bookings: Number((totalRow as any)?.c || 0),
      });
    }
    if (url.pathname === "/api/users/profile" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.email) return badRequest("Thiếu email");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(body.email).first();
      if (!acc) return json({ message: "Không tìm thấy tài khoản" }, 404);
      const normalizedGender = (() => { try { const g = typeof body.gender === "string" ? body.gender.trim().toLowerCase() : ""; return g === "male" || g === "female" ? g : null; } catch { return null; } })();
      const dobDate = (() => { try { if (!body.dob) return null; const d = new Date(body.dob); return isNaN(d.getTime()) ? null : d.toISOString(); } catch { return null; } })();
      const now = new Date().toISOString();
      await env.cinema_db.prepare(`UPDATE users SET fullname = COALESCE(?, fullname), phone = COALESCE(?, phone), gender = COALESCE(?, gender), dob = COALESCE(?, dob), updated_at = ? WHERE id = ?`).bind(
        typeof body.name === "string" ? body.name : null,
        typeof body.phone === "string" ? body.phone : null,
        normalizedGender,
        dobDate,
        now,
        Number(acc.user_id),
      ).run();
      const user = await env.cinema_db.prepare(`SELECT * FROM users WHERE id = ?`).bind(Number(acc.user_id)).first();
      return json({ ok: true, user: { id: user?.id, fullname: user?.fullname, phone: user?.phone, gender: user?.gender ?? null, dob: user?.dob ?? null, email: body.email } });
    }
    if (url.pathname === "/api/users/password" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.email) return badRequest("Thiếu dữ liệu");
      const email = String(body.email || "");
      const oldPassword = body.oldPassword ? String(body.oldPassword) : null;
      const newPassword = body.newPassword ? String(body.newPassword) : null;
      const directPassword = body.password ? String(body.password) : null;
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(email).first();
      if (!acc) return json({ message: "Không tìm thấy tài khoản" }, 404);
      if (oldPassword && newPassword) {
        const ok = acc?.password ? await bcrypt.compare(oldPassword, String(acc.password)) : false;
        if (!ok) return json({ message: "Mật khẩu hiện tại không đúng" }, 400);
        const hashed = await bcrypt.hash(newPassword, 10);
        await env.cinema_db.prepare(`UPDATE accounts SET password = ? WHERE id = ?`).bind(hashed, Number((acc as any).id)).run();
        return json({ ok: true });
      }
      if (directPassword) {
        const hashed = await bcrypt.hash(directPassword, 10);
        await env.cinema_db.prepare(`UPDATE accounts SET password = ? WHERE id = ?`).bind(hashed, Number((acc as any).id)).run();
        return json({ ok: true });
      }
      return badRequest("Thiếu dữ liệu");
    }
    if (url.pathname === "/api/validate-booking" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const email = body.email;
      const emailBook = body.emailBook;
      const phone = body.phone;
      const name = body.name;
      const movieId = body.movieId ? Number(body.movieId) : null;
      const ticketCount = Number(body.ticketCount);
      const ticketPackageId = body.ticketPackageId ? Number(body.ticketPackageId) : null;
      if (!email || !emailBook || !phone || !name || !ticketCount || ticketCount <= 0) return badRequest("Vui lòng nhập đầy đủ thông tin hợp lệ.");
      if (ticketCount > 10) return badRequest("Mỗi lượt chỉ đặt tối đa 10 vé.");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(email).first();
      if (!acc) return json({ ok: false, message: "Người dùng không tồn tại." }, 404);
      const user = await env.cinema_db.prepare(`SELECT * FROM users WHERE id = ?`).bind(Number((acc as any).user_id)).first();
      let movie: any = null;
      if (movieId) {
        movie = await env.cinema_db.prepare(`SELECT * FROM movies WHERE id = ?`).bind(movieId).first();
        if (!movie || Number(movie.is_active) === 0) return json({ ok: false, message: "Phim không hợp lệ hoặc đã ngừng hoạt động." }, 404);
      }
      let ticketPackage: any = null;
      if (ticketPackageId) {
        ticketPackage = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE id = ?`).bind(ticketPackageId).first();
        if (!ticketPackage || Number(ticketPackage.is_active) === 0) return json({ ok: false, message: "Gói vé không hợp lệ hoặc đã tắt." }, 404);
      } else {
        const res = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE is_active = 1 ORDER BY display_order ASC, price ASC LIMIT 1`).all();
        ticketPackage = Array.isArray(res.results) && res.results.length ? res.results[0] : null;
        if (!ticketPackage) return json({ ok: false, message: "Không tìm thấy gói vé khả dụng." }, 400);
      }
      const unitPrice = Number(ticketPackage.price || 0);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) return json({ ok: false, message: "Giá vé không hợp lệ." }, 400);
      const totalPrice = unitPrice * ticketCount;
      return json({
        ok: true,
        user: { id: Number((user as any)?.id), email: String(email), fullname: (user as any)?.fullname ?? null, phone: (user as any)?.phone ?? null },
        movie: movie
          ? { id: Number(movie.id), title: String(movie.title || ""), is_active: Number(movie.is_active) ? true : false, duration_min: Number(movie.duration_min ?? 0) }
          : undefined,
        ticketPackage: { id: Number(ticketPackage.id), name: String(ticketPackage.name || ""), price: Number(ticketPackage.price || 0) },
        unitPrice,
        totalPrice,
      });
    }
    if (url.pathname === "/api/create-booking" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const email = String(body.email || "");
      const emailBook = String(body.emailBook || body.email || "");
      const phone = String(body.phone || "");
      const name = String(body.name || "");
      const movieId = body.movieId ? Number(body.movieId) : null;
      const ticketPackageId = body.ticketPackageId ? Number(body.ticketPackageId) : null;
      const ticketCount = Number(body.ticketCount || 0);
      const paymentMethod = String((body.paymentMethod || "cash")).toLowerCase();
      if (!email || !emailBook || !phone || !name || !ticketCount || ticketCount <= 0) return badRequest("Vui lòng nhập đầy đủ thông tin hợp lệ.");
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(email).first();
      if (!acc) return json({ message: "Không tìm thấy người dùng" }, 404);
      let unitPrice = 0;
      if (ticketPackageId) {
        const pkg = await env.cinema_db.prepare(`SELECT * FROM ticket_packages WHERE id = ?`).bind(ticketPackageId).first();
        if (!pkg || Number((pkg as any).is_active ?? 0) === 0) return json({ message: "Gói vé không hợp lệ" }, 404);
        unitPrice = Number((pkg as any).price || 0);
      }
      const totalPrice = Number(body.totalPrice ?? unitPrice * ticketCount);
      if (!Number.isFinite(totalPrice) || totalPrice <= 0) return badRequest("Giá trị tổng tiền không hợp lệ.");
      try {
        const resRun = await env.cinema_db
          .prepare(
            `INSERT INTO bookings (user_id, movie_id, ticket_package_id, ticket_count, total_price, payment_method, phone, name, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            Number((acc as any).user_id || 0),
            movieId,
            ticketPackageId,
            ticketCount,
            totalPrice,
            paymentMethod,
            phone,
            name,
            emailBook,
            new Date().toISOString(),
          )
          .run();
        const bookingId = Number((resRun.meta as any).last_row_id ?? 0);
        const booking = await env.cinema_db.prepare(`SELECT * FROM bookings WHERE id = ?`).bind(bookingId).first();
        return json({ message: "Khởi tạo đặt vé thành công", booking }, 201);
      } catch (e: any) {
        return json({ message: "Không thể tạo đặt vé", error: String(e?.message || e) }, 500);
      }
    }
    if (url.pathname === "/api/confirm-booking" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const user_id = Number(body.user_id);
      const payment_id = Number(body.payment_id);
      const payment_status = String(body.payment_status || "");
      const transaction_id = body.transaction_id ?? null;
      const paid_at = body.paid_at ? new Date(body.paid_at).toISOString() : null;
      if (!user_id || !payment_id || !payment_status) return badRequest("Vui lòng nhập đầy đủ thông tin hợp lệ.");
      const booking = await env.cinema_db
        .prepare(`SELECT * FROM bookings WHERE id = ? AND user_id = ?`)
        .bind(payment_id, user_id)
        .first();
      if (!booking) return json({ message: "Không tìm thấy đặt vé." }, 404);
      let bookingCode = (booking as any).booking_code as string | null;
      if (payment_status.toLowerCase() === "paid" && !bookingCode) {
        let isUnique = false;
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        while (!isUnique) {
          let code = "";
          for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
          const existed = await env.cinema_db.prepare(`SELECT id FROM bookings WHERE booking_code = ?`).bind(code).first();
          if (!existed) {
            bookingCode = code;
            isUnique = true;
          }
        }
      }
      const expiry = paid_at ? new Date(new Date(paid_at).getTime() + 10 * 24 * 60 * 60 * 1000).toISOString() : null;
      await env.cinema_db
        .prepare(`UPDATE bookings SET payment_status = ?, transaction_id = ?, paid_at = ?, expiry_date = ?, booking_code = COALESCE(?, booking_code) WHERE id = ?`)
        .bind(payment_status, transaction_id, paid_at, expiry, bookingCode ?? null, Number((booking as any).id))
        .run();
      const updated = await env.cinema_db.prepare(`SELECT * FROM bookings WHERE id = ?`).bind(Number((booking as any).id)).first();
      try {
        const emailTo = String((updated as any).email || "");
        const statusNow = String((updated as any).payment_status || "").toLowerCase();
        if (emailTo && statusNow === "paid") {
          const movie = (updated as any).movie_id ? await env.cinema_db.prepare(`SELECT title FROM movies WHERE id = ?`).bind(Number((updated as any).movie_id)).first() : null;
          const movieMore = (updated as any).movie_id ? await env.cinema_db.prepare(`SELECT cover_image, duration_min FROM movies WHERE id = ?`).bind(Number((updated as any).movie_id)).first() : null;
          const ticket = (updated as any).ticket_package_id ? await env.cinema_db.prepare(`SELECT name, price FROM ticket_packages WHERE id = ?`).bind(Number((updated as any).ticket_package_id)).first() : null;
          const code = (updated as any).booking_code || "";
          const qty = Number((updated as any).ticket_count || 0);
          const amount = Number((updated as any).total_price || 0);
          const title = (movie as any)?.title || "";
          const packageName = (ticket as any)?.name || "";
          const base = String(env.VITE_SERVER_BASE_URL || env.UPSTREAM_BASE || "https://cinesphere.com.vn");
          const html = getBookingEmailTemplate(base, {
            bookingCode: code,
            customerName: String((updated as any).name || ""),
            movieTitle: title,
            ticketCount: qty,
            totalPrice: formatCurrencyVi(amount),
            movieImage: (movieMore as any)?.cover_image || undefined,
            durationMin: (movieMore as any)?.duration_min ?? undefined,
            ticketPackageName: packageName || undefined,
            expiryDate: (updated as any).expiry_date || null,
          });
          await sendMail(env, emailTo, "✅ Thanh toán thành công - CTBOOKING", html);
        }
      } catch {}
      return json({
        message: "Thanh toán thành công",
        booking: {
          id: (updated as any).id,
          user_id: (updated as any).user_id,
          movie_id: (updated as any).movie_id,
          ticket_package_id: (updated as any).ticket_package_id,
          ticket_count: (updated as any).ticket_count,
          total_price: (updated as any).total_price,
          payment_method: (updated as any).payment_method,
          payment_status: (updated as any).payment_status,
          transaction_id: (updated as any).transaction_id,
          created_at: (updated as any).created_at,
          paid_at: (updated as any).paid_at,
        },
      });
    }
    if (/^\/api\/bookings\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const booking = await env.cinema_db.prepare(`SELECT id, payment_status, total_price, ticket_count, created_at, name, email, phone, user_id, movie_id, ticket_package_id FROM bookings WHERE id = ?`).bind(id).first();
      if (!booking) return new Response(JSON.stringify({ message: "Không tìm thấy đặt vé" }), { status: 404, headers: cors });
      return json({
        id: (booking as any).id,
        payment_status: (booking as any).payment_status,
        total_price: (booking as any).total_price,
        ticket_count: (booking as any).ticket_count,
        created_at: (booking as any).created_at,
        name: (booking as any).name,
        phone: (booking as any).phone,
        email: (booking as any).email,
        user_id: (booking as any).user_id,
        movie_id: (booking as any).movie_id,
        ticket_package_id: (booking as any).ticket_package_id,
      });
    }
    if (url.pathname.startsWith("/api/bookings/code/") && request.method === "GET") {
      const rl = rateLimitCheck();
      if (!rl.ok) {
        const retrySec = Math.ceil(rl.windowMs / 1000);
        const headers = { ...noStoreHeaders, "Retry-After": String(retrySec), "X-RateLimit-Limit": String(RL_MAX), "X-RateLimit-Remaining": "0", "X-RateLimit-WindowMS": String(RL_WINDOW_MS) };
        return new Response(JSON.stringify({ message: `Quá nhiều yêu cầu, vui lòng thử lại sau ${retrySec}s` }), { status: 429, headers });
      }
      const code = url.pathname.split("/").pop() || "";
      if (!code.trim()) return badRequest("Vui lòng nhập mã vé");
      const normalizedCode = code.trim().toUpperCase();
      const booking = await env.cinema_db.prepare(`SELECT b.*, u.fullname as user_fullname FROM bookings b LEFT JOIN users u ON u.id = b.user_id WHERE b.booking_code = ?`).bind(normalizedCode).first();
      if (!booking) {
        const headers = { ...noStoreHeaders, "X-RateLimit-Limit": String(RL_MAX), "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-WindowMS": String(RL_WINDOW_MS) };
        return new Response(JSON.stringify({ message: `Không tìm thấy vé với mã này.` }), { status: 404, headers });
      }
      const now = Date.now();
      const paidAt = (booking as any).paid_at ? new Date((booking as any).paid_at).getTime() : null;
      const expiryAt = (booking as any).expiry_date ? new Date((booking as any).expiry_date as any).getTime() : null;
      const isPaid = String((booking as any).payment_status || "").toLowerCase() === "paid";
      const expired = Boolean(expiryAt && now > expiryAt);
      const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !((booking as any).is_used));
      const can_use = Boolean(valid);
      const daysLeft = expiryAt ? Math.ceil((expiryAt - now) / (1000 * 60 * 60 * 24)) : null;
      const headers = { ...noStoreHeaders, "X-RateLimit-Limit": String(RL_MAX), "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-WindowMS": String(RL_WINDOW_MS) };
      return new Response(
        JSON.stringify({
          id: (booking as any).id,
          booking_code: (booking as any).booking_code,
          payment_status: (booking as any).payment_status,
          user_id: (booking as any).user_id,
          name: (booking as any).name,
          phone: (booking as any).phone,
          email: (booking as any).email,
          ticket_count: (booking as any).ticket_count,
          total_price: (booking as any).total_price,
          movie_id: (booking as any).movie_id,
          ticket_package_id: (booking as any).ticket_package_id,
          created_at: (booking as any).created_at,
          paid_at: (booking as any).paid_at,
          expiry_date: (booking as any).expiry_date,
          payment_method: (booking as any).payment_method,
          userName: (booking as any).user_fullname || "N/A",
          is_used: Boolean((booking as any).is_used),
          valid,
          can_use,
          validity_days: daysLeft,
          expired,
        }),
        { status: 200, headers },
      );
    }
    if (url.pathname === "/api/bookings/use" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const code = body?.code;
      if (!code || !code.trim()) return badRequest("Vui lòng nhập mã vé");
      const normalizedCode = code.trim().toUpperCase();
      const booking = await env.cinema_db.prepare(`SELECT * FROM bookings WHERE booking_code = ?`).bind(normalizedCode).first();
      if (!booking) return json({ message: "Không tìm thấy vé" }, 404);
      const isPaid = String((booking as any).payment_status || "").toLowerCase() === "paid";
      const paidAt = (booking as any).paid_at ? new Date((booking as any).paid_at).getTime() : null;
      const expiryAt = (booking as any).expiry_date ? new Date((booking as any).expiry_date as any).getTime() : null;
      const expired = Boolean(expiryAt && Date.now() > expiryAt);
      const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !((booking as any).is_used));
      if (!valid) return json({ message: "Vé không còn hiệu lực hoặc đã sử dụng" }, 400);
      await env.cinema_db.prepare(`UPDATE bookings SET is_used = 1 WHERE id = ?`).bind(Number((booking as any).id)).run();
      const updated = await env.cinema_db.prepare(`SELECT id, is_used FROM bookings WHERE id = ?`).bind(Number((booking as any).id)).first();
      return json({ ok: true, message: "Xác nhận sử dụng vé thành công", booking: { id: (updated as any).id, is_used: Boolean((updated as any).is_used) } });
    }
    if (url.pathname === "/api/momo/create-payment" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const amount = Number(body.amount);
      const orderId = String(body.orderId || "");
      const orderInfo = String(body.orderInfo || "");
      const base = String(env.VITE_SERVER_BASE_URL || env.UPSTREAM_BASE || "https://cinesphere.com.vn");
      const redirectPath = String(env.VITE_MOMO_REDIRECT_URL || env.VITE_MOMO_RETURN_URL || env.VITE_VNPAY_RETURN_URL || "/checkout");
      const redirectUrl = `${base}${redirectPath}`;
      const ipnPath = String(env.VITE_MOMO_IPN_URL || "/api/momo/ipn");
      const ipnUrl = `${base}${ipnPath}`;
      const requestType = String(body.requestType || "captureWallet");
      const extraData = String(body.extraData || "");
      const lang = String(body.lang || "vi");
      const partnerCode = String(env.VITE_MOMO_PARTNER_CODE || body.partnerCode || "");
      const accessKey = String(env.VITE_MOMO_ACCESS_KEY || body.accessKey || "");
      const secretKey = String(env.VITE_MOMO_SECRET_KEY || body.secretKey || "");
      if (!partnerCode || !accessKey || !secretKey) return json({ message: "MOMO configuration missing" }, 400);
      if (!amount || !orderId || !orderInfo || !redirectUrl || !ipnUrl) return json({ message: "Invalid payload" }, 400);
      const requestId = String(body.requestId || Date.now().toString());
      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
      const signature = await hmacHex("SHA-256", secretKey, rawSignature);
      const endpoint = String(env.VITE_MOMO_ENDPOINT || "https://test-payment.momo.vn/v2/gateway/api/create");
      const momoRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerCode, accessKey, requestId, amount, orderId, orderInfo, redirectUrl, ipnUrl, extraData, requestType, signature, lang }),
      });
      const data = await momoRes.json().catch(() => ({}));
      if (!momoRes.ok) return new Response(JSON.stringify({ message: data?.message || "MOMO error", data }), { status: momoRes.status, headers: cors });
      return json({ payUrl: data?.payUrl || data?.deeplink || data?.deeplinkWeb || "", data });
    }
    if (url.pathname === "/api/momo/ipn" && request.method === "POST") {
      try {
        return json({ result: true });
      } catch {
        return json({ result: false }, 500);
      }
    }
    if (url.pathname === "/api/vnpay/create-payment" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return badRequest();
      const amount = Number(body.amount);
      const orderId = String(body.orderId || "");
      const orderInfo = String(body.orderInfo || "");
      const locale = String(body.locale || "vn");
      if (!amount || !orderId || !orderInfo) return json({ message: "Invalid payload" }, 400);
      const tmnCode = String(env.VITE_VNPAY_TMN_CODE || body.tmnCode || "");
      const hashSecret = String(env.VITE_VNPAY_HASH_SECRET || body.hashSecret || "");
      const base = String(env.VITE_SERVER_BASE_URL || env.UPSTREAM_BASE || "https://cinesphere.com.vn");
      const returnPath = String(env.VITE_VNPAY_RETURN_URL || "/checkout");
      const returnUrl = `${base}${returnPath}`;
      if (!tmnCode || !hashSecret || !returnUrl) return json({ message: "VNPay configuration missing" }, 400);
      const vnp_TxnRef = orderId;
      const vnp_Version = "2.1.0";
      const vnp_Command = "pay";
      const vnp_CreateDate = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
      const vnp_IpAddr = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
      const vnp_Amount = amount * 100;
      const params: Record<string, any> = {
        vnp_Version,
        vnp_Command,
        vnp_TmnCode: tmnCode,
        vnp_Locale: locale,
        vnp_CurrCode: "VND",
        vnp_TxnRef,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: "other",
        vnp_Amount,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr,
        vnp_CreateDate,
      };
      const sortedKeys = Object.keys(params).sort();
      const sorted: Record<string, any> = {};
      for (const k of sortedKeys) sorted[k] = params[k];
      const signData = new URLSearchParams(sorted).toString();
      const vnp_SecureHash = await hmacHex("SHA-512", hashSecret, signData);
      const query = new URLSearchParams({ ...sorted, vnp_SecureHash }).toString();
      const gateway = String(env.VITE_VNPAY_GATEWAY || "");
      const payUrl = `${gateway}?${query}`;
      return json({ payUrl });
    }
    if (url.pathname === "/api/vnpay/ipn" && request.method === "POST") {
      return json({ result: true });
    }
    if (url.pathname === "/api/admin/revenue" && request.method === "GET") {
      const fromStr = String(url.searchParams.get("from") || "");
      const toStr = String(url.searchParams.get("to") || "");
      const status = String(url.searchParams.get("status") || "paid").toLowerCase();
      let where = "1=1";
      const params: any[] = [];
      if (status !== "all") {
        where += " AND payment_status IN ('paid')";
      }
      if (fromStr && toStr) {
        where += " AND (paid_at BETWEEN ? AND ? OR created_at BETWEEN ? AND ?)";
        params.push(fromStr, toStr, fromStr, toStr);
      } else if (fromStr) {
        where += " AND (paid_at >= ? OR created_at >= ?)";
        params.push(fromStr, fromStr);
      } else if (toStr) {
        where += " AND (paid_at <= ? OR created_at <= ?)";
        params.push(toStr, toStr);
      }
      const agg = await env.cinema_db.prepare(`SELECT SUM(total_price) AS total, COUNT(*) AS cnt FROM bookings WHERE ${where}`).bind(...params).first();
      const total = Number((agg as any)?.total || 0);
      const count = Number((agg as any)?.cnt || 0);
      return json({ total, count });
    }
    if (url.pathname === "/api/admin/transactions" && request.method === "GET") {
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 10);
      const email = String(url.searchParams.get("email") || "");
      const status = String(url.searchParams.get("status") || "");
      const sortKey = String(url.searchParams.get("sort") || "created_at");
      const dir = String(url.searchParams.get("dir") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
      const paymentMethod = String(url.searchParams.get("payment_method") || "");
      const fromStr = String(url.searchParams.get("from") || "");
      const toStr = String(url.searchParams.get("to") || "");
      const offset = (page - 1) * pageSize;
      const whereParts: string[] = [];
      const bind: any[] = [];
      if (email) {
        whereParts.push(
          `(email LIKE ? OR user_id IN (SELECT id FROM users WHERE id IN (SELECT user_id FROM accounts WHERE email LIKE ?)))`,
        );
        bind.push(`%${email}%`, `%${email}%`);
      }
      if (status && status !== "all") {
        whereParts.push(`payment_status = ?`);
        bind.push(status);
      }
      if (paymentMethod) {
        whereParts.push(`payment_method = ?`);
        bind.push(paymentMethod);
      }
      if (fromStr && toStr) {
        whereParts.push(`(created_at BETWEEN ? AND ? OR paid_at BETWEEN ? AND ?)`);
        bind.push(fromStr, toStr, fromStr, toStr);
      } else if (fromStr) {
        whereParts.push(`(created_at >= ? OR paid_at >= ?)`);
        bind.push(fromStr, fromStr);
      } else if (toStr) {
        whereParts.push(`(created_at <= ? OR paid_at <= ?)`);
        bind.push(toStr, toStr);
      }
      const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
      const totalRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings ${where}`).bind(...bind).first();
      const total = Number((totalRow as any)?.c || 0);
      const orderBy = sortKey === "paid_at" ? `paid_at ${dir}` : `created_at ${dir}`;
      const rows = await env.cinema_db
        .prepare(
          `SELECT b.*, u.fullname as user_fullname, (SELECT email FROM accounts a WHERE a.user_id = b.user_id LIMIT 1) as user_email, (SELECT title FROM movies m WHERE m.id = b.movie_id) as movie_title, (SELECT name FROM ticket_packages t WHERE t.id = b.ticket_package_id) as ticket_package_name FROM bookings b LEFT JOIN users u ON u.id = b.user_id ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
        )
        .bind(...bind, pageSize, offset)
        .all();
      const items = (rows.results || []).map((tx: any) => {
        const now = Date.now();
        const expiry = tx.expiry_date ? new Date(tx.expiry_date as any).getTime() : null;
        const expired = Boolean(expiry && now > expiry);
        const daysLeft = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null;
        return {
          id: tx.id,
          bookingId: tx.id,
          email: tx.email || tx.user_email || "",
          phone: tx.phone || "",
          name: tx.name || tx.user_fullname || "",
          userName: tx.user_fullname || "",
          movieTitle: tx.movie_title || "",
          ticketPackageName: tx.ticket_package_name || "",
          ticketCount: tx.ticket_count,
          totalPrice: Number(tx.total_price),
          paymentMethod: tx.payment_method,
          paymentStatus: tx.payment_status,
          transactionId: tx.transaction_id,
          createdAt: tx.created_at,
          paidAt: tx.paid_at,
          expiryDate: tx.expiry_date || null,
          expired,
          daysLeft,
        };
      });
      return json({ items, page, pageSize, total });
    }
    if (/^\/api\/admin\/transactions\/\d+$/.test(url.pathname) && request.method === "GET") {
      const id = Number(url.pathname.split("/").pop());
      const row = await env.cinema_db
        .prepare(
          `SELECT b.*, u.fullname as user_fullname, u.id as u_id, (SELECT email FROM accounts a WHERE a.user_id = b.user_id LIMIT 1) as user_email, (SELECT is_active FROM accounts a WHERE a.user_id = b.user_id LIMIT 1) as user_is_active, (SELECT created_at FROM accounts a WHERE a.user_id = b.user_id LIMIT 1) as account_created_at, (SELECT title FROM movies m WHERE m.id = b.movie_id) as movie_title, (SELECT cover_image FROM movies m WHERE m.id = b.movie_id) as movie_cover_image, (SELECT genres FROM movies m WHERE m.id = b.movie_id) as movie_genres, (SELECT rating FROM movies m WHERE m.id = b.movie_id) as movie_rating, (SELECT duration_min FROM movies m WHERE m.id = b.movie_id) as movie_duration_min, (SELECT name FROM ticket_packages t WHERE t.id = b.ticket_package_id) as ticket_package_name, (SELECT price FROM ticket_packages t WHERE t.id = b.ticket_package_id) as ticket_package_price FROM bookings b LEFT JOIN users u ON u.id = b.user_id WHERE b.id = ?`,
        )
        .bind(id)
        .first();
      if (!row) return json({ message: "Không tìm thấy giao dịch" }, 404);
      const now = Date.now();
      const expiry = (row as any).expiry_date ? new Date((row as any).expiry_date as any).getTime() : null;
      const expired = Boolean(expiry && now > expiry);
      const daysLeft = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null;
      const mapped = {
        id: (row as any).id,
        user: {
          id: (row as any).u_id,
          fullname: (row as any).user_fullname,
          email: (row as any).email || (row as any).user_email || "N/A",
          phone: (row as any).phone || null,
          is_active: Boolean((row as any).user_is_active ?? true),
          account_created_at: (row as any).account_created_at,
        },
        movie: {
          id: (row as any).movie_id,
          title: (row as any).movie_title,
          cover_image: (row as any).movie_cover_image,
          genres: (row as any).movie_genres,
          rating: (row as any).movie_rating,
          duration_min: (row as any).movie_duration_min,
        },
        ticket_package: {
          id: (row as any).ticket_package_id,
          name: (row as any).ticket_package_name,
          price: (row as any).ticket_package_price,
        },
        booking_details: {
          ticket_count: (row as any).ticket_count,
          total_price: Number((row as any).total_price),
          price_per_ticket: Number((row as any).ticket_count) > 0 ? Number((row as any).total_price) / Number((row as any).ticket_count) : 0,
        },
        payment_info: {
          payment_method: (row as any).payment_method || "N/A",
          payment_status: (row as any).payment_status || "pending",
          transaction_id: (row as any).transaction_id || "N/A",
          created_at: (row as any).created_at,
          paid_at: (row as any).paid_at,
          expiry_date: (row as any).expiry_date || null,
          expired,
          days_left: daysLeft,
        },
      };
      return json(mapped);
    }
    if (url.pathname === "/api/admin/dashboard/metrics" && request.method === "GET") {
      const moviesCount = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM movies WHERE is_active = 1`).first();
      const toysCount = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM toys`).first();
      const usersCount = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM users`).first();
      const txCountPaid = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE payment_status IN ('paid')`).first();
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999);
      const revenueTodayRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE payment_status IN ('paid') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(todayStart.toISOString(), todayEnd.toISOString(), todayStart.toISOString(), todayEnd.toISOString()).first();
      const revenueCashRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE payment_status IN ('paid') AND payment_method IN ('cash','Cash') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(todayStart.toISOString(), todayEnd.toISOString(), todayStart.toISOString(), todayEnd.toISOString()).first();
      const revenueMomoRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE payment_status IN ('paid') AND payment_method IN ('momo','MoMo') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(todayStart.toISOString(), todayEnd.toISOString(), todayStart.toISOString(), todayEnd.toISOString()).first();
      const revenueVnpRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE payment_status IN ('paid') AND payment_method IN ('vnpay','VNPay') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(todayStart.toISOString(), todayEnd.toISOString(), todayStart.toISOString(), todayEnd.toISOString()).first();
      const bookingsTodayRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE payment_status IN ('paid') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(todayStart.toISOString(), todayEnd.toISOString(), todayStart.toISOString(), todayEnd.toISOString()).first();
      const bookingsFutureRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE payment_status IN ('paid') AND created_at > ?`).bind(todayEnd.toISOString()).first();
      const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6);
      const weekRows = await env.cinema_db.prepare(`SELECT b.total_price, b.movie_id, m.title as movie_title FROM bookings b LEFT JOIN movies m ON m.id = b.movie_id WHERE b.payment_status IN ('paid') AND ((b.created_at BETWEEN ? AND ?) OR (b.paid_at BETWEEN ? AND ?))`).bind(weekStart.toISOString(), todayEnd.toISOString(), weekStart.toISOString(), todayEnd.toISOString()).all();
      const revMap = new Map<number, { title: string; revenue: number }>();
      for (const r of weekRows.results || []) {
        const id = Number((r as any).movie_id);
        const title = (r as any).movie_title || "";
        const price = Number((r as any).total_price || 0);
        if (id) {
          const prev = revMap.get(id) || { title, revenue: 0 };
          prev.revenue += price;
          prev.title = title || prev.title;
          revMap.set(id, prev);
        }
      }
      const topMoviesWeek = Array.from(revMap.entries()).map(([id, v]) => ({ id, title: v.title, revenue: v.revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
      return json({
        totalMovies: Number((moviesCount as any)?.c || 0),
        totalToys: Number((toysCount as any)?.c || 0),
        totalUsers: Number((usersCount as any)?.c || 0),
        totalTransactions: Number((txCountPaid as any)?.c || 0),
        revenueTotal: Number((revenueTodayRow as any)?.total || 0),
        revenueByMethod: {
          cash: Number((revenueCashRow as any)?.total || 0),
          momo: Number((revenueMomoRow as any)?.total || 0),
          vnpay: Number((revenueVnpRow as any)?.total || 0),
        },
        totalBookingsToday: Number((bookingsTodayRow as any)?.c || 0),
        totalBookingsFuture: Number((bookingsFutureRow as any)?.c || 0),
        topMoviesWeek,
      });
    }
    if (url.pathname === "/api/admin/dashboard/revenue-date" && request.method === "GET") {
      const dateStr = String(url.searchParams.get("date") || "");
      const status = String(url.searchParams.get("status") || "paid").toLowerCase();
      let where = "";
      const params: any[] = [];
      if (dateStr && dateStr !== "all") {
        const d = new Date(dateStr);
        const start = new Date(d); start.setHours(0,0,0,0);
        const end = new Date(d); end.setHours(23,59,59,999);
        where += ` AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`;
        params.push(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString());
      }
      if (status !== "all") {
        where += ` AND payment_status IN ('paid')`;
      }
      const totalRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE 1=1 ${where}`).bind(...params).first();
      const countRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE 1=1 ${where}`).bind(...params).first();
      const cashRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE 1=1 ${where} AND payment_method IN ('cash','Cash')`).bind(...params).first();
      const momoRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE 1=1 ${where} AND payment_method IN ('momo','MoMo')`).bind(...params).first();
      const vnpRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE 1=1 ${where} AND payment_method IN ('vnpay','VNPay')`).bind(...params).first();
      return json({
        date: dateStr || "all",
        total: Number((totalRow as any)?.total || 0),
        count: Number((countRow as any)?.c || 0),
        revenueByMethod: {
          cash: Number((cashRow as any)?.total || 0),
          momo: Number((momoRow as any)?.total || 0),
          vnpay: Number((vnpRow as any)?.total || 0),
        },
      });
    }
    if (url.pathname === "/api/admin/dashboard/revenue-7days" && request.method === "GET") {
      const today = new Date(); today.setHours(0,0,0,0);
      const data: Array<{ day: string; revenue: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const dayDate = new Date(today); dayDate.setDate(dayDate.getDate() - i);
        const start = new Date(dayDate); start.setHours(0,0,0,0);
        const end = new Date(dayDate); end.setHours(23,59,59,999);
        const row = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE payment_status IN ('paid') AND ((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        const monthStr = String(dayDate.getMonth() + 1).padStart(2, "0");
        const dateStr = String(dayDate.getDate()).padStart(2, "0");
        data.push({ day: `${monthStr}-${dateStr}`, revenue: Number((row as any)?.total || 0) });
      }
      return json({ data });
    }
    if (url.pathname === "/api/admin/dashboard/revenue-month" && request.method === "GET") {
      const yearStr = String(url.searchParams.get("year") || "");
      const monthStr = String(url.searchParams.get("month") || "");
      const status = String(url.searchParams.get("status") || "paid").toLowerCase();
      if (monthStr && yearStr) {
        const year = Number(yearStr);
        const month = Number(monthStr);
        const start = new Date(year, month - 1, 1); start.setHours(0,0,0,0);
        const end = new Date(year, month, 0); end.setHours(23,59,59,999);
        let where = `((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`;
        if (status !== "all") where += ` AND payment_status IN ('paid')`;
        const totalRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE ${where}`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        const countRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE ${where}`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        const cashRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE ${where} AND payment_method IN ('cash','Cash')`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        const momoRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE ${where} AND payment_method IN ('momo','MoMo')`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        const vnpRow = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE ${where} AND payment_method IN ('vnpay','VNPay')`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        return json({
          total: Number((totalRow as any)?.total || 0),
          count: Number((countRow as any)?.c || 0),
          revenueByMethod: {
            cash: Number((cashRow as any)?.total || 0),
            momo: Number((momoRow as any)?.total || 0),
            vnpay: Number((vnpRow as any)?.total || 0),
          },
        });
      }
      const targetYear = yearStr ? Number(yearStr) : new Date().getFullYear();
      const data: Array<{ month: number; revenue: number }> = [];
      for (let m = 0; m < 12; m++) {
        const start = new Date(targetYear, m, 1); start.setHours(0,0,0,0);
        const end = new Date(targetYear, m + 1, 0); end.setHours(23,59,59,999);
        let where = `((created_at BETWEEN ? AND ?) OR (paid_at BETWEEN ? AND ?))`;
        if (status !== "all") where += ` AND payment_status IN ('paid')`;
        const row = await env.cinema_db.prepare(`SELECT SUM(total_price) as total FROM bookings WHERE ${where}`).bind(start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString()).first();
        data.push({ month: m + 1, revenue: Number((row as any)?.total || 0) });
      }
      return json({ year: targetYear, data });
    }
    if (url.pathname === "/api/usersprofile/transactions" && request.method === "GET") {
      const emailRaw = String(url.searchParams.get("email") || "");
      const status = String(url.searchParams.get("status") || "paid");
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 10);
      const sortKey = String(url.searchParams.get("sort") || "created_at");
      const dir = String(url.searchParams.get("dir") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
      const paymentMethod = String(url.searchParams.get("payment_method") || "");
      const fromStr = String(url.searchParams.get("from") || "");
      const toStr = String(url.searchParams.get("to") || "");
      const offset = (page - 1) * pageSize;
      let email = "";
      try { email = decodeURIComponent(emailRaw); } catch { email = emailRaw; }
      if (!email) return json({ items: [], page, pageSize, total: 0 });
      const acc = await env.cinema_db.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(email).first();
      if (!acc) return json({ items: [], page, pageSize, total: 0 });
      const whereParts: string[] = [`user_id = ?`];
      const bind: any[] = [Number((acc as any).user_id)];
      if (status && status.toLowerCase() === "paid") {
        whereParts.push(`payment_status IN ('paid')`);
      }
      if (paymentMethod) {
        whereParts.push(`payment_method = ?`);
        bind.push(paymentMethod);
      }
      if (fromStr && toStr) {
        whereParts.push(`(created_at BETWEEN ? AND ? OR paid_at BETWEEN ? AND ?)`);
        bind.push(fromStr, toStr, fromStr, toStr);
      } else if (fromStr) {
        whereParts.push(`(created_at >= ? OR paid_at >= ?)`);
        bind.push(fromStr, fromStr);
      } else if (toStr) {
        whereParts.push(`(created_at <= ? OR paid_at <= ?)`);
        bind.push(toStr, toStr);
      }
      const where = `WHERE ${whereParts.join(" AND ")}`;
      const totalRow = await env.cinema_db.prepare(`SELECT COUNT(*) as c FROM bookings ${where}`).bind(...bind).first();
      const rows = await env.cinema_db
        .prepare(
          `SELECT b.*, m.title as movie_title, m.cover_image as poster_url, t.name as ticket_package_name FROM bookings b LEFT JOIN movies m ON m.id = b.movie_id LEFT JOIN ticket_packages t ON t.id = b.ticket_package_id ${where} ORDER BY ${sortKey === "paid_at" ? "b.paid_at" : "b.created_at"} ${dir} LIMIT ? OFFSET ?`,
        )
        .bind(...bind, pageSize, offset)
        .all();
      const items = (rows.results || []).map((b: any) => {
        const now = Date.now();
        const expiryAt = b?.expiry_date ? new Date(b.expiry_date as any).getTime() : null;
        const expired = Boolean(expiryAt && now > expiryAt);
        const daysLeft = expiryAt ? Math.ceil((expiryAt - now) / (1000 * 60 * 60 * 24)) : null;
        const amount = Number(b?.total_price ?? 0);
        return {
          booking_id: b.id,
          booking_code: b.booking_code || null,
          user_id: b.user_id,
          movie: b.movie_title || "",
          ticket_package: b.ticket_package_name || "",
          quantity: Number(b.ticket_count ?? 0),
          amount,
          method: b.payment_method || "",
          payment_status: b.payment_status || "",
          created_at: b.created_at || null,
          paid_at: b.paid_at || null,
          expiry_date: b.expiry_date || null,
          expired,
          days_left: daysLeft,
          is_used: Boolean(b.is_used),
          name: b.name || "",
          phone: b.phone || "",
          email: b.email || email,
          poster_url: b.poster_url || null,
        };
      });
      return json({ items, page, pageSize, total: Number((totalRow as any)?.c || 0) });
    }
    if (url.pathname === "/api/debug/mail" && request.method === "GET") {
      const hasBrevo = Boolean(env.BREVO_API_KEY);
      const config = hasBrevo
        ? {
            provider: "brevo",
            endpoint: "https://api.brevo.com/v3/smtp/email",
            sender_email: String(env.BREVO_SENDER_EMAIL || "no-reply@example.com"),
            sender_name: String(env.BREVO_SENDER_NAME || "CTBOOKING"),
            has_api_key: true,
            configured: true,
          }
        : {
            provider: "mailchannels",
            endpoint: "https://api.mailchannels.net/tx/v1/send",
            sender_email: String(env.GMAIL_SENDER_EMAIL || "no-reply@example.com"),
            sender_name: String(env.GMAIL_SENDER_NAME || "CTBOOKING"),
            has_sender_email: Boolean(env.GMAIL_SENDER_EMAIL),
            configured: Boolean(env.GMAIL_SENDER_EMAIL),
          };
      const verify = config.configured ? { ok: true } : { ok: false, message: "Missing mail configuration" };
      return json({ config, verify });
    }
    if (url.pathname === "/api/debug/mail/send" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const to = String(body?.to || "");
      if (!to) return badRequest("Thiếu email");
      const html = `<html><body><h3>Test gửi mail</h3><p>Thời gian: ${new Date().toISOString()}</p></body></html>`;
      const r = await sendMail(env, to, "Test gửi mail từ Worker", html);
      return json({ ok: r.ok, status: r.status, body: r.body });
    }
    return notFound();
  },
};
