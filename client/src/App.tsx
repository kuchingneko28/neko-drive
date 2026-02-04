import { StackList } from "@/components/FileList";
import { AppLayout } from "@/components/layout/AppLayout";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { TransferWidget } from "@/components/TransferWidget";
import { Toaster } from "@/components/ui/sonner";
import { UploadWidget } from "@/components/UploadWidget";
import { TransferProvider } from "@/context/TransferContext";
import { useEffect, useState } from "react";

function App() {
  const [isUploadWidgetOpen, setIsUploadWidgetOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<"active" | "trash">("active");
  const [theme, setTheme] = useState(() => localStorage.getItem("neko-theme") || "system");

  // Apply Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem("neko-theme", theme);
  }, [theme]);

  // Handle View Change
  const handleViewChange = (view: "active" | "trash") => {
    setCurrentView(view);
  };

  return (
    <TransferProvider>
      <AppLayout
        currentView={currentView}
        setCurrentView={handleViewChange}
        setIsUploadWidgetOpen={setIsUploadWidgetOpen}
        onOpenSettings={() => setIsSettingsOpen(true)}
        theme={theme}
        setTheme={setTheme}
      >
        <StackList status={currentView === "trash" ? "trashed" : "active"} />
      </AppLayout>

      {/* Global Widgets/Overlays */}
      <TransferWidget />
      <UploadWidget open={isUploadWidgetOpen} onOpenChange={setIsUploadWidgetOpen} />
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} theme={theme} setTheme={setTheme} />
      <Toaster theme={theme as "dark" | "light" | "system"} />
    </TransferProvider>
  );
}

export default App;
