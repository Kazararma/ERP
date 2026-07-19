# RISE ERP — Feature Implementation Blueprint
## Wages Module (Bank Tab) + Salary Ledger Tab
**Version:** 2.0 — Agent Build Document  
**Stack:** React 18 · TypeScript 5 · Firebase Firestore · Zustand v5 · React Hook Form v7 · Zod v4 · Tailwind CSS v3  
**Purpose:** This document is the single source of truth for an AI coding agent to implement all new features end-to-end. Follow every section in order. Do not deviate from naming conventions, file paths, or data models defined here.

---

## TABLE OF CONTENTS

1. [Feature Overview](#1-feature-overview)
2. [Existing System Context](#2-existing-system-context)
3. [Firestore Schema Changes](#3-firestore-schema-changes)
4. [TypeScript Type Definitions](#4-typescript-type-definitions)
5. [Zod Validation Schemas](#5-zod-validation-schemas)
6. [Zustand Store Changes](#6-zustand-store-changes)
7. [Utility Functions](#7-utility-functions)
8. [Wages Module — Employee Updates](#8-wages-module--employee-updates)
9. [Wages Module — Pay Wage Modal Updates](#9-wages-module--pay-wage-modal-updates)
10. [Wages Module — Bank Tab (New)](#10-wages-module--bank-tab-new)
11. [Ledger Module — Salary Ledger Tab (New)](#11-ledger-module--salary-ledger-tab-new)
12. [Atomic Transaction Logic](#12-atomic-transaction-logic)
13. [Default Bank Seeding](#13-default-bank-seeding)
14. [Firestore Security Rules Additions](#14-firestore-security-rules-additions)
15. [Firestore Index Definitions](#15-firestore-index-definitions)
16. [Complete File Tree](#16-complete-file-tree)
17. [Implementation Order](#17-implementation-order)

---

## 1. FEATURE OVERVIEW

### 1.1 What Is Being Built

Three interconnected feature sets are added to the existing RISE ERP application:

**A. Employee Profile Expansion**
- Every employee record gains three new required fields: `address`, `bankDetails` (sub-object with 4 fields).
- The existing `EmployeeForm` and `EmployeeCard` components are updated to display and edit these fields.

**B. Payment Logic Expansion — Three Wage Modes**
- **Monthly Fixed:** Employee has a fixed salary. Admin clicks Pay, selects a bank, salary is disbursed.
- **Daily Hourly:** Admin inputs hours worked. Gross = `hourlyRate × hoursWorked`. Admin selects bank and pays.
- **Daily Per-Bag:** Admin inputs number of bags completed. Gross = `ratePerBag × bagsCompleted`. Admin selects bank and pays.
- Every payment is logged on the employee's profile card with amount, date, and time.

**C. Bank / Treasury Tab (new tab inside Wages section)**
- Users can create unlimited named bank/treasury accounts.
- Three default banks are seeded on first boot.
- Each bank has a `principalAmount` (current balance) that can be manually increased or decreased at any time.
- Salary payments deduct from the selected bank's principal atomically.
- Every debit and credit is logged with date, amount, payee, and running balance.

**D. Salary Ledger Tab (new tab inside Ledger section)**
- Aggregates every salary disbursement across all employees.
- Displayed in ledger table format: date, employee, mode, gross amount, bank used.
- Row click opens a detail drawer.
- Filterable by month, by employee, and by bank.

---

## 2. EXISTING SYSTEM CONTEXT

### 2.1 Relevant Existing Collections

```
employees/          — one doc per employee
  {employeeId}
    name: string
    contractType: 'monthly' | 'daily'
    fixedMonthlySalary: number | null
    hourlyRate: number | null
    createdAt: Timestamp
    updatedAt: Timestamp
```

### 2.2 Relevant Existing Components

| Path | Role |
|------|------|
| `src/components/wages/WagesPage.tsx` | Tab host for wages section |
| `src/components/wages/EmployeeCard.tsx` | Displays one employee |
| `src/components/wages/EmployeeForm.tsx` | Create / edit employee |
| `src/components/wages/PayWageModal.tsx` | Pay modal |
| `src/components/ledger/LedgerPage.tsx` | Tab host for ledger section |
| `src/stores/wagesStore.ts` | Zustand wages store |

### 2.3 Existing Zustand Pattern
All stores follow this pattern — replicate exactly:
```ts
import { create } from 'zustand';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, ... } from 'firebase/firestore';

interface StoreState { ... }
interface StoreActions { ... }

export const useWagesStore = create<StoreState & StoreActions>((set, get) => ({
  // state
  employees: [],
  isLoading: false,
  // actions
  fetchEmployees: () => { ... },
}));
```

---

## 3. FIRESTORE SCHEMA CHANGES

### 3.1 Updated Collection: `employees`

Add the following fields to every employee document. Existing fields are unchanged.

```jsonc
// employees/{employeeId}
{
  // --- EXISTING FIELDS (unchanged) ---
  "id": "string — Firestore doc ID",
  "name": "string",
  "contractType": "'monthly' | 'daily'",
  "fixedMonthlySalary": "number | null",
  "hourlyRate": "number | null",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp",

  // --- NEW FIELDS ---
  "address": "string — residential or correspondence address",

  "bankDetails": {
    "accountHolder": "string — name as printed on bank account",
    "bankName": "string — employee's bank name",
    "accountNumber": "string — full account number (display masked in UI)",
    "ifscCode": "string — IFSC or routing code"
  },

  "dailyWageMode": "'hourly' | 'perBag' | null",
  // null for monthly workers
  // 'hourly' → pay by hours worked
  // 'perBag' → pay by bags completed

  "ratePerBag": "number | null",
  // Required when dailyWageMode = 'perBag'
  // null otherwise

  "payLog": [
    // Array of sub-objects. Each Pay Salary action appends one entry.
    {
      "salaryTxId": "string — ID of the salaryTransactions doc",
      "grossAmount": "number",
      "paidAt": "Timestamp",
      "bankId": "string",
      "bankName": "string",
      "wageMode": "'fixed' | 'hourly' | 'perBag'"
    }
  ]
}
```

### 3.2 New Collection: `banks`

```jsonc
// banks/{bankId}
{
  "id": "string — Firestore doc ID",
  "name": "string — user-defined label e.g. 'HDFC Operations Account'",
  "principalAmount": "number — current balance; mutated on every pay/adjust",
  "isDefault": "boolean — true for the 3 seed banks",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### 3.3 New Sub-Collection: `banks/{bankId}/transactions`

One document per credit or debit event on the bank.

```jsonc
// banks/{bankId}/transactions/{txId}
{
  "id": "string — Firestore doc ID",
  "type": "'credit' | 'debit'",
  "amount": "number — always positive",
  "balanceAfter": "number — snapshot of principalAmount after this event",
  "relatedSalaryTxId": "string | null — points to salaryTransactions doc for debits",
  "payeeEmployeeId": "string | null — employee ID for debit transactions",
  "payeeEmployeeName": "string | null — denormalised for fast display",
  "note": "string — free-text, e.g. 'Owner top-up' or auto-filled 'Salary: Ramesh Kumar'",
  "performedBy": "string — UID of admin who triggered the event",
  "createdAt": "Timestamp — serverTimestamp()"
}
```

### 3.4 New Root Collection: `salaryTransactions`

One document per salary disbursement. This is the data source for the Salary Ledger tab.

```jsonc
// salaryTransactions/{txId}
{
  "id": "string — Firestore doc ID",
  "employeeId": "string",
  "employeeName": "string — denormalised",
  "contractType": "'monthly' | 'daily'",
  "wageMode": "'fixed' | 'hourly' | 'perBag'",

  // Populated only when relevant:
  "hoursWorked": "number | null",
  "bagsCompleted": "number | null",
  "rateApplied": "number — rate snapshot at time of payment",

  "grossAmount": "number — final amount paid",
  "bankId": "string",
  "bankName": "string — denormalised",
  "paidAt": "Timestamp — serverTimestamp()",
  "paidBy": "string — admin UID",
  "paidByName": "string — admin display name, denormalised",
  "month": "string — 'YYYY-MM' format for filter indexing e.g. '2025-07'"
}
```

---

## 4. TYPESCRIPT TYPE DEFINITIONS

### File: `src/types/employee.ts` (update existing)

```ts
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
```

### File: `src/types/bank.ts` (new file)

```ts
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
}

export type BankFormData = Pick<Bank, 'name' | 'principalAmount'>;

export interface AdjustPrincipalPayload {
  bankId: string;
  amount: number;
  direction: 'increase' | 'decrease';
  note: string;
}
```

### File: `src/types/salaryTransaction.ts` (new file)

```ts
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
  hoursWorked?: number;
  bagsCompleted?: number;
  paidBy: string;       // admin UID
  paidByName: string;   // admin display name
}
```

---

## 5. ZOD VALIDATION SCHEMAS

### File: `src/schemas/employeeSchema.ts` (update existing)

```ts
import { z } from 'zod';

const bankDetailsSchema = z.object({
  accountHolder: z.string().min(2, 'Account holder name required'),
  bankName: z.string().min(2, 'Bank name required'),
  accountNumber: z.string().min(6, 'Invalid account number').max(20),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'),
});

export const employeeSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    address: z.string().min(5, 'Address required'),
    bankDetails: bankDetailsSchema,
    contractType: z.enum(['monthly', 'daily']),
    dailyWageMode: z.enum(['hourly', 'perBag']).nullable(),
    fixedMonthlySalary: z.number().positive('Must be positive').nullable(),
    hourlyRate: z.number().positive('Must be positive').nullable(),
    ratePerBag: z.number().positive('Must be positive').nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.contractType === 'monthly') {
      if (!data.fixedMonthlySalary) {
        ctx.addIssue({ code: 'custom', path: ['fixedMonthlySalary'], message: 'Fixed salary required for monthly workers' });
      }
    }
    if (data.contractType === 'daily') {
      if (!data.dailyWageMode) {
        ctx.addIssue({ code: 'custom', path: ['dailyWageMode'], message: 'Select a wage mode for daily workers' });
      }
      if (data.dailyWageMode === 'hourly' && !data.hourlyRate) {
        ctx.addIssue({ code: 'custom', path: ['hourlyRate'], message: 'Hourly rate required' });
      }
      if (data.dailyWageMode === 'perBag' && !data.ratePerBag) {
        ctx.addIssue({ code: 'custom', path: ['ratePerBag'], message: 'Rate per bag required' });
      }
    }
  });

export type EmployeeSchemaType = z.infer<typeof employeeSchema>;
```

### File: `src/schemas/bankSchema.ts` (new file)

```ts
import { z } from 'zod';

export const bankSchema = z.object({
  name: z.string().min(2, 'Bank name must be at least 2 characters'),
  principalAmount: z.number().min(0, 'Opening balance cannot be negative'),
});

export const adjustPrincipalSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  direction: z.enum(['increase', 'decrease']),
  note: z.string().optional().default(''),
});

export const paySalarySchema = z
  .object({
    bankId: z.string().min(1, 'Select a bank to pay from'),
    wageMode: z.enum(['fixed', 'hourly', 'perBag']),
    hoursWorked: z.number().positive().optional(),
    bagsCompleted: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.wageMode === 'hourly' && !data.hoursWorked) {
      ctx.addIssue({ code: 'custom', path: ['hoursWorked'], message: 'Hours worked required' });
    }
    if (data.wageMode === 'perBag' && !data.bagsCompleted) {
      ctx.addIssue({ code: 'custom', path: ['bagsCompleted'], message: 'Bags completed required' });
    }
  });
```

---

## 6. ZUSTAND STORE CHANGES

### 6.1 New Store: `src/stores/bankStore.ts`

Create this file from scratch.

```ts
import { create } from 'zustand';
import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  runTransaction, serverTimestamp, query, orderBy,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bank, BankTransaction, BankFormData, AdjustPrincipalPayload } from '@/types/bank';

interface BankState {
  banks: Bank[];
  isLoading: boolean;
  selectedBankId: string | null;
}

interface BankActions {
  subscribeBanks: () => () => void;           // returns unsubscribe fn
  createBank: (data: BankFormData) => Promise<void>;
  adjustPrincipal: (payload: AdjustPrincipalPayload, adminUid: string) => Promise<void>;
  fetchBankTransactions: (bankId: string) => Promise<BankTransaction[]>;
  selectBank: (bankId: string | null) => void;
}

export const useBankStore = create<BankState & BankActions>((set, get) => ({
  banks: [],
  isLoading: false,
  selectedBankId: null,

  subscribeBanks: () => {
    set({ isLoading: true });
    const q = query(collection(db, 'banks'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const banks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Bank));
      set({ banks, isLoading: false });
    });
    return unsub;
  },

  createBank: async (data) => {
    await addDoc(collection(db, 'banks'), {
      ...data,
      isDefault: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  adjustPrincipal: async (payload, adminUid) => {
    const { bankId, amount, direction, note } = payload;
    const bankRef = doc(db, 'banks', bankId);

    await runTransaction(db, async (tx) => {
      const bankSnap = await tx.get(bankRef);
      if (!bankSnap.exists()) throw new Error('Bank not found');

      const current = bankSnap.data().principalAmount as number;
      const newBalance = direction === 'increase' ? current + amount : current - amount;

      if (newBalance < 0) throw new Error('Insufficient funds: balance cannot go below zero');

      tx.update(bankRef, { principalAmount: newBalance, updatedAt: serverTimestamp() });

      const txRef = doc(collection(db, 'banks', bankId, 'transactions'));
      tx.set(txRef, {
        type: direction === 'increase' ? 'credit' : 'debit',
        amount,
        balanceAfter: newBalance,
        relatedSalaryTxId: null,
        payeeEmployeeId: null,
        payeeEmployeeName: null,
        note: note || (direction === 'increase' ? 'Manual top-up' : 'Manual withdrawal'),
        performedBy: adminUid,
        createdAt: serverTimestamp(),
      });
    });
  },

  fetchBankTransactions: async (bankId) => {
    const q = query(
      collection(db, 'banks', bankId, 'transactions'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BankTransaction));
  },

  selectBank: (bankId) => set({ selectedBankId: bankId }),
}));
```

### 6.2 Updated Store: `src/stores/wagesStore.ts`

Add the following to the existing store. Do not remove any existing state or actions. Only append.

```ts
// --- ADD THESE IMPORTS at the top of the existing file ---
import {
  runTransaction, doc, collection, serverTimestamp,
  query, where, orderBy, getDocs, arrayUnion
} from 'firebase/firestore';
import { SalaryTransaction, SalaryLedgerFilters, PaySalaryPayload } from '@/types/salaryTransaction';
import { calculateGross } from '@/utils/wageCalculator';
import { format } from 'date-fns';

// --- ADD THESE TO THE STATE INTERFACE ---
interface WagesState {
  // ... existing state ...
  salaryLedger: SalaryTransaction[];
  ledgerLoading: boolean;
}

// --- ADD THESE TO THE ACTIONS INTERFACE ---
interface WagesActions {
  // ... existing actions ...
  paySalary: (payload: PaySalaryPayload) => Promise<void>;
  fetchSalaryLedger: (filters: SalaryLedgerFilters) => Promise<void>;
}

// --- ADD THESE ACTION IMPLEMENTATIONS inside the create() call ---

paySalary: async (payload) => {
  const { employee, bankId, bankName, wageMode, hoursWorked, bagsCompleted, paidBy, paidByName } = payload;

  const grossAmount = calculateGross({
    wageMode,
    fixedMonthlySalary: employee.fixedMonthlySalary,
    hourlyRate: employee.hourlyRate,
    ratePerBag: employee.ratePerBag,
    hoursWorked,
    bagsCompleted,
  });

  const rateApplied =
    wageMode === 'fixed' ? (employee.fixedMonthlySalary ?? 0)
    : wageMode === 'hourly' ? (employee.hourlyRate ?? 0)
    : (employee.ratePerBag ?? 0);

  const month = format(new Date(), 'yyyy-MM');

  const bankRef = doc(db, 'banks', bankId);
  const salaryTxRef = doc(collection(db, 'salaryTransactions'));
  const bankTxRef = doc(collection(db, 'banks', bankId, 'transactions'));
  const employeeRef = doc(db, 'employees', employee.id);

  await runTransaction(db, async (tx) => {
    const bankSnap = await tx.get(bankRef);
    if (!bankSnap.exists()) throw new Error('Selected bank not found');

    const currentBalance = bankSnap.data().principalAmount as number;
    if (currentBalance < grossAmount) {
      throw new Error(`Insufficient funds: bank balance ₹${currentBalance.toLocaleString()} is less than salary ₹${grossAmount.toLocaleString()}`);
    }

    const newBalance = currentBalance - grossAmount;

    // 1. Write salary transaction
    tx.set(salaryTxRef, {
      employeeId: employee.id,
      employeeName: employee.name,
      contractType: employee.contractType,
      wageMode,
      hoursWorked: hoursWorked ?? null,
      bagsCompleted: bagsCompleted ?? null,
      rateApplied,
      grossAmount,
      bankId,
      bankName,
      paidAt: serverTimestamp(),
      paidBy,
      paidByName,
      month,
    });

    // 2. Write bank transaction log
    tx.set(bankTxRef, {
      type: 'debit',
      amount: grossAmount,
      balanceAfter: newBalance,
      relatedSalaryTxId: salaryTxRef.id,
      payeeEmployeeId: employee.id,
      payeeEmployeeName: employee.name,
      note: `Salary: ${employee.name}`,
      performedBy: paidBy,
      createdAt: serverTimestamp(),
    });

    // 3. Deduct bank principal
    tx.update(bankRef, { principalAmount: newBalance, updatedAt: serverTimestamp() });

    // 4. Append to employee payLog
    tx.update(employeeRef, {
      payLog: arrayUnion({
        salaryTxId: salaryTxRef.id,
        grossAmount,
        paidAt: new Date(), // client-side for arrayUnion; Timestamp cannot be used inside arrayUnion
        bankId,
        bankName,
        wageMode,
      }),
      updatedAt: serverTimestamp(),
    });
  });
},

fetchSalaryLedger: async (filters) => {
  set({ ledgerLoading: true });
  const constraints: any[] = [where('month', '==', filters.month), orderBy('paidAt', 'desc')];
  if (filters.employeeId) constraints.splice(1, 0, where('employeeId', '==', filters.employeeId));
  if (filters.bankId) constraints.splice(1, 0, where('bankId', '==', filters.bankId));

  const q = query(collection(db, 'salaryTransactions'), ...constraints);
  const snap = await getDocs(q);
  const salaryLedger = snap.docs.map(d => ({ id: d.id, ...d.data() } as SalaryTransaction));
  set({ salaryLedger, ledgerLoading: false });
},
```

---

## 7. UTILITY FUNCTIONS

### File: `src/utils/wageCalculator.ts` (new file)

Pure function. No side effects. No imports from Firebase.

```ts
import { WageMode } from '@/types/employee';

interface CalculateGrossInput {
  wageMode: WageMode;
  fixedMonthlySalary: number | null;
  hourlyRate: number | null;
  ratePerBag: number | null;
  hoursWorked?: number;
  bagsCompleted?: number;
}

export function calculateGross(input: CalculateGrossInput): number {
  const { wageMode, fixedMonthlySalary, hourlyRate, ratePerBag, hoursWorked, bagsCompleted } = input;

  switch (wageMode) {
    case 'fixed':
      if (!fixedMonthlySalary) throw new Error('Fixed salary not set on employee');
      return fixedMonthlySalary;

    case 'hourly':
      if (!hourlyRate) throw new Error('Hourly rate not set on employee');
      if (!hoursWorked || hoursWorked <= 0) throw new Error('Hours worked must be greater than zero');
      return parseFloat((hourlyRate * hoursWorked).toFixed(2));

    case 'perBag':
      if (!ratePerBag) throw new Error('Rate per bag not set on employee');
      if (!bagsCompleted || bagsCompleted <= 0) throw new Error('Bags completed must be greater than zero');
      return parseFloat((ratePerBag * bagsCompleted).toFixed(2));

    default:
      throw new Error('Unknown wage mode');
  }
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return `•••• ${accountNumber.slice(-4)}`;
}
```

### File: `src/utils/seedDefaultBanks.ts` (new file)

```ts
import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const DEFAULT_BANKS = [
  { name: 'HDFC Operations Account', principalAmount: 0, isDefault: true },
  { name: 'SBI Payroll Account', principalAmount: 0, isDefault: true },
  { name: 'Petty Cash Fund', principalAmount: 0, isDefault: true },
];

export async function seedDefaultBanksIfEmpty(): Promise<void> {
  const snap = await getDocs(collection(db, 'banks'));
  if (!snap.empty) return; // banks already exist, skip

  const batch = writeBatch(db);
  DEFAULT_BANKS.forEach((bank) => {
    const ref = doc(collection(db, 'banks'));
    batch.set(ref, { ...bank, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  await batch.commit();
}
```

---

## 8. WAGES MODULE — EMPLOYEE UPDATES

### 8.1 Updated: `src/components/wages/EmployeeForm.tsx`

**What changes:**
- Add `address` textarea field (required).
- Add a `Bank Details` fieldset section with 4 sub-fields.
- Add `dailyWageMode` radio/select (appears only when `contractType === 'daily'`).
- Add `ratePerBag` number input (appears only when `dailyWageMode === 'perBag'`).
- Wire updated Zod schema.

**Full component spec:**

```
SECTION: Personal Information
  - name (text input) — existing
  - address (textarea, rows=3) — NEW, required

SECTION: Bank Details  — NEW SECTION
  - accountHolder (text input) — "Name on Bank Account"
  - bankName (text input) — "Employee's Bank Name"
  - accountNumber (text input) — "Account Number"
  - ifscCode (text input, uppercase auto-transform) — "IFSC Code"

SECTION: Contract & Wages
  - contractType (radio: Monthly | Daily) — existing
  - IF contractType === 'monthly':
      - fixedMonthlySalary (number input) — existing
  - IF contractType === 'daily':
      - dailyWageMode (radio: Hourly | Per Bag) — NEW
      - IF dailyWageMode === 'hourly':
          - hourlyRate (number input) — existing
      - IF dailyWageMode === 'perBag':
          - ratePerBag (number input) — NEW
```

**Default values for useForm:**
```ts
defaultValues: {
  name: '',
  address: '',
  bankDetails: { accountHolder: '', bankName: '', accountNumber: '', ifscCode: '' },
  contractType: 'monthly',
  dailyWageMode: null,
  fixedMonthlySalary: null,
  hourlyRate: null,
  ratePerBag: null,
}
```

### 8.2 Updated: `src/components/wages/EmployeeCard.tsx`

**What changes:**
- Display `address` below name.
- Display masked account number and bank name from `bankDetails`.
- Display a `Pay History` collapsible section at the bottom of the card.

**Pay History section spec:**
```
Pay History
  [If payLog is empty]: "No payments yet"
  [If payLog has entries]: Chronological list, newest first
    Each entry shows:
      - Date: DD MMM YYYY
      - Time: HH:mm
      - Amount: ₹X,XX,XXX.00  (bold, green text)
      - Mode badge: Fixed | Hourly | Per Bag
      - Bank: {bankName}
```

---

## 9. WAGES MODULE — PAY WAGE MODAL UPDATES

### File: `src/components/wages/PayWageModal.tsx`

**Complete modal spec:**

The modal opens when an admin clicks the Pay button on an `EmployeeCard`. It receives the `employee` object as a prop.

```
MODAL TITLE: "Pay Salary — {employee.name}"

STEP 1: Wage Mode Display (read-only info, not a form field)
  - IF employee.contractType === 'monthly':
      Show: "Fixed Monthly Salary: ₹{fixedMonthlySalary}"
      wageMode = 'fixed' (set internally, not shown as input)

  - IF employee.contractType === 'daily' AND employee.dailyWageMode === 'hourly':
      Show read-only: "Hourly Rate: ₹{hourlyRate}/hr"
      Show INPUT: "Hours Worked" (number, min=0.5, step=0.5)
      Show COMPUTED: "Gross Amount: ₹{hourlyRate × hoursWorked}" (live update as user types)
      wageMode = 'hourly'

  - IF employee.contractType === 'daily' AND employee.dailyWageMode === 'perBag':
      Show read-only: "Rate per Bag: ₹{ratePerBag}/bag"
      Show INPUT: "Bags Completed" (integer, min=1)
      Show COMPUTED: "Gross Amount: ₹{ratePerBag × bagsCompleted}" (live update)
      wageMode = 'perBag'

STEP 2: Bank Selection
  - Label: "Pay From Bank"
  - Dropdown/Select populated from useBankStore().banks
  - Each option shows: "{bank.name} — Balance: ₹{bank.principalAmount}"
  - If selected bank's principalAmount < grossAmount: show inline warning
    "⚠ Insufficient balance in selected bank"
  - Required validation

STEP 3: Summary Box (shown after bank is selected)
  ┌─────────────────────────────────┐
  │ Employee:    {name}             │
  │ Amount:      ₹{grossAmount}    │
  │ From Bank:   {bankName}        │
  │ New Balance: ₹{newBalance}     │
  └─────────────────────────────────┘

BUTTON: "Pay Salary" (disabled if form invalid or insufficient balance)
  - On click: call wagesStore.paySalary(payload)
  - On success: show toast "Salary paid successfully", close modal
  - On error with "Insufficient funds": show toast with error message
  - On other error: show toast "Payment failed. Please try again."

BUTTON: "Cancel" — closes modal
```

**Form hook setup:**
```ts
const { register, handleSubmit, watch, formState: { errors } } = useForm({
  resolver: zodResolver(paySalarySchema),
  defaultValues: { bankId: '', wageMode: derivedWageMode, hoursWorked: undefined, bagsCompleted: undefined }
});

// Live gross amount calculation
const hoursWorked = watch('hoursWorked');
const bagsCompleted = watch('bagsCompleted');
const grossAmount = useMemo(() => {
  try {
    return calculateGross({ wageMode, fixedMonthlySalary, hourlyRate, ratePerBag, hoursWorked, bagsCompleted });
  } catch { return 0; }
}, [wageMode, hoursWorked, bagsCompleted]);
```

---

## 10. WAGES MODULE — BANK TAB (NEW)

### 10.1 Tab Integration

**File to update: `src/components/wages/WagesPage.tsx`**

Add a new tab called **"Bank"** alongside the existing tabs. The tab should appear last in the tab bar. When selected, it renders `<BankTab />`.

```tsx
import { BankTab } from './bank/BankTab';
// Add to tab list: { label: 'Bank', value: 'bank', icon: BuildingLibraryIcon }
// Add to tab panels: <BankTab /> when activeTab === 'bank'
```

### 10.2 New File: `src/components/wages/bank/BankTab.tsx`

Root container for the Bank tab. Responsibilities:
- On mount: call `seedDefaultBanksIfEmpty()`, then `subscribeBanks()`.
- On unmount: call the unsubscribe function returned by `subscribeBanks()`.
- Render: header bar with "Add Bank" button + grid of `BankCard` components.

```tsx
// Layout spec:
<div className="space-y-6">
  <div className="flex items-center justify-between">
    <h2>Treasury / Banks</h2>
    <button onClick={() => setCreateModalOpen(true)}>+ Add Bank</button>
  </div>

  {isLoading ? <LoadingSpinner /> : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {banks.map(bank => <BankCard key={bank.id} bank={bank} />)}
    </div>
  )}

  <CreateBankModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
</div>
```

### 10.3 New File: `src/components/wages/bank/BankCard.tsx`

Displays one bank. Props: `{ bank: Bank }`.

```
┌─────────────────────────────────────────┐
│  🏦 HDFC Operations Account    [DEFAULT]│
│                                         │
│  Current Balance                        │
│  ₹2,45,000.00               (large text)│
│                                         │
│  [+ Add Funds]    [− Withdraw]          │
│                                         │
│  ▼ Transaction History (collapsible)   │
│    [list of BankTransactionLog items]   │
└─────────────────────────────────────────┘
```

Clicking `+ Add Funds` opens `AdjustPrincipalModal` with `direction='increase'`.
Clicking `− Withdraw` opens `AdjustPrincipalModal` with `direction='decrease'`.

### 10.4 New File: `src/components/wages/bank/CreateBankModal.tsx`

Modal with form to create a new bank.

```
TITLE: "Add New Bank"

Fields:
  - Bank Name (text input, required, min 2 chars)
    Placeholder: "e.g. Punjab National Bank – Operations"
  - Opening Balance (number input, min 0)
    Label: "Opening Balance (₹)"
    Helper: "You can adjust this later"

BUTTON: "Create Bank"
  On submit: call bankStore.createBank(data), close modal, show success toast.

BUTTON: "Cancel"
```

### 10.5 New File: `src/components/wages/bank/AdjustPrincipalModal.tsx`

Modal to add or remove funds from a bank. Props: `{ bank: Bank, direction: 'increase' | 'decrease', open: boolean, onClose: () => void }`.

```
TITLE: direction === 'increase' ? "Add Funds to {bank.name}" : "Withdraw from {bank.name}"

Current Balance: ₹{bank.principalAmount}

Fields:
  - Amount (number input, required, positive)
    Label: direction === 'increase' ? "Amount to Add (₹)" : "Amount to Withdraw (₹)"
  - Note (text input, optional)
    Placeholder: "Reason or reference (optional)"

IF direction === 'decrease':
  - If amount > principalAmount: show warning "Amount exceeds current balance"
  - Disable submit button when amount > principalAmount

Preview:
  New Balance: ₹{direction === 'increase' ? current + amount : current - amount}

BUTTON: direction === 'increase' ? "Add Funds" : "Withdraw"
  On submit: call bankStore.adjustPrincipal(payload, adminUid)
  On success: toast + close modal
  On error (balance < 0): show error toast

BUTTON: "Cancel"
```

### 10.6 New File: `src/components/wages/bank/BankTransactionLog.tsx`

Collapsible list of transactions for one bank. Props: `{ bankId: string }`.

```
Behaviour:
  - On expand: call bankStore.fetchBankTransactions(bankId)
  - Show loading spinner while fetching
  - Render list of transactions, newest first

Each transaction row:
  [CREDIT/DEBIT badge]  Date & Time  Amount  Balance After  Note / Payee Name
  
  Credit rows: green amount text, "+" prefix
  Debit rows: red amount text, "−" prefix

  If payeeEmployeeName exists: show "→ {payeeEmployeeName}" as subtitle

Empty state: "No transactions yet"
```

---

## 11. LEDGER MODULE — SALARY LEDGER TAB (NEW)

### 11.1 Tab Integration

**File to update: `src/components/ledger/LedgerPage.tsx`**

Add a new tab called **"Salary Ledger"** to the existing ledger tabs. When selected, render `<SalaryLedgerTab />`.

```tsx
import { SalaryLedgerTab } from './salary/SalaryLedgerTab';
// Add to tab list: { label: 'Salary Ledger', value: 'salary', icon: BanknotesIcon }
```

### 11.2 New File: `src/components/ledger/salary/SalaryLedgerTab.tsx`

Root container. Responsibilities:
- Manage filter state (month, employeeId, bankId).
- Call `wagesStore.fetchSalaryLedger(filters)` on mount and whenever filters change.
- Render filters bar + table.

```tsx
// Default filters:
const [filters, setFilters] = useState<SalaryLedgerFilters>({
  month: format(new Date(), 'yyyy-MM'),
  employeeId: null,
  bankId: null,
});

// Re-fetch on filter change:
useEffect(() => { fetchSalaryLedger(filters); }, [filters]);
```

### 11.3 New File: `src/components/ledger/salary/SalaryLedgerFilters.tsx`

Filter bar component. Props: `{ filters: SalaryLedgerFilters, onChange: (f: SalaryLedgerFilters) => void }`.

```
Layout: horizontal row, wraps on mobile

Controls:
  1. Month Picker
     - HTML input type="month" (renders native month/year picker)
     - Default: current month
     - Label: "Month"

  2. Employee Select
     - Searchable dropdown populated from wagesStore.employees
     - Options: "All Employees" (null) + each employee name
     - Label: "Employee"

  3. Bank Select
     - Dropdown populated from bankStore.banks
     - Options: "All Banks" (null) + each bank name
     - Label: "Bank"

  4. Reset Button
     - Resets all filters to defaults
     - Label: "Reset"
```

### 11.4 New File: `src/components/ledger/salary/SalaryLedgerTable.tsx`

Table of salary transactions. Props: `{ transactions: SalaryTransaction[], onRowClick: (tx: SalaryTransaction) => void }`.

```
COLUMNS:
  #     | Date & Time          | Employee      | Mode      | Breakdown            | Gross Paid  | Bank
  ───────────────────────────────────────────────────────────────────────────────────────────────────
  1     | 15 Jul 2025, 14:32   | Ramesh Kumar  | Per Bag   | 120 bags × ₹4.50    | ₹540.00     | HDFC Operations
  2     | 14 Jul 2025, 09:10   | Priya Singh   | Hourly    | 8 hrs × ₹120        | ₹960.00     | SBI Payroll
  3     | 01 Jul 2025, 11:00   | Arjun Das     | Fixed     | Monthly salary       | ₹18,000.00  | HDFC Operations

Column details:
  - "#": row number (1-indexed)
  - "Date & Time": format paidAt as "DD MMM YYYY, HH:mm"
  - "Mode": pill badge
      fixed → grey/neutral badge "Fixed"
      hourly → blue badge "Hourly"
      perBag → amber badge "Per Bag"
  - "Breakdown":
      fixed → "Monthly salary"
      hourly → "{hoursWorked} hrs × ₹{rateApplied}"
      perBag → "{bagsCompleted} bags × ₹{rateApplied}"
  - "Gross Paid": right-aligned, bold, green text
  - Each row is clickable → fires onRowClick(tx)

Empty state: "No salary payments found for the selected period."
Loading state: skeleton rows (5 rows)

FOOTER ROW (shown when transactions.length > 0):
  Total paid this period: ₹{sum of all grossAmount}
```

### 11.5 New File: `src/components/ledger/salary/SalaryLedgerDetailDrawer.tsx`

Slide-over drawer. Props: `{ transaction: SalaryTransaction | null, onClose: () => void }`.

Renders when `transaction !== null`.

```
DRAWER TITLE: "Payment Details"

CONTENT:
  Section: Employee
    Name: {employeeName}
    Contract: Monthly / Daily
    Wage Mode: Fixed Salary / Hourly / Per Bag

  Section: Payment Breakdown
    [IF fixed]:
      Fixed Monthly Salary: ₹{grossAmount}
    [IF hourly]:
      Hourly Rate:   ₹{rateApplied}/hr
      Hours Worked:  {hoursWorked} hrs
      ───────────────────────
      Gross Amount:  ₹{grossAmount}
    [IF perBag]:
      Rate per Bag:     ₹{rateApplied}/bag
      Bags Completed:   {bagsCompleted}
      ──────────────────────────────
      Gross Amount:     ₹{grossAmount}

  Section: Bank
    Paid From: {bankName}
    Bank ID:   {bankId}

  Section: Audit
    Paid At:   {paidAt formatted as full ISO + local time}
    Paid By:   {paidByName}
    Ref ID:    {transaction.id}

BUTTON: "Close"
```

---

## 12. ATOMIC TRANSACTION LOGIC

The `paySalary` action in `wagesStore` must execute all Firestore writes inside a single `runTransaction` call. The exact order:

```
1. READ banks/{bankId}
   → Verify principalAmount >= grossAmount
   → If not: throw new Error("Insufficient funds: ...")

2. WRITE salaryTransactions/{newId}
   → All fields from PaySalaryPayload + computed fields

3. WRITE banks/{bankId}/transactions/{newId}
   → type: 'debit', amount, balanceAfter, relatedSalaryTxId, payee info

4. UPDATE banks/{bankId}
   → principalAmount: principalAmount - grossAmount
   → updatedAt: serverTimestamp()

5. UPDATE employees/{employeeId}
   → payLog: arrayUnion({ salaryTxId, grossAmount, paidAt, bankId, bankName, wageMode })
   → updatedAt: serverTimestamp()
```

All 5 operations are in one `runTransaction` block. If any step fails, all are rolled back automatically by Firestore. The UI catches the thrown error and displays it as a toast notification.

**Error handling in the UI (PayWageModal):**
```ts
try {
  await paySalary(payload);
  toast.success('Salary paid successfully!');
  onClose();
} catch (err: any) {
  if (err.message?.startsWith('Insufficient funds')) {
    toast.error(err.message);
  } else {
    toast.error('Payment failed. Please try again.');
    console.error(err);
  }
}
```

---

## 13. DEFAULT BANK SEEDING

**Trigger:** Call `seedDefaultBanksIfEmpty()` inside a `useEffect` in `BankTab.tsx` before subscribing to banks.

```tsx
// In BankTab.tsx
useEffect(() => {
  let unsub: () => void;
  seedDefaultBanksIfEmpty()
    .then(() => { unsub = subscribeBanks(); })
    .catch(console.error);
  return () => { if (unsub) unsub(); };
}, []);
```

The three default banks are:
1. `HDFC Operations Account` — principalAmount: 0, isDefault: true
2. `SBI Payroll Account` — principalAmount: 0, isDefault: true
3. `Petty Cash Fund` — principalAmount: 0, isDefault: true

After seeding, admins are expected to use `AdjustPrincipalModal` to set the actual opening balance of each bank.

---

## 14. FIRESTORE SECURITY RULES ADDITIONS

Add these rules to the existing `firestore.rules` file. Do not remove existing rules.

```firestore
// Banks — Admin and SuperAdmin only
match /banks/{bankId} {
  allow read: if isAuthenticated() && isActiveUser();
  allow create, update: if isAuthenticated() && isAdmin();
  allow delete: if isAuthenticated() && isSuperAdmin();

  match /transactions/{txId} {
    allow read: if isAuthenticated() && isActiveUser();
    allow create: if isAuthenticated() && isAdmin();
    allow update, delete: if false; // Transactions are immutable
  }
}

// Salary Transactions — immutable once written
match /salaryTransactions/{txId} {
  allow read: if isAuthenticated() && isActiveUser();
  allow create: if isAuthenticated() && isAdmin();
  allow update, delete: if false; // Salary records are immutable
}
```

Assumes the following helper functions already exist in your rules:
- `isAuthenticated()` — checks `request.auth != null`
- `isActiveUser()` — checks user status === 'active' in Firestore
- `isAdmin()` — checks role is 'admin' or 'superAdmin'
- `isSuperAdmin()` — checks role is 'superAdmin'

---

## 15. FIRESTORE INDEX DEFINITIONS

Add to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "salaryTransactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "month", "order": "ASCENDING" },
        { "fieldPath": "paidAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "salaryTransactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "employeeId", "order": "ASCENDING" },
        { "fieldPath": "paidAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "salaryTransactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "bankId", "order": "ASCENDING" },
        { "fieldPath": "paidAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "salaryTransactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "month", "order": "ASCENDING" },
        { "fieldPath": "employeeId", "order": "ASCENDING" },
        { "fieldPath": "paidAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "salaryTransactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "month", "order": "ASCENDING" },
        { "fieldPath": "bankId", "order": "ASCENDING" },
        { "fieldPath": "paidAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 16. COMPLETE FILE TREE

```
src/
├── types/
│   ├── employee.ts              ← UPDATE (add BankDetails, EmployeePayLogEntry, new fields)
│   ├── bank.ts                  ← NEW
│   └── salaryTransaction.ts     ← NEW
│
├── schemas/
│   ├── employeeSchema.ts        ← UPDATE (add address, bankDetails, dailyWageMode, ratePerBag)
│   └── bankSchema.ts            ← NEW
│
├── stores/
│   ├── wagesStore.ts            ← UPDATE (add paySalary, fetchSalaryLedger, salaryLedger state)
│   └── bankStore.ts             ← NEW
│
├── utils/
│   ├── wageCalculator.ts        ← NEW
│   └── seedDefaultBanks.ts      ← NEW
│
├── components/
│   ├── wages/
│   │   ├── WagesPage.tsx        ← UPDATE (add Bank tab)
│   │   ├── EmployeeCard.tsx     ← UPDATE (show address, bankDetails, payLog)
│   │   ├── EmployeeForm.tsx     ← UPDATE (add address, bankDetails, dailyWageMode, ratePerBag)
│   │   ├── PayWageModal.tsx     ← UPDATE (bank selector, per-bag inputs, gross preview)
│   │   └── bank/
│   │       ├── BankTab.tsx             ← NEW
│   │       ├── BankCard.tsx            ← NEW
│   │       ├── CreateBankModal.tsx     ← NEW
│   │       ├── AdjustPrincipalModal.tsx← NEW
│   │       └── BankTransactionLog.tsx  ← NEW
│   │
│   └── ledger/
│       ├── LedgerPage.tsx       ← UPDATE (add Salary Ledger tab)
│       └── salary/
│           ├── SalaryLedgerTab.tsx         ← NEW
│           ├── SalaryLedgerFilters.tsx     ← NEW
│           ├── SalaryLedgerTable.tsx       ← NEW
│           └── SalaryLedgerDetailDrawer.tsx← NEW
│
├── firestore.rules              ← UPDATE (add banks + salaryTransactions rules)
└── firestore.indexes.json       ← UPDATE (add 6 new composite indexes)
```

---

## 17. IMPLEMENTATION ORDER

Implement in this exact order to avoid import/dependency errors:

```
Phase 1 — Types & Schemas (no Firebase, no UI)
  1.1  src/types/bank.ts
  1.2  src/types/salaryTransaction.ts
  1.3  src/types/employee.ts  ← update
  1.4  src/schemas/employeeSchema.ts  ← update
  1.5  src/schemas/bankSchema.ts

Phase 2 — Pure Utilities (no Firebase, no UI)
  2.1  src/utils/wageCalculator.ts
  2.2  src/utils/seedDefaultBanks.ts

Phase 3 — Stores (Firebase, no UI)
  3.1  src/stores/bankStore.ts
  3.2  src/stores/wagesStore.ts  ← update (add paySalary, fetchSalaryLedger)

Phase 4 — Employee Form & Card (UI, depends on Phase 1 + 3)
  4.1  src/components/wages/EmployeeForm.tsx  ← update
  4.2  src/components/wages/EmployeeCard.tsx  ← update

Phase 5 — Pay Wage Modal (UI, depends on Phase 2 + 3)
  5.1  src/components/wages/PayWageModal.tsx  ← update

Phase 6 — Bank Tab components (UI, depends on Phase 3)
  6.1  src/components/wages/bank/BankTransactionLog.tsx
  6.2  src/components/wages/bank/AdjustPrincipalModal.tsx
  6.3  src/components/wages/bank/CreateBankModal.tsx
  6.4  src/components/wages/bank/BankCard.tsx
  6.5  src/components/wages/bank/BankTab.tsx
  6.6  src/components/wages/WagesPage.tsx  ← update (add Bank tab)

Phase 7 — Salary Ledger (UI, depends on Phase 3)
  7.1  src/components/ledger/salary/SalaryLedgerFilters.tsx
  7.2  src/components/ledger/salary/SalaryLedgerDetailDrawer.tsx
  7.3  src/components/ledger/salary/SalaryLedgerTable.tsx
  7.4  src/components/ledger/salary/SalaryLedgerTab.tsx
  7.5  src/components/ledger/LedgerPage.tsx  ← update (add Salary Ledger tab)

Phase 8 — Infrastructure
  8.1  firestore.rules  ← update
  8.2  firestore.indexes.json  ← update
```

---

*End of blueprint. All sections above are complete specifications. The agent must not infer missing details — everything needed to build is defined here.*
