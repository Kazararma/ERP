import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, query, orderBy, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer } from "@/types";

const CUSTOMERS_COLLECTION = "customers";

export const customerService = {
  async getAllCustomers(): Promise<Customer[]> {
    const q = query(collection(db, CUSTOMERS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Customer);
  },

  async getCustomerById(customerId: string): Promise<Customer | null> {
    const docRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as Customer) : null;
  },

  async createCustomer(data: Omit<Customer, "customerId" | "createdAt" | "updatedAt">): Promise<Customer> {
    const docRef = doc(collection(db, CUSTOMERS_COLLECTION));
    const newCustomer: Customer = {
      ...data,
      customerId: docRef.id,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };
    
    const batch = writeBatch(db);
    batch.set(docRef, newCustomer);

    const profileRef = doc(collection(db, "ledgerProfiles"));
    batch.set(profileRef, {
      id: profileRef.id,
      entityId: docRef.id,
      entityType: "customer",
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
    return newCustomer;
  },

  async updateCustomer(customerId: string, data: Partial<Customer>): Promise<void> {
    const docRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }
};
