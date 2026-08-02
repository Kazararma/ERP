// @ts-nocheck
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { customerService } from "@/services/customerService";
import { orderService } from "@/services/orderService";
import { Customer } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import CustomerForm from "@/components/deals/shared/CustomerForm";
import { useAuthStore } from "@/stores/authStore";
import BatchAllocator from "./BatchAllocator";
const schema = z.object({
  customerId: z.string().min(1, "Please select a customer"),
  totalQuantityQuintal: z.coerce.number().min(0.1, "Must be greater than 0"),
  sellingPricePerQuintal: z.coerce.number().min(0, "Cannot be negative"),
  orderDate: z.string().min(1, "Order date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function OrderForm({ onSuccess }: { onSuccess: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const { user } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [allocationsValid, setAllocationsValid] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { customerId: "", totalQuantityQuintal: undefined as any, sellingPricePerQuintal: undefined as any, orderDate: new Date().toISOString().split('T')[0] }
  });

  const selectedCustomerId = watch("customerId");
  const quantity = watch("totalQuantityQuintal") || 0;
  const price = watch("sellingPricePerQuintal") || 0;

  const totalWeightKg = quantity * 100;
  const totalRevenue = quantity * price;

  useEffect(() => {
    customerService.getAllCustomers().then(setCustomers);
  }, []);

  const onSubmit = async (data: FormValues) => {
    if (!allocationsValid) return;
    setSubmitting(true);
    try {
      const customer = customers.find(c => c.customerId === data.customerId);
      if (!customer) throw new Error("Customer not found");

      await orderService.createOrderWithAllocations({
        customerId: data.customerId,
        customerName: customer.name,
        totalQuantityQuintal: data.totalQuantityQuintal,
        totalWeightKg,
        sellingPricePerQuintal: data.sellingPricePerQuintal,
        totalRevenue,
        createdBy: (user?.uid as string) || "unknown",
        orderDate: Timestamp.fromDate(new Date(data.orderDate)) as any,
        notes: data.notes
      }, allocations);
      
      onSuccess();
    } catch (error) {
      toast.error("Failed to create order");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Customer</Label>
        <div className="flex space-x-2">
          <select 
            {...register("customerId")}
            className={`flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex-1 ${errors.customerId ? 'border-red-500' : 'border-slate-200'}`}
          >
            <option value="">Select a customer</option>
            {customers.map(c => (
              <option key={c.customerId} value={c.customerId}>{c.name}</option>
            ))}
          </select>
          <Dialog>
            <DialogTrigger type="button" className="bg-gray-100 border text-gray-700 px-3 rounded hover:bg-gray-200 text-sm font-medium">
              + New
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogTitle>Add New Customer</DialogTitle>
              <CustomerForm onSuccess={() => {
                customerService.getAllCustomers().then(setCustomers);
              }} />
            </DialogContent>
          </Dialog>
        </div>
        {errors.customerId && <p className="text-red-500 text-xs mt-1">{errors.customerId.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Order Date</Label>
        <Input type="date" {...register("orderDate")} className={errors.orderDate ? "border-red-500" : ""} />
        {errors.orderDate && <p className="text-red-500 text-xs mt-1">{errors.orderDate.message as string}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Quantity (Quintals)</Label>
          <Input type="number" step="any" {...register("totalQuantityQuintal")} className={errors.totalQuantityQuintal ? "border-red-500" : ""} />
          <p className="text-xs text-gray-500">= {totalWeightKg} kg</p>
          {errors.totalQuantityQuintal && <p className="text-red-500 text-xs mt-1">{errors.totalQuantityQuintal.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Price per Quintal (₹)</Label>
          <Input type="number" step="any" {...register("sellingPricePerQuintal")} className={errors.sellingPricePerQuintal ? "border-red-500" : ""} />
          <p className="text-xs text-gray-500">Revenue: ₹{totalRevenue.toLocaleString()}</p>
          {errors.sellingPricePerQuintal && <p className="text-red-500 text-xs mt-1">{errors.sellingPricePerQuintal.message}</p>}
        </div>
      </div>

      <BatchAllocator 
        requiredWeightKg={totalWeightKg} 
        onAllocationsChange={setAllocations}
        onValidChange={setAllocationsValid}
      />

      <div className="space-y-2 mt-4">
        <Label>Notes (Optional)</Label>
        <textarea
          {...register("notes")}
          className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Any special instructions or notes..."
        />
      </div>

      <button 
        type="submit" 
        disabled={submitting || !allocationsValid || totalWeightKg === 0} 
        className="w-full mt-6 bg-blue-600 text-white py-2.5 rounded-md font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Saving Draft..." : "Create Draft Order"}
      </button>
    </form>
  );
}
