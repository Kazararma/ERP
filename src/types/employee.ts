import { Timestamp } from 'firebase/firestore';

export interface BankDetails {
  accountHolder: string;
  bankName: string;
  accountNumber: string; // store full; display as •••• {last4}
  ifscCode: string;
}

export type ContractType = 'monthly' | 'daily';
export type DailyWageMode = 'hourly' | 'perBag';
export type WageMode = 'fixed' | 'hourly' | 'perBag';

export interface EmployeePayLogEntry {
  salaryTxId: string;
  grossAmount: number;
  paidAt: Timestamp;
  bankId: string;
  bankName: string;
  wageMode: WageMode;
}

export interface Employee {
  id: string;
  name: string;
  address: string;                        // NEW
  bankDetails: BankDetails;              // NEW
  contractType: ContractType;
  dailyWageMode: DailyWageMode | null;   // NEW (was implied, now explicit)
  fixedMonthlySalary: number | null;
  hourlyRate: number | null;
  ratePerBag: number | null;             // NEW
  payLog: EmployeePayLogEntry[];         // NEW
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Form input type (omits auto-generated fields)
export type EmployeeFormData = Omit<Employee, 'id' | 'payLog' | 'createdAt' | 'updatedAt'>;
