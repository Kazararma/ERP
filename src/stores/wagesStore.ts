import { create } from 'zustand';
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  runTransaction,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
  arrayUnion,
  Timestamp
} from 'firebase/firestore';
import { SalaryTransaction, SalaryLedgerFilters, PaySalaryPayload } from '@/types/salaryTransaction';
import { Employee } from '@/types/employee';
import { calculateGross } from '@/utils/wageCalculator';
import { format } from 'date-fns';

interface WagesState {
  employees: Employee[];
  isLoading: boolean;
  salaryLedger: SalaryTransaction[];
  ledgerLoading: boolean;
}

interface WagesActions {
  fetchEmployees: () => () => void;
  paySalary: (payload: PaySalaryPayload) => Promise<void>;
  fetchSalaryLedger: (filters: SalaryLedgerFilters) => Promise<void>;
}

export const useWagesStore = create<WagesState & WagesActions>((set, get) => ({
  employees: [],
  isLoading: false,
  salaryLedger: [],
  ledgerLoading: false,

  fetchEmployees: () => {
    set({ isLoading: true });
    const q = query(collection(db, 'employees'));
    return onSnapshot(q, (snap) => {
      const employees = snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee))
        .sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      set({ employees, isLoading: false });
    });
  },

  paySalary: async (payload) => {
    const { employee, bankId, bankName, wageMode, fixedMonthlySalary, hourlyRate, ratePerBag, hoursWorked, bagsCompleted, paidBy, paidByName } = payload;

    const grossAmount = calculateGross({
      wageMode,
      fixedMonthlySalary: fixedMonthlySalary ?? employee.fixedMonthlySalary,
      hourlyRate: hourlyRate ?? employee.hourlyRate,
      ratePerBag: ratePerBag ?? employee.ratePerBag,
      hoursWorked,
      bagsCompleted,
    });

    const rateApplied =
      wageMode === 'fixed' ? (fixedMonthlySalary ?? employee.fixedMonthlySalary ?? 0)
      : wageMode === 'hourly' ? (hourlyRate ?? employee.hourlyRate ?? 0)
      : (ratePerBag ?? employee.ratePerBag ?? 0);

    const month = format(new Date(), 'yyyy-MM');

    const resolvedEmployeeId = employee.id || (employee as any).employeeId;
    if (!resolvedEmployeeId) throw new Error('Employee ID is missing');

    const bankRef = doc(db, 'banks', bankId);
    const salaryTxRef = doc(collection(db, 'salaryTransactions'));
    const bankTxRef = doc(collection(db, 'banks', bankId, 'transactions'));
    const employeeRef = doc(db, 'employees', resolvedEmployeeId);

    await runTransaction(db, async (tx) => {
      // 1. READ banks/{bankId}
      const bankSnap = await tx.get(bankRef);
      if (!bankSnap.exists()) throw new Error('Selected bank not found');

      const currentBalance = bankSnap.data().principalAmount as number;
      if (currentBalance < grossAmount) {
        throw new Error(`Insufficient funds: bank balance ₹${currentBalance.toLocaleString()} is less than salary ₹${grossAmount.toLocaleString()}`);
      }

      const newBalance = currentBalance - grossAmount;

      // 2. WRITE salaryTransactions/{newId}
      tx.set(salaryTxRef, {
        employeeId: resolvedEmployeeId,
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

      // 3. WRITE banks/{bankId}/transactions/{newId}
      tx.set(bankTxRef, {
        type: 'debit',
        amount: grossAmount,
        balanceAfter: newBalance,
        relatedSalaryTxId: salaryTxRef.id,
        payeeEmployeeId: resolvedEmployeeId,
        payeeEmployeeName: employee.name,
        note: `Salary: ${employee.name}`,
        performedBy: paidBy,
        createdAt: serverTimestamp(),
      });

      // 4. UPDATE banks/{bankId}
      tx.update(bankRef, { principalAmount: newBalance, updatedAt: serverTimestamp() });

      // 5. UPDATE employees/{employeeId}
      tx.update(employeeRef, {
        payLog: arrayUnion({
          salaryTxId: salaryTxRef.id,
          grossAmount,
          paidAt: Timestamp.fromDate(new Date()),
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
}));
