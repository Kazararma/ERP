import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupplierBagSelector, PendingAllocation } from "./SupplierBagSelector";
import { customerService } from "@/services/customerService";
import { orderService } from "@/services/orderService";
import { useAuthStore } from "@/stores/authStore";
import { useRiceTypes } from "@/hooks/useRiceTypes";
import CustomerForm from "../shared/CustomerForm";
import toast from "react-hot-toast";

export function OrderFormModal({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const { user } = useAuthStore();
  const { riceTypes } = useRiceTypes();

  const [customerId, setCustomerId] = useState("");
  const [customCustomerName, setCustomCustomerName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRiceType, setSelectedRiceType] = useState<string>("");
  const [targetOrderAmountKg, setTargetOrderAmountKg] = useState<number>(0);
  const [allocations, setAllocations] = useState<PendingAllocation[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    customerService.getAllCustomers().then(setCustomers);
    if (open) setStep(1);
  }, [open]);

  const isValidHeader = customerId && (customerId !== "ONE_TIME" || customCustomerName.trim().length > 0) && orderDate && targetOrderAmountKg > 0;
  const isReadyToConfirm = isValidHeader && allocations.length > 0;

  const totalWeight = allocations.reduce((s, a) => s + a.weightKg, 0);
  const totalRevenue = allocations.reduce((s, a) => s + ((a as any).revenue || 0), 0);

  const handleSave = async (confirm: boolean) => {
    setIsSubmitting(true);
    try {
      let finalCustomerId = customerId;
      let finalCustomerName = "Unknown";

      if (customerId === "ONE_TIME") {
        finalCustomerId = "one-time";
        finalCustomerName = customCustomerName.trim();
      } else {
        const customer = customers.find(c => c.customerId === customerId);
        finalCustomerName = customer?.name || "Unknown";
      }

      const orderId = await orderService.createOrderWithAllocations(
        {
          customerId: finalCustomerId,
          customerName: finalCustomerName,
          orderDate: new Date(orderDate) as any,
          notes: "",
          totalRevenue,
          totalWeightKg: totalWeight,
          createdBy: user?.uid || "system"
        },
        allocations.map(a => ({
           dealId: a.dealId,
           supplierId: a.supplierId,
           supplierName: a.supplierName,
           divisionId: a.divisionId,
           product: a.product,
           bagSize: a.bagSize,
           bagWeightKg: a.bagWeightKg,
           numberOfBags: a.numberOfBags,
           weightKg: a.weightKg,
           purchasePricePerKg: a.purchasePricePerKg,
           totalCost: a.totalCost,
           sellingPricePerKg: (a as any).sellingPricePerKg,
           revenue: (a as any).revenue
        }))
      );

      if (confirm) {
        await orderService.confirmOrder(orderId);
      }

      setOpen(false);
      onSuccess();
    } catch (e: any) {
      toast.error("Error saving order: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors">
            + New Order
          </button>
        }
      />
      <DialogContent className="sm:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto bg-slate-50 p-6">
        <DialogTitle className="text-2xl font-black text-slate-800 pb-2 border-b">Create Sales Order</DialogTitle>
        
        <div className="flex flex-col gap-6 mt-4">
          {step === 1 && (
            <div className="space-y-4 bg-white p-4 rounded-xl border shadow-sm">
              <h3 className="font-bold text-slate-800 border-b pb-2">Step 1: Order Details</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Customer</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 shadow-sm"
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                  >
                    <option value="">Select a customer...</option>
                    <option value="ONE_TIME" className="font-bold text-indigo-600">+ Create One-Time Customer</option>
                    <optgroup label="Saved Customers">
                      {customers.map(c => <option key={c.customerId} value={c.customerId}>{c.name}</option>)}
                    </optgroup>
                  </select>
                </div>
                
                {customerId === "ONE_TIME" && (
                  <div className="space-y-1.5">
                    <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Customer Name</Label>
                    <Input 
                      placeholder="Enter customer name..." 
                      value={customCustomerName}
                      onChange={(e) => setCustomCustomerName(e.target.value)}
                      className="shadow-sm border-indigo-200 focus-visible:ring-indigo-600 h-10"
                    />
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Order Date</Label>
                  <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="shadow-sm h-10" />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Type of Rice Filter</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 shadow-sm"
                    value={selectedRiceType}
                    onChange={e => setSelectedRiceType(e.target.value)}
                  >
                    <option value="">All Types</option>
                    {riceTypes.map(rt => <option key={rt.riceTypeId} value={rt.riceTypeId}>{rt.displayName}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5 col-span-1 sm:col-span-2 md:col-span-4 pt-2 border-t border-slate-100">
                  <Label className="font-black text-indigo-700 text-xs uppercase tracking-wider">Target Order Amount (kg)</Label>
                  <Input 
                    type="number"
                    step="any"
                    className="shadow-sm border-indigo-300 focus-visible:ring-indigo-600 font-bold text-lg h-12 max-w-[250px]"
                    value={targetOrderAmountKg || ""} 
                    onChange={e => setTargetOrderAmountKg(parseInt(e.target.value) || 0)} 
                    placeholder="e.g. 1500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <h3 className="font-bold text-slate-800 border-b pb-2 mb-4">Step 2: Fulfill Order</h3>
              <SupplierBagSelector filterRiceTypeId={selectedRiceType} targetOrderAmountKg={targetOrderAmountKg} onAllocationsChange={setAllocations} />
            </div>
          )}
        </div>

        <div className="pt-4 mt-6 border-t border-slate-200 flex justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border">
          {step === 1 ? (
            <>
              <button onClick={() => setOpen(false)} className="px-6 py-2 border rounded-lg text-sm font-bold hover:bg-slate-50 text-slate-600">
                Cancel
              </button>
              <button 
                onClick={() => setStep(2)}
                disabled={!isValidHeader}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-md transition-colors"
              >
                Next &rarr;
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="px-6 py-2 border rounded-lg text-sm font-bold hover:bg-slate-50 text-slate-600">
                &larr; Back
              </button>
              <div className="flex gap-3">
                <button 
                  disabled={!isReadyToConfirm || isSubmitting} 
                  onClick={() => handleSave(true)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-md transition-colors"
                >
                  {isSubmitting ? "Processing..." : "Confirm Order"}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
