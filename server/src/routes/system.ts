import { Hono } from "hono";
import db from "../db";
import { backupDatabase } from "../lib/backup";
import { logger } from "../lib/logger";
import { apiResponse } from "../lib/response";
import { VERSION } from "../config";
import { SystemStats } from "../types";

const system = new Hono();

/**
 * System Health & Diagnostics
 */
// Cache health status to avoid rate limits and reduce latency
let lastCheck = 0;
let cachedDiscordStatus = "unknown";
const CACHE_TTL = 30000; // 30 seconds

system.get("/health", async (ctx) => {
  const now = Date.now();
  const stats: SystemStats = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: "offline",
    discord: "checking", // Will be overwritten
    version: VERSION,
    debug: process.env.DEBUG === "true",
  };

  try {
    // 1. Check SQLite (Fast enough to run every time)
    const result = db.prepare("SELECT 1 as ok").get() as
      { ok: number } | undefined;
    if (result && result.ok === 1) {
      stats.database = "online";
    }
  } catch (error) {
    logger.error("DB Health Check Failed:", error);
    stats.database = "error";
  }

  // 2. Check Discord Connectivity (Cached)
  if (now - lastCheck > CACHE_TTL || cachedDiscordStatus === "unknown") {
    try {
      const start = Date.now();
      const discordRes = await fetch("https://discord.com/api/v10/gateway", {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      });

      if (discordRes.ok) {
        const latency = Date.now() - start;
        cachedDiscordStatus = `online (${latency}ms)`;
      } else {
        cachedDiscordStatus = `unauthorized/failed (${discordRes.status})`;
      }
    } catch (error) {
      logger.error("Discord Health Check Failed:", error);
      cachedDiscordStatus = "unreachable";
    }
    lastCheck = now;
  }

  stats.discord = cachedDiscordStatus;

  return apiResponse.success<SystemStats>(ctx, stats);
});

/**
 * Storage Statistics
 */
system.get("/stats", async (ctx) => {
  try {
    const storage = db
      .prepare(
        `SELECT COUNT(*) as totalFiles, COALESCE(SUM(size), 0) as totalSize FROM files WHERE status = 'active'`,
      )
      .get() as { totalFiles: number; totalSize: number };

    const encrypted = db
      .prepare(
        `SELECT COUNT(*) as count FROM files WHERE status = 'active' AND iv IS NOT NULL AND iv != ''`,
      )
      .get() as { count: number };

    const chunks = db
      .prepare(
        `SELECT COUNT(*) as count FROM chunks WHERE file_id IN (SELECT id FROM files WHERE status = 'active')`,
      )
      .get() as { count: number };

    const trashed = db
      .prepare(`SELECT COUNT(*) as count FROM files WHERE status = 'trashed'`)
      .get() as { count: number };

    return apiResponse.success(ctx, {
      storage,
      encryptedFiles: encrypted.count,
      standardFiles: storage.totalFiles - encrypted.count,
      totalChunks: chunks.count,
      avgFileSize:
        storage.totalFiles > 0
          ? Math.round(storage.totalSize / storage.totalFiles)
          : 0,
      trashedFiles: trashed.count,
      dbSize: await Bun.file("neko.db").size,
    });
  } catch (error: unknown) {
    logger.error("Stats Error:", error);
    return apiResponse.error(ctx, "Failed to fetch storage stats", 500);
  }
});

/**
 * Trigger manual redundant backup
 */
system.post("/backup", async (ctx) => {
  try {
    logger.info("Manual backup triggered via API");
    // Run in background to avoid blocking the user
    backupDatabase();

    return apiResponse.success(ctx, { message: "Backup initiative started." });
  } catch (error: unknown) {
    logger.error("Manual Backup Trigger Error:", error);
    return apiResponse.error(ctx, "Failed to initiate backup", 500);
  }
});

export default system;
