import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  fileId: string | null;
  fileName: string | null;
  status: "active" | "trashed";
  onClose: () => void;
}

export function DeleteFileDialog({ fileId, fileName, status, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const open = !!fileId && !!fileName;

  const handleDelete = async () => {
    if (!fileId) return;
    setLoading(true);
    try {
      await api.delete(`/files/${fileId}`);
      toast.success(status === "active" ? `Moved to trash.` : `Deleted permanently.`);
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["system-stats"] });
      onClose();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <AlertDialogContent className="rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-bold">
            {status === "active" ? "Move to trash?" : "Delete forever?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {status === "active"
              ? `"${fileName}" can be restored later from trash.`
              : `"${fileName}" will be permanently deleted.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg text-xs font-medium" disabled={loading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium"
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            {status === "active" ? "Move to Trash" : "Delete Forever"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}