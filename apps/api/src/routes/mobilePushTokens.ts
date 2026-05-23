import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { mobileFlags } from "../config/mobileFlags";
import { registerMobilePushToken } from "../services/mobilePushTokenService";

const router: Router = Router();

const registerTokenSchema = z.object({
  platform: z.enum(["ios", "android"]),
  token: z.string().min(10),
  appVersion: z.string().min(1).max(30),
  deviceId: z.string().min(1).max(191).optional(),
});

/**
 * POST /api/mobile-push-tokens
 * Native mobile contract for APNs/FCM token registration.
 * Kept independent from /api/push-subscriptions to preserve web behavior.
 */
router.post(
  "/",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: registerTokenSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!mobileFlags.pushMobileTokens) {
        return res.status(503).json({
          success: false,
          code: "FEATURE_DISABLED",
          message: "Mobile push tokens are not enabled",
        });
      }

      const userId = req.userId!;
      const payload = req.body as z.infer<typeof registerTokenSchema>;

      await registerMobilePushToken({
        userId,
        platform: payload.platform,
        token: payload.token,
        appVersion: payload.appVersion,
        deviceId: payload.deviceId,
      });

      res.json({
        success: true,
        message: "Mobile push token registered",
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
