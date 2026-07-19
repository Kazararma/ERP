import { collection, doc, getDoc, getDocs, updateDoc, query, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser } from "@/types";

const USERS_COLLECTION = "users";

export const userService = {
  async getAllUsers(): Promise<AppUser[]> {
    const q = query(collection(db, USERS_COLLECTION));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as AppUser);
  },

  async getUserById(uid: string): Promise<AppUser | null> {
    const docRef = doc(db, USERS_COLLECTION, uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as AppUser) : null;
  },

  async approveUser(uid: string): Promise<void> {
    const docRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(docRef, { status: "active", updatedAt: serverTimestamp() });
  },

  async removeUser(uid: string): Promise<void> {
    const docRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(docRef, { status: "removed", updatedAt: serverTimestamp() });
  },

  async updateUserRole(uid: string, role: "superadmin" | "admin"): Promise<void> {
    const docRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(docRef, { role, updatedAt: serverTimestamp() });
  }
};
