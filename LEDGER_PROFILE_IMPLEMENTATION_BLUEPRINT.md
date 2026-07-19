# Implementation Blueprint: Individual Ledger Profiles with PDF Export
**Rice Merchant ERP — Ledger Module Overhaul**
**Target Agent:** Gemini Flash (Autonomous Coding Agent)
**Stack:** React 18, TypeScript 5, Firebase Firestore, @react-pdf/renderer, Zod v4, React Hook Form v7, Tailwind CSS v3 + shadcn/ui

---

## 0. Overview & Scope

This blueprint instructs the agent to implement dedicated **Ledger Profiles** for every Customer and Supplier. Each profile stores a chronological debit/credit ledger, supports manual entry rows, computes running totals (Closing Balance), and exports to a PDF matching the exact format of the provided sample (`Ledger_Format_.pdf`).

The implementation is divided into **6 phases**. Complete them in order. Do not skip phases.

---

## 1. TypeScript Interfaces & Zod Schemas

### 1.1 New File: `src/types/ledger-profile.ts`

```typescript
import { z } from "zod";
import { Timestamp } from "firebase/firestore";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const LedgerEntryTypeEnum = z.enum([
  "purchase_created",
  "delivery_confirmed",
  "bags_divided",
  "bags_divided_reverted",
  "order_confirmed",
  "payment_received",
  "payment_made",
  "manual_debit",
  "manual_credit",
]);
export type LedgerEntryType = z.infer<typeof LedgerEntryTypeEnum>;

export const VchTypeEnum = z.enum([
  "Purchase",
  "Payment",
  "Receipt",
  "Sale",
  "Journal",
  "Manual",
]);
export type VchType = z.infer<typeof VchTypeEnum>;

export const EntityTypeEnum = z.enum(["supplier", "customer"]);
export type EntityType = z.infer<typeof EntityTypeEnum>;

// ─── Ledger Entry (single row in the ledger table) ───────────────────────────

export const LedgerEntrySchema = z.object({
  id: z.string(),                        // Firestore doc ID
  profileId: z.string(),                 // Parent LedgerProfile ID
  entityId: z.string(),                  // Supplier or Customer ID
  entityType: EntityTypeEnum,

  date: z.instanceof(Timestamp),         // Transaction date (Firestore Timestamp)
  particulars: z.string(),               // Main description line
  subParticulars: z.string().optional(), // e.g. "68.80 qtls @ ₹1,991.67/qtl"
  refLabel: z.string().optional(),       // e.g. "New Ref 01"

  vchType: VchTypeEnum,
  vchNo: z.number().int().positive(),

  debit: z.number().min(0).default(0),   // Amount in ₹; 0 if credit entry
  credit: z.number().min(0).default(0),  // Amount in ₹; 0 if debit entry

  entryType: LedgerEntryTypeEnum,
  isManual: z.boolean().default(false),  // True for user-created rows
  isSystemGenerated: z.boolean().default(true),

  relatedDocId: z.string().optional(),   // Deal ID / Order ID that triggered this entry
  quantityKg: z.number().optional(),     // Populated when entry involves stock movement
  pricePerUnit: z.number().optional(),   // ₹/qtl or ₹/kg

  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

// ─── Ledger Profile (one per supplier / customer) ────────────────────────────

export const LedgerProfileSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  entityType: EntityTypeEnum,
  entityName: z.string(),               // Denormalized for display

  millName: z.string(),                 // Pulled from app settings
  millDescription: z.string(),         // Address / contact line
  millContact: z.string().optional(),

  totalDebit: z.number().default(0),    // Running aggregate — updated via transaction
  totalCredit: z.number().default(0),
  closingBalance: z.number().default(0), // totalDebit - totalCredit (positive = we owe them)

  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});
export type LedgerProfile = z.infer<typeof LedgerProfileSchema>;

// ─── Manual Entry Form Schema (React Hook Form + Zod) ────────────────────────

export const ManualLedgerEntryFormSchema = z.object({
  date: z.string().min(1, "Date is required"),           // HTML date input value
  particulars: z.string().min(1, "Particulars required"),
  subParticulars: z.string().optional(),
  vchType: VchTypeEnum,
  vchNo: z.number().int().positive("Voucher number must be positive"),
  entryKind: z.enum(["debit", "credit"]),
  amount: z.number().positive("Amount must be positive"),
  quantityKg: z.number().optional(),
  pricePerUnit: z.number().optional(),
});
export type ManualLedgerEntryForm = z.infer<typeof ManualLedgerEntryFormSchema>;

// ─── PDF Export Params ────────────────────────────────────────────────────────

export interface LedgerPdfParams {
  profile: LedgerProfile;
  entries: LedgerEntry[];
  dateFrom: Date;
  dateTo: Date;
}
```

---

## 2. Firestore Schema Modifications

### 2.1 New Collections

```
/ledgerProfiles/{profileId}
    Fields: (all fields from LedgerProfileSchema above)
    Composite Indexes:
      - entityId ASC + createdAt DESC
      - entityType ASC + entityId ASC

/ledgerProfiles/{profileId}/entries/{entryId}
    Fields: (all fields from LedgerEntrySchema above)
    Composite Indexes:
      - profileId ASC + date ASC
      - isManual ASC + date DESC
```

### 2.2 Firestore Security Rules Addition

```javascript
// Add inside existing rules block
match /ledgerProfiles/{profileId} {
  allow read: if isAuthenticated() && isActiveUser();
  allow create, update: if isAuthenticated() && isAdmin();
  allow delete: if false; // Profiles are never deleted

  match /entries/{entryId} {
    allow read: if isAuthenticated() && isActiveUser();
    allow create: if isAuthenticated() && isAdmin();
    // Only manual entries are editable/deletable
    allow update, delete: if isAuthenticated() && isAdmin()
      && resource.data.isManual == true;
  }
}
```

### 2.3 Profile Bootstrap Logic

When a new Supplier or Customer is created, **immediately** create their `LedgerProfile` document inside the same Firestore batch/transaction:

```typescript
// Inside createSupplier() or createCustomer() service function:
const profileRef = doc(collection(db, "ledgerProfiles"));
batch.set(profileRef, {
  id: profileRef.id,
  entityId: newEntityRef.id,
  entityType: "supplier" | "customer",
  entityName: formData.name,
  millName: appSettings.millName,
  millDescription: appSettings.millDescription,
  millContact: appSettings.millContact ?? "",
  totalDebit: 0,
  totalCredit: 0,
  closingBalance: 0,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
```

### 2.4 Auto-Entry Triggers

Modify existing service functions to write `LedgerEntry` documents inside their existing Firestore transactions:

| Existing Function | Entry to Write | entityType | debit | credit |
|---|---|---|---|---|
| `confirmDelivery(dealId)` | `delivery_confirmed` | supplier | `deal.totalCost` | 0 |
| `confirmBagDivisions(dealId)` | `bags_divided` | supplier | 0 | 0 (informational) |
| `confirmOrder(orderId)` | `order_confirmed` | customer | 0 | `order.totalRevenue` |
| `revertBagDivision(batchId)` | `bags_divided_reverted` | supplier | 0 | 0 |

**Write pattern inside existing `runTransaction`:**

```typescript
// Inside runTransaction block — append after existing writes:
const entryRef = doc(collection(db, `ledgerProfiles/${profile.id}/entries`));
transaction.set(entryRef, {
  id: entryRef.id,
  profileId: profile.id,
  entityId: supplierId,
  entityType: "supplier",
  date: serverTimestamp(),
  particulars: `${deal.grainType} Purchase`,
  subParticulars: `${deal.totalAmountKg / 100} qtls @ ₹${deal.pricePerKg}/qtl`,
  refLabel: `New Ref ${deal.refNumber}`,
  vchType: "Purchase",
  vchNo: deal.voucherNumber,
  debit: deal.totalCost,
  credit: 0,
  entryType: "delivery_confirmed",
  isManual: false,
  isSystemGenerated: true,
  relatedDocId: dealId,
  quantityKg: deal.totalAmountKg,
  pricePerUnit: deal.pricePerKg,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

// Also update profile totals atomically:
const profileRef = doc(db, "ledgerProfiles", profile.id);
transaction.update(profileRef, {
  totalDebit: increment(deal.totalCost),
  closingBalance: increment(deal.totalCost),
  updatedAt: serverTimestamp(),
});
```

---

## 3. Service Layer

### 3.1 New File: `src/services/ledgerProfileService.ts`

```typescript
import {
  collection, doc, getDocs, query, where, orderBy,
  addDoc, updateDoc, deleteDoc, runTransaction,
  serverTimestamp, increment, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LedgerEntry, ManualLedgerEntryForm, LedgerProfile } from "@/types/ledger-profile";

// ── Fetch profile for a given entity ────────────────────────────────────────
export async function getLedgerProfile(entityId: string): Promise<LedgerProfile | null> {
  const q = query(
    collection(db, "ledgerProfiles"),
    where("entityId", "==", entityId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as LedgerProfile;
}

// ── Fetch all entries for a profile (optionally filtered by date range) ──────
export async function getLedgerEntries(
  profileId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<LedgerEntry[]> {
  let q = query(
    collection(db, `ledgerProfiles/${profileId}/entries`),
    orderBy("date", "asc")
  );
  // Note: Firestore range filters require composite index on date
  const snap = await getDocs(q);
  let entries = snap.docs.map((d) => d.data() as LedgerEntry);

  // Client-side date filter (avoids extra index for optional range)
  if (dateFrom) entries = entries.filter((e) => e.date.toDate() >= dateFrom);
  if (dateTo)   entries = entries.filter((e) => e.date.toDate() <= dateTo);

  return entries;
}

// ── Add a manual ledger entry ────────────────────────────────────────────────
export async function addManualLedgerEntry(
  profileId: string,
  entityId: string,
  entityType: "supplier" | "customer",
  form: ManualLedgerEntryForm
): Promise<void> {
  const debit  = form.entryKind === "debit"  ? form.amount : 0;
  const credit = form.entryKind === "credit" ? form.amount : 0;

  await runTransaction(db, async (transaction) => {
    const profileRef = doc(db, "ledgerProfiles", profileId);
    const entryRef   = doc(collection(db, `ledgerProfiles/${profileId}/entries`));

    transaction.set(entryRef, {
      id: entryRef.id,
      profileId,
      entityId,
      entityType,
      date: Timestamp.fromDate(new Date(form.date)),
      particulars: form.particulars,
      subParticulars: form.subParticulars ?? "",
      vchType: form.vchType,
      vchNo: form.vchNo,
      debit,
      credit,
      entryType: form.entryKind === "debit" ? "manual_debit" : "manual_credit",
      isManual: true,
      isSystemGenerated: false,
      quantityKg: form.quantityKg,
      pricePerUnit: form.pricePerUnit,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(profileRef, {
      totalDebit:     increment(debit),
      totalCredit:    increment(credit),
      closingBalance: increment(debit - credit),
      updatedAt: serverTimestamp(),
    });
  });
}

// ── Delete a manual entry (system entries are immutable) ─────────────────────
export async function deleteManualLedgerEntry(
  profileId: string,
  entry: LedgerEntry
): Promise<void> {
  if (!entry.isManual) throw new Error("Cannot delete system-generated entries.");

  await runTransaction(db, async (transaction) => {
    const entryRef   = doc(db, `ledgerProfiles/${profileId}/entries`, entry.id);
    const profileRef = doc(db, "ledgerProfiles", profileId);

    transaction.delete(entryRef);
    transaction.update(profileRef, {
      totalDebit:     increment(-entry.debit),
      totalCredit:    increment(-entry.credit),
      closingBalance: increment(-(entry.debit - entry.credit)),
      updatedAt: serverTimestamp(),
    });
  });
}
```

---

## 4. Component Structure

### 4.1 Directory Layout

```
src/components/ledger/
├── supplier/
│   ├── SupplierLedgerTab.tsx          ← existing (MODIFY: add new tab)
│   ├── SupplierLedgerDetail.tsx       ← existing (keep)
│   └── profiles/
│       ├── SupplierProfilesTab.tsx    ← NEW: tab showing all supplier profiles
│       └── SupplierProfileDetail.tsx  ← NEW: individual profile page
├── customer/
│   ├── CustomerLedgerTab.tsx          ← existing (MODIFY: add new tab)
│   └── profiles/
│       ├── CustomerProfilesTab.tsx    ← NEW
│       └── CustomerProfileDetail.tsx  ← NEW
└── shared/
    ├── LedgerProfileTable.tsx         ← NEW: shared ledger table UI
    ├── ManualEntryForm.tsx            ← NEW: drawer/modal for adding rows
    ├── LedgerTotalsFooter.tsx         ← NEW: debit/credit/balance summary row
    └── pdf/
        └── LedgerProfilePdf.tsx       ← NEW: @react-pdf/renderer template
```

### 4.2 `LedgerProfileTable.tsx` — Shared Table Component

```tsx
// src/components/ledger/shared/LedgerProfileTable.tsx
import React from "react";
import { format } from "date-fns";
import { LedgerEntry } from "@/types/ledger-profile";
import { formatCurrency } from "@/lib/utils";
import { Trash2 } from "lucide-react";

interface Props {
  entries: LedgerEntry[];
  onDeleteManual?: (entry: LedgerEntry) => void;
}

export function LedgerProfileTable({ entries, onDeleteManual }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left w-28">Date</th>
            <th className="px-4 py-3 text-left">Particulars</th>
            <th className="px-4 py-3 text-center w-24">Vch Type</th>
            <th className="px-4 py-3 text-center w-20">Vch No.</th>
            <th className="px-4 py-3 text-right w-32">Debit (₹)</th>
            <th className="px-4 py-3 text-right w-32">Credit (₹)</th>
            <th className="px-4 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {format(entry.date.toDate(), "d-MMM-yy")}
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-gray-800">{entry.particulars}</p>
                {entry.subParticulars && (
                  <p className="text-xs text-gray-500 mt-0.5">{entry.subParticulars}</p>
                )}
                {entry.refLabel && (
                  <p className="text-xs text-blue-600 mt-0.5">{entry.refLabel}</p>
                )}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">{entry.vchType}</td>
              <td className="px-4 py-3 text-center text-gray-600">{entry.vchNo}</td>
              <td className="px-4 py-3 text-right font-mono text-red-700">
                {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono text-green-700">
                {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
              </td>
              <td className="px-4 py-3">
                {entry.isManual && onDeleteManual && (
                  <button
                    onClick={() => onDeleteManual(entry)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete manual entry"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 4.3 `LedgerTotalsFooter.tsx`

```tsx
// src/components/ledger/shared/LedgerTotalsFooter.tsx
import { formatCurrency } from "@/lib/utils";

interface Props {
  totalDebit: number;
  totalCredit: number;
}

export function LedgerTotalsFooter({ totalDebit, totalCredit }: Props) {
  const closing = totalDebit - totalCredit;
  const isCredit = closing < 0;

  return (
    <div className="border-t-2 border-gray-800 mt-4 pt-4 space-y-1">
      {/* Grand total row */}
      <div className="flex justify-between text-sm font-bold bg-gray-100 px-4 py-2 rounded">
        <span>Grand Total</span>
        <div className="flex gap-16">
          <span className="text-red-700 font-mono">{formatCurrency(totalDebit)}</span>
          <span className="text-green-700 font-mono">{formatCurrency(totalCredit)}</span>
        </div>
      </div>

      {/* Closing balance */}
      <div className="flex justify-between text-sm font-bold px-4 py-2">
        <span className={isCredit ? "text-green-700" : "text-red-700"}>
          {isCredit ? "Cr" : "Dr"} Closing Balance
        </span>
        <span className="font-mono">{formatCurrency(Math.abs(closing))}</span>
      </div>

      {/* Equalised total */}
      <div className="flex justify-between text-sm font-semibold bg-gray-800 text-white px-4 py-2 rounded">
        <span>{formatCurrency(Math.max(totalDebit, totalCredit))}</span>
        <span>{formatCurrency(Math.max(totalDebit, totalCredit))}</span>
      </div>
    </div>
  );
}
```

### 4.4 `ManualEntryForm.tsx` — Drawer with React Hook Form

```tsx
// src/components/ledger/shared/ManualEntryForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ManualLedgerEntryFormSchema, type ManualLedgerEntryForm } from "@/types/ledger-profile";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ManualLedgerEntryForm) => Promise<void>;
  nextVchNo: number;
}

const VCH_TYPES = ["Purchase", "Payment", "Receipt", "Sale", "Journal", "Manual"] as const;

export function ManualEntryForm({ open, onClose, onSubmit, nextVchNo }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ManualLedgerEntryForm>({
    resolver: zodResolver(ManualLedgerEntryFormSchema),
    defaultValues: {
      vchNo: nextVchNo,
      vchType: "Manual",
      entryKind: "debit",
    },
  });

  const handleFormSubmit = async (data: ManualLedgerEntryForm) => {
    await onSubmit(data);
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[420px]">
        <SheetHeader>
          <SheetTitle>Add Manual Entry</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-6 space-y-4">

          {/* Date */}
          <div>
            <Label htmlFor="date">Purchase Date *</Label>
            <Input id="date" type="date" {...register("date")} />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
          </div>

          {/* Particulars */}
          <div>
            <Label htmlFor="particulars">Particulars *</Label>
            <Input id="particulars" placeholder="e.g. Sarno Paddy (Krm-1622)" {...register("particulars")} />
            {errors.particulars && <p className="text-xs text-red-500 mt-1">{errors.particulars.message}</p>}
          </div>

          {/* Sub-particulars */}
          <div>
            <Label htmlFor="subParticulars">Details (optional)</Label>
            <Input id="subParticulars" placeholder="e.g. 68.80 qtls @ ₹1,991.67/qtl" {...register("subParticulars")} />
          </div>

          {/* Vch Type */}
          <div>
            <Label>Voucher Type *</Label>
            <Select onValueChange={(v) => setValue("vchType", v as any)} defaultValue="Manual">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VCH_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vch Number */}
          <div>
            <Label htmlFor="vchNo">Voucher Number *</Label>
            <Input
              id="vchNo"
              type="number"
              {...register("vchNo", { valueAsNumber: true })}
            />
            {errors.vchNo && <p className="text-xs text-red-500 mt-1">{errors.vchNo.message}</p>}
          </div>

          {/* Debit / Credit Toggle */}
          <div>
            <Label>Entry Type *</Label>
            <div className="flex gap-3 mt-2">
              {(["debit", "credit"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setValue("entryKind", kind)}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                    watch("entryKind") === kind
                      ? kind === "debit"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-600 border-gray-300"
                  }`}
                >
                  {kind === "debit" ? "Dr Debit" : "Cr Credit"}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Amount (₹) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              {...register("amount", { valueAsNumber: true })}
            />
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
          </div>

          {/* Optional stock fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="quantityKg">Quantity (Kg)</Label>
              <Input id="quantityKg" type="number" {...register("quantityKg", { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="pricePerUnit">Rate (₹/unit)</Label>
              <Input id="pricePerUnit" type="number" step="0.01" {...register("pricePerUnit", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Saving…" : "Add Entry"}
            </Button>
          </div>

        </form>
      </SheetContent>
    </Sheet>
  );
}
```

### 4.5 `CustomerProfileDetail.tsx` / `SupplierProfileDetail.tsx` — Main Profile Page

Both components share the same structure. Create a `LedgerProfileDetail.tsx` base and wrap it:

```tsx
// src/components/ledger/shared/LedgerProfileDetail.tsx
import { useState, useEffect } from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { LedgerProfile, LedgerEntry } from "@/types/ledger-profile";
import { getLedgerEntries, addManualLedgerEntry, deleteManualLedgerEntry } from "@/services/ledgerProfileService";
import { LedgerProfileTable } from "./LedgerProfileTable";
import { LedgerTotalsFooter } from "./LedgerTotalsFooter";
import { ManualEntryForm } from "./ManualEntryForm";
import { LedgerProfilePdf } from "./pdf/LedgerProfilePdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Download } from "lucide-react";

interface Props {
  profile: LedgerProfile;
}

export function LedgerProfileDetail({ profile }: Props) {
  const [entries, setEntries]       = useState<LedgerEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [dateFrom, setDateFrom]     = useState<string>("");
  const [dateTo, setDateTo]         = useState<string>("");

  const fetchEntries = async () => {
    setLoading(true);
    const data = await getLedgerEntries(
      profile.id,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo   ? new Date(dateTo)   : undefined,
    );
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [profile.id, dateFrom, dateTo]);

  const handleManualSubmit = async (form: any) => {
    await addManualLedgerEntry(
      profile.id, profile.entityId, profile.entityType, form
    );
    await fetchEntries();
  };

  const handleDelete = async (entry: LedgerEntry) => {
    if (!confirm("Delete this manual entry?")) return;
    await deleteManualLedgerEntry(profile.id, entry);
    await fetchEntries();
  };

  const handlePdfExport = async () => {
    const blob = await pdf(
      <LedgerProfilePdf
        profile={profile}
        entries={entries}
        dateFrom={dateFrom ? new Date(dateFrom) : new Date()}
        dateTo={dateTo   ? new Date(dateTo)   : new Date()}
      />
    ).toBlob();
    saveAs(blob, `ledger_${profile.entityName.replace(/\s+/g, "_")}.pdf`);
  };

  const nextVchNo = entries.length > 0
    ? Math.max(...entries.map((e) => e.vchNo)) + 1
    : 1;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{profile.entityName}</h2>
          <p className="text-sm text-gray-500 capitalize">{profile.entityType} Ledger Account</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handlePdfExport}>
            <Download size={16} className="mr-2" /> Export PDF
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} className="mr-2" /> Add Entry
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex gap-3 items-center">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-44" />
        <span className="text-gray-400">to</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-44" />
      </div>

      {/* Ledger Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading entries…</p>
      ) : (
        <>
          <LedgerProfileTable entries={entries} onDeleteManual={handleDelete} />
          <LedgerTotalsFooter
            totalDebit={profile.totalDebit}
            totalCredit={profile.totalCredit}
          />
        </>
      )}

      {/* Manual Entry Drawer */}
      <ManualEntryForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleManualSubmit}
        nextVchNo={nextVchNo}
      />
    </div>
  );
}
```

### 4.6 Tab Integration

**In `SupplierLedgerTab.tsx`** — add a second `<TabsTrigger>` and `<TabsContent>`:

```tsx
// Inside existing <Tabs defaultValue="events"> block — add:
<TabsList>
  <TabsTrigger value="events">Transaction Events</TabsTrigger>
  <TabsTrigger value="profiles">Ledger Profiles</TabsTrigger>  {/* NEW */}
</TabsList>

<TabsContent value="profiles">  {/* NEW */}
  <SupplierProfilesTab />
</TabsContent>
```

**`SupplierProfilesTab.tsx`** lists all suppliers; clicking one navigates to `SupplierProfileDetail.tsx`.

---

## 5. PDF Generation Template

### 5.1 `LedgerProfilePdf.tsx` — Full Template

```tsx
// src/components/ledger/shared/pdf/LedgerProfilePdf.tsx
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import type { LedgerPdfParams } from "@/types/ledger-profile";

// Register a monospace font for numbers if desired (optional)
// Font.register({ family: "Courier", src: "..." });

const COL = {
  date:        "12%",
  particulars: "38%",
  vchType:     "12%",
  vchNo:       "8%",
  debit:       "15%",
  credit:      "15%",
};

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    paddingHorizontal: 28,
    paddingVertical: 32,
    color: "#111",
  },

  /* ── Header ── */
  headerBlock: { marginBottom: 8, borderBottomWidth: 1.5, borderBottomColor: "#111", paddingBottom: 6 },
  millName:    { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center" },
  millDesc:    { fontSize: 8, textAlign: "center", color: "#444", marginTop: 2 },
  entityName:  { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 6 },
  ledgerLabel: { fontSize: 9, textAlign: "center", color: "#555", marginTop: 2 },
  dateRange:   { fontSize: 8, textAlign: "center", color: "#555", marginTop: 2 },

  /* ── Table ── */
  tableHeader:    { flexDirection: "row", backgroundColor: "#f0f0f0", borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#999", paddingVertical: 4 },
  tableRow:       { flexDirection: "row", borderBottomWidth: 0.3, borderBottomColor: "#ddd", paddingVertical: 3 },
  tableRowManual: { flexDirection: "row", borderBottomWidth: 0.3, borderBottomColor: "#ddd", paddingVertical: 3, backgroundColor: "#fffdf0" },

  colDate:        { width: COL.date,        paddingHorizontal: 3 },
  colParticulars: { width: COL.particulars,  paddingHorizontal: 3 },
  colVchType:     { width: COL.vchType,     paddingHorizontal: 3, textAlign: "center" },
  colVchNo:       { width: COL.vchNo,       paddingHorizontal: 3, textAlign: "center" },
  colDebit:       { width: COL.debit,       paddingHorizontal: 3, textAlign: "right" },
  colCredit:      { width: COL.credit,      paddingHorizontal: 3, textAlign: "right" },

  headerText:     { fontFamily: "Helvetica-Bold", fontSize: 7.5 },
  subText:        { fontSize: 6.5, color: "#555", marginTop: 1 },
  refText:        { fontSize: 6.5, color: "#335" },

  /* ── Footer ── */
  footerSeparator: { borderTopWidth: 1, borderTopColor: "#111", marginTop: 6 },
  footerRow:       { flexDirection: "row", paddingVertical: 3 },
  footerBold:      { fontFamily: "Helvetica-Bold" },
  footerTotal:     { flexDirection: "row", backgroundColor: "#111", paddingVertical: 4, marginTop: 2 },
  footerTotalText: { color: "#fff", fontFamily: "Helvetica-Bold" },
  pageNumber:      { position: "absolute", bottom: 16, right: 28, fontSize: 7, color: "#888" },
});

const fmt = (n: number) =>
  n === 0 ? "" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LedgerProfilePdf({ profile, entries, dateFrom, dateTo }: LedgerPdfParams) {
  const totalDebit  = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const closing     = totalDebit - totalCredit;
  const balanceLabel = closing >= 0 ? "Dr Closing Balance" : "Cr Closing Balance";
  const equalised   = Math.max(totalDebit, totalCredit);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={S.page}>

        {/* ── Header ── */}
        <View style={S.headerBlock}>
          <Text style={S.millName}>{profile.millName}</Text>
          <Text style={S.millDesc}>{profile.millDescription}</Text>
          {profile.millContact && <Text style={S.millDesc}>Contact: {profile.millContact}</Text>}
          <Text style={S.entityName}>{profile.entityName}</Text>
          <Text style={S.ledgerLabel}>Ledger Account</Text>
          <Text style={S.dateRange}>
            {format(dateFrom, "d-MMM-yy")} to {format(dateTo, "d-MMM-yy")}
          </Text>
        </View>

        {/* ── Column Headers ── */}
        <View style={S.tableHeader}>
          <Text style={[S.colDate,        S.headerText]}>Date</Text>
          <Text style={[S.colParticulars, S.headerText]}>Particulars</Text>
          <Text style={[S.colVchType,     S.headerText]}>Vch Type</Text>
          <Text style={[S.colVchNo,       S.headerText]}>Vch No.</Text>
          <Text style={[S.colDebit,       S.headerText]}>Debit</Text>
          <Text style={[S.colCredit,      S.headerText]}>Credit</Text>
        </View>

        {/* ── Rows ── */}
        {entries.map((entry) => (
          <View key={entry.id} style={entry.isManual ? S.tableRowManual : S.tableRow} wrap={false}>
            <Text style={S.colDate}>{format(entry.date.toDate(), "d-MMM-yy")}</Text>
            <View style={S.colParticulars}>
              <Text>{entry.particulars}</Text>
              {entry.subParticulars && <Text style={S.subText}>{entry.subParticulars}</Text>}
              {entry.refLabel        && <Text style={S.refText}>{entry.refLabel}</Text>}
            </View>
            <Text style={S.colVchType}>{entry.vchType}</Text>
            <Text style={S.colVchNo}>{entry.vchNo}</Text>
            <Text style={S.colDebit}>{fmt(entry.debit)}</Text>
            <Text style={S.colCredit}>{fmt(entry.credit)}</Text>
          </View>
        ))}

        {/* ── Footer ── */}
        <View style={S.footerSeparator} />

        {/* Sub-total row */}
        <View style={S.footerRow}>
          <Text style={[{ width: "62%" }]}></Text>
          <Text style={[S.colDebit,  S.footerBold]}>{fmt(totalDebit)}</Text>
          <Text style={[S.colCredit, S.footerBold]}>{fmt(totalCredit)}</Text>
        </View>

        {/* Closing balance */}
        <View style={S.footerRow}>
          <Text style={[{ width: "62%", paddingHorizontal: 3 }, S.footerBold]}>{balanceLabel}</Text>
          <Text style={[S.colDebit,  S.footerBold]}>
            {closing >= 0 ? fmt(Math.abs(closing)) : ""}
          </Text>
          <Text style={[S.colCredit, S.footerBold]}>
            {closing < 0  ? fmt(Math.abs(closing)) : ""}
          </Text>
        </View>

        {/* Equalised grand total */}
        <View style={[S.footerTotal]}>
          <Text style={[{ width: "62%", paddingHorizontal: 3 }, S.footerTotalText]}> </Text>
          <Text style={[S.colDebit,  S.footerTotalText]}>{fmt(equalised)}</Text>
          <Text style={[S.colCredit, S.footerTotalText]}>{fmt(equalised)}</Text>
        </View>

        {/* Page number */}
        <Text
          style={S.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />

      </Page>
    </Document>
  );
}
```

---

## 6. Data Mapping: System Events → Ledger Rows

The table below maps every existing ERP event to its corresponding `LedgerEntry` field values. Use this as the reference for all auto-generated entries written in Section 2.4.

| Trigger | `particulars` | `subParticulars` | `vchType` | `debit` | `credit` | `entityType` |
|---|---|---|---|---|---|---|
| `confirmDelivery(dealId)` | `"{grainType} Purchase"` | `"{qtls} qtls @ ₹{rate}/qtl"` | `Purchase` | `deal.totalCost` | `0` | `supplier` |
| `confirmBagDivisions(dealId)` | `"Bags Packed – {batchLabel}"` | `"{packedKg} kg bagged"` | `Journal` | `0` | `0` | `supplier` |
| `revertBagDivision(batchId)` | `"Bag Division Reverted"` | `"{batchLabel} cancelled"` | `Journal` | `0` | `0` | `supplier` |
| `confirmOrder(orderId)` | `"Sale to {customerName}"` | `"{totalKg} kg @ ₹{pricePerKg}/kg"` | `Sale` | `0` | `order.totalRevenue` | `customer` |
| Manual payment by supplier | `"Payment Received"` | `"NEFT / Cash on {date}"` | `Payment` | `0` | `paymentAmount` | `supplier` |
| Manual payment to customer | `"Refund / Advance"` | `""` | `Receipt` | `refundAmount` | `0` | `customer` |

---

## 7. Implementation Checklist for Agent

Work through these tasks in strict order. Do not proceed to the next until the current one compiles without TypeScript errors.

- [ ] **Phase 1** — Create `src/types/ledger-profile.ts` with all schemas from Section 1.
- [ ] **Phase 2** — Create `src/services/ledgerProfileService.ts` from Section 3.
- [ ] **Phase 3** — Add Firestore bootstrap call inside `createSupplier()` and `createCustomer()` (Section 2.3).
- [ ] **Phase 4** — Inject `LedgerEntry` writes into all existing `runTransaction` blocks (Section 2.4 + mapping table in Section 6).
- [ ] **Phase 5** — Build UI components in this order:
  - `LedgerProfileTable.tsx`
  - `LedgerTotalsFooter.tsx`
  - `ManualEntryForm.tsx`
  - `LedgerProfileDetail.tsx`
  - `SupplierProfilesTab.tsx` + `CustomerProfilesTab.tsx` (list views)
  - Wire new tab into `SupplierLedgerTab.tsx` and `CustomerLedgerTab.tsx`
- [ ] **Phase 6** — Build `LedgerProfilePdf.tsx` and verify PDF output matches sample format (mill name, entity name, column order: Date → Particulars → Vch Type → Vch No. → Debit → Credit, footer with totals and Closing Balance).
- [ ] **Phase 7** — Run full TypeScript compilation (`tsc --noEmit`). Fix all errors before declaring done.

---

## 8. Key Constraints & Guardrails

1. **Immutability of system entries** — Never allow `update` or `delete` on entries where `isManual === false`. Enforce at both Firestore Rules level and service layer.
2. **Atomicity** — All profile total updates (`totalDebit`, `totalCredit`, `closingBalance`) must use `increment()` inside the same `runTransaction` that creates the entry. Never update totals in a separate write.
3. **Profile creation** — A `LedgerProfile` must be created at the same time as the Supplier/Customer entity, never lazily. If a profile is missing for an existing entity (migration case), create it on first access.
4. **Debit/Credit convention** (matches the sample PDF):
   - **Supplier**: money we owe them → `debit`; payments we make to them → `credit`.
   - **Customer**: money they owe us (sale revenue) → `credit`; refunds we issue → `debit`.
5. **PDF landscape mode** — The table has 6 columns and needs landscape A4 to render without truncation. The `LedgerProfilePdf` already sets `orientation="landscape"`.
6. **Date display** — Always use `d-MMM-yy` format (e.g. `21-Apr-26`) to match the sample.
7. **Currency format** — Always use `en-IN` locale with 2 decimal places and comma separators (e.g. `1,37,027.00`).

---

*End of Blueprint — LEDGER_PROFILE_IMPLEMENTATION_BLUEPRINT.md*
