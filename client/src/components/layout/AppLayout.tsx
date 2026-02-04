import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Menu, Moon, Plus, Settings, ShieldAlert, ShieldCheck, Sun } from "lucide-react";
import { type ReactNode, useState } from "react";

interface AppLayoutProps {
  children: ReactNode;
  currentView: "active" | "trash";
  setCurrentView: (view: "active" | "trash") => void;
  setIsUploadWidgetOpen: (open: boolean) => void;
  onOpenSettings: () => void;
  theme: string;
  setTheme: (theme: string) => void;
}

export function AppLayout({
  children,
  currentView,
  setCurrentView,
  setIsUploadWidgetOpen,
  onOpenSettings,
  theme,
  setTheme,
}: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { health, getHealthColor } = useSystemHealth();
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const handleAction = (id: string, action: () => void) => {
    setProcessingAction(id);
    setTimeout(() => {
      action();
      setProcessingAction(null);
    }, 400); // 400ms visual feedback delay
  };

  return (
    <div className="flex h-screen bg-background transition-colors duration-300 overflow-hidden">
      {/* Sidebar - Desktop */}
      <Sidebar
        className="hidden md:flex w-64 shrink-0"
        onOpenUpload={() => setIsUploadWidgetOpen(true)}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        {/* Top Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "circOut" }}
          className="h-16 border-b border-border/20 bg-background/30 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 z-20 shrink-0"
        >
          <div className="flex items-center gap-3">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden rounded-xl">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 border-r border-border/40 bg-card">
                <Sidebar
                  className="w-full border-none"
                  onOpenUpload={() => {
                    setIsUploadWidgetOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  currentView={currentView}
                  onViewChange={(view) => {
                    setCurrentView(view);
                    setIsMobileMenuOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>
            <div className="hidden md:block flex-1 max-w-2xl">{/* Global Search */}</div>

            {/* Theme Toggle (Mobile) */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden rounded-xl"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex items-center space-x-4">
            {/* Theme Toggle (Desktop) */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex rounded-xl text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                boxShadow:
                  health?.database === "online" && health.discord.includes("online")
                    ? [
                        "0 0 0px rgba(34, 197, 94, 0)",
                        "0 0 12px rgba(34, 197, 94, 0.2)",
                        "0 0 0px rgba(34, 197, 94, 0)",
                      ]
                    : "none",
              }}
              transition={{
                scale: { duration: 0.3 },
                opacity: { duration: 0.3 },
                boxShadow: {
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }}
              className={cn(
                "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background/50 backdrop-blur-sm shadow-sm transition-all duration-300",
                getHealthColor(),
              )}
            >
              {health?.database === "online" && health.discord.includes("online") ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 animate-pulse text-red-500" />
              )}
              <span className="hidden xs:inline text-[10px] font-bold uppercase tracking-widest">
                {health?.database === "online" && health.discord.includes("online") ? "Systems Optimal" : "Attention"}
              </span>
            </motion.div>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-xl transition-all duration-200 active:scale-90",
                processingAction === "settings" && "bg-secondary text-primary",
              )}
              onClick={() => handleAction("settings", onOpenSettings)}
            >
              <Settings
                className={cn(
                  "h-5 w-5 transition-all duration-500",
                  processingAction === "settings" ? "animate-spin text-primary" : "text-muted-foreground",
                )}
              />
            </Button>
          </div>
        </motion.header>

        {/* Content Stacks */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "circOut" }}
            className="max-w-6xl mx-auto space-y-6 md:space-y-8"
          >
            {children}
          </motion.div>
        </main>

        {/* Mobile FAB */}
        <Button
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl shadow-primary/40 z-50 flex items-center justify-center p-0 hover:scale-105 active:scale-95 transition-all"
          onClick={() => setIsUploadWidgetOpen(true)}
        >
          <Plus className="h-6 w-6 text-primary-foreground" />
        </Button>
      </div>
    </div>
  );
}
