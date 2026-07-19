"use client";

import { useEffect, useState } from "react";
import { useBankStore } from "@/stores/bankStore";
import { BankCard } from "./BankCard";
import { CreateBankModal } from "./CreateBankModal";

export function BankTab() {
  const { banks, isLoading, subscribeBanks } = useBankStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeBanks();
    return () => { unsub(); };
  }, [subscribeBanks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white/40 p-4 rounded-xl border border-slate-100 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800">Treasury / Banks</h2>
        <button 
          onClick={() => setCreateModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-indigo-700 transition-all hover:shadow-md"
        >
          + Add Bank
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : banks.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 backdrop-blur-sm text-slate-500 font-medium">
          No banks found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banks.map(bank => (
            <BankCard key={bank.id} bank={bank} />
          ))}
        </div>
      )}

      {createModalOpen && (
        <CreateBankModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      )}
    </div>
  );
}
