"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { employeeService } from "@/services/employeeService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import { employeeSchema, EmployeeSchemaType } from "@/schemas/employeeSchema";
import toast from "react-hot-toast";

export default function EmployeeForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EmployeeSchemaType>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "",
      address: "",
      bankDetails: { accountHolder: "", bankName: "", accountNumber: "", ifscCode: "" },
      contractType: "monthly",
      fixedMonthlySalary: null,
    }
  });

  const contractType = watch("contractType");

  const onSubmit = async (data: EmployeeSchemaType) => {
    setSubmitting(true);
    try {
      await employeeService.createEmployee({
        ...data,
        createdAt: new Date() as any, 
        updatedAt: new Date() as any,
        createdBy: user?.uid || "unknown",
        payLog: []
      } as any);
      toast.success("Employee saved successfully");
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create employee");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2 overflow-y-auto max-h-[80vh] px-1">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Personal Information</h3>
        
        <div className="space-y-2">
          <Label>Employee Name</Label>
          <Input {...register("name")} className={errors.name ? "border-red-500" : ""} />
          {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Address</Label>
          <textarea 
            {...register("address")} 
            rows={3} 
            className={`flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${errors.address ? "border-red-500" : ""}`} 
          />
          {errors.address && <p className="text-red-500 text-xs">{errors.address.message}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Bank Details</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name on Bank Account</Label>
            <Input {...register("bankDetails.accountHolder")} className={errors.bankDetails?.accountHolder ? "border-red-500" : ""} />
            {errors.bankDetails?.accountHolder && <p className="text-red-500 text-xs">{errors.bankDetails.accountHolder.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Bank Name</Label>
            <Input {...register("bankDetails.bankName")} className={errors.bankDetails?.bankName ? "border-red-500" : ""} />
            {errors.bankDetails?.bankName && <p className="text-red-500 text-xs">{errors.bankDetails.bankName.message}</p>}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Account Number</Label>
            <Input {...register("bankDetails.accountNumber")} className={errors.bankDetails?.accountNumber ? "border-red-500" : ""} />
            {errors.bankDetails?.accountNumber && <p className="text-red-500 text-xs">{errors.bankDetails.accountNumber.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>IFSC Code</Label>
            <Input 
              {...register("bankDetails.ifscCode", {
                onChange: (e) => e.target.value = e.target.value.toUpperCase()
              })} 
              className={errors.bankDetails?.ifscCode ? "border-red-500" : ""} 
            />
            {errors.bankDetails?.ifscCode && <p className="text-red-500 text-xs">{errors.bankDetails.ifscCode.message}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Contract & Wages</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Contract Type</Label>
            <select 
              {...register("contractType")}
              className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <option value="monthly">Monthly</option>
              <option value="daily">Daily</option>
            </select>
          </div>
          
          {contractType === "monthly" && (
            <div className="space-y-2">
              <Label>Fixed Monthly Salary (₹)</Label>
              <Input type="number" step="any" {...register("fixedMonthlySalary", { valueAsNumber: true })} className={errors.fixedMonthlySalary ? "border-red-500" : ""} />
              {errors.fixedMonthlySalary && <p className="text-red-500 text-xs">{errors.fixedMonthlySalary.message}</p>}
            </div>
          )}
        </div>
      </div>

      <button type="submit" disabled={submitting} className="w-full mt-6 bg-blue-600 text-white py-2.5 rounded-md font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {submitting ? "Saving..." : "Save Employee"}
      </button>
    </form>
  );
}
