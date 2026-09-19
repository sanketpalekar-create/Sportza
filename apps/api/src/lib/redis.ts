import Redis from "ioredis";
import { isServerless } from "./runtime";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * On Vercel / serverless, use lazyConnect so cold starts do not open Redis
 * until the first command. Upstash Redis works with the standard redis:// URL.
 * BullMQ workers must NOT be started in serverless (see lib/runtime.ts).
 *
 * Connection errors are logged only — never rethrown — so a Redis outage
 * (e.g. Upstash free-tier limit) cannot crash the HTTP process.
 */
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: isServerless,
  retryStrategy: (times) => {
    // Back off and keep trying; do not give up in a way that crashes Node
    if (times > 30) return 10_000;
    return Math.min(times * 100, 5000);
  },
});

redis.on("error", (err) => {
  console.error("[redis] connection error (non-fatal):", err.message);
});

redis.on("connect", () => {
  console.log("[redis] connected");
});

redis.on("close", () => {
  console.warn("[redis] connection closed");
});

export async function setOtp(key: string, code: string, ttlSeconds: number = 300): Promise<void> {
  await redis.set(`otp:${key}`, code, "EX", ttlSeconds);
}

export async function getOtp(key: string): Promise<string | null> {
  return redis.get(`otp:${key}`);
}

export async function deleteOtp(key: string): Promise<void> {
  await redis.del(`otp:${key}`);
}

export async function setSession(userId: number, data: Record<string, any>, ttlSeconds: number = 86400): Promise<void> {
  await redis.set(`session:${userId}`, JSON.stringify(data), "EX", ttlSeconds);
}

export async function getSession(userId: number): Promise<Record<string, any> | null> {
  const raw = await redis.get(`session:${userId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function rateLimit(key: string, maxAttempts: number, windowSeconds: number): Promise<boolean> {
  const current = await redis.incr(`ratelimit:${key}`);
  if (current === 1) {
    await redis.expire(`ratelimit:${key}`, windowSeconds);
  }
  return current <= maxAttempts;
}

export default redis;
