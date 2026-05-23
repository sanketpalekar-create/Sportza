/**
 * Send OTP via SMS. Uses Twilio from env if configured.
 * If not configured, logs OTP to console for development.
 */
async function sendOtpSms(phone, otpCode) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.log('[DEV] SMS not configured. OTP for', phone, ':', otpCode);
    return { ok: true };
  }

  const toNumber = String(phone);
  try {
    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      body: `Your login code is ${otpCode}. Valid for 10 minutes.`,
      from: fromNumber,
      to: toNumber
    });
  } catch (err) {
    console.error('SMS send failed:', err.message);
    throw err;
  }
  return { ok: true };
}

module.exports = { sendOtpSms };
