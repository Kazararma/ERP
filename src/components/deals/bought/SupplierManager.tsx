"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Supplier } from "@/types";
import { supplierService } from "@/services/supplierService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";
import { useUiStore } from "@/stores/uiStore";

export default function SupplierManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Supplier>();

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await supplierService.getAllSuppliers();
      setSuppliers(data);
    } catch (e) {
      console.error("Failed to fetch suppliers", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openAddForm = () => {
    setEditingSupplier(null);
    reset({ name: "", description: "", contactPhone: "", contactEmail: "", address: "" });
    setIsFormOpen(true);
  };

  const openEditForm = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    reset({ ...supplier });
    setIsFormOpen(true);
  };

  const onSubmit = async (data: any) => {
    try {
      if (editingSupplier) {
        await supplierService.updateSupplier(editingSupplier.supplierId, data);
      } else {
        await supplierService.createSupplier({
          ...data,
          createdBy: auth.currentUser?.uid || "unknown",
        });
      }
      setIsFormOpen(false);
      fetchSuppliers();
    } catch (e) {
      console.error("Failed to save supplier", e);
      toast.error("Failed to save supplier.");
    }
  };

  const handleDelete = async (supplierId: string) => {
    const confirm = await useUiStore.getState().requestConfirm("Delete Supplier", "Are you sure you want to delete this supplier? This action cannot be undone.");
    if (confirm) {
      try {
        await supplierService.deleteSupplier(supplierId);
        toast.success("Supplier deleted successfully");
        fetchSuppliers();
      } catch (e) {
        console.error("Failed to delete supplier", e);
        toast.error("Failed to delete supplier.");
      }
    }
  };

  return (
    <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">{isFormOpen ? (editingSupplier ? "Edit Supplier" : "Add Supplier") : "Manage Suppliers"}</DialogTitle>
      </DialogHeader>

      {isFormOpen ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto pr-2 pb-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Supplier Name <span className="text-red-500">*</span></label>
            <input 
              {...register("name", { required: "Name is required" })} 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              placeholder="e.g. Ali Farms"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message as string}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Description / Company Info</label>
            <textarea 
              {...register("description")} 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              placeholder="e.g. Premium rice supplier from North region"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Contact Phone</label>
              <input 
                {...register("contactPhone")} 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                placeholder="+91 9876543210"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Email Address</label>
              <input 
                type="text"
                {...register("contactEmail")} 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                placeholder="contact@alifarms.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Physical Address</label>
            <textarea 
              {...register("address")} 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              placeholder="123 Farm Road, District"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-500/25 transition-all">
              {editingSupplier ? "Save Changes" : "Add Supplier"}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="mb-4">
            <button onClick={openAddForm} className="w-full py-2.5 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add New Supplier
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {loading ? (
              <div className="flex justify-center p-8"><div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
            ) : suppliers.length === 0 ? (
              <p className="text-center text-slate-500 py-8 font-medium">No suppliers found.</p>
            ) : (
              suppliers.map(supplier => (
                <div key={supplier.supplierId} className="flex items-center justify-between p-3 bg-white border border-slate-100 shadow-sm rounded-xl hover:border-indigo-100 hover:shadow-md transition-all">
                  <div>
                    <h4 className="font-bold text-slate-800">{supplier.name}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{supplier.description || supplier.contactPhone || "No details provided"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditForm(supplier)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Supplier">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(supplier.supplierId)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Supplier">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </DialogContent>
  );
}
