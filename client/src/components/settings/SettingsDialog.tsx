import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { type Theme } from "@/hooks/useTheme";
import { api } from "@/lib/api";
import { cn, formatBytes } from "@/lib/utils";
import { Cpu, Loader2, Moon, Settings, Sun, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export function SettingsDialog({ open, onOpenChange, theme, setTheme }: Props) {
  const { stats, health } = useSystemHealth(true);
  const [isPurging, setIsPurging] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] max-w-lg p-0 rounded-xl overflow-hidden bg-card"
      >
        <div className="flex items-center justify-between p-4 border-b border-border/10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Settings className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Settings</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/60">
                Neko Drive preferences
              </DialogDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Tabs defaultValue="general">
          <div className="px-4 pt-3">
            <TabsList className="w-full h-8 bg-secondary/40 p-0.5 gap-0.5 rounded-lg">
              {["General", "Storage"].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab.toLowerCase()}
                  className="flex-1 h-full rounded-md text-xs font-semibold bg-transparent data-[state=active]:bg-background data-[state=active]:text-primary transition-all"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="p-4 space-y-5">
            <TabsContent value="general" className="mt-0 space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground/60 mb-2.5">Appearance</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["light", "dark", "system"] as Theme[]).map((mode) => (
                    <Button
                      key={mode}
                      variant="outline" size="sm"
                      className={cn(
                        "h-9 gap-1.5 rounded-lg text-xs font-medium border",
                        theme === mode
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/30 bg-secondary/30 hover:bg-secondary/50",
                      )}
                      onClick={() => setTheme(mode)}
                    >
                      {mode === "light" && <Sun className="h-3.5 w-3.5" />}
                      {mode === "dark" && <Moon className="h-3.5 w-3.5" />}
                      {mode === "system" && <Cpu className="h-3.5 w-3.5" />}
                      {mode}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground/60 mb-2.5">Connection</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-secondary/30 rounded-lg border border-border/10">
                    <p className="text-xs font-semibold text-muted-foreground/60 mb-1">Database</p>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${health?.database === "online" ? "bg-success" : "bg-destructive"}`} />
                      <span className="text-xs font-semibold">{health?.database || "..."}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-secondary/30 rounded-lg border border-border/10">
                    <p className="text-xs font-semibold text-muted-foreground/60 mb-1">Discord</p>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${health?.discord.includes("online") ? "bg-success" : "bg-destructive"}`} />
                      <span className="text-xs font-semibold">
                        {health?.discord.includes("(")
                          ? `${health.discord.split("(")[1]?.replace(")", "")}`
                          : health?.discord || "..."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="storage" className="mt-0 space-y-5">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground/60 mb-2.5">Drive Usage</p>
                  <div className="p-4 bg-secondary/30 rounded-lg border border-border/10">
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground/60">Used</p>
                        <p className="text-lg font-bold">{formatBytes(stats?.storage.totalSize || 0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground/60">Files</p>
                        <p className="text-lg font-bold">{stats?.storage.totalFiles || 0}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs pt-3 border-t border-border/10">
                      <div>
                        <p className="font-semibold">{stats?.totalChunks || 0}</p>
                        <p className="text-muted-foreground/50">Chunks</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">{formatBytes(stats?.avgFileSize || 0)}</p>
                        <p className="text-muted-foreground/50">Avg file</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatBytes(stats?.dbSize || 0)}</p>
                        <p className="text-muted-foreground/50">Database</p>
                      </div>
                    </div>
                  </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground/60 mb-2.5">Maintenance</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/10">
                    <div>
                      <p className="text-xs font-semibold">Backup Database</p>
                      <p className="text-xs text-muted-foreground/50">Snapshot to Discord</p>
                    </div>
                    <Button
                      variant="outline" size="sm"
                      className="rounded-lg h-7 text-xs font-semibold border-primary/20 text-primary hover:bg-primary/5"
                      onClick={async () => {
                        try { await api.post("/system/backup", {}); toast.success("Backup initiated"); }
                        catch { toast.error("Backup failed"); }
                      }}
                    >
                      Sync
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/10">
                    <div>
                      <p className="text-xs font-semibold text-destructive">Purge Pending</p>
                      <p className="text-xs text-muted-foreground/50">Clear incomplete uploads</p>
                    </div>
                    <Button
                      variant="outline" size="sm"
                      className="rounded-lg h-7 text-xs font-semibold border-destructive/20 text-destructive hover:bg-destructive/5"
                      onClick={async () => {
                        setIsPurging(true);
                        try { await api.delete("/upload/file/pending/all"); toast.success("Purged"); }
                        catch { toast.error("Purge failed"); }
                        finally { setIsPurging(false); }
                      }}
                      disabled={isPurging}
                    >
                      {isPurging ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                      Purge
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}