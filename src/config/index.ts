import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function parseDurationMs(d: string): number {
  const match = /^(\d+)([smhd])$/.exec(d.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case "s":
      return n * 1000;
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    default:
      return n * 24 * 60 * 60 * 1000; // 'd'
  }
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

export const config = {
  PORT: Number(process.env.PORT ?? 4000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  DATABASE_URL: required("DATABASE_URL"),
  REDIS_HOST: process.env.REDIS_HOST ?? "localhost",
  REDIS_PORT: Number(process.env.REDIS_PORT ?? 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN,
  COOKIE_MAX_AGE_MS: parseDurationMs(JWT_EXPIRES_IN),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./uploads",
  MAX_FILE_SIZE_MB: 100, // 100MB
  MAX_VIDEO_DURATION_SECS: 180, // 3 minutes
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
  RATE_LIMIT_MAX: 100, // 100 requests
  MAX_MEDIA_PER_KUDO: 3, // 3 media per kudo
  AUTH_RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  AUTH_RATE_LIMIT_MAX: 10, // 10 requests
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? true,
  GIVING_BUDGET: 200, // 200 points

  REWARD_LOW_STOCK_MAX_REMAINING: 10, // 10 remaining
  IDEMPOTENCY_CACHE_TTL_SEC: 86400, // 1 day
  IDEMPOTENCY_LOCK_TTL_SEC: 120, // 2 minutes
  IDEMPOTENCY_LOCK_POLL_MS: 200, // 200ms
  IDEMPOTENCY_LOCK_POLL_ATTEMPTS: 30, // 30 attempts
  SSE_HEARTBEAT_INTERVAL_MS: 30_000, // 30 seconds
  FFPROBE_TIMEOUT_MS: 60_000, // 60 seconds
  MEDIA_WORKER_CONCURRENCY: 2, // 2 workers
  NOTIFICATION_EXPIRY_DAYS: 30, // 30 days
  ALLOWED_REACTIONS: ["👏", "❤️", "🔥", "🎉", "💪"] as string[],
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL ??
    "http://localhost:4000/api/auth/google/callback",
  FE_URL: process.env.FE_URL ?? "http://localhost:3000",
} as const;
