import { create } from 'zustand';
import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  runTransaction, serverTimestamp, query, orderBy,
  getDocs, deleteDoc
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
  deleteBank: (bankId: string) => Promise<void>;
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

  deleteBank: async (bankId) => {
    await deleteDoc(doc(db, 'banks', bankId));
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
