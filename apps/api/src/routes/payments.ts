import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import prisma from "../lib/prisma";
import { registry } from "../lib/openapi";
import { validate } from "../middleware/validate";
import { jwtCheck, attachUser, requireAuth } from "../middleware/auth";
import { NotFoundError, BadRequestError } from "../lib/errors";
import { idParamSchema, paginationSchema } from "../schemas/common";
import { applyPaymentCaptured } from "../services/bookingConflict";
import { checkConfirmationThreshold } from "../services/openPlayConfirmations";
import { getWalletBalance } from "../services/wallet";
import { recordVenueConnections } from "../services/connections";
import { createNotification, createBulkNotifications, NotifType } from "../services/notificationService";

const router: Router = Router();

const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

// Either a single bookingId or a groupId (batch booking) must be supplied
const createOrderSchema = z
  .object({
    amount: z.coerce.number().positive(),
    bookingId: z.coerce.number().int().positive().optional(),
    groupId: z.string().optional(),
    currency: z.string().default("INR"),
  })
  .refine((d) => d.bookingId !== undefined || d.groupId !== undefined, {
    message: "Either bookingId or groupId is required",
  });

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

const webhookPayloadSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z
      .object({
        entity: z.object({
          id: z.string(),
          order_id: z.string(),
          status: z.string(),
        }),
      })
      .optional(),
  }),
});

function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expected === signature;
}

function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expected === signature;
}

// POST /create-order - Create Razorpay order for a booking
router.post(
  "/create-order",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: createOrderSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!razorpay) {
        throw new BadRequestError("Payment gateway not configured");
      }

      const { amount, bookingId, groupId, currency } = req.body as z.infer<
        typeof createOrderSchema
      >;
      const userId = req.userId!;

      // Resolve bookings — either a single booking or all in a group
      let bookings: { id: number; userId: number; paymentStatus: string; totalAmount: number; bookingType: string }[] = [];

      if (groupId) {
        bookings = await prisma.booking.findMany({
          where: { groupId, userId },
          select: { id: true, userId: true, paymentStatus: true, totalAmount: true, bookingType: true },
        });
        if (bookings.length === 0) throw new NotFoundError("Bookings for group");
        if (bookings.some((b) => b.paymentStatus === "completed")) {
          throw new BadRequestError("One or more bookings in this group are already paid");
        }
      } else {
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId! },
          select: { id: true, userId: true, paymentStatus: true, totalAmount: true, bookingType: true },
        });
        if (!booking) throw new NotFoundError("Booking");

        // For split/open_play bookings, allow any user with a pending SplitPayment
        const isSplitType = booking.bookingType === "split" || booking.bookingType === "open_play";
        if (!isSplitType && booking.userId !== userId) {
          throw new BadRequestError("Booking does not belong to user");
        }
        if (isSplitType && booking.userId !== userId) {
          const pendingSplit = await prisma.splitPayment.findFirst({
            where: { bookingId: booking.id, userId, status: "pending" },
          });
          if (!pendingSplit) {
            throw new BadRequestError("No pending split payment found for this user");
          }
        }

        if (!isSplitType && booking.paymentStatus === "completed") {
          throw new BadRequestError("Booking is already paid");
        }
        bookings = [booking];
      }

      const amountInPaise = Math.round(amount * 100);
      const receipt = groupId
        ? `group_${groupId.slice(0, 30)}`
        : `booking_${bookingId}`;

      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: currency ?? "INR",
        receipt,
        notes: {
          groupId: groupId ?? "",
          bookingId: bookingId ? String(bookingId) : "",
          userId: String(userId),
        },
      });

      // Stamp all affected bookings with the Razorpay order ID
      await prisma.booking.updateMany({
        where: { id: { in: bookings.map((b) => b.id) } },
        data: { razorpayOrderId: order.id },
      });

      // For split/open_play payers, stamp the Razorpay order ID on their SplitPayment
      for (const b of bookings) {
        if (b.bookingType === "split" || b.bookingType === "open_play") {
          await prisma.splitPayment.updateMany({
            where: { bookingId: b.id, userId, status: "pending" },
            data: { razorpayOrderId: order.id },
          });
        }
      }

      res.json({
        success: true,
        data: {
          razorpayOrderId: order.id,
          keyId: process.env.RAZORPAY_KEY_ID,
          amount: amountInPaise,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /verify - Verify Razorpay payment signature and update booking status
router.post(
  "/verify",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ body: verifySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body as z.infer<typeof verifySchema>;

      if (
        !verifyRazorpaySignature(
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature
        )
      ) {
        throw new BadRequestError("Invalid payment signature");
      }

      // Find all bookings tied to this Razorpay order (single or batch)
      const bookings = await prisma.booking.findMany({
        where: { razorpayOrderId: razorpay_order_id },
      });

      if (bookings.length === 0) throw new NotFoundError("Booking");

      // Ownership check: for split/open_play the payer may be a player (not the booking owner).
      // We validate split/open_play payers by their pending SplitPayment record instead.
      for (const booking of bookings) {
        const isSplitType = booking.bookingType === "open_play" || booking.bookingType === "split";
        if (!isSplitType && booking.userId !== req.userId) {
          throw new BadRequestError("Booking does not belong to user");
        }
        if (isSplitType) {
          const splitPay = await prisma.splitPayment.findFirst({
            where: { bookingId: booking.id, userId: req.userId!, status: "pending" },
          });
          if (!splitPay) {
            throw new BadRequestError("No pending payment found for this user on this booking");
          }
        }
      }

      // Process each booking: payment amounts differ by type
      for (const booking of bookings) {
        const isSplitType = booking.bookingType === "open_play" || booking.bookingType === "split";

        if (isSplitType) {
          // For split/open_play: find and settle the pending SplitPayment for this player
          const splitPay = await prisma.splitPayment.findFirst({
            where: { bookingId: booking.id, userId: req.userId!, status: "pending" },
          });

          const amountPaid = splitPay?.amount ?? 0;

          if (splitPay) {
            await prisma.splitPayment.update({
              where: { id: splitPay.id },
              data: {
                status: "paid",
                razorpayPaymentId: razorpay_payment_id,
                razorpayOrderId: razorpay_order_id,
              },
            });
          }

          // Increment paidAmount — each player's share accumulates toward the threshold
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              paymentStatus: "completed",
              razorpayPaymentId: razorpay_payment_id,
              paidAmount: { increment: amountPaid },
            },
          });

          // BookingPayment record for this player's share
          const existingPayment = await prisma.bookingPayment.findFirst({
            where: { bookingId: booking.id, userId: req.userId!, razorpayOrderId: razorpay_order_id },
          });
          if (existingPayment) {
            await prisma.bookingPayment.update({
              where: { id: existingPayment.id },
              data: { status: "paid", paymentGatewayId: razorpay_payment_id },
            });
          } else {
            await prisma.bookingPayment.create({
              data: {
                bookingId: booking.id,
                userId: req.userId!,
                amount: amountPaid,
                paymentMethod: "online",
                paymentGatewayId: razorpay_payment_id,
                razorpayOrderId: razorpay_order_id,
                status: "paid",
              },
            });
          }
        } else {
          // Solo / batch: full amount paid by the booking owner
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              paymentStatus: "completed",
              razorpayPaymentId: razorpay_payment_id,
              paidAmount: booking.totalAmount,
            },
          });

          const existingPayment = await prisma.bookingPayment.findFirst({
            where: { bookingId: booking.id, razorpayOrderId: razorpay_order_id },
          });
          if (existingPayment) {
            await prisma.bookingPayment.update({
              where: { id: existingPayment.id },
              data: { status: "paid", paymentGatewayId: razorpay_payment_id },
            });
          } else {
            await prisma.bookingPayment.create({
              data: {
                bookingId: booking.id,
                userId: booking.userId,
                amount: booking.totalAmount,
                paymentMethod: "online",
                paymentGatewayId: razorpay_payment_id,
                razorpayOrderId: razorpay_order_id,
                status: "paid",
              },
            });
          }
        }
      }

      // Trigger booking engine: check thresholds and resolve conflicts
      for (const booking of bookings) {
        await applyPaymentCaptured(booking.id);

        // Non-blocking: build venue player network
        if (booking.venueId) {
          recordVenueConnections(booking.userId, booking.venueId).catch(() => {});
        }

        // For open play bookings, check the viability threshold
        if (booking.bookingType === "open_play") {
          const openPlay = await (prisma as any).openPlay.findFirst({
            where: { bookingId: booking.id },
          });
          if (openPlay) {
            // If the host protection payment was just captured, mark the slot as protected
            const hostProtectionSplit = await prisma.splitPayment.findFirst({
              where: {
                bookingId: booking.id,
                userId: req.userId!,
                splitType: "host_protection",
                status: "paid",
              } as any,
            });
            if (hostProtectionSplit && openPlay.hostProtectionStatus === "pending") {
              await (prisma as any).openPlay.update({
                where: { id: openPlay.id },
                data: { hostProtectionStatus: "paid" },
              });
              // Move booking to host_protected status so venue owner sees a confirmed slot
              await prisma.booking.update({
                where: { id: booking.id },
                data: { status: "confirmed" },
              });
            }

            await checkConfirmationThreshold(openPlay.id);
          }
        }
      }

      res.json({
        success: true,
        message: "Payment verified successfully",
        data: { bookingIds: bookings.map((b) => b.id) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /webhook - Razorpay webhook handler
router.post(
  "/webhook",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers["x-razorpay-signature"] as string;
      if (!signature) {
        return res.status(400).json({ message: "Missing x-razorpay-signature" });
      }

      // Use the raw request body captured before express.json() parsed it.
      // Re-serialising req.body via JSON.stringify() would alter key order / spacing
      // and cause HMAC mismatch against Razorpay's signature.
      const rawBody = (req as any).rawBody;
      const body = rawBody ? rawBody.toString("utf8") : JSON.stringify(req.body);
      if (!verifyWebhookSignature(body, signature)) {
        return res.status(400).json({ message: "Invalid webhook signature" });
      }

      const parsed = webhookPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid webhook payload" });
      }

      const { event, payload } = parsed.data;

      if (event === "payment.captured" && payload.payment) {
        const payment = payload.payment.entity;
        const orderId = payment.order_id;
        const paymentId = payment.id;
        if (payment.status === "captured") {
          const affectedBookings = await prisma.booking.findMany({
            where: { razorpayOrderId: orderId },
          });

          for (const booking of affectedBookings) {
            const isSplitType = booking.bookingType === "split" || booking.bookingType === "open_play";

            if (isSplitType) {
              // For split/open_play: only update the specific SplitPayment for this order
              // and increment paidAmount by the share — don't overwrite to totalAmount
              const pendingSplits = await prisma.splitPayment.findMany({
                where: { bookingId: booking.id, razorpayOrderId: orderId, status: "pending" },
              });

              for (const sp of pendingSplits) {
                await prisma.splitPayment.update({
                  where: { id: sp.id },
                  data: { status: "paid", razorpayPaymentId: paymentId },
                });
                await prisma.booking.update({
                  where: { id: booking.id },
                  data: {
                    paymentStatus: "completed",
                    razorpayPaymentId: paymentId,
                    paidAmount: { increment: sp.amount },
                  },
                });
                const existingPay = await prisma.bookingPayment.findFirst({
                  where: {
                    bookingId: booking.id,
                    userId: sp.userId ?? undefined,
                    razorpayOrderId: orderId,
                  },
                });
                if (existingPay) {
                  await prisma.bookingPayment.update({
                    where: { id: existingPay.id },
                    data: { status: "paid", paymentGatewayId: paymentId },
                  });
                } else if (sp.userId) {
                  await prisma.bookingPayment.create({
                    data: {
                      bookingId: booking.id,
                      userId: sp.userId,
                      amount: sp.amount,
                      paymentMethod: "online",
                      paymentGatewayId: paymentId,
                      razorpayOrderId: orderId,
                      status: "paid",
                    },
                  });
                }
              }
            } else {
              // Solo / batch: full amount paid by the booking owner
              await prisma.booking.update({
                where: { id: booking.id },
                data: {
                  paymentStatus: "completed",
                  razorpayPaymentId: paymentId,
                  paidAmount: booking.totalAmount,
                },
              });

              // Notify booking owner (non-blocking)
              void createNotification(
                booking.userId,
                NotifType.PAYMENT_CAPTURED,
                "Payment confirmed",
                `Your payment of ₹${booking.totalAmount.toFixed(2)} for the booking on ${new Date(booking.bookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} has been confirmed.`,
                { bookingId: booking.id, amount: booking.totalAmount }
              );
              const existingPay = await prisma.bookingPayment.findFirst({
                where: { bookingId: booking.id, razorpayOrderId: orderId },
              });
              if (existingPay) {
                await prisma.bookingPayment.update({
                  where: { id: existingPay.id },
                  data: { status: "paid", paymentGatewayId: paymentId },
                });
              } else {
                await prisma.bookingPayment.create({
                  data: {
                    bookingId: booking.id,
                    userId: booking.userId,
                    amount: booking.totalAmount,
                    paymentMethod: "online",
                    paymentGatewayId: paymentId,
                    razorpayOrderId: orderId,
                    status: "paid",
                  },
                });
              }
            }

            await applyPaymentCaptured(booking.id);

            // Non-blocking: build venue player network
            if (booking.venueId) {
              recordVenueConnections(booking.userId, booking.venueId).catch(() => {});
            }

            // For open play bookings, check the confirmation threshold
            if (booking.bookingType === "open_play") {
              const openPlay = await prisma.openPlay.findFirst({
                where: { bookingId: booking.id },
              });
              if (openPlay) {
                await checkConfirmationThreshold(openPlay.id);
              }
            }
          }
        }
      } else if (event === "payment.failed" && payload.payment) {
        const payment = payload.payment.entity;
        const orderId = payment.order_id;
        const affectedBookings = await prisma.booking.findMany({
          where: { razorpayOrderId: orderId },
        });
        for (const booking of affectedBookings) {
          const existingPay = await prisma.bookingPayment.findFirst({
            where: { bookingId: booking.id, razorpayOrderId: orderId },
          });
          if (existingPay) {
            await prisma.bookingPayment.update({
              where: { id: existingPay.id },
              data: { status: "failed", paymentGatewayId: payment.id },
            });
          } else {
            await prisma.bookingPayment.create({
              data: {
                bookingId: booking.id,
                userId: booking.userId,
                amount: 0,
                paymentMethod: "online",
                paymentGatewayId: payment.id,
                razorpayOrderId: orderId,
                status: "failed",
              },
            });
          }

          // For split types, notify the specific payer whose order failed
          if (booking.bookingType === "split" || booking.bookingType === "open_play") {
            const failedSplit = await prisma.splitPayment.findFirst({
              where: { bookingId: booking.id, razorpayOrderId: orderId },
              select: { userId: true, amount: true },
            });
            if (failedSplit?.userId) {
              void createNotification(
                failedSplit.userId,
                NotifType.PAYMENT_FAILED,
                "Payment failed",
                `Your payment of ₹${failedSplit.amount.toFixed(2)} could not be processed. Please retry to secure your spot.`,
                { bookingId: booking.id }
              );
            }
          } else {
            void createNotification(
              booking.userId,
              NotifType.PAYMENT_FAILED,
              "Payment failed",
              `Your payment for the booking on ${new Date(booking.bookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} could not be processed. Please retry.`,
              { bookingId: booking.id }
            );
          }
        }
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /history - Payment history for authenticated user
router.get(
  "/history",
  jwtCheck,
  attachUser,
  requireAuth,
  validate({ query: paginationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        prisma.bookingPayment.findMany({
          where: { userId },
          include: {
            booking: {
              select: {
                id: true,
                sport: true,
                facilityName: true,
                bookingDate: true,
                startTime: true,
                endTime: true,
                totalAmount: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.bookingPayment.count({ where: { userId } }),
      ]);

      const walletBalance = await getWalletBalance(userId);

      res.json({
        success: true,
        data: payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        walletBalance,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
