import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError, ForbiddenError } from "../lib/errors";

declare global {
namespace Express {
interface Request {
userId?: number;
userRole?: string;
}
}
}

const JWT_SECRET = process.env.JWT_SECRET || "sportza_dev_secret_change_in_production";
const DEV_AUTH_FALLBACK_FLAG = "true";

function isDevAuthFallbackEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_FALLBACK === DEV_AUTH_FALLBACK_FLAG;
}

function getDevFallbackUserId(): number | null {
  const raw = process.env.DEV_FALLBACK_USER_ID;
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Validate the JWT from the Authorization header.
 * If invalid/missing, passes through so attachUser/requireAuth can handle.
 */
export const jwtCheck = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const raw = authHeader.slice(7);
    try {
      const payload = jwt.verify(raw, JWT_SECRET) as unknown as { sub: number; role: string };
      if (payload?.sub) {
        req.userId = payload.sub;
        req.userRole = payload.role ?? "player";
        return next();
      }
    } catch {
      // Invalid or expired token — proceed without auth
    }
  }
  next();
};

/**
 * Attach user context from previously validated auth.
 * This middleware no longer injects dev fallback users for protected routes.
 */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  if (req.userId && !req.userRole) {
    req.userRole = "player";
  }
  return next();
}

/**
 * ✅ Require authentication
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId) {
    return next(new UnauthorizedError());
  }
  next();
}

/**
 * ✅ Role-based access
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return next(new ForbiddenError("Insufficient permissions"));
    }
    next();
  };
}

/**
 * ✅ Optional auth (safe)
 * Tries JWT first; optional dev fallback only when explicitly enabled.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  jwtCheck(req, res, () => {
    if (req.userId) return next();
    if (isDevAuthFallbackEnabled()) {
      const fallbackId = getDevFallbackUserId();
      if (fallbackId) {
        req.userId = fallbackId;
        req.userRole = "player";
      }
    }
    next();
  });
}
