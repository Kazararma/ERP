import {
  runTransaction,
  doc,
  collection,
  serverTimestamp,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BulkLedgerRow } from "@/schemas/bulkLedgerSchema";
import { useAuthStore } from "@/stores/authStore";
import { toNum } from "@/utils/number";

// ─── Internal types ────────────────────────────────────────────────────────────

interface ProfileGroup {
  profileId: string;
  entityType: BulkLedgerRow["ledgerType"];
  rows: BulkLedgerRow[];
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Posts an array of ledger rows across one or more profiles atomically.
 *
 * Algorithm:
 *   1. Group rows by profileId in memory — pre-aggregated so each profile
 *      is opened in exactly ONE runTransaction, preventing concurrent
 *      racing writes to the same profile's aggregate totals.
 *   2. Run one runTransaction PER PROFILE in parallel (Promise.all).
 *      Each transaction: reads the profile, writes all entry docs, then
 *      updates the profile totals with increment() — mirroring the exact
 *      pattern used by addManualLedgerEntry() in ledgerProfileService.ts.
 *
 * Ground rule compliance:
 *   - Uses runTransaction because writes depend on profile reads.
 *   - All reads before all writes inside each transaction.
 *   - Uses increment() (not raw arithmetic) to match the codebase convention
 *     and remain safe under concurrent access.
 */
export async function submitBulkLedgerEntries(rows: BulkLedgerRow[]): Promise<void> {
  // ── Step 1: Group rows by profileId ──────────────────────────────────────────
  const grouped = new Map<string, ProfileGroup>();
  for (const row of rows) {
    const existing = grouped.get(row.profileId);
    if (existing) {
      existing.rows.push(row);
    } else {
      grouped.set(row.profileId, {
        profileId: row.profileId,
        entityType: row.ledgerType,
        rows: [row],
      });
    }
  }

  // ── Step 2: Run one transaction per profile, all in parallel ─────────────────
  const jobs = Array.from(grouped.values()).map((group) =>
    runTransaction(db, async (transaction) => {
      // ── ALL READS FIRST ────────────────────────────────────────────────────
      const profileRef = doc(db, "ledgerProfiles", group.profileId);
      const profileSnap = await transaction.get(profileRef);
      if (!profileSnap.exists()) {
        throw new Error(`Ledger profile "${group.profileId}" not found`);
      }
      const profileData = profileSnap.data();
      const entityId: string = profileData.entityId;
      const entityName: string = profileData.entityName || profileData.name || "Unknown";

      // Find all unique banks needed for this profile's rows
      const bankIds = [...new Set(group.rows.filter(r => r.bankId && r.recordFundMovement).map(r => r.bankId!))];
      const bankSnaps = await Promise.all(bankIds.map(id => transaction.get(doc(db, "banks", id))));
      
      const bankBalances = new Map<string, number>();
      for (const snap of bankSnaps) {
        if (snap.exists()) {
          bankBalances.set(snap.id, snap.data().principalAmount || 0);
        }
      }

      // Pre-build entry refs before the write phase (refs are safe to create
      // before writes — they just generate document IDs, no Firestore call).
      const entryRefs = group.rows.map((row) => ({
        ref: doc(collection(db, "ledgerProfiles", group.profileId, "entries")),
        row,
      }));

      // ── ALL WRITES AFTER ALL READS ─────────────────────────────────────────
      let debitDelta = 0;
      let creditDelta = 0;

      for (const { ref: entryRef, row } of entryRefs) {
        const amount = toNum(row.amount);
        const isDebit = row.entryKind === "debit";

        if (isDebit) {
          debitDelta += amount;
        } else {
          creditDelta += amount;
        }

        // Entry shape mirrors addManualLedgerEntry() exactly:
        // same required fields, same field names, same serverTimestamp calls.
        const entryData: Record<string, unknown> = {
          id: entryRef.id,
          profileId: group.profileId,
          entityId,
          entityType: group.entityType,
          // Convert "YYYY-MM-DD" HTML date input to Firestore Timestamp
          date: Timestamp.fromDate(new Date(row.date + "T00:00:00")),
          particulars: row.particulars,
          subParticulars: row.subParticulars ?? "",
          refLabel: "",
          vchType: row.vchType,
          vchNo: row.vchNo,
          debit: isDebit ? amount : 0,
          credit: isDebit ? 0 : amount,
          entryType: isDebit ? "manual_debit" : "manual_credit",
          isManual: true,
          isSystemGenerated: false,
          bankId: row.bankId || null,
          bankName: null, // can be looked up or omitted
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        transaction.set(entryRef, entryData);

        // Record bank fund movement if requested
        if (row.bankId && row.recordFundMovement) {
          // Automated direction: Debit entry (Dr) -> Money In (Bank Credit), Credit entry (Cr) -> Money Out (Bank Debit)
          const computedDirection = isDebit ? "credit" : "debit";

          const currentBalance = bankBalances.get(row.bankId) || 0;
          const delta = computedDirection === "credit" ? amount : -amount;
          const newBalance = currentBalance + delta;
          
          // Update in-memory running balance for subsequent rows in this transaction
          bankBalances.set(row.bankId, newBalance);

          const bankRef = doc(db, "banks", row.bankId);
          const bankTxnRef = doc(collection(bankRef, "transactions"));

          transaction.update(bankRef, { principalAmount: increment(delta), updatedAt: serverTimestamp() });

          transaction.set(bankTxnRef, {
            id: bankTxnRef.id,
            type: computedDirection,
            amount: amount,
            balanceAfter: newBalance,
            relatedSalaryTxId: null,
            payeeEmployeeId: null,
            payeeEmployeeName: null,
            note: `Bulk Ledger: ${row.particulars} (${group.entityType} — ${entityName})`,
            performedBy: useAuthStore.getState().user?.uid || "unknown",
            createdAt: serverTimestamp(),
            relatedLedgerEntryId: entryRef.id,
            relatedProfileId: group.profileId,
          });
        }
      }

      // Update the profile's running aggregates with increment() — matches the
      // convention used by addManualLedgerEntry and confirmDelivery throughout
      // the codebase, keeping aggregate updates safe under concurrency.
      transaction.update(profileRef, {
        totalDebit: increment(debitDelta),
        totalCredit: increment(creditDelta),
        closingBalance: increment(debitDelta - creditDelta),
        updatedAt: serverTimestamp(),
      });
    })
  );

  await Promise.all(jobs);
}
