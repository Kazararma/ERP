# Rice ERP — Feature Implementation Blueprint
**Target Agent:** Gemini Flash (Antigravity)
**Author Role:** Staff Software Engineer / System Architect
**Stack Context:** React 18, TypeScript 5, Vite 8, Zustand 5.0, Firebase 12 (Firestore), React Hook Form + Zod, Shadcn UI (Radix/@base-ui), Tailwind CSS 3.4, Recharts, @react-pdf/renderer, @dnd-kit

---

## 0. Read This First (Agent Instructions)

You are modifying an existing production ERP codebase. Do **not** invent new architectural patterns — follow the conventions already established in `ledgerProfileService.ts` and `balanceSheetAggregation.ts`. Specifically:

1. All financial mutations that touch more than one document (a ledger entry + its parent profile, or a balance sheet row + its aggregation cache) **must** be wrapped in a Firestore `runTransaction` block. Never do sequential `updateDoc` calls for related financial writes.
2. Reuse existing types wherever possible. Only extend types (via optional fields) rather than replacing them, to avoid breaking existing consumers.
3. Every new UI surface must use existing Shadcn primitives already in the project (`Dialog`, `Popover`, `Command`, `Button`, `Input`, `Badge`) rather than introducing new UI libraries.
4. Implement the three features as three independent, sequential phases. Do not start Phase 2 until Phase 1 compiles and lints cleanly. Do not start Phase 3 until Phase 2 compiles and lints cleanly.
5. After each phase, run `tsc --noEmit` and fix all type errors before proceeding.

---

## Phase 1 — Rename "Bought" / "Sold" → "Purchase" / "Sale"

### 1.1 Scope
This is a **display-layer-only** rename. Do **not** rename underlying enum values, Firestore field values, or database records (e.g. `dealType: 'bought' | 'sold'` stays as-is in the data layer) unless a dedicated label-mapping layer is cleaner. Prefer a label-mapping approach over renaming the enum, to avoid a data migration.

### 1.2 Files to Modify
- `src/components/Deals/DealsToolbar.tsx` (or wherever the "Bought"/"Sold" action buttons currently live — locate via search for the literal strings `"Bought"` and `"Sold"`)
- `src/components/Deals/DealTypeBadge.tsx` (if a badge/chip renders the deal type label)
- `src/constants/dealLabels.ts` **(new file)** — central label map

### 1.3 Implementation Detail

Create a single source of truth for the label so no other string literals get out of sync:

```ts
// src/constants/dealLabels.ts
export const DEAL_TYPE_LABELS: Record<'bought' | 'sold', string> = {
  bought: 'Purchase',
  sold: 'Sale',
};
```

Replace every hardcoded `"Bought"` / `"Sold"` JSX string with `DEAL_TYPE_LABELS[dealType]`. Search the codebase for these literals (case-insensitive: `bought`, `sold`, `Buy`, `Sell`) in:
- Button labels
- Table column renderers
- PDF templates (`@react-pdf/renderer` invoice/report components) — if the words appear on generated PDFs, update those templates too
- Any `<Select>` / `<Tabs>` filter option labels for deal type

### 1.4 Acceptance Criteria
- No visible instance of "Bought" or "Sold" remains anywhere in the Deals UI or generated PDFs.
- Underlying `dealType` values in Firestore and TypeScript types are unchanged (`'bought' | 'sold'`), preserving backward compatibility with existing documents.

---

## Phase 2 — Payment Voucher (Deals Section)

### 2.1 Feature Summary
A "Payment" button/dropdown in the Deals section opens a voucher flow that:
1. Lets the user pick **Supplier** or **Customer** mode.
2. Shows a searchable combobox of ledger profiles filtered by that type.
3. On selecting a profile, displays its current `totalDebit`, `totalCredit`, and `closingBalance`.
4. Lets the user enter an amount, date, mode of payment, and optional note.
5. On submit, posts a ledger entry via `ledgerProfileService.ts`:
   - **Supplier payment → Credit** entry (reduces payable).
   - **Customer payment → Debit** entry (reduces receivable) — confirm this matches your existing sign convention in `ledgerProfileService.ts`; if the existing service already encodes "payment received from customer = Debit" as a receipt rather than what's colloquially expected, follow the code's existing convention, not colloquial accounting intuition.

### 2.2 Files to Create
```
src/components/Deals/PaymentVoucher/
  ├── PaymentVoucherDialog.tsx        # Root dialog, houses the form
  ├── ProfileCombobox.tsx             # Searchable Command+Popover combobox
  ├── PaymentVoucherForm.tsx          # react-hook-form + zod form body
  ├── paymentVoucherSchema.ts         # zod schema + inferred TS type
  └── usePaymentVoucher.ts            # hook: submit handler + transaction call
```

### 2.3 Files to Modify
- `src/components/Deals/DealsToolbar.tsx` — add "Payment" trigger button/dropdown (use existing `DropdownMenu` if a menu of voucher types is desired, e.g. future "Receipt"/"Payment" grouping).
- `src/services/ledgerProfileService.ts` — add (or confirm existence of) an exported function, e.g. `postManualLedgerEntry(profileId, entry, entityType)`, that Phase 2 will call. If it doesn't exist yet, implement it per §2.6.
- `src/types/ledger.ts` (or wherever `LedgerProfile` / ledger entry types live) — extend the ledger entry type with an optional `source: 'deal' | 'manual-payment' | 'manual-receipt'` discriminator if not already present, so vouchers are distinguishable from deal-driven entries in the entries sub-collection.

### 2.4 Zod Schema

```ts
// paymentVoucherSchema.ts
import { z } from 'zod';

export const paymentVoucherSchema = z.object({
  entityType: z.enum(['supplier', 'customer']),
  profileId: z.string().min(1, 'Select a profile'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paymentDate: z.date(),
  paymentMode: z.enum(['cash', 'bank_transfer', 'cheque', 'upi', 'other']).default('cash'),
  referenceNumber: z.string().optional(),
  note: z.string().max(500).optional(),
});

export type PaymentVoucherFormValues = z.infer<typeof paymentVoucherSchema>;
```

### 2.5 Component Logic & Props

**`PaymentVoucherDialog.tsx`**
```ts
interface PaymentVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: 'supplier' | 'customer';
}
```
- Wraps Shadcn `Dialog` / `DialogContent`.
- Renders `PaymentVoucherForm` inside.
- On successful submit, closes the dialog and triggers a toast (use whatever toast system already exists in the project — check for `sonner` or a custom `useToast`).

**`ProfileCombobox.tsx`**
```ts
interface ProfileComboboxProps {
  entityType: 'supplier' | 'customer';
  value: string | null;                 // selected profileId
  onChange: (profileId: string, profile: LedgerProfile) => void;
}
```
- Uses Shadcn `Popover` (trigger = `Button` styled as a combobox) + `Command`/`CommandInput`/`CommandList`/`CommandItem`.
- Data source: call the existing `getLedgerProfilesByType(entityType)` (already used for the batch-fetched ledger table, per the architecture doc) rather than issuing new N+1 queries. Cache the result in local component state or a lightweight React Query/SWR-style hook if the project already uses one; otherwise a simple `useEffect` + `useState` fetch-once-on-mount pattern is fine, matching existing conventions.
- Filter profiles client-side by name as the user types in `CommandInput` (Command's built-in filtering is sufficient; avoid re-querying Firestore per keystroke).
- Once a profile is selected, render a small summary panel below the combobox:
  ```
  Total Debit: ₹{totalDebit}   Total Credit: ₹{totalCredit}   Closing Balance: ₹{closingBalance}
  ```

**`PaymentVoucherForm.tsx`**
- `useForm<PaymentVoucherFormValues>({ resolver: zodResolver(paymentVoucherSchema) })`.
- Fields: `entityType` (Tabs or Segmented control: Supplier / Customer — resets `profileId` on change), `profileId` (via `ProfileCombobox`), `amount` (Input, numeric), `paymentDate` (existing date picker component if one exists in the project, else a simple `<input type="date">` wrapped in RHF `Controller`), `paymentMode` (`Select`), `referenceNumber` (Input, optional), `note` (Textarea, optional).
- Submit calls `usePaymentVoucher().submit(values)`.

**`usePaymentVoucher.ts`**
```ts
export function usePaymentVoucher() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(values: PaymentVoucherFormValues) {
    setIsSubmitting(true);
    try {
      const direction = values.entityType === 'supplier' ? 'credit' : 'debit';
      await postManualLedgerEntry({
        profileId: values.profileId,
        entityType: values.entityType,
        amount: values.amount,
        direction,                  // 'credit' | 'debit'
        date: values.paymentDate,
        mode: values.paymentMode,
        referenceNumber: values.referenceNumber,
        note: values.note,
        source: 'manual-payment',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submit, isSubmitting };
}
```

### 2.6 Firestore Transaction Structure

Implement (or extend) in `ledgerProfileService.ts`:

```ts
export async function postManualLedgerEntry(input: ManualLedgerEntryInput): Promise<void> {
  const profileRef = doc(db, 'ledgerProfiles', input.profileId);
  const entryRef = doc(collection(profileRef, 'entries')); // auto-ID

  await runTransaction(db, async (transaction) => {
    const profileSnap = await transaction.get(profileRef);
    if (!profileSnap.exists()) {
      throw new Error(`Ledger profile ${input.profileId} not found`);
    }
    const profile = profileSnap.data() as LedgerProfile;

    const newTotalDebit = profile.totalDebit + (input.direction === 'debit' ? input.amount : 0);
    const newTotalCredit = profile.totalCredit + (input.direction === 'credit' ? input.amount : 0);
    const newClosingBalance = newTotalDebit - newTotalCredit; // confirm this matches the existing sign convention used elsewhere in the file before finalizing

    transaction.set(entryRef, {
      profileId: input.profileId,
      direction: input.direction,
      amount: input.amount,
      date: input.date,
      mode: input.mode,
      referenceNumber: input.referenceNumber ?? null,
      note: input.note ?? null,
      source: input.source,
      createdAt: serverTimestamp(),
    });

    transaction.update(profileRef, {
      totalDebit: newTotalDebit,
      totalCredit: newTotalCredit,
      closingBalance: newClosingBalance,
      updatedAt: serverTimestamp(),
    });
  });
}
```

**Important:** Before writing this function, the agent must first read the existing `totalDebit` / `totalCredit` / `closingBalance` update logic already used for deal-driven entries in `ledgerProfileService.ts` and mirror its exact sign convention and field-naming. Do not assume; verify against the working code path for automated transactional posts described in the architecture doc.

### 2.7 Acceptance Criteria
- Selecting Supplier and Customer swaps the combobox's data source correctly.
- The balance summary panel updates immediately on profile selection, without a full page reload.
- Submitting writes exactly one new document to `ledgerProfiles/{profileId}/entries` and updates the parent profile atomically (verify via Firestore emulator or console that both writes land in the same transaction).
- A failed transaction (e.g. profile deleted mid-flow) surfaces a user-facing error and does not leave a partial write.

---

## Phase 3 — Receipt: Direct Balance Sheet Row Entries

### 3.1 Feature Summary
A "Receipt" button lets the user make a direct numeric adjustment (add or subtract) to any major or minor row in the Balance Sheet (Assets or Liabilities side), independent of the Deals/Ledger flow. This is distinct from the existing inline `EditableAmount` override — Receipt is an additive/subtractive **transaction entry** against a row, not a value overwrite, and should be logged as an auditable adjustment.

### 3.2 Files to Create
```
src/components/BalanceSheet/ReceiptDialog/
  ├── ReceiptDialog.tsx
  ├── RowCombobox.tsx                 # searchable combobox over BS rows (major + minor, flattened)
  ├── receiptSchema.ts
  └── useReceiptEntry.ts
```

### 3.3 Files to Modify
- `src/components/BalanceSheet/BalancePnLContainer.tsx` — add "Receipt" trigger button near existing row action icons (trash icon, `RestoreGroupPopover`, etc.).
- `src/store/useBalanceSheetStore.ts` — add actions described in §3.4.
- `src/services/balanceSheetAggregation.ts` — if manual adjustments must be persisted (not just local state), add a `applyRowAdjustment` persistence function here or in a new `balanceSheetService.ts`.
- `src/types/balanceSheet.ts` (or equivalent) — extend row type with an `adjustmentHistory` or `manualDelta` field if adjustments need to be additive on top of live/system values without permanently overwriting the live computation (this differs from `isOverridden`, which fully replaces the value).

### 3.4 State Management — `useBalanceSheetStore` Updates

Add the following to the store:

```ts
interface BalanceSheetStore {
  // ...existing state...

  applyRowReceipt: (params: {
    rowId: string;
    delta: number;              // positive = add, negative = subtract
    reason?: string;
  }) => void;

  // Optional: track adjustment log for audit trail, separate from isOverridden
  rowAdjustments: Record<string, RowAdjustment[]>;
}

interface RowAdjustment {
  id: string;
  delta: number;
  reason?: string;
  createdAt: string; // ISO timestamp
}
```

**Behavior of `applyRowReceipt`:**
- Locate the row by `rowId` in the current tree (both major-group and minor/child rows must be searchable — reuse whatever tree-traversal/flattening utility already powers the "Sub-group Logic" parent/child summation described in the architecture doc; do not write a second traversal implementation).
- Add `delta` to the row's current `amount`.
- If the row is `Live`, do **not** silently flip it to `isOverridden: true` unless that's the desired UX — clarify this is an *additive adjustment on top of the live value*, which should update the same way the live aggregation would if a similar day-to-day entry occurred. Preferred approach: apply the delta into a separate `manualDelta` accumulator on the row, and have the row's **displayed amount** = `liveComputedAmount + manualDelta`. This preserves the "Restore" button's ability to reset only the live portion, while manual receipts remain layered on top and require a distinct "clear adjustments" action if the user wants to remove them.
- Recompute parent group totals bottom-up after the change (reuse existing aggregation/summation function — do not duplicate it).
- Push a `RowAdjustment` record into `rowAdjustments[rowId]` for audit purposes.

### 3.5 Component Logic & Props

**`ReceiptDialog.tsx`**
```ts
interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```
- Renders a form: `RowCombobox` (select target row) → `amount` input → `direction` toggle (Add / Subtract, implemented as a segmented `ToggleGroup` or two-button `RadioGroup`) → optional `reason` textarea.
- On submit, compute signed `delta = direction === 'subtract' ? -amount : amount` and call `useBalanceSheetStore.getState().applyRowReceipt({ rowId, delta, reason })`.

**`RowCombobox.tsx`**
```ts
interface RowComboboxProps {
  value: string | null;               // rowId
  onChange: (rowId: string, row: BalanceSheetRow) => void;
}
```
- Flattens the current Balance Sheet tree (Assets + Liabilities, all groups and nested children) into a searchable list, labeling each option with its full path, e.g. `Assets > Current Assets > Deposits`, so ambiguous minor-row names (e.g. multiple rows named "Advance") are disambiguated.
- Uses the same `Popover` + `Command` pattern as `ProfileCombobox.tsx` from Phase 2 for UI consistency — factor out a shared generic `SearchableCombobox<T>` component if the two comboboxes end up sufficiently similar, to avoid duplicated Popover/Command boilerplate.

### 3.6 Zod Schema

```ts
// receiptSchema.ts
import { z } from 'zod';

export const receiptSchema = z.object({
  rowId: z.string().min(1, 'Select a row'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  direction: z.enum(['add', 'subtract']),
  reason: z.string().max(300).optional(),
});

export type ReceiptFormValues = z.infer<typeof receiptSchema>;
```

### 3.7 Persistence Considerations

The architecture doc doesn't specify whether Balance Sheet row state is persisted to Firestore or is purely client-side/local (the `EditableAmount` and `isOverridden` mechanisms suggest at least some persistence layer exists). Before implementing:
- Inspect how `isOverridden` values are currently persisted (likely a `balanceSheetOverrides` collection/document, or embedded in a `balanceSheetSnapshots` doc).
- Mirror that exact persistence pattern for `manualDelta` / `rowAdjustments`, wrapping the Firestore write in `runTransaction` if it touches both the row's stored value and any aggregate/summary document, consistent with the double-entry integrity pattern used elsewhere in the system.
- If Balance Sheet state is currently local-only (no Firestore persistence), flag this explicitly in code comments (`// TODO: confirm persistence requirement for Receipt adjustments`) rather than silently deciding to add a new collection, since that's an architectural decision beyond this feature's scope.

### 3.8 Acceptance Criteria
- Receipt entries correctly add to or subtract from the target row's displayed amount.
- Parent group totals recalculate immediately and correctly after a Receipt is applied, including for rows with zero-balance siblings (per existing sub-group summation logic).
- A Receipt applied to a `Live` row does not destroy the row's ability to show its true system-computed value via the existing "Restore" (amber, looping-arrow) affordance — restoring should reset the live portion; whether it also clears manual receipt deltas must be an explicit, agent-documented decision (recommend: Restore resets live value only; a separate "Clear adjustments" control removes manual deltas).
- All Receipt-driven writes that touch multiple documents are wrapped in `runTransaction`.

---

## 4. Cross-Cutting Checklist (Apply to All Three Phases)

- [ ] No new UI libraries introduced — Shadcn/Radix/@base-ui only.
- [ ] All forms use `react-hook-form` + `zodResolver`.
- [ ] All multi-document financial writes use `runTransaction`.
- [ ] All new searchable dropdowns reuse or extend a shared `Popover` + `Command` combobox pattern (avoid duplicate implementations across Phase 2 and Phase 3).
- [ ] `tsc --noEmit` passes after each phase.
- [ ] No hardcoded "Bought"/"Sold" strings remain post-Phase-1, anywhere in the codebase including PDF templates.
- [ ] New Firestore writes include `createdAt`/`updatedAt` via `serverTimestamp()`, consistent with existing entries.
- [ ] New types are additive/optional extensions of existing types, not breaking replacements.
