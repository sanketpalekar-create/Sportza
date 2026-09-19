import { Worker, Job } from "bullmq";
import redis from "../lib/redis";
import { sendOtpEmail, sendMagicLinkEmail, sendPasswordResetEmail, sendBookingConfirmation } from "../lib/email";

let emailWorker: Worker | null = null;

export function startEmailWorker(): Worker {
  if (emailWorker) return emailWorker;

  emailWorker = new Worker(
    "email",
    async (job: Job) => {
      const { data } = job;

      switch (job.name) {
        case "otp":
          await sendOtpEmail(data.to, data.otp);
          break;
        case "magic-link":
          await sendMagicLinkEmail(data.to, data.link);
          break;
        case "reset-password":
          await sendPasswordResetEmail(data.to, data.link);
          break;
        case "booking-confirmation":
          await sendBookingConfirmation(data.to, data.booking);
          break;
        case "payment-receipt":
          console.log("Payment receipt email:", data);
          break;
        default:
          console.warn(`Unknown email job type: ${job.name}`);
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  emailWorker.on("completed", (job) => {
    console.log(`Email job ${job.id} completed: ${job.name}`);
  });

  emailWorker.on("failed", (job, err) => {
    console.error(`Email job ${job?.id} failed:`, err.message);
  });

  // Prevent BullMQ redis errors from becoming uncaught and killing the process
  emailWorker.on("error", (err) => {
    console.error("[email-worker] error (non-fatal):", err.message);
  });

  console.log("[email-worker] started");
  return emailWorker;
}

export default emailWorker;
