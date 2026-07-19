import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RiceType, RICE_TYPE_SEED_DATA } from "@/types/riceTypes";

const COLLECTION = "riceTypes";

/**
 * Writes all 10 seed rice types to Firestore if the collection is empty.
 * Call once from the Admin panel or a one-time init script.
 * Uses the riceTypeId as the Firestore document ID.
 */
export async function seedRiceTypes(createdByUid: string): Promise<void> {
  const snap = await getDocs(collection(db, COLLECTION));
  if (!snap.empty) return; // Already seeded

  const now = serverTimestamp() as Timestamp;
  const promises = RICE_TYPE_SEED_DATA.map((rt) =>
    setDoc(doc(db, COLLECTION, rt.riceTypeId), {
      ...rt,
      createdAt: now,
      updatedAt: now,
      createdBy: createdByUid,
    })
  );
  await Promise.all(promises);
}

/**
 * Fetch all active rice types once. Used for form dropdowns on first load.
 */
export async function getActiveRiceTypes(): Promise<RiceType[]> {
  const q = query(collection(db, COLLECTION));
  const snap = await getDocs(q);
  const types = snap.docs.map((d) => d.data() as RiceType).filter(t => t.isActive);
  return types.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Subscribe to active rice types in real time.
 * Returns an unsubscribe function. Use in components via useEffect.
 */
export function subscribeToActiveRiceTypes(
  callback: (types: RiceType[]) => void
): () => void {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(q, (snap) => {
    const types = snap.docs.map((d) => d.data() as RiceType).filter(t => t.isActive);
    types.sort((a, b) => a.displayName.localeCompare(b.displayName));
    callback(types);
  }, (error) => {
    console.error("Error subscribing to rice types:", error);
  });
}

/**
 * Add a new rice type. riceTypeId is derived from the code (lowercased, trimmed).
 * Returns the created RiceType or throws if the code already exists.
 */
export async function addRiceType(
  code: string,
  displayName: string,
  createdByUid: string
): Promise<RiceType> {
  const id = code.toLowerCase().trim().replace(/\s+/g, "_");
  const ref = doc(db, COLLECTION, id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error(`Rice type with code "${code}" already exists.`);
  }
  const now = serverTimestamp() as Timestamp;
  const newType: RiceType = {
    riceTypeId: id,
    code: id,
    displayName: displayName.trim(),
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: createdByUid,
  };
  await setDoc(ref, newType);
  return newType;
}

/**
 * Soft-delete a rice type. Sets isActive = false. Does not delete historical data.
 */
export async function deactivateRiceType(riceTypeId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, riceTypeId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
}
