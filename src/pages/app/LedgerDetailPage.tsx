// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { ledgerService } from "@/services/ledgerService";
import { Order, OrderAllocation } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useParams } from "react-router-dom";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/pdf/InvoicePDF";

export default function LedgerDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  
  const [data, setData] = useState<{ order: Order, allocations: (OrderAllocation & { supplierName: string; productName: string })[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      ledgerService.getLedgerForOrder(orderId).then(res => {
        setData(res);
        setLoading(false);
      }).catch(e => {
        console.error(e);
        setLoading(false);
      });
    }
  }, [orderId]);

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!data) return <div className="p-12 text-center text-gray-500">Order not found.</div>;

  const { order, allocations } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/ledger" className="text-gray-500 hover:text-gray-900 bg-gray-100 px-3 py-1.5 rounded-md text-sm font-medium">
          ← Back to Ledger
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Order Details: {order.customerName}</h1>
        </div>
        <PDFDownloadLink
          document={<InvoicePDF order={order} allocations={allocations} />}
          fileName={`Invoice_${order.orderId}.pdf`}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all flex items-center gap-2"
        >
          {({ loading: pdfLoading }) => (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {pdfLoading ? 'Generating PDF...' : 'Download Invoice'}
            </>
          )}
        </PDFDownloadLink>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50 border-b pb-4">
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Name</p>
                  <p className="font-bold text-lg">{order.customerName}</p>
                </div>
                <div>
                  <p className="text-gray-500">Order Date</p>
                  <p className="font-medium">{new Date(order.createdAt?.toMillis() || Date.now()).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 mt-1 inline-block">
                    {order.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Confirmed At</p>
                  <p className="font-medium">{order.confirmedAt ? new Date(order.confirmedAt.toMillis()).toLocaleString() : "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="bg-gray-50 border-b pb-4">
              <CardTitle>Allocation Breakdown (COGS)</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-gray-500 border-b">
                  <tr>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Product Code</th>
                    <th className="px-4 py-3">Rice Type</th>
                    <th className="px-4 py-3">Bag Size</th>
                    <th className="px-4 py-3">Bags</th>
                    <th className="px-4 py-3">Weight</th>
                    <th className="px-4 py-3">Purchase Price</th>
                    <th className="px-4 py-3">Selling Price</th>
                    <th className="px-4 py-3 text-right">COGS</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allocations.map(alloc => {
                    const rev = (alloc as any).revenue !== undefined ? (alloc as any).revenue : (alloc.weightKg * ((order as any).sellingPricePerKg || 0));
                    const prof = (alloc as any).profit !== undefined ? (alloc as any).profit : rev - alloc.totalCost;
                    return (
                    <tr key={alloc.allocationId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{alloc.supplierName}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-bold">{(alloc as any).product?.productCode || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{(alloc as any).product?.riceTypeName || "-"}</td>
                      <td className="px-4 py-3">{(alloc as any).bagSize || "-"}</td>
                      <td className="px-4 py-3 font-bold">{alloc.numberOfBags}</td>
                      <td className="px-4 py-3">{alloc.weightKg} kg</td>
                      <td className="px-4 py-3">₹{(alloc as any).purchasePricePerKg?.toLocaleString()}/kg</td>
                      <td className="px-4 py-3">₹{(rev / alloc.weightKg).toLocaleString(undefined, { maximumFractionDigits: 2 })}/kg</td>
                      <td className="px-4 py-3 text-right text-red-600">₹{alloc.totalCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">₹{rev.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-black text-indigo-600">₹{prof.toLocaleString()}</td>
                    </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={5} className="px-4 py-3 text-right">Totals:</td>
                    <td className="px-4 py-3">{order.totalWeightKg} kg</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right text-red-600">₹{((order as any).totalCostOfGoods || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">₹{(order.totalRevenue || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-indigo-600">₹{(order.profit || 0).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-blue-200">
            <CardHeader className="bg-blue-50 border-b border-blue-100 pb-4">
              <CardTitle className="text-blue-900">Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Volume Sold</span>
                <span className="font-bold">
                  {(order as any).totalQuantityQuintal !== undefined 
                    ? `${(order as any).totalQuantityQuintal} Quintal` 
                    : `${(order.totalWeightKg / 100).toFixed(2)} Quintal`
                  } ({order.totalWeightKg} kg)
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Avg. Selling Price</span>
                <span className="font-bold">
                  ₹{((order as any).sellingPricePerQuintal || (order.totalRevenue / (order.totalWeightKg / 100))).toLocaleString(undefined, { maximumFractionDigits: 2 })} / Quintal
                </span>
              </div>
              
              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Gross Revenue</span>
                  <span className="font-bold text-lg text-gray-900">₹{(order.totalRevenue || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Cost of Goods</span>
                  <span className="font-bold text-lg text-red-600">- ₹{((order as any).totalCostOfGoods || 0).toLocaleString()}</span>
                </div>
                <div className="pt-3 border-t-2 border-dashed flex justify-between items-center">
                  <span className="text-gray-900 font-bold text-lg">Net Profit</span>
                  <span className="font-black text-2xl text-green-600">₹{(order.profit || 0).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
