import {
  collection, query, where, orderBy, onSnapshot, getDocs, deleteDoc, doc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SupplierLedgerEntry } from "@/types/ledger";

/**
 * Subscribe to all ledger entries for a specific supplier, ordered by eventDate descending.
 */
export function subscribeToSupplierLedger(
  supplierId: string | null,
  callback: (entries: SupplierLedgerEntry[]) => void
): () => void {
  const q = supplierId 
    ? query(
        collection(db, "supplierLedgerEntries"),
        where("supplierId", "==", supplierId),
        orderBy("eventDate", "desc")
      )
    : query(
        collection(db, "supplierLedgerEntries"),
        orderBy("eventDate", "desc")
      );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as SupplierLedgerEntry));
  });
}

/**
 * Fetch a financial summary for a supplier: total spend, total kg bought,
 * total kg sold, and remaining packed kg. Computed from ledger entries.
 */
export async function getSupplierFinancialSummary(supplierId: string): Promise<{
  totalSpend: number;
  totalKgBought: number;
  totalKgSold: number;
  totalRevenue: number;
}> {
  const q = query(
    collection(db, "supplierLedgerEntries"),
    where("supplierId", "==", supplierId)
  );
  const snap = await getDocs(q);
  const entries = snap.docs.map((d) => d.data() as SupplierLedgerEntry);

  let totalSpend = 0;
  let totalKgBought = 0;
  let totalKgSold = 0;
  let totalRevenue = 0;

  for (const e of entries) {
    if (e.eventType === "purchase_created") {
      totalSpend += e.totalValue ?? 0;
      totalKgBought += e.amountKg ?? 0;
    }
    if (e.eventType === "allocation_deducted") {
      totalKgSold += e.totalWeightKg ?? 0;
      totalRevenue += e.revenueFromSale ?? 0;
    }
  }

  return { totalSpend, totalKgBought, totalKgSold, totalRevenue };
}

/**
 * Subscribe to a summary list of all suppliers who have ledger entries.
 * Returns unique supplierId + supplierName pairs for the list view.
 */
export function subscribeToAllSupplierLedgerSummaries(
  callback: (suppliers: { supplierId: string; supplierName: string }[]) => void
): () => void {
  return onSnapshot(collection(db, "supplierLedgerEntries"), (snap) => {
    const seen = new Map<string, string>();
    snap.docs.forEach((d) => {
      const entry = d.data() as SupplierLedgerEntry;
      if (!seen.has(entry.supplierId)) {
        seen.set(entry.supplierId, entry.supplierName);
      }
    });
    callback(Array.from(seen.entries()).map(([supplierId, supplierName]) => ({ supplierId, supplierName })));
  });
}

/**
 * Delete a specific supplier ledger entry.
 */
export async function deleteSupplierLedgerEntry(entryId: string): Promise<void> {
  await deleteDoc(doc(db, "supplierLedgerEntries", entryId));
}
