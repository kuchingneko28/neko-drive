import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { Files, HardDrive, Plus, Trash2 } from "lucide-react";

interface SidebarProps {
  className?: string;
  onOpenUpload?: () => void;
  currentView?: "active" | "trash";
  onViewChange?: (view: "active" | "trash") => void;
}

export function Sidebar({ className, onOpenUpload, currentView = "active", onViewChange }: SidebarProps) {
  const { stats } = useSystemHealth();

  const used = stats?.storage.totalSize || 0;
  const files = stats?.storage.totalFiles || 0;
  const chunks = stats?.totalChunks || 0;
  const encrypted = stats?.encryptedFiles || 0;
  const avgSize = stats?.avgFileSize || 0;

  const handleUpload = () => onOpenUpload?.();

  const trashCount = stats?.trashedFiles || 0;
  const menuItems = [
    { icon: Files, label: "All Files", value: "active" as const, count: files },
    { icon: Trash2, label: "Trash", value: "trash" as const, count: trashCount },
  ];

  return (
    <div className={cn("flex flex-col h-full bg-sidebar border-r border-border/30 px-4 pb-4 pt-3", className)}>
      <div className="flex items-center gap-3 px-1 mb-5">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <HardDrive className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight">Neko Drive</p>
          <p className="text-xs font-semibold text-muted-foreground/50">Secure Cloud</p>
        </div>
      </div>

      <Button
        onClick={handleUpload}
        className="w-full justify-start gap-2.5 rounded-xl h-11 px-4 mb-5 bg-primary hover:bg-primary/90 text-primary-foreground active:scale-[0.98] transition-all"
      >
        <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
          <Plus className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">Upload Files</span>
      </Button>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-2.5 rounded-lg h-9 px-3 text-xs font-semibold transition-all",
              currentView === item.value
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
            )}
            onClick={() => onViewChange?.(item.value)}
          >
            <item.icon className={cn("h-4 w-4", currentView === item.value ? "text-primary" : "")} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.count > 0 && (
              <span className="text-xs font-bold tabular-nums text-muted-foreground/60">{item.count}</span>
            )}
          </Button>
        ))}
      </nav>

      <div className="pt-4 border-t border-border/20">
        <div className="rounded-xl bg-sidebar-accent/50 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground/60">
            <span className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              Storage
            </span>
            <span className="tabular-nums">{chunks} chunks</span>
          </div>

          <p className="text-xl font-bold leading-none">{formatBytes(used)}</p>

          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-border/10">
            <div>
              <p className="font-semibold text-foreground">{files}</p>
              <p className="text-muted-foreground/50">Files</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-foreground">{formatBytes(avgSize)}</p>
              <p className="text-muted-foreground/50">Avg file</p>
            </div>
          </div>

          {encrypted > 0 && (
            <div className="flex items-center justify-between text-xs pt-2 border-t border-border/10">
              <span className="text-muted-foreground/50">Encrypted</span>
              <span className="font-semibold tabular-nums">
                {encrypted} · {stats?.standardFiles || 0} standard
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}