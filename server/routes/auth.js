const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { verifyGoogleToken, verifyFacebookToken } = require('../utils/oauth');
const { sendOtpEmail } = require('../utils/email');
const { sendOtpSms } = require('../utils/sms');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function toUserPayload(user) {
  const payload = {
    id: user.id ?? user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    location: {
      city: user.locationCity || 'Pune',
      address: user.locationAddr,
      pincode: user.locationPin
    },
    sports: user.sports || [],
    avatar: user.avatar
  };
  if (user.role === 'trainer') {
    const tvs = await prisma.trainerVenue.findMany({ where: { userId: user.id }, select: { venueId: true } });
    payload.associatedVenues = tvs.map(t => t.venueId);
  }
  return payload;
}

// Register (password-based; password is stored hashed with bcrypt)
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').notEmpty().withMessage('Phone number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone, location, sports } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        locationCity: location?.city || 'Pune',
        locationAddr: location?.address,
        locationPin: location?.pincode,
        sports: sports || []
      }
    });

    // Generate token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: await toUserPayload(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login (password; password is stored encrypted with bcrypt)
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    if (!user.password) {
      return res.status(400).json({ message: 'Sign in with Google, Facebook, or OTP' });
    }

    // Check password (bcrypt comparison)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: await toUserPayload(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ----- OAuth -----

// POST /api/auth/google — body: { idToken }. Verify with Google, find or create user, return JWT.
router.post('/google', [
  body('idToken').notEmpty().withMessage('idToken is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { idToken } = req.body;
    const payload = await verifyGoogleToken(idToken);
    let user = await prisma.user.findFirst({
      where: { OR: [{ email: payload.email }, { googleId: payload.sub }] }
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name,
          googleId: payload.sub,
          avatar: payload.picture,
          locationCity: 'Pune'
        }
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: payload.sub,
          ...(payload.picture && { avatar: payload.picture }),
          ...(!user.name && payload.name && { name: payload.name })
        }
      });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: await toUserPayload(user) });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: err.message || 'Google sign-in failed' });
  }
});

// POST /api/auth/facebook — body: { accessToken }. Verify with Meta, find or create user, return JWT.
router.post('/facebook', [
  body('accessToken').notEmpty().withMessage('accessToken is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { accessToken } = req.body;
    const profile = await verifyFacebookToken(accessToken);
    if (!profile.email) {
      return res.status(400).json({ message: 'Facebook account must have email permission' });
    }
    let user = await prisma.user.findFirst({
      where: { OR: [{ email: profile.email }, { facebookId: profile.id }] }
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          facebookId: profile.id,
          locationCity: 'Pune'
        }
      });
    } else if (!user.facebookId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          facebookId: profile.id,
          ...(!user.name && profile.name && { name: profile.name })
        }
      });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: await toUserPayload(user) });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: err.message || 'Facebook sign-in failed' });
  }
});

// ----- OTP -----

// POST /api/auth/otp/request — body: { email } OR { phone }. Send 6-digit OTP to email or SMS.
router.post('/otp/request', [], async (req, res) => {
  try {
    const { email, phone } = req.body;
    const digitsOnly = phone ? String(phone).replace(/\D/g, '').trim() : '';
    const normalizedPhone = digitsOnly ? Number(digitsOnly) : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    if (!email && normalizedPhone == null) {
      return res.status(400).json({ message: 'Email or phone is required' });
    }
    if (email && normalizedPhone != null) {
      return res.status(400).json({ message: 'Send either email or phone, not both' });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    if (email) {
      const em = email.toLowerCase().trim();
      await prisma.otp.deleteMany({ where: { email: em } });
      await prisma.otp.create({ data: { email: em, code, expiresAt } });
      await sendOtpEmail(em, code);
      return res.json({ message: 'OTP sent to your email' });
    }
    await prisma.otp.deleteMany({ where: { phone: String(normalizedPhone) } });
    await prisma.otp.create({ data: { phone: String(normalizedPhone), code, expiresAt } });
    await sendOtpSms(normalizedPhone, code);
    res.json({ message: 'OTP sent to your phone' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// POST /api/auth/otp/verify — body: { email, otp } OR { phone, otp }. Verify OTP and return JWT.
router.post('/otp/verify', [], async (req, res) => {
  try {
    const { email, phone, otp } = req.body;
    const digitsOnly = phone ? String(phone).replace(/\D/g, '').trim() : '';
    const normalizedPhone = digitsOnly ? Number(digitsOnly) : null;
    if (!otp || !otp.trim()) {
      return res.status(400).json({ message: 'OTP is required' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    if (!email && (normalizedPhone == null || isNaN(normalizedPhone))) {
      return res.status(400).json({ message: 'Email or phone is required' });
    }
    if (email && normalizedPhone != null) {
      return res.status(400).json({ message: 'Provide either email or phone, not both' });
    }
    const code = otp.trim();
    let record;
    if (email) {
      record = await prisma.otp.findFirst({ where: { email: email.toLowerCase().trim(), code } });
    } else {
      record = await prisma.otp.findFirst({ where: { phone: String(normalizedPhone), code } });
    }
    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    if (new Date() > record.expiresAt) {
      await prisma.otp.delete({ where: { id: record.id } });
      return res.status(400).json({ message: 'OTP expired' });
    }
    await prisma.otp.delete({ where: { id: record.id } });
    let user;
    if (email) {
      const em = email.toLowerCase().trim();
      user = await prisma.user.findFirst({ where: { email: em } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: em,
            name: em.split('@')[0],
            locationCity: 'Pune'
          }
        });
      }
    } else {
      user = await prisma.user.findFirst({ where: { phone: String(normalizedPhone) } });
      if (!user) {
        const placeholderEmail = `phone_${normalizedPhone}@sportsvenue.local`;
        user = await prisma.user.create({
          data: {
            email: placeholderEmail,
            phone: String(normalizedPhone),
            name: String(normalizedPhone).slice(-4),
            locationCity: 'Pune'
          }
        });
      }
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: await toUserPayload(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Verification failed' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json({ user: await toUserPayload(req.user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
