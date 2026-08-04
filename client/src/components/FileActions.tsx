import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FileMetadata } from "@/types";
import { Download, Eye, Globe, Loader2, MoreVertical, Pencil, Shield, Trash2, Undo2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { getFileType, isFileEncrypted } from "@/lib/file-utils";

interface FileActionsProps {
  file: FileMetadata;
  status: "active" | "trashed";
  isDownloading: boolean;
  restoringId: string | null;
  onPreview: (id: string, name: string) => void;
  onDownload: (id: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onRestore: (id: string, name: string) => void;
}

export function FileActions({
  file, status, isDownloading,
  restoringId, onPreview, onDownload, onRename, onDelete, onRestore,
}: FileActionsProps) {
  if (isDownloading) {
    return (
      <div className="flex items-center justify-center px-2 py-1 rounded-lg bg-primary/10 w-8 h-8">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      </div>
    );
  }

  const fileType = getFileType(file.name);
  const canPreview = fileType === "code" || ["image", "video", "audio", "pdf", "text"].includes(fileType);
  const encrypted = isFileEncrypted(file.iv, file.salt);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground/30 hover:text-foreground hover:bg-secondary/50 data-[state=open]:text-foreground data-[state=open]:bg-secondary/50 transition-all"
          aria-label={`Actions for ${file.name}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 p-1">
        <div className="px-2.5 py-2 mb-0.5 border-b border-border/5">
          <div className="flex items-start gap-2.5">
            <div className={cn(
              "p-1.5 rounded-md mt-0.5 shrink-0",
              encrypted ? "bg-primary/10" : "bg-success/10",
            )}>
              {encrypted ? <Shield className="h-3.5 w-3.5 text-primary" /> : <Globe className="h-3.5 w-3.5 text-success" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate leading-tight">{file.name}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {formatBytes(file.size)}
                <span className="mx-1">·</span>
                {file.chunks} {file.chunks === 1 ? "chunk" : "chunks"}
                <span className="mx-1">·</span>
                {file.createdAt
                  ? new Date(file.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {status === "active" ? (
          <>
            {canPreview && (
              <DropdownMenuItem onClick={() => onPreview(file.id, file.name)} className="text-xs gap-2.5 py-1.5">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                Preview
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDownload(file.id, file.name)} className="text-xs gap-2.5 py-1.5">
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(file.id, file.name)} className="text-xs gap-2.5 py-1.5">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-0.5" />
            <DropdownMenuItem
              onClick={() => onDelete(file.id, file.name)}
              className="text-xs gap-2.5 py-1.5 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Move to Trash
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem
              onClick={() => onRestore(file.id, file.name)}
              disabled={restoringId === file.id}
              className="text-xs gap-2.5 py-1.5 text-success focus:text-success"
            >
              {restoringId === file.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              Restore
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(file.id, file.name)}
              className="text-xs gap-2.5 py-1.5 text-destructive focus:text-destructive"
              disabled={restoringId === file.id}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Forever
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}