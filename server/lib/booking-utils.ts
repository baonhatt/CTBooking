import { prisma } from "./prisma";

/**
 * Generate unique booking code (8 random alphanumeric characters)
 * Check database to avoid duplicates
 * Format: XXXXXXXX (e.g., A7K9M2B5)
 */
export async function generateBookingCode(): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let isUnique = false;
  let bookingCode = "";

  while (!isUnique) {
    // Generate random string (8 chars)
    bookingCode = "";
    for (let i = 0; i < 8; i++) {
      bookingCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if code already exists in database
    const existing = await prisma.bookings.findUnique({
      where: { booking_code: bookingCode },
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return bookingCode;
}

/**
 * Email template for booking confirmation
 */
export function getBookingEmailTemplate(data: {
  bookingCode: string;
  customerName: string;
  movieTitle: string;
  showtimeDate: string;
  showtimeTime: string;
  ticketCount: number;
  totalPrice: string;
  movieImage?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xác nhận đặt vé - CINESPHERE</title>
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
        }
        .greeting {
            font-size: 16px;
            color: #333;
            margin-bottom: 20px;
        }
        .booking-code-box {
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .booking-code-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        .booking-code {
            font-size: 32px;
            font-weight: 700;
            color: #667eea;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
        }
        .details-section {
            margin: 25px 0;
        }
        .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            text-transform: uppercase;
            margin-bottom: 15px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 8px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            color: #666;
            font-weight: 500;
        }
        .detail-value {
            color: #333;
            font-weight: 600;
        }
        .price-highlight {
            color: #27ae60;
            font-size: 18px;
        }
        .movie-poster {
            width: 100%;
            max-width: 200px;
            margin: 15px auto;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin: 15px 0;
            border-radius: 4px;
            font-size: 13px;
            color: #856404;
        }
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
                Cảm ơn bạn đã đặt vé tại CINESPHERE. Đơn hàng của bạn đã được xác nhận.
            </div>

            <div class="booking-code-box">
                <div class="booking-code-label">Mã đặt vé của bạn</div>
                <div class="booking-code">${data.bookingCode}</div>
                <div style="font-size: 12px; color: #999; margin-top: 10px;">
                    Vui lòng lưu lại mã này để check-in tại rạp
                </div>
            </div>

            ${data.movieImage ? `<img src="${data.movieImage}" alt="${data.movieTitle}" class="movie-poster">` : ""}

            <div class="details-section">
                <div class="section-title">Thông tin phim</div>
                <div class="detail-row">
                    <span class="detail-label">Tên phim</span>
                    <span class="detail-value">${data.movieTitle}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Ngày chiếu</span>
                    <span class="detail-value">${data.showtimeDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Giờ chiếu</span>
                    <span class="detail-value">${data.showtimeTime}</span>
                </div>
            </div>

            <div class="details-section">
                <div class="section-title">Chi tiết đơn hàng</div>
                <div class="detail-row">
                    <span class="detail-label">Số lượng vé</span>
                    <span class="detail-value">${data.ticketCount} vé</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Tổng tiền</span>
                    <span class="detail-value price-highlight">${data.totalPrice}₫</span>
                </div>
            </div>

            <div class="warning">
                ⏰ <strong>Lưu ý:</strong> Vui lòng đến rạp trước 10 phút so với giờ chiếu. 
                Mang theo mã đặt vé hoặc số điện thoại để nhân viên xác nhận.
            </div>
        </div>

        <div class="footer">
            <p><strong>CINESPHERE - Rạp chiếu phim hiện đại</strong></p>
            <p>Email: support@cinesphere.com | Hotline: 1900-xxxx</p>
            <p style="margin-top: 15px; color: #999;">
                Đây là email tự động, vui lòng không trả lời email này.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}
