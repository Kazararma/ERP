import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MiscellaneousProfile } from "@/types/miscellaneous";
import { syncLedgerProfileName } from "@/services/ledgerProfileService";

const COLLECTION = "miscellaneous";

export const miscellaneousService = {
  async getAllMiscellaneous(): Promise<MiscellaneousProfile[]> {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((d) => d.data() as MiscellaneousProfile);
  },

  async getMiscellaneousById(miscId: string): Promise<MiscellaneousProfile | null> {
    const docRef = doc(db, COLLECTION, miscId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as MiscellaneousProfile) : null;
  },

  /**
   * Creates a new MiscellaneousProfile AND eagerly creates its companion
   * ledgerProfiles document in a single atomic writeBatch — mirroring the
   * exact pattern used by supplierService.createSupplier and
   * customerService.createCustomer.
   */
  async createMiscellaneous(
    data: Omit<MiscellaneousProfile, "miscId" | "createdAt" | "updatedAt">
  ): Promise<MiscellaneousProfile> {
    const docRef = doc(collection(db, COLLECTION));
    const newProfile: MiscellaneousProfile = {
      ...data,
      miscId: docRef.id,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };

    const batch = writeBatch(db);

    // 1. Write the miscellaneous entity doc
    batch.set(docRef, newProfile);

    // 2. Eagerly create the companion ledgerProfile doc (same shape as
    //    supplier/customer profiles — id, entityId, entityType, etc.)
    const profileRef = doc(collection(db, "ledgerProfiles"));
    batch.set(profileRef, {
      id: profileRef.id,
      entityId: docRef.id,
      entityType: "miscellaneous",
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
    return newProfile;
  },

  async updateMiscellaneous(
    miscId: string,
    patch: Partial<MiscellaneousProfile>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION, miscId);
    await updateDoc(docRef, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    if (typeof patch.name === "string" && patch.name.trim()) {
      try {
        await syncLedgerProfileName("miscellaneous", miscId, patch.name.trim());
      } catch (err) {
        console.error("[ledger] failed to sync profile name", err);
      }
    }
  },
};
