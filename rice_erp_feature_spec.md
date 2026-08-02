# Rice ERP — Feature Implementation Specification

> **For**: AI Coding Agent (Gemini Flash)
> **Prepared by**: Lead Software Architect
> **Target Repo**: `c:\dev\ERP\rice-erp`
> **Stack Context**: React 18 + Vite + TypeScript, Firebase Firestore (`writeBatch` / `runTransaction`), Zustand, shadcn/ui + Tailwind, React Hook Form + Zod, `date-fns`

## How to Use This Document

This is a file-by-file implementation plan for four feature workstreams. Each section lists:
- Exact files to create/modify
- Type/interface changes
- Firestore transaction logic (pseudocode close to real TS)
- UI component changes
- Edge cases and validation rules to preserve existing invariants (see Rice ERP system docs §16)

Implement the sections **in order** — later sections depend on types introduced earlier (specifically, Section 3's calendar component is consumed by Sections 1 and 2's form updates).

---

## SECTION 1 — Discount Feature (Deals Section)

### 1.1 Goal

Allow a deal (purchase) to be created with an optional **discount**, expressed as a quantity of kg deducted from stock at a given discount rate per kg. The discount reduces the effective billable cost of the deal while the physical stock ledger must still reflect the discounted kg separately (so inventory reconciles with what was physically received minus what was written off as discount).

### 1.2 Type Changes

**File**: `src/types/deal.ts` (or wherever `Deal` is defined — per system docs, likely `src/types/`)

```typescript
export interface DealDiscount {
  discountKg: number;        // Quantity of kg subtracted from stock as discount
  discountRatePerKg: number; // Rate applied per kg for the discount value
  discountValue: number;     // discountKg * discountRatePerKg (pre-computed, stored)
}

export interface Deal {
  dealId: string;
  supplierId: string;
  supplierName: string;
  product: Product;
  totalAmountKg: number;       // Gross kg purchased (as physically delivered/agreed)
  remainingAmountKg: number;   // Raw kg not yet divided into bags (post-discount basis, see 1.4)
  pricePerKg: number;
  totalCost: number;           // NET cost after discount (see formula 1.4)
  grossCost: number;           // NEW: totalAmountKg * pricePerKg (pre-discount, for audit)
  discount: DealDiscount | null; // NEW: null when no discount applied
  purchaseDate: Timestamp;
  deliveryConfirmed: boolean;
  deliveryDate: Timestamp | null;
  status: "pending_delivery" | "delivered" | "dividing" | "completed";
  notes?: string;
}
```

> **Migration note**: `grossCost` and `discount` are new optional-at-read fields. Existing documents won't have them — read code must default `discount` to `null` and `grossCost` to `totalCost` when absent.

### 1.3 `AddDealModal.tsx` — UI Changes

**File**: `src/components/deals/bought/AddDealModal.tsx`

Add a collapsible "Apply Discount" section (use shadcn `Collapsible` or a simple checkbox toggle labeled **"Apply Discount / Stock Deduction"**). When expanded, show two new fields:

1. **Discount Quantity (kg)** — `<Input type="number" step="0.01" />`, bound to Zod schema field `discountKg`
2. **Discount Rate (₹/kg)** — `<Input type="number" step="0.01" />`, bound to `discountRatePerKg`

Add a live-computed read-only summary block below these fields, recalculated on every keystroke via `useMemo` or `watch()` from React Hook Form:

```typescript
const totalAmountKg = watch("totalAmountKg") || 0;
const pricePerKg = watch("pricePerKg") || 0;
const discountEnabled = watch("discountEnabled");
const discountKg = watch("discountKg") || 0;
const discountRatePerKg = watch("discountRatePerKg") || 0;

const grossCost = totalAmountKg * pricePerKg;
const discountValue = discountEnabled ? discountKg * discountRatePerKg : 0;
const netTotalCost = grossCost - discountValue;
const netStockKg = totalAmountKg - (discountEnabled ? discountKg : 0);
```

Display in the summary card:
- Gross Cost: `₹{grossCost}`
- Discount: `− ₹{discountValue}` (only if enabled)
- **Net Total Cost: `₹{netTotalCost}`** (bold, this is what gets billed to the supplier ledger)
- Net Stock Received: `{netStockKg} kg` (this is what enters inventory)

**Validation (Zod schema, `src/schemas/dealSchema.ts`)**:

```typescript
discountEnabled: z.boolean().default(false),
discountKg: z.number().min(0).optional(),
discountRatePerKg: z.number().min(0).optional(),
```
.superRefine to enforce:
- If `discountEnabled === true`, `discountKg` and `discountRatePerKg` must both be > 0
- `discountKg` must be **strictly less than** `totalAmountKg` (cannot discount 100%+ of stock — leave at least a nominal amount, e.g. `discountKg < totalAmountKg`)

### 1.4 `dealService.ts` — Service Layer Changes

**File**: `src/services/dealService.ts`

Modify `createDeal()` (or equivalent) to compute and persist the net values. **Physical stock logic**: the `Inventory` document's `totalBoughtKg` should reflect the **net** kg (post-discount), since the discounted kg was never actually received as usable stock. The **billing** logic (ledger `totalCost`) should also reflect the net cost.

```typescript
export async function createDeal(input: CreateDealInput): Promise<string> {
  const batch = writeBatch(db);

  const grossCost = input.totalAmountKg * input.pricePerKg;
  const hasDiscount = input.discountEnabled && input.discountKg > 0;
  const discountValue = hasDiscount ? input.discountKg * input.discountRatePerKg : 0;
  const netTotalCost = grossCost - discountValue;
  const netStockKg = input.totalAmountKg - (hasDiscount ? input.discountKg : 0);

  const dealRef = doc(collection(db, "deals"));
  const dealData: Deal = {
    dealId: dealRef.id,
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    product: input.product,
    totalAmountKg: netStockKg,          // stock-basis kg (post-discount)
    remainingAmountKg: netStockKg,
    pricePerKg: input.pricePerKg,
    totalCost: netTotalCost,
    grossCost: grossCost,
    discount: hasDiscount
      ? { discountKg: input.discountKg, discountRatePerKg: input.discountRatePerKg, discountValue }
      : null,
    purchaseDate: input.purchaseDate,
    deliveryConfirmed: false,
    deliveryDate: null,
    status: "pending_delivery",
    notes: input.notes ?? "",
  };
  batch.set(dealRef, dealData);

  const inventoryRef = doc(db, "inventory", dealRef.id);
  batch.set(inventoryRef, {
    inventoryId: dealRef.id,
    dealId: dealRef.id,
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    product: input.product,
    totalBoughtKg: netStockKg,
    totalDividedKg: 0,
    totalSoldKg: 0,
    remainingRawKg: netStockKg,
    remainingPackedKg: 0,
    divisionBreakdown: [],
    status: "in_stock",
    lastUpdated: serverTimestamp(),
  });

  // supplierLedgerEntries (flat legacy log) — record NET value
  const ledgerEventRef = doc(collection(db, "supplierLedgerEntries"));
  batch.set(ledgerEventRef, {
    id: ledgerEventRef.id,
    eventType: "purchase_created",
    dealId: dealRef.id,
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    product: input.product,
    amountKg: netStockKg,
    totalValue: netTotalCost,
    date: input.purchaseDate,
    // NEW fields for discount audit trail on the flat log too:
    discountKg: hasDiscount ? input.discountKg : 0,
    discountValue: discountValue,
  });

  await batch.commit();

  // Post to the supplier's LedgerProfile with discount detail baked into particulars/subParticulars
  await ledgerProfileService.recordDealPurchase(dealRef.id, dealData);

  return dealRef.id;
}
```

### 1.5 `ledgerProfileService.ts` — Ledger Entry with Discount Detail

**File**: `src/services/ledgerProfileService.ts`

The function that writes the `purchase_created` (or `delivery_confirmed`) entry to the supplier's `ledgerProfiles/{id}/entries/` subcollection must embed the discount detail into `subParticulars`, and optionally a distinct `particulars` note.

```typescript
export async function recordDealPurchase(dealId: string, deal: Deal): Promise<void> {
  const profileId = await getOrCreateSupplierProfile(deal.supplierId, deal.supplierName);

  const baseSubParticulars = `${deal.totalAmountKg} kg @ ₹${deal.pricePerKg.toFixed(2)}/kg`;
  const subParticulars = deal.discount
    ? `${baseSubParticulars} | Discount: ${deal.discount.discountKg} kg @ ₹${deal.discount.discountRatePerKg.toFixed(2)}/kg (−₹${deal.discount.discountValue.toFixed(2)})`
    : baseSubParticulars;

  const particulars = deal.discount
    ? `Purchase — ${deal.product.riceTypeName} (Net of Discount)`
    : `Purchase — ${deal.product.riceTypeName}`;

  await runTransaction(db, async (tx) => {
    const profileRef = doc(db, "ledgerProfiles", profileId);
    const entryRef = doc(collection(db, "ledgerProfiles", profileId, "entries"));

    tx.set(entryRef, {
      id: entryRef.id,
      profileId,
      entityId: deal.supplierId,
      entityType: "supplier",
      date: deal.purchaseDate,
      particulars,
      subParticulars,
      refLabel: `Code: ${deal.product.productCode}`,
      vchType: "Purchase",
      vchNo: await getNextVchNo(profileId, tx),
      debit: deal.totalCost,   // NET cost — this is what the supplier is owed
      credit: 0,
      entryType: "purchase_created",
      isManual: false,
      isSystemGenerated: true,
      relatedDocId: dealId,
      quantityKg: deal.totalAmountKg,
      pricePerUnit: deal.pricePerKg,
      riceType: deal.product.riceTypeName,
    });

    tx.update(profileRef, {
      totalDebit: increment(deal.totalCost),
      closingBalance: increment(deal.totalCost),
    });
  });
}
```

> **Important**: `debit` uses the **net** `deal.totalCost`, not `grossCost`, so the supplier ledger balance matches what is actually owed after the discount is applied. The `subParticulars` string is the audit trail showing how that net figure was derived.

### 1.6 Edge Cases to Preserve

- If a deal with a discount is later **deleted**, `deleteDeal()` must reverse using the same net `totalCost`/`totalAmountKg` values that were originally written (not recompute from current form state) — read the existing `Deal` doc fields for the reversal, don't recalculate.
- `confirmDelivery()` and bag division logic operate on `remainingAmountKg`/`totalAmountKg`, which are already net — no changes needed there since the discount was applied at creation time.

---

## SECTION 2 — Bank Reference for Manual Ledger Entries

### 2.1 Goal

Let a manual ledger entry (in `ManualEntryForm.tsx`) optionally cite which bank the money moved through. When a bank is selected, the entry must also debit/credit that bank's `principalAmount` and log a corresponding row in `banks/{bankId}/transactions/`, atomically with the ledger entry write.

### 2.2 Type Changes

**File**: `src/types/ledger.ts`

```typescript
export interface LedgerEntry {
  id: string;
  profileId: string;
  entityId: string;
  entityType: "supplier" | "customer";
  date: Timestamp;
  particulars: string;
  subParticulars?: string;
  refLabel?: string;
  vchType: "Purchase" | "Payment" | "Receipt" | "Sale" | "Journal" | "Manual";
  vchNo: number;
  debit: number;
  credit: number;
  entryType: LedgerEntryType;
  isManual: boolean;
  isSystemGenerated: boolean;
  relatedDocId?: string;
  quantityKg?: number;
  pricePerUnit?: number;
  riceType?: string;
  // NEW
  bankId?: string | null;
  bankName?: string | null;
}
```

### 2.3 `ManualEntryForm.tsx` — UI Changes

**File**: `src/components/ledger/shared/ManualEntryForm.tsx`

Add an optional **Bank** field, positioned directly below the "Entry Kind: Debit or Credit" selector:

```tsx
const banks = useBankStore((s) => s.banks); // live via onSnapshot, already in bankStore

<div className="space-y-2">
  <Label>Bank Reference (optional)</Label>
  <Select value={selectedBankId ?? "none"} onValueChange={(v) => setSelectedBankId(v === "none" ? null : v)}>
    <SelectTrigger>
      <SelectValue placeholder="No bank (ledger-only entry)" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">No bank (ledger-only entry)</SelectItem>
      {banks.map((bank) => (
        <SelectItem key={bank.id} value={bank.id}>
          {bank.name} — ₹{bank.principalAmount.toLocaleString()}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  {selectedBankId && (
    <p className="text-xs text-muted-foreground">
      This entry will also {entryKind === "debit" ? "credit" : "debit"} the selected bank by ₹{amount || 0}.
    </p>
  )}
</div>
```

**Direction logic to display to the user** (critical — get this right):
- A **debit** ledger entry against a supplier/customer profile that is bank-funded typically means money went **out** of the bank (e.g., paying a supplier) → bank should be **debited** (balance decreases). Wait — check against existing `entryType` semantics: `payment_made` (credit to supplier, since it reduces what we owe) is money **out of the bank**. `payment_received` (debit to customer) is money **into the bank**.
- Concretely, tie bank direction to **ledger entry kind**, not literal debit/credit label, using this rule:
  - **Manual Credit entry on a Supplier profile** (`entryType: "manual_credit"`, e.g. recording a payment made to supplier) → money leaves the business → **bank debit** (balance decreases)
  - **Manual Debit entry on a Customer profile** (`entryType: "manual_debit"`, e.g. recording a receipt from customer) → money enters the business → **bank credit** (balance increases)
  - **Manual Debit entry on a Supplier profile** (increasing what we owe, rare/adjustment) → no bank movement implied by default; still allow bank selection for audit purposes only if the user explicitly wants a log entry (see note below), but do NOT move funds unless the entry represents an actual cash movement.
  - Simplify implementation: expose an explicit **"Fund Direction"** micro-toggle only when a bank is selected, defaulting intelligently per the table below, but editable by the user to cover edge cases:

| Profile Type | Entry Kind | Default Bank Movement |
|---|---|---|
| Supplier | Credit (payment made) | Bank **debit** (money out) |
| Supplier | Debit (adjustment/increase owed) | No bank movement (toggle available, default off) |
| Customer | Debit (payment received) | Bank **credit** (money in) |
| Customer | Credit (adjustment/refund owed) | Bank **debit** (money out, e.g. refund) |

Add a small `Switch` labeled **"Also record this as a fund movement in the selected bank"**, defaulted per the table, so the user can opt out for pure book adjustments that didn't touch actual cash.

### 2.4 `addManualLedgerEntry()` — Transaction Logic

**File**: `src/services/ledgerProfileService.ts`

```typescript
interface AddManualLedgerEntryInput {
  profileId: string;
  entityId: string;
  entityType: "supplier" | "customer";
  date: Timestamp;
  particulars: string;
  subParticulars?: string;
  vchType: LedgerEntry["vchType"];
  vchNo: number;
  entryKind: "debit" | "credit";
  amount: number;
  quantityKg?: number;
  pricePerUnit?: number;
  riceType?: string;
  bankId?: string | null;
  recordFundMovement?: boolean;     // from the Switch, only relevant if bankId is set
  bankMovementDirection?: "credit" | "debit"; // resolved default from the table, editable
}

export async function addManualLedgerEntry(input: AddManualLedgerEntryInput): Promise<string> {
  const entryRef = doc(collection(db, "ledgerProfiles", input.profileId, "entries"));
  const profileRef = doc(db, "ledgerProfiles", input.profileId);
  const bankRef = input.bankId ? doc(db, "banks", input.bankId) : null;
  const bankTxnRef = input.bankId
    ? doc(collection(db, "banks", input.bankId, "transactions"))
    : null;

  const willMoveFunds = !!input.bankId && input.recordFundMovement !== false;

  await runTransaction(db, async (tx) => {
    // ---- READS FIRST (Firestore transaction rule) ----
    let bankSnap: DocumentSnapshot | null = null;
    if (willMoveFunds && bankRef) {
      bankSnap = await tx.get(bankRef);
      if (!bankSnap.exists()) throw new Error("Selected bank not found.");
    }

    const currentBalance = bankSnap ? (bankSnap.data() as Bank).principalAmount : 0;

    if (willMoveFunds && input.bankMovementDirection === "debit") {
      const newBalance = currentBalance - input.amount;
      if (newBalance < 0) {
        throw new Error("Insufficient bank balance for this manual entry.");
      }
    }

    // ---- WRITES ----
    const entryData: LedgerEntry = {
      id: entryRef.id,
      profileId: input.profileId,
      entityId: input.entityId,
      entityType: input.entityType,
      date: input.date,
      particulars: input.particulars,
      subParticulars: input.subParticulars ?? "",
      vchType: input.vchType,
      vchNo: input.vchNo,
      debit: input.entryKind === "debit" ? input.amount : 0,
      credit: input.entryKind === "credit" ? input.amount : 0,
      entryType: input.entryKind === "debit" ? "manual_debit" : "manual_credit",
      isManual: true,
      isSystemGenerated: false,
      quantityKg: input.quantityKg,
      pricePerUnit: input.pricePerUnit,
      riceType: input.riceType,
      bankId: input.bankId ?? null,
      bankName: bankSnap ? (bankSnap.data() as Bank).name : null,
    };
    tx.set(entryRef, entryData);

    tx.update(profileRef, {
      totalDebit: increment(entryData.debit),
      totalCredit: increment(entryData.credit),
      closingBalance: increment(entryData.debit - entryData.credit),
    });

    if (willMoveFunds && bankRef && bankTxnRef) {
      const delta = input.bankMovementDirection === "credit" ? input.amount : -input.amount;
      const newBalance = currentBalance + delta;

      tx.update(bankRef, { principalAmount: increment(delta) });

      tx.set(bankTxnRef, {
        id: bankTxnRef.id,
        type: input.bankMovementDirection, // "credit" | "debit"
        amount: input.amount,
        balanceAfter: newBalance,
        relatedSalaryTxId: null,
        payeeEmployeeId: null,
        payeeEmployeeName: null,
        note: `Ledger: ${input.particulars} (${input.entityType} — ${entryData.entityId})`,
        performedBy: getCurrentUserUid(),
        relatedLedgerEntryId: entryRef.id, // NEW field to trace back
        relatedProfileId: input.profileId, // NEW field
      });
    }
  });

  return entryRef.id;
}
```

**Mirror the same logic in `deleteManualLedgerEntry()`** — when deleting a manual entry that has a non-null `bankId` and had `recordFundMovement`, reverse the bank's `principalAmount` and either delete the corresponding `banks/{bankId}/transactions/{txnId}` doc or write an offsetting reversal transaction (prefer writing a reversal, not deleting, to preserve the bank's audit trail — mark it `note: "Reversal of deleted ledger entry ..."`).

### 2.5 Bank Profile Log Visibility

Per the requirement "ensure these manual entries reflect under the specific bank's profile log": since we write to `banks/{bankId}/transactions/`, the existing `BankTransactionLog.tsx` "Adjustments" sub-tab (which filters on `relatedSalaryTxId === null`) will **already pick these up** with no changes needed, since manual ledger-driven bank transactions also have `relatedSalaryTxId === null`. Optionally, add a third filter chip or badge distinguishing "Ledger" vs "Manual Adjustment" transactions by checking for the presence of `relatedLedgerEntryId`.

**File to touch**: `src/components/wages/bank/BankTransactionLog.tsx` — add a badge:
```tsx
{txn.relatedLedgerEntryId && <Badge variant="outline">Ledger Entry</Badge>}
```

---

## SECTION 3 — Bengali Calendar Integration

### 3.1 Package Selection

Install a dual-calendar-capable date picker. Recommended package:

```bash
npm install bengali-calendar
npm install react-day-picker@^9
```

> `bengali-calendar` provides Gregorian ⇄ Bengali (Bangla) date conversion utilities (day/month/year in Bengali script and the Bengali calendar system). `react-day-picker` is the underlying picker primitive already compatible with shadcn/ui's `Calendar` component (shadcn's `Calendar` component is a styled wrapper around `react-day-picker`), so no need to replace the existing shadcn `Popover` + `Calendar` combo — we extend it.

If `bengali-calendar` proves unmaintained at implementation time, use `bangla-calendar` or hand-roll conversion using the well-known Bengali calendar epoch algorithm (Bengali San calendar, currently ~1432–1433 BS) — either is acceptable since the requirement is **display** of the Bengali equivalent alongside the Gregorian date, not authoritative Bengali civil record-keeping.

### 3.2 New Shared Component

**File**: `src/components/shared/DualCalendarDatePicker.tsx` (new)

```tsx
import { useState } from "react";
import { format } from "date-fns";
import { toBengaliDate } from "bengali-calendar"; // adjust to actual package API
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DualCalendarDatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function DualCalendarDatePicker({ value, onChange, placeholder = "Pick a date", disabled }: DualCalendarDatePickerProps) {
  const [open, setOpen] = useState(false);

  const bengaliLabel = value ? formatBengaliDate(value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            <span className="flex flex-col items-start leading-tight">
              <span>{format(value, "PPP")}</span>
              {bengaliLabel && <span className="text-xs text-muted-foreground">{bengaliLabel}</span>}
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
          initialFocus
        />
        {value && (
          <div className="border-t p-2 text-center text-xs text-muted-foreground">
            Bengali (বঙ্গাব্দ): {bengaliLabel}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function formatBengaliDate(date: Date): string {
  try {
    const bn = toBengaliDate(date); // { day, month, year, monthName } — adapt to actual lib shape
    return `${bn.day} ${bn.monthName} ${bn.year}`;
  } catch {
    return "";
  }
}
```

> This component wraps the **existing** shadcn `Calendar`/`Popover` rather than replacing it, so all existing Tailwind theming carries over automatically. It only adds a secondary Bengali-date caption line under the Gregorian date.

### 3.3 Consuming the New Component

Replace raw date-picker usages with `<DualCalendarDatePicker />` in these three files:

**File**: `src/components/deals/bought/AddDealModal.tsx`
- Replace the "Purchase date picker" element with:
  ```tsx
  <DualCalendarDatePicker value={watch("purchaseDate")} onChange={(d) => setValue("purchaseDate", d)} placeholder="Purchase date" />
  ```

**File**: `src/components/deals/sold/OrderForm.tsx`
- Replace the "Order date picker" element with the same pattern, bound to `orderDate`.

**File**: `src/components/ledger/shared/ManualEntryForm.tsx`
- Replace the "Date picker" element with the same pattern, bound to the manual entry's `date` field.

No changes needed to `date-fns` usage elsewhere — `DualCalendarDatePicker` still returns a plain JS `Date`, so all existing `date-fns` formatting/serialization to Firestore `Timestamp` (via `Timestamp.fromDate(date)`) downstream in each form's submit handler stays exactly as-is.

### 3.4 Optional Enhancement (Not Required, Note Only)

If the business later wants **input** in the Bengali calendar (not just display), that requires a custom `react-day-picker` `formatters`/`components` override to render Bengali numerals and month grid — flag this as a possible Phase 2 item, out of scope here since only *display alongside* Gregorian was requested.

---

## SECTION 4 — Ledger Fixes (Live Updates, Search, Notes Mapping)

### 4.1 Real-Time `onSnapshot` for Ledger Entries

**Problem**: Deal/order confirmations don't appear instantly in `LedgerProfileDetail.tsx` because entries are currently fetched once rather than subscribed to live.

**File**: `src/components/ledger/shared/LedgerProfileDetail.tsx`

Replace the one-time fetch with a persistent `onSnapshot` listener, scoped to the currently open profile, cleaned up on unmount or profile change:

```tsx
useEffect(() => {
  if (!profileId) return;

  const entriesQuery = query(
    collection(db, "ledgerProfiles", profileId, "entries"),
    orderBy("date", "asc"),
    orderBy("createdAt", "asc") // secondary sort for drag-reorder interpolation
  );

  const unsubscribeEntries = onSnapshot(entriesQuery, (snapshot) => {
    const entries = snapshot.docs.map((d) => d.data() as LedgerEntry);
    setEntries(entries); // local component state, or push into useLedgerStore
  });

  const profileRef = doc(db, "ledgerProfiles", profileId);
  const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
    if (snap.exists()) setProfile(snap.data() as LedgerProfile);
  });

  return () => {
    unsubscribeEntries();
    unsubscribeProfile();
  };
}, [profileId]);
```

**Store-level alternative** (preferred if `useLedgerStore.ts` already centralizes profile+entries caching): move this subscription logic into the store instead of the component, exposing a `subscribeToProfileEntries(profileId)` action that the component calls in its `useEffect`, mirroring the existing `bankStore` / `wagesStore` pattern (per system docs §12, these already use `onSnapshot` — replicate that pattern here rather than inventing a new one).

**File**: `src/stores/useLedgerStore.ts`

```typescript
interface LedgerStoreState {
  // ...existing fields
  activeProfileEntries: LedgerEntry[];
  activeProfileUnsubscribe: (() => void) | null;
  subscribeToProfileEntries: (profileId: string) => void;
  unsubscribeFromProfileEntries: () => void;
}

// inside create<LedgerStoreState>()((set, get) => ({
subscribeToProfileEntries: (profileId: string) => {
  get().unsubscribeFromProfileEntries(); // clean up any prior subscription first

  const q = query(
    collection(db, "ledgerProfiles", profileId, "entries"),
    orderBy("date", "asc"),
    orderBy("createdAt", "asc")
  );

  const unsub = onSnapshot(q, (snap) => {
    set({ activeProfileEntries: snap.docs.map((d) => d.data() as LedgerEntry) });
  });

  set({ activeProfileUnsubscribe: unsub });
},

unsubscribeFromProfileEntries: () => {
  const unsub = get().activeProfileUnsubscribe;
  if (unsub) unsub();
  set({ activeProfileUnsubscribe: null, activeProfileEntries: [] });
},
```

Remove the old `forceRefresh`-based cache-busting call sites for the entries list specifically (keep `forceRefresh` for the **profile list** sidebar, since that's a different, coarser-grained cache) — once entries are live via `onSnapshot`, no explicit refresh call is needed after `addManualLedgerEntry`, `deleteManualLedgerEntry`, deal confirmation, or order confirmation.

### 4.2 Search Bar in Profile Tabs

**Files**: `src/components/ledger/supplier/profiles/SupplierProfilesTab.tsx`, `src/components/ledger/customer/profiles/CustomerProfilesTab.tsx`

Both components follow an identical pattern — implement the same change in both:

```tsx
const [searchQuery, setSearchQuery] = useState("");

const filteredProfiles = useMemo(() => {
  if (!searchQuery.trim()) return profiles;
  const q = searchQuery.trim().toLowerCase();
  return profiles.filter((p) => p.entityName.toLowerCase().includes(q));
}, [profiles, searchQuery]);
```

Add above the table:

```tsx
<div className="relative max-w-sm mb-4">
  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Search suppliers by name..." // "customers by name..." in the customer variant
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-8"
  />
</div>
```

Render `filteredProfiles` instead of `profiles` in the table body. This is a pure client-side filter (profile lists are already fully loaded via the existing `useLedgerStore` cache, per system docs §12) — no new Firestore query needed.

### 4.3 Map Deal "Notes" into Ledger `particulars`

**Problem**: The `notes` field entered on the Deal creation form is captured on the `Deal` document but not currently surfaced into the ledger entry's `particulars` text.

**File**: `src/services/ledgerProfileService.ts` (the same `recordDealPurchase()` function touched in Section 1.5 — apply both changes together)

Update the `particulars` construction to append notes when present:

```typescript
const baseParticulars = deal.discount
  ? `Purchase — ${deal.product.riceTypeName} (Net of Discount)`
  : `Purchase — ${deal.product.riceTypeName}`;

const particulars = deal.notes?.trim()
  ? `${baseParticulars} — ${deal.notes.trim()}`
  : baseParticulars;
```

Apply the equivalent mapping wherever `Order.notes` (from `OrderForm.tsx`, per system docs §7.3) feeds the customer-side `order_confirmed` ledger entry, in the corresponding order-confirmation ledger-writing function (`confirmOrder()` in `orderService.ts`, per system docs §7.3/§15) — locate the `particulars` construction there and apply the same "append notes if present" rule for consistency across both purchase and sale ledger entries.

**File**: `src/services/orderService.ts` — inside `confirmOrder()`, wherever the `Sale` ledger entry's `particulars` string is built:

```typescript
const baseParticulars = `Sale — Order ${order.orderId.slice(0, 8)}`;
const particulars = order.notes?.trim()
  ? `${baseParticulars} — ${order.notes.trim()}`
  : baseParticulars;
```

### 4.4 Regression Checklist for Section 4

- [ ] Confirming a deal delivery reflects in `LedgerProfileDetail` without a manual page refresh
- [ ] Confirming an order reflects in the customer's `LedgerProfileDetail` without a manual page refresh
- [ ] Adding/deleting a manual entry no longer requires the old `forceRefresh` flag for the entries table (profile list `closingBalance` still updates correctly via existing profile-level `onSnapshot` or refresh, whichever the store already uses)
- [ ] Search box in both profile tabs is case-insensitive and updates instantly on keystroke
- [ ] Deal notes appear appended to `particulars` in the supplier ledger row
- [ ] Order notes appear appended to `particulars` in the customer ledger row
- [ ] Unsubscribe functions are called on component unmount / profile switch (no listener leaks — verify via React DevTools or a console log in the cleanup function during manual testing)

---

## Summary of All Files Touched

| File | Section(s) | Change Type |
|---|---|---|
| `src/types/deal.ts` | 1 | Modify (add `DealDiscount`, `grossCost`, `discount`) |
| `src/schemas/dealSchema.ts` | 1 | Modify (Zod validation for discount fields) |
| `src/components/deals/bought/AddDealModal.tsx` | 1, 3 | Modify (discount UI + calendar swap) |
| `src/services/dealService.ts` | 1 | Modify (`createDeal` net-cost logic) |
| `src/services/ledgerProfileService.ts` | 1, 2, 4 | Modify (discount subParticulars, manual entry bank tx, notes mapping) |
| `src/types/ledger.ts` | 2 | Modify (add `bankId`, `bankName` to `LedgerEntry`) |
| `src/components/ledger/shared/ManualEntryForm.tsx` | 2, 3 | Modify (bank selector + calendar swap) |
| `src/components/wages/bank/BankTransactionLog.tsx` | 2 | Modify (badge for ledger-originated txns) |
| `package.json` | 3 | Modify (add `bengali-calendar`, `react-day-picker`) |
| `src/components/shared/DualCalendarDatePicker.tsx` | 3 | **New file** |
| `src/components/deals/sold/OrderForm.tsx` | 3, 4 | Modify (calendar swap + notes mapping via `orderService.ts`) |
| `src/components/ledger/shared/LedgerProfileDetail.tsx` | 4 | Modify (`onSnapshot` listeners) |
| `src/stores/useLedgerStore.ts` | 4 | Modify (add `subscribeToProfileEntries` action) |
| `src/components/ledger/supplier/profiles/SupplierProfilesTab.tsx` | 4 | Modify (search bar) |
| `src/components/ledger/customer/profiles/CustomerProfilesTab.tsx` | 4 | Modify (search bar) |
| `src/services/orderService.ts` | 4 | Modify (`confirmOrder` notes mapping) |

---

## Implementation Order Recommendation for the Coding Agent

1. Section 3 (calendar component) first — it's a pure additive dependency with no side effects on data.
2. Section 1 (discount) — touches core deal creation; test thoroughly against the existing invariant "no deletion of a deal if bags are sold" (system docs §16.1) since `totalAmountKg` now represents net-of-discount stock.
3. Section 2 (bank reference) — isolated to manual entries; verify against existing invariant "bank balance cannot go negative" (system docs §16.5) by reusing the same guard pattern already used in `adjustPrincipal()`.
4. Section 4 (ledger fixes) — do last since it touches the most surface area (store, two profile tabs, two services) and benefits from Sections 1–2's new fields already being in place for testing real-time updates end-to-end.

*End of Feature Implementation Specification*
