import type { ApiResponse } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const API_SECRET = import.meta.env.VITE_API_SECRET || "";

export const api = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      headers: {
        Authorization: API_SECRET,
      },
    });

    const result: ApiResponse<T> = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || "API Request Failed");
    }
    return result.data;
  },

  post: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: API_SECRET,
      },
      body: JSON.stringify(body),
    });

    const result: ApiResponse<T> = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || "API Request Failed");
    }
    return result.data;
  },

  patch: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: API_SECRET,
      },
      body: JSON.stringify(body),
    });

    const result: ApiResponse<T> = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || "API Request Failed");
    }
    return result.data;
  },

  delete: async <T>(path: string): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      method: "DELETE",
      headers: {
        Authorization: API_SECRET,
      },
    });

    const result: ApiResponse<T> = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || "API Request Failed");
    }
    return result.data;
  },
};
