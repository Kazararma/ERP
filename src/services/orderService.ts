import { collection, doc, setDoc, getDoc, getDocs, writeBatch, serverTimestamp, runTransaction, Timestamp, query, where, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, OrderAllocation } from "@/types/order";
import { Inventory, InventoryDivisionSnapshot } from "@/types/inventory";
import { BagDivision } from "@/types/deal";
import { SupplierLedgerEntry } from "@/types/ledger";

export const orderService = {
  async getAllOrders(): Promise<Order[]> {
    const snap = await getDocs(collection(db, "orders"));
    return snap.docs.map(d => d.data() as Order).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
  },

  async createOrderWithAllocations(orderData: Partial<Order>, allocations: Partial<OrderAllocation>[]) {
    const orderId = doc(collection(db, "orders")).id;
    const orderRef = doc(db, "orders", orderId);
    
    const batch = writeBatch(db);
    const now = serverTimestamp() as Timestamp;

    const newOrder: Partial<Order> = {
      ...orderData,
      orderId,
      orderConfirmed: false,
      confirmedAt: null,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };

    batch.set(orderRef, newOrder);

    let totalCostOfGoods = 0;
    let totalRevenue = 0;

    allocations.forEach(alloc => {
      const allocId = doc(collection(db, "orders", orderId, "allocations")).id;
      const allocRef = doc(db, "orders", orderId, "allocations", allocId);
      
      const revenue = (alloc.weightKg || 0) * (alloc.sellingPricePerKg || 0);
      const profit = revenue - (alloc.totalCost || 0);

      const newAlloc: Partial<OrderAllocation> = {
        ...alloc,
        allocationId: allocId,
        revenue,
        profit,
        createdAt: now,
      };
      
      totalCostOfGoods += (alloc.totalCost || 0);
      totalRevenue += revenue;
      batch.set(allocRef, newAlloc);
    });

    // Update order with calculated revenue, cost, and profit
    const profit = totalRevenue - totalCostOfGoods;
    batch.update(orderRef, {
      totalRevenue,
      totalCostOfGoods,
      profit
    });

    await batch.commit();
    return orderId;
  },

  async confirmOrder(orderId: string) {
    const orderRef = doc(db, "orders", orderId);
    
    const orderDocSnap = await getDoc(orderRef);
    if (!orderDocSnap.exists()) throw new Error("Order not found");
    const preOrderData = orderDocSnap.data() as Order;

    const profileSnap = await getDocs(query(collection(db, "ledgerProfiles"), where("entityId", "==", preOrderData.customerId)));
    if (profileSnap.empty) throw new Error("Ledger profile not found for customer");
    const profileId = profileSnap.docs[0].id;

    await runTransaction(db, async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists()) throw new Error("Order not found");
      
      const orderData = orderDoc.data() as Order;
      if (orderData.orderConfirmed) throw new Error("Order already confirmed");

      // Fetch allocations
      const allocSnap = await getDocs(collection(db, "orders", orderId, "allocations"));
      const allocations = allocSnap.docs.map(d => d.data() as OrderAllocation);

      // --- ALL READS ---
      // 1. Read all divisions
      const divisionDocs = new Map<string, any>();
      for (const alloc of allocations) {
        if (!divisionDocs.has(alloc.divisionId)) {
          const divRef = doc(db, "deals", alloc.dealId, "bagDivisions", alloc.divisionId);
          const dDoc = await transaction.get(divRef);
          if (!dDoc.exists()) throw new Error(`Division ${alloc.divisionId} missing`);
          divisionDocs.set(alloc.divisionId, dDoc);
        }
      }

      // 2. Read all inventories
      const invDocs = new Map<string, any>();
      for (const alloc of allocations) {
        if (!invDocs.has(alloc.dealId)) {
          const invRef = doc(db, "inventory", alloc.dealId);
          const iDoc = await transaction.get(invRef);
          if (!iDoc.exists()) throw new Error(`Inventory for deal ${alloc.dealId} missing`);
          invDocs.set(alloc.dealId, iDoc);
        }
      }

      // --- COMPUTE AND VALIDATE ---
      const divisionUpdates = new Map<string, { ref: any; newAvailable: number; status: string }>();
      const inventoryUpdates = new Map<string, { ref: any; data: Inventory; newBreakdown: InventoryDivisionSnapshot[] }>();

      for (const alloc of allocations) {
        const divDoc = divisionDocs.get(alloc.divisionId)!;
        const divData = divDoc.data() as BagDivision;
        const currentAvailable = divisionUpdates.has(alloc.divisionId) ? divisionUpdates.get(alloc.divisionId)!.newAvailable : divData.availableBags;
        
        if (currentAvailable < alloc.numberOfBags) {
          throw new Error(`Not enough bags in division ${alloc.divisionId}`);
        }

        const newAvailable = currentAvailable - alloc.numberOfBags;
        divisionUpdates.set(alloc.divisionId, {
          ref: divDoc.ref,
          newAvailable,
          status: newAvailable === 0 ? "exhausted" : "partial"
        });

        const dealId = alloc.dealId;
        const invDoc = invDocs.get(dealId)!;
        let invUpdate = inventoryUpdates.get(dealId);
        if (!invUpdate) {
          invUpdate = {
            ref: invDoc.ref,
            data: { ...invDoc.data() } as Inventory,
            newBreakdown: [ ...((invDoc.data() as Inventory).divisionBreakdown || []) ]
          };
          inventoryUpdates.set(dealId, invUpdate);
        }

        invUpdate.data.remainingPackedKg -= alloc.weightKg;
        invUpdate.data.totalSoldKg += alloc.weightKg;

        const breakdownIndex = invUpdate.newBreakdown.findIndex(b => b.divisionId === alloc.divisionId);
        if (breakdownIndex >= 0) {
           invUpdate.newBreakdown[breakdownIndex].availableBags -= alloc.numberOfBags;
        }
      }

      const now = serverTimestamp() as Timestamp;

      // --- ALL WRITES ---
      for (const update of Array.from(divisionUpdates.values())) {
        transaction.update(update.ref, {
          availableBags: update.newAvailable,
          status: update.status,
          updatedAt: now
        });
      }

      for (const [dealId, update] of Array.from(inventoryUpdates.entries())) {
        transaction.update(update.ref, {
          remainingPackedKg: update.data.remainingPackedKg,
          totalSoldKg: update.data.totalSoldKg,
          divisionBreakdown: update.newBreakdown,
          lastUpdated: now
        });
      }

      // Finally update order
      transaction.update(orderRef, {
        orderConfirmed: true,
        confirmedAt: now,
        status: "confirmed",
        updatedAt: now
      });

      // Ledger entries
      const uniqueProductNames = Array.from(new Set(allocations.map(a => a.product?.riceTypeName || "Rice")));
      const uniqueProductCodes = Array.from(new Set(allocations.map(a => a.product?.productCode).filter(Boolean)));
      
      const productLabel = uniqueProductNames.join(", ");
      const codeLabel = uniqueProductCodes.length > 0 ? `Code: ${uniqueProductCodes.join(", ")}` : `Order ${orderId}`;
      const avgPrice = orderData.totalWeightKg > 0 ? (orderData.totalRevenue / orderData.totalWeightKg) : 0;

      const entryRef = doc(collection(db, `ledgerProfiles/${profileId}/entries`));
      transaction.set(entryRef, {
        id: entryRef.id,
        profileId,
        entityId: orderData.customerId,
        entityType: "customer",
        date: orderData.createdAt || now,
        particulars: `Sale of ${productLabel}`,
        subParticulars: `${orderData.totalWeightKg} kg @ ₹${avgPrice}/kg`,
        refLabel: codeLabel,
        vchType: "Sale",
        vchNo: Math.floor(Math.random() * 1000000) || 1,
        debit: 0,
        credit: orderData.totalRevenue,
        entryType: "order_confirmed",
        isManual: false,
        isSystemGenerated: true,
        relatedDocId: orderId,
        quantityKg: orderData.totalWeightKg,
        createdAt: now,
        updatedAt: now,
      });

      const profileRef = doc(db, "ledgerProfiles", profileId);
      transaction.update(profileRef, {
        totalCredit: increment(orderData.totalRevenue),
        closingBalance: increment(-orderData.totalRevenue),
        updatedAt: now,
      });
    });
  },

  async deleteOrder(orderId: string): Promise<void> {
    const orderRef = doc(db, "orders", orderId);
    
    // Pre-fetch dependent documents that we want to delete to avoid complex query-inside-transaction rules
    const allocSnap = await getDocs(collection(db, "orders", orderId, "allocations"));
    const allocations = allocSnap.docs.map(d => d.data() as OrderAllocation);
    
    const orderDocSnap = await getDoc(orderRef);
    if (!orderDocSnap.exists()) throw new Error("Order not found");
    const preOrderData = orderDocSnap.data() as Order;

    let profileId: string | null = null;
    let ledgerEntryRef: any = null;

    if (preOrderData.orderConfirmed) {
      const profileSnap = await getDocs(query(collection(db, "ledgerProfiles"), where("entityId", "==", preOrderData.customerId)));
      if (!profileSnap.empty) {
        profileId = profileSnap.docs[0].id;
        const entriesSnap = await getDocs(query(collection(db, `ledgerProfiles/${profileId}/entries`), where("relatedDocId", "==", orderId)));
        if (!entriesSnap.empty) {
          ledgerEntryRef = entriesSnap.docs[0].ref;
        }
      }
    }
    
    await runTransaction(db, async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists()) throw new Error("Order not found");
      const orderData = orderDoc.data() as Order;
      
      const divisionUpdates = new Map<string, { ref: any; newAvailable: number; status: string }>();
      const inventoryUpdates = new Map<string, { ref: any; data: Inventory; newBreakdown: InventoryDivisionSnapshot[] }>();

      // If the order was confirmed, we need to revert the inventory deduction and bag division allocations
      if (orderData.orderConfirmed) {
        // --- READS ---
        const divisionDocs = new Map<string, any>();
        for (const alloc of allocations) {
          if (!divisionDocs.has(alloc.divisionId)) {
            const divRef = doc(db, "deals", alloc.dealId, "bagDivisions", alloc.divisionId);
            const dDoc = await transaction.get(divRef);
            if (!dDoc.exists()) throw new Error(`Division ${alloc.divisionId} missing`);
            divisionDocs.set(alloc.divisionId, dDoc);
          }
        }
        
        const invDocs = new Map<string, any>();
        for (const alloc of allocations) {
          if (!invDocs.has(alloc.dealId)) {
            const invRef = doc(db, "inventory", alloc.dealId);
            const iDoc = await transaction.get(invRef);
            if (!iDoc.exists()) throw new Error(`Inventory for deal ${alloc.dealId} missing`);
            invDocs.set(alloc.dealId, iDoc);
          }
        }

        // --- COMPUTE REVERSAL ---
        for (const alloc of allocations) {
          const divDoc = divisionDocs.get(alloc.divisionId)!;
          const divData = divDoc.data() as BagDivision;
          const currentAvailable = divisionUpdates.has(alloc.divisionId) ? divisionUpdates.get(alloc.divisionId)!.newAvailable : divData.availableBags;
          
          const newAvailable = currentAvailable + alloc.numberOfBags;
          const status = newAvailable === divData.numberOfBags ? "ready" : "partial";
          
          divisionUpdates.set(alloc.divisionId, {
            ref: divDoc.ref,
            newAvailable,
            status
          });

          const dealId = alloc.dealId;
          const invDoc = invDocs.get(dealId)!;
          let invUpdate = inventoryUpdates.get(dealId);
          if (!invUpdate) {
            invUpdate = {
              ref: invDoc.ref,
              data: { ...invDoc.data() } as Inventory,
              newBreakdown: [ ...((invDoc.data() as Inventory).divisionBreakdown || []) ]
            };
            inventoryUpdates.set(dealId, invUpdate);
          }

          invUpdate.data.remainingPackedKg += alloc.weightKg;
          invUpdate.data.totalSoldKg -= alloc.weightKg;

          const breakdownIndex = invUpdate.newBreakdown.findIndex(b => b.divisionId === alloc.divisionId);
          if (breakdownIndex >= 0) {
            invUpdate.newBreakdown[breakdownIndex].availableBags += alloc.numberOfBags;
          }
        }
      }

      const now = serverTimestamp() as Timestamp;

      // --- WRITES ---
      // Restore divisions
      for (const update of Array.from(divisionUpdates.values())) {
        transaction.update(update.ref, {
          availableBags: update.newAvailable,
          status: update.status,
          updatedAt: now
        });
      }

      // Restore inventory
      for (const [dealId, update] of Array.from(inventoryUpdates.entries())) {
        transaction.update(update.ref, {
          remainingPackedKg: update.data.remainingPackedKg,
          totalSoldKg: update.data.totalSoldKg,
          divisionBreakdown: update.newBreakdown,
          lastUpdated: now
        });
      }

      // Delete ledger entry and revert profile balances
      if (ledgerEntryRef) {
        transaction.delete(ledgerEntryRef);
      }

      if (profileId && orderData.orderConfirmed) {
        const profileRef = doc(db, "ledgerProfiles", profileId);
        transaction.update(profileRef, {
          totalCredit: increment(-orderData.totalRevenue),
          closingBalance: increment(orderData.totalRevenue),
          updatedAt: now,
        });
      }

      // Delete allocations
      for (const allocDoc of allocSnap.docs) {
        transaction.delete(allocDoc.ref);
      }

      // Delete order
      transaction.delete(orderRef);
    });
  }
};
