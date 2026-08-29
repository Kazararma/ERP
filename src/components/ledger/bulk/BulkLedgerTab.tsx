"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  bulkLedgerFormSchema,
  BulkLedgerFormValues,
} from "@/schemas/bulkLedgerSchema";
import { submitBulkLedgerEntries } from "@/services/bulkLedgerService";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { useBankStore } from "@/stores/bankStore";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ProfileCombobox } from "@/components/deals/PaymentVoucher/ProfileCombobox";
import { Input } from "@/components/ui/input";

const EMPTY_ROW = {
  ledgerType: "supplier" as const,
  profileId: "",
  profileName: "",
  entryKind: "debit" as const,
  date: new Date().toISOString().slice(0, 10),
  particulars: "",
  subParticulars: "",
  vchType: "Manual" as const,
  vchNo: 1,
  amount: 0,
};

// Extracted styles from Shadcn for native selects to avoid complex Controller boilerplate in a dynamic array
const selectClasses = "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";

export function BulkLedgerTab() {
  const { control, register, handleSubmit, watch, setValue, reset, formState } =
    useForm<BulkLedgerFormValues>({
      resolver: zodResolver(bulkLedgerFormSchema) as any,
      defaultValues: { rows: [EMPTY_ROW] },
    });

  const { banks, subscribeBanks } = useBankStore();

  useEffect(() => {
    const unsub = subscribeBanks();
    return () => unsub();
  }, [subscribeBanks]);

  const { fields, append, remove } = useFieldArray({ control, name: "rows" });

  const onSubmit = async (values: BulkLedgerFormValues) => {
    try {
      await submitBulkLedgerEntries(values.rows);
      toast.success(`${values.rows.length} voucher(s) posted successfully`);
      reset({ rows: [EMPTY_ROW] });
      const store = useLedgerStore.getState();
      store.fetchSuppliersData(true);
      store.fetchCustomersData(true);
      store.fetchMiscellaneousData(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to post bulk vouchers");
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold text-gray-800">Bulk Ledger Entry</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
        {/* Desktop Header Row */}
        <div className="hidden xl:grid grid-cols-[110px_200px_90px_130px_minmax(150px,1fr)_120px_110px_180px_40px] gap-2 px-3 pb-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
          <div>Ledger</div>
          <div>Profile</div>
          <div>Entry</div>
          <div>Date</div>
          <div>Particulars</div>
          <div>Voucher</div>
          <div>Amount (₹)</div>
          <div>Bank Ref</div>
          <div></div>
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => {
            const rowErrors = formState.errors.rows?.[index];

            return (
              <div key={field.id} className="grid grid-cols-1 xl:grid-cols-[110px_200px_90px_130px_minmax(150px,1fr)_120px_110px_180px_40px] gap-2 items-start bg-white border border-slate-200 hover:border-indigo-300 transition-colors rounded-md p-2 shadow-sm relative group">
                
                {/* 1. Type */}
                <div className="flex flex-col gap-1">
                  <select {...register(`rows.${index}.ledgerType`)} className="h-8 text-xs border border-slate-200 rounded px-1 w-full bg-slate-50">
                    <option value="supplier">Supplier</option>
                    <option value="customer">Customer</option>
                    <option value="miscellaneous">Misc.</option>
                  </select>
                </div>

                {/* 2. Profile */}
                <div className="flex flex-col gap-1 overflow-hidden">
                  <ProfileCombobox
                    entityType={watch(`rows.${index}.ledgerType`)}
                    value={watch(`rows.${index}.profileId`)}
                    hideSummary={true}
                    onChange={(profileId, profile) => {
                      setValue(`rows.${index}.profileId`, profile.id, { shouldValidate: true });
                      setValue(`rows.${index}.profileName`, profile.entityName);
                    }}
                  />
                  {rowErrors?.profileId && <span className="text-[9px] text-red-500 absolute -bottom-3">{rowErrors.profileId.message}</span>}
                </div>

                {/* 3. Dr/Cr */}
                <div className="flex flex-col gap-1">
                  <select {...register(`rows.${index}.entryKind`)} className="h-8 text-xs border border-slate-200 rounded px-1 font-semibold w-full bg-slate-50">
                    <option value="debit">Dr (Debit)</option>
                    <option value="credit">Cr (Credit)</option>
                  </select>
                </div>

                {/* 4. Date */}
                <div className="flex flex-col gap-1">
                  <Input type="date" {...register(`rows.${index}.date`)} className="h-8 text-xs px-2 border border-slate-200 rounded bg-slate-50" />
                  {rowErrors?.date && <span className="text-[9px] text-red-500 absolute -bottom-3">{rowErrors.date.message}</span>}
                </div>

                {/* 5. Particulars */}
                <div className="flex flex-col gap-1">
                  <Input type="text" placeholder="Particulars..." {...register(`rows.${index}.particulars`)} className="h-8 text-xs px-2 border border-slate-200 rounded bg-slate-50" />
                  {rowErrors?.particulars && <span className="text-[9px] text-red-500 absolute -bottom-3">{rowErrors.particulars.message}</span>}
                </div>

                {/* 6. Vch */}
                <div className="flex gap-1">
                  <select {...register(`rows.${index}.vchType`)} className="h-8 text-xs border border-slate-200 rounded px-1 w-[65px] bg-slate-50">
                    <option value="Purchase">Purc.</option>
                    <option value="Payment">Pymt</option>
                    <option value="Receipt">Rcpt</option>
                    <option value="Sale">Sale</option>
                    <option value="Journal">Jrnl</option>
                    <option value="Manual">Man.</option>
                  </select>
                  <Input type="number" placeholder="No." {...register(`rows.${index}.vchNo`)} className="h-8 text-xs px-1 w-full border border-slate-200 rounded bg-slate-50" />
                </div>

                {/* 7. Amount */}
                <div className="flex flex-col gap-1">
                  <Input type="number" step="0.01" placeholder="0.00" {...register(`rows.${index}.amount`)} className="h-8 text-xs px-2 font-bold text-right border border-slate-200 rounded bg-slate-50" />
                  {rowErrors?.amount && <span className="text-[9px] text-red-500 absolute -bottom-3">{rowErrors.amount.message}</span>}
                </div>

                {/* 8. Bank */}
                <div className="flex flex-col gap-1">
                  <select 
                    {...register(`rows.${index}.bankId`)} 
                    className="h-8 text-xs rounded border border-slate-200 px-1 bg-slate-50 w-full"
                    onChange={(e) => {
                      const val = e.target.value;
                      setValue(`rows.${index}.bankId`, val || null);
                      setValue(`rows.${index}.recordFundMovement`, !!val);
                    }}
                  >
                    <option value="">-- No Bank --</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {/* Subtle fund direction indicator if bank is selected */}
                  {watch(`rows.${index}.bankId`) && watch(`rows.${index}.recordFundMovement`) && (
                    <span className="text-[9px] font-semibold text-center mt-0.5">
                      {watch(`rows.${index}.entryKind`) === "debit" ? (
                        <span className="text-emerald-600">Fund: IN (Cr)</span>
                      ) : (
                        <span className="text-rose-600">Fund: OUT (Dr)</span>
                      )}
                    </span>
                  )}
                </div>

                {/* 9. Remove */}
                <div className="flex items-center justify-center h-8">
                  {fields.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      onClick={() => remove(index)}
                      className="h-7 w-7 text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => append(EMPTY_ROW)}
            className="w-full sm:w-auto border-dashed border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Voucher Row
          </Button>

          <Button 
            type="submit" 
            disabled={formState.isSubmitting}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 shadow-md"
          >
            {formState.isSubmitting ? "Posting..." : `Submit All Vouchers (${fields.length})`}
          </Button>
        </div>
      </form>
    </div>
  );
}
