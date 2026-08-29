import { useEffect, useState, useMemo } from "react";
import { dealService } from "@/services/dealService";
import { Deal } from "@/types/deal";
import { AddDealModal } from "./AddDealModal";
import { DealCard } from "./DealCard";
import SupplierManager from "./SupplierManager";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { DealsFilterValues } from "@/components/deals/DealsFilter";
import { useUiStore } from "@/stores/uiStore";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";

export function BoughtTab({ dateFilter }: { dateFilter?: DealsFilterValues }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const fetchDeals = async () => {
    setLoading(true);
    const data = await dealService.getAllDeals();
    setDeals(data);
    setLoading(false);
  };

  const handleConvertAll = async () => {
    const pendingCount = deals.filter(d => d.status === "pending_delivery").length;
    if (pendingCount === 0) return;

    const confirmed = await useUiStore.getState().requestConfirm(
      "Convert All Pending Deliveries",
      `Are you sure you want to confirm delivery for all ${pendingCount} pending purchase(s)? This will post the amounts to the respective supplier ledger accounts immediately.`
    );

    if (!confirmed) return;

    setConverting(true);
    try {
      const res = await dealService.convertAllPendingDeliveries();
      toast.success(`Successfully confirmed ${res.confirmedCount} deliveries`);
      fetchDeals();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to convert deliveries");
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const filteredDeals = useMemo(() => {
    let filtered = deals;
    if (dateFilter) {
      filtered = filtered.filter(deal => {
        if (dateFilter.type !== "all-time") {
          const date = (deal.purchaseDate as any)?.toMillis ? new Date((deal.purchaseDate as any).toMillis()) : new Date();
          if (dateFilter.startDate && date < dateFilter.startDate) return false;
          if (dateFilter.endDate && date > dateFilter.endDate) return false;
        }
        if (dateFilter.searchQuery && dateFilter.searchQuery !== "all-names" && deal.supplierId !== dateFilter.searchQuery) return false;
        return true;
      });
    }
    return filtered;
  }, [deals, dateFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold text-gray-800">Purchases</h2>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <Dialog>
            <DialogTrigger render={
              <button className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors shadow-sm">
                Manage Suppliers
              </button>
            } />
            <SupplierManager />
          </Dialog>
          
          <Button 
            variant="outline" 
            onClick={handleConvertAll} 
            disabled={converting || deals.filter(d => d.status === "pending_delivery").length === 0}
            className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
          >
            {converting ? "Converting..." : "Convert All Pending"}
          </Button>

          <AddDealModal onSuccess={fetchDeals} />
        </div>
      </div>
      
      {loading ? (
        <div className="p-12 flex justify-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredDeals.map(deal => (
            <DealCard key={deal.dealId} deal={deal} onUpdate={fetchDeals} />
          ))}
          {filteredDeals.length === 0 && (
            <div className="text-center p-12 text-gray-500 bg-white rounded-lg border">
              No purchases found for the selected filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
