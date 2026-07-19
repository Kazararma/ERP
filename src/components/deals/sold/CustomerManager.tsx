"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Customer } from "@/types/order";
import { customerService } from "@/services/customerService";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";

export default function CustomerManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Customer>();

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await customerService.getAllCustomers();
      setCustomers(data);
    } catch (e) {
      console.error("Failed to fetch customers", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openAddForm = () => {
    setEditingCustomer(null);
    reset({ name: "", description: "", contactPhone: "", contactEmail: "", address: "" });
    setIsFormOpen(true);
  };

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer);
    reset({ ...customer });
    setIsFormOpen(true);
  };

  const onSubmit = async (data: any) => {
    try {
      if (editingCustomer) {
        await customerService.updateCustomer(editingCustomer.customerId, data);
      } else {
        await customerService.createCustomer({
          ...data,
          createdBy: auth.currentUser?.uid || "unknown",
        });
      }
      setIsFormOpen(false);
      fetchCustomers();
    } catch (e) {
      console.error("Failed to save customer", e);
      toast.error("Failed to save customer.");
    }
  };

  return (
    <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">{isFormOpen ? (editingCustomer ? "Edit Customer" : "Add Customer") : "Manage Customers"}</DialogTitle>
      </DialogHeader>

      {isFormOpen ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto pr-2 pb-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Customer Name <span className="text-red-500">*</span></label>
            <input 
              {...register("name", { required: "Name is required" })} 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              placeholder="e.g. John Doe"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message as string}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Description / Notes</label>
            <textarea 
              {...register("description")} 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              placeholder="e.g. Regular wholesale buyer"
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
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Physical Address</label>
            <textarea 
              {...register("address")} 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              placeholder="123 Main St"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-500/25 transition-all">
              {editingCustomer ? "Save Changes" : "Add Customer"}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="mb-4">
            <button onClick={openAddForm} className="w-full py-2.5 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add New Customer
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {loading ? (
              <div className="flex justify-center p-8"><div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
            ) : customers.length === 0 ? (
              <p className="text-center text-slate-500 py-8 font-medium">No customers found.</p>
            ) : (
              customers.map(customer => (
                <div key={customer.customerId} className="flex items-center justify-between p-3 bg-white border border-slate-100 shadow-sm rounded-xl hover:border-indigo-100 hover:shadow-md transition-all">
                  <div>
                    <h4 className="font-bold text-slate-800">{customer.name}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{customer.description || customer.contactPhone || "No details provided"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditForm(customer)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Customer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
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
