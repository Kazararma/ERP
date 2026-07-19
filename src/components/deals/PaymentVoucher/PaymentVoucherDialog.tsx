import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PaymentVoucherForm } from "./PaymentVoucherForm";

interface PaymentVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: 'supplier' | 'customer';
}

export function PaymentVoucherDialog({ open, onOpenChange, defaultEntityType }: PaymentVoucherDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-slate-50 border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-800">Payment Voucher</DialogTitle>
          <DialogDescription className="text-slate-500 font-medium">
            Record a manual payment or receipt against a ledger profile.
          </DialogDescription>
        </DialogHeader>
        
        <div className="pt-2">
          <PaymentVoucherForm 
            defaultEntityType={defaultEntityType}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
