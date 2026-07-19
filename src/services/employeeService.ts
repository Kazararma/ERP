import { collection, doc, setDoc, updateDoc, getDocs, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee, WagePayment } from "@/types";

export const employeeService = {
  async createEmployee(data: Partial<Employee>) {
    const employeeId = doc(collection(db, "employees")).id;
    const employeeRef = doc(db, "employees", employeeId);
    
    const newEmployee = {
      ...data,
      employeeId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(employeeRef, newEmployee);
    return employeeId;
  },

  async updateEmployee(employeeId: string, data: Partial<Employee>) {
    const employeeRef = doc(db, "employees", employeeId);
    await updateDoc(employeeRef, { ...data, updatedAt: serverTimestamp() });
  },

  async getAllEmployees(): Promise<Employee[]> {
    const snap = await getDocs(collection(db, "employees"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Employee)).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  },

  async payWage(employeeId: string, data: Partial<WagePayment>) {
    const paymentId = doc(collection(db, "employees", employeeId, "wagePayments")).id;
    const paymentRef = doc(db, "employees", employeeId, "wagePayments", paymentId);
    
    const newPayment = {
      ...data,
      paymentId,
      employeeId,
      createdAt: serverTimestamp(),
    };

    await setDoc(paymentRef, newPayment);
    return paymentId;
  },

  async getWagePayments(employeeId: string): Promise<WagePayment[]> {
    const q = query(collection(db, "employees", employeeId, "wagePayments"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WagePayment);
  }
};
