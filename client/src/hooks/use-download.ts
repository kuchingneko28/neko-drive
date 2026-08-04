import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { processDownload } from "@/lib/transfer-manager";

interface DownloadState {
  isDownloading: boolean;
  progress: number;
  fileName: string | null;
  previewUrl: string | null;
  mode: "download" | "preview" | null;
  status?: string;
  speed: number;
  eta: number;
  isPaused?: boolean;
}

interface UseDownloadReturn extends DownloadState {
  downloadFile: (id: string, name: string) => Promise<void>;
  previewFile: (id: string, name: string) => Promise<void>;
  clearPreview: () => void;
  cancelDownload: () => void;
  pauseDownload: () => void;
  resumeDownload: () => void;
}

/**
 * Custom Hook: useDownload
 * Manages the client-side streaming decryption flow.
 */
export function useDownload(): UseDownloadReturn {
  const [state, setState] = useState<DownloadState>({
    isDownloading: false,
    progress: 0,
    fileName: null,
    previewUrl: null,
    mode: null,
    speed: 0,
    eta: 0,
    isPaused: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Resume state tracking
  const currentRequest = useRef<{
    id: string;
    name: string;
    mode: "download" | "preview";
  } | null>(null);
  const downloadedChunksRef = useRef<Blob[]>([]);

  const clearPreview = useCallback(() => {
    if (state.previewUrl) {
      window.URL.revokeObjectURL(state.previewUrl);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Explicitly NOT clearing downloadedChunksRef.current here
    // to allow instant resumption if the same file is reopened.

    setState((prev) => ({
      ...prev,
      previewUrl: null,
      isDownloading: false,
      progress: 0,
      mode: null,
      speed: 0,
      eta: 0,
      isPaused: false,
      fileName: null,
    }));
  }, [state.previewUrl]);

  const cancelDownload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    downloadedChunksRef.current = [];
    setState((prev) => ({
      ...prev,
      isDownloading: false,
      progress: 0,
      isPaused: false,
      status: "Cancelled",
    }));
    toast.info("Transfer cancelled.");
  }, []);

  const pauseDownload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("Paused");
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isPaused: true,
      isDownloading: false,
      status: "Paused",
    }));
    toast.info("Transfer paused");
  }, []);

  const processFile = useCallback(
    async (
      fileId: string,
      fileName: string,
      mode: "download" | "preview",
      isResume = false,
    ) => {
      // Setup Controller
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const isNewFile = currentRequest.current?.id !== fileId;

      if (!isResume && isNewFile) {
        downloadedChunksRef.current = [];
        if (state.previewUrl) window.URL.revokeObjectURL(state.previewUrl);
        currentRequest.current = { id: fileId, name: fileName, mode };
      } else if (!isResume && !isNewFile) {
        // Simple click on the same file while it's "Ready" (cached)
        // If we already have the URL and it's not downloading, just show it.
        // Handled by the component's state, but we ensures we don't wipe.
        isResume = true;
      }

      setState((prev) => ({
        ...prev,
        isDownloading: true,
        isPaused: false,
        progress: isResume ? prev.progress : 0,
        fileName,
        mode,
        status: isResume ? "Resuming..." : "Starting...",
        // A new file means any previously previewed URL is stale/revoked —
        // drop it so the preview modal doesn't linger over a broken blob.
        previewUrl: isResume ? prev.previewUrl : null,
        error: undefined,
      }));

      try {
        const url = await processDownload({
          fileId,
          signal: controller.signal,
          initialBlobs: downloadedChunksRef.current,
          onChunkDownloaded: (index, chunk) => {
            downloadedChunksRef.current[index] = chunk;
          },
          onProgress: (progress, speed, eta) => {
            setState((prev) => ({
              ...prev,
              progress,
              speed,
              eta,
              status: mode === "download" ? "Downloading..." : "Decrypting...",
            }));
          },
        });

        if (controller.signal.aborted) return;

        downloadedChunksRef.current = []; // Clear on success
        if (mode === "download") {
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          a.click();
          if (url.startsWith("blob:"))
            setTimeout(() => window.URL.revokeObjectURL(url), 500);
          toast.success("Download started");
          setState((prev) => ({
            ...prev,
            isDownloading: false,
            progress: 100,
            status: "Complete",
          }));
        } else {
          // Unencrypted previews are served from /stream; ask the server for an
          // inline response so media renders instead of triggering a download.
          const preview = url.startsWith("blob:") ? url : `${url}&inline=true`;
          setState((prev) => ({
            ...prev,
            isDownloading: false,
            progress: 100,
            previewUrl: preview,
            status: "Ready",
          }));
        }
      } catch (raw: unknown) {
        if (controller.signal.aborted) {
          if (controller.signal.reason === "Paused") return;
          return;
        }

        const error = raw instanceof Error ? raw : new Error(String(raw));
        console.error("Download failed:", error);
        toast.error(`Transfer failed: ${error.message}`);
        setState((prev) => ({
          ...prev,
          isDownloading: false,
          status: "Error",
        }));
      }
    },
    [state.previewUrl],
  );

  const resumeDownload = useCallback(() => {
    if (currentRequest.current) {
      processFile(
        currentRequest.current.id,
        currentRequest.current.name,
        currentRequest.current.mode,
        true,
      );
    }
  }, [processFile]);

  return {
    ...state,
    downloadFile: (id: string, name: string) =>
      processFile(id, name, "download"),
    previewFile: (id: string, name: string) => processFile(id, name, "preview"),
    clearPreview,
    cancelDownload,
    pauseDownload,
    resumeDownload,
  };
}
