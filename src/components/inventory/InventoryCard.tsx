import { Inventory } from "@/types/inventory";
import { DEAL_TYPE_LABELS } from "@/constants/dealLabels";
import { BagSize, BAG_SIZE_LABEL } from "@/types/riceTypes";
import { AdjustInventoryModal } from "./AdjustInventoryModal";
import { Edit2 } from "lucide-react";
import { useState } from "react";

export function InventoryCard({ inv }: { inv: Inventory }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const totalBoughtKg = inv.totalBoughtKg || 0;
  const remainingRawKg = inv.remainingRawKg || 0;
  const remainingPackedKg = inv.remainingPackedKg ?? (inv as any).remainingStagedKg ?? 0;
  const totalSoldKg = inv.totalSoldKg || 0;

  const rawPct = totalBoughtKg ? (remainingRawKg / totalBoughtKg) * 100 : 0;
  const packedPct = totalBoughtKg ? (remainingPackedKg / totalBoughtKg) * 100 : 0;
  const soldPct = totalBoughtKg ? (totalSoldKg / totalBoughtKg) * 100 : 0;

  const packedBreakdownStr = (inv.divisionBreakdown || (inv as any).stagingBreakdown || [])
    .filter((d: any) => d.availableBags > 0)
    .map((d: any) => `${BAG_SIZE_LABEL[d.bagSize as BagSize] || 'Bag'}: ${d.availableBags}`)
    .join(" · ");

  return (
    <div className="bg-white border rounded-lg shadow-sm hover:shadow transition-shadow overflow-hidden flex flex-col h-full">
      <div className="p-2.5 border-b bg-slate-50 flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-base font-black text-slate-800 tracking-tight leading-tight truncate">
              {inv.product?.productCode || <span className="text-amber-500 text-xs">LEGACY</span>}
            </div>
            {inv.status !== 'exhausted' && (
              <button 
                onClick={() => setAdjustOpen(true)}
                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title="Adjust Stock Amount"
              >
                <Edit2 size={14} />
              </button>
            )}
          </div>
          <div className="text-[11px] font-bold text-slate-500 mt-0.5 truncate" title={inv.product?.productName || (inv as any).productName}>
            {inv.product?.productName || (inv as any).productName || "Unknown Product"}
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shadow-sm uppercase tracking-wider ${
            inv.status === 'in_stock' ? 'bg-emerald-100 text-emerald-700' 
            : inv.status === 'partial' ? 'bg-amber-100 text-amber-700' 
            : 'bg-slate-200 text-slate-600'
          }`}>
            {inv.status?.replace('_', ' ') || 'Unknown'}
          </span>
        </div>
      </div>
      
      <div className="p-2.5 flex-1 flex flex-col justify-between space-y-3">
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-blue-50/50 border border-blue-100 rounded p-1.5">
            <p className="text-blue-600/80 text-[8px] font-bold uppercase tracking-wider mb-0.5">Raw</p>
            <p className="font-black text-blue-700 text-xs">{remainingRawKg.toLocaleString()}</p>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 rounded p-1.5">
            <p className="text-emerald-600/80 text-[8px] font-bold uppercase tracking-wider mb-0.5">Packed</p>
            <p className="font-black text-emerald-700 text-xs">{remainingPackedKg.toLocaleString()}</p>
          </div>
          <div className="bg-orange-50/50 border border-orange-100 rounded p-1.5">
            <p className="text-orange-600/80 text-[8px] font-bold uppercase tracking-wider mb-0.5">{DEAL_TYPE_LABELS.sold}</p>
            <p className="font-black text-orange-700 text-xs">{totalSoldKg.toLocaleString()}</p>
          </div>
        </div>

        {packedBreakdownStr && (
          <div className="bg-slate-50 text-slate-600 text-[10px] py-1 px-2 rounded border font-medium truncate" title={packedBreakdownStr}>
            <span className="text-slate-400">Bags:</span> {packedBreakdownStr}
          </div>
        )}

        <div className="space-y-1 mt-auto">
          <div className="flex justify-between text-[9px] font-bold text-slate-400">
            <span>Total: {totalBoughtKg.toLocaleString()} kg</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full flex overflow-hidden shadow-inner border border-slate-200/50">
            <div className="bg-blue-400 h-full transition-all duration-500" style={{ width: `${rawPct}%` }} title="Raw" />
            <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${packedPct}%` }} title="Packed" />
            <div className="bg-orange-400 h-full transition-all duration-500" style={{ width: `${soldPct}%` }} title={DEAL_TYPE_LABELS.sold} />
          </div>
        </div>
      </div>

      {adjustOpen && (
        <AdjustInventoryModal 
          inv={inv} 
          open={adjustOpen} 
          onClose={() => setAdjustOpen(false)} 
        />
      )}
    </div>
  );
}
