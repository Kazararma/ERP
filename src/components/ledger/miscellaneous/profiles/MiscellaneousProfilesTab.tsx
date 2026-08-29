import { useState, useEffect, useMemo } from "react";
import { MiscellaneousProfile } from "@/types/miscellaneous";
import { LedgerProfileDetail } from "../../shared/LedgerProfileDetail";
import { LedgerProfile } from "@/types/ledger-profile";
import { formatCurrency } from "@/lib/utils";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function MiscellaneousProfilesTab() {
  const { miscellaneous, miscellaneousProfiles: profiles, fetchMiscellaneousData } = useLedgerStore();
  const [selectedProfile, setSelectedProfile] = useState<LedgerProfile | null>(null);

  useEffect(() => {
    fetchMiscellaneousData();
  }, [fetchMiscellaneousData]);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredMiscellaneous = useMemo(() => {
    if (!searchQuery.trim()) return miscellaneous;
    const q = searchQuery.trim().toLowerCase();
    return miscellaneous.filter((m) => m.name.toLowerCase().includes(q));
  }, [miscellaneous, searchQuery]);

  if (selectedProfile) {
    return (
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border mt-4">
        <button onClick={() => setSelectedProfile(null)} className="mb-4 text-blue-600 underline px-6 pt-4 text-left w-fit hover:text-blue-800">
          &larr; Back to Miscellaneous Profiles
        </button>
        <div className="flex-1 overflow-y-auto">
          <LedgerProfileDetail key={selectedProfile.id} profile={selectedProfile} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border mt-4">
      <h2 className="text-xl font-bold mb-6 text-slate-800">Miscellaneous Ledger Profiles</h2>
      
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
            {filteredMiscellaneous.map(m => {
              const profile = profiles[m.miscId];
              const closing = profile ? Math.abs(profile.closingBalance) : 0;
              const isCredit = profile ? profile.closingBalance < 0 : false;
              return (
                <tr 
                  key={m.miscId} 
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => profile && setSelectedProfile(profile)}
                >
                  <td className="py-2.5 px-4 font-medium text-slate-800">{m.name}</td>
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
