import { useState, useEffect } from "react";
import { Customer } from "@/types";
import { customerService } from "@/services/customerService";
import { LedgerProfileDetail } from "../../shared/LedgerProfileDetail";
import { getLedgerProfilesByType } from "@/services/ledgerProfileService";
import { LedgerProfile } from "@/types/ledger-profile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useLedgerStore } from "@/stores/useLedgerStore";

export function CustomerProfilesTab() {
  const { customers, customerProfiles: profiles, isLoadingCustomers, fetchCustomersData } = useLedgerStore();
  const [selectedProfile, setSelectedProfile] = useState<LedgerProfile | null>(null);

  useEffect(() => {
    fetchCustomersData();
  }, [fetchCustomersData]);

  if (selectedProfile) {
    return (
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border mt-4">
        <button onClick={() => setSelectedProfile(null)} className="mb-4 text-blue-600 underline px-6 pt-4 text-left w-fit hover:text-blue-800">
          &larr; Back to Customers
        </button>
        <div className="flex-1 overflow-y-auto">
          <LedgerProfileDetail key={selectedProfile.id} profile={selectedProfile} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border mt-4">
      <h2 className="text-xl font-bold mb-6 text-slate-800">Customer Ledger Profiles</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4 w-1/2">Customer Name</th>
              <th className="py-2.5 px-4 text-right w-1/2">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map(c => {
              const profile = profiles[c.customerId];
              const closing = profile ? Math.abs(profile.closingBalance) : 0;
              const isCredit = profile ? profile.closingBalance < 0 : false;
              return (
                <tr 
                  key={c.customerId} 
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => profile && setSelectedProfile(profile)}
                >
                  <td className="py-2.5 px-4 font-medium text-slate-800">{c.name}</td>
                  <td className="py-2.5 px-4 text-right">
                    {profile ? (
                      <span className={`font-semibold ${isCredit ? "text-emerald-600" : "text-rose-600"}`}>
                        {isCredit ? "Cr " : "Dr "} {formatCurrency(closing)}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Loading...</span>
                    )}
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
