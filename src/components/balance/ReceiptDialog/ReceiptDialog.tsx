import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReceiptForm } from "./ReceiptForm";

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "balance" | "pnl";
}

export function ReceiptDialog({ open, onOpenChange, mode = "balance" }: ReceiptDialogProps) {
  const isPnL = mode === "pnl";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-slate-50 border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-800">
            {isPnL ? "Post P&L Receipt" : "Post Receipt"}
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium">
            {isPnL
              ? "Record a direct numeric adjustment to any Profit & Loss row."
              : "Record a direct numeric adjustment to any Balance Sheet row."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="pt-2">
          <ReceiptForm 
            mode={mode}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
