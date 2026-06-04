import { FileActions } from "@/components/FileActions";
import { DeleteFileDialog } from "@/components/DeleteFileDialog";
import { EmptyTrashDialog } from "@/components/EmptyTrashDialog";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { RenameFileDialog } from "@/components/RenameFileDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransfer } from "@/context/TransferContext";
import { useFiles } from "@/hooks/use-files";
import { getFileIcon, isFileEncrypted } from "@/lib/file-utils";
import { api } from "@/lib/api";
import { cn, formatBytes, formatRelativeDate } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileBox,
  Globe,
  Search,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

const PAGE_SIZE = 10;

function FileTypeBadge({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-secondary/50 text-muted-foreground uppercase">
      {ext}
    </span>
  );
}

export function StackList({ status = "active" }: { status?: "active" | "trashed" }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"ASC" | "DESC">("DESC");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useFiles(page, PAGE_SIZE, search, status, sort, order);

  const toggleSort = (col: string) => {
    if (sort === col) {
      setOrder((o) => (o === "ASC" ? "DESC" : "ASC"));
    } else {
      setSort(col);
      setOrder("DESC");
    }
  };
  const { download: dc, upload: uc } = useTransfer();
  const { downloadFile, previewFile, clearPreview, isDownloading, progress, fileName: activeName } = dc;
  const { uploadFiles } = uc;

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      uploadFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleRestore = async (fileId: string) => {
    setRestoringId(fileId);
    try {
      await api.post(`/files/${fileId}/restore`, {});
      queryClient.invalidateQueries({ queryKey: ["files"] });
    } catch {
      /* ignore */
    } finally {
      setRestoringId(null);
    }
  };

  const activeFile = data?.items.find((f) => f.name === activeName);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <Input
            placeholder="Search files..."
            className="pl-9 h-9 bg-secondary/30 border-border/5 rounded-lg text-xs font-medium placeholder:text-muted-foreground/40"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        {!search && data && data.total > 0 && (
          <span className="text-xs text-muted-foreground/40 font-medium shrink-0">{data.total} file{data.total !== 1 ? "s" : ""}</span>
        )}
        {status === "trashed" && (data?.items.length || 0) > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setTrashOpen(true)} className="rounded-lg h-9 px-3 text-xs font-semibold">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Empty Trash
          </Button>
        )}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilePick} />
      </div>

      <div className="flex items-center gap-1">
        {[
          { key: "name", label: "Name" },
          { key: "size", label: "Size" },
          { key: "created_at", label: "Date" },
        ].map(({ key, label }) => (
          <Button
            key={key}
            variant="ghost" size="sm"
            onClick={() => toggleSort(key)}
            className={cn(
              "h-7 px-2 text-[11px] font-medium rounded-md",
              sort === key
                ? "text-primary bg-primary/10 hover:bg-primary/15"
                : "text-muted-foreground/30 hover:text-muted-foreground",
            )}
          >
            {label}
            {sort === key && (
              order === "ASC"
                ? <ArrowUp className="h-3 w-3 ml-0.5" />
                : <ArrowDown className="h-3 w-3 ml-0.5" />
            )}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-card/50 border border-border/5">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-64 gap-5">
          <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
            <FileBox className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-semibold">{search ? "No results found" : "Drive is empty"}</p>
            <p className="text-sm text-muted-foreground/60">
              {search ? "Try a different search term" : "Drop files anywhere to upload"}
            </p>
          </div>
          {!search && status !== "trashed" && (
            <Button onClick={handleUploadClick} className="rounded-lg gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" />
              Upload to Drive
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {data?.items.map((file, i) => {
            const encrypted = isFileEncrypted(file.iv, file.salt);
            const isActiveDownload = isDownloading && activeName === file.name;
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-xl transition-all overflow-hidden",
                  "bg-card/30 border border-border/5 hover:border-border/20 hover:bg-card/60",
                  isActiveDownload && "border-primary/20 bg-primary/[0.02]",
                )}
              >
                <div className="p-2 rounded-lg bg-primary/5 text-primary shrink-0">
                  {getFileIcon(file.name)}
                </div>

                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{file.name}</span>
                      {isActiveDownload && (
                        <span className="text-xs font-bold text-primary tabular-nums shrink-0">
                          {progress}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap min-w-0">
                      <FileTypeBadge fileName={file.name} />
                      <span className="text-xs text-muted-foreground/50 whitespace-nowrap">{formatBytes(file.size)}</span>
                      <span className="text-xs text-muted-foreground/30">·</span>
                      <span className="text-xs text-muted-foreground/50 whitespace-nowrap">{file.chunks}ch</span>
                      <span className="text-xs text-muted-foreground/30">·</span>
                      <span className="text-xs text-muted-foreground/50 flex items-center gap-1 whitespace-nowrap min-w-0">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="truncate">{file.createdAt ? formatRelativeDate(file.createdAt) : "N/A"}</span>
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {encrypted ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary/50 bg-primary/[0.04] px-2 py-0.5 rounded-full border border-primary/15">
                        <Shield className="h-2.5 w-2.5" />
                        AES-256
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-success/60 bg-success/[0.05] px-2 py-0.5 rounded-full border border-success/20">
                        <Globe className="h-2.5 w-2.5" />
                        Public
                      </span>
                    )}
                  </div>
                </div>

                <FileActions
                  file={file}
                  status={status}
                  isDownloading={isDownloading}
                  progress={progress}
                  mode={dc.mode}
                  fileName={activeName}
                  restoringId={restoringId}
                  onPreview={previewFile}
                  onDownload={downloadFile}
                  onRename={(id, name) => setRenameTarget({ id, name })}
                  onDelete={(id, name) => setDeleteTarget({ id, name })}
                  onRestore={(id) => handleRestore(id)}
                />
              </motion.div>
            );
          })}

          {(data?.total || 0) > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-3 gap-2">
              <p className="text-xs font-semibold text-muted-foreground/50">
                {page + 1}/{Math.ceil((data?.total || 0) / PAGE_SIZE)}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 w-7 p-0 rounded-lg"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= (data?.total || 0)}
                  className="h-7 w-7 p-0 rounded-lg"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <EmptyTrashDialog open={trashOpen} onOpenChange={setTrashOpen} />

      <FilePreviewModal
        isOpen={!!dc.previewUrl || (isDownloading && dc.mode === "preview")}
        onClose={clearPreview}
        fileName={dc.fileName}
        fileUrl={dc.previewUrl}
        isLoading={isDownloading && dc.mode === "preview"}
        progress={progress}
        isEncrypted={activeFile ? isFileEncrypted(activeFile.iv, activeFile.salt) : false}
        fileSize={activeFile?.size}
      />

      <RenameFileDialog
        fileId={renameTarget?.id || null}
        fileName={renameTarget?.name || null}
        onClose={() => setRenameTarget(null)}
      />

      <DeleteFileDialog
        fileId={deleteTarget?.id || null}
        fileName={deleteTarget?.name || null}
        status={status}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}