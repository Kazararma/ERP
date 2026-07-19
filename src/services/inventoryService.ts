// FIRESTORE INDEX REQUIRED:
// Collection: inventory
// Fields indexed: product.riceTypeCode (Ascending), product.productCode (Ascending)
// Create this composite index in Firebase Console → Firestore → Indexes → Composite

import { collection, getDocs, query, orderBy, onSnapshot, doc, runTransaction, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Inventory, InventoryExcess } from "@/types";

export const inventoryService = {
  async getAllInventory(): Promise<Inventory[]> {
    const q = query(
      collection(db, "inventory"),
      orderBy("product.riceTypeCode", "asc"),
      orderBy("product.productCode", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Inventory);
  },

  subscribeToInventory(callback: (inv: Inventory[]) => void): () => void {
    const q = query(
      collection(db, "inventory"),
      orderBy("product.riceTypeCode", "asc"),
      orderBy("product.productCode", "asc")
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => d.data() as Inventory));
    });
  },

  async getExcessInventory(): Promise<InventoryExcess[]> {
    const q = query(
      collection(db, "inventoryExcess"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as InventoryExcess);
  },

  subscribeToExcessInventory(callback: (excess: InventoryExcess[]) => void): () => void {
    const q = query(
      collection(db, "inventoryExcess"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => d.data() as InventoryExcess));
    });
  },

  async adjustInventoryAmount(
    inventoryId: string, 
    type: "raw" | "packed", 
    newAmount: number, 
    reason: "rounding" | "manual_adjustment"
  ): Promise<void> {
    const invRef = doc(db, "inventory", inventoryId);
    
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(invRef);
      if (!snap.exists()) throw new Error("Inventory not found");
      
      const inv = snap.data() as Inventory;
      const currentAmount = type === 'raw' ? inv.remainingRawKg : inv.remainingPackedKg;
      
      if (newAmount === currentAmount) return; // No change
      
      const diff = currentAmount - newAmount; // Positive means we lost/removed stock (excess/shortage)
      
      // We only log if diff is positive (stock removed from inventory). If someone is adding back stock, we could log negative excess or skip. Let's log it all as excess.
      
      const newRaw = type === 'raw' ? newAmount : inv.remainingRawKg;
      const newPacked = type === 'packed' ? newAmount : inv.remainingPackedKg;
      
      const isExhausted = newRaw <= 0 && newPacked <= 0;
      const newStatus = isExhausted ? "exhausted" : (newRaw < inv.totalBoughtKg || newPacked < inv.totalDividedKg) ? "partial" : "in_stock";

      tx.update(invRef, {
        ...(type === 'raw' ? { remainingRawKg: newRaw } : { remainingPackedKg: newPacked }),
        status: newStatus,
        lastUpdated: serverTimestamp()
      });

      // Create an excess record
      const excessRef = doc(collection(db, "inventoryExcess"));
      const excessData: InventoryExcess = {
        excessId: excessRef.id,
        inventoryId: inv.inventoryId,
        dealId: inv.dealId,
        supplierId: inv.supplierId,
        supplierName: inv.supplierName,
        product: inv.product,
        type,
        amountKg: diff,
        reason,
        createdAt: serverTimestamp() as any
      };
      
      tx.set(excessRef, excessData);
    });
  },

  async deleteExcessRecord(excessId: string): Promise<void> {
    await deleteDoc(doc(db, "inventoryExcess", excessId));
  },

  async revertExcessRecord(excess: InventoryExcess): Promise<void> {
    const invRef = doc(db, "inventory", excess.inventoryId);
    const excessRef = doc(db, "inventoryExcess", excess.excessId);

    await runTransaction(db, async (tx) => {
      const invSnap = await tx.get(invRef);
      if (!invSnap.exists()) throw new Error("Inventory not found");

      const inv = invSnap.data() as Inventory;
      const restoredKg = excess.amountKg; // Add back the removed amount

      const newRaw = excess.type === 'raw' ? (inv.remainingRawKg || 0) + restoredKg : (inv.remainingRawKg || 0);
      const newPacked = excess.type === 'packed' ? (inv.remainingPackedKg || 0) + restoredKg : (inv.remainingPackedKg || 0);

      const isExhausted = newRaw <= 0 && newPacked <= 0;
      const newStatus = isExhausted ? "exhausted" : "partial";

      tx.update(invRef, {
        ...(excess.type === 'raw' ? { remainingRawKg: newRaw } : { remainingPackedKg: newPacked }),
        status: newStatus,
        lastUpdated: serverTimestamp()
      });

      tx.delete(excessRef);
    });
  }
};
