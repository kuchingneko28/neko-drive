import { useTransfer } from "@/context/TransferContext";
import { Upload } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";

export function DropZone({ children }: { children: ReactNode }) {
  const [dragging, setDragging] = useState(false);
  const { uploadFiles } = useTransfer().upload;

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      if (e.dataTransfer.files?.length) {
        uploadFiles(Array.from(e.dataTransfer.files));
      }
    },
    [uploadFiles],
  );

  return (
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {children}
      {dragging && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-primary bg-card shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-base font-bold">Drop files to upload</p>
            <p className="text-xs text-muted-foreground/60">Encrypted with AES-256-GCM</p>
          </div>
        </div>
      )}
    </div>
  );
}