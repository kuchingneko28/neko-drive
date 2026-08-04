import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
  fileId: string | null;
  fileName: string | null;
  onClose: () => void;
}

export function RenameFileDialog({ fileId, fileName, onClose }: Props) {
  const ext = fileName?.includes(".") ? "." + fileName.split(".").pop()! : "";
  const base = fileName ? fileName.slice(0, fileName.length - ext.length) : "";
  const [name, setName] = useState(base);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const open = !!fileId && !!fileName;

  useEffect(() => {
    if (open) setName(base);
  }, [open]);

  const handleSubmit = async () => {
    if (!fileId || !name.trim()) return;
    setLoading(true);
    try {
      await api.patch(`/files/${fileId}`, { name: name.trim() + ext });
      toast.success("File renamed");
      queryClient.invalidateQueries({ queryKey: ["files"] });
      onClose();
    } catch (error) {
      toast.error(`Failed: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-xl bg-card">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Rename file
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-3"
        >
          <div className="flex items-center gap-0.5 bg-secondary/40 rounded-lg border border-transparent px-3 has-focus:ring-2 has-focus:ring-ring">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 border-0 bg-transparent dark:bg-transparent px-0 py-2 text-sm shadow-none focus-visible:ring-0"
              autoFocus
            />
            {ext && (
              <span className="text-sm text-muted-foreground/50 py-2 shrink-0 pointer-events-none">
                {ext}
              </span>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-xs"
              type="button"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-lg text-xs"
              type="submit"
              disabled={loading || !name.trim()}
            >
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
