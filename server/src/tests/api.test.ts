import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { app } from "../app";

const AUTH = { Authorization: "test-key", "Content-Type": "application/json" } as Record<string, string>;

// Mock Discord API responses
const origFetch = globalThis.fetch;
beforeAll(() => {
  // Match the Authorization header used by AUTH above
  process.env.API_SECRET = "test-key";

  globalThis.fetch = ((url: string | URL, init?: RequestInit) => {
    const u = typeof url === "string" ? url : url.toString();

    if (u.includes("discord.com/api/v10/channels") && init?.method === "POST")
      return Promise.resolve(Response.json({ id: "999999999999999999", attachments: [{ id: "888888888888888888", url: "https://cdn.discord.com/attachments/test", filename: "chunk.bin", size: 100 }] }));

    if (u.includes("discord.com/api/v10/attachments/refresh-urls"))
      return Promise.resolve(Response.json({ refreshed_urls: [{ refreshed: "https://cdn.discord.com/attachments/refreshed" }] }));

    if (u.includes("discord.com/api/v10/channels") && init?.method === "GET")
      return Promise.resolve(Response.json({ attachments: [{ url: "https://cdn.discord.com/attachments/fetched" }] }));

    if (u.includes("discord.com/api/v10/gateway"))
      return Promise.resolve(new Response("ok", { status: 200 }));

    return origFetch(url, init);
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = origFetch;
});

describe("Neko Drive API", () => {
  const file = {
    id: `test-${Date.now()}`,
    name: "test.txt",
    size: 13,
    type: "text/plain",
    iv: "0123456789abcdef0123456789abcdef",
    salt: "abcdef0123456789abcdef0123456789",
  };

  // Exercise the real Hono app in-process (no live server needed)
  const request = (path: string, init?: RequestInit) => app.request(path, init);

  test("health check", async () => {
    const res = await request("/api/system/health", { headers: AUTH });
    const json = (await res.json()) as { success: boolean };
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  test("init upload", async () => {
    const res = await request("/api/upload/file/init", {
      method: "POST", headers: AUTH,
      body: JSON.stringify(file),
    });
    expect(res.status).toBe(200);
  });

  test("upload chunk", async () => {
    const res = await request(`/api/upload/file/${file.id}/chunk`, {
      method: "POST",
      headers: { ...AUTH, "Content-Type": "application/octet-stream", "X-Chunk-Number": "1" },
      body: "Hello World!",
    });
    if (res.status === 200) {
      const json = (await res.json()) as { data: { messageId: string } };
      expect(json.data.messageId).toBeDefined();
    }
  });

  test("finalize", async () => {
    const res = await request(`/api/upload/file/${file.id}/finalize`, {
      method: "POST", headers: AUTH,
    });
    expect(res.status).toBe(200);
  });

  test("list files", async () => {
    const res = await request("/api/files?limit=10&offset=0", { headers: AUTH });
    const json = (await res.json()) as { data: { items: unknown[] } };
    expect(res.status).toBe(200);
    expect(json.data.items).toBeDefined();
  });

  test("search files", async () => {
    const res = await request("/api/files/search?q=test", { headers: AUTH });
    expect(res.status).toBe(200);
  });

  test("get file details", async () => {
    const res = await request(`/api/files/${file.id}`, { headers: AUTH });
    if (res.status === 200) {
      const json = (await res.json()) as { data: { name: string } };
      expect(json.data.name).toBe(file.name);
    }
  });

  test("system stats", async () => {
    const res = await request("/api/system/stats", { headers: AUTH });
    expect(res.status).toBe(200);
  });

  test("delete file", async () => {
    const res = await request(`/api/files/${file.id}`, {
      method: "DELETE", headers: AUTH,
    });
    expect(res.status).toBe(200);
  });
});
