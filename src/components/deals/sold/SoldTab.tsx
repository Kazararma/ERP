import { useEffect, useState, useMemo } from "react";
import { orderService } from "@/services/orderService";
import { Order } from "@/types/order";
import { OrderFormModal } from "./OrderFormModal";
import CustomerManager from "./CustomerManager";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import OrderCard from "./OrderCard";
import { DealsFilterValues } from "@/components/deals/DealsFilter";

export function SoldTab({ dateFilter }: { dateFilter?: DealsFilterValues }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    const data = await orderService.getAllOrders();
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    let filtered = orders;
    if (dateFilter) {
      filtered = filtered.filter(order => {
        if (dateFilter.type !== "all-time") {
          const date = (order.orderDate as any)?.toMillis ? new Date((order.orderDate as any).toMillis()) : new Date();
          if (dateFilter.startDate && date < dateFilter.startDate) return false;
          if (dateFilter.endDate && date > dateFilter.endDate) return false;
        }
        if (dateFilter.searchQuery && dateFilter.searchQuery !== "all-names" && order.customerId !== dateFilter.searchQuery) return false;
        return true;
      });
    }
    return filtered;
  }, [orders, dateFilter]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold text-gray-800">Sales Orders</h2>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <Dialog>
            <DialogTrigger render={
              <button className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors shadow-sm">
                Manage Customers
              </button>
            } />
            <CustomerManager />
          </Dialog>
          <OrderFormModal onSuccess={fetchOrders} />
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map(order => (
            <OrderCard key={order.orderId} order={order} onUpdate={fetchOrders} />
          ))}
          {filteredOrders.length === 0 && (
             <div className="text-center p-12 text-gray-500 bg-white rounded-lg border">
               No orders found for the selected filter.
             </div>
          )}
        </div>
      )}
    </div>
  );
}
