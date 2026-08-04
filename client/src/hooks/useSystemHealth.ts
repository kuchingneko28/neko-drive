import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { SystemStats } from "@/types";

export interface HealthStatus {
  database: "online" | "offline" | "error";
  discord: string;
  version?: string;
  uptime?: number;
  memory?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
}

export function useSystemHealth(poll = false) {
  const { data: stats } = useQuery({
    queryKey: ["system-stats"],
    queryFn: () => api.get<SystemStats>("/system/stats"),
    staleTime: 120_000,
    refetchInterval: poll ? 60_000 : false,
    refetchOnWindowFocus: false,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<HealthStatus>("/system/health"),
    staleTime: 120_000,
    refetchInterval: poll ? 60_000 : false,
    refetchOnWindowFocus: false,
  });

  return { stats, health };
}