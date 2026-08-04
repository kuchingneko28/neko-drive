import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTransfer } from "@/context/TransferContext";
import { cn, formatBytes } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  Lock,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface UploadWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadWidget({ open, onOpenChange }: UploadWidgetProps) {
  const { upload, uploadFiles, cancelUpload, clearUpload } =
    useTransfer().upload;
  const [dragActive, setDragActive] = useState(false);
  const [encrypt, setEncrypt] = useState(true);
  // Same depth counter as DropZone: prevents the border flashing as the
  // cursor crosses into the dropzone's children.
  const dragDepth = useRef(0);

  const handleClose = useCallback(() => {
    if (upload.status !== "uploading") clearUpload();
    onOpenChange(false);
  }, [onOpenChange, upload.status, clearUpload]);

  const handleFiles = useCallback(
    (files: FileList) => {
      if (files.length) uploadFiles(Array.from(files), encrypt);
    },
    [uploadFiles, encrypt],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] max-w-sm bg-card border border-border/20 p-0 rounded-xl shadow-xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-4 pb-3 border-b border-border/10">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Upload to Drive
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={handleClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {upload.status === "idle" ? (
          <div className="p-4 space-y-4 w-full">
            <RadioGroup
              value={encrypt ? "encrypted" : "standard"}
              onValueChange={(v) => setEncrypt(v === "encrypted")}
              className="grid grid-cols-2 gap-2"
            >
              {[
                { value: "encrypted", label: "Encrypted", icon: Lock },
                { value: "standard", label: "Standard", icon: Globe },
              ].map(({ value, label, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 cursor-pointer transition-all",
                    encrypt === (value === "encrypted")
                      ? "border-primary bg-primary/5"
                      : "border-border/40 bg-secondary/30 hover:bg-secondary/50",
                  )}
                >
                  <RadioGroupItem value={value} className="peer sr-only" />
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      encrypt === (value === "encrypted")
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                  <span className="text-xs font-semibold">{label}</span>
                </label>
              ))}
            </RadioGroup>

            <div
              onDragEnter={(e) => {
                e.preventDefault();
                dragDepth.current += 1;
                setDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDragLeave={() => {
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (dragDepth.current === 0) setDragActive(false);
              }}
              onDrop={onDrop}
              className={cn(
                "relative flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border/40 bg-secondary/20 hover:border-primary/30",
              )}
            >
              <Upload className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs font-semibold">Drop files here</p>
              <p className="text-xs text-muted-foreground/50 font-medium">
                or click to browse
              </p>
              <input
                type="file"
                multiple
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3 w-full">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {upload.status === "uploading" && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {upload.status === "success" && (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                )}
                {upload.status === "error" && (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">
                  {upload.currentFileName}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {upload.totalFiles > 1 &&
                    `File ${upload.currentFileIndex + 1} of ${upload.totalFiles} · `}
                  {upload.status === "uploading" && `${upload.progress}%`}
                  {upload.status === "success" && "Uploaded"}
                  {upload.status === "error" && "Failed"}
                </p>
              </div>
            </div>

            {upload.status === "uploading" && (
              <>
                <Progress
                  className="h-1.5 rounded-full bg-secondary"
                  value={upload.progress}
                />
                <div className="flex justify-between text-xs text-muted-foreground/60">
                  <span>
                    {formatBytes(upload.uploadedBytes)} /{" "}
                    {formatBytes(upload.totalSize)}
                  </span>
                  <span>{formatBytes(upload.speed)}/s</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg h-8 text-xs font-bold text-destructive border-destructive/20 hover:bg-destructive/5"
                  onClick={cancelUpload}
                >
                  Cancel
                </Button>
              </>
            )}

            {(upload.status === "success" || upload.status === "error") && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg h-8 text-xs font-bold"
                  onClick={() => clearUpload?.()}
                >
                  Upload More
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 rounded-lg h-8 text-xs font-bold"
                  onClick={() => {
                    clearUpload?.();
                    onOpenChange(false);
                  }}
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
