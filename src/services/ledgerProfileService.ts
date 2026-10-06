import {
  collection, doc, getDocs, query, where, orderBy,
  addDoc, updateDoc, deleteDoc, runTransaction, setDoc,
  serverTimestamp, increment, Timestamp, getDoc, writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LedgerEntry, ManualLedgerEntryForm, LedgerProfile, LedgerEntryType } from "@/types/ledger-profile";
import { hasConvertiblePattern } from "@/lib/ledgerUnitConversion";
import { PaymentVoucherFormValues } from "@/components/deals/PaymentVoucher/paymentVoucherSchema";
import { useAuthStore } from "@/stores/authStore";
import { toNum } from "@/utils/number";

// ── Fetch profile for a given entity ────────────────────────────────────────
export async function getLedgerProfile(entityId: string): Promise<LedgerProfile | null> {
  const q = query(
    collection(db, "ledgerProfiles"),
    where("entityId", "==", entityId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { ...(docSnap.data() as LedgerProfile), id: docSnap.id };
}

// ── Fetch all profiles for a given entity type ──────────────────────────────
export async function getLedgerProfilesByType(
  entityType: "supplier" | "customer" | "miscellaneous"
): Promise<Record<string, LedgerProfile>> {
  const q = query(
    collection(db, "ledgerProfiles"),
    where("entityType", "==", entityType)
  );
  const snap = await getDocs(q);
  const result: Record<string, LedgerProfile> = {};
  
  snap.docs.forEach((d) => {
    const profile: LedgerProfile = { ...(d.data() as LedgerProfile), id: d.id };
    if (!profile.entityId) {
      console.error("[ledger] profile without entityId", d.id);
      return;
    }
    const existing = result[profile.entityId];
    if (existing) {
      console.error(
        `[ledger] DUPLICATE profiles for ${entityType}:${profile.entityId}`,
        existing.id,
        profile.id
      );
      // keep the one that follows the documented convention `${entityType}_${entityId}`
      if (existing.id === `${entityType}_${profile.entityId}`) return;
    }
    result[profile.entityId] = profile;
  });
  
  return result;
}

// ── Fetch all entries for a profile (optionally filtered by date range) ──────
export async function getLedgerEntries(
  profileId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<LedgerEntry[]> {
  const q = query(
    collection(db, `ledgerProfiles/${profileId}/entries`),
    orderBy("date", "asc")
  );
  // Note: Firestore range filters require composite index on date
  const snap = await getDocs(q);
  let entries = snap.docs.map((d) => d.data() as LedgerEntry);

  // Secondary sort by createdAt to handle entries on the exact same date
  entries.sort((a, b) => {
    // Strip time for business date comparison to treat all same-day entries equally
    const dateA = a.date.toDate();
    dateA.setHours(0, 0, 0, 0);
    
    const dateB = b.date.toDate();
    dateB.setHours(0, 0, 0, 0);

    const dDiff = dateA.getTime() - dateB.getTime();
    if (dDiff !== 0) return dDiff;
    
    // If business dates are the same, sort strictly by exact creation order
    const aCreated = a.createdAt?.toMillis() || 0;
    const bCreated = b.createdAt?.toMillis() || 0;
    return aCreated - bCreated;
  });

  // Client-side date filter (avoids extra index for optional range)
  if (dateFrom) entries = entries.filter((e) => e.date.toDate() >= dateFrom);
  if (dateTo)   entries = entries.filter((e) => e.date.toDate() <= dateTo);

  return entries;
}

export async function getLedgerEntryCount(profileId: string): Promise<number> {
  const q = collection(db, `ledgerProfiles/${profileId}/entries`);
  const snap = await getDocs(q);
  return snap.size;
}

export async function deleteLedgerProfile(profileId: string): Promise<void> {
  const profileRef = doc(db, "ledgerProfiles", profileId);
  const entriesRef = collection(db, `ledgerProfiles/${profileId}/entries`);
  
  const snap = await getDocs(entriesRef);
  const entries = snap.docs.map(d => d.data() as LedgerEntry);
  
  const profileSnap = await getDoc(profileRef);
  const closingBalance = profileSnap.exists() ? toNum(profileSnap.data().closingBalance) : 0;
  
  for (const entry of entries) {
    if (entry.bankId) {
      throw new Error("Cannot delete profile: Contains entries linked to bank transactions.");
    }
    if (entry.isSystemGenerated && closingBalance !== 0) {
      throw new Error("Cannot delete profile: Contains system-generated entries and has a non-zero closing balance.");
    }
  }

  const CHUNK_SIZE = 400;
  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let opCount = 0;

  for (const entryDoc of snap.docs) {
    currentBatch.delete(entryDoc.ref);
    opCount++;
    if (opCount === CHUNK_SIZE) {
      batches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  }
  if (opCount > 0) {
    batches.push(currentBatch.commit());
  }
  
  await Promise.all(batches);
  await deleteDoc(profileRef);
}

/** Keep the denormalised ledgerProfiles.entityName in sync when an entity is renamed. */
export async function syncLedgerProfileName(
  entityType: "supplier" | "customer" | "miscellaneous",
  entityId: string,
  entityName: string
): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, "ledgerProfiles"),
      where("entityType", "==", entityType),
      where("entityId", "==", entityId)
    )
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) =>
    batch.update(d.ref, { entityName, updatedAt: serverTimestamp() })
  );
  await batch.commit();
}

// ── Add a manual ledger entry ────────────────────────────────────────────────
export async function addManualLedgerEntry(
  profileId: string,
  entityId: string,
  entityType: "supplier" | "customer" | "miscellaneous",
  form: ManualLedgerEntryForm
): Promise<void> {
  const amount = toNum(form.amount);
  const debit  = form.entryKind === "debit"  ? amount : 0;
  const credit = form.entryKind === "credit" ? amount : 0;

  const willMoveFunds = !!form.bankId && form.recordFundMovement !== false;

  await runTransaction(db, async (transaction) => {
    let bankSnap = null;
    let bankRef = null;
    let bankTxnRef = null;
    let currentBalance = 0;

    if (willMoveFunds && form.bankId) {
      bankRef = doc(db, "banks", form.bankId);
      bankTxnRef = doc(collection(db, "banks", form.bankId, "transactions"));
      bankSnap = await transaction.get(bankRef);
      if (!bankSnap.exists()) throw new Error("Selected bank not found.");
      currentBalance = bankSnap.data().principalAmount as number;

      if (form.bankMovementDirection === "debit") {
        if (currentBalance - amount < 0) {
          throw new Error("Insufficient bank balance for this manual entry.");
        }
      }
    }

    const profileRef = doc(db, "ledgerProfiles", profileId);
    const profileSnap = await transaction.get(profileRef);
    const entityName = profileSnap.exists() ? profileSnap.data().entityName : entityId;
    const entryRef   = doc(collection(db, `ledgerProfiles/${profileId}/entries`));

    let finalSub = form.subParticulars ?? "";
    if (form.quantityKg !== undefined && form.pricePerUnit !== undefined) {
      const formattedRate = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(form.pricePerUnit);
      const stockStr = `${form.quantityKg} kg @ ₹${formattedRate}/unit`;
      finalSub = finalSub ? `${finalSub} | ${stockStr}` : stockStr;
    }

    const entryData: any = {
      id: entryRef.id,
      profileId,
      entityId,
      entityType,
      date: Timestamp.fromDate(new Date(form.date)),
      particulars: form.riceType ? `${form.particulars} - ${form.riceType}` : form.particulars,
      subParticulars: finalSub,
      vchType: form.vchType,
      vchNo: form.vchNo,
      debit,
      credit,
      entryType: form.entryKind === "debit" ? "manual_debit" : "manual_credit",
      isManual: true,
      isSystemGenerated: false,
      bankId: form.bankId ?? null,
      bankName: bankSnap ? (bankSnap.data().name as string) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (form.quantityKg !== undefined) entryData.quantityKg = form.quantityKg;
    if (form.pricePerUnit !== undefined) entryData.pricePerUnit = form.pricePerUnit;
    if (form.riceType) entryData.riceType = form.riceType;

    transaction.set(entryRef, entryData);

    transaction.update(profileRef, {
      totalDebit:     increment(debit),
      totalCredit:    increment(credit),
      closingBalance: increment(debit - credit),
      updatedAt: serverTimestamp(),
    });

    if (willMoveFunds && bankRef && bankTxnRef && form.bankMovementDirection) {
      const delta = form.bankMovementDirection === "credit" ? amount : -amount;
      const newBalance = currentBalance + delta;

      transaction.update(bankRef, { principalAmount: increment(delta), updatedAt: serverTimestamp() });

      transaction.set(bankTxnRef, {
        id: bankTxnRef.id,
        type: form.bankMovementDirection,
        amount: amount,
        balanceAfter: newBalance,
        relatedSalaryTxId: null,
        payeeEmployeeId: null,
        payeeEmployeeName: null,
        note: `Ledger: ${form.particulars} (${entityType} — ${entityName})`,
        performedBy: useAuthStore.getState().user?.uid || "unknown",
        createdAt: serverTimestamp(),
        relatedLedgerEntryId: entryRef.id,
        relatedProfileId: profileId,
      });
    }
  });
}

// ── Add a payment voucher entry (Phase 2) ────────────────────────────────────
export async function postPaymentVoucherEntry(input: PaymentVoucherFormValues & { source: 'manual-payment' | 'manual-receipt' }): Promise<void> {
  const profileRef = doc(db, 'ledgerProfiles', input.profileId);
  const entryRef = doc(collection(profileRef, 'entries'));

  await runTransaction(db, async (transaction) => {
    const profileSnap = await transaction.get(profileRef);
    if (!profileSnap.exists()) {
      throw new Error(`Ledger profile ${input.profileId} not found`);
    }

    // Direction logic per the validated convention:
    // Supplier Payment -> Credit (reduces positive closing balance)
    // Customer Payment -> Debit (reduces negative closing balance)
    const direction = input.entityType === 'supplier' ? 'credit' : 'debit';
    const amount = toNum(input.amount);
    const debit = direction === 'debit' ? amount : 0;
    const credit = direction === 'credit' ? amount : 0;

    const entryData: any = {
      id: entryRef.id,
      profileId: input.profileId,
      entityId: profileSnap.data().entityId,
      entityType: input.entityType,
      date: Timestamp.fromDate(new Date(input.paymentDate)),
      particulars: `Payment - ${input.paymentMode.replace('_', ' ').toUpperCase()}`,
      subParticulars: input.referenceNumber ? `Ref: ${input.referenceNumber}` : "",
      vchType: "Payment",
      vchNo: Math.floor(Math.random() * 1000000) || 1, // Keep same vchNo logic for compatibility
      debit,
      credit,
      entryType: direction === 'debit' ? "manual_debit" : "manual_credit",
      isManual: true,
      isSystemGenerated: false,
      note: input.note ?? null,
      source: input.source,
      mode: input.paymentMode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.set(entryRef, entryData);

    transaction.update(profileRef, {
      totalDebit: increment(debit),
      totalCredit: increment(credit),
      closingBalance: increment(debit - credit),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteManualLedgerEntry(
  profileId: string,
  entry: LedgerEntry
): Promise<void> {
  // 1. Fetch related bank transaction outside the transaction to know how to reverse it
  let relatedTxnDoc: any = null;
  if (entry.bankId) {
    const q = query(
      collection(db, "banks", entry.bankId, "transactions"),
      where("relatedLedgerEntryId", "==", entry.id)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      relatedTxnDoc = snap.docs[0];
    }
  }

  await runTransaction(db, async (transaction) => {
    // ---- READS ----
    let bankSnap = null;
    let bankRef = null;
    let currentBalance = 0;
    
    // Only reverse fund movement if it actually involved a bank
    if (entry.bankId && relatedTxnDoc) {
      bankRef = doc(db, "banks", entry.bankId);
      bankSnap = await transaction.get(bankRef);
      if (bankSnap.exists()) {
        currentBalance = bankSnap.data().principalAmount as number;
      } else {
        bankRef = null; // if bank was deleted since, we can't reverse it
      }
    }

    // ---- WRITES ----
    const entryRef   = doc(db, `ledgerProfiles/${profileId}/entries`, entry.id);
    const profileRef = doc(db, "ledgerProfiles", profileId);

    transaction.delete(entryRef);
    transaction.update(profileRef, {
      totalDebit:     increment(-entry.debit),
      totalCredit:    increment(-entry.credit),
      closingBalance: increment(-(entry.debit - entry.credit)),
      updatedAt: serverTimestamp(),
    });

    if (bankRef && bankSnap && relatedTxnDoc) {
      const origData = relatedTxnDoc.data();
      // Reverse the effect on the bank's principal amount
      const reversalType = origData.type === "credit" ? "debit" : "credit";
      const delta = reversalType === "credit" ? origData.amount : -origData.amount;
      
      transaction.update(bankRef, { principalAmount: increment(delta), updatedAt: serverTimestamp() });

      // Delete the original bank transaction
      transaction.delete(relatedTxnDoc.ref);
    }
  });
}

export async function updateLedgerEntryVchNo(
  profileId: string,
  entryId: string,
  newVchNo: number
): Promise<void> {
  const entryRef = doc(db, `ledgerProfiles/${profileId}/entries`, entryId);
  await updateDoc(entryRef, {
    vchNo: newVchNo,
    updatedAt: serverTimestamp(),
  });
}

// ── Update Ledger Entry ──────────────────────────────────────────────────────
export async function updateLedgerEntry(
  profileId: string,
  entryId: string,
  updates: Partial<LedgerEntry>
): Promise<void> {
  const entryRef = doc(db, `ledgerProfiles/${profileId}/entries`, entryId);
  const safeUpdates: any = { ...updates, updatedAt: serverTimestamp() };
  if (updates.date && updates.date instanceof Date) {
    safeUpdates.date = Timestamp.fromDate(updates.date);
  }
  // Remove fields that should not be edited
  delete safeUpdates.id;
  delete safeUpdates.debit;
  delete safeUpdates.credit;
  delete safeUpdates.createdAt;
  await updateDoc(entryRef, safeUpdates);
}

// ── Update Ledger Entry Debit/Credit Amount (Atomic) ─────────────────────────
// This is the ONLY safe way to mutate debit/credit values on any entry type.
// It reads the existing amounts inside the transaction to compute precise deltas,
// then updates both the entry doc and the parent LedgerProfile totals atomically.
export async function updateLedgerEntryAmount(
  profileId: string,
  entryId: string,
  newDebit: number,
  newCredit: number
): Promise<void> {
  const nDebit = toNum(newDebit);
  const nCredit = toNum(newCredit);

  if (nDebit < 0 || nCredit < 0) {
    throw new Error("Debit and Credit amounts must be non-negative.");
  }

  const entryRef = doc(db, `ledgerProfiles/${profileId}/entries`, entryId);
  const profileRef = doc(db, "ledgerProfiles", profileId);

  // 1. Fetch entry beforehand to see if it is tied to a deal
  const initialEntrySnap = await getDoc(entryRef);
  if (!initialEntrySnap.exists()) {
    throw new Error(`Ledger entry ${entryId} not found.`);
  }
  const initialEntry = initialEntrySnap.data() as LedgerEntry;
  const dealId = initialEntry.relatedDocId;
  const isPurchase = initialEntry.vchType === "Purchase" || initialEntry.entryType === "delivery_confirmed";

  // 2. Fetch related Deal and SupplierLedger docs before transaction
  let dealRef: any = null;
  let supplierLedgerDocs: any[] = [];
  
  if (dealId && isPurchase) {
    dealRef = doc(db, "deals", dealId);
    const supplierLedgerQuery = query(
      collection(db, "supplierLedgerEntries"),
      where("dealId", "==", dealId)
    );
    const supplierLedgerSnap = await getDocs(supplierLedgerQuery);
    supplierLedgerDocs = supplierLedgerSnap.docs;
  }

  await runTransaction(db, async (transaction) => {
    // Read current state inside the transaction for consistent delta calculation
    const entrySnap = await transaction.get(entryRef);
    if (!entrySnap.exists()) {
      throw new Error(`Ledger entry ${entryId} not found.`);
    }

    const currentData = entrySnap.data() as LedgerEntry;
    
    // ── All Reads Must Come Before Writes in Firestore Transactions ──
    let dealSnap: any = null;
    if (dealRef && currentData.quantityKg && currentData.quantityKg > 0) {
      dealSnap = await transaction.get(dealRef);
    }

    const oldDebit = toNum(currentData.debit);
    const oldCredit = toNum(currentData.credit);

    const debitDelta = nDebit - oldDebit;
    const creditDelta = nCredit - oldCredit;

    let newPricePerUnit = currentData.pricePerUnit;
    let newSubParticulars = currentData.subParticulars;

    // Recalculate unit price and rewrite subParticulars if quantity is available
    if (currentData.quantityKg && currentData.quantityKg > 0) {
      const totalValue = nDebit > 0 ? nDebit : nCredit;
      newPricePerUnit = totalValue / currentData.quantityKg;
      
      if (newSubParticulars && hasConvertiblePattern(newSubParticulars)) {
        const regex = /(\d+(?:\.\d+)?)\s*kg\s*@\s*₹([\d,]+(?:\.\d+)?)\/(kg|unit)/;
        newSubParticulars = newSubParticulars.replace(regex, (match, qtyStr, oldPriceStr, suffix) => {
          // Reformat price with 2 decimal places in en-IN locale
          const formattedNewPrice = newPricePerUnit!.toLocaleString("en-IN", {
             minimumFractionDigits: 2,
             maximumFractionDigits: 2,
          });
          // Note: using the matched suffix so we don't accidentally override "/unit" if it was used
          return `${qtyStr} kg @ ₹${formattedNewPrice}/${suffix}`;
        });
      }
    }

    // Write the new amounts to the entry document
    transaction.update(entryRef, {
      debit: nDebit,
      credit: nCredit,
      ...(newPricePerUnit !== currentData.pricePerUnit && { pricePerUnit: newPricePerUnit }),
      ...(newSubParticulars !== currentData.subParticulars && { subParticulars: newSubParticulars }),
      updatedAt: serverTimestamp(),
    });

    // Atomically cascade the delta to parent profile totals
    transaction.update(profileRef, {
      totalDebit: increment(debitDelta),
      totalCredit: increment(creditDelta),
      // closingBalance = totalDebit - totalCredit
      closingBalance: increment(debitDelta - creditDelta),
      updatedAt: serverTimestamp(),
    });

    // ── Cascade to Deal and SupplierLedgerEntry ──
    if (dealSnap && dealSnap.exists()) {
      const totalValue = nDebit > 0 ? nDebit : nCredit;
      transaction.update(dealRef, {
        pricePerKg: newPricePerUnit,
        totalCost: totalValue,
        updatedAt: serverTimestamp(),
      });

      // Update all related supplier ledger entries
      for (const sLedgerDoc of supplierLedgerDocs) {
        // Double check the event type is purchase-related if necessary,
        // but typically all deal-tied entries in supplier ledger need price sync.
        transaction.update(sLedgerDoc.ref, {
           pricePerKg: newPricePerUnit,
           totalValue: totalValue,
        });
      }
    }
  });
}

// ── Update Mill Profile Settings ─────────────────────────────────────────────
export async function updateLedgerProfileSettings(
  profileId: string,
  settings: { millName: string; millDescription: string }
): Promise<void> {
  const profileRef = doc(db, "ledgerProfiles", profileId);
  await updateDoc(profileRef, {
    millName: settings.millName,
    millDescription: settings.millDescription,
    updatedAt: serverTimestamp(),
  });
}

// ── Update ALL Mill Profile Settings (Global Settings) ───────────────────────
export async function updateAllLedgerProfilesSettings(
  settings: { millName: string; millDescription: string; millContact?: string }
): Promise<void> {
  const profilesSnap = await getDocs(collection(db, "ledgerProfiles"));
  
  // Use batched writes for efficiency
  const batches: any[] = [];
  const currentBatch: any = null;
  const opCount = 0;

  // We have to import writeBatch if we want to use it properly, but we can also just run normal updateDocs if there aren't too many.
  // Actually, let's just do Promise.all with updateDoc since the number of profiles is relatively small (e.g. 50-500)
  const promises = profilesSnap.docs.map(d => 
    updateDoc(d.ref, {
      millName: settings.millName,
      millDescription: settings.millDescription,
      ...(settings.millContact !== undefined ? { millContact: settings.millContact } : {}),
      updatedAt: serverTimestamp()
    })
  );
  
  await Promise.all(promises);
}

// ── Reorder ledger entry (Drag & Drop) ───────────────────────────────────────
export async function reorderLedgerEntry(
  profileId: string,
  entryId: string,
  newCreatedAtMillis: number,
  newDateMillis?: number
): Promise<void> {
  const entryRef = doc(db, `ledgerProfiles/${profileId}/entries`, entryId);
  const updates: any = {
    createdAt: Timestamp.fromMillis(newCreatedAtMillis),
    updatedAt: serverTimestamp(),
  };
  if (newDateMillis !== undefined) {
    updates.date = Timestamp.fromMillis(newDateMillis);
  }
  await updateDoc(entryRef, updates);
}

// ── Ensure a LedgerProfile exists for a given entity ─────────────────────────
// Idempotent: uses a deterministic doc ID so calling it twice is safe.
// Uses setDoc with { merge: true } so it will not overwrite existing aggregate
// totals (totalDebit, totalCredit, closingBalance) on subsequent calls.
export async function ensureLedgerProfile(
  entityType: "supplier" | "customer" | "miscellaneous",
  entityId: string,
  entityName: string,
  millDefaults: { millName: string; millDescription: string; millContact?: string }
): Promise<void> {
  // Deterministic ID convention: "<entityType>_<entityId>"
  // This matches the pattern used by supplierService/customerService's writeBatch:
  // those use doc(collection(db, "ledgerProfiles")) which generates a random ID,
  // but for ensure semantics we use a predictable ID so it is truly idempotent.
  const profileId = `${entityType}_${entityId}`;
  const profileRef = doc(db, "ledgerProfiles", profileId);
  await setDoc(
    profileRef,
    {
      id: profileId,
      entityId,
      entityType,
      entityName,
      millName: millDefaults.millName,
      millDescription: millDefaults.millDescription,
      millContact: millDefaults.millContact ?? "",
      totalDebit: 0,
      totalCredit: 0,
      closingBalance: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true } // preserve existing totalDebit/totalCredit/closingBalance on re-calls
  );
}
