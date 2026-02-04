import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { SystemStats } from "../types";

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

export function useSystemHealth() {
  const { data: stats } = useQuery({
    queryKey: ["system-stats"],
    queryFn: () => api.get<SystemStats>("/system/stats"),
    refetchInterval: 60000,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<HealthStatus>("/system/health"),
    refetchInterval: 60000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const getHealthColor = () => {
    if (!health) return "text-muted-foreground";
    if (health.database === "online" && health.discord.includes("online"))
      return "text-green-500 bg-green-500/5 border-green-500/10";
    if (health.database === "error" || health.discord.includes("unreachable"))
      return "text-red-500 bg-red-500/5 border-red-500/10";
    return "text-amber-500 bg-amber-500/5 border-amber-500/10";
  };

  return {
    stats,
    health,
    getHealthColor,
  };
}
