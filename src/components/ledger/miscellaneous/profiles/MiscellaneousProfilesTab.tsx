import { useState, useMemo, useEffect } from "react";
import { LedgerProfileDetail } from "../../shared/LedgerProfileDetail";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

import { useLedgerProfileRows } from "@/hooks/useLedgerProfileRows";
import type { LedgerProfileRow } from "@/components/ledger/shared/ledgerProfileRows";
import { LedgerOverviewPdfButton } from "@/components/ledger/shared/LedgerOverviewPdfButton";
import { useLedgerStore } from "@/stores/useLedgerStore";

export function MiscellaneousProfilesTab() {
  const [selectedRow, setSelectedRow] = useState<LedgerProfileRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fetchMiscellaneousData = useLedgerStore((s) => s.fetchMiscellaneousData);

  useEffect(() => {
    fetchMiscellaneousData();
  }, [fetchMiscellaneousData]);

  const rows = useLedgerProfileRows("miscellaneous");

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => r.displayName.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  if (selectedRow) {
    return (
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border mt-4">
        <button
          onClick={() => setSelectedRow(null)}
          className="mb-4 text-blue-600 underline px-6 pt-4 text-left w-fit hover:text-blue-800"
        >
          &larr; Back to Miscellaneous Profiles
        </button>
        <div className="flex-1 overflow-y-auto">
          <LedgerProfileDetail key={selectedRow.profileId} profile={selectedRow.profile} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border mt-4">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold text-slate-800">Miscellaneous Ledger Profiles</h2>
        <LedgerOverviewPdfButton entityType="miscellaneous" rows={rows} />
      </div>
      
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search profiles by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4 w-1/2">Profile Name</th>
              <th className="py-2.5 px-4 text-right w-1/2">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((r) => {
              const isCredit = r.balance < 0;
              const absVal = Math.abs(r.balance);
              return (
                <tr
                  key={r.profileId}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedRow(r)}
                >
                  <td className="py-2.5 px-4 font-medium text-slate-800">{r.displayName}</td>
                  <td className="py-2.5 px-4 text-right">
                    <span className={`font-semibold ${isCredit ? "text-emerald-600" : "text-rose-600"}`}>
                      {isCredit ? "Cr " : "Dr "} {formatCurrency(absVal)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
