import { useUiStore } from "@/stores/uiStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function GlobalConfirmDialog() {
  const { confirmDialog, resolveConfirm } = useUiStore();

  return (
    <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => {
      if (!open) resolveConfirm(false);
    }}>
      <DialogContent className="sm:max-w-md w-[95vw] md:w-full rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">
            {confirmDialog.title}
          </DialogTitle>
          <DialogDescription className="text-slate-500 mt-2">
            {confirmDialog.message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex flex-row gap-3 justify-end sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="flex-1 sm:flex-none border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-bold px-6"
            onClick={() => resolveConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shadow-sm"
            onClick={() => resolveConfirm(true)}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
