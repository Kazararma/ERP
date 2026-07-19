// src/components/ledger/shared/LedgerTotalsFooter.tsx
import { formatCurrency } from "@/lib/utils";

interface Props {
  totalDebit: number;
  totalCredit: number;
}

export function LedgerTotalsFooter({ totalDebit, totalCredit }: Props) {
  const closing = totalDebit - totalCredit;
  const isCredit = closing < 0;

  return (
    <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200 shadow-sm mt-6 space-y-3">
      {/* Grand total row */}
      <div className="flex justify-between items-center text-sm font-bold bg-white border border-slate-200 shadow-sm px-5 py-3 rounded-lg">
        <span className="text-slate-700 uppercase tracking-wide text-xs">Grand Total</span>
        <div className="flex gap-20">
          <span className="text-rose-600 font-mono text-base">{formatCurrency(totalDebit)}</span>
          <span className="text-emerald-600 font-mono text-base">{formatCurrency(totalCredit)}</span>
        </div>
      </div>

      {/* Closing balance */}
      <div className="flex justify-between items-center text-sm font-bold px-5 py-2">
        <span className={`uppercase tracking-wide text-xs ${isCredit ? "text-emerald-600" : "text-rose-600"}`}>
          {isCredit ? "Cr" : "Dr"} Closing Balance
        </span>
        <span className="font-mono text-lg text-slate-800">{formatCurrency(Math.abs(closing))}</span>
      </div>

      {/* Equalised total */}
      <div className="flex justify-between items-center text-sm font-bold bg-slate-900 text-white shadow-md px-5 py-3 rounded-lg mt-2">
        <span className="font-mono text-base">{formatCurrency(Math.max(totalDebit, totalCredit))}</span>
        <span className="font-mono text-base">{formatCurrency(Math.max(totalDebit, totalCredit))}</span>
      </div>
    </div>
  );
}
