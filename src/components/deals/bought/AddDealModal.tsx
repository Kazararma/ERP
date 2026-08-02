import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import toast from "react-hot-toast";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRiceTypes } from "@/hooks/useRiceTypes";
import { supplierService } from "@/services/supplierService";
import { dealService } from "@/services/dealService";
import { useAuthStore } from "@/stores/authStore";
import SupplierManager from "./SupplierManager";

const schema = z.object({
  supplierId: z.string().min(1, "Please select a supplier"),
  productCode: z.string().min(1, "Product code is required"),
  productName: z.string().min(2, "Product name is required"),
  riceTypeId: z.string().min(1, "Please select a rice type"),
  totalAmountKg: z.coerce.number().min(0.01, "Amount must be > 0"),
  weightDeductionKg: z.coerce.number().min(0).optional(),
  pricePerKg: z.coerce.number().min(0.01, "Price must be > 0"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  notes: z.string().optional(),
  discountEnabled: z.boolean().default(false),
  discountKg: z.coerce.number().min(0).optional(),
  discountRatePerKg: z.coerce.number().min(0).optional()
}).superRefine((data, ctx) => {
  if (data.discountEnabled) {
    if (!data.discountKg || data.discountKg <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discount quantity must be > 0",
        path: ["discountKg"]
      });
    } else if (data.discountKg >= (data.totalAmountKg - (data.weightDeductionKg || 0))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discount kg must be less than net weight",
        path: ["discountKg"]
      });
    }
    if (!data.discountRatePerKg || data.discountRatePerKg <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discount rate must be > 0",
        path: ["discountRatePerKg"]
      });
    }
  }
});

export function AddDealModal({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customSupplierName, setCustomSupplierName] = useState("");
  const [localTotal, setLocalTotal] = useState("");
  const [totalFocused, setTotalFocused] = useState(false);
  const { riceTypes } = useRiceTypes();
  const { user } = useAuthStore();
  
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      supplierId: "",
      productCode: "",
      productName: "",
      riceTypeId: "",
      totalAmountKg: 0,
      weightDeductionKg: 0,
      pricePerKg: 0,
      purchaseDate: new Date().toISOString().split('T')[0],
      notes: "",
      discountEnabled: false,
      discountKg: 0,
      discountRatePerKg: 0
    }
  });

  const totalAmountKg = watch("totalAmountKg") || 0;
  const weightDeductionKg = watch("weightDeductionKg") || 0;
  const netAmountKg = totalAmountKg - weightDeductionKg;
  const pricePerKg = watch("pricePerKg") || 0;
  const discountEnabled = watch("discountEnabled");
  const discountKg = watch("discountKg") || 0;
  const discountRatePerKg = watch("discountRatePerKg") || 0;

  const grossCost = netAmountKg * pricePerKg;
  const discountValue = discountEnabled ? discountKg * discountRatePerKg : 0;
  const netTotalCost = grossCost - discountValue;
  const netStockKg = netAmountKg;

  const selectedSupplierId = watch("supplierId");
  const selectedRiceTypeId = watch("riceTypeId");

  useEffect(() => {
    supplierService.getAllSuppliers().then(setSuppliers);
  }, [open]);

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      let finalSupplierId = data.supplierId;
      let finalSupplierName = "Unknown";

      if (data.supplierId === "ONE_TIME") {
        finalSupplierId = "one-time";
        finalSupplierName = customSupplierName.trim();
        if (!finalSupplierName) throw new Error("Supplier Name is required for one-time suppliers.");
      } else {
        const supplier = suppliers.find(s => s.supplierId === data.supplierId);
        if (!supplier) throw new Error("Invalid selection");
        finalSupplierName = supplier.name;
      }

      const riceType = riceTypes.find(rt => rt.riceTypeId === data.riceTypeId);
      if (!riceType) throw new Error("Invalid selection");

      await dealService.createDeal({
        supplierId: finalSupplierId,
        supplierName: finalSupplierName,
        product: {
          productCode: data.productCode,
          productName: data.productName,
          riceTypeId: riceType.riceTypeId,
          riceTypeCode: riceType.code,
          riceTypeName: riceType.displayName
        },
        totalAmountKg: data.totalAmountKg,
        weightDeductionKg: data.weightDeductionKg || 0,
        pricePerKg: data.pricePerKg,
        purchaseDate: new Date(data.purchaseDate) as any,
        notes: data.notes,
        createdBy: user?.uid || "unknown",
        discountEnabled: data.discountEnabled,
        discountKg: data.discountKg,
        discountRatePerKg: data.discountRatePerKg
      } as any);
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to create deal");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
            + New Deal
          </button>
        }
      />
      <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-xl font-bold">Add New Purchase Deal</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 mt-4">
          <div className="space-y-2 flex flex-col">
            <Label>Supplier</Label>
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600",
                  errors.supplierId ? "border-red-500" : ""
                )}
              >
                <span className="truncate">
                  {selectedSupplierId
                    ? selectedSupplierId === "ONE_TIME"
                      ? "+ Create One-Time Supplier"
                      : suppliers.find((s) => s.supplierId === selectedSupplierId)?.name || "Select a supplier..."
                    : "Select a supplier..."}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search supplier..." />
                  <CommandList>
                    <CommandEmpty>No supplier found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="ONE_TIME"
                        onSelect={() => {
                          setValue("supplierId", "ONE_TIME", { shouldValidate: true });
                          setOpenCombobox(false);
                        }}
                        className="font-bold text-indigo-600 cursor-pointer"
                        data-checked={selectedSupplierId === "ONE_TIME"}
                      >
                        + Create One-Time Supplier
                      </CommandItem>
                    </CommandGroup>
                    <CommandGroup heading="Saved Suppliers">
                      {suppliers.map((s) => (
                        <CommandItem
                          key={s.supplierId}
                          value={s.name}
                          onSelect={() => {
                            setValue("supplierId", s.supplierId, { shouldValidate: true });
                            setOpenCombobox(false);
                          }}
                          className="cursor-pointer"
                          data-checked={selectedSupplierId === s.supplierId}
                        >
                          {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.supplierId && <p className="text-red-500 text-xs">{errors.supplierId.message}</p>}
          </div>

          {selectedSupplierId === "ONE_TIME" && (
            <div className="space-y-2">
              <Label>Supplier Name</Label>
              <Input 
                placeholder="Enter supplier name..." 
                value={customSupplierName}
                onChange={(e) => setCustomSupplierName(e.target.value)} 
              />
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Product Code</Label>
              <Input {...register("productCode")} className={errors.productCode ? "border-red-500" : ""} placeholder="e.g. LS-001" />
              {errors.productCode && <p className="text-red-500 text-xs">{errors.productCode.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input {...register("productName")} className={errors.productName ? "border-red-500" : ""} placeholder="e.g. Premium Lal Shonno" />
              {errors.productName && <p className="text-red-500 text-xs">{errors.productName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type of Rice</Label>
              <select 
                className={`flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 shadow-sm ${errors.riceTypeId ? "border-red-500" : ""}`}
                value={selectedRiceTypeId || ""}
                onChange={e => setValue("riceTypeId", e.target.value)}
              >
                <option value="">Select rice type...</option>
                {riceTypes.map(rt => <option key={rt.riceTypeId} value={rt.riceTypeId}>{rt.displayName}</option>)}
              </select>
              {errors.riceTypeId && <p className="text-red-500 text-xs">{errors.riceTypeId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input type="date" {...register("purchaseDate")} className={errors.purchaseDate ? "border-red-500" : ""} />
              {errors.purchaseDate && <p className="text-red-500 text-xs">{errors.purchaseDate.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Total Amount (kg)</Label>
              <Input type="number" step="any" {...register("totalAmountKg")} className={errors.totalAmountKg ? "border-red-500" : ""} />
              {errors.totalAmountKg && <p className="text-red-500 text-xs">{errors.totalAmountKg.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Deduction (kg)</Label>
              <Input type="number" step="any" {...register("weightDeductionKg")} className={errors.weightDeductionKg ? "border-red-500" : ""} />
              {errors.weightDeductionKg && <p className="text-red-500 text-xs">{errors.weightDeductionKg.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Price per kg (₹)</Label>
              <Input type="number" step="any" {...register("pricePerKg")} className={errors.pricePerKg ? "border-red-500" : ""} />
              {errors.pricePerKg && <p className="text-red-500 text-xs">{errors.pricePerKg.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Total Price (₹)</Label>
              <Input 
                type="number" 
                step="any"
                placeholder="0"
                value={totalFocused ? localTotal : ((watch("totalAmountKg") || 0) - (watch("weightDeductionKg") || 0)) * (watch("pricePerKg") || 0) || ""}
                onFocus={() => {
                  const currentTotal = ((watch("totalAmountKg") || 0) - (watch("weightDeductionKg") || 0)) * (watch("pricePerKg") || 0);
                  setLocalTotal(currentTotal ? currentTotal.toString() : "");
                  setTotalFocused(true);
                }}
                onBlur={() => setTotalFocused(false)}
                onChange={(e) => {
                  setLocalTotal(e.target.value);
                  const total = parseFloat(e.target.value) || 0;
                  const kg = (watch("totalAmountKg") || 0) - (watch("weightDeductionKg") || 0);
                  if (kg > 0) {
                    setValue("pricePerKg", Number(total / kg));
                  }
                }}
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-md p-4 space-y-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="discountEnabled" {...register("discountEnabled")} className="w-4 h-4" />
              <Label htmlFor="discountEnabled" className="font-bold">Apply Discount</Label>
            </div>
            
            {discountEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Quantity (kg)</Label>
                  <Input type="number" step="any" {...register("discountKg")} className={errors.discountKg ? "border-red-500" : ""} />
                  {errors.discountKg && <p className="text-red-500 text-xs">{errors.discountKg.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Discount Rate (₹/kg)</Label>
                  <Input type="number" step="any" {...register("discountRatePerKg")} className={errors.discountRatePerKg ? "border-red-500" : ""} />
                  {errors.discountRatePerKg && <p className="text-red-500 text-xs">{errors.discountRatePerKg.message}</p>}
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-lg mt-4 text-sm border border-slate-100">
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Gross Cost:</span>
                <span className="font-medium text-slate-800">₹{grossCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {discountEnabled && (
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Discount:</span>
                  <span className="font-medium text-rose-600">− ₹{discountValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between mb-1 border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-800 font-bold">Net Total Cost:</span>
                <span className="font-black text-indigo-600 text-lg">₹{netTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-800 font-bold">Stock Received:</span>
                <span className="font-black text-emerald-600 text-lg">{netStockKg.toLocaleString()} kg</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <textarea 
              {...register("notes")} 
              className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 shadow-sm">
              {isSubmitting ? "Creating..." : "Create Deal"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
