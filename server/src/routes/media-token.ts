import { Hono } from "hono";
import db from "../db";
import { issueMediaToken } from "../lib/media-token";
import { apiResponse } from "../lib/response";

const mediaToken = new Hono();

// Exchange the master secret (Authorization header) for a short-lived,
// file-scoped token usable in ?token= on media URLs.
mediaToken.get("/", async (ctx) => {
  const fileId = ctx.req.query("file");
  if (!fileId) return apiResponse.error(ctx, "Missing file parameter", 400);

  const file = db.prepare("SELECT id FROM files WHERE id = ?").get(fileId);
  if (!file) return apiResponse.error(ctx, "File not found", 404);

  const issued = issueMediaToken(fileId);
  return apiResponse.success(ctx, issued);
});

export default mediaToken;
