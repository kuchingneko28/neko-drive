import { useTransfer } from "@/context/TransferContext";
import { formatBytes } from "@/lib/utils";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowDown, ArrowUp, Pause, Play, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function TransferWidget() {
  const { upload, download } = useTransfer();
  const isDL = download.isDownloading && download.mode === "download";
  const isActive = isDL || upload.isUploading || !!download.isPaused;
  const progress = isDL || download.isPaused ? download.progress : upload.progress;
  const fileName = isDL || download.isPaused ? download.fileName : upload.currentFileName;
  const speed = (isDL ? download.speed : upload.speed) || 0;
  const cancel = isDL || download.isPaused ? download.cancelDownload : upload.cancelUpload;

  // Slide the widget up each time a transfer starts.
  const widgetRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!widgetRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        widgetRef.current,
        { opacity: 0, y: 16, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "power2.out", overwrite: true },
      );
    },
    { scope: widgetRef, dependencies: [isActive] },
  );

  if (!isActive) return null;

  return (
    <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div
        ref={widgetRef}
        className="bg-card border border-border/20 shadow-lg rounded-xl flex w-80 max-w-[90vw] overflow-hidden transition-colors hover:bg-secondary"
      >
        <div className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {download.isPaused ? (
              <Pause className="h-3.5 w-3.5 text-warning" />
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
            <Progress className="h-1 rounded-full bg-secondary/60 mt-1.5" value={progress} />
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground/50 font-medium">
                {formatBytes(speed)}/s
              </span>
              {download.isPaused && (
                <span className="text-xs text-warning font-semibold">Paused</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center pr-1">
          {isDL && (
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-secondary/50"
              onClick={download.pauseDownload}
              title="Pause"
            >
              <Pause className="h-3.5 w-3.5" />
            </Button>
          )}
          {download.isPaused && (
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/10"
              onClick={download.resumeDownload}
              title="Resume"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
            onClick={cancel}
            aria-label="Cancel transfer"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}