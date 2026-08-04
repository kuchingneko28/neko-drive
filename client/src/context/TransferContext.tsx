import { useDownload } from "@/hooks/use-download";
import { useUpload } from "@/hooks/use-upload";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

interface TransferContextType {
  upload: ReturnType<typeof useUpload>;
  download: ReturnType<typeof useDownload>;
}

const TransferContext = createContext<TransferContextType | null>(null);

export function TransferProvider({ children }: { children: ReactNode }) {
  const upload = useUpload();
  const download = useDownload();
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel("neko-transfers");
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === "SYNC_DOWNLOAD" && payload.isDownloading) {
        // Remote tab is downloading — reflect in title/notifications
        document.title = `(${payload.progress}%) Downloading...`;
      } else if (type === "SYNC_UPLOAD" && payload.isUploading) {
        document.title = `(${payload.progress}%) Uploading...`;
      } else if (type === "SYNC_CLEAR") {
        document.title = "Neko Drive";
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    if (download.isDownloading) {
      channel.postMessage({
        type: "SYNC_DOWNLOAD",
        payload: {
          isDownloading: true,
          progress: download.progress,
          fileName: download.fileName,
          mode: download.mode,
        },
      });
      if (document.hidden) {
        document.title = `(${download.progress}%) Downloading...`;
      }
    } else if (upload.isUploading) {
      channel.postMessage({
        type: "SYNC_UPLOAD",
        payload: {
          isUploading: true,
          progress: upload.progress,
          currentFileName: upload.currentFileName,
        },
      });
      if (document.hidden) {
        document.title = `(${upload.progress}%) Uploading...`;
      }
    } else {
      channel.postMessage({ type: "SYNC_CLEAR" });
      document.title = "Neko Drive";
    }
  }, [
    // Transition-only: broadcasting on every progress tick made every open
    // tab write document.title + handle messages at upload frequency.
    download.isDownloading,
    download.fileName,
    download.mode,
    upload.isUploading,
    upload.currentFileName,
  ]);

  useEffect(() => {
    if (!("Notification" in window)) return;

    const showNotif = (title: string, body: string) => {
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/vite.svg" });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((p) => {
          if (p === "granted")
            new Notification(title, { body, icon: "/vite.svg" });
        });
      }
    };

    const handle = () => {
      if (!document.hidden) {
        document.title = "Neko Drive";
        return;
      }
      if (download.isDownloading) {
        showNotif("Downloading File", `Progress: ${download.progress}%`);
        document.title = `(${download.progress}%) Downloading...`;
      } else if (upload.isUploading) {
        showNotif("Uploading File", `Progress: ${upload.progress}%`);
        document.title = `(${upload.progress}%) Uploading...`;
      }
    };

    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [
    download.isDownloading,
    download.progress,
    upload.isUploading,
    upload.progress,
  ]);

  return (
    <TransferContext.Provider value={{ upload, download }}>
      {children}
    </TransferContext.Provider>
  );
}

export function useTransfer() {
  const context = useContext(TransferContext);
  if (!context)
    throw new Error("useTransfer must be used within a TransferProvider");
  return context;
}
