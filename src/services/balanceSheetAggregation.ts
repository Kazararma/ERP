// src/services/balanceSheetAggregation.ts
// Phase 3 — Firestore Aggregation Logic

import {
  collection,
  getDocs,
  query,
  where,
  getAggregateFromServer,
  sum,
  runTransaction,
  doc,
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AggregatedFinancials, BalanceLineItem, GroupKey, BalanceSide } from "@/types/balanceSheet";
import type { Inventory } from "@/types/inventory";
import type { Deal } from "@/types/deal";
import type { Bank } from "@/types/bank";
import type { LedgerProfile } from "@/types/ledger-profile";

// ─── 1. CLOSING STOCK ──────────────────────────────────────────────────────────
// Sum of (remainingRawKg + remainingPackedKg) * pricePerKg across all active inventory batches.
// Computed client-side after fetch since Firestore cannot do multiplication in getAggregateFromServer.
// TODO: (Performance) If batches scale to 1000+, migrate this to a Cloud Function aggregating on write.

export async function getClosingStockValue(): Promise<number> {
  try {
    const q = query(collection(db, "inventory"), where("status", "!=", "exhausted"));
    const invSnap = await getDocs(q);
    
    if (invSnap.empty) return 0;

    let totalValue = 0;
    
    // We fetch deals individually or in parallel. Since inventoryId === dealId, we fetch by ID.
    // For a small/medium DB, Promise.all is fine.
    await Promise.all(
      invSnap.docs.map(async (invDoc) => {
        const inv = invDoc.data() as Inventory;
        const totalRemaining = (inv.remainingRawKg || 0) + (inv.remainingPackedKg || 0);
        
        if (totalRemaining > 0) {
          // Fetch corresponding deal to get pricePerKg
          const dealRef = doc(db, "deals", inv.dealId);
          const dealSnap = await getDocs(query(collection(db, "deals"), where("dealId", "==", inv.dealId)));
          
          if (!dealSnap.empty) {
            const deal = dealSnap.docs[0].data() as Deal;
            totalValue += totalRemaining * (deal.pricePerKg || 0);
          }
        }
      })
    );
    
    return totalValue;
  } catch (error) {
    console.warn("[BalanceSheet] Failed to aggregate Closing Stock:", error);
    return 0;
  }
}

// ─── 2. SUNDRY DEBTORS ─────────────────────────────────────────────────────────
// Defined by business owner mapping: Sum of closingBalance for 'supplier' ledger profiles.

export async function getSundryDebtorsValue(): Promise<number> {
  try {
    const q = query(collection(db, "ledgerProfiles"), where("entityType", "==", "supplier"));
    const snapshot = await getDocs(q);
    let total = 0;
    snapshot.forEach(doc => {
      const data = doc.data() as LedgerProfile;
      total += data.closingBalance || 0;
    });
    return total;
  } catch (error) {
    console.warn("[BalanceSheet] Failed to aggregate Sundry Debtors:", error);
    return 0;
  }
}

// ─── 3. SUNDRY CREDITORS ───────────────────────────────────────────────────────
// Defined by business owner mapping: Sum of (totalCredit - totalDebit) for 'customer' ledger profiles.

export async function getSundryCreditorsValue(): Promise<number> {
  try {
    const q = query(collection(db, "ledgerProfiles"), where("entityType", "==", "customer"));
    const snapshot = await getDocs(q);
    let total = 0;
    snapshot.forEach(doc => {
      const data = doc.data() as LedgerProfile;
      // closingBalance is totalDebit - totalCredit, so we negate it
      total += data.closingBalance || 0;
    });
    return -total;
  } catch (error) {
    console.warn("[BalanceSheet] Failed to aggregate Sundry Creditors:", error);
    return 0;
  }
}

// ─── 4. CASH IN HAND ───────────────────────────────────────────────────────────
// Defined by business owner mapping: Sum of totalDebit for 'customer' ledger profiles.

export async function getCashInHandValue(): Promise<number> {
  try {
    const q = query(collection(db, "ledgerProfiles"), where("entityType", "==", "customer"));
    const snapshot = await getDocs(q);
    let total = 0;
    snapshot.forEach(doc => {
      const data = doc.data() as LedgerProfile;
      total += data.totalDebit || 0;
    });
    return total;
  } catch (error) {
    console.warn("[BalanceSheet] Failed to aggregate Cash in Hand:", error);
    return 0;
  }
}

// ─── 5. BANK ACCOUNTS ──────────────────────────────────────────────────────────
// Live reference to each Bank Account document's current principal balance.

export async function getBankAccountsData(): Promise<AggregatedFinancials["bankAccounts"]> {
  try {
    const snap = await getDocs(collection(db, "banks"));
    return snap.docs.map(doc => {
      const data = doc.data() as Bank;
      return {
        id: doc.id,
        name: data.name || "Unknown Bank",
        balance: data.principalAmount || 0,
      };
    });
  } catch (error) {
    console.warn("[BalanceSheet] Failed to fetch Bank Accounts:", error);
    return [];
  }
}

// ─── 6. SALES REVENUE ──────────────────────────────────────────────────────────
// Sum of totalRevenue for all confirmed or delivered orders
export async function getSalesRevenueValue(): Promise<number> {
  try {
    const q1 = query(collection(db, "orders"), where("status", "==", "confirmed"));
    const q2 = query(collection(db, "orders"), where("status", "==", "delivered"));
    
    // We can fetch both and sum, or use an 'in' query
    const q = query(collection(db, "orders"), where("status", "in", ["confirmed", "delivered"]));
    const snapshot = await getDocs(q);
    
    let total = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      total += data.totalRevenue || 0;
    });
    return total;
  } catch (error) {
    console.warn("[BalanceSheet] Failed to aggregate Sales Revenue:", error);
    return 0;
  }
}

// ─── 7. COST OF GOODS SOLD ─────────────────────────────────────────────────────
// Sum of totalCostOfGoods for all confirmed or delivered orders
export async function getCostOfGoodsSoldValue(): Promise<number> {
  try {
    const q = query(collection(db, "orders"), where("status", "in", ["confirmed", "delivered"]));
    const snapshot = await getDocs(q);
    
    let total = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      total += data.totalCostOfGoods || 0;
    });
    return total;
  } catch (error) {
    console.warn("[BalanceSheet] Failed to aggregate COGS:", error);
    return 0;
  }
}

// ─── 8. OPERATING EXPENSES ─────────────────────────────────────────────────────
// Sum of all salary amounts from salaryTransactions (grossAmount field)
// Also includes bank debit transactions linked to salaries via relatedSalaryTxId
export async function getOperatingExpensesValue(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, "salaryTransactions"));
    let total = 0;
    snap.forEach(doc => {
      const data = doc.data();
      // wagesStore saves the amount as 'grossAmount', not 'amount'
      total += data.grossAmount || data.amount || 0;
    });
    return total;
  } catch (error) {
    console.warn("[BalanceSheet] Failed to aggregate Operating Expenses:", error);
    return 0;
  }
}

// ─── 9. TOTAL PURCHASES ────────────────────────────────────────────────────────
// Sum of totalCost for all deals.
export async function getTotalPurchasesValue(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, "deals"));
    let total = 0;
    snap.forEach(doc => {
      const data = doc.data();
      total += data.totalCost || 0;
    });
    return total;
  } catch (error) {
    console.warn("[BalanceSheet] Failed to aggregate Total Purchases:", error);
    return 0;
  }
}

// ─── COMPOSED AGGREGATION ──────────────────────────────────────────────────────

export async function getAggregatedFinancials(): Promise<AggregatedFinancials> {
  const [
    closingStock, sundryDebtors, sundryCreditors, cashInHand, bankAccounts,
    salesRevenue, cogs, operatingExpenses, totalPurchases
  ] = await Promise.all([
    getClosingStockValue(),
    getSundryDebtorsValue(),
    getSundryCreditorsValue(),
    getCashInHandValue(),
    getBankAccountsData(),
    getSalesRevenueValue(),
    getCostOfGoodsSoldValue(),
    getOperatingExpensesValue(),
    getTotalPurchasesValue()
  ]);

  // GST Calculation (Assumption: 5% flat rate on sales and purchases)
  const outputGst = salesRevenue * 0.05;
  const inputGst = totalPurchases * 0.05;

  return {
    closingStock,
    sundryDebtors,
    sundryCreditors,
    cashInHand,
    bankAccounts,
    salesRevenue,
    cogs,
    operatingExpenses,
    outputGst,
    inputGst,
    totalPurchases
  };
}

// ─── MANUAL ENTRIES CRUD ───────────────────────────────────────────────────────
// Uses runTransaction for adding/updating to ensure consistency if we later add
// computed dependencies or balance checks server-side.

export interface ManualEntryPayload {
  side: BalanceSide;
  groupKey: GroupKey;
  label: string;
  amount: number;
  createdBy: string;
}

export async function addBalanceSheetManualEntry(payload: ManualEntryPayload): Promise<string> {
  const newRef = doc(collection(db, "balanceSheetManualEntries"));
  await runTransaction(db, async (tx) => {
    tx.set(newRef, {
      id: newRef.id,
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return newRef.id;
}

export async function updateBalanceSheetManualEntry(
  id: string,
  patch: Partial<Pick<ManualEntryPayload, "label" | "amount">>
): Promise<void> {
  const ref = doc(db, "balanceSheetManualEntries", id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Manual entry not found");
    
    tx.update(ref, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteBalanceSheetManualEntry(id: string): Promise<void> {
  // Simple delete since there are no dependent balances yet
  const ref = doc(db, "balanceSheetManualEntries", id);
  await deleteDoc(ref);
}
