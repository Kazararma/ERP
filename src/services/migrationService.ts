import { collection, getDocs, writeBatch, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Deal } from "@/types/deal";
import { Inventory } from "@/types/inventory";
import { Order, OrderAllocation } from "@/types/order";
import { SupplierLedgerEntry } from "@/types/ledger";
import { BagSize } from "@/types/riceTypes";

export async function migrateStagingBatchesToBagDivisions(): Promise<{ migrated: number; errors: string[] }> {
  let migrated = 0;
  const errors: string[] = [];

  try {
    const dealsSnap = await getDocs(collection(db, "deals"));
    const batches: any[] = [];

    // Process deals one by one to avoid massive batch sizes
    for (const dealDoc of dealsSnap.docs) {
      const dealId = dealDoc.id;
      const stagingSnap = await getDocs(collection(db, "deals", dealId, "stagingBatches"));
      
      if (stagingSnap.empty) continue;

      const batch = writeBatch(db);

      for (const stagingDoc of stagingSnap.docs) {
        const data = stagingDoc.data();
        const divisionId = stagingDoc.id;
        
        let bagSize: BagSize = "50kg";
        if (data.bagSizeKg === 60) bagSize = "60kg";
        else if (data.bagSizeKg === 100) bagSize = "1quintal";
        else if (data.bagSizeKg === 1000) bagSize = "1tonne";

        const newDivision = {
          divisionId,
          bagSize,
          numberOfBags: data.numberOfBags || 0,
          availableBags: data.availableBags || 0,
          totalWeightKg: data.totalWeightKg || 0,
          divisionConfirmed: data.stagingConfirmed || false,
          divisionDate: data.stagingDate || data.createdAt || new Date(),
          status: data.status === "draft" ? "ready" : data.status,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          createdBy: data.createdBy || "system"
        };

        batch.set(doc(db, "deals", dealId, "bagDivisions", divisionId), newDivision);
        batch.delete(doc(db, "deals", dealId, "stagingBatches", divisionId));
        migrated++;
      }

      // Update inventory
      const invRef = doc(db, "inventory", dealId);
      const invSnap = await getDoc(invRef);
      if (invSnap.exists()) {
        const invData = invSnap.data() as any;
        const newBreakdown = (invData.stagingBreakdown || []).map((sb: any) => {
          let bs: BagSize = "50kg";
          if (sb.bagSizeKg === 60) bs = "60kg";
          else if (sb.bagSizeKg === 100) bs = "1quintal";
          else if (sb.bagSizeKg === 1000) bs = "1tonne";
          return {
            divisionId: sb.batchId || sb.divisionId,
            bagSize: bs,
            numberOfBags: sb.numberOfBags,
            availableBags: sb.availableBags
          };
        });

        batch.update(invRef, {
          totalDividedKg: invData.totalStagedKg || 0,
          remainingPackedKg: invData.remainingStagedKg || 0,
          divisionBreakdown: newBreakdown,
          // remove old fields
          totalStagedKg: null as any,
          remainingStagedKg: null as any,
          stagingBreakdown: null as any
        });
      }

      await batch.commit();
    }
  } catch (error: any) {
    errors.push(error.message);
  }

  return { migrated, errors };
}

export async function backfillSupplierLedgerEntries(): Promise<{ written: number; errors: string[] }> {
  let written = 0;
  const errors: string[] = [];
  
  try {
    const batch = writeBatch(db);
    
    // 1. Purchase Created
    const dealsSnap = await getDocs(collection(db, "deals"));
    for (const dealDoc of dealsSnap.docs) {
      const deal = dealDoc.data() as Deal;
      if (!deal.product) continue; // skip unmigrated deals

      const entryId1 = doc(collection(db, "supplierLedgerEntries")).id;
      batch.set(doc(db, "supplierLedgerEntries", entryId1), {
        entryId: entryId1,
        supplierId: deal.supplierId,
        supplierName: deal.supplierName,
        dealId: deal.dealId,
        eventType: "purchase_created",
        eventDate: deal.createdAt,
        product: deal.product,
        amountKg: deal.totalAmountKg,
        pricePerKg: deal.pricePerKg,
        totalValue: deal.totalCost,
        createdAt: deal.createdAt || new Date(),
        createdBy: deal.createdBy || "system"
      } as Partial<SupplierLedgerEntry>);
      written++;

      if (deal.deliveryConfirmed) {
        const entryId2 = doc(collection(db, "supplierLedgerEntries")).id;
        batch.set(doc(db, "supplierLedgerEntries", entryId2), {
          entryId: entryId2,
          supplierId: deal.supplierId,
          supplierName: deal.supplierName,
          dealId: deal.dealId,
          eventType: "delivery_confirmed",
          eventDate: deal.updatedAt,
          product: deal.product,
          createdAt: deal.updatedAt || new Date(),
          createdBy: deal.createdBy || "system"
        } as Partial<SupplierLedgerEntry>);
        written++;
      }

      // Divisions
      const divSnap = await getDocs(collection(db, "deals", deal.dealId, "bagDivisions"));
      for (const divDoc of divSnap.docs) {
        const div = divDoc.data() as any;
        const entryId3 = doc(collection(db, "supplierLedgerEntries")).id;
        batch.set(doc(db, "supplierLedgerEntries", entryId3), {
          entryId: entryId3,
          supplierId: deal.supplierId,
          supplierName: deal.supplierName,
          dealId: deal.dealId,
          eventType: "bags_divided",
          eventDate: div.divisionDate,
          product: deal.product,
          bagSize: div.bagSize,
          numberOfBags: div.numberOfBags,
          createdAt: div.createdAt || new Date(),
          createdBy: div.createdBy || "system"
        } as Partial<SupplierLedgerEntry>);
        written++;
      }
    }

    // 4. Sold allocations
    const ordersSnap = await getDocs(collection(db, "orders"));
    
    // Build deal lookup map for missing supplier IDs in legacy allocations
    const dealMap = new Map<string, {supplierId: string, supplierName: string}>();
    for (const dealDoc of dealsSnap.docs) {
      const deal = dealDoc.data() as Deal;
      dealMap.set(deal.dealId || dealDoc.id, { supplierId: deal.supplierId, supplierName: deal.supplierName });
    }

    for (const orderDoc of ordersSnap.docs) {
      const order = orderDoc.data() as Order;
      if (order.status !== "confirmed" && order.status !== "delivered") continue;

      const allocSnap = await getDocs(collection(db, "orders", order.orderId, "allocations"));
      for (const allocDoc of allocSnap.docs) {
        const alloc = allocDoc.data() as any;
        const entryId4 = doc(collection(db, "supplierLedgerEntries")).id;
        
        const dealInfo = dealMap.get(alloc.dealId);
        const supplierId = alloc.supplierId || dealInfo?.supplierId || "legacy_unknown";
        const supplierName = alloc.supplierName || dealInfo?.supplierName || "Legacy Supplier";

        batch.set(doc(db, "supplierLedgerEntries", entryId4), {
          entryId: entryId4,
          supplierId: supplierId,
          supplierName: supplierName,
          dealId: alloc.dealId || "unknown",
          eventType: "allocation_deducted",
          eventDate: order.confirmedAt || order.createdAt,
          product: alloc.product || { productCode: "LEGACY", productName: "Legacy", riceTypeId: "legacy", riceTypeCode: "legacy", riceTypeName: "Legacy" },
          bagSize: alloc.bagSize || "50kg",
          numberOfBags: alloc.numberOfBags || 0,
          totalWeightKg: alloc.weightKg || alloc.totalWeightKg || 0,
          relatedOrderId: order.orderId || orderDoc.id,
          customerName: order.customerName || "Unknown",
          revenueFromSale: (alloc.weightKg || alloc.totalWeightKg || 0) * (order.sellingPricePerKg || 0),
          createdAt: order.confirmedAt || order.createdAt || new Date(),
          createdBy: order.createdBy || "system"
        } as Partial<SupplierLedgerEntry>);
        written++;
      }
    }

    if (written > 0 && written <= 500) {
      await batch.commit();
    } else if (written > 500) {
       errors.push("Too many documents for a single batch (max 500). Please implement chunked batching for a large database.");
    }
  } catch (error: any) {
    errors.push(error.message);
  }

  return { written, errors };
}

export async function patchInventoryOverwrites(): Promise<{ patched: number; errors: string[] }> {
  let patched = 0;
  const errors: string[] = [];
  try {
    const dealsSnap = await getDocs(collection(db, "deals"));
    const batch = writeBatch(db);

    for (const dealDoc of dealsSnap.docs) {
      const dealId = dealDoc.id;
      
      const invRef = doc(db, "inventory", dealId);
      const invSnap = await getDoc(invRef);
      if (!invSnap.exists()) continue;
      
      const invData = invSnap.data() as Inventory;
      
      const divSnap = await getDocs(collection(db, "deals", dealId, "bagDivisions"));
      if (divSnap.empty) continue;
      
      let newTotalDividedKg = 0;
      const newBreakdown: any[] = [];
      
      for (const divDoc of divSnap.docs) {
        const div = divDoc.data() as any;
        if (div.status === "ready" || div.divisionConfirmed) {
          newTotalDividedKg += div.totalWeightKg;
          newBreakdown.push({
            divisionId: divDoc.id,
            bagSize: div.bagSize,
            numberOfBags: div.numberOfBags,
            availableBags: div.availableBags,
          });
        }
      }
      
      if (newTotalDividedKg !== invData.totalDividedKg || newBreakdown.length !== (invData.divisionBreakdown?.length || 0)) {
        batch.update(invRef, {
          totalDividedKg: newTotalDividedKg,
          remainingRawKg: (invData.totalBoughtKg || 0) - newTotalDividedKg,
          remainingPackedKg: newTotalDividedKg - (invData.totalSoldKg || 0),
          divisionBreakdown: newBreakdown,
        });
        patched++;
      }
    }
    
    if (patched > 0) {
      await batch.commit();
    }
  } catch (error: any) {
    errors.push(error.message);
  }
  return { patched, errors };
}

export async function clearCollection(collectionName: string): Promise<{ deleted: number; errors: string[] }> {
  let deleted = 0;
  const errors: string[] = [];
  try {
    const snap = await getDocs(collection(db, collectionName));
    const batch = writeBatch(db);
    
    // Max batch size is 500, so we just process up to 500 for a simple clear script
    // If there are more, the user can click it multiple times.
    let count = 0;
    for (const d of snap.docs) {
      if (count >= 500) break;
      batch.delete(doc(db, collectionName, d.id));
      count++;
      deleted++;
    }
    
    if (count > 0) {
      await batch.commit();
    }
  } catch (error: any) {
    errors.push(error.message);
  }
  return { deleted, errors };
}
