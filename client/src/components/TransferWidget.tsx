import { useTransfer } from "@/context/TransferContext";
import { formatBytes } from "@/lib/utils";
import { ArrowDown, ArrowUp, Loader2, X } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  onOpenUpload?: () => void;
}

export function TransferWidget({ onOpenUpload }: Props) {
  const { upload, download } = useTransfer();
  const isDL = download.isDownloading && download.mode === "download";
  const isActive = isDL || upload.isUploading || !!download.isPaused;
  const progress = isDL || download.isPaused ? download.progress : upload.progress;
  const fileName = isDL || download.isPaused ? download.fileName : upload.currentFileName;
  const speed = (isDL ? download.speed : upload.speed) || 0;
  const cancel = isDL ? download.cancelDownload : upload.cancelUpload;

  if (!isActive) return null;

  return (
    <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-card border border-border/20 shadow-lg rounded-xl flex min-w-72 max-w-[90vw] overflow-hidden">
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0 text-left hover:bg-secondary/20 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {download.isPaused ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : isDL ? (
              <ArrowDown className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold truncate">{fileName}</span>
              <span className="text-xs font-bold tabular-nums text-primary shrink-0">{progress}%</span>
            </div>
            <div className="h-1 rounded-full bg-secondary/60 mt-1.5 overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground/50 font-medium">
                {formatBytes(speed)}/s
              </span>
              {download.isPaused && (
                <span className="text-xs text-warning font-semibold">Paused</span>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center pr-1">
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
            onClick={cancel}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}