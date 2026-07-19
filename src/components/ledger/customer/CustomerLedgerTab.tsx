import { useEffect, useState } from "react";
import { orderService } from "@/services/orderService";
import { Order } from "@/types";
import { DEAL_TYPE_LABELS } from "@/constants/dealLabels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { DealsFilter, DealsFilterValues } from "@/components/deals/DealsFilter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CustomerProfilesTab } from "./profiles/CustomerProfilesTab";
import { Trash2 } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";

export function CustomerLedgerTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DealsFilterValues>({ type: "all-time", startDate: null, endDate: null, searchQuery: "all-names" });

  const fetchOrders = () => {
    setLoading(true);
    orderService.getAllOrders().then(data => {
      setOrders(data.filter(o => o.status !== "draft"));
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDelete = async (orderId: string) => {
    const confirmed = await useUiStore.getState().requestConfirm("Delete Order", "Are you sure you want to delete this order?");
    if (confirmed) {
      await orderService.deleteOrder(orderId);
      fetchOrders();
    }
  };

  const filteredOrders = orders.filter(order => {
    if (dateFilter.type !== "all-time") {
      const date = (order.confirmedAt as any)?.toMillis ? new Date((order.confirmedAt as any).toMillis()) : new Date();
      if (dateFilter.startDate && date < dateFilter.startDate) return false;
      if (dateFilter.endDate && date > dateFilter.endDate) return false;
    }
    if (dateFilter.searchQuery && dateFilter.searchQuery !== "all-names") {
      // For customer ledger, search by customerId
      if (order.customerId !== dateFilter.searchQuery) return false;
    }
    return true;
  });

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.totalRevenue || 0), 0);
  const totalProfit = filteredOrders.reduce((sum, o) => sum + (o.profit || 0), 0);
  const totalVolume = filteredOrders.reduce((sum, o) => sum + (o.totalWeightKg || 0), 0);

  return (
    <div className="flex flex-col gap-6 h-full">
      <DealsFilter activeTab="sold" onChange={setDateFilter} />
      
      <Tabs defaultValue="events" className="flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="events">Transaction Events</TabsTrigger>
          <TabsTrigger value="profiles">Ledger Profiles</TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="space-y-8 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-900/20 hover:-translate-y-1 transition-all duration-300 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Total Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-black">₹{totalRevenue.toLocaleString()}</p></CardContent>
        </Card>
        <Card className="border-none bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:-translate-y-1 transition-all duration-300 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Total Profit</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-black">₹{totalProfit.toLocaleString()}</p></CardContent>
        </Card>
        <Card className="border-none bg-white border border-slate-200 shadow-sm hover:-translate-y-1 transition-all duration-300 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Volume {DEAL_TYPE_LABELS.sold}</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-black text-slate-800">{totalVolume.toLocaleString()} kg</p></CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[800px] text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Volume</th>
                <th className="px-6 py-4">Revenue</th>
                <th className="px-6 py-4">Profit</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400 font-medium">Loading ledger...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400 font-medium">No confirmed orders found.</td></tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.orderId} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5 text-slate-500 font-medium">{new Date((order.confirmedAt as any)?.toMillis() || Date.now()).toLocaleDateString()}</td>
                    <td className="px-6 py-5 font-bold text-slate-800">{order.customerName}</td>
                    <td className="px-6 py-5 text-slate-600">{order.totalWeightKg?.toLocaleString()} kg</td>
                    <td className="px-6 py-5 text-slate-900 font-black">₹{order.totalRevenue?.toLocaleString()}</td>
                    <td className="px-6 py-5 text-emerald-600 font-black">₹{order.profit?.toLocaleString()}</td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${order.status === 'delivered' || order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right flex items-center justify-end gap-3">
                      <Link to={`/ledger/${order.orderId}`} className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline transition-colors text-xs">
                        Details →
                      </Link>
                      <button 
                        onClick={() => handleDelete(order.orderId)} 
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" 
                        title="Delete Order"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </TabsContent>
        <TabsContent value="profiles" className="flex-1 mt-4">
          <CustomerProfilesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
