"use client";

import { useEffect, useState } from "react";
import { orderService } from "@/services/orderService";
import { Order } from "@/types";
import OrderCard from "./sold/OrderCard";
import OrderForm from "./sold/OrderForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function TabSold() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchOrders = async () => {
    try {
      const allOrders = await orderService.getAllOrders();
      setOrders(allOrders);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white/60 backdrop-blur-md p-5 rounded-2xl shadow-lg shadow-indigo-900/5 border border-slate-100">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Sales Orders</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-indigo-700 hover:shadow-indigo-500/25 transition-all duration-300 hover:-translate-y-0.5">
            Create Order
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Sales Order</DialogTitle>
            </DialogHeader>
            <OrderForm onSuccess={() => { setOpen(false); fetchOrders(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : orders.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 backdrop-blur-sm text-slate-500 font-medium">
          No orders found. Create one to sell inventory.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map(order => (
            <OrderCard key={order.orderId} order={order} onUpdate={fetchOrders} />
          ))}
        </div>
      )}
    </div>
  );
}
