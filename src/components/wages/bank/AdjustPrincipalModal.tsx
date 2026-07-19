"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import { useBankStore } from "@/stores/bankStore";
import { adjustPrincipalSchema } from "@/schemas/bankSchema";
import { z } from "zod";
import { Bank } from "@/types/bank";
import { formatCurrency } from "@/utils/wageCalculator";
import toast from 'react-hot-toast';

type FormValues = z.infer<typeof adjustPrincipalSchema>;

export function AdjustPrincipalModal({ bank, direction, open, onClose }: { bank: Bank, direction: 'increase' | 'decrease', open: boolean, onClose: () => void }) {
  const { user } = useAuthStore();
  const { adjustPrincipal } = useBankStore();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(adjustPrincipalSchema) as any,
    defaultValues: { direction, amount: undefined, note: "" },
    mode: "onChange"
  });

  const amountStr = watch("amount");
  const amount = Number(amountStr) || 0;
  const newBalance = direction === 'increase' ? bank.principalAmount + amount : bank.principalAmount - amount;
  const isOverdrawn = direction === 'decrease' && newBalance < 0;

  const onSubmit = async (data: FormValues) => {
    if (!user) return;
    setSubmitting(true);
    try {
      await adjustPrincipal({ bankId: bank.id, amount: data.amount, direction: data.direction, note: data.note || '' }, user.uid);
      reset();
      onClose();
      toast.success(`${direction === 'increase' ? 'Funds added' : 'Funds withdrawn'} successfully`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust balance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{direction === 'increase' ? `Add Funds to ${bank.name}` : `Withdraw from ${bank.name}`}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 pt-2">
          <div className="bg-slate-50 p-3 rounded-lg text-sm border border-slate-200">
            <p className="text-slate-500">Current Balance: <strong className="text-slate-900">{formatCurrency(bank.principalAmount)}</strong></p>
          </div>

          <div className="space-y-2">
            <Label>{direction === 'increase' ? 'Amount to Add (₹)' : 'Amount to Withdraw (₹)'}</Label>
            <Input type="number" step="any" {...register("amount", { valueAsNumber: true })} className={errors.amount ? "border-red-500" : ""} />
            {errors.amount && <p className="text-red-500 text-xs">{errors.amount.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Note (Optional)</Label>
            <Input {...register("note")} placeholder="Reason or reference" />
          </div>

          {isOverdrawn && (
            <p className="text-red-500 text-xs font-semibold">⚠ Amount exceeds current balance</p>
          )}

          <div className="bg-blue-50 p-3 rounded-lg text-sm border border-blue-100 flex justify-between items-center">
            <span className="text-slate-600">New Balance:</span>
            <strong className={`text-lg ${isOverdrawn ? 'text-red-600' : 'text-slate-900'}`}>{formatCurrency(newBalance)}</strong>
          </div>

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-md font-semibold hover:bg-slate-200 transition-colors">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting || amount <= 0 || isOverdrawn} 
              className={`flex-1 text-white py-2.5 rounded-md font-semibold transition-colors disabled:opacity-50 ${direction === 'increase' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
            >
              {submitting ? "Processing..." : direction === 'increase' ? 'Add Funds' : 'Withdraw'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
