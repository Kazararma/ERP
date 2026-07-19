"use client";

import { useEffect, useState } from "react";
import { SalaryLedgerFilters } from "@/types/salaryTransaction";
import { useWagesStore } from "@/stores/wagesStore";
import { SalaryLedgerFiltersBar } from "./SalaryLedgerFilters";
import { SalaryLedgerTable } from "./SalaryLedgerTable";
import { SalaryLedgerDetailDrawer } from "./SalaryLedgerDetailDrawer";
import { format } from "date-fns";

export function SalaryLedgerTab() {
  const { fetchSalaryLedger, salaryLedger, ledgerLoading, fetchEmployees } = useWagesStore();
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  
  const [filters, setFilters] = useState<SalaryLedgerFilters>({
    month: format(new Date(), 'yyyy-MM'),
    employeeId: null,
    bankId: null,
  });

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchSalaryLedger(filters);
  }, [filters, fetchSalaryLedger]);

  return (
    <div className="space-y-6">
      <SalaryLedgerFiltersBar filters={filters} onChange={setFilters} />
      
      <SalaryLedgerTable 
        transactions={salaryLedger} 
        isLoading={ledgerLoading} 
        onRowClick={setSelectedTx} 
      />

      <SalaryLedgerDetailDrawer 
        transaction={selectedTx} 
        onClose={() => setSelectedTx(null)} 
      />
    </div>
  );
}
