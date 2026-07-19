import { useState, useEffect } from "react";
import { subscribeToAllSupplierLedgerSummaries } from "@/services/supplierLedgerService";
import { SupplierLedgerDetail } from "./SupplierLedgerDetail";
import { DealsFilter, DealsFilterValues } from "@/components/deals/DealsFilter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SupplierProfilesTab } from "./profiles/SupplierProfilesTab";

export function SupplierLedgerTab() {
  const [suppliers, setSuppliers] = useState<{ supplierId: string; supplierName: string }[]>([]);
  const [dateFilter, setDateFilter] = useState<DealsFilterValues>({ type: "all-time", startDate: null, endDate: null, searchQuery: "" });

  useEffect(() => {
    return subscribeToAllSupplierLedgerSummaries(data => setSuppliers(data));
  }, []);

  const selectedSupplierId = dateFilter.searchQuery || null;
  const selectedSupplierName = suppliers.find(s => s.supplierId === selectedSupplierId)?.supplierName || "";

  return (
    <div className="flex flex-col gap-6 h-full">
      <DealsFilter activeTab="bought" onChange={setDateFilter} />
      
      <Tabs defaultValue="events" className="flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="events">Transaction Events</TabsTrigger>
          <TabsTrigger value="profiles">Ledger Profiles</TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="flex-1 bg-white rounded-xl shadow-sm border overflow-hidden mt-4">
          <SupplierLedgerDetail 
            supplierId={selectedSupplierId} 
            supplierName={selectedSupplierName} 
            dateFilter={dateFilter} 
          />
        </TabsContent>
        <TabsContent value="profiles" className="flex-1 mt-4">
          <SupplierProfilesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
