// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { dealService } from "@/services/dealService";
import { Deal } from "@/types";
import DealStagingGroup from "./staging/DealStagingGroup";

export default function TabStaging() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = async () => {
    try {
      const allDeals = await dealService.getAllDeals();
      setDeals(allDeals.filter(d => d.status === "delivered" || d.status === "staging"));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white/60 backdrop-blur-md p-5 rounded-2xl shadow-lg shadow-indigo-900/5 border border-slate-100">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Staging Area</h2>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : deals.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 backdrop-blur-sm text-slate-500 font-medium">
          No deals ready for staging. Deliver a deal first.
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(
            deals.reduce((acc, deal) => {
              const supplier = deal.supplierName || 'Unknown Supplier';
              if (!acc[supplier]) acc[supplier] = [];
              acc[supplier].push(deal);
              return acc;
            }, {} as Record<string, Deal[]>)
          ).map(([supplier, supplierDeals]) => (
            <div key={supplier} className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-1 bg-indigo-500 rounded-full"></div>
                <h3 className="text-2xl font-black text-slate-800">{supplier}</h3>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{supplierDeals.length} Deals</span>
              </div>
              <div className="space-y-6">
                {supplierDeals.map(deal => (
                  <DealStagingGroup key={deal.dealId} deal={deal} onUpdate={fetchDeals} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
