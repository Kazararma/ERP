// @ts-nocheck
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Deal, Order, OrderAllocation } from "@/types";

export const ledgerService = {
  async getLedgerForOrder(orderId: string): Promise<{ order: Order, allocations: (OrderAllocation & { supplierName: string; productName: string })[] }> {
    const orderDoc = await getDocs(query(collection(db, "orders"), where("orderId", "==", orderId)));
    if (orderDoc.empty) throw new Error("Order not found");
    
    const allocSnap = await getDocs(collection(db, "orders", orderId, "allocations"));
    const allocations = allocSnap.docs.map(d => d.data() as OrderAllocation);

    // Fetch unique deals to get supplier + product info
    const uniqueDealIds = [...new Set(allocations.map(a => a.dealId))];
    const dealMap = new Map<string, Deal>();
    await Promise.all(uniqueDealIds.map(async (dealId) => {
      const dealSnap = await getDoc(doc(db, "deals", dealId));
      if (dealSnap.exists()) dealMap.set(dealId, dealSnap.data() as Deal);
    }));

    return {
      order: orderDoc.docs[0].data() as Order,
      allocations: allocations.map(a => ({
        ...a,
        supplierName: dealMap.get(a.dealId)?.supplierName ?? "Unknown Supplier",
        productName: dealMap.get(a.dealId)?.productName ?? "Unknown Product",
      }))
    };
  }
};
