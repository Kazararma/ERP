"use client";

import { SalaryTransaction } from "@/types/salaryTransaction";
import { formatCurrency } from "@/utils/wageCalculator";
import { format } from "date-fns";

interface Props {
  transactions: SalaryTransaction[];
  onRowClick: (tx: SalaryTransaction) => void;
  isLoading: boolean;
}

export function SalaryLedgerTable({ transactions, onRowClick, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-lg border border-slate-200"></div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-white/50 text-slate-500 font-medium">
        No salary payments found for the selected period.
      </div>
    );
  }

  const totalPaid = transactions.reduce((sum, tx) => sum + tx.grossAmount, 0);

  return (
    <div className="bg-white/60 backdrop-blur-md border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full">
        <table className="w-full min-w-[700px] text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Date & Time</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Breakdown</th>
              <th className="px-4 py-3 text-right">Gross Paid</th>
              <th className="px-4 py-3">Bank</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((tx, idx) => {
              const dateObj = tx.paidAt?.toMillis ? new Date(tx.paidAt.toMillis()) : new Date(tx.paidAt as unknown as string);
              return (
                <tr 
                  key={tx.id} 
                  onClick={() => onRowClick(tx)}
                  className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{format(dateObj, 'dd MMM yyyy, HH:mm')}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{tx.employeeName}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider
                      ${tx.wageMode === 'fixed' ? 'bg-slate-100 text-slate-600' : 
                        tx.wageMode === 'hourly' ? 'bg-blue-100 text-blue-700' : 
                        'bg-amber-100 text-amber-700'}`}
                    >
                      {tx.wageMode === 'fixed' ? 'Fixed' : tx.wageMode === 'hourly' ? 'Hourly' : 'Per Bag'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {tx.wageMode === 'fixed' ? 'Monthly salary' : 
                     tx.wageMode === 'hourly' ? `${tx.hoursWorked} hrs × ${formatCurrency(tx.rateApplied)}` : 
                     `${tx.bagsCompleted} bags × ${formatCurrency(tx.rateApplied)}`}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(tx.grossAmount)}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs truncate max-w-[150px]">{tx.bankName}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right uppercase tracking-wider text-xs text-slate-500">Total paid this period</td>
              <td className="px-4 py-3 text-right text-emerald-700 text-lg">{formatCurrency(totalPaid)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
