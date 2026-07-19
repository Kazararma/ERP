"use client";

import { useState } from "react";
import { Bank } from "@/types/bank";
import { formatCurrency } from "@/utils/wageCalculator";
import { AdjustPrincipalModal } from "./AdjustPrincipalModal";
import { BankTransactionLog } from "./BankTransactionLog";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBankStore } from "@/stores/bankStore";
import { useUiStore } from "@/stores/uiStore";
import toast from "react-hot-toast";

export function BankCard({ bank }: { bank: Bank }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { deleteBank } = useBankStore();

  const openAdjust = (e: React.MouseEvent, dir: 'increase' | 'decrease') => {
    e.stopPropagation();
    setDirection(dir);
    setAdjustOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await useUiStore.getState().requestConfirm("Delete Bank", `Are you sure you want to delete "${bank.name}"? This action cannot be undone.`);
    if (confirmed) {
      setDeleting(true);
      try {
        await deleteBank(bank.id);
        toast.success("Bank deleted successfully");
      } catch (err) {
        console.error("Failed to delete bank", err);
        toast.error("Failed to delete bank. Please try again.");
        setDeleting(false);
      }
    }
  };

  return (
    <>
      <div 
        onClick={() => setHistoryOpen(true)}
        className="bg-white/60 backdrop-blur-md rounded-2xl p-6 shadow-lg shadow-indigo-900/5 border border-slate-100 flex flex-col hover:shadow-xl transition-all duration-300 cursor-pointer group"
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <span>🏦</span> {bank.name}
          </h3>
          <div className="flex items-center gap-2">
            {bank.isDefault && (
              <span className="text-[10px] px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold tracking-wider uppercase">
                Default
              </span>
            )}
            <button 
              onClick={handleDelete}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete Bank"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Current Balance</p>
          <p className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(bank.principalAmount)}</p>
        </div>

        <div className="flex gap-3 mt-auto">
          <button onClick={(e) => openAdjust(e, 'increase')} className="flex-1 bg-emerald-50 text-emerald-700 py-2 rounded-lg font-bold hover:bg-emerald-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-emerald-500/25">
            + Add Funds
          </button>
          <button onClick={(e) => openAdjust(e, 'decrease')} className="flex-1 bg-rose-50 text-rose-700 py-2 rounded-lg font-bold hover:bg-rose-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-rose-500/25">
            − Withdraw
          </button>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>{bank.name} - Transaction History</DialogTitle>
          </DialogHeader>
          <BankTransactionLog bankId={bank.id} />
        </DialogContent>
      </Dialog>

      {adjustOpen && (
        <AdjustPrincipalModal 
          bank={bank} 
          direction={direction} 
          open={adjustOpen} 
          onClose={() => setAdjustOpen(false)} 
        />
      )}
    </>
  );
}
