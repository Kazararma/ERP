# PRD: Rice ERP — Ledger Profile Deletion, Balance State Bug, Supplier Name Cascade

> **Audience:** Autonomous coding agent (Antigravity / Gemini Flash)
> **Project path:** `c:\dev\ERP\rice-erp`
> **Stack:** React 18, TypeScript 5, Vite 8, Zustand 5, Firebase Firestore 12, Zod 4, React Hook Form 7, Shadcn/ui, Tailwind 3.4
> **Date:** October 2026

---

## 0. Agent Ground Rules (read first)

1. **Verify before editing.** File paths below come from `rice_erp_summary.md`. Some names are inferred (for example `SupplierProfilesTab.tsx`). Before editing, run a file search for the real file under `src/components/ledger/`. If a path differs, use the real one and do not create duplicate files.
2. **Do not refactor unrelated code.** Touch only the files needed for each task.
3. **Build must stay green.** After each task run `npx tsc --noEmit` and `npm run build`. Do not start the next task until both pass.
4. **Follow existing conventions:**
   - Destructive actions use `useUiStore.getState().requestConfirm(title, msg)` (returns `Promise<boolean>`).
   - Toasts use `sonner`.
   - Balance writes on `LedgerProfile` use Firestore `increment()`, never absolute writes (except in the explicit repair path in Task 2).
   - Style: indigo primary, rose for destructive, `rounded-xl` white cards, status pills `text-[10px] font-bold uppercase`.
5. **Firestore limits:** a `writeBatch` holds at most 500 writes. Always chunk (use 400 as a safe size). `runTransaction` is for read-modify-write only.
6. **Do not delete underlying business entities** (`suppliers`, `customers`, `deals`, `orders`) as a side effect of any task below.

---

## 1. Overview

| # | Task | Type | Risk | Summary |
|---|---|---|---|---|
| 1 | Delete Ledger Profile | Feature | Medium | Duplicate `ledgerProfiles` exist and cannot be removed. Add a "Delete Ledger Profile" panel on the ledger profile page that lists all supplier, customer and miscellaneous profiles and lets the user delete a specific one. Needs a new service function that also cleans up the `entries` subcollection. |
| 2 | Ledger Balance State Bug | Bug fix | Low | After bulk or normal entries, some profiles transiently show huge ending balances that fix themselves after a few refreshes. Likely string concatenation (`number + string`) in local Zustand state updates in `useLedgerStore.ts`. Fix with strict numeric coercion and derive `closingBalance` instead of incrementing it. |
| 3 | Supplier Name Cascade | Bug fix | Medium | Renaming a supplier updates only the `suppliers` doc. Cascade the new `supplierName` to `deals`, `inventory`, `supplierLedgerEntries` and the supplier's `ledgerProfiles` doc using chunked batch writes. |

**Recommended execution order: Task 2, then Task 3, then Task 1.** See Section 5.

---

## 2. Task 1 — Delete Ledger Profile

### 2.1 Problem
`ledgerProfiles/{profileId}` documents are created idempotently with ID `{entityType}_{entityId}`. Duplicates therefore most likely come from duplicate underlying entities (the same supplier or customer created twice, or "One-Time Supplier" records) or legacy documents with differently formatted IDs. There is currently **no UI or service function to delete a profile**.

### 2.2 Functional Requirements

**FR-1.1 Trigger button.** On the Ledger page, in each of the three profile views (Supplier profiles, Customer profiles, Miscellaneous), add a button labelled **"Delete Ledger Profile"** (outline style, `text-rose-600 border-rose-200 hover:bg-rose-50`, Lucide `Trash2` icon) in the toolbar next to the existing actions.

**FR-1.2 Expandable manager panel.** Clicking the button toggles an inline panel (`animate-in fade-in slide-in-from-top-2 duration-300`, same pattern as existing expandable rows). The panel:
- Lists **all profiles of that tab's entity type** (supplier, customer or miscellaneous) from the Zustand ledger store.
- Each row shows: `entityName`, `entityId` (small muted text, to disambiguate duplicates), `totalDebit`, `totalCredit`, `closingBalance`, entry count (lazy-loaded), and a rose **Delete** icon button.
- Has a search input to filter by name.
- Rows sharing the same `entityName` (case-insensitive, trimmed) get an amber **"Duplicate name"** pill, so the user can spot duplicates quickly.
- Has a close/collapse control.

**FR-1.3 Two-step confirmation.** Clicking Delete runs a pre-flight check (FR-1.4), then calls `requestConfirm`. The message must state: profile name, entry count, current closing balance, and that deletion is permanent. If entry count > 0, require the user to confirm in a second `requestConfirm` ("This profile has N entries that will also be deleted. Continue?"), or use a typed-name confirmation if the existing Shadcn Dialog makes that simple.

**FR-1.4 Safety guards (enforced in the service, not only the UI).** `deleteLedgerProfile` must **refuse** (throw an `Error` with a clear message) when either of these holds:
- Any entry has `bankId` set and was posted with a bank fund movement. Deleting it silently would leave `banks/{bankId}.principalAmount` and `banks/{bankId}/transactions` inconsistent. The error lists the count and tells the user to delete those entries individually first (this uses the existing `deleteManualLedgerEntry`, which reverses the bank movement).
- Any entry is system-generated and linked to a live document through `relatedDocId` (for example `purchase_created`, `order_confirmed`) **and** the profile still has a non-zero `closingBalance`. Show a warning and block deletion. (If the balance is zero the profile is safe to remove.) If the agent finds this guard too strict against real data, it should **downgrade it to a warning flag** `force?: boolean` and keep the bank guard mandatory.

**FR-1.5 Post-delete behavior.**
- Remove the profile from the Zustand ledger store cache immediately (no full refetch needed) and show `toast.success("Ledger profile deleted")`.
- If the currently open profile detail view is the deleted one, navigate back to the profile list.
- The underlying `suppliers` / `customers` / misc entity doc is **not** deleted.

**FR-1.6 Recreation caveat.** Because `ensureLedgerProfile()` recreates a profile when the entity transacts again, deleting a profile of an entity that still exists is allowed but the confirmation text should say: "The profile will be recreated automatically if this entity is used in a new transaction." The preferred way to kill a duplicate permanently is to also delete the duplicate entity through `SupplierManager` / `CustomerManager` / `MiscellaneousManager`. Do not automate that here.

### 2.3 Files to Modify / Create

| File | Change |
|---|---|
| `src/services/ledgerProfileService.ts` | Add `deleteLedgerProfile(profileId, options?)` and `getLedgerEntryCount(profileId)` (see 2.4). |
| `src/stores/useLedgerStore.ts` | Add `removeProfile(entityType, profileId)` action that filters the profile out of the right cached array. Add `deleteProfile(profileId, entityType)` that wraps the service call and then `removeProfile`. |
| `src/components/ledger/shared/DeleteLedgerProfilePanel.tsx` (**new**) | Reusable expandable panel. Props: `entityType`, `profiles: LedgerProfile[]`, `onDeleted?: (id: string) => void`. Contains search, duplicate-name detection, per-row delete, loading and error states. |
| Supplier profiles tab (expected `src/components/ledger/supplier/profiles/SupplierProfilesTab.tsx`; verify real name) | Add the "Delete Ledger Profile" toggle button and render `<DeleteLedgerProfilePanel entityType="supplier" />`. |
| `src/components/ledger/customer/profiles/CustomerProfilesTab.tsx` | Same, with `entityType="customer"`. |
| `src/components/ledger/miscellaneous/MiscellaneousManager.tsx` | Same, with `entityType="miscellaneous"`. If this component is a CRUD manager for entities rather than profiles, add the panel in the same toolbar area and keep the entity CRUD unchanged. |
| `src/pages/app/LedgerPage.tsx` | Only if needed to handle "selected profile was deleted" navigation. Avoid otherwise. |

### 2.4 Data Model Implications
- **No schema change.** `LedgerProfile` and `LedgerEntry` types stay the same.
- Firestore **does not cascade-delete subcollections**. Deleting `ledgerProfiles/{id}` alone orphans `ledgerProfiles/{id}/entries/*`. The service must delete the entries first.
- Orphaned entries in existing data are not in scope for cleanup.

### 2.5 Required Firestore Operations

```ts
// ledgerProfileService.ts (spec, not final code)
const CHUNK = 400;

export async function getLedgerEntryCount(profileId: string): Promise<number> {
  // Prefer getCountFromServer(collection(db, 'ledgerProfiles', profileId, 'entries'))
  // Fall back to getDocs(...).size if the aggregate API is unavailable.
}

export async function deleteLedgerProfile(profileId: string): Promise<{ deletedEntries: number }> {
  // 1. Read profile doc. If missing -> throw Error('Profile not found').
  // 2. Read ALL entries: getDocs(collection(db, 'ledgerProfiles', profileId, 'entries')).
  // 3. GUARD: if any entry has bankId (truthy) -> throw Error with count + instruction (FR-1.4).
  // 4. GUARD: system-generated linked entries + non-zero closingBalance (FR-1.4).
  // 5. Delete entries in chunks of CHUNK using writeBatch (batch.delete(entryRef)); commit each chunk.
  // 6. Delete the profile doc LAST (final writeBatch/deleteDoc), so a mid-way failure leaves a
  //    profile that can simply be deleted again (operation is idempotent and retryable).
  // 7. Return the number of deleted entries.
}
```

Notes for the agent:
- **Order matters:** entries first, profile last. A failure midway must not leave entries pointing at a missing profile.
- A single `runTransaction` is **not** appropriate here (500-write limit, unbounded entry count).
- Do not touch `banks/*` in this function; the guard in step 3 prevents bank inconsistency.
- Do not write absolute balances anywhere.

### 2.6 Firestore Rules
Check `firestore.rules`. If deletes on `ledgerProfiles/{id}` or `ledgerProfiles/{id}/entries/{id}` are not already allowed for authenticated approved users, add `allow delete` consistent with how other writes on those paths are authorized. Deploy only if the rules actually changed.

### 2.7 Acceptance Criteria
- [ ] Each of the three tabs shows a "Delete Ledger Profile" button; clicking expands a list of that type's profiles; clicking again collapses it.
- [ ] Duplicate-named profiles are visibly flagged.
- [ ] Deleting a profile with no bank-linked entries removes the profile document and all its `entries` documents, confirmed in the Firestore console.
- [ ] Deleting a profile that has bank-linked entries is blocked with a readable message and nothing is deleted.
- [ ] The UI updates immediately without a page refresh; no other profile is affected.
- [ ] Underlying supplier/customer docs still exist.
- [ ] `tsc --noEmit` and `npm run build` pass.

---

## 3. Task 2 — Ledger Balance State Bug

### 3.1 Problem
After posting entries (bulk entry via `BulkLedgerTab` / `submitBulkLedgerEntries`, or normal entry via `addManualLedgerEntry` / `postPaymentVoucherEntry`), some profiles briefly show a huge ending balance. It self-corrects after a few refreshes.

### 3.2 Root-Cause Hypothesis (agent must verify)
Firestore `increment()` is server-side and type-safe (it rejects non-numbers), so persisted balances are most likely correct. The symptom (wrong when freshly computed locally, correct after reload) points to the **client-side Zustand cache** in `useLedgerStore.ts`. Likely mechanism:

- Form values from `<input>` / React Hook Form (`useFieldArray` rows in `BulkLedgerTab`, the manual entry form, the payment voucher form) arrive as **strings** (`"1500"`).
- The store's local update does something like `profile.totalDebit + amount`, `profile.closingBalance += amount` or `totalDebit: p.totalDebit + entry.debit`. With a string operand JavaScript **concatenates**: `5000 + "1500"` becomes `"50001500"`, which later coerces to a huge number when subtracted. Repeated refreshes re-sync from Firestore and "fix" it.

Secondary suspects to check while there:
1. **Double counting** — an optimistic local increment followed by a store refetch or snapshot that already includes the same entry.
2. **`closingBalance` incremented independently** of `totalDebit`/`totalCredit`, which can drift. The rule is `closingBalance = totalDebit − totalCredit`.
3. A profile whose Firestore `totalDebit`/`totalCredit` are `undefined` or `null`, producing `NaN` or string concatenation with `undefined`.

**Step 0 of this task is diagnosis:** grep `useLedgerStore.ts`, `BulkLedgerTab.tsx`, `bulkLedgerService.ts`, `ledgerProfileService.ts` and the manual entry form for every place a balance or amount is added, `+=`'d, or spread into state. Write a short list of the offending lines in the PR/commit message. Fix every occurrence, not just one.

### 3.3 Functional Requirements

**FR-2.1 Central numeric helper.** Add `src/utils/number.ts`:
```ts
export const toNum = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
```

**FR-2.2 Store updates use `toNum` on every operand.** In `useLedgerStore.ts`, any local mutation must follow:
```ts
const totalDebit  = round2(toNum(p.totalDebit)  + toNum(entry.debit));
const totalCredit = round2(toNum(p.totalCredit) + toNum(entry.credit));
const closingBalance = round2(totalDebit - totalCredit);   // DERIVED, never incremented
```
`closingBalance` must always be derived from the two totals in the store.

**FR-2.3 Coerce at the input boundary too.**
- Zod schemas for the bulk row, manual entry and payment voucher (`paymentVoucherSchema.ts` and the equivalents): use `z.coerce.number()` for `amount`, `debit`, `credit`, `vchNo`, `quantityKg`, `pricePerUnit`, with `.positive()` or `.nonnegative()` as appropriate. Zod 4 is in use, so use its current coercion API.
- `submitBulkLedgerEntries` and `addManualLedgerEntry` / `postPaymentVoucherEntry`: apply `toNum()` to the amount **before** building the entry document and before calling `increment()`. Reject with an error if the result is `<= 0` or `NaN`.
- Number inputs: prefer `valueAsNumber` or `{ valueAsNumber: true }` in React Hook Form `register` where the field is a plain input.

**FR-2.4 No double counting.** After a successful write, choose **one** strategy and apply it consistently:
- **Preferred:** after submit, re-fetch only the affected profiles (`getLedgerProfile` for each distinct `profileId` in the batch) and replace them in the store. Do not also apply local increments.
- Alternative: apply the local increment (with `toNum`) and skip the refetch. Never both.
The existing bulk flow "refreshes all three ledger store caches" after submit; if so, remove any local increment that runs before that refresh.

**FR-2.5 Normalize on load.** When profiles are loaded from Firestore into the store, map each through a `normalizeProfile()` that applies `toNum` to `totalDebit`, `totalCredit` and recomputes `closingBalance`. This heals any `undefined`/string values.

**FR-2.6 (Optional, only if diagnosis shows persisted drift).** Add a small admin-only repair function `recomputeLedgerProfileTotals(profileId)` that reads all entries, sums `toNum(debit)` / `toNum(credit)`, and **sets** `totalDebit`, `totalCredit`, `closingBalance` on the profile (this is the one allowed absolute write). Expose it on `/admin/migrate` as a button. Skip if Firestore data is confirmed correct.

### 3.4 Files to Modify / Create

| File | Change |
|---|---|
| `src/utils/number.ts` (**new**) | `toNum`, `round2`. |
| `src/stores/useLedgerStore.ts` | Apply `toNum`/`round2`; derive `closingBalance`; add `normalizeProfile`; remove double-count paths. |
| `src/components/ledger/bulk/BulkLedgerTab.tsx` | Coerce `amount`, `vchNo` before submit; fix refresh-vs-local-update overlap. |
| `src/services/bulkLedgerService.ts` | `toNum` at the top of `submitBulkLedgerEntries`; validate. |
| `src/services/ledgerProfileService.ts` | `toNum` in `addManualLedgerEntry`, `postPaymentVoucherEntry`, `updateLedgerEntryAmount`. |
| `src/schemas/*` (including `paymentVoucherSchema.ts`) | `z.coerce.number()` for all numeric fields. |
| Manual-entry form components under `src/components/ledger/**` | Ensure numeric fields are coerced. |
| `src/pages/app/MigratePage.tsx` + `src/services/migrationService.ts` | Only for optional FR-2.6. |

### 3.5 Data Model Implications
- No schema change. Types stay `number`. The fix is behavioral.
- Existing Firestore data is assumed correct (since `increment()` rejects strings). If diagnosis shows otherwise, use FR-2.6.

### 3.6 Required Firestore Operations
No new transactions. Existing `runTransaction` / `increment()` logic stays, and must only receive pre-coerced numbers. FR-2.6 (if built) uses a read of all entries followed by a single `updateDoc` on the profile.

### 3.7 Acceptance Criteria
- [ ] `grep` shows no remaining `profile.total* + x` or `+=` on balance fields without `toNum`.
- [ ] Post 5 bulk rows across 3 profiles (mixed Dr/Cr) where amounts come straight from inputs. Displayed balances match `sum(debit) − sum(credit)` **immediately**, with no refresh.
- [ ] Repeat with normal manual entries and a payment voucher.
- [ ] `closingBalance` is never `NaN`, a string, or off by orders of magnitude at any point.
- [ ] No profile is double counted (post one 1000 entry; balance changes by exactly 1000).
- [ ] `tsc --noEmit` and `npm run build` pass.

---

## 4. Task 3 — Supplier Name Cascade

### 4.1 Problem
Renaming a supplier in the Deals section updates only `suppliers/{supplierId}`. The name is **denormalized** in several collections, so old names persist elsewhere (deals, inventory, ledgers, dashboard leaderboards).

### 4.2 Denormalized Locations (from the system summary)

| Collection | Match field | Field to update |
|---|---|---|
| `suppliers/{supplierId}` | doc ID | `name` (or the existing field name; verify) |
| `deals` | `supplierId == id` | `supplierName` |
| `inventory` | `supplierId == id` | `supplierName` |
| `ledgerProfiles` | doc ID `supplier_${supplierId}` (also `entityType == 'supplier' && entityId == id` as a fallback for legacy IDs) | `entityName`, `updatedAt` |
| `supplierLedgerEntries` | `supplierId == id` (verify field name) | `supplierName` (if the field exists) |

Note: `ledgerProfiles` is keyed by `entityId`/`entityType`, not `supplierId`. Do **not** query it by `supplierId`.

Also check and update if they store the name: `orders/{orderId}/allocations/*` (probably only the product, so likely none), and any other grep hits for `supplierName` across `src/services/**`. The agent must run `grep -rn "supplierName" src/` and cover every Firestore write location it finds.

### 4.3 Functional Requirements

**FR-3.1 Cascade on rename.** In `supplierService.ts`, the update function (find the existing `updateSupplier` or equivalent) must, when the name changed (`trimmed new name !== old name`), perform the cascade below. If the name did not change, skip it.

**FR-3.2 Chunked batch writes.**
```ts
// supplierService.ts (spec, not final code)
const CHUNK = 400;

export async function cascadeSupplierName(supplierId: string, newName: string) {
  const name = newName.trim();
  // 1. Collect refs to update:
  //    deals        -> getDocs(query(collection(db,'deals'),        where('supplierId','==',supplierId)))
  //    inventory    -> getDocs(query(collection(db,'inventory'),    where('supplierId','==',supplierId)))
  //    supplierLedgerEntries -> getDocs(query(collection(db,'supplierLedgerEntries'), where('supplierId','==',supplierId)))
  //    ledgerProfiles -> doc(db,'ledgerProfiles',`supplier_${supplierId}`) if it exists,
  //                      PLUS query where('entityType','==','supplier'), where('entityId','==',supplierId)
  //                      (dedupe by ref.path)
  // 2. Build one list of { ref, data }:
  //      deals / inventory / supplierLedgerEntries -> { supplierName: name }
  //      ledgerProfiles                            -> { entityName: name, updatedAt: serverTimestamp() }
  // 3. Commit in chunks of CHUNK with writeBatch(db).update(ref, data).
}
```
- Include the `suppliers/{supplierId}` update itself in the **first** batch.
- Use `update`, not `set`, so a missing doc fails loudly rather than being created. Skip refs that no longer exist.
- Each chunk is atomic; the whole cascade across chunks is not. Therefore the operation must be **idempotent and re-runnable** (re-running with the same name is a no-op in effect).
- Wrap in try/catch. On failure, throw a descriptive error and show `toast.error`. Do not leave the user thinking it succeeded.
- Use the existing `syncLedgerProfileName(...)` from `ledgerProfileService.ts` if it already covers the profile update; otherwise inline as above. Avoid duplicate logic.

**FR-3.3 Client caches.** After a successful cascade, refresh the Zustand stores that cache names: `useLedgerStore` (supplier profiles) and any deals/suppliers hooks or subscriptions. If these are `onSnapshot`-driven, the UI updates on its own; verify. For the Supplier Ledger tab and the Dashboard "Top 5 Suppliers" (computed from deals), confirm they read `supplierName` from the updated docs.

**FR-3.4 One-time backfill (optional but recommended).** Because past renames were never cascaded, add a "Resync supplier names" action on `/admin/migrate` that, for every supplier doc, runs `cascadeSupplierName(id, supplier.name)`. This repairs historical mismatches. Superadmin only (route is already guarded).

**FR-3.5 Input validation.** Reject empty or whitespace-only names; enforce the same trim and max length as `SupplierForm`.

### 4.4 Files to Modify

| File | Change |
|---|---|
| `src/services/supplierService.ts` | Add `cascadeSupplierName`; call it from the update-supplier function when the name changed. |
| `src/services/ledgerProfileService.ts` | Reuse or extend `syncLedgerProfileName`. No new behavior beyond what is needed. |
| `src/components/deals/shared/SupplierForm.tsx` and `src/components/deals/bought/SupplierManager.tsx` | Show a saving state during the cascade and a success or failure toast. Disable the submit button while pending. |
| `src/services/migrationService.ts` and `src/pages/app/MigratePage.tsx` | Optional backfill button (FR-3.4). |
| `firestore.indexes.json` | Single-field equality queries do not need composite indexes. Add one only if a query combines multiple `where` clauses and Firestore reports a missing index. |
| `firestore.rules` | Verify that updates to `deals`, `inventory`, `ledgerProfiles` and `supplierLedgerEntries` are permitted for the acting user role. |

### 4.5 Data Model Implications
- No schema change. This only enforces consistency of existing denormalized fields.
- **Design note (do not implement now):** a longer-term fix is to stop denormalizing names and join at read time. Out of scope.

### 4.6 Acceptance Criteria
- [ ] Rename a supplier with at least 3 deals. Within one refresh, the new name appears in: Bought tab deal cards, Inventory table, Supplier Ledger tab and profile, Supplier Profiles, the Sold-tab bag selector grouping, and Dashboard Top 5 Suppliers.
- [ ] Firestore console shows the new name in `deals`, `inventory`, `supplierLedgerEntries` and `ledgerProfiles` for that `supplierId`, and the old name nowhere for it.
- [ ] A supplier with more than 400 related docs is handled (test with a script or reduced `CHUNK`).
- [ ] Renaming to the same name performs no writes to related collections.
- [ ] Other suppliers are untouched.
- [ ] `tsc --noEmit` and `npm run build` pass.

---

## 5. Execution Strategy

Do the work in **small, individually buildable steps**. After every numbered step: run `npx tsc --noEmit`; after every phase: run `npm run build`. If a step breaks the build, fix it before moving on.

### Phase A — Task 2: Balance bug (lowest risk, highest user impact)
1. Diagnose: grep all balance/amount arithmetic in the store, forms and services. List findings.
2. Create `src/utils/number.ts` (`toNum`, `round2`).
3. Update `useLedgerStore.ts`: `normalizeProfile`, derived `closingBalance`, `toNum` in all updates, remove double-count.
4. Update Zod schemas to `z.coerce.number()`.
5. Update `bulkLedgerService.ts`, `ledgerProfileService.ts` write paths to coerce and validate.
6. Update `BulkLedgerTab.tsx` and the manual entry forms (coercion and refresh strategy).
7. Manual test per 3.7. Build.

### Phase B — Task 3: Supplier name cascade
1. Grep `supplierName` across `src/` to confirm the full list of denormalized locations.
2. Implement `cascadeSupplierName` in `supplierService.ts` with chunking.
3. Wire it into the update-supplier flow; add pending and toast states in `SupplierForm`/`SupplierManager`.
4. Verify store refresh behavior.
5. (Optional) Add backfill action to `MigratePage`.
6. Manual test per 4.6. Build.

### Phase C — Task 1: Delete ledger profile
1. Add `getLedgerEntryCount` and `deleteLedgerProfile` to `ledgerProfileService.ts` (guards, chunked deletes, profile last).
2. Add `removeProfile` / `deleteProfile` to `useLedgerStore.ts`.
3. Build `DeleteLedgerProfilePanel.tsx` (search, duplicate flagging, confirmation, loading and error states).
4. Integrate into the supplier, customer and misc profile tabs.
5. Check `firestore.rules` for delete permission.
6. Manual test per 2.7 (including the bank-linked guard). Build.

### Phase D — Final verification
- Run the full app, exercise all three tasks end to end.
- Confirm no console errors and no TypeScript errors.
- Summarize the changes by file, and list any assumption that differed from this PRD (for example renamed files or different field names).

### Why this order
Task 2 is a pure client-side fix and also makes balances trustworthy before the user starts deleting profiles. Task 3 touches many collections but changes no UI structure. Task 1 is the only task adding new UI and a destructive operation, so it comes last, once balances display reliably and the user can verify what they are deleting.

---

## 6. Out of Scope
- Redesigning the ledger data model or removing name denormalization.
- Auto-merging duplicate profiles or entities (this PRD only enables manual deletion).
- Cleaning up previously orphaned subcollection documents.
- Changes to PDF export, Balance Sheet or Wages modules.
