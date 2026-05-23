const nodemailer = require('nodemailer');

/**
 * Send OTP email. Uses SMTP from env (e.g. Gmail, SendGrid).
 * If no SMTP configured, logs OTP to console for development.
 */
async function sendOtpEmail(toEmail, otpCode, subject = 'Your login code') {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  };

  if (!config.host || !config.auth) {
    console.log('[DEV] OTP email not configured. OTP for', toEmail, ':', otpCode);
    return { ok: true };
  }

  const transporter = nodemailer.createTransport(config);
  const from = process.env.SMTP_FROM || config.auth.user;
  const html = `
    <p>Your one-time login code is: <strong>${otpCode}</strong></p>
    <p>It expires in 10 minutes. Do not share this code.</p>
  `;
  await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    html,
    text: `Your one-time login code is: ${otpCode}. It expires in 10 minutes.`
  });
  return { ok: true };
}

module.exports = { sendOtpEmail };
