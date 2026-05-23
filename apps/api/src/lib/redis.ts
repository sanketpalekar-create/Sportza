import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
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
