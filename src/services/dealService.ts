import {
  collection, doc, getDocs, setDoc, serverTimestamp, query, orderBy, runTransaction, onSnapshot, Timestamp, writeBatch, getDoc, where, increment
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Deal, BagDivision } from "@/types/deal";
import { BagSize, BAG_WEIGHT_KG, Product } from "@/types/riceTypes";
import { SupplierLedgerEntry } from "@/types/ledger";
import { Inventory } from "@/types/inventory";

const DEALS_COLLECTION = "deals";
const INVENTORY_COLLECTION = "inventory";

export const dealService = {
  async getAllDeals(): Promise<Deal[]> {
    const q = query(collection(db, DEALS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Deal);
  },

  async createDeal(data: Omit<Deal, "dealId" | "createdAt" | "updatedAt" | "deliveryConfirmed" | "deliveryDate" | "status" | "remainingAmountKg" | "totalCost" | "grossCost" | "discount"> & { discountEnabled?: boolean, discountKg?: number, discountRatePerKg?: number }): Promise<Deal> {
    // 1. No product code validation required anymore

    const docRef = doc(collection(db, DEALS_COLLECTION));
    const dealId = docRef.id;
    const now = serverTimestamp() as Timestamp;
    const grossAmountKg = data.totalAmountKg;
    const netAmountKg = grossAmountKg - (data.weightDeductionKg || 0);
    const grossCost = netAmountKg * data.pricePerKg;
    const hasDiscount = data.discountEnabled && (data.discountKg || 0) > 0;
    const discountValue = hasDiscount ? (data.discountKg || 0) * (data.discountRatePerKg || 0) : 0;
    const netTotalCost = grossCost - discountValue;
    const netStockKg = netAmountKg;

    const newDeal: Deal = {
      ...data,
      dealId,
      grossAmountKg,
      weightDeductionKg: data.weightDeductionKg || 0,
      totalAmountKg: netStockKg,
      remainingAmountKg: netStockKg,
      totalCost: netTotalCost,
      grossCost: grossCost,
      discount: hasDiscount
        ? { discountKg: data.discountKg!, discountRatePerKg: data.discountRatePerKg!, discountValue }
        : null,
      deliveryConfirmed: false,
      deliveryDate: null,
      status: "pending_delivery",
      createdAt: now,
      updatedAt: now,
    };
    
    // Remove transient fields before saving
    delete (newDeal as any).discountEnabled;
    delete (newDeal as any).discountKg;
    delete (newDeal as any).discountRatePerKg;

    const batch = writeBatch(db);

    // 2. Write Deal
    batch.set(docRef, newDeal);

    // 3. Write Inventory
    const inventoryRef = doc(db, INVENTORY_COLLECTION, dealId);
    const newInventory: Inventory = {
      inventoryId: dealId,
      dealId: dealId,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      product: data.product,
      totalBoughtKg: netStockKg,
      totalDividedKg: 0,
      totalSoldKg: 0,
      remainingRawKg: netStockKg,
      remainingPackedKg: 0,
      divisionBreakdown: [],
      lastUpdated: now,
      status: "in_stock",
    };
    batch.set(inventoryRef, newInventory);

    const ledgerRef = doc(collection(db, "supplierLedgerEntries"));
    const ledgerEntry: Partial<SupplierLedgerEntry> & { discountKg?: number, discountValue?: number } = {
      entryId: ledgerRef.id,
      supplierId: newDeal.supplierId,
      supplierName: newDeal.supplierName,
      dealId: newDeal.dealId,
      eventType: "purchase_created",
      eventDate: now,
      product: newDeal.product,
      amountKg: netStockKg,
      pricePerKg: newDeal.pricePerKg,
      totalValue: netTotalCost,
      discountKg: hasDiscount ? data.discountKg : 0,
      discountValue: discountValue,
      createdAt: now,
      createdBy: newDeal.createdBy,
    };
    batch.set(ledgerRef, ledgerEntry);

    await batch.commit();
    return newDeal;
  },

  async confirmDelivery(dealId: string): Promise<void> {
    const dealRef = doc(db, DEALS_COLLECTION, dealId);
    
    const dealSnap = await getDoc(dealRef);
    if (!dealSnap.exists()) throw new Error("Deal does not exist!");
    const dealData = dealSnap.data() as Deal;

    const profileSnap = await getDocs(query(collection(db, "ledgerProfiles"), where("entityId", "==", dealData.supplierId)));
    if (profileSnap.empty) throw new Error("Ledger profile not found for supplier");
    const profileId = profileSnap.docs[0].id;

    await runTransaction(db, async (transaction) => {
      const dealDoc = await transaction.get(dealRef);
      if (!dealDoc.exists()) throw new Error("Deal does not exist!");

      const currentDeal = dealDoc.data() as Deal;
      if (currentDeal.deliveryConfirmed) throw new Error("Delivery already confirmed!");

      applyDeliveryConfirmation(transaction, dealDoc, profileId);
    });
  },

  async convertAllPendingDeliveries(): Promise<{ confirmedCount: number }> {
    const pendingQuery = query(
      collection(db, "deals"),
      where("status", "==", "pending_delivery")
    );
    const pendingSnap = await getDocs(pendingQuery);

    if (pendingSnap.empty) {
      return { confirmedCount: 0 };
    }

    const profilesSnap = await getDocs(query(collection(db, "ledgerProfiles"), where("entityType", "==", "supplier")));
    const supplierToProfileMap = new Map<string, string>();
    profilesSnap.docs.forEach(d => {
      supplierToProfileMap.set(d.data().entityId, d.id);
    });

    const CHUNK_SIZE = 150;
    const dealIds = pendingSnap.docs.map((d) => d.id);
    let confirmedCount = 0;

    for (let i = 0; i < dealIds.length; i += CHUNK_SIZE) {
      const chunk = dealIds.slice(i, i + CHUNK_SIZE);
      await runTransaction(db, async (transaction) => {
        // ── ALL READS FIRST ──
        const dealRefs = chunk.map((id) => doc(db, "deals", id));
        const dealSnaps = await Promise.all(dealRefs.map((ref) => transaction.get(ref)));

        // ── COMPUTE + WRITES ──
        for (const dealSnap of dealSnaps) {
          if (!dealSnap.exists()) continue;
          const currentDeal = dealSnap.data() as Deal;
          if (currentDeal.deliveryConfirmed) continue;
          
          const profileId = supplierToProfileMap.get(currentDeal.supplierId);
          if (!profileId) continue;

          applyDeliveryConfirmation(transaction, dealSnap, profileId);
          confirmedCount += 1;
        }
      });
    }

    return { confirmedCount };
  },

  /**
   * Atomically deletes a deal and ALL associated records:
   *  - inventory/{dealId}
   *  - supplierLedgerEntries where dealId == dealId
   *  - ledgerProfiles/{profileId}/entries where relatedDocId == dealId
   *  - deals/{dealId}/bagDivisions/* (all bag division subcollection docs)
   *  - deals/{dealId} (the deal itself)
   *
   * Also reverses the LedgerProfile aggregate (totalDebit / closingBalance).
   *
   * Throws if any bags from this deal have already been used in a confirmed order.
   */
  async deleteDeal(dealId: string): Promise<void> {
    const dealRef = doc(db, DEALS_COLLECTION, dealId);

    // ── Pre-fetch outside transaction ──────────────────────────────────────────

    // 1. Read the deal
    const dealSnap = await getDoc(dealRef);
    if (!dealSnap.exists()) throw new Error("Deal not found.");
    const dealData = dealSnap.data() as Deal;

    // 2. All bag divisions for this deal
    const divisionsSnap = await getDocs(collection(db, "deals", dealId, "bagDivisions"));


    // 3. supplierLedgerEntries (flat collection) linked to this deal
    const supplierLedgerSnap = await getDocs(
      query(collection(db, "supplierLedgerEntries"), where("dealId", "==", dealId))
    );

    // 4. Find the ledger profile for this supplier (may not exist if never confirmed)
    const profileSnap = await getDocs(
      query(collection(db, "ledgerProfiles"), where("entityId", "==", dealData.supplierId))
    );
    const profileId = profileSnap.empty ? null : profileSnap.docs[0].id;

    // 5. Profile-level ledger entries linked to this deal (delivery_confirmed, bags_divided, etc.)
    let profileEntriesSnap: any = null;
    if (profileId) {
      profileEntriesSnap = await getDocs(
        query(
          collection(db, `ledgerProfiles/${profileId}/entries`),
          where("relatedDocId", "==", dealId)
        )
      );
    }

    // ── Transaction ────────────────────────────────────────────────────────────
    await runTransaction(db, async (transaction) => {
      // Re-read deal inside transaction for consistency
      const dealDoc = await transaction.get(dealRef);
      if (!dealDoc.exists()) throw new Error("Deal not found.");

      // Re-read each division inside transaction and check if any bags were sold
      for (const divDoc of divisionsSnap.docs) {
        const freshDiv = await transaction.get(divDoc.ref);
        if (!freshDiv.exists()) continue;
        const div = freshDiv.data() as BagDivision;
        if (div.availableBags < div.numberOfBags) {
          throw new Error(
            `Cannot delete this deal — ${div.numberOfBags - div.availableBags} bag(s) of ${div.bagSize}kg size have already been sold in a confirmed order. Please delete that customer order first.`
          );
        }
      }

      const now = serverTimestamp() as Timestamp;

      // ── Reverse profile aggregate ─────────────────────────────────────────
      if (profileId && profileEntriesSnap && !profileEntriesSnap.empty) {
        let sumDebit = 0;
        let sumCredit = 0;
        profileEntriesSnap.docs.forEach((e: any) => {
          const data = e.data();
          sumDebit += data.debit ?? 0;
          sumCredit += data.credit ?? 0;
        });

        if (sumDebit !== 0 || sumCredit !== 0) {
          const profileRef = doc(db, "ledgerProfiles", profileId);
          transaction.update(profileRef, {
            totalDebit: increment(-sumDebit),
            totalCredit: increment(-sumCredit),
            closingBalance: increment(-(sumDebit - sumCredit)),
            updatedAt: now,
          });
        }

        // Delete all profile ledger entries for this deal
        for (const entryDoc of profileEntriesSnap.docs) {
          transaction.delete(entryDoc.ref);
        }
      }

      // ── Delete supplierLedgerEntries ──────────────────────────────────────
      for (const entryDoc of supplierLedgerSnap.docs) {
        transaction.delete(entryDoc.ref);
      }

      // ── Delete all bag divisions ──────────────────────────────────────────
      for (const divDoc of divisionsSnap.docs) {
        transaction.delete(divDoc.ref);
      }

      // ── Delete inventory record ───────────────────────────────────────────
      const inventoryRef = doc(db, INVENTORY_COLLECTION, dealId);
      transaction.delete(inventoryRef);

      // ── Delete the deal itself ────────────────────────────────────────────
      transaction.delete(dealRef);
    });
  },
};

// ─── BAG DIVISION FUNCTIONS ──────────────────────────────────────────────────

export async function createBagDivisions(
  dealId: string,
  entries: { bagSize: BagSize; numberOfBags: number }[]
): Promise<BagDivision[]> {
  const batch = writeBatch(db);
  const now = serverTimestamp() as Timestamp;
  const created: BagDivision[] = [];

  for (const entry of entries) {
    const ref = doc(collection(db, "deals", dealId, "bagDivisions"));
    const bagWeightKg = BAG_WEIGHT_KG[entry.bagSize];
    const division: BagDivision = {
      divisionId: ref.id,
      dealId,
      bagSize: entry.bagSize,
      bagWeightKg,
      numberOfBags: entry.numberOfBags,
      totalWeightKg: entry.numberOfBags * bagWeightKg,
      availableBags: entry.numberOfBags,
      divisionConfirmed: false,
      divisionDate: null,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    batch.set(ref, division);
    created.push(division);
  }

  await batch.commit();
  return created;
}

export async function confirmBagDivisions(
  dealId: string,
  divisionIds: string[]
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const dealRef = doc(db, "deals", dealId);
    const dealSnap = await tx.get(dealRef);
    if (!dealSnap.exists()) throw new Error("Deal not found");
    const deal = dealSnap.data() as Deal;

    const inventoryRef = doc(db, "inventory", dealId);
    const inventorySnap = await tx.get(inventoryRef);
    if (!inventorySnap.exists()) throw new Error("Inventory record not found for deal");

    const divisionSnaps = await Promise.all(
      divisionIds.map((id) => tx.get(doc(db, "deals", dealId, "bagDivisions", id)))
    );
    const divisions = divisionSnaps.map((s) => s.data() as BagDivision);

    const totalNewWeight = divisions.reduce((sum, d) => sum + d.totalWeightKg, 0);
    if (deal.remainingAmountKg < totalNewWeight) {
      throw new Error(
        `Insufficient raw stock. Remaining: ${deal.remainingAmountKg} kg, requested: ${totalNewWeight} kg`
      );
    }

    const now = serverTimestamp() as Timestamp;
    const inventory = inventorySnap.data() as Inventory;

    const newRemainingAmountKg = deal.remainingAmountKg - totalNewWeight;

    tx.update(dealRef, {
      remainingAmountKg: newRemainingAmountKg,
      status: newRemainingAmountKg === 0 ? "completed" : "dividing",
      updatedAt: now,
    });

    let newTotalDividedKg = inventory.totalDividedKg ?? 0;
    let newRemainingPackedKg = inventory.remainingPackedKg ?? 0;
    let newRemainingRawKg = inventory.remainingRawKg ?? 0;
    const breakdown = inventory.divisionBreakdown ? [...inventory.divisionBreakdown] : [];

    for (const division of divisions) {
      const divRef = doc(db, "deals", dealId, "bagDivisions", division.divisionId);
      tx.update(divRef, {
        divisionConfirmed: true,
        divisionDate: now,
        status: "ready",
        updatedAt: now,
      });

      breakdown.push({
        divisionId: division.divisionId,
        bagSize: division.bagSize,
        numberOfBags: division.numberOfBags,
        availableBags: division.numberOfBags,
      });
      
      newTotalDividedKg += division.totalWeightKg;
      newRemainingPackedKg += division.totalWeightKg;
      newRemainingRawKg -= division.totalWeightKg;
    }

    tx.update(inventoryRef, {
      totalDividedKg: newTotalDividedKg,
      remainingPackedKg: newRemainingPackedKg,
      remainingRawKg: newRemainingRawKg,
      divisionBreakdown: breakdown,
      lastUpdated: now,
    });
  });
}

export async function deleteBagDivision(dealId: string, divisionId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const divRef = doc(db, "deals", dealId, "bagDivisions", divisionId);
    const divSnap = await tx.get(divRef);
    if (!divSnap.exists()) throw new Error("Division not found");
    const division = divSnap.data() as BagDivision;

    // Check if any bags were sold
    if (division.availableBags < division.numberOfBags) {
      throw new Error("Cannot delete division because some bags have already been sold!");
    }

    const dealRef = doc(db, "deals", dealId);
    const dealSnap = await tx.get(dealRef);
    const deal = dealSnap.data() as Deal;

    const inventoryRef = doc(db, "inventory", dealId);
    const inventorySnap = await tx.get(inventoryRef);
    const inventory = inventorySnap.data() as Inventory;

    const now = serverTimestamp() as Timestamp;

    // 1. Update Deal
    const newRemainingAmountKg = deal.remainingAmountKg + division.totalWeightKg;
    tx.update(dealRef, {
      remainingAmountKg: newRemainingAmountKg,
      status: newRemainingAmountKg === deal.totalAmountKg ? "delivered" : "dividing",
      updatedAt: now,
    });

    // 2. Update Inventory
    const breakdown = (inventory.divisionBreakdown || []).filter(b => b.divisionId !== divisionId);
    tx.update(inventoryRef, {
      totalDividedKg: (inventory.totalDividedKg ?? 0) - division.totalWeightKg,
      remainingPackedKg: (inventory.remainingPackedKg ?? 0) - division.totalWeightKg,
      remainingRawKg: (inventory.remainingRawKg ?? 0) + division.totalWeightKg,
      divisionBreakdown: breakdown,
      lastUpdated: now,
    });

    // 3. Delete the division
    tx.delete(divRef);
  });
}

export function subscribeToBagDivisions(
  dealId: string,
  callback: (divisions: BagDivision[]) => void
): () => void {
  const q = query(
    collection(db, "deals", dealId, "bagDivisions"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as BagDivision));
  });
}

function applyDeliveryConfirmation(
  transaction: any,
  dealSnap: any,
  profileId: string
) {
  const currentDeal = dealSnap.data() as Deal;
  const dealRef = dealSnap.ref;

  // Update Deal
  transaction.update(dealRef, {
    deliveryConfirmed: true,
    deliveryDate: serverTimestamp(),
    status: "delivered",
    updatedAt: serverTimestamp(),
  });

  const entryRef = doc(collection(db, `ledgerProfiles/${profileId}/entries`));
  transaction.set(entryRef, {
    id: entryRef.id,
    profileId,
    entityId: currentDeal.supplierId,
    entityType: "supplier",
    date: currentDeal.purchaseDate || serverTimestamp(),
    particulars: currentDeal.discount 
      ? `Purchase — ${currentDeal.product?.riceTypeName || "Rice"} (Net of Discount)${currentDeal.notes ? ` - ${currentDeal.notes}` : ""}`
      : `Purchase — ${currentDeal.product?.riceTypeName || "Rice"}${currentDeal.notes ? ` - ${currentDeal.notes}` : ""}`,
    subParticulars: currentDeal.discount
      ? `${currentDeal.totalAmountKg} kg @ ₹${currentDeal.pricePerKg}/kg${(currentDeal.weightDeductionKg || 0) > 0 ? ` | Ded: ${currentDeal.weightDeductionKg} kg` : ""} | Discount: ${currentDeal.discount.discountKg} kg @ ₹${currentDeal.discount.discountRatePerKg}/kg (-₹${currentDeal.discount.discountValue.toFixed(2)})`
      : `${currentDeal.totalAmountKg} kg @ ₹${currentDeal.pricePerKg}/kg${(currentDeal.weightDeductionKg || 0) > 0 ? ` | Ded: ${currentDeal.weightDeductionKg} kg` : ""}`,
    refLabel: `Code: ${currentDeal.product.productCode}`,
    vchType: "Purchase",
    vchNo: Math.floor(Math.random() * 1000000) || 1,
    debit: currentDeal.totalCost,
    credit: 0,
    entryType: "delivery_confirmed",
    isManual: false,
    isSystemGenerated: true,
    relatedDocId: dealSnap.id,
    quantityKg: currentDeal.totalAmountKg,
    pricePerUnit: currentDeal.pricePerKg,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const profileRef = doc(db, "ledgerProfiles", profileId);
  transaction.update(profileRef, {
    totalDebit: increment(currentDeal.totalCost),
    closingBalance: increment(currentDeal.totalCost),
    updatedAt: serverTimestamp(),
  });
}
