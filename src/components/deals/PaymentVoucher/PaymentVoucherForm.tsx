import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentVoucherSchema, PaymentVoucherFormValues } from "./paymentVoucherSchema";
import { usePaymentVoucher } from "./usePaymentVoucher";
import { ProfileCombobox } from "./ProfileCombobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { useLedgerStore } from "@/stores/useLedgerStore";

interface PaymentVoucherFormProps {
  defaultEntityType?: 'supplier' | 'customer';
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentVoucherForm({ defaultEntityType = 'supplier', onSuccess, onCancel }: PaymentVoucherFormProps) {
  const { submit, isSubmitting } = usePaymentVoucher();
  
  const form = useForm({
    resolver: zodResolver(paymentVoucherSchema),
    defaultValues: {
      entityType: defaultEntityType,
      profileId: "",
      amount: "" as any,
      paymentDate: new Date(),
      paymentMode: "cash",
      referenceNumber: "",
      note: "",
    }
  });

  const onSubmit = async (values: any) => {
    try {
      await submit(values as PaymentVoucherFormValues);
      toast.success("Voucher entry posted successfully!");
      // Force refresh the store cache so the profile lists show updated closing balance
      if (values.entityType === 'supplier') {
        useLedgerStore.getState().fetchSuppliersData(true);
      } else {
        useLedgerStore.getState().fetchCustomersData(true);
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to post entry.");
    }
  };

  const entityType = form.watch("entityType");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Entity Type Toggle */}
      <div className="flex bg-slate-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => {
            form.setValue("entityType", "supplier");
            form.setValue("profileId", "");
          }}
          className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${entityType === 'supplier' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Supplier
        </button>
        <button
          type="button"
          onClick={() => {
            form.setValue("entityType", "customer");
            form.setValue("profileId", "");
          }}
          className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${entityType === 'customer' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Customer
        </button>
      </div>

      {/* Profile Combobox */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {entityType === 'supplier' ? 'Select Supplier' : 'Select Customer'}
        </label>
        <Controller
          name="profileId"
          control={form.control}
          render={({ field, fieldState }) => (
            <>
              <ProfileCombobox 
                entityType={entityType}
                value={field.value}
                onChange={(profileId) => field.onChange(profileId)}
              />
              {fieldState.error && (
                <p className="text-xs text-rose-500 font-medium">{fieldState.error.message}</p>
              )}
            </>
          )}
        />
      </div>

      {/* Amount and Date */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount (₹)</label>
          <Input 
            type="text" 
            inputMode="decimal"
            placeholder="0.00" 
            {...form.register("amount")} 
            className="font-bold bg-white"
          />
          {form.formState.errors.amount && (
            <p className="text-xs text-rose-500 font-medium">{form.formState.errors.amount.message}</p>
          )}
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
          <Controller
            name="paymentDate"
            control={form.control}
            render={({ field }) => (
              <Input 
                type="date"
                className="bg-white"
                value={field.value ? field.value.toISOString().split('T')[0] : ''}
                onChange={(e) => field.onChange(new Date(e.target.value))}
              />
            )}
          />
        </div>
      </div>

      {/* Payment Mode & Reference */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Mode</label>
          <Controller
            name="paymentMode"
            control={form.control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ref No.</label>
          <Input 
            type="text" 
            placeholder="Optional" 
            {...form.register("referenceNumber")} 
            className="bg-white"
          />
        </div>
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Note (Optional)</label>
        <textarea 
          {...form.register("note")}
          className="w-full rounded-md border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          rows={3}
          placeholder="Add details about this voucher..."
        />
        {form.formState.errors.note && (
          <p className="text-xs text-rose-500 font-medium">{form.formState.errors.note.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {isSubmitting ? "Posting..." : "Post Voucher"}
        </Button>
      </div>
    </form>
  );
}
