import { Deal } from "@/types/deal";
import { dealService } from "@/services/dealService";
import { BagDivisionModal } from "./BagDivisionModal";
import { EditDivisionsModal } from "./EditDivisionsModal";
import { useBagDivisions } from "@/hooks/useBagDivisions";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DealCard({ deal, onUpdate }: { deal: Deal, onUpdate: () => void }) {
  const { divisions } = useBagDivisions(deal.dealId);
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirmDelivery = async () => {
    setConfirming(true);
    try {
      await dealService.confirmDelivery(deal.dealId);
      onUpdate();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Error confirming delivery");
    }
    setConfirming(false);
  };

  const handleDeleteDeal = async () => {
    setDeleting(true);
    try {
      await dealService.deleteDeal(deal.dealId);
      onUpdate();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Error deleting deal. Please try again.");
    }
    setDeleting(false);
    setConfirmingDelete(false);
  };

  const totalDivided = deal.totalAmountKg - deal.remainingAmountKg;
  const isLegacy = !deal.product;

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4 hover:border-indigo-300 transition-colors flex flex-col md:flex-row justify-between md:items-center gap-4">
      {/* Left side: Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
            ${deal.remainingAmountKg === 0 ? 'bg-emerald-100 text-emerald-800' : 
              deal.status === 'pending_delivery' ? 'bg-amber-100 text-amber-800' : 
              deal.status === 'delivered' ? 'bg-blue-100 text-blue-800' : 
              deal.status === 'dividing' ? 'bg-indigo-100 text-indigo-800' : 
              deal.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : ''}
          `}>
            {deal.remainingAmountKg === 0 ? 'DIVIDED' : deal.status.replace('_', ' ')}
          </span>
          {deal.product ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-white uppercase">
              {deal.product.riceTypeName}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white uppercase">
              LEGACY
            </span>
          )}
          <span className="font-bold text-slate-800 truncate">
            {deal.product?.productName ?? <span className="text-amber-600 italic">{(deal as any).productName ?? "Unknown Product"}</span>}
          </span>
          {isLegacy && (
            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">⚠️ Needs Migration</span>
          )}
        </div>
        
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-slate-700">{deal.supplierName}</span>
          <span className="text-slate-300">•</span>
          <span>{new Date((deal.purchaseDate as any)?.toMillis?.() || Date.now()).toLocaleDateString()}</span>
          <span className="text-slate-300">•</span>
          <span className="text-indigo-600 font-medium">{deal.totalAmountKg.toLocaleString()} kg</span>
          <span className="text-slate-300">•</span>
          <span className="font-semibold text-slate-700">₹{deal.totalCost.toLocaleString()}</span>
        </div>
      </div>

      {/* Right side: Status / Actions */}
      <div className="flex flex-wrap items-center justify-between md:justify-end gap-4 shrink-0 w-full md:w-auto border-t border-slate-100 md:border-t-0 pt-3 md:pt-0">
        {deal.deliveryConfirmed && (
          <div className="text-right mr-2">
            <div className="flex items-center justify-end gap-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                {deal.remainingAmountKg === 0 ? "Fully Packed" : "Packed"}
              </div>
              {divisions.length > 0 && (
                <EditDivisionsModal dealId={deal.dealId} divisions={divisions} onUpdate={onUpdate} />
              )}
            </div>
            <div className="text-sm font-black text-slate-800">{totalDivided.toLocaleString()} / {deal.totalAmountKg.toLocaleString()} kg</div>
            {divisions.length > 0 && (
              <div className="text-[10px] text-slate-500 font-medium mt-1 space-x-1 border-t border-slate-100 pt-1">
                {Object.entries(
                  divisions.reduce((acc, d) => {
                    acc[d.bagSize] = (acc[d.bagSize] || 0) + d.numberOfBags;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([size, count]) => (
                  <span key={size} className="bg-slate-100 px-1 py-0.5 rounded inline-block mb-1">{count}x{size}</span>
                ))}
              </div>
            )}
          </div>
        )}
        
        {!deal.deliveryConfirmed ? (
          <button 
            onClick={handleConfirmDelivery} 
            disabled={confirming}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100 border border-emerald-200 hover:bg-emerald-200 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
          >
            {confirming ? "Confirming..." : "Confirm Delivery"}
          </button>
        ) : (
          deal.remainingAmountKg > 0 && !isLegacy && (
            <BagDivisionModal dealId={deal.dealId} remainingAmountKg={deal.remainingAmountKg} onUpdate={onUpdate} />
          )
        )}

        {/* Delete button — two-step inline confirmation */}
        {!confirmingDelete ? (
          <button
            onClick={() => setConfirmingDelete(true)}
            disabled={deleting}
            title="Delete this deal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all disabled:opacity-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
            <span className="text-[10px] font-bold text-red-700 whitespace-nowrap">Delete deal?</span>
            <button
              onClick={handleDeleteDeal}
              disabled={deleting}
              className="text-[10px] font-black text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {deleting ? "Deleting…" : "Yes, Delete"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <Dialog open={!!errorMsg} onOpenChange={(open) => { if (!open) setErrorMsg(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Action Failed</DialogTitle>
            <DialogDescription className="text-slate-700 font-medium pt-2">
              {errorMsg}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button onClick={() => setErrorMsg(null)} className="bg-slate-900 text-white hover:bg-slate-800">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
