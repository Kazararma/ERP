// @ts-nocheck
"use client";

import { Order, OrderAllocation } from "@/types";
import { orderService } from "@/services/orderService";
import { useState } from "react";
import { dealLogService } from "@/services/dealLogService";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { DEAL_TYPE_LABELS } from "@/constants/dealLabels";
import { ledgerService } from "@/services/ledgerService";
import { ChevronDown, ChevronUp, Trash2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function OrderCard({ order, onUpdate }: { order: Order, onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const [expanded, setExpanded] = useState(false);
  const [detailsData, setDetailsData] = useState<{ order: Order, allocations: (OrderAllocation & { supplierName: string; productName: string })[] } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{title: string, msg: string, action: () => Promise<void>} | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleExpand = async () => {
    if (order.status !== 'confirmed') return; // Only expand confirmed orders
    
    if (!expanded) {
      setExpanded(true);
      if (!detailsData) {
        setLoadingDetails(true);
        try {
          const res = await ledgerService.getLedgerForOrder(order.orderId);
          setDetailsData(res);
        } catch(e) {
          console.error(e);
        } finally {
          setLoadingDetails(false);
        }
      }
    } else {
      setExpanded(false);
    }
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      title: "Confirm Order",
      msg: "Confirming this order will permanently deduct from Bag Divisions and mark the sale complete. Proceed?",
      action: async () => {
        setLoading(true);
        try {
          await orderService.confirmOrder(order.orderId);
          await dealLogService.addLog(
            "sold",
            "Order Confirmed",
            `Order confirmed for ${order.customerName} — ${order.totalWeightKg} kg. Revenue: ₹${order.totalRevenue.toLocaleString()}`,
            user?.uid || "unknown",
            user?.displayName || user?.email || "Unknown",
            order.orderId
          );
          onUpdate();
        } catch(e: any) {
          console.error(e);
          setErrorMsg(e?.message ?? "Failed to confirm order");
        } finally {
          setLoading(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      title: "Delete Order",
      msg: "Are you sure you want to permanently delete this order? All allocated bags will be returned to inventory and ledgers will be wiped. This action cannot be undone.",
      action: async () => {
        setLoading(true);
        try {
          await orderService.deleteOrder(order.orderId);
          await dealLogService.addLog(
            "sold",
            "Order Deleted",
            `Order for ${order.customerName} (${order.totalWeightKg} kg) was deleted. Inventory restored.`,
            user?.uid || "unknown",
            user?.displayName || user?.email || "Unknown",
            order.orderId
          );
          onUpdate();
        } catch(e: any) {
          console.error(e);
          setErrorMsg(e?.message ?? "Failed to delete order");
        } finally {
          setLoading(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  return (
    <div 
      className={`bg-white border rounded-xl shadow-sm transition-all overflow-hidden ${order.status === 'confirmed' ? 'cursor-pointer hover:border-indigo-300' : ''}`}
      onClick={handleExpand}
    >
      {/* Main Card Header */}
      <div className="p-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
        {/* Left side: Info */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {order.status === 'confirmed' && (
            <div className="text-slate-400">
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          )}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                ${order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}
              `}>
                {order.status}
              </span>
              <span className="font-bold text-slate-800 truncate">
                {order.customerName}
              </span>
            </div>
            
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{new Date((order.orderDate as any)?.toMillis?.() || Date.now()).toLocaleDateString()}</span>
              <span className="text-slate-300">•</span>
              <span className="text-indigo-600 font-medium">{order.totalWeightKg?.toLocaleString()} kg</span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-700">₹{order.totalRevenue?.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Right side: Status / Actions */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-4 shrink-0 w-full md:w-auto border-t border-slate-100 md:border-t-0 pt-3 md:pt-0">
             <div className="text-right mr-2 hidden md:block">
               <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Profit</div>
               <div className="text-sm font-black text-emerald-600">₹{order.profit?.toLocaleString()}</div>
             </div>
          
          {order.status === "draft" && (
            <button 
              onClick={handleConfirm}
              disabled={loading}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-100 border border-indigo-200 hover:bg-indigo-200 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
            >
              {loading ? "Confirming..." : "Confirm Order"}
            </button>
          )}

          <button
            onClick={handleDelete}
            disabled={loading}
            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Order"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Expanded Details Section */}
      {expanded && order.status === 'confirmed' && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 md:p-6 cursor-default" onClick={e => e.stopPropagation()}>
          {loadingDetails ? (
            <div className="flex justify-center p-8"><div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
          ) : detailsData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
              
              {/* Allocation Breakdown */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Allocation Breakdown (COGS)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white text-slate-500 border-b border-slate-100 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-right">Bags</th>
                        <th className="px-4 py-3 text-right">Weight</th>
                        <th className="px-4 py-3 text-right">Buy/kg</th>
                        <th className="px-4 py-3 text-right">Sell/kg</th>
                        <th className="px-4 py-3 text-right">COGS</th>
                        <th className="px-4 py-3 text-right">Revenue</th>
                        <th className="px-4 py-3 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailsData.allocations.map(alloc => {
                        const rev = (alloc as any).revenue !== undefined ? (alloc as any).revenue : (alloc.weightKg * ((order as any).sellingPricePerKg || 0));
                        const prof = (alloc as any).profit !== undefined ? (alloc as any).profit : rev - alloc.totalCost;
                        return (
                          <tr key={alloc.allocationId} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800">{alloc.supplierName}</td>
                            <td className="px-4 py-3 text-slate-600">
                              <span className="font-bold text-slate-700">{(alloc as any).product?.productCode || "-"}</span>
                              <span className="text-[10px] block text-slate-400">{(alloc as any).product?.riceTypeName || "-"}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{alloc.numberOfBags}</td>
                            <td className="px-4 py-3 text-right">{alloc.weightKg} kg</td>
                            <td className="px-4 py-3 text-right text-slate-500">₹{(alloc as any).purchasePricePerKg?.toLocaleString() || (alloc.totalCost / alloc.weightKg).toLocaleString(undefined, {maximumFractionDigits:2})}</td>
                            <td className="px-4 py-3 text-right text-slate-500">₹{(rev / alloc.weightKg).toLocaleString(undefined, {maximumFractionDigits:2})}</td>
                            <td className="px-4 py-3 text-right text-red-600">₹{alloc.totalCost.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-medium text-emerald-600">₹{rev.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-black text-indigo-600">₹{prof.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50/50 font-bold border-t border-slate-200">
                        <td colSpan={2} className="px-4 py-3 text-right text-slate-600">Totals:</td>
                        <td className="px-4 py-3 text-right">{detailsData.allocations.reduce((sum, a) => sum + a.numberOfBags, 0)}</td>
                        <td className="px-4 py-3 text-right">{order.totalWeightKg} kg</td>
                        <td className="px-4 py-3 text-right"></td>
                        <td className="px-4 py-3 text-right"></td>
                        <td className="px-4 py-3 text-right text-red-600">₹{((order as any).totalCostOfGoods || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-emerald-600">₹{(order.totalRevenue || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-indigo-600">₹{(order.profit || 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden h-fit">
                <div className="bg-blue-50/50 px-4 py-3 border-b border-blue-100">
                  <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Financial Summary</h4>
                </div>
                <div className="p-5 space-y-4 text-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Volume {DEAL_TYPE_LABELS.sold}</span>
                    <span className="font-bold text-slate-800">
                      {(order as any).totalQuantityQuintal !== undefined 
                        ? `${(order as any).totalQuantityQuintal} Quintal` 
                        : `${(order.totalWeightKg / 100).toFixed(2)} Quintal`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Avg. Selling Price</span>
                    <span className="font-bold text-slate-800">
                      ₹{((order as any).sellingPricePerQuintal || (order.totalRevenue / (order.totalWeightKg / 100))).toLocaleString(undefined, { maximumFractionDigits: 2 })} / Quintal
                    </span>
                  </div>
                  
                  <div className="pt-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Gross Revenue</span>
                      <span className="font-bold text-slate-900">₹{(order.totalRevenue || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Cost of Goods</span>
                      <span className="font-bold text-red-600">- ₹{((order as any).totalCostOfGoods || 0).toLocaleString()}</span>
                    </div>
                    <div className="pt-3 border-t-2 border-dashed border-slate-200 flex justify-between items-center mt-2">
                      <span className="text-slate-900 font-black text-base">Net Profit</span>
                      <span className="font-black text-xl text-emerald-600">₹{(order.profit || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center text-slate-500 p-4">Failed to load details.</div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              {confirmDialog?.title === "Delete Order" && <AlertTriangle className="text-red-500 w-5 h-5" />}
              {confirmDialog?.title}
            </DialogTitle>
            <DialogDescription className="text-slate-600 font-medium pt-2">
              {confirmDialog?.msg}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={() => confirmDialog?.action()} 
              disabled={loading}
              className={`text-white ${confirmDialog?.title === "Delete Order" ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
            >
              {loading ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={!!errorMsg} onOpenChange={(open) => { if (!open) setErrorMsg(null); }}>
        <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Action Failed
            </DialogTitle>
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
