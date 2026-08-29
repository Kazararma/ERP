# 🤖 Antigravity Agent Instructions — Rice Merchant ERP Feature Expansion

> **Audience:** Autonomous coding agent (Gemini Flash, Antigravity IDE)
> **Codebase:** `c:/dev/ERP/rice-erp/`
> **Mode:** File-by-file, phase-by-phase. Do not skip ahead. Do not invent file paths, type names, or function signatures that are not explicitly given below — if something is ambiguous, **open and read the referenced existing file first**, then mirror its exact patterns.

---

## 0. Non-Negotiable Ground Rules

Before writing any code, internalize these constraints from the existing codebase. Every new file MUST comply:

1. **Firestore writes are never "fire and forget."** Anything that mutates more than one document (a profile + an entry, a deal + inventory, etc.) uses either `runTransaction()` (when reads must inform the write) or `writeBatch()` (when writes are independent of prior reads). Never use sequential `updateDoc`/`setDoc` calls for multi-document mutations — this is the #1 architectural rule of this codebase.
2. **All reads happen before all writes** inside a `runTransaction()` callback. Firestore throws at runtime if you interleave them.
3. **Forms use React Hook Form + Zod**, wired via `zodResolver`. Every new form needs a matching schema file under `src/schemas/`.
4. **Zustand stores are the single source of truth for lists that many components read** (supplier/customer/misc profile lists). Components never call Firestore directly for data another component already fetched — they read from the store.
5. **Type additions must be backward compatible.** Widening a union type (e.g. adding `"miscellaneous"` to `entityType`) requires you to grep the entire codebase for exhaustive `switch` statements or `if/else if` chains over that union and add the new branch — TypeScript's `strict` mode will surface these as compile errors; treat every one as a required edit, not a warning to suppress.
6. **Never rename or restructure existing working files.** Every task below is additive. If a task says "mirror `SupplierLedgerTab.tsx`," open that file, copy its structure, and adapt names — do not redesign it.
7. **Before writing each file in this document, open the "Reference File" listed for it** (if one exists in the repo) and confirm your output matches its conventions (import order, naming, styling classes, toast library used, etc.).
8. **Commit granularity:** Complete and verify one numbered Phase before starting the next. Do not jump between phases.

---

## Phase 1 — Types & Schemas

### 1.1 Extend `LedgerProfile` and `LedgerEntry` for the `"miscellaneous"` entity type

**File to edit:** `src/types/ledger-profile.ts`
**Reference:** Read this file in full first — it currently defines `entityType: "supplier" | "customer"` on both `LedgerProfile` and `LedgerEntry`, plus the `VchType` and `LedgerEntryType` enums/unions described in the architecture summary.

```typescript
// BEFORE (existing):
// entityType: "supplier" | "customer";

// AFTER — widen in BOTH LedgerProfile and LedgerEntry interfaces/schemas:
entityType: "supplier" | "customer" | "miscellaneous";
```

If `entityType` is defined via a Zod enum (e.g. `z.enum(["supplier", "customer"])`) rather than a raw TS union, update the Zod enum the same way — the TS type is likely inferred from it via `z.infer<typeof LedgerProfileSchema>`.

**Action item — exhaustiveness sweep:** Run a project-wide search for every place `entityType` is branched on (`===  "supplier"`, `=== "customer"`, ternaries, `switch`). Common locations to check based on the architecture doc:
- `src/services/ledgerProfileService.ts` (`getLedgerProfilesByType`)
- `src/stores/useLedgerStore.ts` (`suppliers`, `customers` arrays)
- `src/components/ledger/shared/LedgerProfileDetail.tsx`
- `src/components/ledger/shared/pdf/LedgerProfilePdf.tsx`

Do not fix these yet — just note them. They are addressed in Phases 2–4 below.

### 1.2 New `MiscellaneousProfile` domain type

**File to create:** `src/types/miscellaneous.ts`
**Reference:** Mirror the `Supplier`/`Customer` interface shape shown in `src/types/deal.ts` / `src/types/order.ts` (per the architecture summary — `supplierId`/`customerId`, `name`, `description`, optional contact fields, audit fields).

```typescript
import { Timestamp } from "firebase/firestore";

export interface MiscellaneousProfile {
  miscId: string;
  name: string;
  description: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}
```

Add the export to `src/types/index.ts` alongside the existing `Supplier`/`Customer` exports.

### 1.3 Zod schema for the Miscellaneous profile form

**File to create:** `src/schemas/miscellaneousProfileSchema.ts`
**Reference:** Open `src/components/deals/bought/SupplierManager.tsx` or `src/components/deals/sold/CustomerManager.tsx` to find the inline/adjacent Zod schema they use for add-supplier/add-customer forms, and match its field names and validation messages exactly (just renamed).

```typescript
import { z } from "zod";

export const miscellaneousProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
});

export type MiscellaneousProfileFormValues = z.infer<typeof miscellaneousProfileSchema>;
```

### 1.4 Zod schema for the Bulk Ledger form

**File to create:** `src/schemas/bulkLedgerSchema.ts`
**Reference:** Open `src/components/deals/PaymentVoucher/paymentVoucherSchema.ts` — it is the closest existing example of a voucher-style Zod schema (amount, date, vchType, note) and should inform field naming/validation style.

```typescript
import { z } from "zod";

export const bulkLedgerRowSchema = z.object({
  ledgerType: z.enum(["supplier", "customer", "miscellaneous"], {
    required_error: "Select a ledger type",
  }),
  profileId: z.string().min(1, "Select a profile"),
  profileName: z.string().min(1), // denormalized at select-time, not user-typed
  entryKind: z.enum(["debit", "credit"], { required_error: "Select debit or credit" }),
  date: z.string().min(1, "Date is required"), // HTML date input, "YYYY-MM-DD"
  particulars: z.string().min(1, "Particulars are required"),
  subParticulars: z.string().optional(),
  vchType: z.enum(["Purchase", "Payment", "Receipt", "Sale", "Journal", "Manual"]),
  vchNo: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

export const bulkLedgerFormSchema = z.object({
  rows: z.array(bulkLedgerRowSchema).min(1, "Add at least one voucher row"),
});

export type BulkLedgerRow = z.infer<typeof bulkLedgerRowSchema>;
export type BulkLedgerFormValues = z.infer<typeof bulkLedgerFormSchema>;
```

> **Do not proceed to Phase 2 until `npm run build` (or `tsc --noEmit`) passes** with these type changes in isolation — expect it to fail on the exhaustiveness-sweep locations noted in 1.1; that is expected and resolved in Phase 2–4.

---

## Phase 2 — Service Layer

### 2.1 `miscellaneousService.ts` (new file)

**File to create:** `src/services/miscellaneousService.ts`
**Reference:** Open `src/services/supplierService.ts` line-for-line and copy its structure, renaming `Supplier`→`MiscellaneousProfile`, `supplierId`→`miscId`, and the collection name to `"miscellaneous"`.

```typescript
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MiscellaneousProfile } from "@/types/miscellaneous";

const COLLECTION = "miscellaneous";

export async function getAllMiscellaneous(): Promise<MiscellaneousProfile[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => ({ miscId: d.id, ...d.data() } as MiscellaneousProfile));
}

export async function addMiscellaneous(
  data: Omit<MiscellaneousProfile, "miscId" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMiscellaneous(
  miscId: string,
  patch: Partial<MiscellaneousProfile>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, miscId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}
```

> ⚠️ **Verify against the real `supplierService.ts`:** if `addSupplier` also eagerly creates a matching `ledgerProfiles/{id}` document (rather than lazily on first transaction), replicate that same eager-creation call inside `addMiscellaneous` using `ledgerProfileService` (see 2.2). Do not guess — read the source first.

### 2.2 Extend `ledgerProfileService.ts` for the `"miscellaneous"` type

**File to edit:** `src/services/ledgerProfileService.ts`
**Reference:** Read `getLedgerProfilesByType` — it almost certainly takes an `entityType` param and queries `ledgerProfiles` `where("entityType", "==", entityType)`. Because the type union was already widened in Phase 1, this function needs **no logic change** — only confirm its parameter type is `LedgerProfile["entityType"]` (inferred) and not a hardcoded `"supplier" | "customer"` literal union that would now reject `"miscellaneous"`. If it's hardcoded, widen it.

Add one new convenience export mirroring however suppliers/customers currently get their initial `ledgerProfiles` doc created (whether that logic lives here or in `supplierService.ts` — check both):

```typescript
export async function ensureLedgerProfile(
  entityType: "supplier" | "customer" | "miscellaneous",
  entityId: string,
  entityName: string,
  millDefaults: { millName: string; millDescription: string; millContact?: string }
): Promise<void> {
  // Mirror the exact creation shape used for supplier/customer LedgerProfile docs:
  // id, entityId, entityType, entityName, millName, millDescription, millContact,
  // totalDebit: 0, totalCredit: 0, closingBalance: 0, createdAt, updatedAt
  // Use setDoc with a deterministic doc ID (e.g. `${entityType}_${entityId}`) if that's
  // the existing convention — verify in the real file before assuming.
}
```

### 2.3 `bulkLedgerService.ts` (new file)

**File to create:** `src/services/bulkLedgerService.ts`
**Reference:** This mirrors **Transaction B (Confirm Delivery)**'s ledger-write shape from the architecture summary, but applied N times inside one batch, and mirrors `addManualLedgerEntry`'s field shape from `ledgerProfileService.ts` for each individual entry.

Because a `writeBatch` cannot *read* documents to compute new aggregate totals safely under concurrency, and because this feature may write to the **same profile more than once per submission** (two rows targeting the same supplier), you must **pre-aggregate deltas per profile in memory** before touching Firestore, then use `runTransaction` per profile (not a single flat batch) to keep each profile's running totals correct.

```typescript
import { runTransaction, doc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BulkLedgerRow } from "@/schemas/bulkLedgerSchema";

interface ProfileDelta {
  profileId: string;
  entityType: BulkLedgerRow["ledgerType"];
  rows: BulkLedgerRow[];
}

export async function submitBulkLedgerEntries(rows: BulkLedgerRow[]): Promise<void> {
  // 1. Group rows by profileId so each profile is only opened in ONE transaction.
  const grouped = new Map<string, ProfileDelta>();
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

  // 2. Run one runTransaction PER PROFILE, in parallel. Each transaction:
  //    - reads the ledgerProfiles/{profileId} doc (current totals)
  //    - writes one ledgerProfiles/{profileId}/entries/{entryId} doc per row
  //    - writes the updated aggregate totals back to the profile doc
  const jobs = Array.from(grouped.values()).map((group) =>
    runTransaction(db, async (transaction) => {
      const profileRef = doc(db, "ledgerProfiles", group.profileId);
      const profileSnap = await transaction.get(profileRef); // READ FIRST
      if (!profileSnap.exists()) {
        throw new Error(`Ledger profile ${group.profileId} not found`);
      }
      const profile = profileSnap.data();

      let debitDelta = 0;
      let creditDelta = 0;
      const entryRefs = group.rows.map((row) => {
        const amount = row.amount;
        if (row.entryKind === "debit") debitDelta += amount;
        else creditDelta += amount;

        const entryRef = doc(collection(db, "ledgerProfiles", group.profileId, "entries"));
        return { entryRef, row, amount };
      });

      // ALL WRITES AFTER ALL READS
      for (const { entryRef, row, amount } of entryRefs) {
        transaction.set(entryRef, {
          id: entryRef.id,
          profileId: group.profileId,
          entityId: profile.entityId,
          entityType: group.entityType,
          date: new Date(row.date),
          particulars: row.particulars,
          subParticulars: row.subParticulars ?? "",
          vchType: row.vchType,
          vchNo: row.vchNo,
          debit: row.entryKind === "debit" ? amount : 0,
          credit: row.entryKind === "credit" ? amount : 0,
          entryType: row.entryKind === "debit" ? "manual_debit" : "manual_credit",
          isManual: true,
          isSystemGenerated: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      transaction.update(profileRef, {
        totalDebit: (profile.totalDebit ?? 0) + debitDelta,
        totalCredit: (profile.totalCredit ?? 0) + creditDelta,
        closingBalance: (profile.closingBalance ?? 0) + debitDelta - creditDelta,
        updatedAt: serverTimestamp(),
      });
    })
  );

  await Promise.all(jobs);
}
```

> **Note for the agent:** Compare this against the real `addManualLedgerEntry()` in `ledgerProfileService.ts` before finalizing — if that function has additional required fields (bank linkage, `riceType`, `pricePerUnit`), extend `bulkLedgerRowSchema` (Phase 1.4) and this write shape to match exactly rather than omitting them.

### 2.4 `convertAllPendingDeliveries()` in `dealService.ts`

**File to edit:** `src/services/dealService.ts`
**Reference:** Read the existing `confirmDelivery(dealId)` function in full — reuse its exact ledger-writing logic (Transaction B in the architecture doc: writes a `LedgerEntry` with `vchType: "Purchase"`, `entryType: "delivery_confirmed"`, and updates the supplier's `LedgerProfile` aggregate) but looped across every matching deal.

```typescript
import {
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Finds every deal with status === "pending_delivery" and confirms delivery on
 * all of them in one pass. Reuses the exact per-deal ledger-posting logic from
 * confirmDelivery() — do NOT duplicate that logic; extract it into a shared
 * private helper `applyDeliveryConfirmation(transaction, dealSnap)` and call it
 * from both `confirmDelivery()` (single) and `convertAllPendingDeliveries()` (bulk),
 * so the two code paths can never drift apart.
 */
export async function convertAllPendingDeliveries(): Promise<{ confirmedCount: number }> {
  const pendingQuery = query(
    collection(db, "deals"),
    where("status", "==", "pending_delivery")
  );
  const pendingSnap = await getDocs(pendingQuery);

  if (pendingSnap.empty) {
    return { confirmedCount: 0 };
  }

  // Firestore transactions cap at 500 writes. Each deal confirmation produces
  // 3 writes (deal update + ledger entry + profile aggregate update), so batch
  // deals into chunks of ~150 to stay safely under the limit.
  const CHUNK_SIZE = 150;
  const dealIds = pendingSnap.docs.map((d) => d.id);
  let confirmedCount = 0;

  for (let i = 0; i < dealIds.length; i += CHUNK_SIZE) {
    const chunk = dealIds.slice(i, i + CHUNK_SIZE);
    await runTransaction(db, async (transaction) => {
      // ── ALL READS FIRST ──
      const dealRefs = chunk.map((id) => doc(db, "deals", id));
      const dealSnaps = await Promise.all(dealRefs.map((ref) => transaction.get(ref)));

      // ── COMPUTE + WRITES ──
      // Mirror confirmDelivery()'s per-deal write shape here via the shared
      // applyDeliveryConfirmation(transaction, dealSnap) helper.
      for (const dealSnap of dealSnaps) {
        if (!dealSnap.exists() || dealSnap.data().deliveryConfirmed) continue;
        // applyDeliveryConfirmation(transaction, dealSnap);
        confirmedCount += 1;
      }
    });
  }

  return { confirmedCount };
}
```

> **Refactor requirement:** Before writing this function, open `confirmDelivery()` and extract its transaction body (steps 2–4 of Transaction B) into a private function `applyDeliveryConfirmation(transaction: Transaction, dealSnap: DocumentSnapshot)` in the same file. Call that helper from both `confirmDelivery()` and `convertAllPendingDeliveries()`. This is required — do not copy-paste the ledger-posting logic twice.

---

## Phase 3 — State Management (Zustand)

### 3.1 Extend `useLedgerStore.ts`

**File to edit:** `src/stores/useLedgerStore.ts`
**Reference:** Read the existing `suppliers` / `fetchSuppliersData` / `customers` / `fetchCustomersData` implementation and mirror it exactly for a new `miscellaneous` slice.

```typescript
// Add to the LedgerStore interface:
interface LedgerStore {
  // ...existing fields
  miscellaneous: LedgerProfile[];
  fetchMiscellaneousData(force?: boolean): void;
}

// Add to the store implementation, mirroring fetchSuppliersData/fetchCustomersData
// (same caching/force-refresh guard, same getLedgerProfilesByType("miscellaneous") call):
miscellaneous: [],
fetchMiscellaneousData: async (force = false) => {
  const state = get();
  if (!force && state.miscellaneous.length > 0) return;
  const profiles = await getLedgerProfilesByType("miscellaneous");
  set({ miscellaneous: profiles });
},
```

Also extend `updateProfileInStore(type, entityId, patch)` — its `type` parameter's union needs `"miscellaneous"` added, with a branch that patches the `miscellaneous` array the same way it patches `suppliers`/`customers`.

---

## Phase 4 — UI Components: Miscellaneous Ledger

### 4.1 `MiscellaneousManager.tsx` (new file — profile CRUD panel)

**File to create:** `src/components/ledger/miscellaneous/MiscellaneousManager.tsx`
**Reference:** Mirror `src/components/deals/bought/SupplierManager.tsx` exactly:
- Same Dialog/Drawer pattern for "Add Miscellaneous Profile"
- Use `useForm` + `zodResolver(miscellaneousProfileSchema)` (Phase 1.3)
- On submit: call `miscellaneousService.addMiscellaneous()` (Phase 2.1), then `ledgerProfileService.ensureLedgerProfile("miscellaneous", ...)` (Phase 2.2), then `useLedgerStore.getState().fetchMiscellaneousData(true)` to refresh the store
- Same list/grid rendering of existing profiles, same "click to view ledger" affordance

### 4.2 `MiscellaneousLedgerTab.tsx` (new file)

**File to create:** `src/components/ledger/miscellaneous/MiscellaneousLedgerTab.tsx`
**Reference:** Mirror `src/components/ledger/customer/CustomerLedgerTab.tsx` structure (it's the simpler of the two reference tabs — no "Transaction Events" order table is needed since Miscellaneous has no Deal/Order source events, only manual and bulk entries).

Required structure:
```
MiscellaneousLedgerTab
├── Inner Tabs (Shadcn <Tabs>)
│   ├── "Profiles" tab → renders MiscellaneousProfilesTab (4.3)
│   └── "Manage Profiles" section/button → opens MiscellaneousManager (4.1) in a Dialog
```

```tsx
import { useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { MiscellaneousProfilesTab } from "./profiles/MiscellaneousProfilesTab";
import { MiscellaneousManager } from "./MiscellaneousManager";

export function MiscellaneousLedgerTab() {
  const fetchMiscellaneousData = useLedgerStore((s) => s.fetchMiscellaneousData);

  useEffect(() => {
    fetchMiscellaneousData();
  }, [fetchMiscellaneousData]);

  return (
    <Tabs defaultValue="profiles" className="w-full">
      <TabsList>
        <TabsTrigger value="profiles">Ledger Profiles</TabsTrigger>
        <TabsTrigger value="manage">Manage Profiles</TabsTrigger>
      </TabsList>
      <TabsContent value="profiles">
        <MiscellaneousProfilesTab />
      </TabsContent>
      <TabsContent value="manage">
        <MiscellaneousManager />
      </TabsContent>
    </Tabs>
  );
}
```

> Adjust the exact Tabs/TabsList/TabsTrigger className props to match whatever `CustomerLedgerTab.tsx` actually uses — copy its JSX styling verbatim, only changing labels and data source.

### 4.3 `MiscellaneousProfilesTab.tsx` (new file)

**File to create:** `src/components/ledger/miscellaneous/profiles/MiscellaneousProfilesTab.tsx`
**Reference:** Mirror `src/components/ledger/supplier/profiles/SupplierProfilesTab.tsx` verbatim — same closing-balance list rendering, same click-through to `LedgerProfileDetail`, reading from `useLedgerStore((s) => s.miscellaneous)` instead of `.suppliers`.

### 4.4 Register the new tab in `LedgerPage.tsx`

**File to edit:** `src/pages/app/LedgerPage.tsx`
**Reference:** Read the existing three-tab `<Tabs>` block (Customer / Supplier / Salary). Add a fourth `TabsTrigger`/`TabsContent` pair for `"miscellaneous"` rendering `<MiscellaneousLedgerTab />`, placed after Supplier and before Salary to match the architecture doc's stated tab order preference (Customer → Supplier → Salary), i.e.:

```
Customer Ledger | Supplier Ledger | Miscellaneous Ledger | Salary Ledger
```

### 4.5 Update `LedgerProfilePdf.tsx` for the new entity type

**File to edit:** `src/components/ledger/shared/pdf/LedgerProfilePdf.tsx`
**Reference:** This component almost certainly renders a header label derived from `entityType` (e.g. "Supplier Ledger Statement" vs "Customer Ledger Statement"). Find that conditional and add a `"miscellaneous"` branch → `"Miscellaneous Ledger Statement"`. This is one of the exhaustiveness-sweep items flagged in Phase 1.1.

### 4.6 Update `LedgerProfileDetail.tsx` if it branches on `entityType`

**File to edit:** `src/components/ledger/shared/LedgerProfileDetail.tsx`
**Reference:** This component is entity-agnostic per the architecture doc (it just renders whatever `LedgerProfile` it's given), so it likely needs **no changes**. Confirm by searching the file for `entityType ===`; if found, add the `"miscellaneous"` branch, otherwise skip.

---

## Phase 5 — Bulk Ledger Entry

### 5.1 `BulkLedgerTab.tsx` (new file)

**File to create:** `src/components/ledger/bulk/BulkLedgerTab.tsx`

**Design requirements (from spec):**
- `useFieldArray` from React Hook Form to add/remove voucher rows dynamically
- Each row: Ledger Type select (Supplier / Customer / Miscellaneous) → Profile combobox (filtered by the selected type) → Entry Kind (Debit/Credit) → Date → Particulars → Vch Type → Vch No → Amount
- "Add Row" button appends a blank row; "Remove" (trash icon) per row
- Single "Submit All" button — calls `bulkLedgerService.submitBulkLedgerEntries(rows)` (Phase 2.3) once for the whole array
- On success: `useLedgerStore.getState()` — call `fetchSuppliersData(true)`, `fetchCustomersData(true)`, `fetchMiscellaneousData(true)` to refresh all three lists since any of them may have changed
- Reference `src/components/deals/PaymentVoucher/ProfileCombobox.tsx` for the profile-search-and-select UI pattern — reuse that component if it accepts a `entityType` prop already, or generalize it to do so rather than writing a new combobox from scratch

```tsx
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  bulkLedgerFormSchema,
  BulkLedgerFormValues,
} from "@/schemas/bulkLedgerSchema";
import { submitBulkLedgerEntries } from "@/services/bulkLedgerService";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { Button } from "@/components/ui/button";
import { ProfileCombobox } from "@/components/deals/PaymentVoucher/ProfileCombobox";

const EMPTY_ROW = {
  ledgerType: "supplier" as const,
  profileId: "",
  profileName: "",
  entryKind: "debit" as const,
  date: new Date().toISOString().slice(0, 10),
  particulars: "",
  subParticulars: "",
  vchType: "Manual" as const,
  vchNo: 1,
  amount: 0,
};

export function BulkLedgerTab() {
  const { control, register, handleSubmit, watch, setValue, reset, formState } =
    useForm<BulkLedgerFormValues>({
      resolver: zodResolver(bulkLedgerFormSchema),
      defaultValues: { rows: [EMPTY_ROW] },
    });

  const { fields, append, remove } = useFieldArray({ control, name: "rows" });

  const onSubmit = async (values: BulkLedgerFormValues) => {
    try {
      await submitBulkLedgerEntries(values.rows);
      toast.success(`${values.rows.length} voucher(s) posted successfully`);
      reset({ rows: [EMPTY_ROW] });
      const store = useLedgerStore.getState();
      store.fetchSuppliersData(true);
      store.fetchCustomersData(true);
      store.fetchMiscellaneousData(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to post bulk vouchers");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {fields.map((field, index) => (
        <div key={field.id} className="grid grid-cols-8 gap-2 items-start border rounded-md p-3">
          {/* Ledger type select */}
          <select {...register(`rows.${index}.ledgerType`)} className="col-span-1">
            <option value="supplier">Supplier</option>
            <option value="customer">Customer</option>
            <option value="miscellaneous">Miscellaneous</option>
          </select>

          {/* Profile combobox — filtered by rows.${index}.ledgerType */}
          <ProfileCombobox
            entityType={watch(`rows.${index}.ledgerType`)}
            value={watch(`rows.${index}.profileId`)}
            onSelect={(profile) => {
              setValue(`rows.${index}.profileId`, profile.id);
              setValue(`rows.${index}.profileName`, profile.entityName);
            }}
          />

          <select {...register(`rows.${index}.entryKind`)} className="col-span-1">
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>

          <input type="date" {...register(`rows.${index}.date`)} className="col-span-1" />
          <input
            type="text"
            placeholder="Particulars"
            {...register(`rows.${index}.particulars`)}
            className="col-span-2"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            {...register(`rows.${index}.amount`)}
            className="col-span-1"
          />

          <Button type="button" variant="ghost" onClick={() => remove(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={() => append(EMPTY_ROW)}>
        <Plus className="h-4 w-4 mr-1" /> Add Row
      </Button>

      <Button type="submit" disabled={formState.isSubmitting}>
        Submit All ({fields.length})
      </Button>
    </form>
  );
}
```

> **Styling note:** The raw `<select>`/`<input>` elements above are structural placeholders. Replace them with the actual Shadcn `Select`, `Input`, `DatePicker` primitives used elsewhere in `PaymentVoucherForm.tsx` so the visual style matches the rest of the app — do not ship raw unstyled HTML inputs.

> **`ProfileCombobox` generalization:** If the existing `ProfileCombobox.tsx` is hardcoded to a single entity type (e.g. only searches customers), add an `entityType: "supplier" | "customer" | "miscellaneous"` prop that switches which store array (or Firestore query) it searches, defaulting to its current behavior so `PaymentVoucherForm.tsx` (its existing caller) is unaffected.

### 5.2 Register the Bulk Ledger tab

Decide placement per product intent — the spec does not pin this to `/ledger` or `/deals`. Default recommendation: add it as a fourth/fifth tab in `LedgerPage.tsx` (`src/pages/app/LedgerPage.tsx`) labeled **"Bulk Entry"**, alongside Customer/Supplier/Miscellaneous/Salary, since it is a ledger-posting tool, not a deal/order tool.

---

## Phase 6 — Manual Entry Persistence

### 6.1 Persist last-used field values in `ManualEntryForm.tsx`

**File to edit:** `src/components/ledger/shared/ManualEntryForm.tsx`
**Goal:** After a successful submit, retain the fields that are typically repeated across consecutive manual entries (Voucher Type, Rice Type, Bank Account, Record Fund Movement toggle, Bank Movement Direction) while clearing the fields that are always unique per entry (Amount, Particulars, Sub-Particulars, Quantity, Price Per Unit). Voucher Number should auto-increment, not persist as a static value.

**Exact approach — modify `reset()` calls, not raw localStorage of the whole form:**

```tsx
// Locate the existing onSubmit handler's reset() call. It currently likely does:
//   reset(); // clears everything back to schema defaults
//
// Replace it with a SELECTIVE reset that keeps repeat-prone fields:

const onSubmit = async (values: ManualLedgerEntryFormValues) => {
  try {
    await addManualLedgerEntry(profileId, values);
    toast.success("Entry added");

    // Capture the fields we want to persist BEFORE reset.
    const persisted = {
      vchType: values.vchType,
      riceType: values.riceType,
      bankId: values.bankId,
      recordFundMovement: values.recordFundMovement,
      bankMovementDirection: values.bankMovementDirection,
      entryKind: values.entryKind,
    };

    reset({
      ...defaultManualEntryValues, // the form's normal Zod-schema defaults
      ...persisted,                // override with what should carry over
      vchNo: values.vchNo + 1,     // auto-increment voucher number
      date: values.date,           // keep the same business date for rapid batch entry
    });
  } catch (err) {
    console.error(err);
    toast.error("Failed to add entry");
  }
};
```

**Why not `localStorage`:** The form already lives inside `LedgerProfileDetail`, which is remounted per profile (`profileId` changes). Using `localStorage` risks leaking one supplier's last-used Bank Account or Rice Type into an unrelated customer's manual entry form on next visit. The in-memory selective-`reset()` approach above only persists values for the lifetime of the currently-open drawer/profile, which is what "speed up repetitive entries" actually calls for — repeated entries against the *same* profile in one session.

**If cross-session persistence is genuinely required** (i.e. the user wants their last Bank Account preselected even after closing the browser), use a **namespaced** `localStorage` key that is NOT keyed to `profileId`, only to the global fields that are profile-independent by nature (Bank Account choice, Voucher Type), e.g.:

```typescript
const STORAGE_KEY = "manualEntryForm:lastUsedDefaults";

// On submit success, after building `persisted` above:
localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

// On component mount, before first render's defaultValues are set:
const stored = localStorage.getItem(STORAGE_KEY);
const storedDefaults = stored ? JSON.parse(stored) : {};
```

Only implement the `localStorage` variant if the in-drawer selective-reset behavior is confirmed insufficient by the user after testing Phase 6's first version — start with the `reset()`-only approach since it is simpler and has no state-leak risk.

---

## Phase 7 — Convert All Delivery (UI Trigger)

### 7.1 Add the trigger button in `BoughtTab.tsx`

**File to edit:** `src/components/deals/bought/BoughtTab.tsx`
**Reference:** Place the new button adjacent to `DealsFilter.tsx`'s rendering, in the same toolbar row as any existing "Add Deal" button, so it reads naturally as a bulk-action alongside the per-deal actions on `DealCard.tsx`.

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Truck } from "lucide-react";
import toast from "react-hot-toast";
import { useUiStore } from "@/stores/uiStore";
import { convertAllPendingDeliveries } from "@/services/dealService";

// Inside BoughtTab's toolbar JSX, alongside the existing "Add Deal" button:
function ConvertAllDeliveryButton() {
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const [isConverting, setIsConverting] = useState(false);

  const handleClick = async () => {
    const confirmed = await requestConfirm(
      "Confirm All Pending Deliveries",
      "This will mark EVERY deal currently awaiting delivery as delivered, and post the corresponding ledger entries for each supplier. This cannot be undone. Continue?"
    );
    if (!confirmed) return;

    setIsConverting(true);
    try {
      const { confirmedCount } = await convertAllPendingDeliveries();
      if (confirmedCount === 0) {
        toast("No pending deliveries to confirm");
      } else {
        toast.success(`Confirmed delivery for ${confirmedCount} deal(s)`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to convert pending deliveries");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleClick} disabled={isConverting}>
      <Truck className="h-4 w-4 mr-1" />
      {isConverting ? "Converting..." : "Confirm All Deliveries"}
    </Button>
  );
}
```

**Placement rule:** This is a destructive, irreversible, multi-record action (per Transaction B's semantics — it posts real ledger debits against every pending supplier). It must:
1. Go through `uiStore.requestConfirm()` exactly like `deleteDeal()`/`deleteOrder()` do elsewhere in the app — never skip the confirm dialog for a bulk financial action.
2. Be visually distinguished from the primary "Add Deal" call-to-action (use `variant="outline"` or a muted color, not the primary button style) so it isn't mis-clicked.
3. Only be enabled/visible when at least one deal has `status === "pending_delivery"` — if `BoughtTab.tsx` already fetches the deals list into local state or a store, derive `hasPendingDeliveries` from that existing data rather than making an extra Firestore read just to toggle the button.

### 7.2 Real-time list refresh after conversion

After `convertAllPendingDeliveries()` resolves, whatever mechanism currently keeps `BoughtTab.tsx`'s deal list in sync after a single `confirmDelivery()` call (`onSnapshot` listener, manual refetch, or optimistic store update) should also pick up the bulk change automatically. If deals are read via `onSnapshot`, no extra code is needed — verify this is the case before adding a manual refetch call, to avoid a redundant read.

---

## Phase 8 — Final Verification Checklist

Run through this list only after all seven phases are implemented. Do not mark the task complete until every item passes.

- [ ] `tsc --noEmit` passes with zero errors (all `entityType` exhaustiveness branches resolved)
- [ ] `eslint --max-warnings 0` passes
- [ ] Creating a new Miscellaneous profile appears immediately in `MiscellaneousProfilesTab.tsx` without a page refresh
- [ ] A manual debit/credit entry posted against a Miscellaneous profile updates its `closingBalance` correctly and appears in `LedgerProfileDetail`
- [ ] The Miscellaneous ledger PDF export renders with the correct header label ("Miscellaneous Ledger Statement")
- [ ] Bulk Ledger: submitting 3 rows targeting the same Supplier profile results in exactly ONE correct aggregate update to that profile (not three separate, potentially racing, updates)
- [ ] Bulk Ledger: submitting rows across all three ledger types in one batch correctly posts to each
- [ ] Manual Entry Form: after submitting one entry against a profile, opening the drawer again pre-fills Voucher Type/Rice Type/Bank Account from the prior entry, with Voucher Number incremented and Amount/Particulars cleared
- [ ] "Confirm All Deliveries" is hidden/disabled when zero deals are `pending_delivery`
- [ ] "Confirm All Deliveries" shows the confirm dialog, and cancelling it performs no writes
- [ ] After confirming all deliveries, every affected supplier's `LedgerProfile.totalDebit`/`closingBalance` reflects the sum of all confirmed deals' `totalCost`
- [ ] `confirmDelivery()` (single) and `convertAllPendingDeliveries()` (bulk) share the same extracted ledger-posting helper — grep confirms no duplicated logic
- [ ] No existing feature (Customer Ledger, Supplier Ledger, Deals, Orders, Balance Sheet) regressed — spot-check each page loads and its primary action still works
