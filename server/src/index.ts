import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { logger } from "./lib/logger";
import { apiResponse } from "./lib/response";

// Routes
import download from "./routes/download";
import files from "./routes/files";
import stream from "./routes/stream";
import system from "./routes/system";
import upload from "./routes/upload";

const app = new Hono();

// Middleware
app.use("*", honoLogger());
app.use("*", cors());

/**
 * Security Layer: API_SECRET Validation
 * Ensures only authorized clients can talk to the librarian.
 */
app.use("/api/*", async (c, next) => {
  const secret = c.req.header("Authorization") || c.req.query("token");
  const API_SECRET = process.env.API_SECRET;

  if (!API_SECRET) {
    if (process.env.NODE_ENV === "production") {
      logger.error("Security configuration error: API_SECRET is not set in production environment.");
      process.exit(1);
    }
    logger.warn("Security warning: API_SECRET is not set. The server is vulnerable.");
  }

  if (API_SECRET && secret !== API_SECRET) {
    logger.warn(`Unauthorized access attempt from ${c.req.header("User-Agent")}`);
    return apiResponse.error(c, "Unauthorized", 401);
  }
  await next();
});

// Route Registration
app.get("/", (c) => {
  return apiResponse.success(c, {
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
app.notFound((c) => apiResponse.error(c, "Not Found", 404));
app.onError((err, c) => {
  logger.error("Fatal Server Error:", err);
  return apiResponse.error(c, "Internal Server Error", 500);
});

const port = process.env.PORT || 3000;
logger.info(`Librarian starting on port ${port} (Safe Mode)`);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 255, // Increase timeout for long-running streams (default is 10s)
};
