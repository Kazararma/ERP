"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBankStore } from "@/stores/bankStore";
import { bankSchema } from "@/schemas/bankSchema";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Bank } from '@/types/bank';
import toast from 'react-hot-toast';

type FormValues = z.infer<typeof bankSchema>;

export function CreateBankModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createBank } = useBankStore();
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: { name: "", principalAmount: 0 }
  });

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      await createBank(data);
      setShowSuccess(true);
      setTimeout(() => {
        reset();
        setShowSuccess(false);
        onClose();
      }, 1500);
      toast.success("Bank account created");
    } catch (err: any) {
      toast.error(err.message || 'Failed to create bank');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { 
      if (!val) {
        setShowSuccess(false);
        onClose(); 
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        {showSuccess ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-emerald-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Bank Created!</h2>
              <p className="text-slate-500 font-medium">The new bank account is ready.</p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add New Bank</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input {...register("name")} placeholder="e.g. Punjab National Bank – Operations" className={errors.name ? "border-red-500" : ""} />
                {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Opening Balance (₹)</Label>
                <Input type="number" step="any" {...register("principalAmount", { valueAsNumber: true })} className={errors.principalAmount ? "border-red-500" : ""} />
                {errors.principalAmount && <p className="text-red-500 text-xs">{errors.principalAmount.message}</p>}
                <p className="text-xs text-slate-500">You can adjust this later</p>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-md font-semibold hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-md font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {submitting ? "Processing..." : "Create Bank"}
                </button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
