import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { processUpload } from "../lib/transfer-manager";

interface UploadState {
  progress: number;
  status: "idle" | "uploading" | "success" | "error";
  currentFileName?: string;
  totalSize: number;
  uploadedBytes: number;
  speed: number;
  eta: number;
  totalFiles: number;
  currentFileIndex: number;
  totalChunks: number;
  uploadedChunks: number;
}

export function useUpload() {
  const queryClient = useQueryClient();
  const [upload, setUpload] = useState<UploadState>({
    progress: 0,
    status: "idle",
    totalSize: 0,
    uploadedBytes: 0,
    speed: 0,
    eta: 0,
    totalFiles: 0,
    currentFileIndex: 0,
    totalChunks: 0,
    uploadedChunks: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const uploadFiles = useCallback(
    async (files: File[], shouldEncrypt: boolean = true) => {
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      setUpload((prev) => ({
        ...prev,
        status: "uploading",
        totalFiles: files.length,
        totalSize,
        currentFileIndex: 0,
        progress: 0,
        uploadedBytes: 0,
        speed: 0,
        eta: 0,
      }));

      abortControllerRef.current = new AbortController();

      let cumulativeBytes = 0;
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const isLast = i === files.length - 1;
          const fileChunks = Math.ceil(file.size / (8192 * 1024));

          setUpload((prev) => ({
            ...prev,
            currentFileName: file.name,
            currentFileIndex: i,
            progress: Math.min(99, Math.round((cumulativeBytes / totalSize) * 100)),
            uploadedBytes: cumulativeBytes,
            uploadedChunks: 0,
            totalChunks: fileChunks,
          }));

          await processUpload({
            file,
            shouldEncrypt,
            isLast,
            signal: abortControllerRef.current.signal,
            onProgress: (_progress, speed, eta, uploadedChunks, totalChunks, totalUploaded) => {
              setUpload((prev) => ({
                ...prev,
                progress: Math.min(99, Math.round(((cumulativeBytes + (totalUploaded || 0)) / totalSize) * 100)),
                speed,
                eta,
                uploadedChunks: uploadedChunks || 0,
                totalChunks: totalChunks || fileChunks,
                uploadedBytes: cumulativeBytes + (totalUploaded || 0),
              }));
            },
          });

          cumulativeBytes += file.size;

          if (abortControllerRef.current.signal.aborted) throw new Error("Aborted");
        }

        setUpload((prev) => ({ ...prev, status: "success", progress: 100 }));
        toast.success(`${files.length} stacks successfully archived!`);
        queryClient.invalidateQueries({ queryKey: ["files"] });
        queryClient.invalidateQueries({ queryKey: ["system-stats"] });

        setTimeout(() => {
          setUpload((prev) => ({
            ...prev,
            status: "idle",
            progress: 0,
            totalFiles: 0,
            currentFileIndex: 0,
            totalChunks: 0,
            uploadedChunks: 0,
            currentFileName: undefined,
          }));
          abortControllerRef.current = null;
        }, 3000);
      } catch (e: unknown) {
        if (abortControllerRef.current?.signal.aborted || (e as Error).message === "Aborted") {
          toast.info("Upload cancelled");
          setUpload((prev) => ({ ...prev, status: "idle", progress: 0 }));
          return;
        }

        const msg = (e as Error).message;
        toast.error(`Failed to archive: ${msg}`);
        setUpload((prev) => ({ ...prev, status: "error" }));
      }
    },
    [queryClient],
  );

  const startUpload = useCallback(
    (file: File, shouldEncrypt: boolean = true) => {
      return uploadFiles([file], shouldEncrypt);
    },
    [uploadFiles],
  );

  const cancelUpload = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUpload((prev) => ({ ...prev, status: "idle", progress: 0, speed: 0, eta: 0 }));
  }, []);

  const clearUpload = useCallback(() => {
    setUpload((prev) => ({
      ...prev,
      status: "idle",
      progress: 0,
      totalFiles: 0,
      currentFileIndex: 0,
      totalChunks: 0,
      uploadedChunks: 0,
      currentFileName: undefined,
      speed: 0,
      eta: 0,
    }));
  }, []);

  const cleanAbandoned = useCallback(async () => {
    try {
      const res = await api.delete("/upload/file/pending/all");
      if (res) {
        toast.success("Abandoned uploads cleared!");
        queryClient.invalidateQueries({ queryKey: ["system-stats"] });
      }
    } catch (e: unknown) {
      toast.error("Failed to clear abandoned uploads");
    }
  }, [queryClient]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (upload.status === "uploading") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [upload.status]);

  return {
    uploadFiles,
    startUpload,
    cancelUpload,
    isUploading: upload.status === "uploading",
    progress: upload.progress,
    speed: upload.speed,
    eta: upload.eta,
    totalFiles: upload.totalFiles,
    currentFileIndex: upload.currentFileIndex,
    currentFileName: upload.currentFileName,
    totalChunks: upload.totalChunks,
    uploadedChunks: upload.uploadedChunks,
    uploadedBytes: upload.uploadedBytes,
    upload,
    clearUpload,
    cleanAbandoned,
  };
}
