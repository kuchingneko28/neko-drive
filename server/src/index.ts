import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { logger } from "./lib/logger";
import { apiResponse } from "./lib/response";
import { PORT, IDLE_TIMEOUT, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from "./config";
import db from "./db";

// Routes
import download from "./routes/download";
import files from "./routes/files";
import stream from "./routes/stream";
import system from "./routes/system";
import upload from "./routes/upload";

const app = new Hono();

const MAX_BODY = 10 * 1024 * 1024; // 10MB max body for non-chunk API calls

// Middleware
app.use("*", honoLogger());
app.use("*", cors());

// Request timeout (30s for API, 3min for downloads/streams)
app.use("/api/*", async (ctx, next) => {
  const isLong = ctx.req.path.includes("/download") || ctx.req.path.includes("/stream");
  const timeout = isLong ? 180_000 : 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  ctx.req.raw.signal.addEventListener("abort", () => controller.abort());
  try {
    await next();
  } finally {
    clearTimeout(timer);
  }
});

// Body size limit (skip for chunk uploads)
app.use("/api/*", async (ctx, next) => {
  const contentLength = parseInt(ctx.req.header("Content-Length") || "0", 10);
  if (contentLength > MAX_BODY && !ctx.req.path.includes("/chunk")) {
    return apiResponse.error(ctx, "Request entity too large", 413);
  }
  await next();
});

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

app.use("/api/*", async (ctx, next) => {
  const ip = ctx.req.header("x-forwarded-for") || ctx.req.header("x-real-ip") || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT_MAX) {
      return apiResponse.error(ctx, "Rate limit exceeded", 429);
    }
    entry.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }
  await next();
});

// Auth
app.use("/api/*", async (ctx, next) => {
  const secret = ctx.req.header("Authorization") || ctx.req.query("token");
  const API_SECRET = process.env.API_SECRET;

  if (!API_SECRET) {
    if (process.env.NODE_ENV === "production") {
      logger.error("Security configuration error: API_SECRET is not set in production environment.");
      process.exit(1);
    }
    logger.warn("Security warning: API_SECRET is not set. The server is vulnerable.");
  }

  if (API_SECRET && secret !== API_SECRET) {
    logger.warn(`Unauthorized access attempt from ${ctx.req.header("User-Agent")}`);
    return apiResponse.error(ctx, "Unauthorized", 401);
  }
  await next();
});

// Routes
app.get("/", (ctx) => {
  return apiResponse.success(ctx, {
    status: "active",
    librarian: "Neko Drive BHVR 🐱",
    version: "2.1.0",
    engine: "Bun + Hono + SQLite",
    debug: process.env.DEBUG === "true",
  });
});

app.route("/api/upload", upload);
app.route("/api/files", files);
app.route("/api/download", download);
app.route("/api/stream", stream);
app.route("/api/system", system);

// 404 & Error Handling
app.notFound((ctx) => apiResponse.error(ctx, "Not Found", 404));
app.onError((err, ctx) => {
  logger.error("Fatal Server Error:", err);
  return apiResponse.error(ctx, "Internal Server Error", 500);
});

logger.info(`Librarian starting on port ${PORT}`);

// Periodic VACUUM (every 4 hours to keep DB healthy)
const VACUUM_INTERVAL = 4 * 60 * 60 * 1000;
let vacuumTimer: Timer | null = null;
let rateLimitCleanupTimer: Timer | null = null;

function scheduleVacuum() {
  vacuumTimer = setTimeout(() => {
    try {
      logger.info("Running scheduled VACUUM");
      db.exec("VACUUM;");
      logger.info("Scheduled VACUUM complete");
    } catch (err) {
      logger.error("Scheduled VACUUM failed:", err);
    }
    scheduleVacuum();
  }, VACUUM_INTERVAL);
}
scheduleVacuum();

// Periodic rate limit map cleanup (every 5 minutes)
function scheduleRateLimitCleanup() {
  rateLimitCleanupTimer = setTimeout(() => {
    const now = Date.now();
    let cleared = 0;
    rateLimitMap.forEach((entry, key) => {
      if (now >= entry.resetAt) {
        rateLimitMap.delete(key);
        cleared++;
      }
    });
    if (cleared > 0) logger.debug(`Cleaned up ${cleared} expired rate limit entries`);
    scheduleRateLimitCleanup();
  }, 5 * 60 * 1000);
}
scheduleRateLimitCleanup();

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  if (vacuumTimer) clearTimeout(vacuumTimer);
  if (rateLimitCleanupTimer) clearTimeout(rateLimitCleanupTimer);
  db.close();
  logger.info("Database closed. Goodbye.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: IDLE_TIMEOUT,
};