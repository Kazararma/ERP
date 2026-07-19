"use client";

import { SalaryLedgerFilters } from "@/types/salaryTransaction";
import { useWagesStore } from "@/stores/wagesStore";
import { useBankStore } from "@/stores/bankStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

interface Props {
  filters: SalaryLedgerFilters;
  onChange: (f: SalaryLedgerFilters) => void;
}

export function SalaryLedgerFiltersBar({ filters, onChange }: Props) {
  const { employees } = useWagesStore();
  const { banks } = useBankStore();

  const handleReset = () => {
    onChange({
      month: format(new Date(), 'yyyy-MM'),
      employeeId: null,
      bankId: null,
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 items-end bg-white/60 p-4 rounded-xl border border-slate-100 shadow-sm">
      <div className="space-y-1 w-full md:w-auto">
        <Label>Month</Label>
        <Input 
          type="month" 
          value={filters.month} 
          onChange={(e) => onChange({ ...filters, month: e.target.value })} 
          className="w-full md:w-[180px]"
        />
      </div>

      <div className="space-y-1 w-full md:w-auto flex-1 max-w-[300px]">
        <Label>Employee</Label>
        <select 
          value={filters.employeeId || "all"} 
          onChange={(e) => onChange({ ...filters, employeeId: e.target.value === "all" ? null : e.target.value })}
          className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <option value="all">All Employees</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1 w-full md:w-auto flex-1 max-w-[300px]">
        <Label>Bank</Label>
        <select 
          value={filters.bankId || "all"} 
          onChange={(e) => onChange({ ...filters, bankId: e.target.value === "all" ? null : e.target.value })}
          className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <option value="all">All Banks</option>
          {banks.map(bank => (
            <option key={bank.id} value={bank.id}>{bank.name}</option>
          ))}
        </select>
      </div>

      <button 
        onClick={handleReset}
        className="w-full md:w-auto bg-slate-100 text-slate-600 px-4 py-2 rounded-md font-semibold hover:bg-slate-200 transition-colors h-10"
      >
        Reset
      </button>
    </div>
  );
}
