import Redis from "ioredis";
import { isServerless } from "./runtime";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * On Vercel / serverless, use lazyConnect so cold starts do not open Redis
 * until the first command. Upstash Redis works with the standard redis:// URL.
 * BullMQ workers must NOT be started in serverless (see lib/runtime.ts).
 */
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: isServerless,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

redis.on("connect", () => {
  console.log("Redis connected");
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
