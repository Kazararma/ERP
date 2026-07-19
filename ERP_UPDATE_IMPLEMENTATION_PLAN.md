# Rice ERP v2 — Complete Implementation Plan for Coding Agent

## How to Use This Document

This document is a step-by-step build plan for updating the Rice Merchant ERP (`rice-erp`) from v1 to v2. Execute every Phase in order. Within each Phase, execute every Task in order. Do not skip ahead. Each Task specifies exactly which files to create or modify, what the complete file content must contain, and what the acceptance condition is before moving to the next Task.

The existing codebase is a React 18 + TypeScript 5 + Vite 8 + Firebase Firestore + Tailwind CSS v3 + Zustand v5 application located at `c:/dev/ERP/rice-erp/`.

---

## Guiding Rules for the Agent

1. **Never break existing auth, routing, or wage functionality.** Only touch the files listed per task.
2. **TypeScript strict mode is on.** Every new interface, prop, and function must be fully typed. No `any`.
3. **All Firestore writes that touch more than one document must use a Firestore Transaction or a batched write.** Never write documents sequentially outside a transaction where consistency is required.
4. **Denormalize aggressively for read performance.** Supplier name, product code, rice type name, and bag size are duplicated into child documents so lists never require joins.
5. **No price is stored on a `BagDivision` document.** Price lives only on the `Deal` (purchase price per kg) and is copied into `OrderAllocation` at confirmation time.
6. **Rice types are runtime-configurable.** The `riceTypes` Firestore collection drives all dropdowns. Never hardcode rice type values in component JSX.
7. **All monetary values are stored as numbers in Indian Rupees (₹).** No currency conversion logic is needed.
8. **Tailwind utility classes only.** No inline `style={{}}` props except for dynamic values that cannot be expressed as Tailwind classes (e.g., a width percentage derived from a number).
9. **Use Shadcn UI primitives** (`Dialog`, `Tabs`, `Card`, `Badge`, `Button`, `Select`, `Input`, `Tooltip`) from `@/components/ui/` for all new UI. Do not re-implement these.
10. **Commit one Phase at a time.** After each Phase, the application must compile and run without TypeScript errors.

---

## Phase 0 — Type Definitions & Constants

> **Goal:** Establish all new TypeScript interfaces and constants that every subsequent phase depends on. No UI, no Firestore writes yet.

---

### Task 0.1 — Create `src/types/riceTypes.ts`

Create this file from scratch with the following exact content:

```typescript
// src/types/riceTypes.ts

import { Timestamp } from "firebase/firestore";

/**
 * A rice variety entity stored in the `riceTypes` Firestore collection.
 * This is the single source of truth for all rice-type dropdowns.
 * New varieties can be added at runtime by a SuperAdmin without a redeployment.
 */
export interface RiceType {
  riceTypeId: string;      // Document ID in Firestore; use the code value (e.g., "ls", "ir64")
  code: string;            // Short machine-readable identifier (e.g., "ls", "ir64", "gobindobhog")
  displayName: string;     // Human-readable label shown in dropdowns and cards (e.g., "Lal Shonno")
  isActive: boolean;       // Soft-delete: false hides from UI but preserves historical references
  createdAt: Timestamp;
  createdBy: string;       // uid of the SuperAdmin who added this type
  updatedAt: Timestamp;
}

/**
 * All standardized bag sizes the system supports.
 * To add a new size, add it to this union AND add its weight to BAG_WEIGHT_KG below.
 */
export type BagSize = "50kg" | "60kg" | "1tonne" | "1quintal";

/**
 * Canonical weight in kilograms for each BagSize.
 * Used throughout the app for all weight arithmetic. Never hardcode these values elsewhere.
 */
export const BAG_WEIGHT_KG: Record<BagSize, number> = {
  "50kg":     50,
  "60kg":     60,
  "1tonne":   1000,
  "1quintal": 100,
};

/**
 * Human-readable display labels for each BagSize, used in UI chips and dropdowns.
 */
export const BAG_SIZE_LABEL: Record<BagSize, string> = {
  "50kg":     "50 kg",
  "60kg":     "60 kg",
  "1tonne":   "1 Tonne",
  "1quintal": "1 Quintal",
};

/** Ordered list of all valid bag sizes, used to render toggles in the BagDivisionModal. */
export const ALL_BAG_SIZES: BagSize[] = ["50kg", "60kg", "1quintal", "1tonne"];

/**
 * Embedded product descriptor. Stored inside Deal and Inventory documents.
 * riceTypeCode and riceTypeName are denormalized from the riceTypes collection
 * at deal-creation time to avoid joins on every read.
 */
export interface Product {
  productCode: string;     // User-defined alphanumeric code; must be unique per deal (e.g., "LS-001")
  productName: string;     // Free-text descriptive label (e.g., "Premium Lal Shonno Grade A")
  riceTypeId: string;      // Foreign key → riceTypes.riceTypeId
  riceTypeCode: string;    // Denormalized: riceTypes.code
  riceTypeName: string;    // Denormalized: riceTypes.displayName
}

/**
 * Seed data to write to the `riceTypes` collection on first run.
 * The seeding script in Phase 1 uses this array.
 */
export const RICE_TYPE_SEED_DATA: Omit<RiceType, "createdAt" | "updatedAt" | "createdBy">[] = [
  { riceTypeId: "ls",          code: "ls",          displayName: "Lal Shonno",   isActive: true },
  { riceTypeId: "gobindobhog", code: "gobindobhog", displayName: "Gobindobhog",  isActive: true },
  { riceTypeId: "chausotti",   code: "chausotti",   displayName: "Chausotti",    isActive: true },
  { riceTypeId: "chatris",     code: "chatris",     displayName: "Chatris",      isActive: true },
  { riceTypeId: "ir64",        code: "ir64",        displayName: "Ir64",         isActive: true },
  { riceTypeId: "shindu",      code: "shindu",      displayName: "Shindu",       isActive: true },
  { riceTypeId: "minicate",    code: "minicate",    displayName: "Minicate",     isActive: true },
  { riceTypeId: "baskathi",    code: "baskathi",    displayName: "Baskathi",     isActive: true },
  { riceTypeId: "gs1",         code: "gs1",         displayName: "Gs1",          isActive: true },
  { riceTypeId: "cm",          code: "cm",          displayName: "Cm",           isActive: true },
];
```

**Acceptance:** File compiles with `tsc --noEmit`. No errors.

---

### Task 0.2 — Update `src/types/deal.ts`

Replace the existing `Deal` interface and remove all references to `StagingBatch`. Add `BagDivision`. Keep any other existing interfaces in the file that are unrelated to staging.

The file must export exactly these interfaces (merge with whatever else currently exists in the file, removing only `StagingBatch`):

```typescript
// src/types/deal.ts

import { Timestamp } from "firebase/firestore";
import { BagSize, Product } from "./riceTypes";

export interface Supplier {
  supplierId: string;
  name: string;
  description: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export interface Deal {
  dealId: string;
  supplierId: string;
  supplierName: string;           // Denormalized
  product: Product;               // Embedded product descriptor
  totalAmountKg: number;          // Total raw grain purchased in kg
  remainingAmountKg: number;      // Raw kg not yet divided into bags
  pricePerKg: number;             // Purchase cost per kg — used for COGS at order time
  totalCost: number;              // totalAmountKg × pricePerKg
  purchaseDate: Timestamp;
  deliveryConfirmed: boolean;
  deliveryDate: Timestamp | null;
  status: "pending_delivery" | "delivered" | "dividing" | "completed";
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

/**
 * Represents one batch of bags created from a Deal's raw grain.
 * Stored as a subcollection: deals/{dealId}/bagDivisions/{divisionId}
 * CRITICAL: No price field. Price is resolved from the parent Deal at order time.
 */
export interface BagDivision {
  divisionId: string;
  dealId: string;
  bagSize: BagSize;               // The standardized bag size for this division
  bagWeightKg: number;            // Constant resolved from BAG_WEIGHT_KG[bagSize]
  numberOfBags: number;           // Total bags created
  totalWeightKg: number;          // numberOfBags × bagWeightKg
  availableBags: number;          // Bags not yet allocated to any confirmed order
  divisionConfirmed: boolean;
  divisionDate: Timestamp | null;
  status: "draft" | "ready" | "partial" | "exhausted";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Acceptance:** All existing files that imported from `deal.ts` still compile. The word `StagingBatch` must not appear anywhere in this file.

---

### Task 0.3 — Update `src/types/order.ts`

Replace the existing `Order` and related interfaces. Remove any reference to `stagingBatch`. The file must export:

```typescript
// src/types/order.ts

import { Timestamp } from "firebase/firestore";
import { BagSize, Product } from "./riceTypes";

export interface Customer {
  customerId: string;
  name: string;
  description: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export interface Order {
  orderId: string;
  customerId: string;
  customerName: string;           // Denormalized
  orderDate: Timestamp;
  totalWeightKg: number;          // Sum of all allocation weights
  sellingPricePerKg: number;      // Single selling price applied to the whole order
  totalRevenue: number;           // totalWeightKg × sellingPricePerKg
  totalCostOfGoods: number;       // Sum of (allocation.weightKg × allocation.purchasePricePerKg)
  profit: number;                 // totalRevenue - totalCostOfGoods
  orderConfirmed: boolean;
  confirmedAt: Timestamp | null;
  status: "draft" | "confirmed" | "delivered";
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

/**
 * One line item in an order, linking to a specific BagDivision from a specific Deal.
 * Stored as subcollection: orders/{orderId}/allocations/{allocationId}
 */
export interface OrderAllocation {
  allocationId: string;
  dealId: string;
  supplierId: string;             // Denormalized for supplier ledger queries
  supplierName: string;           // Denormalized
  divisionId: string;             // References BagDivision document
  product: Product;               // Snapshot of the product at allocation time
  bagSize: BagSize;
  bagWeightKg: number;
  numberOfBags: number;
  weightKg: number;               // numberOfBags × bagWeightKg
  purchasePricePerKg: number;     // Copied from Deal.pricePerKg at allocation time
  totalCost: number;              // weightKg × purchasePricePerKg (COGS for this line)
  createdAt: Timestamp;
}
```

**Acceptance:** No TypeScript errors across the project.

---

### Task 0.4 — Update `src/types/inventory.ts`

Replace with the following:

```typescript
// src/types/inventory.ts

import { Timestamp } from "firebase/firestore";
import { BagSize, Product } from "./riceTypes";

export interface InventoryDivisionSnapshot {
  divisionId: string;
  bagSize: BagSize;
  numberOfBags: number;
  availableBags: number;
  // No price — price is deferred to order time
}

/**
 * One inventory record per Deal. Written and updated by Firestore Transactions.
 * Maps 1:1 to deals/{dealId}.
 * Queries must use: orderBy("product.riceTypeCode").orderBy("product.productCode")
 */
export interface Inventory {
  inventoryId: string;            // Same value as dealId
  dealId: string;
  supplierId: string;
  supplierName: string;
  product: Product;               // Enables server-side filter & sort by riceTypeCode/productCode
  totalBoughtKg: number;
  totalDividedKg: number;         // Sum of all confirmed BagDivision.totalWeightKg
  totalSoldKg: number;
  remainingRawKg: number;         // totalBoughtKg - totalDividedKg
  remainingPackedKg: number;      // totalDividedKg - totalSoldKg
  divisionBreakdown: InventoryDivisionSnapshot[];
  lastUpdated: Timestamp;
  status: "in_stock" | "partial" | "exhausted";
}
```

**Acceptance:** No TypeScript errors.

---

### Task 0.5 — Create `src/types/ledger.ts`

Create this file from scratch:

```typescript
// src/types/ledger.ts

import { Timestamp } from "firebase/firestore";
import { BagSize, Product } from "./riceTypes";

/**
 * All event types that can appear in the Supplier Ledger.
 * Each is written atomically alongside the domain action that triggers it.
 */
export type SupplierLedgerEventType =
  | "purchase_created"      // A new Deal was created for this supplier
  | "delivery_confirmed"    // deliveryConfirmed was set to true on a Deal
  | "bags_divided"          // A BagDivision was confirmed on a Deal
  | "allocation_deducted";  // Bags from this supplier were sold in a confirmed Order

export interface SupplierLedgerEntry {
  entryId: string;
  supplierId: string;
  supplierName: string;
  dealId: string;
  eventType: SupplierLedgerEventType;
  eventDate: Timestamp;
  product: Product;               // Snapshot at event time

  // Financial fields — populated based on eventType
  amountKg?: number;
  pricePerKg?: number;
  totalValue?: number;            // amountKg × pricePerKg
  bagSize?: BagSize;
  numberOfBags?: number;
  totalWeightKg?: number;

  // Populated only for allocation_deducted
  relatedOrderId?: string;
  customerName?: string;
  revenueFromSale?: number;       // numberOfBags × bagWeightKg × order.sellingPricePerKg

  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
}
```

**Acceptance:** No TypeScript errors.

---

## Phase 1 — Firestore Services

> **Goal:** Build all database service functions. No UI yet. Each service function is a pure async function that interacts with Firestore.

---

### Task 1.1 — Create `src/services/riceTypeService.ts`

```typescript
// src/services/riceTypeService.ts

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";  // adjust import path to match existing firebase init
import { RiceType, RICE_TYPE_SEED_DATA } from "@/types/riceTypes";

const COLLECTION = "riceTypes";

/**
 * Writes all 10 seed rice types to Firestore if the collection is empty.
 * Call once from the Admin panel or a one-time init script.
 * Uses the riceTypeId as the Firestore document ID.
 */
export async function seedRiceTypes(createdByUid: string): Promise<void> {
  const snap = await getDocs(collection(db, COLLECTION));
  if (!snap.empty) return; // Already seeded

  const now = serverTimestamp() as Timestamp;
  const promises = RICE_TYPE_SEED_DATA.map((rt) =>
    setDoc(doc(db, COLLECTION, rt.riceTypeId), {
      ...rt,
      createdAt: now,
      updatedAt: now,
      createdBy: createdByUid,
    })
  );
  await Promise.all(promises);
}

/**
 * Fetch all active rice types once. Used for form dropdowns on first load.
 */
export async function getActiveRiceTypes(): Promise<RiceType[]> {
  const q = query(
    collection(db, COLLECTION),
    where("isActive", "==", true),
    orderBy("displayName", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as RiceType);
}

/**
 * Subscribe to active rice types in real time.
 * Returns an unsubscribe function. Use in components via useEffect.
 */
export function subscribeToActiveRiceTypes(
  callback: (types: RiceType[]) => void
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where("isActive", "==", true),
    orderBy("displayName", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as RiceType));
  });
}

/**
 * Add a new rice type. riceTypeId is derived from the code (lowercased, trimmed).
 * Returns the created RiceType or throws if the code already exists.
 */
export async function addRiceType(
  code: string,
  displayName: string,
  createdByUid: string
): Promise<RiceType> {
  const id = code.toLowerCase().trim().replace(/\s+/g, "_");
  const ref = doc(db, COLLECTION, id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error(`Rice type with code "${code}" already exists.`);
  }
  const now = serverTimestamp() as Timestamp;
  const newType: RiceType = {
    riceTypeId: id,
    code: id,
    displayName: displayName.trim(),
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: createdByUid,
  };
  await setDoc(ref, newType);
  return newType;
}

/**
 * Soft-delete a rice type. Sets isActive = false. Does not delete historical data.
 */
export async function deactivateRiceType(riceTypeId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, riceTypeId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
}
```

**Acceptance:** No TypeScript errors. `db` import resolves correctly from existing `@/lib/firebase`.

---

### Task 1.2 — Rewrite `src/services/dealService.ts`

This file manages Deals and BagDivisions. Replace the entire file. Keep any existing function signatures that are still valid (supplier CRUD, deal creation, delivery confirmation). Remove all functions related to `stagingBatches`. Add all `bagDivision` functions below.

The file must contain at minimum these functions (preserve existing supplier/deal functions, adapting their types):

```typescript
// src/services/dealService.ts  (additions/replacements — merge with existing supplier CRUD)

import {
  collection, doc, runTransaction, serverTimestamp,
  onSnapshot, query, orderBy, Timestamp, writeBatch, getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Deal, BagDivision } from "@/types/deal";
import { BagSize, BAG_WEIGHT_KG, Product } from "@/types/riceTypes";
import { SupplierLedgerEntry } from "@/types/ledger";

// ─── BAG DIVISION FUNCTIONS ──────────────────────────────────────────────────

/**
 * Create one or more BagDivision documents as drafts under a Deal.
 * Multiple divisions can be passed to handle mixed-ratio division in a single batch write.
 * Does NOT yet deduct from Deal.remainingAmountKg — that happens on confirmation.
 *
 * @param dealId  Parent deal ID
 * @param entries Array of { bagSize, numberOfBags } — one entry per bag size selected
 * @returns Array of created BagDivision documents
 */
export async function createBagDivisions(
  dealId: string,
  entries: { bagSize: BagSize; numberOfBags: number }[]
): Promise<BagDivision[]> {
  const batch = writeBatch(db);
  const now = serverTimestamp() as Timestamp;
  const created: BagDivision[] = [];

  for (const entry of entries) {
    const ref = doc(collection(db, "deals", dealId, "bagDivisions"));
    const bagWeightKg = BAG_WEIGHT_KG[entry.bagSize];
    const division: BagDivision = {
      divisionId: ref.id,
      dealId,
      bagSize: entry.bagSize,
      bagWeightKg,
      numberOfBags: entry.numberOfBags,
      totalWeightKg: entry.numberOfBags * bagWeightKg,
      availableBags: entry.numberOfBags,
      divisionConfirmed: false,
      divisionDate: null,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    batch.set(ref, division);
    created.push(division);
  }

  await batch.commit();
  return created;
}

/**
 * Confirm one or more BagDivision drafts under a single Deal.
 * Runs inside a Firestore Transaction to guarantee inventory consistency.
 *
 * Steps per division:
 *  1. Verify Deal.remainingAmountKg >= totalWeightKg (cumulative across all passed divisions)
 *  2. Decrement Deal.remainingAmountKg
 *  3. Set BagDivision status = 'ready', divisionConfirmed = true
 *  4. Update Inventory: increment totalDividedKg, remainingPackedKg; decrement remainingRawKg
 *  5. Append to Inventory.divisionBreakdown
 *  6. Write SupplierLedgerEntry { eventType: 'bags_divided' } per division
 */
export async function confirmBagDivisions(
  dealId: string,
  divisionIds: string[]
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const dealRef = doc(db, "deals", dealId);
    const dealSnap = await tx.get(dealRef);
    if (!dealSnap.exists()) throw new Error("Deal not found");
    const deal = dealSnap.data() as Deal;

    const inventoryRef = doc(db, "inventory", dealId);
    const inventorySnap = await tx.get(inventoryRef);
    if (!inventorySnap.exists()) throw new Error("Inventory record not found for deal");

    // Load all division docs
    const divisionSnaps = await Promise.all(
      divisionIds.map((id) => tx.get(doc(db, "deals", dealId, "bagDivisions", id)))
    );
    const divisions = divisionSnaps.map((s) => s.data() as BagDivision);

    // Validate cumulative weight
    const totalNewWeight = divisions.reduce((sum, d) => sum + d.totalWeightKg, 0);
    if (deal.remainingAmountKg < totalNewWeight) {
      throw new Error(
        `Insufficient raw stock. Remaining: ${deal.remainingAmountKg} kg, requested: ${totalNewWeight} kg`
      );
    }

    const now = serverTimestamp() as Timestamp;
    const inventory = inventorySnap.data();

    // Update Deal
    tx.update(dealRef, {
      remainingAmountKg: deal.remainingAmountKg - totalNewWeight,
      status: "dividing",
      updatedAt: now,
    });

    // Update each BagDivision + Inventory breakdown + write ledger entries
    for (const division of divisions) {
      const divRef = doc(db, "deals", dealId, "bagDivisions", division.divisionId);
      tx.update(divRef, {
        divisionConfirmed: true,
        divisionDate: now,
        status: "ready",
        updatedAt: now,
      });

      // Append to inventory breakdown
      const breakdown = inventory.divisionBreakdown ?? [];
      breakdown.push({
        divisionId: division.divisionId,
        bagSize: division.bagSize,
        numberOfBags: division.numberOfBags,
        availableBags: division.numberOfBags,
      });
      tx.update(inventoryRef, {
        totalDividedKg: (inventory.totalDividedKg ?? 0) + division.totalWeightKg,
        remainingPackedKg: (inventory.remainingPackedKg ?? 0) + division.totalWeightKg,
        remainingRawKg: (inventory.remainingRawKg ?? 0) - division.totalWeightKg,
        divisionBreakdown: breakdown,
        lastUpdated: now,
      });

      // Supplier Ledger entry
      const ledgerRef = doc(collection(db, "supplierLedgerEntries"));
      const ledgerEntry: Partial<SupplierLedgerEntry> = {
        entryId: ledgerRef.id,
        supplierId: deal.supplierId,
        supplierName: deal.supplierName,
        dealId,
        eventType: "bags_divided",
        eventDate: now,
        product: deal.product,
        bagSize: division.bagSize,
        numberOfBags: division.numberOfBags,
        totalWeightKg: division.totalWeightKg,
        createdAt: now,
        createdBy: deal.createdBy,
      };
      tx.set(ledgerRef, ledgerEntry);
    }
  });
}

/**
 * Subscribe to all BagDivisions under a deal in real time.
 */
export function subscribeToBagDivisions(
  dealId: string,
  callback: (divisions: BagDivision[]) => void
): () => void {
  const q = query(
    collection(db, "deals", dealId, "bagDivisions"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as BagDivision));
  });
}
```

**Acceptance:** No TypeScript errors. Existing supplier CRUD and deal-creation functions remain working.

---

### Task 1.3 — Rewrite `src/services/orderService.ts`

Replace the order confirmation transaction to work with `BagDivision` instead of `StagingBatch`. The `confirmOrder` transaction must:

1. Read the Order and all its Allocations from `orders/{orderId}/allocations`.
2. For each allocation, load the referenced `BagDivision` and `Inventory`.
3. Validate `BagDivision.availableBags >= allocation.numberOfBags`.
4. Subtract `allocation.numberOfBags` from `BagDivision.availableBags`. Set `BagDivision.status` to `"exhausted"` if `availableBags` reaches 0, else `"partial"`.
5. Decrement `Inventory.remainingPackedKg` by `allocation.weightKg`.
6. Increment `Inventory.totalSoldKg` by `allocation.weightKg`.
7. Update the matching entry inside `Inventory.divisionBreakdown[]` to reflect the new `availableBags`.
8. Set `Order.status = "confirmed"`, `Order.orderConfirmed = true`, `Order.confirmedAt = now`.
9. Write a `SupplierLedgerEntry` of type `"allocation_deducted"` for each unique `supplierId` referenced in the allocations.

Also add a function `createOrderWithAllocations(orderData, allocations[])` that writes the order as `"draft"` and its allocations subcollection in a single batch write.

**Acceptance:** The transaction function is complete with no TypeScript errors.

---

### Task 1.4 — Create `src/services/bagDivisionService.ts`

This is a thin re-export wrapper for components that need to import bag division functions without importing all of `dealService`:

```typescript
// src/services/bagDivisionService.ts
export {
  createBagDivisions,
  confirmBagDivisions,
  subscribeToBagDivisions,
} from "./dealService";
```

**Acceptance:** No errors.

---

### Task 1.5 — Create `src/services/supplierLedgerService.ts`

```typescript
// src/services/supplierLedgerService.ts

import {
  collection, query, where, orderBy, onSnapshot, getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SupplierLedgerEntry } from "@/types/ledger";

/**
 * Subscribe to all ledger entries for a specific supplier, ordered by eventDate descending.
 */
export function subscribeToSupplierLedger(
  supplierId: string,
  callback: (entries: SupplierLedgerEntry[]) => void
): () => void {
  const q = query(
    collection(db, "supplierLedgerEntries"),
    where("supplierId", "==", supplierId),
    orderBy("eventDate", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as SupplierLedgerEntry));
  });
}

/**
 * Fetch a financial summary for a supplier: total spend, total kg bought,
 * total kg sold, and remaining packed kg. Computed from ledger entries.
 */
export async function getSupplierFinancialSummary(supplierId: string): Promise<{
  totalSpend: number;
  totalKgBought: number;
  totalKgSold: number;
  totalRevenue: number;
}> {
  const q = query(
    collection(db, "supplierLedgerEntries"),
    where("supplierId", "==", supplierId)
  );
  const snap = await getDocs(q);
  const entries = snap.docs.map((d) => d.data() as SupplierLedgerEntry);

  let totalSpend = 0;
  let totalKgBought = 0;
  let totalKgSold = 0;
  let totalRevenue = 0;

  for (const e of entries) {
    if (e.eventType === "purchase_created") {
      totalSpend += e.totalValue ?? 0;
      totalKgBought += e.amountKg ?? 0;
    }
    if (e.eventType === "allocation_deducted") {
      totalKgSold += e.totalWeightKg ?? 0;
      totalRevenue += e.revenueFromSale ?? 0;
    }
  }

  return { totalSpend, totalKgBought, totalKgSold, totalRevenue };
}

/**
 * Subscribe to a summary list of all suppliers who have ledger entries.
 * Returns unique supplierId + supplierName pairs for the list view.
 */
export function subscribeToAllSupplierLedgerSummaries(
  callback: (suppliers: { supplierId: string; supplierName: string }[]) => void
): () => void {
  return onSnapshot(collection(db, "supplierLedgerEntries"), (snap) => {
    const seen = new Map<string, string>();
    snap.docs.forEach((d) => {
      const entry = d.data() as SupplierLedgerEntry;
      if (!seen.has(entry.supplierId)) {
        seen.set(entry.supplierId, entry.supplierName);
      }
    });
    callback(Array.from(seen.entries()).map(([supplierId, supplierName]) => ({ supplierId, supplierName })));
  });
}
```

**Acceptance:** No TypeScript errors.

---

### Task 1.6 — Update `src/services/inventoryService.ts`

Ensure the primary query uses the new sort order. Replace or add the main subscription query:

```typescript
// Replace the main inventory subscription query inside inventoryService.ts

// The query that powers InventoryPage must be:
const q = query(
  collection(db, "inventory"),
  orderBy("product.riceTypeCode", "asc"),
  orderBy("product.productCode", "asc")
);
// This requires a composite index in Firestore:
// Collection: inventory | Fields: product.riceTypeCode ASC, product.productCode ASC
// Add this index in the Firebase Console before testing the inventory page.
```

Add a comment block at the top of the file:

```
// FIRESTORE INDEX REQUIRED:
// Collection: inventory
// Fields indexed: product.riceTypeCode (Ascending), product.productCode (Ascending)
// Create this composite index in Firebase Console → Firestore → Indexes → Composite
```

**Acceptance:** `subscribeToInventory` function returns data sorted by rice type code then product code.

---

## Phase 2 — Shared Hooks & Context

> **Goal:** Create React hooks so components never call Firestore service functions directly.

---

### Task 2.1 — Create `src/hooks/useRiceTypes.ts`

```typescript
// src/hooks/useRiceTypes.ts

import { useEffect, useState } from "react";
import { RiceType } from "@/types/riceTypes";
import { subscribeToActiveRiceTypes } from "@/services/riceTypeService";

/**
 * Returns all active rice types from Firestore in real time.
 * Components use this to populate the "Type of Rice" dropdown.
 */
export function useRiceTypes(): { riceTypes: RiceType[]; loading: boolean } {
  const [riceTypes, setRiceTypes] = useState<RiceType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToActiveRiceTypes((types) => {
      setRiceTypes(types);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { riceTypes, loading };
}
```

**Acceptance:** Hook compiles and returns correct types.

---

### Task 2.2 — Create `src/hooks/useBagDivisions.ts`

```typescript
// src/hooks/useBagDivisions.ts

import { useEffect, useState } from "react";
import { BagDivision } from "@/types/deal";
import { subscribeToBagDivisions } from "@/services/bagDivisionService";

export function useBagDivisions(dealId: string | null): {
  divisions: BagDivision[];
  loading: boolean;
} {
  const [divisions, setDivisions] = useState<BagDivision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) {
      setDivisions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToBagDivisions(dealId, (data) => {
      setDivisions(data);
      setLoading(false);
    });
    return unsub;
  }, [dealId]);

  return { divisions, loading };
}
```

---

### Task 2.3 — Create `src/hooks/useSupplierLedger.ts`

```typescript
// src/hooks/useSupplierLedger.ts

import { useEffect, useState } from "react";
import { SupplierLedgerEntry } from "@/types/ledger";
import { subscribeToSupplierLedger } from "@/services/supplierLedgerService";

export function useSupplierLedger(supplierId: string | null): {
  entries: SupplierLedgerEntry[];
  loading: boolean;
} {
  const [entries, setEntries] = useState<SupplierLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supplierId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToSupplierLedger(supplierId, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return unsub;
  }, [supplierId]);

  return { entries, loading };
}
```

---

## Phase 3 — Deals Page Rebuild (Bought Tab)

> **Goal:** Replace the three-tab DealsPage with a two-tab layout. Build the entire Bought tab including DealCard, BagDivisionModal, and BagBreakdownDisplay.

---

### Task 3.1 — Update `src/pages/app/DealsPage.tsx`

Replace the existing tab structure. The page must render exactly two tabs using the Shadcn `Tabs` primitive:

- Tab 1: label `"Bought"`, value `"bought"` → renders `<BoughtTab />`
- Tab 2: label `"Sold"`, value `"sold"` → renders `<SoldTab />`

Remove all references to any staging or third tab. Default selected tab is `"bought"`.

```tsx
// src/pages/app/DealsPage.tsx

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BoughtTab } from "@/components/deals/bought/BoughtTab";
import { SoldTab } from "@/components/deals/sold/SoldTab";

export default function DealsPage() {
  return (
    <div className="flex flex-col h-full gap-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deals</h1>
      <Tabs defaultValue="bought" className="flex-1 flex flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="bought">Bought</TabsTrigger>
          <TabsTrigger value="sold">Sold</TabsTrigger>
        </TabsList>
        <TabsContent value="bought" className="flex-1 mt-4">
          <BoughtTab />
        </TabsContent>
        <TabsContent value="sold" className="flex-1 mt-4">
          <SoldTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

### Task 3.2 — Create `src/components/deals/bought/BoughtTab.tsx`

This is the top-level container for the Bought tab. It:

- Renders a "New Deal" button that opens `AddDealModal`.
- Renders a live list of `DealCard` components, one per deal, ordered by `createdAt` descending.
- Shows a loading skeleton while deals are fetching.

Structure:
```
BoughtTab
├── Header row: "Purchases" title + "New Deal" Button
├── AddDealModal (Dialog, opens on button click)
└── DealCard[] (one per deal from useDeals() hook)
```

The `DealCard` receives the full `Deal` object as a prop.

---

### Task 3.3 — Create `src/components/deals/bought/AddDealModal.tsx`

This Dialog replaces the old deal-creation form. It must collect:

- **Supplier**: `<Select>` populated from live `suppliers` collection
- **Product Code**: `<Input type="text">` — required, validated as alphanumeric with dashes allowed
- **Product Name**: `<Input type="text">` — required
- **Type of Rice**: `<Select>` populated from `useRiceTypes()` hook
  - SuperAdmin users see an additional `"+ Add new type"` option at the bottom of the dropdown. Clicking it opens an inline `AddRiceTypeDialog` (a nested Dialog) without closing the outer modal.
- **Total Amount (kg)**: `<Input type="number">` — required, positive
- **Price per kg (₹)**: `<Input type="number">` — required, positive
- **Purchase Date**: `<Input type="date">` — required
- **Notes**: `<Textarea>` — optional

On submit, call `dealService.createDeal()` which must:
1. Validate that `productCode` is not already used in another deal for this supplier (query Firestore before write).
2. Write the `Deal` document with `status: "pending_delivery"`.
3. Write the corresponding `Inventory` document (same ID as dealId, `totalBoughtKg = totalAmountKg`, `remainingRawKg = totalAmountKg`, all other quantities = 0, `divisionBreakdown = []`).
4. Write a `SupplierLedgerEntry` with `eventType: "purchase_created"`.

All three writes must be in a single batched write.

Use `react-hook-form` + `zod` for validation. Show field-level error messages below each input.

---

### Task 3.4 — Create `src/components/deals/bought/DealCard.tsx`

Each card displays one Deal. Layout (top to bottom):

```
┌─────────────────────────────────────────────────────────┐
│  [Badge: status]          [Badge: rice type name]        │
│  Product Code: LS-001  ·  Product Name: Premium LS A    │
│  Supplier: Ramen Traders                                 │
│  Purchased: 5,000 kg @ ₹42/kg  ·  Total: ₹2,10,000     │
│  Purchase Date: 14 Jun 2026                              │
├─────────────────────────────────────────────────────────┤
│  Raw remaining: 2,000 kg   Packed: 3,000 kg             │
│  [Progress bar: raw vs packed vs sold]                   │
├─────────────────────────────────────────────────────────┤
│  BAG BREAKDOWN:                                          │
│  [50 kg × 40 bags (available: 30)]  [1 Quintal × 10 bags (available: 10)] │
├─────────────────────────────────────────────────────────┤
│  [Confirm Delivery] (if not yet confirmed)               │
│  [Divide into Bags] (if delivered, remainingAmountKg > 0)│
└─────────────────────────────────────────────────────────┘
```

- "Confirm Delivery" button calls `dealService.confirmDelivery(dealId)` which sets `deliveryConfirmed = true`, `deliveryDate = now`, `status = "delivered"`, and writes a `SupplierLedgerEntry` of type `"delivery_confirmed"`. All in a batch write.
- "Divide into Bags" button opens `BagDivisionModal`, passing the `dealId` and `remainingAmountKg`.
- The Bag Breakdown section is hidden if there are no confirmed divisions. It renders `<BagBreakdownDisplay divisions={divisions} />`.
- Use `useBagDivisions(deal.dealId)` to get live division data.

---

### Task 3.5 — Create `src/components/deals/bought/BagDivisionModal.tsx`

This Dialog is the primary UX for the bag division feature. Props: `{ dealId: string; remainingAmountKg: number; onClose: () => void }`.

**Layout and behavior:**

**Step 1 — Select bag sizes:**

Render four toggle-buttons in a row: `50 kg` · `60 kg` · `1 Quintal` · `1 Tonne`. These are multi-select toggles (the user can select any combination). Selected buttons are visually highlighted (filled background). At least one must be selected to proceed.

**Step 2 — Enter quantities (appears below toggles after at least one is selected):**

For each selected bag size, render a row:

```
[Bag size label]   Number of bags: [Input type="number"]   = [computed kg] kg
```

The `= [computed kg] kg` updates live as the user types.

**Mixed-ratio helper (optional, appears when 2+ sizes are selected):**

Show a section titled "Or divide by ratio". The user enters a ratio like `2:1:1` (colon-separated integers, one per selected size). A "Apply Ratio" button distributes `remainingAmountKg` proportionally across the selected sizes and fills in the number-of-bags inputs (floored to whole bags). The remaining kg after flooring is shown as `Unallocated: X kg`.

**Running total panel:**

Always visible at the bottom of the modal:
```
Total bags: [n]   Total weight: [n,nnn] kg   Unallocated raw: [n,nnn] kg
```
`Unallocated raw = remainingAmountKg - sum(numberOfBags × bagWeightKg for all selected sizes)`

**Validation before confirm:**
- Total weight across all entries must not exceed `remainingAmountKg`.
- Each `numberOfBags` must be a positive integer.

**Confirm button:**

Calls `createBagDivisions(dealId, entries)` then `confirmBagDivisions(dealId, divisionIds)` in sequence. Shows a loading spinner during the async call. On success, closes the modal and shows a toast: `"Bags divided successfully"`. On error, shows the error message inside the modal.

---

### Task 3.6 — Create `src/components/deals/bought/BagBreakdownDisplay.tsx`

Props: `{ divisions: BagDivision[] }`

Renders the confirmed divisions on a DealCard as a horizontal row of chips. Each chip:

```
[BAG_SIZE_LABEL] × [numberOfBags] bags
Available: [availableBags]  ·  [status badge]
```

Status badge colors:
- `ready` → green
- `partial` → yellow
- `exhausted` → red/gray

---

## Phase 4 — Deals Page Rebuild (Sold Tab)

> **Goal:** Build the Sold tab with the order form and the drag-and-select bag fulfillment panel.

---

### Task 4.1 — Create `src/components/deals/sold/SoldTab.tsx`

Top-level container for the Sold tab. Renders:

- "New Order" button → opens `OrderFormModal`.
- Live list of `OrderSummaryCard` components, one per order (draft + confirmed), ordered by `createdAt` descending.
- Clicking a confirmed order opens `OrderDetailModal`.

---

### Task 4.2 — Create `src/components/deals/sold/OrderFormModal.tsx`

A two-panel Dialog:

**Left panel — Order Header:**

- **Customer**: `<Select>` populated from `customers` collection
- **Order Date**: `<Input type="date">`
- **Selling Price per kg (₹)**: `<Input type="number">` — applied to the whole order
- **Notes**: `<Textarea>` — optional

**Right panel — Bag Fulfillment (`SupplierBagSelector`):**

Rendered once the Order Header fields are filled. See Task 4.3 for the full component spec.

**Footer:**

```
[Cancel]   [Save as Draft]   [Confirm Order]
```

- "Save as Draft" calls `createOrderWithAllocations(orderData, allocations, "draft")`. Closes the modal.
- "Confirm Order" calls `createOrderWithAllocations(orderData, allocations, "draft")` then immediately `confirmOrder(orderId)`. Disabled if no allocations are selected.

---

### Task 4.3 — Create `src/components/deals/sold/SupplierBagSelector.tsx`

Props:
```typescript
interface SupplierBagSelectorProps {
  sellingPricePerKg: number;
  onAllocationsChange: (allocations: PendingAllocation[]) => void;
}

interface PendingAllocation {
  dealId: string;
  supplierId: string;
  supplierName: string;
  divisionId: string;
  product: Product;
  bagSize: BagSize;
  bagWeightKg: number;
  numberOfBags: number;
  weightKg: number;
  purchasePricePerKg: number;
  totalCost: number;
}
```

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  AVAILABLE STOCK                    │  ORDER SUMMARY          │
│                                     │                         │
│  [Supplier A ▼ expanded]            │  Supplier A             │
│    Product: LS-001 · Lal Shonno     │    50kg × 10 bags       │
│    50 kg:  [████░░] 40 avail  →drag │    = 500 kg  [×]        │
│    1 Qt:   [██░░░░] 12 avail  →drag │                         │
│                                     │  Supplier B             │
│  [Supplier B ▼ expanded]            │    1 Tonne × 2 bags     │
│    Product: IR64-002 · Ir64         │    = 2,000 kg  [×]      │
│    1 Tonne: [███░░░] 8 avail  →drag │                         │
│                                     │  ─────────────────      │
│                                     │  Total: 2,500 kg        │
│                                     │  COGS: ₹1,25,000        │
│                                     │  Revenue: ₹1,50,000     │
│                                     │  Profit: ₹25,000        │
└──────────────────────────────────────────────────────────────┘
```

**Left panel — Available Stock:**

- Subscribe to `inventory` collection with status `"in_stock"` or `"partial"`, sorted by `product.riceTypeCode` then `product.productCode`.
- Group by `supplierId`. Each supplier group is an accordion (expanded by default).
- Within each group, render one row per `BagDivision` with `status !== "exhausted"`.
- Each row shows: `[BAG_SIZE_LABEL]  ·  Available: [availableBags] bags  ·  [availableBags × bagWeightKg] kg`
- The row is **draggable** (`draggable="true"`). The `onDragStart` handler stores `{ divisionId, dealId, bagSize, bagWeightKg, availableBags, purchasePricePerKg }` in `event.dataTransfer`.
- Each row also has a **"+ Add"** button (click alternative to drag). Clicking it opens an inline quantity input: `How many bags? [input] / [availableBags] max`. Pressing Enter or clicking "Add" appends the allocation.

**Right panel — Order Summary (drop zone):**

- Has `onDragOver` and `onDrop` handlers. On drop, parse the transfer data. Show an inline quantity prompt: `"How many bags? [input] max [n]"`. Pressing Enter appends the allocation to the list.
- Render the current allocations as cards (grouped by supplier). Each card has an `[×]` remove button.
- Show the running totals: Total Weight, COGS, Revenue (weight × `sellingPricePerKg`), Profit.
- Validation: if `numberOfBags > availableBags` in any allocation, show an inline red warning and disable the Confirm button in the parent modal.
- Call `onAllocationsChange` whenever the allocation list changes.

---

## Phase 5 — Inventory Page Update

> **Goal:** Update the inventory page to group by rice type and sort by product code.

---

### Task 5.1 — Update `src/pages/app/InventoryPage.tsx`

The page receives inventory records already sorted by `product.riceTypeCode` then `product.productCode` from the updated `inventoryService`.

Group records in-memory by `product.riceTypeId`. Render each group as a section:

```
── Lal Shonno ─────────────────────────────────────────────
  [InventoryCard for LS-001]   [InventoryCard for LS-002]

── Ir64 ────────────────────────────────────────────────────
  [InventoryCard for IR64-001]
```

Section headings are `product.riceTypeName` (the display name).

Within each section, cards are already sorted by `productCode` (from the Firestore query).

---

### Task 5.2 — Update `src/components/inventory/InventoryCard.tsx` (or equivalent existing component)

Each card must display:

- `product.productCode` — prominent, top-left
- `product.productName`
- `supplierName`
- `product.riceTypeName` as a badge (color-coded by riceTypeCode — use a deterministic color map or hash)
- Raw remaining (kg)
- Packed remaining: broken down by bag size (e.g., `50 kg: 30 bags · 1 Quintal: 5 bags`)
- Total sold (kg)
- Three-segment progress bar: Raw (blue) / Packed (green) / Sold (orange) — proportional to `totalBoughtKg`
- Status badge: `in_stock` (green) / `partial` (yellow) / `exhausted` (gray)

---

## Phase 6 — Ledger Page Split

> **Goal:** Split the existing LedgerPage into two tabs: Customer Ledger and Supplier Ledger.

---

### Task 6.1 — Update `src/pages/app/LedgerPage.tsx`

Replace the page content with a two-tab layout using Shadcn `Tabs`:

```tsx
<Tabs defaultValue="customer">
  <TabsList>
    <TabsTrigger value="customer">Customer Ledger</TabsTrigger>
    <TabsTrigger value="supplier">Supplier Ledger</TabsTrigger>
  </TabsList>
  <TabsContent value="customer">
    <CustomerLedgerTab />
  </TabsContent>
  <TabsContent value="supplier">
    <SupplierLedgerTab />
  </TabsContent>
</Tabs>
```

---

### Task 6.2 — Create `src/components/ledger/customer/CustomerLedgerTab.tsx`

Move all existing ledger list content into this component. It should be functionally identical to the v1 `LedgerPage` content. No changes to the customer ledger logic.

The component renders:
- A searchable, filterable list of confirmed orders (existing behavior).
- Clicking a row navigates to or opens `CustomerLedgerDetail`.

---

### Task 6.3 — Update `src/components/ledger/customer/CustomerLedgerDetail.tsx`

Update the COGS breakdown table columns to reflect the new `OrderAllocation` schema:

| Column | Value |
| :--- | :--- |
| Supplier | `allocation.supplierName` |
| Product Code | `allocation.product.productCode` |
| Rice Type | `allocation.product.riceTypeName` |
| Bag Size | `BAG_SIZE_LABEL[allocation.bagSize]` |
| Bags | `allocation.numberOfBags` |
| Weight | `allocation.weightKg` kg |
| Purchase Price | ₹`allocation.purchasePricePerKg`/kg |
| COGS | ₹`allocation.totalCost` |
| Revenue | ₹`allocation.weightKg × order.sellingPricePerKg` |
| Profit | ₹`revenue - allocation.totalCost` |

The existing PDF invoice generator must be updated to include these columns.

---

### Task 6.4 — Create `src/components/ledger/supplier/SupplierLedgerTab.tsx`

Top-level container for the Supplier Ledger tab.

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│  SUPPLIERS                   │  SUPPLIER DETAIL           │
│                               │                           │
│  [Supplier A]  ₹X spent      │  [SupplierLedgerDetail]   │
│  [Supplier B]  ₹Y spent      │  (shown when a supplier   │
│  ...                          │   is selected)            │
└──────────────────────────────────────────────────────────┘
```

Left panel: `SupplierLedgerList` — a scrollable list of suppliers who have ledger entries. Uses `subscribeToAllSupplierLedgerSummaries()`. Each row shows supplier name and total spend. Clicking a row sets the selected `supplierId` in component state.

Right panel: `SupplierLedgerDetail` (see Task 6.5). Hidden until a supplier is selected.

On mobile (narrow viewport), show only one panel at a time. A back button in the detail view returns to the list.

---

### Task 6.5 — Create `src/components/ledger/supplier/SupplierLedgerDetail.tsx`

Props: `{ supplierId: string; supplierName: string }`

Uses `useSupplierLedger(supplierId)` to get entries.

**Top section — Financial Summary Panel:**

Four KPI cards in a row:
- Total Paid to Supplier: sum of `totalValue` where `eventType === "purchase_created"`
- Total kg Received: sum of `amountKg` where `eventType === "delivery_confirmed"`
- Total kg Sold: sum of `totalWeightKg` where `eventType === "allocation_deducted"`
- Net Revenue from Supplier's Stock: sum of `revenueFromSale` where `eventType === "allocation_deducted"`

**Bottom section — Event Timeline:**

A chronological table with columns:

| Column | Notes |
|:---|:---|
| Date | `entry.eventDate` formatted as `DD MMM YYYY` |
| Event | Human-readable label per `eventType` (see table below) |
| Product | `entry.product.productCode · entry.product.riceTypeName` |
| Details | See per-event detail below |
| Amount (kg) | `entry.amountKg` or `entry.totalWeightKg` |
| Value (₹) | `entry.totalValue` or `entry.revenueFromSale` |

Event labels and detail column content:

| eventType | Label | Detail Column |
|:---|:---|:---|
| `purchase_created` | Purchase Created | `₹{pricePerKg}/kg · Total: ₹{totalValue}` |
| `delivery_confirmed` | Delivery Confirmed | `Delivered on {eventDate}` |
| `bags_divided` | Bags Divided | `{BAG_SIZE_LABEL[bagSize]} × {numberOfBags} bags` |
| `allocation_deducted` | Sold to Customer | `Order #{relatedOrderId} · {customerName}` |

Color-code rows by event type:
- `purchase_created` → subtle blue background
- `delivery_confirmed` → subtle green background
- `bags_divided` → subtle purple background
- `allocation_deducted` → subtle orange background

---

## Phase 7 — Admin Panel: Rice Type Management

> **Goal:** Let SuperAdmins manage the rice type list from the admin panel.

---

### Task 7.1 — Add Rice Type Management to existing Admin Panel

Locate the existing admin panel component (likely `src/components/admin/` or `src/pages/app/AdminPage.tsx`). Add a new section or tab titled "Rice Types".

This section renders:
- A table of all rice types (active + inactive), with columns: Code, Display Name, Status, Actions.
- "Add Rice Type" button → opens `AddRiceTypeDialog`.
- Each active row has a "Deactivate" button that calls `deactivateRiceType(riceTypeId)`.
- A "Seed defaults" button that calls `seedRiceTypes(currentUserUid)`. The button is disabled and shows `"Already seeded"` if any documents exist in the `riceTypes` collection.

This section is visible to `superadmin` role only (wrap in `SuperAdminRoute` or equivalent role check).

---

### Task 7.2 — Create `src/components/admin/AddRiceTypeDialog.tsx`

A simple Dialog with:
- **Code**: `<Input>` — short machine-readable slug, no spaces, required
- **Display Name**: `<Input>` — human-readable, required

On submit, calls `addRiceType(code, displayName, currentUserUid)`. Shows error if code already exists. Shows success toast on creation.

This component is also used inline in `AddDealModal` (Task 3.3) when a SuperAdmin clicks `"+ Add new type"`.

---

## Phase 8 — Firestore Security Rules Update

> **Goal:** Extend `firestore.rules` to cover the two new collections.

---

### Task 8.1 — Update `firestore.rules`

Add rules for `riceTypes` and `supplierLedgerEntries`. The pattern to follow is the same as existing collections:

```javascript
// Add inside the existing rules block:

match /riceTypes/{riceTypeId} {
  // Any active user can read rice types (needed for deal creation dropdown)
  allow read: if isActiveUser();
  // Only superadmins can write (add/deactivate rice types)
  allow write: if isSuperAdmin();
}

match /supplierLedgerEntries/{entryId} {
  // Active users can read (for the Supplier Ledger tab)
  allow read: if isActiveUser();
  // Write is performed only via backend Firestore Transactions — no direct client writes
  // The transaction runs under an authenticated active user's credentials
  allow create: if isActiveUser();
  allow update, delete: if false; // Ledger entries are immutable
}

// Update bagDivisions subcollection rule inside the deals match:
match /deals/{dealId}/bagDivisions/{divisionId} {
  allow read: if isActiveUser();
  allow write: if isActiveUser();
}
```

Where `isActiveUser()` and `isSuperAdmin()` are existing helper functions in the rules file.

**Acceptance:** Rules deploy without syntax errors.

---

## Phase 9 — Data Migration

> **Goal:** Migrate all existing v1 Firestore data to the v2 schema.

---

### Task 9.1 — Seed Rice Types

From the Admin Panel, click "Seed defaults" under Rice Types. Verify all 10 documents appear in `riceTypes` collection in the Firebase Console.

---

### Task 9.2 — Backfill Existing Deals

This is a **manual one-time operation** performed by the SuperAdmin via a migration UI. Build a simple migration screen (accessible only to SuperAdmin, hidden from the sidebar) at route `/admin/migrate`.

The screen lists all existing `deals` documents that do not yet have a `product.productCode` field. For each, it shows an inline mini-form:
- Product Code (input)
- Product Name (input, pre-filled from the old `productName` field if it exists)
- Type of Rice (dropdown from `useRiceTypes()`)

A "Save" button on each row writes the `product` embedded object onto the deal document and the matching inventory document in a batch write.

Once all deals are migrated, the screen shows "All deals migrated ✓".

---

### Task 9.3 — Rename `stagingBatches` to `bagDivisions`

Write a one-time migration function (callable from the `/admin/migrate` screen via a button "Migrate Staging Batches"):

```typescript
// src/services/migrationService.ts

export async function migrateStagingBatchesToBagDivisions(): Promise<{ migrated: number; errors: string[] }> {
  // 1. Fetch all deals
  // 2. For each deal, fetch its stagingBatches subcollection
  // 3. For each stagingBatch:
  //    a. Map fields to BagDivision schema:
  //       - batchId → divisionId
  //       - bagSizeKg → resolve to BagSize type (50 → "50kg", 60 → "60kg", 100 → "1quintal", 1000 → "1tonne")
  //       - numberOfBags, availableBags, totalWeightKg → carry over
  //       - stagingConfirmed → divisionConfirmed
  //       - stagingDate → divisionDate
  //       - status: "ready" | "partial" | "exhausted" → carry over (drop "draft" as these are already confirmed)
  //       - Remove: pricePerBag field entirely
  //    b. Write to deals/{dealId}/bagDivisions/{divisionId}
  //    c. Delete the original stagingBatches/{batchId} document
  // 4. Update Inventory documents:
  //    - Rename totalStagedKg → totalDividedKg
  //    - Rename remainingStagedKg → remainingPackedKg
  //    - Update stagingBreakdown → divisionBreakdown (remove pricePerBag from each entry)
  // 5. Return count of migrated records and any errors
}
```

**Acceptance:** After running migration, no document in Firestore has a `stagingBatches` subcollection or `pricePerBag` field.

---

### Task 9.4 — Backfill `supplierLedgerEntries`

Write a one-time function (button on `/admin/migrate`):

```typescript
export async function backfillSupplierLedgerEntries(): Promise<{ written: number }> {
  // 1. Fetch all deals and write a "purchase_created" entry for each
  // 2. For each deal where deliveryConfirmed = true, write a "delivery_confirmed" entry
  // 3. Fetch all bagDivisions across all deals and write "bags_divided" entries
  // 4. Fetch all confirmed orders and their allocations; write "allocation_deducted" entries
  // Use batch writes (max 500 per batch). Return total count written.
}
```

---

## Phase 10 — Final Wiring & Cleanup

---

### Task 10.1 — Remove all `StagingBatch` references

Search the entire codebase for the following strings and eliminate every occurrence:
- `StagingBatch`
- `stagingBatch`
- `stagingBatches`
- `stagingService`
- `pricePerBag`
- `confirmStaging`
- `createStagingBatch`
- `totalStagedKg` (replace with `totalDividedKg`)
- `remainingStagedKg` (replace with `remainingPackedKg`)

Run `tsc --noEmit` and fix all resulting errors.

---

### Task 10.2 — Update App Router

In `src/App.tsx`, ensure:
- The route for `/deals` renders the updated `DealsPage` (with two tabs only).
- The route for `/ledger` renders the updated `LedgerPage` (with two tabs).
- A new hidden route `/admin/migrate` renders the migration screen (SuperAdmin only).
- No routes reference staging pages.

---

### Task 10.3 — Update Sidebar Navigation

In the sidebar component (`src/components/layout/`):
- The "Deals" nav item must navigate to `/deals`. No sub-items for staging.
- The "Ledger" nav item must navigate to `/ledger`. No sub-items.
- Ensure no nav items reference staging.

---

### Task 10.4 — Final TypeScript Validation

Run:
```bash
cd c:/dev/ERP/rice-erp
npx tsc --noEmit
```

Zero errors required before this plan is considered complete.

---

### Task 10.5 — Firestore Composite Index

In the Firebase Console, create the following composite index before the inventory page is tested:

```
Collection ID: inventory
Fields:
  product.riceTypeCode  →  Ascending
  product.productCode   →  Ascending
Query scope: Collection
```

Without this index, the inventory page query will throw a Firestore error at runtime.

---

## Appendix A — Complete File Map (New & Modified)

| Status | File Path | Purpose |
|:---|:---|:---|
| **NEW** | `src/types/riceTypes.ts` | RiceType, BagSize, BAG_WEIGHT_KG, Product, seed data |
| **MODIFIED** | `src/types/deal.ts` | Remove StagingBatch, add BagDivision, embed Product |
| **MODIFIED** | `src/types/order.ts` | Update OrderAllocation to reference BagDivision |
| **MODIFIED** | `src/types/inventory.ts` | Update field names, embed Product |
| **NEW** | `src/types/ledger.ts` | SupplierLedgerEntry, SupplierLedgerEventType |
| **NEW** | `src/services/riceTypeService.ts` | CRUD + live subscription for riceTypes collection |
| **MODIFIED** | `src/services/dealService.ts` | Replace staging with bag division functions |
| **NEW** | `src/services/bagDivisionService.ts` | Re-export wrapper |
| **MODIFIED** | `src/services/orderService.ts` | Update confirmOrder to use BagDivision |
| **MODIFIED** | `src/services/inventoryService.ts` | Update query sort order |
| **NEW** | `src/services/supplierLedgerService.ts` | Supplier ledger queries |
| **NEW** | `src/services/migrationService.ts` | One-time v1→v2 migration functions |
| **NEW** | `src/hooks/useRiceTypes.ts` | Live rice type subscription hook |
| **NEW** | `src/hooks/useBagDivisions.ts` | Live bag division subscription hook |
| **NEW** | `src/hooks/useSupplierLedger.ts` | Supplier ledger subscription hook |
| **MODIFIED** | `src/pages/app/DealsPage.tsx` | Two tabs: Bought + Sold |
| **NEW** | `src/components/deals/bought/BoughtTab.tsx` | Bought tab container |
| **NEW** | `src/components/deals/bought/AddDealModal.tsx` | New deal form with Product fields |
| **NEW** | `src/components/deals/bought/DealCard.tsx` | Deal card with bag breakdown |
| **NEW** | `src/components/deals/bought/BagDivisionModal.tsx` | Bag division UI |
| **NEW** | `src/components/deals/bought/BagBreakdownDisplay.tsx` | Division chips display |
| **NEW** | `src/components/deals/sold/SoldTab.tsx` | Sold tab container |
| **NEW** | `src/components/deals/sold/OrderFormModal.tsx` | Two-panel order form |
| **NEW** | `src/components/deals/sold/SupplierBagSelector.tsx` | Drag-and-select fulfillment UI |
| **MODIFIED** | `src/pages/app/InventoryPage.tsx` | Group by rice type, sort by product code |
| **MODIFIED** | `src/components/inventory/InventoryCard.tsx` | Add product code, rice type badge, updated progress bar |
| **MODIFIED** | `src/pages/app/LedgerPage.tsx` | Two-tab ledger container |
| **NEW** | `src/components/ledger/customer/CustomerLedgerTab.tsx` | Existing ledger moved here |
| **MODIFIED** | `src/components/ledger/customer/CustomerLedgerDetail.tsx` | Updated allocation table columns |
| **NEW** | `src/components/ledger/supplier/SupplierLedgerTab.tsx` | Supplier ledger list + detail layout |
| **NEW** | `src/components/ledger/supplier/SupplierLedgerDetail.tsx` | Event timeline + financial summary |
| **MODIFIED** | `src/components/admin/AdminPage.tsx` (or equivalent) | Add Rice Types management section |
| **NEW** | `src/components/admin/AddRiceTypeDialog.tsx` | Quick-add dialog for new rice types |
| **NEW** | `src/pages/app/MigratePage.tsx` | One-time migration UI (SuperAdmin only, hidden from nav) |
| **MODIFIED** | `firestore.rules` | Add rules for riceTypes, supplierLedgerEntries, bagDivisions |
| **MODIFIED** | `src/App.tsx` | Add /admin/migrate route |

---

## Appendix B — Key Business Rules (Do Not Violate)

1. **No price on BagDivision.** If you find yourself adding a price field to a `BagDivision` document, stop. Price lives only on `Deal.pricePerKg` and is copied to `OrderAllocation.purchasePricePerKg` at order confirmation time.

2. **Bag division requires confirmed delivery.** The "Divide into Bags" button must be disabled (not just hidden) if `deal.deliveryConfirmed === false`.

3. **Order confirmation is irreversible.** Once `order.status === "confirmed"`, no UI action should offer to un-confirm or edit it. The order detail view is read-only for confirmed orders.

4. **`availableBags` is the ground truth for stock.** Never compute available stock from `numberOfBags - allocations`. Always read `BagDivision.availableBags` directly.

5. **`riceTypes` collection drives all dropdowns at runtime.** Never render a static list of rice types in any component. Always read from Firestore via `useRiceTypes()`.

6. **Supplier Ledger entries are immutable.** The Firestore rule sets `allow update, delete: if false` on `supplierLedgerEntries`. Do not add update or delete operations to `supplierLedgerService.ts`.

7. **Mixed-supplier order fulfillment is fully supported.** An `Order` can have allocations from multiple `supplierId` values. The `confirmOrder` transaction handles this correctly by iterating all allocations.

8. **Inventory is always updated inside a Transaction.** Never write to the `inventory` collection outside a Firestore Transaction or batched write that atomically updates the parent deal document at the same time.
