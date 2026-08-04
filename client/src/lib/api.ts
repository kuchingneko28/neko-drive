import type { ApiResponse } from "@/types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const API_SECRET = import.meta.env.VITE_API_SECRET || "";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(30_000),
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: API_SECRET,
      ...init.headers,
    },
  });

  const result: ApiResponse<T> = await res.json();
  if (!res.ok || !result.success) {
    throw new Error(result.error || "API Request Failed");
  }
  return result.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
