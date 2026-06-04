import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileText, Loader2, Lock, X } from "lucide-react";
import { useState } from "react";
import { getFileType } from "@/lib/file-utils";
import { formatBytes } from "@/lib/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fileName: string | null;
  fileUrl: string | null;
  isLoading?: boolean;
  isEncrypted?: boolean;
  progress?: number;
  fileSize?: number;
}

export function FilePreviewModal({ isOpen, onClose, fileName, fileUrl, isLoading, isEncrypted, progress, fileSize }: Props) {
  const [err, setErr] = useState(false);
  const type = getFileType(fileName || "");

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-4xl h-[85dvh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border/10 flex flex-row items-center justify-between shrink-0">
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-sm font-semibold truncate">{fileName || "Loading..."}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/60 mt-0.5">
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  {isEncrypted && <Lock className="h-3 w-3 animate-pulse" />}
                  {isEncrypted ? "Decrypting..." : "Loading..."}
                </span>
              ) : (
                <>{isEncrypted ? "Decrypted" : "Preview"} &middot; {type.toUpperCase()}</>
              )}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {fileUrl && !isLoading && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs font-medium px-2" asChild>
                <a href={fileUrl} download={fileName || "download"}>
                  <Download className="h-3.5 w-3.5" />
                  Save
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col bg-muted/20 min-h-[250px]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground text-center px-4 py-8 m-auto">
              <Loader2 className="h-8 w-8 animate-spin text-primary shrink-0" />
              <p className="text-sm font-medium">
                {isEncrypted ? "Decrypting" : "Loading"}... {progress}%
              </p>
              {fileSize && fileSize > 100 * 1024 * 1024 && (
                <p className="text-xs text-muted-foreground/60">Large file ({formatBytes(fileSize)})</p>
              )}
            </div>
          ) : err ? (
            <div className="flex items-center justify-center flex-1 text-center text-muted-foreground p-4">
              <p className="text-sm font-medium mb-1">Failed to load preview</p>
              <p className="text-xs">Try downloading the file instead.</p>
            </div>
          ) : fileUrl ? (
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              {type === "image" && (
                <img src={fileUrl} alt={fileName || ""}
                  className="max-w-full max-h-full object-contain rounded-lg"
                  onError={() => setErr(true)} />
              )}
              {type === "video" && (
                <video src={fileUrl} controls autoPlay
                  className="w-full h-full rounded-lg bg-black"
                  onError={() => setErr(true)} />
              )}
              {type === "audio" && (
                <audio src={fileUrl} controls className="w-full max-w-sm"
                  onError={() => setErr(true)} />
              )}
              {(type === "pdf" || type === "text") && (
                <iframe src={fileUrl} className="w-full h-full rounded-lg border-0 bg-white" title="Preview"
                  onError={() => setErr(true)} />
              )}
              {type === "other" && (
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Preview not available</p>
                  <p className="text-xs mt-1">Download the file to view it locally.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}