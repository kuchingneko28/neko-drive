import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { resolveTheme, type Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { Menu, Moon, Plus, Settings, Sun } from "lucide-react";
import { type ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
  currentView: "active" | "trash";
  setCurrentView: (view: "active" | "trash") => void;
  setIsUploadWidgetOpen: (open: boolean) => void;
  onOpenSettings: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export function AppLayout({
  children, currentView, setCurrentView, setIsUploadWidgetOpen,
  onOpenSettings, theme, setTheme,
}: AppLayoutProps) {
  const { health } = useSystemHealth(false);
  const statusOK = health?.database === "online" && health?.discord.includes("online");
  // Resolve "system" to the actual OS theme so the toggle icon/action are consistent
  const effectiveTheme = resolveTheme(theme);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        className="hidden md:flex w-56 shrink-0"
        onOpenUpload={() => setIsUploadWidgetOpen(true)}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-border/20 bg-background flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 rounded-lg">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-56 border-r border-border/30 bg-sidebar">
                <Sidebar
                  className="w-full border-none"
                  onOpenUpload={() => setIsUploadWidgetOpen(true)}
                  currentView={currentView}
                  onViewChange={(v) => { setCurrentView(v); }}
                />
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(effectiveTheme === "dark" ? "light" : "dark")}
            >
              {effectiveTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold",
              !health
                ? "text-muted-foreground/60 bg-muted/30"
                : statusOK ? "text-success bg-success/10" : "text-destructive bg-destructive/10",
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                !health ? "bg-muted-foreground/40 animate-pulse" : statusOK ? "bg-success" : "bg-destructive",
              )} />
              {health ? (statusOK ? "Connected" : "Offline") : "Connecting"}
            </div>

            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>

        <Button
          className="md:hidden fixed bottom-5 right-5 w-12 h-12 rounded-xl shadow-lg z-50"
          onClick={() => setIsUploadWidgetOpen(true)}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}