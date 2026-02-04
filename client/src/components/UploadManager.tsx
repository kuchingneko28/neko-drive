import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUpload } from "@/hooks/use-upload";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import React, { useRef } from "react";

export function UploadManager() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, startUpload } = useUpload();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      startUpload(file);
    }
  };

  if (upload.status === "idle") {
    return (
      <>
        <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="gap-2 rounded-xl h-10 px-6 shadow-md shadow-primary/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Upload className="h-4 w-4" />
          <span>Upload Archive</span>
        </Button>
      </>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-80 shadow-2xl border-border/50 animate-in slide-in-from-right-4 duration-300 z-100">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "p-2 rounded-lg",
              upload.status === "uploading" && "bg-primary/10 text-primary",
              upload.status === "success" && "bg-green-500/10 text-green-500",
              upload.status === "error" && "bg-destructive/10 text-destructive",
            )}
          >
            {upload.status === "uploading" && <Loader2 className="h-5 w-5 animate-spin" />}
            {upload.status === "success" && <CheckCircle2 className="h-5 w-5" />}
            {upload.status === "error" && <AlertCircle className="h-5 w-5" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{upload.currentFileName}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              {upload.status === "uploading" ? `Uploading... ${upload.progress}%` : upload.status}
            </p>
          </div>
        </div>

        {upload.status === "uploading" && (
          <div className="mt-4 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${upload.progress}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
