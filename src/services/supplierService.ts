import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, query, orderBy, deleteDoc, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Supplier } from "@/types";
import { syncLedgerProfileName } from "@/services/ledgerProfileService";

const SUPPLIERS_COLLECTION = "suppliers";

export const supplierService = {
  async getAllSuppliers(): Promise<Supplier[]> {
    const q = query(collection(db, SUPPLIERS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Supplier);
  },

  async getSupplierById(supplierId: string): Promise<Supplier | null> {
    const docRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as Supplier) : null;
  },

  async createSupplier(data: Omit<Supplier, "supplierId" | "createdAt" | "updatedAt">): Promise<Supplier> {
    const docRef = doc(collection(db, SUPPLIERS_COLLECTION));
    const newSupplier: Supplier = {
      ...data,
      supplierId: docRef.id,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };
    
    const batch = writeBatch(db);
    batch.set(docRef, newSupplier);

    const profileRef = doc(collection(db, "ledgerProfiles"));
    batch.set(profileRef, {
      id: profileRef.id,
      entityId: docRef.id,
      entityType: "supplier",
      entityName: data.name,
      millName: "Rice Merchant ERP",
      millDescription: "Default Mill",
      millContact: "",
      totalDebit: 0,
      totalCredit: 0,
      closingBalance: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return newSupplier;
  },

  async updateSupplier(supplierId: string, data: Partial<Supplier>): Promise<void> {
    const docRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    if (typeof data.name === "string" && data.name.trim()) {
      try {
        await syncLedgerProfileName("supplier", supplierId, data.name.trim());
        await this.cascadeSupplierName(supplierId, data.name.trim());
      } catch (err) {
        console.error("[ledger] failed to sync profile name", err);
      }
    }
  },

  async cascadeSupplierName(supplierId: string, newName: string): Promise<void> {
    const CHUNK_SIZE = 400;
    
    const collectionsToUpdate = [
      { col: "deals", field: "supplierName" },
      { col: "inventory", field: "supplierName" },
      { col: "supplierLedgerEntries", field: "supplierName" },
    ];

    for (const { col, field } of collectionsToUpdate) {
      const q = query(collection(db, col), where("supplierId", "==", supplierId));
      const snap = await getDocs(q);
      
      const batches: any[] = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      for (const d of snap.docs) {
        currentBatch.update(d.ref, { [field]: newName, updatedAt: serverTimestamp() });
        opCount++;
        
        if (opCount === CHUNK_SIZE) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      }
      if (opCount > 0) {
        batches.push(currentBatch.commit());
      }
      
      await Promise.all(batches);
    }
  },

  async deleteSupplier(supplierId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // 1. Delete the supplier doc
    const supplierRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
    batch.delete(supplierRef);

    // 2. Find all deals for this supplier
    const dealsQuery = query(collection(db, "deals"), where("supplierId", "==", supplierId));
    const dealsSnap = await getDocs(dealsQuery);

    for (const dealDoc of dealsSnap.docs) {
      const dealData = dealDoc.data();
      
      // Find all bag divisions for this deal
      const batchesQuery = query(collection(db, "deals", dealDoc.id, "bagDivisions"));
      const batchesSnap = await getDocs(batchesQuery);
      
      let hasConfirmedBatches = false;
      
      for (const batchDoc of batchesSnap.docs) {
        if (batchDoc.data().status === "ready") {
          // Delete unconfirmed divisions
          batch.delete(batchDoc.ref);
        } else {
          hasConfirmedBatches = true;
        }
      }

      if (!hasConfirmedBatches) {
        // Deal has no confirmed packs at all. Delete deal and its inventory doc entirely.
        batch.delete(dealDoc.ref);
        const invRef = doc(db, "inventory", dealDoc.id);
        batch.delete(invRef); // It might not exist if pending_delivery, but batch.delete on non-existent doc is fine in firestore.
      } else if (dealData.remainingAmountKg > 0) {
        // Deal is partially packed, but has some unpacked remaining stock.
        // We eliminate the unpacked stock so it doesn't show in staging.
        const packedAmount = dealData.totalAmountKg - dealData.remainingAmountKg;
        batch.update(dealDoc.ref, {
          remainingAmountKg: 0,
          totalAmountKg: packedAmount,
          status: "completed", 
          updatedAt: serverTimestamp()
        });

        const invRef = doc(db, "inventory", dealDoc.id);
        const invSnap = await getDoc(invRef);
        if (invSnap.exists()) {
          batch.update(invRef, {
            remainingRawKg: 0,
            totalBoughtKg: packedAmount,
            lastUpdated: serverTimestamp()
          });
        }
      }
    }

    await batch.commit();
  }
};
