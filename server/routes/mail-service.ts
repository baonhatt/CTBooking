import "dotenv/config";
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

export async function sendMail(toEmail, subject, text) {

  const mailOptions = {
    from: `"Your App Name" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    text: text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending mail:', error);
    throw error;
  }
}
