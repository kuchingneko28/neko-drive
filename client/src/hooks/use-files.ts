import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { FileMetadata, PaginatedResponse } from "../types";

export function useFiles(
  page = 0,
  limit = 50,
  search = "",
  status = "active",
  sort = "created_at",
  order: "ASC" | "DESC" = "DESC",
) {
  const offset = page * limit;

  return useQuery({
    queryKey: ["files", { offset, limit, search, status, sort, order }],
    queryFn: async () => {
      const path = search
        ? `/files/search?q=${encodeURIComponent(search)}&status=${status}`
        : `/files?offset=${offset}&limit=${limit}&status=${status}&sort=${sort}&order=${order}`;

      if (search) {
        const items = await api.get<FileMetadata[]>(path);
        return {
          items,
          total: items.length,
          limit,
          offset: 0,
        } as PaginatedResponse<FileMetadata>;
      }

      return await api.get<PaginatedResponse<FileMetadata>>(path);
    },
  });
}