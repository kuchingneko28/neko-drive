import { FileActions } from "@/components/FileActions";
import { DeleteFileDialog } from "@/components/DeleteFileDialog";
import { EmptyTrashDialog } from "@/components/EmptyTrashDialog";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { RenameFileDialog } from "@/components/RenameFileDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransfer } from "@/context/TransferContext";
import { useFiles } from "@/hooks/use-files";
import { getFileIcon, getFileIconColor, isFileEncrypted } from "@/lib/file-utils";
import { api } from "@/lib/api";
import { cn, formatBytes, formatRelativeDate } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileBox,
  Globe,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

gsap.registerPlugin(useGSAP);

const PAGE_SIZE = 10;

function FileTypeBadge({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return (
    <Badge variant="secondary" className="rounded bg-secondary/50 text-muted-foreground px-1.5">
      {ext}
    </Badge>
  );
}

export function StackList({ status = "active" }: { status?: "active" | "trashed" }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"ASC" | "DESC">("DESC");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Debounce search so we don't hit the server on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Changing view or sort can shrink the result set; drop back to page 0 so we
  // never land on an empty page while files still exist.
  useEffect(() => {
    setPage(0);
  }, [status, sort, order]);

  const { data, isLoading, isError } = useFiles(page, PAGE_SIZE, debouncedSearch, status, sort, order);

  // Deleting/restoring the last file on a page can leave a stale empty page —
  // back up one page when the current one comes back empty but files exist.
  useEffect(() => {
    if (!isLoading && data && data.items.length === 0 && data.total > 0 && page > 0) {
      setPage(page - 1);
    }
  }, [data, isLoading, page]);

  const listRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      // CSS can't stagger reliably across re-renders; GSAP handles it cleanly.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        ".file-row",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.25, ease: "power2.out", stagger: 0.04, overwrite: true },
      );
    },
    { scope: listRef, dependencies: [data?.items, status] },
  );

  // Heading + toolbar settle in when switching between All Files / Trash.
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        ".file-top",
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.25, ease: "power2.out", stagger: 0.06, overwrite: true },
      );
    },
    { scope: listRef, dependencies: [status] },
  );

  const toggleSort = (col: string) => {
    if (sort === col) {
      setOrder((o) => (o === "ASC" ? "DESC" : "ASC"));
    } else {
      setSort(col);
      setOrder("DESC");
    }
  };
  const { download: dc, upload: uc } = useTransfer();
  const { downloadFile, previewFile, clearPreview, isDownloading, progress } = dc;
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

  const activeFile = data?.items.find((file) => file.id === activeFileId);

  return (
    <div className="flex flex-col h-full gap-4" ref={listRef}>
      <h1 className="file-top text-lg font-bold tracking-tight shrink-0">
        {status === "trashed" ? "Trash" : "All Files"}
      </h1>
      <div className="file-top flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <Input
            placeholder="Search files..."
            className="pl-9 h-9 bg-secondary/40 dark:bg-secondary/40 border-transparent rounded-lg text-xs font-medium placeholder:text-muted-foreground/40"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        {!debouncedSearch && data && data.total > 0 && (
          <span className="text-xs text-muted-foreground/60 font-medium shrink-0">{data.total} file{data.total !== 1 ? "s" : ""}</span>
        )}
        {status === "trashed" && (data?.items.length || 0) > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setTrashOpen(true)} className="rounded-lg h-9 px-3 text-xs font-semibold">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Empty Trash
          </Button>
        )}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilePick} />
      </div>

      <div className="file-top flex items-center gap-1">
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
              "h-7 px-2 text-xs font-medium rounded-md",
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
        <div className="space-y-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/40">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center min-h-64 gap-5">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-semibold">Failed to load files</p>
            <p className="text-sm text-muted-foreground/60">Check your connection and try again</p>
          </div>
          <Button
            variant="outline" size="sm" className="rounded-lg text-xs"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["files"] })}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-64 gap-5">
          <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
            <FileBox className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-semibold">
              {search ? "No results found" : status === "trashed" ? "Trash is empty" : "Drive is empty"}
            </p>
            <p className="text-sm text-muted-foreground/60">
              {search
                ? "Try a different search term"
                : status === "trashed"
                  ? "Deleted files appear here"
                  : "Drop files anywhere to upload"}
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
        <div className="space-y-1.5" ref={listRef}>
          {data?.items.map((file) => {
            const encrypted = isFileEncrypted(file.iv, file.salt);
            const isActiveDownload = isDownloading && file.id === activeFileId;
            return (
              <div
                key={file.id}
                className={cn(
                  "file-row group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  "hover:bg-secondary/50",
                  isActiveDownload && "bg-primary/5",
                )}
              >
                <div className={cn("p-2 rounded-lg bg-primary/5 shrink-0", getFileIconColor(file.name))}>
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
                  isDownloading={isDownloading && file.id === activeFileId}
                  restoringId={restoringId}
                  onPreview={(id, name) => { setActiveFileId(id); previewFile(id, name); }}
                  onDownload={(id, name) => { setActiveFileId(id); downloadFile(id, name); }}
                  onRename={(id, name) => setRenameTarget({ id, name })}
                  onDelete={(id, name) => setDeleteTarget({ id, name })}
                  onRestore={(id) => handleRestore(id)}
                />
              </div>
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
        onClose={() => {
          setDeleteTarget(null);
          setActiveFileId(null);
        }}
      />
    </div>
  );
}