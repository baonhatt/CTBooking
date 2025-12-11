import "dotenv/config";
import { Resend } from 'resend'; // 1. Thay thế nodemailer bằng Resend

// --- Cấu hình SMTP cũ đã được loại bỏ ---
// const transporter = nodemailer.createTransport({...}); 

// 2. Khởi tạo Resend SDK
// Khóa API sẽ được đọc từ process.env.RESEND_API_KEY
const resend = new Resend(process.env.RESEND_API_KEY);

// 3. Định nghĩa email người gửi đã được xác minh trên Resend
// Bắt buộc phải là email đã được Resend chấp thuận
const SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || "info@yourdomain.com"; // <-- Cần đặt biến này trong ENV!


export async function sendMail(toEmail, subject, text) {
  // 4. Thay đổi logic gửi mail từ transporter.sendMail sang resend.emails.send
  try {
    const { data, error } = await resend.emails.send({
      from: `CTBOOKING <${SENDER_EMAIL}>`, // Sử dụng email đã xác minh
      to: [toEmail], // Resend nhận mảng email
      subject: subject,
      html: text,
    });

    if (error) {
      console.error("Resend API Error:", error);
      throw new Error(error.message);
    }

    console.log("Email sent successfully via Resend. ID:", data.id);
    return data;
  } catch (error) {
    console.error("Error sending mail (Resend):", error);
    throw error;
  }
}