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
