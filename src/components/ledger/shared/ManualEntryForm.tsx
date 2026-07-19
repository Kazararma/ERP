import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ManualLedgerEntryFormSchema, type ManualLedgerEntryForm } from "@/types/ledger-profile";
import { RiceType } from "@/types/riceTypes";
import { getActiveRiceTypes } from "@/services/riceTypeService";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ManualLedgerEntryForm) => Promise<void>;
  nextVchNo: number;
}

const VCH_TYPES = ["Purchase", "Payment", "Receipt", "Sale", "Journal", "Manual"] as const;

export function ManualEntryForm({ open, onClose, onSubmit, nextVchNo }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ManualLedgerEntryForm>({
    resolver: zodResolver(ManualLedgerEntryFormSchema) as any,
    defaultValues: {
      vchNo: nextVchNo,
      vchType: "Manual",
      entryKind: "debit",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        vchNo: nextVchNo,
        vchType: "Manual",
        entryKind: "debit",
      });
    }
  }, [open, nextVchNo, reset]);

  const watchQty = watch("quantityKg");
  const watchRate = watch("pricePerUnit");

  const [riceTypes, setRiceTypes] = useState<RiceType[]>([]);

  useEffect(() => {
    getActiveRiceTypes().then(setRiceTypes).catch(console.error);
  }, []);

  useEffect(() => {
    if (watchQty && watchRate) {
      // pricePerUnit can be per kg or per unit depending on business logic. 
      // Assuming it's simple multiplication as requested.
      const calculated = parseFloat((watchQty * watchRate).toFixed(2));
      setValue("amount", calculated, { shouldValidate: true, shouldDirty: true });
    }
  }, [watchQty, watchRate, setValue]);

  const handleFormSubmit = async (data: ManualLedgerEntryForm) => {
    await onSubmit(data);
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[480px] sm:max-w-[480px] bg-white shadow-2xl p-0 flex flex-col">
        <SheetHeader className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <SheetTitle className="text-xl font-bold text-slate-800">Add Manual Entry</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex-1 flex flex-col overflow-hidden">

          <div className="p-8 space-y-6 flex-1 overflow-y-auto">
            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-slate-700 font-medium">Date *</Label>
              <Input id="date" type="date" {...register("date")} className="shadow-sm" />
              {errors.date && <p className="text-xs text-rose-500 mt-1">{errors.date.message}</p>}
            </div>

            {/* Particulars */}
            <div className="space-y-1.5">
              <Label htmlFor="particulars" className="text-slate-700 font-medium">Particulars *</Label>
              <Input id="particulars" placeholder="e.g. Sarno Paddy (Krm-1622)" {...register("particulars")} className="shadow-sm" />
              {errors.particulars && <p className="text-xs text-rose-500 mt-1">{errors.particulars.message}</p>}
            </div>

            {/* Sub-particulars */}
            <div className="space-y-1.5">
              <Label htmlFor="subParticulars" className="text-slate-700 font-medium">Details (optional)</Label>
              <Input id="subParticulars" placeholder="e.g. 68.80 qtls @ ₹1,991.67/qtl" {...register("subParticulars")} className="shadow-sm" />
            </div>

            {/* Vch Type */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">Voucher Type *</Label>
              <input type="hidden" {...register("vchType")} />
              <Select onValueChange={(v) => setValue("vchType", v as any)} defaultValue="Manual">
                <SelectTrigger className="shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VCH_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Debit / Credit Toggle */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">Entry Type *</Label>
              <input type="hidden" {...register("entryKind")} />
              <div className="flex gap-3 mt-2 p-1 bg-slate-100 rounded-lg">
                {(["debit", "credit"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setValue("entryKind", kind)}
                    className={`flex-1 py-2.5 rounded-md text-sm font-bold transition-all shadow-sm ${watch("entryKind") === kind
                        ? kind === "debit"
                          ? "bg-white text-rose-600 ring-1 ring-slate-200"
                          : "bg-white text-emerald-600 ring-1 ring-slate-200"
                        : "bg-transparent text-slate-500 hover:text-slate-700 shadow-none"
                      }`}
                  >
                    {kind === "debit" ? "Dr Debit" : "Cr Credit"}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <Label htmlFor="amount" className="text-slate-800 font-bold">Amount (₹) *</Label>
              <Input
                id="amount"
                type="number"
                step="any"
                {...register("amount", { valueAsNumber: true })}
                className="shadow-sm text-lg font-mono border-indigo-200 focus-visible:ring-indigo-500"
              />
              {errors.amount && <p className="text-xs text-rose-500 mt-1">{errors.amount.message}</p>}
            </div>

            {/* Rice Type */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">Rice Type (optional)</Label>
              <input type="hidden" {...register("riceType")} />
              <Select onValueChange={(v) => setValue("riceType", v ?? undefined)} value={watch("riceType") ?? undefined}>
                <SelectTrigger className="shadow-sm bg-white border-slate-200">
                  <SelectValue placeholder="Select rice type..." />
                </SelectTrigger>
                <SelectContent>
                  {riceTypes.map((rt) => (
                    <SelectItem key={rt.riceTypeId} value={rt.displayName}>
                      {rt.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Optional stock fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="quantityKg" className="text-slate-600 text-xs uppercase tracking-wider">Qty (Kg)</Label>
                <Input id="quantityKg" type="number" step="any" {...register("quantityKg", { valueAsNumber: true })} className="bg-slate-50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pricePerUnit" className="text-slate-600 text-xs uppercase tracking-wider">Rate (₹)</Label>
                <Input id="pricePerUnit" type="number" step="any" {...register("pricePerUnit", { valueAsNumber: true })} className="bg-slate-50" />
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-200 bg-slate-50/50 flex gap-3 sticky bottom-0 z-10">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-white shadow-sm font-semibold">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
              {isSubmitting ? "Saving…" : "Add Entry"}
            </Button>
          </div>

        </form>
      </SheetContent>
    </Sheet>
  );
}
