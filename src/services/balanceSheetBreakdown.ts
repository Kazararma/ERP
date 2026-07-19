// src/services/balanceSheetBreakdown.ts
import { collection, getDocs, query, where, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LedgerProfile } from "@/types/ledger-profile";
import type { Inventory } from "@/types/inventory";
import type { Deal } from "@/types/deal";
import type { BankTransaction } from "@/types/bank";
import type { Order } from "@/types/order";

export interface BreakdownItem {
  id: string;
  label: string;
  amount: number;
  subtitle?: string;
}

export async function getDebtorsBreakdown(): Promise<BreakdownItem[]> {
  try {
    const q = query(collection(db, "ledgerProfiles"), where("entityType", "==", "supplier"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data() as LedgerProfile;
      return {
        id: doc.id,
        label: data.entityName || "Unknown Supplier",
        amount: data.closingBalance || 0,
        subtitle: `Phone: ${data.millContact || 'N/A'}`
      };
    }).filter(i => i.amount !== 0);
  } catch (error) {
    console.error("Failed to get debtors breakdown", error);
    return [];
  }
}

export async function getCreditorsBreakdown(): Promise<BreakdownItem[]> {
  try {
    const q = query(collection(db, "ledgerProfiles"), where("entityType", "==", "customer"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data() as LedgerProfile;
      return {
        id: doc.id,
        label: data.entityName || "Unknown Customer",
        amount: -(data.closingBalance || 0), // Negated per core logic
        subtitle: `Phone: ${data.millContact || 'N/A'}`
      };
    }).filter(i => i.amount !== 0);
  } catch (error) {
    console.error("Failed to get creditors breakdown", error);
    return [];
  }
}

export async function getCashInHandBreakdown(): Promise<BreakdownItem[]> {
  try {
    const q = query(collection(db, "ledgerProfiles"), where("entityType", "==", "customer"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data() as LedgerProfile;
      return {
        id: doc.id,
        label: data.entityName || "Unknown Customer",
        amount: data.totalDebit || 0, // Summed for Cash In Hand
        subtitle: 'Total Debit'
      };
    }).filter(i => i.amount !== 0);
  } catch (error) {
    console.error("Failed to get cash in hand breakdown", error);
    return [];
  }
}

export async function getClosingStockBreakdown(): Promise<BreakdownItem[]> {
  try {
    const q = query(collection(db, "inventory"), where("status", "!=", "exhausted"));
    const invSnap = await getDocs(q);
    const items: BreakdownItem[] = [];
    
    await Promise.all(
      invSnap.docs.map(async (invDoc) => {
        const inv = invDoc.data() as Inventory;
        const totalRemaining = (inv.remainingRawKg || 0) + (inv.remainingPackedKg || 0);
        
        if (totalRemaining > 0) {
          const dealSnap = await getDocs(query(collection(db, "deals"), where("dealId", "==", inv.dealId)));
          if (!dealSnap.empty) {
            const deal = dealSnap.docs[0].data() as Deal;
            const dateStr = deal.purchaseDate ? new Date(deal.purchaseDate.toMillis()).toLocaleDateString() : 'Unknown Date';
            items.push({
              id: invDoc.id,
              label: `${deal.supplierName || 'Unknown Supplier'} - ${deal.product?.riceTypeCode || 'Unknown'}`,
              amount: totalRemaining * (deal.pricePerKg || 0),
              subtitle: `${dateStr} • ${totalRemaining} kg @ ₹${deal.pricePerKg}/kg`
            });
          }
        }
      })
    );
    return items;
  } catch (error) {
    console.error("Failed to get closing stock breakdown", error);
    return [];
  }
}

export async function getSalesRevenueBreakdown(): Promise<BreakdownItem[]> {
  try {
    const q = query(collection(db, "orders"), where("status", "in", ["confirmed", "delivered"]));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data() as Order;
      const dateStr = data.orderDate ? new Date(data.orderDate.toMillis()).toLocaleDateString() : 'Unknown Date';
      return {
        id: doc.id,
        label: `${data.customerName || 'Unknown Customer'}`,
        amount: data.totalRevenue || 0,
        subtitle: `${dateStr} • Order #${data.orderId.slice(0,6)}`
      };
    }).filter(i => i.amount !== 0);
  } catch (error) {
    console.error("Failed to get sales revenue breakdown", error);
    return [];
  }
}

export async function getCogsBreakdown(): Promise<BreakdownItem[]> {
  try {
    const q = query(collection(db, "orders"), where("status", "in", ["confirmed", "delivered"]));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data() as Order;
      const dateStr = data.orderDate ? new Date(data.orderDate.toMillis()).toLocaleDateString() : 'Unknown Date';
      return {
        id: doc.id,
        label: `${data.customerName || 'Unknown Customer'}`,
        amount: data.totalCostOfGoods || 0,
        subtitle: `${dateStr} • Order #${data.orderId.slice(0,6)} (COGS)`
      };
    }).filter(i => i.amount !== 0);
  } catch (error) {
    console.error("Failed to get cogs breakdown", error);
    return [];
  }
}

export async function getOperatingExpensesBreakdown(): Promise<BreakdownItem[]> {
  try {
    const snap = await getDocs(collection(db, "salaryTransactions"));
    return snap.docs.map(doc => {
      const data = doc.data();
      const amount = data.grossAmount || data.amount || 0;
      const paidAt = data.paidAt?.toMillis ? new Date(data.paidAt.toMillis()).toLocaleDateString() : 'Unknown Date';
      return {
        id: doc.id,
        label: data.employeeName || 'Unknown Employee',
        amount,
        subtitle: `${paidAt} • ${data.wageMode || ''} • via ${data.bankName || 'Bank'}`
      };
    }).filter(i => i.amount !== 0);
  } catch (error) {
    console.error("Failed to get operating expenses breakdown", error);
    return [];
  }
}

export async function getGstBreakdown(type: 'output' | 'input'): Promise<BreakdownItem[]> {
  try {
    if (type === 'output') {
      const q = query(collection(db, "orders"), where("status", "in", ["confirmed", "delivered"]));
      const snap = await getDocs(q);
      return snap.docs.map(doc => {
        const data = doc.data() as Order;
        const amount = (data.totalRevenue || 0) * 0.05;
        const dateStr = data.orderDate ? new Date(data.orderDate.toMillis()).toLocaleDateString() : 'Unknown Date';
        return {
          id: doc.id,
          label: `${data.customerName || 'Unknown Customer'}`,
          amount: amount,
          subtitle: `${dateStr} • Order #${data.orderId.slice(0,6)}`
        };
      }).filter(i => i.amount !== 0);
    } else {
      const q = query(collection(db, "deals"));
      const snap = await getDocs(q);
      return snap.docs.map(doc => {
        const data = doc.data() as Deal;
        const amount = (data.totalCost || 0) * 0.05;
        const dateStr = data.purchaseDate ? new Date(data.purchaseDate.toMillis()).toLocaleDateString() : 'Unknown Date';
        return {
          id: doc.id,
          label: `${data.supplierName || 'Unknown Supplier'} - ${data.product?.riceTypeCode || 'Unknown'}`,
          amount: amount,
          subtitle: `${dateStr} • Deal #${data.dealId.slice(0,6)}`
        };
      }).filter(i => i.amount !== 0);
    }
  } catch (error) {
    console.error("Failed to get gst breakdown", error);
    return [];
  }
}

export async function getBankAccountBreakdown(bankAccountId: string): Promise<BreakdownItem[]> {
  try {
    const q = query(collection(db, "banks", bankAccountId, "transactions"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data() as BankTransaction;
      return {
        id: doc.id,
        label: data.note || (data.type === 'credit' ? 'Deposit' : 'Withdrawal'),
        amount: data.type === 'credit' ? data.amount : -data.amount,
        subtitle: data.createdAt ? new Date(data.createdAt.toMillis()).toLocaleDateString() : 'N/A'
      };
    });
  } catch (error) {
    console.error("Failed to get bank account breakdown", error);
    return [];
  }
}

export async function getTotalPurchasesBreakdown(): Promise<BreakdownItem[]> {
  try {
    const q = query(collection(db, "deals"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data() as Deal;
      const dateStr = data.purchaseDate ? new Date(data.purchaseDate.toMillis()).toLocaleDateString() : 'Unknown Date';
      return {
        id: doc.id,
        label: `${data.supplierName || 'Unknown Supplier'} - ${data.product?.riceTypeCode || 'Unknown'}`,
        amount: data.totalCost || 0,
        subtitle: `${dateStr} • Deal #${data.dealId.slice(0,6)}`
      };
    }).filter(i => i.amount !== 0);
  } catch (error) {
    console.error("Failed to get total purchases breakdown", error);
    return [];
  }
}
