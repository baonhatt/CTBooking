import { Context } from 'hono';

export const RL_MAX = 100;
export const RL_WINDOW_MS = 60_000;
// export const attempts = new Map<string, number[]>(); // Removed in-memory map

export async function checkRateLimitKV(env: any, ip: string): Promise<boolean> {
  if (!env.KV_BINDING) return true; // Skip if KV not available
  const key = `rate_limit:${ip}`;
  const now = Date.now();

  const historyStr = await env.KV_BINDING.get(key);
  let history: number[] = historyStr ? JSON.parse(historyStr) : [];

  // Filter old requests
  history = history.filter((ts) => now - ts < RL_WINDOW_MS);

  if (history.length >= RL_MAX) {
    return false;
  }

  history.push(now);
  // Save with TTL = 60s
  await env.KV_BINDING.put(key, JSON.stringify(history), { expirationTtl: 60 });

  return true;
}

export async function withCache(
  request: Request,
  env: any,
  ctx: any, // ThÃªm tham sá»‘ ctx (Ä‘Ã³ chÃ­nh lÃ  c.executionCtx)
  handler: () => Promise<Response>,
  ttl = 900
) {
  const cache = typeof caches !== 'undefined' ? (caches as any).default : null;

  if (!cache || request.method !== 'GET') {
    return await handler();
  }

  const cacheKey = new Request(request.url, request);
  let response = await cache.match(cacheKey);

  if (!response) {
    const originalResponse = await handler();

    if (originalResponse.status === 200) {
      response = new Response(originalResponse.body, originalResponse);
      response.headers.set('Cache-Control', `public, no-cache, s-maxage=${ttl}, must-revalidate`);

      // Sá»¬ Dá»¤NG ctx.waitUntil á»ž ÄÃ‚Y:
      // Viá»‡c ghi vÃ o cache sáº½ khÃ´ng lÃ m cháº­m request cá»§a khÃ¡ch
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
      return originalResponse;
    }
  } else {
    response = new Response(response.body, response);
    response.headers.set('X-Cache', 'HIT');
  }

  return response;
}

export async function deleteCache(env: any, fullUrl: string) {
  const cache = typeof caches !== 'undefined' ? (caches as any).default : null;
  if (!cache || !fullUrl) return;
  try {
    // ✅ Xóa mọi URL variant (bỏ qua query param)
    await cache.delete(new Request(fullUrl), { ignoreSearch: true });
    console.log(`[deleteCache] Cleared: ${fullUrl} (ignoring query params)`);
  } catch (e) {
    // Fallback nếu ignoreSearch không hỗ trợ
    try {
      await cache.delete(fullUrl);
      console.log(`[deleteCache] Fallback deleted: ${fullUrl}`);
    } catch (e2) {
      console.error('Cache clean error:', e2);
    }
  }
}

export async function hmacHex(algo: 'SHA-256' | 'SHA-512', key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: algo }, false, [
    'sign'
  ]);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  const bytes = new Uint8Array(signature as ArrayBuffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function logSystemError(context: string, error: any, payload?: any) {
  const timestamp = new Date().toISOString();
  const errorMsg = error?.message || String(error);
  const stack = error?.stack || 'No stack trace';
  const safePayload = payload ? { ...payload } : 'No payload';

  // Mask sensitive fields
  if (typeof safePayload === 'object' && safePayload !== null) {
    if ('password' in safePayload) safePayload.password = '***';
    if ('token' in safePayload) safePayload.token = '***';
  }

  console.error(`[${timestamp}] [ERROR] [${context}]`);
  console.error(`Message: ${errorMsg}`);
  console.error(`Stack: ${stack}`);
  console.error(`Payload:`, JSON.stringify(safePayload, null, 2));
}

// sendMail was moved to server/routes/mail-service.ts


export function formatCurrencyVi(amount: number): string {
  return `${Number(amount || 0).toLocaleString('vi-VN')}Ä‘`;
}

export function getBookingEmailTemplate(
  baseUrl: string,
  data: {
    bookingCode: string;
    customerName: string;
    movieTitle: string; // Nháº­n chuá»—i JSON: "["Phim A","Phim B"]"
    ticketCount: number;
    totalPrice: string;
    movieImage?: string;
    durationMin?: number | string; // Nháº­n chuá»—i JSON: "[10, 12]"
    ticketPackageName?: string;
    expiryDate?: string | Date | null;
    branchName?: string;
    branchAddress?: string;
    branchPhone?: string;
    branchSettings?: string;
  }
): string {
  // 1. Xá»¬ LÃ PARSE JSON CHO DANH SÃCH PHIM
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
  let hotline = data.branchPhone || '1900-xxxx';
  if (data.branchSettings) {
    try {
      const settings = JSON.parse(data.branchSettings);
      if (settings.hotline) hotline = settings.hotline;
    } catch (e) {}
  }

  // 2. Táº O HTML DANH SÃCH PHIM (Äá»“ng bá»™ giao diá»‡n Admin)
  const moviesListHtml = movieTitles
    .map(
      (title, index) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; margin-bottom: 6px; background-color: #f8f9fa; border-radius: 6px; border: 1px solid #edf2f7;">
        <span style="font-weight: 600; color: #2d3748; font-size: 14px;">ðŸŽ¬ ${title}</span>
        <span style="font-size: 11px; color: #a0aec0; font-weight: bold; background: #fff; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
          ${durations[index] || '--'} ph
        </span>
    </div>
  `
    )
    .join('');

  // 3. Xá»¬ LÃ CÃC THÃ€NH PHáº¦N KHÃC
  const pkgHtml = data.ticketPackageName
    ? `
    <div class="detail-row">
        <span class="detail-label">Loáº¡i vÃ©:</span>
        <span class="detail-value" style="color: #4a5568;">${data.ticketPackageName}</span>
    </div>`
    : ``;

  const branchHtml = data.branchName
    ? `
    <div class="detail-row">
        <span class="detail-label">Chi nhá»›nh:</span>
        <span class="detail-value" style="color: #4a5568;">${data.branchName}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Äá»‹a chá»‰:</span>
        <span class="detail-value" style="color: #4a5568; font-size: 12px;">${data.branchAddress || ''}</span>
    </div>`
    : ``;

  const expiryHtml = data.expiryDate
    ? `
    <div class="detail-row">
        <span class="detail-label">NgÃ y háº¿t háº¡n:</span>
        <span class="detail-value" style="color: #e53e3e;">${(() => {
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
        })()}</span>
    </div>`
    : ``;

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 30px; letter-spacing: 2px; text-transform: uppercase; }
        .content { padding: 30px; }
        .booking-code-box { background-color: #f0f4ff; border: 2px dashed #667eea; padding: 25px; margin: 20px 0; border-radius: 10px; text-align: center; }
        .booking-code { font-size: 40px; font-weight: 800; color: #667eea; font-family: 'Courier New', monospace; letter-spacing: 5px; }
        .section-title { font-size: 13px; font-weight: 700; color: #4a5568; text-transform: uppercase; margin: 25px 0 15px; border-bottom: 2px solid #edf2f7; padding-bottom: 8px; }
        .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f7fafc; font-size: 14px; }
        .detail-label { color: #718096; font-weight: 500; }
        .detail-value { color: #1a202c; font-weight: 700; }
        .footer { background-color: #f8f9fa; padding: 25px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CINESPHERE</h1>
            <p style="margin-top: 5px; opacity: 0.9;">XÁC NHẬN ĐẶT VÉ THÀNH CÔNG</p>
        </div>
        <div class="content">
            <div style="font-size: 16px; color: #2d3748; margin-bottom: 20px;">
                Xin chào <strong>${data.customerName}</strong>,<br>
                Đơn hàng của bạn đã được xác nhận. Vui lòng xuất trình mã vé dưới đây tại quầy soát vé.
            </div>
            
            <div class="booking-code-box">
                <div style="font-size: 12px; color: #718096; margin-bottom: 8px; font-weight: bold;">MÃ ĐẶT VÉ CỦA BẠN</div>
                <div class="booking-code">${data.bookingCode}</div>
            </div>

            <div class="section-title">Thông tin phim</div>
            ${moviesListHtml}

            <div class="section-title">Chi tiết đơn hàng</div>
            ${branchHtml}
            <div class="detail-row">
                <span class="detail-label">Số lượng vé:</span>
                <span class="detail-value" style="background: #fed7d7; color: #c53030; padding: 2px 8px; border-radius: 4px;">${data.ticketCount} VÉ</span>
            </div>
            ${pkgHtml}
            <div class="detail-row">
                <span class="detail-label">Tổng thanh toán:</span>
                <span class="detail-value" style="font-size: 18px; color: #38a169;">${data.totalPrice}đ</span>
            </div>
            ${expiryHtml}

            <div style="background-color: #fffaf0; border-left: 4px solid #f6ad55; padding: 15px; margin-top: 30px; border-radius: 4px;">
                <p style="margin: 0; font-size: 13px; color: #9c4221;">
                    ⏳ <strong>Lưu ý:</strong> Mang theo mã đặt vé để nhân viên quét xác nhận tại cổng.
                </p>
            </div>
        </div>
        <div class="footer">
            <p><strong>CINESPHERE - TRẢI NGHIỆM ĐIỆN ẢNH VŨ TRỤ</strong></p>
            <p>Email: cinesphere0629@gmail.com | Hotline: ${hotline}</p>
            <p style="margin-top: 15px;">Đây là email tự động, vui lòng không trả lời.</p>
        </div>
    </div>
</body>
</html>`;
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
                <p>Trân trọng,<br>Đội ngũ CINESPHERE</p>
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
  const buf = await crypto.subtle.digest('SHA-1', enc.encode(input));
  const bytes = new Uint8Array(buf as ArrayBuffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hasCloudinary(env: any) {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '');
  const apiKey = String(env.CLOUDINARY_API_KEY || '');
  const apiSecret = String(env.CLOUDINARY_API_SECRET || '');
  return Boolean(cloudName && apiKey && apiSecret);
}

export async function cloudinarySignedParams(env: any, params: Record<string, string | number>) {
  const apiKey = String(env.CLOUDINARY_API_KEY || '');
  const apiSecret = String(env.CLOUDINARY_API_SECRET || '');
  const keys = Object.keys(params).sort();
  const toSign = keys.map((k) => `${k}=${params[k]}`).join('&') + apiSecret;
  const signature = await sha1Hex(toSign);
  return { signature, api_key: apiKey };
}

export function optimizeCloudinaryUrl(url: string, width?: number) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return url;
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;
  const transformations = ['f_auto', 'q_auto'];
  if (width) transformations.push(`w_${width}`);
  const transformString = transformations.join(',');
  return `${parts[0]}/upload/${transformString}/${parts[1]}`;
}

export function getPublicIdFromUrl(url: string) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const rightPart = parts[1];
    // Remove version (v1234567890/) if present
    const versionRegex = /^v\d+\//;
    let path = rightPart.replace(versionRegex, '');
    // Remove extension
    const lastDotIndex = path.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      path = path.substring(0, lastDotIndex);
    }
    return path;
  } catch (e) {
    return null;
  }
}

export function optimizeCloudinaryVideoUrl(url: string, width?: number, quality: string = 'auto') {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return url;
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;
  const transformations = ['f_auto', `q_${quality}`, 'vc_auto', 'c_limit', 'br_3m'];
  if (width) transformations.push(`w_${width}`);
  return `${parts[0]}/upload/${transformations.join(',')}/${parts[1]}`;
}

export async function uploadCloudinaryImageDataURI(env: any, dataUri: string, folder: string) {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '');
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    timestamp,
    folder,
    use_filename: 'true',
    unique_filename: 'false',
    overwrite: 'true',
    transformation: 'q_auto,f_webp,w_1280,c_limit'
  };
  const signed = await cloudinarySignedParams(env, params);
  const form = new FormData();
  form.append('file', dataUri);
  form.append('folder', folder);
  form.append('use_filename', 'true');
  form.append('unique_filename', 'false');
  form.append('overwrite', 'true');
  form.append('timestamp', String(timestamp));
  form.append('api_key', signed.api_key);
  form.append('signature', signed.signature);
  form.append('transformation', 'q_auto,f_webp,w_1280,c_limit');
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const res = await fetch(endpoint, { method: 'POST', body: form });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(json?.error?.message || `Cloudinary ${res.status}`));
  return {
    url: String(json.secure_url || json.url || ''),
    height: Number(json.height || 0)
  };
}

export async function deleteCloudinaryImage(env: any, publicId: string, type: 'image' | 'video' = 'image') {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '');
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    public_id: publicId,
    timestamp
  };
  const signed = await cloudinarySignedParams(env, paramsToSign);

  const form = new FormData();
  form.append('public_id', publicId);
  form.append('timestamp', String(timestamp));
  form.append('api_key', signed.api_key);
  form.append('signature', signed.signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/destroy`;
  const res = await fetch(endpoint, { method: 'POST', body: form });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) console.error('Cloudinary delete error:', json);
  return json;
}

export { isLocal, parseMediaUrl, localUploader, localDeleter } from '../../server/lib/media-utils';

export async function pingIndexNow(env: any, urls: string[]): Promise<void> {
  const key = String(env.INDEXNOW_KEY || '');
  const baseHost = String(env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn').replace(/\/$/, '');
  if (!key || !urls.length) return;
  try {
    const hostname = new URL(baseHost).hostname;
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: hostname,
        key,
        keyLocation: `${baseHost}/${key}.txt`,
        urlList: urls
      })
    });
    console.log(`[IndexNow] ping ${urls.join(', ')} â†’ ${res.status}`);
  } catch (e) {
    console.error('[IndexNow] ping failed:', e);
  }
}

export async function generateSessionToken(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const formatDateForDb = (date: Date | string | null) => {
  if (!date) return null;

  const dateObj = date instanceof Date ? date : new Date(date);
  const iso = dateObj.toISOString();

  // Táº¥t cáº£ logic Ä‘Ã£ chuyá»ƒn sang Cloudflare Worker + D1 (SQLite)
  // D1 yÃªu cáº§u timestamp Ä‘Æ°á»£c insert dÆ°á»›i dáº¡ng chuá»—i
  // SQLite chuáº©n format: YYYY-MM-DD HH:MM:SS (khÃ´ng cÃ³ milliseconds)
  // Khá»›p vá»›i CURRENT_TIMESTAMP máº·c Ä‘á»‹nh cá»§a SQLite
  return iso.replace('T', ' ').replace('Z', '').split('.')[0];
};

export function calculateSessionExpiry(days: number = 30): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return formatDateForDb(now);
}

export function calculateSessionExpiryFromNow(hours: number = 24): string {
  const now = new Date();
  now.setHours(now.getHours() + hours);
  return formatDateForDb(now);
}
