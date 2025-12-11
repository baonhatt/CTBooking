import "dotenv/config";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587, // <-- Thay đổi sang cổng STARTTLS
  secure: false, // <-- Phải là false khi dùng cổng 587
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS, // Đã xác nhận là App Password
  },
  requireTLS: true, // Yêu cầu sử dụng STARTTLS
  // Tăng timeout để tránh lỗi ETIMEDOUT trong môi trường đám mây
  timeout: 30000,
  socketTimeout: 60000,
});

export async function sendMail(toEmail, subject, text) {
  const mailOptions = {
    from: `"Your App Name" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    return info;
  } catch (error) {
    console.error("Error sending mail:", error);
    throw error;
  }
}
