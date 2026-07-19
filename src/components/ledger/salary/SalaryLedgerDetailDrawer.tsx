"use client";

import { SalaryTransaction } from "@/types/salaryTransaction";
import { formatCurrency } from "@/utils/wageCalculator";
import { format } from "date-fns";

interface Props {
  transaction: SalaryTransaction | null;
  onClose: () => void;
}

export function SalaryLedgerDetailDrawer({ transaction, onClose }: Props) {
  if (!transaction) return null;

  const dateObj = transaction.paidAt?.toMillis ? new Date(transaction.paidAt.toMillis()) : new Date(transaction.paidAt as unknown as string);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transform transition-transform overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">Payment Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-8 flex-1">
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Employee</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Name:</span> <span className="font-semibold text-slate-900">{transaction.employeeName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Contract:</span> <span className="text-slate-900 capitalize">{transaction.contractType}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Wage Mode:</span> <span className="text-slate-900 capitalize">{transaction.wageMode}</span></div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Payment Breakdown</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-sm">
              {transaction.wageMode === 'fixed' && (
                <div className="flex justify-between"><span className="text-slate-500">Fixed Monthly Salary:</span> <span className="font-medium text-slate-900">{formatCurrency(transaction.grossAmount)}</span></div>
              )}
              {transaction.wageMode === 'hourly' && (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">Hourly Rate:</span> <span className="font-medium text-slate-900">{formatCurrency(transaction.rateApplied)}/hr</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Hours Worked:</span> <span className="font-medium text-slate-900">{transaction.hoursWorked} hrs</span></div>
                </>
              )}
              {transaction.wageMode === 'perBag' && (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">Rate per Bag:</span> <span className="font-medium text-slate-900">{formatCurrency(transaction.rateApplied)}/bag</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Bags Completed:</span> <span className="font-medium text-slate-900">{transaction.bagsCompleted}</span></div>
                </>
              )}
              <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between items-center">
                <span className="font-bold text-slate-700">Gross Amount:</span> 
                <span className="font-black text-emerald-600 text-lg">{formatCurrency(transaction.grossAmount)}</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Bank</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Paid From:</span> <span className="font-semibold text-slate-900">{transaction.bankName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Bank ID:</span> <span className="font-mono text-xs text-slate-400">{transaction.bankId}</span></div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Audit</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Paid At:</span> <span className="text-slate-900">{format(dateObj, "dd MMM yyyy, HH:mm:ss")}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Paid By:</span> <span className="text-slate-900">{transaction.paidByName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Ref ID:</span> <span className="font-mono text-xs text-slate-400">{transaction.id}</span></div>
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
          <button onClick={onClose} className="w-full bg-slate-100 text-slate-700 py-3 rounded-lg font-bold hover:bg-slate-200 transition-colors">
            Close
          </button>
        </div>
      </div>
    </>
  );
}
