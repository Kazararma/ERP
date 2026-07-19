"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { supplierService } from "@/services/supplierService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import toast from "react-hot-toast";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  address: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function SupplierForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { name: "", description: "", contactPhone: "", contactEmail: "", address: "" }
  });

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      await supplierService.createSupplier({
        name: data.name,
        description: data.description || "",
        contactPhone: data.contactPhone || "",
        contactEmail: data.contactEmail || "",
        address: data.address || "",
        createdBy: (user?.uid as string) || "unknown"
      });
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create supplier");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Supplier Name *</Label>
        <Input {...register("name")} className={errors.name ? "border-red-500" : ""} />
        {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Description / Notes</Label>
        <Input {...register("description")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input {...register("contactPhone")} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input {...register("contactEmail")} className={errors.contactEmail ? "border-red-500" : ""} />
          {errors.contactEmail && <p className="text-red-500 text-xs">{errors.contactEmail.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Address</Label>
        <Input {...register("address")} />
      </div>

      <button type="submit" disabled={submitting} className="w-full mt-6 bg-blue-600 text-white py-2.5 rounded-md font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {submitting ? "Saving..." : "Save Supplier"}
      </button>
    </form>
  );
}
