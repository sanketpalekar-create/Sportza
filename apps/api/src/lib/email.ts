import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpEmail(to: string, otp: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@sportza.com",
    to,
    subject: "Your Sportza verification code",
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px;">
        <h2 style="color:#3B82F6;">Sportza</h2>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#F1F5F9;border-radius:8px;margin:16px 0;">
          ${otp}
        </div>
        <p style="color:#64748B;font-size:14px;">This code expires in 5 minutes.</p>
      </div>
    `,
  });
}

export async function sendMagicLinkEmail(to: string, link: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@sportza.com",
    to,
    subject: "Sign in to Sportza",
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px;">
        <h2 style="color:#3B82F6;">Sportza</h2>
        <p>Click the button below to sign in:</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:white;text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0;">
          Sign In
        </a>
        <p style="color:#64748B;font-size:14px;">This link expires in 15 minutes.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, link: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@sportza.com",
    to,
    subject: "Reset your Sportza password",
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px;">
        <h2 style="color:#3B82F6;">Sportza</h2>
        <p>We received a request to reset your password. Click the button below:</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:white;text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0;">
          Reset Password
        </a>
        <p style="color:#64748B;font-size:14px;">This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendBookingConfirmation(to: string, booking: Record<string, any>) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@sportza.com",
    to,
    subject: "Booking Confirmed — Sportza",
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px;">
        <h2 style="color:#3B82F6;">Booking Confirmed!</h2>
        <p><strong>${booking.venueName}</strong></p>
        <p>${booking.date} | ${booking.startTime} - ${booking.endTime}</p>
        <p>Amount: ₹${booking.totalAmount}</p>
        <p style="color:#64748B;font-size:14px;">Booking ID: #${booking.id}</p>
      </div>
    `,
  });
}

export default transporter;
