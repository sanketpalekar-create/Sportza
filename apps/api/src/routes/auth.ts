import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { BadRequestError, UnauthorizedError } from "../lib/errors";
import { initializeRatingsForAllSports } from "../services/elo";
import { setOtp, getOtp, deleteOtp, rateLimit } from "../lib/redis";
import { addEmailJob } from "../lib/queue";
import { createNotification, createBulkNotifications, NotifType } from "../services/notificationService";
const router: Router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "sportza_dev_secret_change_in_production";
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const ACCESS_TOKEN_EXPIRY = "15m";
const COOKIE_NAME = "sportza_refresh";

// ─── Token helpers ──────────────────────────────────────────

function signAccessToken(userId: number, role: string): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

async function createRefreshToken(userId: number): Promise<string> {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId, token, expiresAt } });
  return token;
}

async function rotateRefreshToken(oldToken: string, userId: number): Promise<string> {
  await prisma.refreshToken.updateMany({ where: { token: oldToken }, data: { revoked: true } });
  return createRefreshToken(userId);
}

function setRefreshCookie(res: Response, token: string, persist: boolean) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: persist ? REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000 : undefined,
    path: "/",
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", path: "/" });
}

async function issueTokens(
  res: Response,
  userId: number,
  role: string,
  keepLoggedIn: boolean
): Promise<{ accessToken: string }> {
  const accessToken = signAccessToken(userId, role);
  if (keepLoggedIn) {
    const refreshToken = await createRefreshToken(userId);
    setRefreshCookie(res, refreshToken, true);
  }
  return { accessToken };
}

function stripSensitiveFields(user: any) {
  const { password: _, googleId: _g, facebookId: _f, ...safe } = user;
  return safe;
}

// ─── Schemas ────────────────────────────────────────────────

const otpBodySchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

const verifyOtpBodySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "OTP must be 6 digits"),
  name: z.string().optional(),
  keepLoggedIn: z.boolean().optional().default(true),
});

const phoneOtpBodySchema = z.object({
  phone: z.string().min(7, "Enter a valid phone number"),
  name: z.string().optional(),
});

const verifyPhoneOtpBodySchema = z.object({
  phone: z.string().min(7),
  code: z.string().length(6, "OTP must be 6 digits"),
  name: z.string().optional(),
  keepLoggedIn: z.boolean().optional().default(true),
});

const magicLinkBodySchema = z.object({
  email: z.string().email(),
});

const callbackBodySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  sub: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

const loginPasswordSchema = z.object({
  identifier: z.string().min(3, "Enter email or phone"),
  password: z.string().min(1, "Password is required"),
  keepLoggedIn: z.boolean().optional().default(true),
});

const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const forgotPasswordSchema = z.object({
  identifier: z.string().min(3, "Enter email or phone"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255).optional(),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20).optional().nullable(),
  email: z.string().email().optional(),
  avatar: z.string().trim().url("Enter a valid image URL").max(500).optional().nullable(),
  location: z.object({
    country: z.string().default("India"),
    state:   z.string().min(1),
    city:    z.string().min(1),
    pincode: z.string().max(10).optional(),
    address: z.string().max(500).optional(),
  }).optional().nullable(),
  sports: z.union([z.array(z.number().int().positive()), z.record(z.unknown())]).nullable().optional(),
});

// ─── OpenAPI ────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: "/auth/otp",
  summary: "Send OTP to email",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: otpBodySchema } } } },
  responses: {
    200: { description: "OTP sent successfully" },
    429: { description: "Rate limit exceeded" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/verify-otp",
  summary: "Verify OTP and return tokens",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: verifyOtpBodySchema } } } },
  responses: {
    200: { description: "OTP verified, tokens returned" },
    400: { description: "Invalid or expired OTP" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/magic-link",
  summary: "Send magic link to email",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: magicLinkBodySchema } } } },
  responses: {
    200: { description: "Magic link sent" },
    429: { description: "Rate limit exceeded" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/callback",
  summary: "Auth0 callback - sync user to DB",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: callbackBodySchema } } } },
  responses: {
    200: { description: "User synced" },
    400: { description: "Invalid callback data" },
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  summary: "Get current authenticated user profile",
  tags: ["Auth"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Current user profile" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/auth/me",
  summary: "Update current user profile fields",
  tags: ["Auth"],
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: updateProfileSchema } } } },
  responses: {
    200: { description: "Updated user profile" },
    400: { description: "Validation error or phone conflict" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/auth/me",
  summary: "Anonymize and delete current user account",
  tags: ["Auth"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Account deleted successfully" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  summary: "Refresh access token using refresh token cookie",
  tags: ["Auth"],
  responses: {
    200: { description: "New access token" },
    401: { description: "Invalid or expired refresh token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  summary: "Login with email/phone and password",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: loginPasswordSchema } } } },
  responses: {
    200: { description: "Login successful, tokens returned" },
    401: { description: "Invalid credentials" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/set-password",
  summary: "Set or update password for current user",
  tags: ["Auth"],
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: setPasswordSchema } } } },
  responses: {
    200: { description: "Password set successfully" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/forgot-password",
  summary: "Send password reset link",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: forgotPasswordSchema } } } },
  responses: {
    200: { description: "Reset link sent if account exists" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/reset-password",
  summary: "Reset password using token from email",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: resetPasswordSchema } } } },
  responses: {
    200: { description: "Password reset successfully" },
    400: { description: "Invalid or expired token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  summary: "Logout and invalidate refresh token",
  tags: ["Auth"],
  responses: {
    200: { description: "Logged out" },
  },
});

// ─── Email OTP ───────────────────────────────────────────────

router.post(
  "/otp",
  validate({ body: otpBodySchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { email } = req.body as z.infer<typeof otpBodySchema>;
      const key = `otp:${email}`;
      const allowed = await rateLimit(key, 5, 300);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many OTP requests. Try again later.",
        });
      }
      const code = crypto.randomInt(100000, 999999).toString();
      await setOtp(email, code, 300);
      await addEmailJob("otp", { to: email, otp: code });
      res.json({ success: true, message: "OTP sent to email" });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/verify-otp",
  validate({ body: verifyOtpBodySchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { email, code, name, keepLoggedIn } = req.body as z.infer<typeof verifyOtpBodySchema>;

      const verifyKey = `verify:${email}`;
      const allowed = await rateLimit(verifyKey, 5, 600);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many verification attempts. Try again later.",
        });
      }

      const stored = await getOtp(email);
      if (!stored || stored !== code) {
        return next(new BadRequestError("Invalid or expired OTP"));
      }
      await deleteOtp(email);

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: { email, name: name || email.split("@")[0], role: "player" },
        });
        await initializeRatingsForAllSports(user.id);
      } else if (name && !user.name) {
        user = await prisma.user.update({ where: { id: user.id }, data: { name } });
      }

      // Ensure all active sports have a rating row (idempotent — fills only missing ones)
      await initializeRatingsForAllSports(user.id);

      const { accessToken } = await issueTokens(res, user.id, user.role, keepLoggedIn);
      const hasPassword = !!user.password;

      res.json({
        success: true,
        token: accessToken,
        user: stripSensitiveFields(user),
        hasPassword,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Phone OTP ───────────────────────────────────────────────

router.post(
  "/phone-otp",
  validate({ body: phoneOtpBodySchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { phone } = req.body as z.infer<typeof phoneOtpBodySchema>;
      const key = `otp:phone:${phone}`;
      const allowed = await rateLimit(key, 5, 300);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many OTP requests. Try again later.",
        });
      }
      const code = crypto.randomInt(100000, 999999).toString();
      await setOtp(`phone:${phone}`, code, 300);
      const isDev = process.env.NODE_ENV !== "production";
      if (isDev) {
        console.log(`[DEV] SMS OTP for ${phone}: ${code}`);
      }
      res.json({
        success: true,
        message: "OTP sent to phone",
        // Expose OTP in non-production for testing (no SMS provider configured)
        ...(isDev && { devOtp: code }),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/verify-phone-otp",
  validate({ body: verifyPhoneOtpBodySchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { phone, code, name, keepLoggedIn } = req.body as z.infer<typeof verifyPhoneOtpBodySchema>;

      const verifyKey = `verify:phone:${phone}`;
      const allowed = await rateLimit(verifyKey, 5, 600);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many verification attempts. Try again later.",
        });
      }

      const stored = await getOtp(`phone:${phone}`);
      if (!stored || stored !== code) {
        return next(new BadRequestError("Invalid or expired OTP"));
      }
      await deleteOtp(`phone:${phone}`);

      let user = await prisma.user.findFirst({ where: { phone } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            phone,
            name: name || `User${phone.slice(-4)}`,
            role: "player",
            email: `phone_${phone.replace(/\D/g, "")}@sportza.local`,
          },
        });
        await initializeRatingsForAllSports(user.id);
      } else if (name && !user.name) {
        user = await prisma.user.update({ where: { id: user.id }, data: { name } });
      }

      // Ensure all active sports have a rating row (idempotent — fills only missing ones)
      await initializeRatingsForAllSports(user.id);

      const { accessToken } = await issueTokens(res, user.id, user.role, keepLoggedIn);
      const hasPassword = !!user.password;

      res.json({
        success: true,
        token: accessToken,
        user: stripSensitiveFields(user),
        hasPassword,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Password Login ──────────────────────────────────────────

router.post(
  "/login",
  validate({ body: loginPasswordSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { identifier, password, keepLoggedIn } = req.body as z.infer<typeof loginPasswordSchema>;

      const verifyKey = `login:${identifier}`;
      const allowed = await rateLimit(verifyKey, 10, 600);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many login attempts. Try again later.",
        });
      }

      const isEmail = identifier.includes("@");
      const user = isEmail
        ? await prisma.user.findUnique({ where: { email: identifier } })
        : await prisma.user.findFirst({ where: { phone: identifier } });

      if (!user || !user.password) {
        return next(new UnauthorizedError("Invalid credentials"));
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return next(new UnauthorizedError("Invalid credentials"));
      }

      await initializeRatingsForAllSports(user.id);

      const { accessToken } = await issueTokens(res, user.id, user.role, keepLoggedIn);

      res.json({
        success: true,
        token: accessToken,
        user: stripSensitiveFields(user),
        hasPassword: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Refresh Token ───────────────────────────────────────────

router.post("/refresh", async (req: Request, res: Response, next) => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME];
    if (!refreshToken) {
      return next(new UnauthorizedError("No refresh token"));
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      clearRefreshCookie(res);
      return next(new UnauthorizedError("Invalid or expired refresh token"));
    }

    const user = await prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, role: true },
    });
    if (!user) {
      clearRefreshCookie(res);
      return next(new UnauthorizedError("User not found"));
    }

    await initializeRatingsForAllSports(user.id);

    const newRefreshToken = await rotateRefreshToken(refreshToken, user.id);
    setRefreshCookie(res, newRefreshToken, true);
    const accessToken = signAccessToken(user.id, user.role);

    res.json({ success: true, token: accessToken });
  } catch (err) {
    next(err);
  }
});

// ─── Logout ──────────────────────────────────────────────────

router.post("/logout", async (req: Request, res: Response, next) => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME];
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      });
    }
    clearRefreshCookie(res);
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    next(err);
  }
});

// ─── Set Password ────────────────────────────────────────────

router.post(
  "/set-password",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: setPasswordSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { password } = req.body as z.infer<typeof setPasswordSchema>;
      const hashed = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: req.userId! },
        data: { password: hashed },
      });
      res.json({ success: true, message: "Password set successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Forgot Password ─────────────────────────────────────────

router.post(
  "/forgot-password",
  validate({ body: forgotPasswordSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { identifier } = req.body as z.infer<typeof forgotPasswordSchema>;

      const rateLimitKey = `forgot:${identifier}`;
      const allowed = await rateLimit(rateLimitKey, 3, 600);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many reset requests. Try again later.",
        });
      }

      const isEmail = identifier.includes("@");
      const user = isEmail
        ? await prisma.user.findUnique({ where: { email: identifier } })
        : await prisma.user.findFirst({ where: { phone: identifier } });

      // Always respond success to prevent user enumeration
      if (!user || !user.email || user.email.endsWith("@sportza.local")) {
        return res.json({ success: true, message: "If an account exists, a reset link has been sent." });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      await setOtp(`reset:${resetToken}`, String(user.id), 900);

      const baseUrl = process.env.CLIENT_ORIGIN || "http://localhost:5173";
      const link = `${baseUrl}/reset-password?token=${resetToken}`;
      await addEmailJob("reset-password", { to: user.email, link });

      res.json({ success: true, message: "If an account exists, a reset link has been sent." });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Reset Password ──────────────────────────────────────────

router.post(
  "/reset-password",
  validate({ body: resetPasswordSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { token, password } = req.body as z.infer<typeof resetPasswordSchema>;

      const userIdStr = await getOtp(`reset:${token}`);
      if (!userIdStr) {
        return next(new BadRequestError("Invalid or expired reset token"));
      }

      const userId = parseInt(userIdStr, 10);
      if (isNaN(userId) || userId <= 0) {
        return next(new BadRequestError("Invalid reset token"));
      }
      const hashed = await bcrypt.hash(password, 12);

      await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
      await deleteOtp(`reset:${token}`);

      // Revoke all refresh tokens for security
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
      });

      // Notify user of the password change (non-blocking)
      void createNotification(
        userId,
        NotifType.PASSWORD_CHANGED,
        "Password changed",
        "Your Sportza password was just changed. If this wasn't you, please contact support immediately.",
        {}
      );

      res.json({ success: true, message: "Password reset successfully. Please log in." });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Magic Link ──────────────────────────────────────────────

router.post(
  "/magic-link",
  validate({ body: magicLinkBodySchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { email } = req.body as z.infer<typeof magicLinkBodySchema>;
      const key = `magic:${email}`;
      const allowed = await rateLimit(key, 5, 300);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many magic link requests. Try again later.",
        });
      }
      const token = crypto.randomBytes(32).toString("hex");
      await setOtp(`magic:${token}`, email, 900);
      const baseUrl = process.env.CLIENT_ORIGIN || "http://localhost:5173";
      const link = `${baseUrl}/auth/callback?token=${token}`;
      await addEmailJob("magic-link", { to: email, link });
      res.json({ success: true, message: "Magic link sent to email" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Magic Link Verify ───────────────────────────────────────

router.get("/magic-link/verify", async (req: Request, res: Response, next) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) return next(new BadRequestError("Missing token"));

    const email = await getOtp(`magic:${token}`);
    if (!email) return next(new BadRequestError("Invalid or expired magic link"));

    await deleteOtp(`magic:${token}`);

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: email.split("@")[0], role: "player" },
      });
      await initializeRatingsForAllSports(user.id);
    }

    // Ensure all active sports have a rating row (idempotent — fills only missing ones)
    await initializeRatingsForAllSports(user.id);

    const { accessToken } = await issueTokens(res, user.id, user.role, true);

    res.json({
      success: true,
      token: accessToken,
      user: stripSensitiveFields(user),
    });
  } catch (err) {
    next(err);
  }
});

// ─── Auth0 Callback ──────────────────────────────────────────

router.post(
  "/callback",
  validate({ body: callbackBodySchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { sub, email, name } = req.body as z.infer<typeof callbackBodySchema>;
      if (!email && !sub) {
        return next(new BadRequestError("Missing email or sub"));
      }
      const lookupEmail = email || `auth0_${sub}@placeholder.local`;
      let user = await prisma.user.findFirst({
        where: email
          ? { email }
          : { OR: [{ googleId: sub }, { facebookId: sub }] },
      });
      if (!user && email) {
        user = await prisma.user.create({
          data: {
            email: lookupEmail,
            name: name || email?.split("@")[0] || "User",
            googleId: sub?.startsWith("google") ? sub : undefined,
            facebookId: sub?.startsWith("facebook") ? sub : undefined,
            role: "player",
          },
        });
        await initializeRatingsForAllSports(user.id);
      } else if (user && sub && !user.googleId && !user.facebookId) {
        const updateData: { googleId?: string; facebookId?: string } = {};
        if (sub?.startsWith("google") || sub?.includes("google")) updateData.googleId = sub;
        if (sub?.startsWith("facebook") || sub?.includes("facebook")) updateData.facebookId = sub;
        if (Object.keys(updateData).length > 0) {
          user = await prisma.user.update({ where: { id: user.id }, data: updateData });
        }
      }
      if (!user) {
        return next(new BadRequestError("Could not sync user"));
      }

      // Ensure all active sports have a rating row (idempotent — fills only missing ones)
      await initializeRatingsForAllSports(user.id);

      res.json({ success: true, user: stripSensitiveFields(user) });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Google OAuth ────────────────────────────────────────────

const googleBodySchema = z.object({
  credential:   z.string().optional(),
  accessToken:  z.string().optional(),
  keepLoggedIn: z.boolean().optional().default(false),
}).refine((d) => d.credential || d.accessToken, {
  message: "Either credential or accessToken is required",
});

registry.registerPath({
  method: "post",
  path: "/auth/google",
  summary: "Sign in / sign up with Google (One Tap credential or popup access token)",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: googleBodySchema } } } },
  responses: {
    200: { description: "Authenticated — returns access token and user" },
    400: { description: "Invalid Google token" },
  },
});

router.post(
  "/google",
  validate({ body: googleBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { credential, accessToken: googleAccessToken, keepLoggedIn } = req.body as z.infer<typeof googleBodySchema>;

      let googleId: string, email: string, name: string | undefined, picture: string | undefined;

      if (credential) {
        // One Tap path: verify signed ID token
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
          return next(new BadRequestError("Google sign-in is not configured on this server"));
        }
        try {
          const client = new OAuth2Client(clientId);
          const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
          const payload = ticket.getPayload()!;
          googleId = payload.sub;
          email    = payload.email!;
          name     = payload.name;
          picture  = payload.picture;
        } catch {
          return next(new BadRequestError("Invalid Google credential"));
        }
      } else {
        // Popup path: exchange access token for profile via Google userinfo
        try {
          const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${googleAccessToken}` },
          });
          if (!resp.ok) throw new Error("userinfo failed");
          const profile = await resp.json();
          googleId = profile.sub;
          email    = profile.email;
          name     = profile.name;
          picture  = profile.picture;
        } catch {
          return next(new BadRequestError("Invalid Google access token"));
        }
      }

      if (!email) {
        return next(new BadRequestError("Google account has no email"));
      }

      let user = await prisma.user.findFirst({
        where: { OR: [{ googleId }, { email }] },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: name || email.split("@")[0],
            googleId,
            avatar: picture ?? null,
            role: "player",
          },
        });
        await initializeRatingsForAllSports(user.id);
      } else if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, avatar: user.avatar ?? picture ?? null },
        });
      }

      // Ensure all active sports have a rating row (idempotent — fills only missing ones)
      await initializeRatingsForAllSports(user.id);

      const { accessToken } = await issueTokens(res, user.id, user.role, keepLoggedIn ?? false);
      res.json({ success: true, token: accessToken, user: stripSensitiveFields(user) });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Current User ────────────────────────────────────────────

router.get(
  "/me",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next) => {
    try {
      await initializeRatingsForAllSports(req.userId!);

      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
      });
      if (!user) return next(new BadRequestError("User not found"));

      const location = user.locationId
        ? await prisma.location.findUnique({
            where: { id: user.locationId },
            select: { city: true, state: true, country: true, pincode: true, address: true },
          })
        : null;

      const { password, googleId, facebookId, ...rest } = user;
      res.json({
        success: true,
        user: {
          id: rest.id,
          name: rest.name,
          email: rest.email,
          phone: rest.phone,
          avatar: rest.avatar,
          role: rest.role,
          location,
          sports: rest.sports,
          createdAt: rest.createdAt,
          hasPassword: !!password,
          hasGoogle: !!googleId,
          hasFacebook: !!facebookId,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/me",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next) => {
    try {
      const userId = req.userId!;
      const ts = Date.now();

      // Revoke all refresh tokens first
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
      });

      // Anonymize the account — clears all PII while preserving referential integrity
      await prisma.user.update({
        where: { id: userId },
        data: {
          name: `Deleted User`,
          email: `deleted_${userId}_${ts}@sportza.invalid`,
          phone: null,
          avatar: null,
          password: null,
          googleId: null,
          facebookId: null,
          locationId: null,
          sports: Prisma.JsonNull,
        },
      });

      clearRefreshCookie(res);
      res.json({ success: true, message: "Account deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/me",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: updateProfileSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const data = req.body as z.infer<typeof updateProfileSchema>;

      // If phone is being set, check it is not already taken by another user
      if (data.phone) {
        const existing = await prisma.user.findFirst({
          where: { phone: data.phone, NOT: { id: req.userId! } },
          select: { id: true },
        });
        if (existing) {
          return next(new BadRequestError("This phone number is already linked to another account"));
        }
      }

      let newLocationId: number | undefined;
      if (data.location) {
        const { upsertLocation } = await import("../lib/location");
        newLocationId = await upsertLocation(data.location);
      } else if (data.location === null) {
        newLocationId = undefined;
      }

      const user = await prisma.user.update({
        where: { id: req.userId! },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.avatar !== undefined && { avatar: data.avatar }),
          ...(newLocationId !== undefined && { locationId: newLocationId }),
          ...(data.sports !== undefined && { sports: data.sports as any }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          role: true,
          location: { select: { city: true, state: true, country: true, pincode: true, address: true } },
          sports: true,
          googleId: true,
          facebookId: true,
          createdAt: true,
          password: true,
        },
      });

      const { password, googleId, facebookId, ...safeUser } = user;
      res.json({
        success: true,
        user: {
          ...safeUser,
          hasPassword: !!password,
          hasGoogle: !!googleId,
          hasFacebook: !!facebookId,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Role management ───────────────────────────────────────────────────────

const SWITCHABLE_ROLES = ["player", "coach", "trainer", "venue_owner"] as const;
type SwitchableRole = (typeof SWITCHABLE_ROLES)[number];

const roleChangeSchema = z.object({
  role: z.enum(SWITCHABLE_ROLES),
});

router.patch(
  "/me/role",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: roleChangeSchema }),
  async (req: Request, res: Response, next) => {
    try {
      const { role } = req.body as z.infer<typeof roleChangeSchema>;

      const current = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { role: true, onboardingStatus: true },
      });
      if (!current) return next(new BadRequestError("User not found"));

      const allowed = new Set<string>(["player", current.role]);
      if (current.role === "admin") {
        SWITCHABLE_ROLES.forEach((r) => allowed.add(r));
      }

      if (!allowed.has(role)) {
        // Players applying for a privileged role are queued for admin review
        const APPLICATION_ROLES = ["coach", "trainer", "venue_owner"];
        if (current.role === "player" && APPLICATION_ROLES.includes(role)) {
          // Block re-application while one is already pending
          if ((current as any).onboardingStatus === "pending") {
            return res.json({
              success: true,
              queued: true,
              message: "Your application is already pending admin review. You will be notified once it is processed.",
            });
          }

          const applicant = await prisma.user.update({
            where: { id: req.userId! },
            data: { onboardingStatus: "pending", onboardingNote: role },
            select: { id: true, name: true, email: true },
          });

          void createNotification(
            req.userId!,
            NotifType.ROLE_APPLICATION_QUEUED,
            "Application submitted",
            `Your application for the "${role}" role has been submitted and is pending admin review.`,
            { role }
          );

          const admins = await prisma.user.findMany({
            where: { role: "admin", isActive: true },
            select: { id: true },
          });
          if (admins.length > 0) {
            void createBulkNotifications(
              admins.map((a) => a.id),
              NotifType.ROLE_APPLICATION_RECEIVED,
              "New Role Application",
              `${applicant.name ?? applicant.email} applied for the "${role}" role.`,
              { applicantId: req.userId!, role }
            );
          }

          return res.json({
            success: true,
            queued: true,
            message: "Application submitted for admin review",
          });
        }

        return next(
          new BadRequestError(
            `You cannot switch to role "${role}". Your approved roles: ${[...allowed].join(", ")}`
          )
        );
      }

      const user = await prisma.user.update({
        where: { id: req.userId! },
        data: { role },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          role: true,
          location: { select: { city: true, state: true } },
          createdAt: true,
        },
      });

      // Notify user of the role switch (non-blocking)
      void createNotification(
        req.userId!,
        NotifType.ROLE_SWITCHED,
        `Switched to ${role}`,
        `You've switched to the "${role}" role. Explore what's available for you!`,
        { role }
      );

      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/me/roles",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { role: true },
      });
      if (!user) return next(new BadRequestError("User not found"));

      const available = Array.from(new Set(["player", user.role]));
      if (user.role === "admin") {
        SWITCHABLE_ROLES.forEach((r) => {
          if (!available.includes(r)) available.push(r);
        });
      }

      res.json({ success: true, roles: available, activeRole: user.role });
    } catch (err) {
      next(err);
    }
  }
);

// GET /users/search?q=<query> — search users by name/email/phone for player picker
router.get(
  "/users/search",
  jwtCheck,
  attachUser,
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = String(req.query.q ?? "").trim();
      if (q.length < 2) return res.json({ users: [] });
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name:  { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        },
        select: { id: true, name: true, email: true, phone: true, avatar: true },
        take: 10,
      });
      res.json({ users });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
