import { useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { MiscellaneousProfilesTab } from "./profiles/MiscellaneousProfilesTab";
import { MiscellaneousManager } from "./MiscellaneousManager";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

export function MiscellaneousLedgerTab() {
  const fetchMiscellaneousData = useLedgerStore((s) => s.fetchMiscellaneousData);

  useEffect(() => {
    fetchMiscellaneousData();
  }, [fetchMiscellaneousData]);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold text-gray-800">Miscellaneous Ledger</h2>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <Dialog>
            <DialogTrigger render={
              <button className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors shadow-sm">
                Manage Profiles
              </button>
            } />
            <MiscellaneousManager />
          </Dialog>
        </div>
      </div>
      
      <Tabs defaultValue="profiles" className="flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="profiles">Ledger Profiles</TabsTrigger>
        </TabsList>
        <TabsContent value="profiles" className="flex-1 mt-4">
          <MiscellaneousProfilesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
