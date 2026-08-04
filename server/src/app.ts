import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { logger } from "./lib/logger";
import { apiResponse } from "./lib/response";
import { VERSION } from "./config";
import { verifyMediaToken } from "./lib/media-token";

// Routes
import download from "./routes/download";
import files from "./routes/files";
import mediaToken from "./routes/media-token";
import stream from "./routes/stream";
import system from "./routes/system";
import upload from "./routes/upload";

export const app = new Hono<{
  Variables: { mediaToken?: { fileId: string } };
}>();

const MAX_BODY = 10 * 1024 * 1024; // 10MB max body for non-chunk API calls

// Middleware
app.use("*", honoLogger());
app.use("*", cors());

// Body size limit (skip for chunk uploads)
app.use("/api/*", async (ctx, next) => {
  const contentLength = parseInt(ctx.req.header("Content-Length") || "0", 10);
  if (contentLength > MAX_BODY && !ctx.req.path.includes("/chunk")) {
    return apiResponse.error(ctx, "Request entity too large", 413);
  }
  await next();
});

// ponytail: no rate limiter — this runs local-only; the limiter would only
// trip on legit large uploads (many chunk POSTs) and protect nothing here.

// Auth: master secret via Authorization header, or a short-lived media token
// (?token=) issued by /api/media-token — the secret itself never appears in URLs.
app.use("/api/*", async (ctx, next) => {
  const API_SECRET = process.env.API_SECRET;

  if (!API_SECRET) {
    if (process.env.NODE_ENV === "production") {
      logger.error(
        "Security configuration error: API_SECRET is not set in production environment.",
      );
      process.exit(1);
    }
    logger.warn(
      "Security warning: API_SECRET is not set. The server is vulnerable.",
    );
    return next();
  }

  const headerSecret = ctx.req.header("Authorization");
  if (headerSecret === API_SECRET) return next();

  const queryToken = ctx.req.query("token");
  if (queryToken) {
    const media = verifyMediaToken(queryToken);
    if (media) {
      ctx.set("mediaToken", media);
      return next();
    }
  }

  logger.warn(
    `Unauthorized access attempt from ${ctx.req.header("User-Agent")}`,
  );
  return apiResponse.error(ctx, "Unauthorized", 401);
});

// Serve built client (only in production, falls through to API routes otherwise)
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "../client/dist" }));
  app.get("*", serveStatic({ path: "../client/dist/index.html" }));
}

// API Routes
app.get("/", (ctx) => {
  return apiResponse.success(ctx, {
    status: "active",
    version: VERSION,
    engine: "Bun + Hono + SQLite",
    debug: process.env.DEBUG === "true",
  });
});

app.route("/api/upload", upload);
app.route("/api/files", files);
app.route("/api/download", download);
app.route("/api/stream", stream);
app.route("/api/system", system);
app.route("/api/media-token", mediaToken);

// 404 & Error Handling
app.notFound((ctx) => apiResponse.error(ctx, "Not Found", 404));
app.onError((err, ctx) => {
  logger.error("Fatal Server Error:", err);
  return apiResponse.error(ctx, "Internal Server Error", 500);
});
