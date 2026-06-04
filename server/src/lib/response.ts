import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const apiResponse = {
  success: <T>(c: Context, data: T | null = null, status: ContentfulStatusCode = 200) => {
    return c.json({ success: true, data }, status);
  },
  error: (c: Context, message: string, status: ContentfulStatusCode = 400, details: unknown = null) => {
    return c.json({ success: false, error: message, details: details || null }, status);
  },
};