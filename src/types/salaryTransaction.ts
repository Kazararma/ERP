import { Timestamp } from 'firebase/firestore';
import { ContractType, WageMode } from './employee';

export interface SalaryTransaction {
  id: string;
  employeeId: string;
  employeeName: string;
  contractType: ContractType;
  wageMode: WageMode;
  hoursWorked: number | null;
  bagsCompleted: number | null;
  rateApplied: number;
  grossAmount: number;
  bankId: string;
  bankName: string;
  paidAt: Timestamp;
  paidBy: string;
  paidByName: string;
  month: string; // 'YYYY-MM'
}

export interface SalaryLedgerFilters {
  month: string;           // 'YYYY-MM', default = current month
  employeeId: string | null;
  bankId: string | null;
}

export interface PaySalaryPayload {
  employee: import('./employee').Employee;
  bankId: string;
  bankName: string;
  wageMode: WageMode;
  fixedMonthlySalary?: number;
  hourlyRate?: number;
  ratePerBag?: number;
  hoursWorked?: number;
  bagsCompleted?: number;
  paidBy: string;       // admin UID
  paidByName: string;   // admin display name
}
