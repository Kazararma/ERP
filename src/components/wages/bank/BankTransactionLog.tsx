"use client";

import { useEffect, useState, useMemo } from "react";
import { BankTransaction } from "@/types/bank";
import { useBankStore } from "@/stores/bankStore";
import { useWagesStore } from "@/stores/wagesStore";
import { formatCurrency } from "@/utils/wageCalculator";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function BankTransactionLog({ bankId }: { bankId: string }) {
  const { fetchBankTransactions } = useBankStore();
  const { employees } = useWagesStore();
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for Wages tab
  const [dateFilter, setDateFilter] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // 'all', 'monthly', 'daily'

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchBankTransactions(bankId)
      .then((txs) => {
        if (mounted) {
          setTransactions(txs);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch bank transactions", err);
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [bankId, fetchBankTransactions]);

  const adjustments = transactions.filter(tx => !tx.relatedSalaryTxId);
  const wagePayments = transactions.filter(tx => !!tx.relatedSalaryTxId);

  // Map of employeeId -> contractType
  const employeeTypes = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach(e => {
      map[e.id] = e.contractType;
    });
    return map;
  }, [employees]);

  const filteredWages = useMemo(() => {
    return wagePayments.filter(tx => {
      // Date Filter
      if (dateFilter !== 'all' && tx.createdAt) {
        const date = tx.createdAt?.toMillis ? new Date(tx.createdAt.toMillis()) : new Date(tx.createdAt as unknown as string);
        const today = new Date();
        if (dateFilter === 'today') {
          if (date.getDate() !== today.getDate() || date.getMonth() !== today.getMonth() || date.getFullYear() !== today.getFullYear()) return false;
        } else if (dateFilter === 'thisMonth') {
          if (date.getMonth() !== today.getMonth() || date.getFullYear() !== today.getFullYear()) return false;
        } else if (dateFilter === 'custom' && customStart && customEnd) {
          const start = new Date(customStart);
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (date < start || date > end) return false;
        }
      }

      // Worker Filter
      if (workerFilter !== 'all') {
        if (tx.payeeEmployeeId !== workerFilter) return false;
      }

      // Type Filter
      if (typeFilter !== 'all' && tx.payeeEmployeeId) {
        const cType = employeeTypes[tx.payeeEmployeeId];
        if (cType !== typeFilter) return false;
      }

      return true;
    });
  }, [wagePayments, dateFilter, customStart, customEnd, workerFilter, typeFilter, employeeTypes]);

  if (loading) {
    return <div className="p-4 text-center text-sm text-slate-500">Loading transactions...</div>;
  }

  const renderTx = (tx: BankTransaction) => {
    const dateObj = tx.createdAt?.toMillis ? new Date(tx.createdAt.toMillis()) : new Date(tx.createdAt as unknown as string);
    return (
      <div key={tx.id} className="flex justify-between items-center text-sm p-3 bg-white/50 rounded-lg border border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${tx.type === 'credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {tx.type}
            </span>
            <span className="font-semibold text-slate-700">{format(dateObj, 'dd MMM yyyy, HH:mm')}</span>
            {tx.relatedLedgerEntryId && <Badge variant="outline" className="text-[10px] h-5 py-0 px-1">Ledger Entry</Badge>}
          </div>
          <div className="text-xs text-slate-500 mt-1">{tx.note}</div>
          {tx.payeeEmployeeName && (
            <div className="text-xs text-slate-600 font-medium">→ {tx.payeeEmployeeName}</div>
          )}
        </div>
        <div className="text-right">
          <div className={`font-bold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {tx.type === 'credit' ? '+' : '−'} {formatCurrency(tx.amount)}
          </div>
          <div className="text-xs text-slate-500">Bal: {formatCurrency(tx.balanceAfter)}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      <Tabs defaultValue="adjustments" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <TabsTrigger value="adjustments" className="text-xs">Adjustments</TabsTrigger>
          <TabsTrigger value="wages" className="text-xs">Wages</TabsTrigger>
        </TabsList>

        <TabsContent value="adjustments" className="space-y-2">
          {adjustments.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500 italic">No manual adjustments</div>
          ) : (
            adjustments.map(renderTx)
          )}
        </TabsContent>

        <TabsContent value="wages" className="space-y-4">
          <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <select 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="thisMonth">This Month</option>
                <option value="custom">Custom Range</option>
              </select>

              {dateFilter === 'custom' && (
                <div className="flex items-center gap-1 flex-1">
                  <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-7 text-xs px-1" />
                  <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-7 text-xs px-1" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select 
                value={workerFilter} 
                onChange={(e) => setWorkerFilter(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Workers</option>
                {employees.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>

              <select 
                value={typeFilter} 
                onChange={(e) => setTypeFilter(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="daily">Daily Workers</option>
                <option value="monthly">Monthly Staff</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {filteredWages.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500 italic">No wage payments found</div>
            ) : (
              filteredWages.map(renderTx)
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
