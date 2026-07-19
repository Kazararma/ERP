// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { orderService } from "@/services/orderService";
import { inventoryService } from "@/services/inventoryService";
import { dealService } from "@/services/dealService";
import { Order, Inventory, Deal } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Link } from "react-router-dom";
import { DEAL_TYPE_LABELS } from "@/constants/dealLabels";

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      orderService.getAllOrders(),
      inventoryService.getAllInventory(),
      dealService.getAllDeals()
    ]).then(([ordersData, invData, dealsData]) => {
      setOrders(ordersData.filter(o => o.status !== "draft"));
      setInventory(invData);
      setDeals(dealsData);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  // KPIs
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalRevenue, 0);
  const totalProfit = orders.reduce((sum, o) => sum + (o.profit || 0), 0);
  const totalRawStock = inventory.reduce((sum, i) => sum + i.remainingRawKg, 0);
  const totalStagedStock = inventory.reduce((sum, i) => sum + i.remainingPackedKg, 0);
  const totalStockKg = totalRawStock + totalStagedStock;

  // Revenue Chart Data (aggregate by day)
  const revenueByDay: Record<string, { date: string, revenue: number, profit: number }> = {};
  orders.forEach(o => {
    if (!o.confirmedAt) return;
    const dateStr = new Date(o.confirmedAt.toMillis()).toLocaleDateString('en-GB'); // DD/MM/YYYY
    if (!revenueByDay[dateStr]) {
      revenueByDay[dateStr] = { date: dateStr, revenue: 0, profit: 0 };
    }
    revenueByDay[dateStr].revenue += o.totalRevenue;
    revenueByDay[dateStr].profit += o.profit || 0;
  });
  
  // Sort chronologically
  const chartData = Object.values(revenueByDay).sort((a, b) => {
    const [d1,m1,y1] = a.date.split('/');
    const [d2,m2,y2] = b.date.split('/');
    return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime();
  });

  const recentOrders = [...orders].sort((a, b) => (b.confirmedAt?.toMillis() || 0) - (a.confirmedAt?.toMillis() || 0)).slice(0, 5);

  // Top Customers (Top 5)
  const customerStats: Record<string, { name: string, weight: number, revenue: number }> = {};
  orders.forEach(o => {
    if (!customerStats[o.customerId]) customerStats[o.customerId] = { name: o.customerName, weight: 0, revenue: 0 };
    customerStats[o.customerId].weight += o.totalWeightKg;
    customerStats[o.customerId].revenue += o.totalRevenue;
  });
  const topCustomers = Object.values(customerStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Top Suppliers (Top 5)
  const supplierStats: Record<string, { name: string, weight: number, cost: number }> = {};
  deals.forEach(d => {
    if (!supplierStats[d.supplierId]) supplierStats[d.supplierId] = { name: d.supplierName, weight: 0, cost: 0 };
    supplierStats[d.supplierId].weight += d.totalAmountKg;
    supplierStats[d.supplierId].cost += d.totalCost;
  });
  const topSuppliers = Object.values(supplierStats).sort((a, b) => b.cost - a.cost).slice(0, 5);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-900 to-indigo-600 bg-clip-text text-transparent">Dashboard</h1>
      
      {/* Top Entities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none bg-white shadow-sm hover:-translate-y-1 transition-all duration-300 rounded-2xl">
          <CardHeader className="border-b border-slate-100 bg-white/50 pb-4">
            <CardTitle className="text-slate-800">Top 5 Suppliers</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {topSuppliers.length > 0 ? (
              <div className="space-y-4">
                {topSuppliers.map((supplier, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                      <div>
                        <p className="font-bold text-slate-800">{supplier.name}</p>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">{supplier.weight.toLocaleString()} kg Supplied</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-red-500">₹{supplier.cost.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-400 text-center py-4">No data</p>}
          </CardContent>
        </Card>
        
        <Card className="border-none bg-white shadow-sm hover:-translate-y-1 transition-all duration-300 rounded-2xl">
          <CardHeader className="border-b border-slate-100 bg-white/50 pb-4">
            <CardTitle className="text-slate-800">Top 5 Customers</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {topCustomers.length > 0 ? (
              <div className="space-y-4">
                {topCustomers.map((customer, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                      <div>
                        <p className="font-bold text-slate-800">{customer.name}</p>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">{customer.weight.toLocaleString()} kg {DEAL_TYPE_LABELS.sold}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-600">₹{customer.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-400 text-center py-4">No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-900/20 hover:-translate-y-1 transition-all duration-300 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Total Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-black">₹{totalRevenue.toLocaleString()}</p></CardContent>
        </Card>
        <Card className="border-none bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/20 hover:-translate-y-1 transition-all duration-300 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Net Profit</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-black">₹{totalProfit.toLocaleString()}</p></CardContent>
        </Card>
        <Card className="border-none bg-white/60 backdrop-blur-md shadow-lg shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-amber-600 text-xs font-bold uppercase tracking-wider">Stock (Staged)</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-black text-slate-800">{totalStagedStock.toLocaleString()} kg</p></CardContent>
        </Card>
        <Card className="border-none bg-white/60 backdrop-blur-md shadow-lg shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-slate-500 text-xs font-bold uppercase tracking-wider">Stock (Raw)</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-black text-slate-800">{totalRawStock.toLocaleString()} kg</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <Card className="border-none bg-white/60 backdrop-blur-md shadow-lg shadow-slate-200/50 rounded-2xl lg:col-span-2 overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-white/50">
            <CardTitle className="text-slate-800">Revenue & Profit Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] pt-6">
            {chartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">Not enough data to display chart</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={0}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} dy={10} />
                  <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} dx={-10} />
                  <Tooltip 
                    formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, ""]} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders List */}
        <Card className="border-none bg-white/60 backdrop-blur-md shadow-lg shadow-slate-200/50 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-white/50">
            <CardTitle className="text-slate-800">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-slate-500 font-medium text-center py-8">No recent orders</p>
            ) : (
              <div className="space-y-4">
                {recentOrders.map(order => (
                  <div key={order.orderId} className="flex justify-between items-center border-b border-slate-100 pb-4 last:border-0 last:pb-0 hover:bg-slate-50/50 p-2 rounded-xl transition-colors">
                    <div>
                      <p className="font-bold text-slate-800">{order.customerName}</p>
                      <p className="text-xs text-slate-500 font-medium">{order.totalWeightKg} kg • {new Date(order.confirmedAt!.toMillis()).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900">₹{order.totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-emerald-600 font-bold">+₹{order.profit.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link to="/ledger" className="text-sm text-indigo-600 hover:text-indigo-800 font-bold w-full block text-center transition-colors">
                View All Ledger Entries →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
