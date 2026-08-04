import { DropZone } from "@/components/DropZone";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FileListView } from "@/components/FileList";
import { AppLayout } from "@/components/layout/AppLayout";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { TransferWidget } from "@/components/TransferWidget";
import { Toaster } from "@/components/ui/sonner";
import { UploadWidget } from "@/components/UploadWidget";
import { TransferProvider } from "@/context/TransferContext";
import { useTheme } from "@/hooks/use-theme";
import { useState } from "react";

function App() {
  const [isUploadWidgetOpen, setIsUploadWidgetOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<"active" | "trash">("active");
  const { theme, setTheme } = useTheme();

  return (
    <TransferProvider>
      <ErrorBoundary>
        <AppLayout
          currentView={currentView}
          setCurrentView={setCurrentView}
          setIsUploadWidgetOpen={setIsUploadWidgetOpen}
          onOpenSettings={() => setIsSettingsOpen(true)}
          theme={theme}
          setTheme={setTheme}
        >
          <DropZone>
            <FileListView
              status={currentView === "trash" ? "trashed" : "active"}
            />
          </DropZone>
        </AppLayout>

        <TransferWidget />
        <UploadWidget
          open={isUploadWidgetOpen}
          onOpenChange={setIsUploadWidgetOpen}
        />
        <SettingsDialog
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          theme={theme}
          setTheme={setTheme}
        />
        <Toaster theme={theme as "dark" | "light" | "system"} />
      </ErrorBoundary>
    </TransferProvider>
  );
}

export default App;
