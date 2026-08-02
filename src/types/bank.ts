import { Timestamp } from 'firebase/firestore';

export interface Bank {
  id: string;
  name: string;
  principalAmount: number;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BankTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  relatedSalaryTxId: string | null;
  payeeEmployeeId: string | null;
  payeeEmployeeName: string | null;
  note: string;
  performedBy: string;
  createdAt: Timestamp;
  relatedLedgerEntryId?: string | null;
  relatedProfileId?: string | null;
}

export type BankFormData = Pick<Bank, 'name' | 'principalAmount'>;

export interface AdjustPrincipalPayload {
  bankId: string;
  amount: number;
  direction: 'increase' | 'decrease';
  note: string;
}
