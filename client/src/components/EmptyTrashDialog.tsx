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
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface EmptyTrashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmptyTrashDialog({ open, onOpenChange }: EmptyTrashDialogProps) {
  const [isEmptying, setIsEmptying] = useState(false);
  const queryClient = useQueryClient();

  const handleEmpty = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsEmptying(true);
    try {
      await api.delete("/files/trash");
      toast.success("Trash emptied.");
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["system-stats"] });
      onOpenChange(false);
    } catch {
      toast.error("Purge failed.");
    } finally {
      setIsEmptying(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-bold">Empty trash?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            This will permanently delete all trashed files. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg text-xs font-medium">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium"
            disabled={isEmptying}
            onClick={handleEmpty}
          >
            {isEmptying ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Empty Trash
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}