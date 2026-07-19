import { Timestamp } from "firebase/firestore";

export * from "./riceTypes";
export * from "./deal";
export * from "./order";
export * from "./inventory";
export * from "./ledger";
export * from "./dealLog";

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: "superadmin" | "admin";
  status: "pending" | "active" | "removed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Employee {
  employeeId: string;
  name: string;
  employeeType: "monthly" | "daily";
  salaryAmount: number;
  contactPhone?: string;
  joiningDate: Timestamp;
  contractEndDate?: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export interface WagePayment {
  paymentId: string;
  employeeId: string;
  daysWorked: number;
  amountPaid: number;
  paymentDate: Timestamp;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
}