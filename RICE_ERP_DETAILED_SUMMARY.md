# 🌾 Rice Merchant ERP — Complete Detailed Summary

> A state-of-the-art Enterprise Resource Planning system custom-built for **Rice Merchants, Traders, and Mill Operators**. The application manages the entire lifecycle of rice: purchasing raw grain, milling it into bags, selling to customers, tracking inventory, managing wages, and generating financial statements — all with full real-time Firestore sync and strict transactional integrity.

---

## 📁 Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Architecture & Directory Structure](#project-architecture--directory-structure)
4. [Authentication, Authorization & Roles](#authentication-authorization--roles)
5. [Database Schema & Data Models](#database-schema--data-models)
6. [Core Business Logic & Transactions](#core-business-logic--transactions)
7. [🏪 Deals Module (Deep Dive)](#-deals-module-deep-dive)
8. [📒 Ledger Module (Deep Dive)](#-ledger-module-deep-dive)
9. [Inventory Module](#inventory-module)
10. [Wages & Payroll Module](#wages--payroll-module)
11. [Balance Sheet & P&L Module](#balance-sheet--pl-module)
12. [Executive Dashboard](#executive-dashboard)
13. [PDF Generation](#pdf-generation)
14. [State Management Architecture](#state-management-architecture)
15. [Service Layer Reference](#service-layer-reference)
16. [File & Symbol Reference Index](#file--symbol-reference-index)

---

## Overview

Rice ERP is a full-stack SaaS web application targeting:
- **Rice Mills** tracking raw grain purchase, milling stages, and bag creation
- **Traders** managing multi-supplier purchasing and multi-customer sales
- **Business Owners** needing accurate P&L, ledger statements, balance sheets, and invoice generation

The core data flow follows this cycle:

```
Supplier → Deal (Purchase) → Bag Division (Milling) → Order (Sale) → Customer Ledger → Invoice PDF
```

Every step produces an atomic Firestore transaction that cascades into inventory, ledger profiles, and balance sheet aggregations.

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|:---|:---|:---|:---|
| **Core Framework** | React | ^18 | Component-driven UI, state-driven DOM |
| **Language** | TypeScript | ^5 | Strict compile-time type safety across all business models |
| **Build Tool** | Vite | ^8 | Fast bundling, HMR, path alias support (`@/`) |
| **Routing** | React Router DOM | ^7 | Client-side routing with route guards (auth, role-based) |
| **Database** | Firebase Firestore | ^12 | Real-time NoSQL document DB with transaction isolation |
| **Authentication** | Firebase Auth | ^12 | Google Sign-In with pending → active approval flow |
| **Styling** | Tailwind CSS | ^3.4 | Utility-first responsive design with custom animations |
| **Component Library** | Shadcn/ui + Base UI | latest | Pre-built primitives (Dialog, Tabs, Card, Select, etc.) |
| **State Management** | Zustand | ^5 | Lightweight global stores for auth, UI, and ledger data |
| **Charts** | Recharts | ^3 | Interactive revenue vs. profit trendlines on dashboard |
| **Form Handling** | React Hook Form | ^7 | Performant form state, submission lifecycle |
| **Validation** | Zod | ^4 | Schema definitions and runtime validation for all forms |
| **PDF Generation** | @react-pdf/renderer | ^4 | Client-side PDF invoice and ledger statement rendering |
| **File Download** | file-saver | ^2 | Browser-triggered PDF save via `saveAs()` |
| **Drag & Drop** | @dnd-kit/core + sortable | ^6/^10 | Reorder ledger entries via drag and drop |
| **Dates** | date-fns | ^4 | Date formatting and comparison logic |
| **Bengali Calendar** | bengali-calendar | ^8 | Regional date display support |
| **Notifications** | react-hot-toast + sonner | latest | Success/error toasts throughout the app |
| **Icons** | lucide-react | ^1 | Consistent icon set |
| **Theme** | next-themes | ^0.4 | Light/dark mode switching support |

### Dev Tooling

| Tool | Purpose |
|:---|:---|
| ESLint | Linting; `--max-warnings 0` on CI |
| PostCSS + Autoprefixer | CSS processing for Tailwind |
| `tsconfig.json` | Strict TypeScript configuration with path aliases |
| `vite.config.mts` | Vite bundler config with React plugin |

---

## Project Architecture & Directory Structure

```
c:/dev/ERP/rice-erp/
├── .env.local                          # Firebase credentials (not committed)
├── .firebaserc                         # Firebase project alias
├── firebase.json                       # Firebase hosting & Firestore config
├── firestore.rules                     # Firestore security rules (role-based access)
├── firestore.indexes.json              # Composite index definitions
├── package.json                        # Dependency manifest & npm scripts
├── tailwind.config.ts                  # Design system (colors, fonts, animations)
├── vite.config.mts                     # Build configuration
├── tsconfig.json                       # TypeScript compiler options
└── src/
    ├── App.tsx                         # Root router — defines all client-side routes
    ├── main.tsx                        # Application entry point (ReactDOM render)
    ├── globals.css                     # Base styles, font imports, scrollbar overrides
    ├── lib/
    │   ├── firebase.ts                 # Firebase app initialization (db, auth)
    │   ├── ledgerUnitConversion.ts     # Kg ↔ Quintal ↔ Tonne display unit conversion
    │   └── utils.ts                    # clsx/tailwind-merge helper (cn())
    ├── types/
    │   ├── deal.ts                     # Deal, Supplier, BagDivision, DealDiscount
    │   ├── order.ts                    # Order, Customer, OrderAllocation
    │   ├── inventory.ts                # Inventory, InventoryDivisionSnapshot
    │   ├── ledger.ts                   # SupplierLedgerEntry (legacy flat collection)
    │   ├── ledger-profile.ts           # LedgerProfile, LedgerEntry, VchType enums (Zod)
    │   ├── balanceSheet.ts             # BalanceLineItem, BalanceSheetGroup, AggregatedFinancials
    │   ├── riceTypes.ts                # RiceType, BagSize, Product, BAG_WEIGHT_KG
    │   ├── employee.ts                 # Employee interface
    │   ├── salaryTransaction.ts        # SalaryTransaction interface
    │   ├── bank.ts                     # Bank interface
    │   ├── dealLog.ts                  # DealLog interface
    │   └── index.ts                    # Re-exports all public types
    ├── stores/
    │   ├── authStore.ts                # Auth state (user, loading, role, status)
    │   ├── uiStore.ts                  # Modal state + requestConfirm() dialog utility
    │   └── useLedgerStore.ts           # Supplier/Customer profile lists, real-time sync
    ├── hooks/
    │   └── useSupplierLedger.ts        # Hook: fetches SupplierLedgerEntry[] for one supplier
    ├── services/
    │   ├── dealService.ts              # Deal CRUD + BagDivision creation/confirmation
    │   ├── stagingService.ts           # (legacy) Staging batch operations
    │   ├── orderService.ts             # Order creation + confirmation transaction
    │   ├── ledgerProfileService.ts     # LedgerProfile CRUD + LedgerEntry management
    │   ├── ledgerService.ts            # getLedgerForOrder() — COGS + Invoice data
    │   ├── supplierLedgerService.ts    # Legacy flat supplierLedgerEntries operations
    │   ├── inventoryService.ts         # Inventory reads and status updates
    │   ├── balanceSheetAggregation.ts  # Firestore aggregation for Balance Sheet & P&L
    │   ├── balanceSheetBreakdown.ts    # Detailed breakdown rows for Balance Sheet groups
    │   ├── customerService.ts          # Customer CRUD
    │   ├── supplierService.ts          # Supplier CRUD
    │   ├── riceTypeService.ts          # RiceType CRUD (SuperAdmin only)
    │   ├── employeeService.ts          # Employee registry and salary logs
    │   ├── userService.ts              # User management (status, role updates)
    │   ├── bagDivisionService.ts       # Thin wrapper for bag division reads
    │   ├── dealLogService.ts           # Deal log event writing
    │   └── migrationService.ts         # One-time data migration scripts
    ├── schemas/                        # Zod schemas for forms (payment voucher, etc.)
    ├── constants/
    │   └── dealLabels.ts               # Configurable labels like "Bought"/"Sold" display text
    ├── utils/                          # Shared utility functions
    └── components/
        ├── admin/                      # SuperAdmin user management
        │   ├── AdminUsersPage.tsx      # Approve/suspend/promote users list
        │   └── UserCard.tsx            # Individual user row with action buttons
        ├── auth/
        │   └── AuthProvider.tsx        # Wraps app; enforces login + pending redirect
        ├── layout/
        │   ├── AppLayout.tsx           # Shell: Sidebar + main content area
        │   ├── Sidebar.tsx             # Navigation links + user avatar + sign-out
        │   ├── ProtectedRoute.tsx      # Redirects unauthenticated/pending users
        │   └── SuperAdminRoute.tsx     # Restricts routes to superadmin role only
        ├── dashboard/
        │   └── DashboardPage.tsx       # KPI cards + revenue/profit chart
        ├── deals/
        │   ├── DealsFilter.tsx         # Date range + customer/supplier search filter
        │   ├── TabSold.tsx             # Sold tab shell (orders list)
        │   ├── TabStaging.tsx          # Staging tab shell (bag divisions per deal)
        │   ├── bought/
        │   │   ├── AddDealModal.tsx    # Full purchase deal creation form
        │   │   ├── BoughtTab.tsx       # List of all purchase deals
        │   │   ├── DealCard.tsx        # Deal row with delivery confirm + bag division
        │   │   ├── BagDivisionModal.tsx# Create/confirm bag divisions for a deal
        │   │   ├── BagBreakdownDisplay.tsx # Visual breakdown of bags per division
        │   │   ├── EditDivisionsModal.tsx  # Edit pending bag divisions before confirm
        │   │   └── SupplierManager.tsx     # Add/view suppliers CRM panel
        │   ├── sold/
        │   │   ├── SoldTab.tsx         # List of all customer orders
        │   │   ├── CustomerManager.tsx # Add/view customers CRM panel
        │   │   ├── OrderCard.tsx       # Order row with status, revenue, profit
        │   │   ├── OrderForm.tsx       # Order line items + bag allocation UI
        │   │   ├── OrderFormModal.tsx  # Modal wrapper for OrderForm
        │   │   └── SupplierBagSelector.tsx # Advanced bag picker for order allocation
        │   ├── shared/
        │   │   └── (shared deals components)
        │   └── PaymentVoucher/
        │       ├── PaymentVoucherDialog.tsx   # Dialog wrapper
        │       ├── PaymentVoucherForm.tsx     # Payment voucher entry form
        │       ├── ProfileCombobox.tsx        # Search + select ledger profile
        │       ├── paymentVoucherSchema.ts    # Zod schema for voucher form
        │       └── usePaymentVoucher.ts       # Form state hook
        ├── ledger/
        │   ├── customer/
        │   │   ├── CustomerLedgerTab.tsx      # Customer ledger: KPIs + order table
        │   │   └── profiles/
        │   │       └── CustomerProfilesTab.tsx # Ledger profile list for all customers
        │   ├── supplier/
        │   │   ├── SupplierLedgerTab.tsx       # Supplier ledger tab shell
        │   │   ├── SupplierLedgerDetail.tsx    # Per-supplier transaction table + KPIs
        │   │   └── profiles/
        │   │       └── SupplierProfilesTab.tsx # Ledger profile list for all suppliers
        │   ├── salary/
        │   │   └── SalaryLedgerTab.tsx         # Salary transaction log
        │   └── shared/
        │       ├── LedgerProfileDetail.tsx     # Full double-entry ledger view per entity
        │       ├── LedgerProfileTable.tsx      # Sortable, editable ledger rows (DnD)
        │       ├── LedgerTotalsFooter.tsx      # Running totals footer row
        │       ├── ManualEntryForm.tsx         # Drawer form: add manual debit/credit entry
        │       └── pdf/
        │           └── LedgerProfilePdf.tsx    # @react-pdf template for ledger statements
        ├── inventory/                  # Stock visualization components
        ├── pdf/
        │   └── InvoicePDF.tsx         # @react-pdf template for customer sales invoices
        ├── wages/                      # Employee registry + payroll log components
        └── ui/                         # Shadcn primitives (Dialog, Tabs, Card, etc.)
```

---

## Authentication, Authorization & Roles

The app uses a **three-tier user lifecycle** enforced on both client (React Router guards) and server (Firestore Security Rules).

### User Lifecycle

```
New Google Sign-In
      │
      ▼
  status: "pending"
  (locked to /pending waiting room — NO database access)
      │
      ▼ (SuperAdmin action)
  ┌───────────────────────────────┐
  │ status: "active"              │  ←── Full operational access
  │ role: "admin" | "superadmin"  │
  └───────────────────────────────┘
      │
      ▼ (SuperAdmin action)
  status: "removed"
  (suspended — database permissions stripped)
```

### Roles

| Role | Permissions |
|:---|:---|
| **admin** | Full access to all operational modules: deals, inventory, ledger, wages |
| **superadmin** | All admin permissions + User Management panel at `/admin/users` (approve/suspend/promote users) |

### Firestore Security Rules

Firestore rules ([firestore.rules](file:///c:/dev/ERP/rice-erp/firestore.rules)) enforce:
- `pending` and `removed` users → read/write denied on all collections
- `active` users → read/write operational collections
- `superadmin` users → additionally write to the `users` collection

### Route Guards

- [ProtectedRoute.tsx](file:///c:/dev/ERP/rice-erp/src/components/layout/ProtectedRoute.tsx) — Redirects unauthenticated or `pending`/`removed` users
- [SuperAdminRoute.tsx](file:///c:/dev/ERP/rice-erp/src/components/layout/SuperAdminRoute.tsx) — Restricts to `superadmin` role only

---

## Database Schema & Data Models

### Firestore Collections

| Collection | Description |
|:---|:---|
| `users` | User auth profiles with role + status |
| `suppliers` | Raw material supplier directory |
| `customers` | Client/buyer directory |
| `riceTypes` | Master rice variety catalog |
| `deals` | Purchase contracts from suppliers |
| `deals/{id}/bagDivisions` | Subcollection: milling batches per deal |
| `orders` | Customer sales orders |
| `orders/{id}/allocations` | Subcollection: per-deal bag allocations in each order |
| `inventory` | One doc per deal: consolidated raw/packed/sold stock |
| `ledgerProfiles` | One profile per supplier or customer |
| `ledgerProfiles/{id}/entries` | Subcollection: individual double-entry ledger rows |
| `supplierLedgerEntries` | Legacy flat collection for supplier event log |
| `employees` | Employee registry |
| `salaryTransactions` | Wage disbursement records |
| `banks` | Bank account records |
| `banks/{id}/transactions` | Per-bank debit/credit transaction history |
| `balanceSheetManualEntries` | Manual overrides for balance sheet line items |

---

### `users`

```typescript
interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: "superadmin" | "admin";
  status: "pending" | "active" | "removed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### `suppliers` / `customers`

```typescript
interface Supplier {
  supplierId: string;
  name: string;
  description: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  createdAt: Timestamp;
  createdBy: string;   // uid of creator
  updatedAt: Timestamp;
}

// Customer uses same shape with customerId
```

---

### `riceTypes`

```typescript
interface RiceType {
  riceTypeId: string;      // Firestore doc ID, e.g. "ls", "ir64"
  code: string;            // Short machine identifier
  displayName: string;     // UI label, e.g. "Lal Shonno"
  isActive: boolean;       // Soft-delete — false hides from dropdowns
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}
```

**Seeded rice types:** Lal Shonno, Gobindobhog, Chausotti, Chatris, Ir64, Shindu, Minicate, Baskathi, Gs1, Cm

---

### `deals`

```typescript
interface Deal {
  dealId: string;
  supplierId: string;
  supplierName: string;             // Denormalized
  product: Product;                 // Embedded: productCode, productName, riceTypeId, riceTypeName
  grossAmountKg?: number;           // Raw total before tare deduction
  weightDeductionKg?: number;       // Tare/deduction from gross weight
  totalAmountKg: number;            // Net grain (gross - deduction)
  remainingAmountKg: number;        // Net not yet divided into bags
  pricePerKg: number;               // Purchase price — feeds COGS at order time
  grossCost?: number;               // totalAmountKg × pricePerKg (pre-discount)
  totalCost: number;                // NET cost after any discount
  discount?: DealDiscount | null;   // Optional quantity discount
  purchaseDate: Timestamp;
  deliveryConfirmed: boolean;
  deliveryDate: Timestamp | null;
  status: "pending_delivery" | "delivered" | "dividing" | "completed";
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

interface DealDiscount {
  discountKg: number;               // Volume of rice discounted
  discountRatePerKg: number;        // Rate applied to discounted kg
  discountValue: number;            // discountKg × discountRatePerKg
}

interface Product {
  productCode: string;    // Unique user-defined code per deal, e.g. "LS-001"
  productName: string;    // Descriptive label
  riceTypeId: string;
  riceTypeCode: string;
  riceTypeName: string;
}
```

---

### `deals/{dealId}/bagDivisions`

```typescript
interface BagDivision {
  divisionId: string;
  dealId: string;
  bagSize: "50kg" | "60kg" | "1tonne" | "1quintal";
  bagWeightKg: number;       // Canonical weight from BAG_WEIGHT_KG lookup
  numberOfBags: number;      // Total bags created in this division
  totalWeightKg: number;     // numberOfBags × bagWeightKg
  availableBags: number;     // Bags not yet committed to a confirmed order
  divisionConfirmed: boolean;
  divisionDate: Timestamp | null;
  status: "draft" | "ready" | "partial" | "exhausted";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

> **Note:** No price is stored on BagDivision. The `Deal.pricePerKg` is always read at order time (COGS calculation) to ensure accuracy.

---

### `orders`

```typescript
interface Order {
  orderId: string;
  customerId: string;
  customerName: string;
  orderDate: Timestamp;
  totalWeightKg: number;        // Sum of all allocation weights
  totalRevenue: number;         // Sum of allocation revenues
  totalCostOfGoods: number;     // Sum of allocation COGS
  profit: number;               // totalRevenue - totalCostOfGoods
  orderConfirmed: boolean;
  confirmedAt: Timestamp | null;
  status: "draft" | "confirmed" | "delivered";
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}
```

---

### `orders/{orderId}/allocations`

```typescript
interface OrderAllocation {
  allocationId: string;
  dealId: string;
  supplierId: string;           // Denormalized
  supplierName: string;
  divisionId: string;           // References BagDivision
  product: Product;             // Snapshot at allocation time
  bagSize: BagSize;
  bagWeightKg: number;
  numberOfBags: number;
  weightKg: number;             // numberOfBags × bagWeightKg
  purchasePricePerKg: number;   // Copied from Deal.pricePerKg at allocation time
  totalCost: number;            // weightKg × purchasePricePerKg (COGS)
  sellingPricePerKg: number;    // Selling price for this specific bag type
  revenue: number;              // weightKg × sellingPricePerKg
  profit: number;               // revenue - totalCost
  createdAt: Timestamp;
}
```

---

### `inventory`

```typescript
interface Inventory {
  inventoryId: string;          // Maps 1:1 to dealId
  dealId: string;
  supplierId: string;
  supplierName: string;
  product: Product;
  totalBoughtKg: number;        // Total net purchased
  totalDividedKg: number;       // Total moved to bag divisions
  totalSoldKg: number;          // Total sold via confirmed orders
  remainingRawKg: number;       // Loose grain not yet divided
  remainingPackedKg: number;    // Bags available (divided but unsold)
  divisionBreakdown: {          // Per-division snapshot for quick reads
    divisionId: string;
    bagSize: BagSize;
    numberOfBags: number;
    availableBags: number;
  }[];
  lastUpdated: Timestamp;
  status: "in_stock" | "partial" | "exhausted";
}
```

---

### `ledgerProfiles`

```typescript
interface LedgerProfile {
  id: string;               // Firestore doc ID
  entityId: string;         // Supplier or Customer ID
  entityType: "supplier" | "customer";
  entityName: string;       // Denormalized for display
  millName: string;         // Business/mill name for PDF headers
  millDescription: string;  // Address or description line
  millContact?: string;     // Contact number for PDF
  totalDebit: number;       // Running aggregate — updated via Firestore transaction
  totalCredit: number;
  closingBalance: number;   // totalDebit - totalCredit (positive = entity owes us)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### `ledgerProfiles/{profileId}/entries`

```typescript
interface LedgerEntry {
  id: string;                   // Firestore doc ID
  profileId: string;
  entityId: string;
  entityType: "supplier" | "customer";
  date: Timestamp;              // Business date of the transaction
  particulars: string;          // Main description (e.g. "Purchase — Lal Shonno")
  subParticulars?: string;      // Detail line (e.g. "680 kg @ ₹45.00/kg")
  refLabel?: string;            // Reference (e.g. "Code: LS-001")
  vchType: "Purchase" | "Payment" | "Receipt" | "Sale" | "Journal" | "Manual";
  vchNo: number;                // Voucher number for accounting
  debit: number;                // ₹ amount (0 if credit entry)
  credit: number;               // ₹ amount (0 if debit entry)
  entryType: LedgerEntryType;   // See enum below
  isManual: boolean;            // True for user-created rows
  isSystemGenerated: boolean;
  relatedDocId?: string;        // Deal ID or Order ID that triggered this entry
  quantityKg?: number;          // Stock quantity involved
  pricePerUnit?: number;        // ₹/kg or ₹/unit
  riceType?: string;
  bankId?: string | null;       // Linked bank account (if fund movement)
  bankName?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Entry type enum
type LedgerEntryType =
  | "purchase_created"        // When a deal is created
  | "delivery_confirmed"      // When supplier delivers grain
  | "bags_divided"            // When bag divisions are confirmed (filtered in UI)
  | "bags_divided_reverted"   // When a division is deleted
  | "order_confirmed"         // When a customer order is confirmed
  | "payment_received"        // Payment from customer
  | "payment_made"            // Payment to supplier
  | "manual_debit"            // Manual debit entry by user
  | "manual_credit";          // Manual credit entry by user
```

---

### `banks`

```typescript
interface Bank {
  id: string;
  name: string;
  principalAmount: number;   // Current running balance
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Core Business Logic & Transactions

All inventory-altering operations are wrapped in **Firestore `runTransaction()`** calls to guarantee atomicity under concurrent access.

### Transaction A: Create Deal (Batch Write)

**Trigger:** User submits the Add Deal form.

```
1. Calculate net amounts:
   netAmountKg = grossAmountKg - weightDeductionKg
   grossCost = netAmountKg × pricePerKg
   discountValue = discountKg × discountRatePerKg  (if enabled)
   totalCost = grossCost - discountValue

2. Batch write (3 atomic writes):
   → deals/{dealId}           — New deal (status: "pending_delivery")
   → inventory/{dealId}       — New inventory record (remainingRawKg = netAmountKg)
   → supplierLedgerEntries/{} — Legacy ledger event (eventType: "purchase_created")
```

### Transaction B: Confirm Delivery

**Trigger:** User clicks "Confirm Delivery" on a DealCard.

```
runTransaction:
  1. Read deal → verify not already confirmed
  2. Update deal: deliveryConfirmed=true, status="delivered"
  3. Write LedgerEntry to ledgerProfiles/{profileId}/entries:
       vchType: "Purchase", entryType: "delivery_confirmed"
       debit: deal.totalCost, credit: 0
       subParticulars: "{kg} kg @ ₹{rate}/kg | Discount info..."
  4. Update LedgerProfile aggregate:
       totalDebit += deal.totalCost
       closingBalance += deal.totalCost
```

### Transaction C: Confirm Bag Divisions

**Trigger:** User confirms one or more bag divisions in BagDivisionModal.

```
runTransaction:
  1. Read deal → verify remainingAmountKg >= totalNewWeight
  2. For each division:
     → Update BagDivision: divisionConfirmed=true, status="ready"
  3. Update deal:
     → remainingAmountKg -= totalNewWeight
     → status = (remainingAmountKg === 0) ? "completed" : "dividing"
  4. Update inventory:
     → totalDividedKg += totalNewWeight
     → remainingPackedKg += totalNewWeight
     → remainingRawKg -= totalNewWeight
     → append to divisionBreakdown[]
```

### Transaction D: Create Order

**Trigger:** User submits OrderFormModal.

```
writeBatch:
  1. Create orders/{orderId} (status: "draft")
  2. For each allocation:
     → Calculate revenue = weightKg × sellingPricePerKg
     → Calculate profit = revenue - totalCost
     → Create orders/{orderId}/allocations/{allocId}
  3. Update order with totals: totalRevenue, totalCostOfGoods, profit
```

### Transaction E: Confirm Order ⚡ (Most Complex)

**Trigger:** User clicks "Confirm Order" on OrderCard.

```
runTransaction:
  ── ALL READS FIRST ──
  1. Read Order
  2. Read all allocations (subcollection query)
  3. Read all referenced BagDivisions
  4. Read all referenced Inventory docs

  ── COMPUTE ──
  5. For each allocation:
     → Validate BagDivision.availableBags >= allocation.numberOfBags
     → Compute new availableBags (subtract)
     → Compute new BagDivision status ("exhausted" or "partial")
     → Accumulate inventory deltas: remainingPackedKg-=, totalSoldKg+=

  ── ALL WRITES ──
  6. Update all BagDivisions (availableBags, status)
  7. Update all Inventory docs (remainingPackedKg, totalSoldKg, divisionBreakdown)
  8. Update Order: orderConfirmed=true, status="confirmed"
  9. Write LedgerEntry to customer's ledger profile:
       vchType: "Sale", entryType: "order_confirmed"
       credit: totalRevenue, debit: 0
  10. Update customer LedgerProfile:
       totalCredit += totalRevenue
       closingBalance -= totalRevenue
```

### Transaction F: Delete Deal (Atomic Cleanup)

**Trigger:** User deletes a deal (only if no bags have been sold).

```
Pre-validation:
  → Check all BagDivisions: availableBags === numberOfBags (none sold)

runTransaction:
  1. Read deal (consistency check)
  2. For each BagDivision: verify available = total
  3. Reverse LedgerProfile totals:
     → totalDebit -= sumDebit; totalCredit -= sumCredit
  4. Delete all LedgerProfile entries linked to dealId
  5. Delete all supplierLedgerEntries linked to dealId
  6. Delete all BagDivisions
  7. Delete inventory/{dealId}
  8. Delete deals/{dealId}
```

### Transaction G: Delete Order (Full Reversal)

**Trigger:** User deletes an order.

```
runTransaction:
  1. Read order + all allocations
  2. If order was confirmed:
     → Read all BagDivisions + Inventory docs
     → Reverse bag counts: availableBags += allocation.numberOfBags
     → Update BagDivision status back to "ready" or "partial"
     → Restore Inventory: remainingPackedKg+=, totalSoldKg-=
     → Delete LedgerEntry for this order
     → Reverse LedgerProfile totals:
         totalCredit -= totalRevenue
         closingBalance += totalRevenue
  3. Delete all allocations
  4. Delete order
```

---

## 🏪 Deals Module (Deep Dive)

**Route:** `/deals`  
**Entry Point:** [DealsPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/DealsPage.tsx)

The Deals module is divided into three sub-tabs using `Tabs` from Shadcn:

### Sub-Tab 1: Bought (Purchase Management)

**Component:** [BoughtTab.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/bought/BoughtTab.tsx)

#### Features:
- **Supplier Manager** ([SupplierManager.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/bought/SupplierManager.tsx)):
  - Add new suppliers with name, description, phone, email, address
  - View full supplier directory
  - Click supplier to view their ledger history

- **Deal Card** ([DealCard.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/bought/DealCard.tsx)):
  - Displays per-deal: supplier, rice type, product code, net kg, price/kg, total cost
  - Shows discount badge if deal includes a quantity discount
  - Shows remaining raw stock and remaining packed stock
  - **Confirm Delivery Button** — triggers `dealService.confirmDelivery()` transaction
  - **Bag Division Button** — opens BagDivisionModal
  - **Delete Button** — triggers `dealService.deleteDeal()` (guarded by sold-bag check)

- **Add Deal Modal** ([AddDealModal.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/bought/AddDealModal.tsx)):
  - Fields: Supplier (dropdown), Rice Type (dropdown from `riceTypes`), Product Code (auto-generated), Product Name, Purchase Date, Gross Amount (kg), Weight Deduction (kg), Price/kg
  - Optional discount section: Discount Volume (kg) + Rate (₹/kg)
  - Live preview of: Net Amount Kg, Gross Cost, Discount Value, Net Total Cost
  - Validated with React Hook Form + Zod schema

- **Bag Division Modal** ([BagDivisionModal.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/bought/BagDivisionModal.tsx)):
  - Select bag size(s): 50kg, 60kg, 1 Quintal, 1 Tonne
  - Enter number of bags per size
  - Live validation: total weight cannot exceed `deal.remainingAmountKg`
  - Saves as `draft` first, then confirms via `confirmBagDivisions()` transaction
  - Shows `BagBreakdownDisplay` of existing confirmed divisions

- **Edit Divisions Modal** ([EditDivisionsModal.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/bought/EditDivisionsModal.tsx)):
  - Modify unconfirmed (draft) bag divisions before confirming

- **DealsFilter** ([DealsFilter.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/DealsFilter.tsx)):
  - Filter by: All Time, This Month, Last Month, Custom Date Range
  - Search by supplier or customer name

### Sub-Tab 2: Staging (Bag Division View)

**Component:** [TabStaging.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/TabStaging.tsx)

- Lists all deals with active bag divisions
- Shows breakdown per division: bagSize, numberOfBags, availableBags, status
- Status chips: `draft`, `ready`, `partial`, `exhausted`

### Sub-Tab 3: Sold (Sales Management)

**Component:** [SoldTab.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/TabSold.tsx)

#### Features:
- **Customer Manager** ([CustomerManager.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/sold/CustomerManager.tsx)):
  - Add new customers with name, description, phone, email, address
  - View full customer directory

- **Order Card** ([OrderCard.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/sold/OrderCard.tsx)):
  - Displays per-order: customer, date, total weight, revenue, profit, status
  - Profit margin indicator (green/red based on value)
  - **Confirm Order Button** — triggers `orderService.confirmOrder()` (irreversible)
  - **Delete Button** — triggers `orderService.deleteOrder()` with full reversal
  - **View Ledger Link** — navigates to `/ledger/{orderId}` COGS detail page

- **Order Form Modal** ([OrderFormModal.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/sold/OrderFormModal.tsx)):
  - Wraps OrderForm + SupplierBagSelector

- **Order Form** ([OrderForm.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/sold/OrderForm.tsx)):
  - Select Customer, set Order Date, add Notes
  - Line items: pick bag divisions, set quantity, set selling price per bag size

- **Supplier Bag Selector** ([SupplierBagSelector.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/sold/SupplierBagSelector.tsx)):
  - Advanced multi-select UI showing available bags grouped by deal + division
  - Shows: supplier name, rice type, bag size, available count, purchase price/kg
  - Supports mixed-source orders (bags from multiple deals/suppliers in one order)
  - Per-line selling price entry (different prices for different bag sizes)
  - Live running total of revenue, COGS, and profit margin as user selects

### Payment Voucher

**Components:** [PaymentVoucher/](file:///c:/dev/ERP/rice-erp/src/components/deals/PaymentVoucher/)

A dedicated payment recording system:
- **Direction Logic:**
  - Supplier payment → `credit` entry (reduces what we owe)
  - Customer payment → `debit` entry (records cash received)
- **Fields:** Amount, Payment Date, Payment Mode (Cash/Cheque/Bank Transfer/UPI), Reference Number, Note, Link to Bank Account
- **Effect:** Creates a `LedgerEntry` + optionally adjusts linked bank balance
- **Schema:** `paymentVoucherSchema.ts` (Zod v4 validated)

---

## 📒 Ledger Module (Deep Dive)

**Route:** `/ledger`  
**Entry Point:** [LedgerPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/LedgerPage.tsx)

The General Ledger is the financial heart of the ERP. It provides a complete double-entry accounting system with per-entity profiles, real-time balance tracking, PDF export, and drag-and-drop reordering.

### Three-Tab Structure

```
General Ledger
├── Customer Ledger    → All sales orders + customer profile ledgers
├── Supplier Ledger    → All purchase events + supplier profile ledgers
└── Salary Ledger      → Wage disbursement log
```

### Customer Ledger Tab

**Component:** [CustomerLedgerTab.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/customer/CustomerLedgerTab.tsx)

**Inner tabs:**
1. **Transaction Events** — filterable table of confirmed orders:
   - Date, Customer Name, Volume (kg), Revenue, Profit, Status
   - Filter by date range and by specific customer
   - Aggregate KPI cards: **Total Revenue**, **Total Profit**, **Total Volume**
   - Delete order button (triggers full `deleteOrder()` reversal)
   - "Details →" link to `/ledger/{orderId}` for COGS breakdown

2. **Ledger Profiles** — list of all customer ledger accounts:
   - Closing balance per customer
   - Click to open full `LedgerProfileDetail`

### Supplier Ledger Tab

**Component:** [SupplierLedgerTab.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/supplier/SupplierLedgerTab.tsx)  
**Detail Component:** [SupplierLedgerDetail.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/supplier/SupplierLedgerDetail.tsx)

**KPI Cards:**
- **Total Spend** — sum of totalValue for `purchase_created` events
- **Total Kg Bought** — sum of amountKg for purchase entries
- **Total Kg Sold** — sum of totalWeightKg for `allocation_deducted` events
- **Net Revenue (Gross)** — sum of revenueFromSale for sold allocations

**Transaction Table:**
- Shows `purchase_created` events with expand-to-detail toggle
- Expanded row shows: Supplier Information card + Financial Summary card
- Delivery confirmed badge on purchase rows where `delivery_confirmed` event exists
- Delete transaction event button

**Inner tabs:**
1. **Transaction Events** — chronological purchase event log
2. **Ledger Profiles** — [SupplierProfilesTab.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/supplier/profiles/SupplierProfilesTab.tsx) with all supplier profiles and closing balances

### Ledger Profile Detail (Shared)

**Component:** [LedgerProfileDetail.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/shared/LedgerProfileDetail.tsx)

This is the most feature-rich ledger component — it renders a complete, professional double-entry ledger account for any supplier or customer.

#### Features:

**1. Real-Time Firestore Sync**
- Uses `onSnapshot` via `useLedgerStore.subscribeToProfileEntries(profileId)`
- Entries update automatically when new transactions are created anywhere in the app

**2. Date Range Filter**
- From/To date pickers auto-initialize to the range of the first and last entry
- Client-side filtering (no extra Firestore index needed)
- `bags_divided` and `bags_divided_reverted` entries are hidden from display

**3. Display Unit Switcher**
- Toggle between: **kg**, **Quintal (100 kg)**, **Tonne (1000 kg)**
- Converts quantity and price columns across the entire table and PDF in real-time
- Uses `ledgerUnitConversion.ts` for all arithmetic

**4. Add Manual Entry**
- Button opens `ManualEntryForm` drawer
- Supports: Debit or Credit direction
- Fields: Date, Particulars, Sub-Particulars, Voucher Type, Voucher Number, Amount
- Optional: Quantity (kg), Rate (₹/unit), Rice Type
- Optional: Link to Bank Account → records fund movement atomically
- `addManualLedgerEntry()` transaction: creates entry + updates profile totals + optionally updates bank balance

**5. Edit Existing Entries**
- Edit `particulars`, `subParticulars`, `refLabel`, `date`, `vchNo` inline
- Edit debit/credit amount via `updateLedgerEntryAmount()` — atomic transaction that:
  - Recalculates `pricePerUnit` based on new amount
  - Rewrites `subParticulars` with updated rate
  - Cascades delta to parent profile totals
  - If entry is linked to a Deal (`isPurchase`): updates `deal.pricePerKg`, `deal.totalCost`, and all `supplierLedgerEntries` for that deal

**6. Delete Manual Entry**
- `deleteManualLedgerEntry()` transaction:
  - Deletes the entry
  - Reverses profile totals (totalDebit, totalCredit, closingBalance)
  - If linked to a bank transaction: reverses the bank balance and deletes the bank transaction

**7. Drag & Drop Reorder**
- Uses `@dnd-kit/core` + `@dnd-kit/sortable`
- Reordering writes a new `createdAt` timestamp to control sort order
- New `date` is inferred from neighboring entries to keep date consistency
- Optimistic UI update with Firestore rollback on failure

**8. PDF Export**
- "Export PDF" button opens column-visibility options dialog:
  - Toggle: Voucher Type column
  - Toggle: Voucher Number column
  - Toggle: Rate/quantity details line (subParticulars)
  - Toggle: Reference label line (refLabel)
- Generates a professional PDF via `LedgerProfilePdf` (React PDF renderer)
- PDF header: Mill Name, Address/Description, Contact, entity name, date range
- PDF body: Full double-entry table with running balance column
- PDF footer: Total Debit, Total Credit, Closing Balance
- File saved as: `ledger_{EntityName}.pdf`

**9. PDF Heading Settings**
- Per-profile setting: Edit Mill Name and Sub-Heading for this specific profile's PDF header
- Global setting (from LedgerPage toolbar): Apply Mill Name, Address, Contact to ALL profiles at once via `updateAllLedgerProfilesSettings()`

### Ledger Profile Table

**Component:** [LedgerProfileTable.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/shared/LedgerProfileTable.tsx)

The core table rendering component:

| Column | Description |
|:---|:---|
| Date | Business transaction date |
| Particulars | Main description + optional subParticulars line |
| Ref Label | Reference code or document reference |
| Vch Type | Purchase / Sale / Payment / Receipt / Journal / Manual |
| Vch No | Voucher number (editable inline) |
| Debit | ₹ debit amount (editable inline for manual entries) |
| Credit | ₹ credit amount (editable inline for manual entries) |
| Balance | Running balance (cumulative debit - credit) |
| Actions | Delete (manual entries only), drag handle |

- **System-generated entries** (purchase confirmations, order confirmations): display-only
- **Manual entries**: fully editable debit/credit/particulars/date/vchNo
- **Running balance**: recalculated live across all visible entries
- **Color coding**: debit entries in warm tones, credit entries in cool tones

### Ledger Totals Footer

**Component:** [LedgerTotalsFooter.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/shared/LedgerTotalsFooter.tsx)

Shows aggregate row:
- Total Debit (₹)
- Total Credit (₹)
- Net Closing Balance (debit - credit)

### Manual Entry Form

**Component:** [ManualEntryForm.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/shared/ManualEntryForm.tsx)

Slide-out drawer form with fields:
- **Entry Kind**: Debit or Credit (radio/toggle)
- **Date**: HTML date picker
- **Particulars**: Main description text
- **Sub-Particulars**: Optional detail line
- **Rice Type**: Optional (from riceTypes dropdown)
- **Voucher Type**: Purchase / Payment / Receipt / Sale / Journal / Manual
- **Voucher Number**: Auto-suggested as max(existing) + 1
- **Amount**: ₹ value (positive only)
- **Quantity (kg)**: Optional — auto-generates rate string in subParticulars
- **Price Per Unit**: Optional — combined with quantity for display
- **Bank Account**: Optional dropdown — triggers fund movement
- **Record Fund Movement**: Toggle to control whether bank balance changes
- **Bank Movement Direction**: Credit (add money to bank) or Debit (withdraw from bank)

Validated with React Hook Form + `ManualLedgerEntryFormSchema` (Zod).

### Ledger Detail Page (COGS Breakdown)

**Route:** `/ledger/:orderId`  
**Component:** [LedgerDetailPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/LedgerDetailPage.tsx)

Shows full COGS breakdown for a single confirmed order:

**Customer Information Card:**
- Customer Name, Order Date, Status, Confirmed At

**Allocation Breakdown Table:**
| Column | Description |
|:---|:---|
| Supplier | Source supplier name |
| Product Code | e.g. "LS-001" |
| Rice Type | e.g. "Lal Shonno" |
| Bag Size | 50kg / 60kg / 1 Quintal / 1 Tonne |
| Bags | Number of bags |
| Weight | Total kg for this line |
| Purchase Price | ₹/kg (COGS rate) |
| Selling Price | ₹/kg (selling rate) |
| COGS | Total purchase cost (red) |
| Revenue | Total selling revenue (green) |
| Profit | Net profit per line (indigo) |

**Financial Summary Card:**
- Volume Sold (Quintal + kg)
- Average Selling Price (₹/Quintal)
- Gross Revenue
- Cost of Goods Sold (-)
- **Net Profit** (highlighted)

**Invoice Download:**
- `PDFDownloadLink` from `@react-pdf/renderer`
- Renders `InvoicePDF` component client-side
- Downloads as `Invoice_{orderId}.pdf`

### Salary Ledger Tab

**Component:** `SalaryLedgerTab.tsx`

- Log of all salary disbursements from `salaryTransactions` collection
- Filterable by employee and date range
- Shows: employee name, date, amount, payment type (monthly/daily), days worked

### Service Layer: ledgerProfileService.ts

Key functions in [ledgerProfileService.ts](file:///c:/dev/ERP/rice-erp/src/services/ledgerProfileService.ts):

| Function | Description |
|:---|:---|
| `getLedgerProfile(entityId)` | Fetch profile by supplier/customer ID |
| `getLedgerProfilesByType(type)` | Fetch all profiles for "supplier" or "customer" |
| `getLedgerEntries(profileId, from?, to?)` | Fetch + sort entries with optional date filter |
| `addManualLedgerEntry(...)` | Add manual entry + update profile totals + optional bank movement |
| `postPaymentVoucherEntry(...)` | Add payment voucher entry (supplier: credit, customer: debit) |
| `deleteManualLedgerEntry(profileId, entry)` | Delete entry + reverse profile totals + reverse bank transaction |
| `updateLedgerEntryVchNo(profileId, entryId, newVchNo)` | Update voucher number only |
| `updateLedgerEntry(profileId, entryId, updates)` | Update non-financial fields (date, particulars, etc.) |
| `updateLedgerEntryAmount(profileId, entryId, newDebit, newCredit)` | Atomic amount edit with cascade to deal and supplier ledger |
| `updateLedgerProfileSettings(profileId, settings)` | Update per-profile PDF heading (mill name + description) |
| `updateAllLedgerProfilesSettings(settings)` | Apply PDF heading to ALL profiles (Promise.all batch update) |
| `reorderLedgerEntry(profileId, entryId, newCreatedAtMillis, newDateMillis?)` | Update sort timestamp for drag-and-drop reordering |

---

## Inventory Module

**Route:** `/inventory`  
**Entry Point:** [InventoryPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/InventoryPage.tsx)

### Features:

- **Per-Deal Stock Cards** — One card per deal showing:
  - Supplier name + rice type
  - Product code badge
  - **Raw Stock**: Remaining loose grain (kg) with progress bar
  - **Packed Stock**: Total bags available per division (50kg, 60kg, etc.)
  - **Sold**: Total sold kg
  - Stock ratio bar: Raw vs. Packed vs. Sold as percentage fill
  - Status chip: `in_stock` / `partial` / `exhausted`

- **Bag Division Breakdown** — per card shows available bags by size with available count

- **Filter Controls** — filter by rice type, supplier, status

- **Summary Stats** — top-of-page aggregates:
  - Total Raw Stock (kg)
  - Total Packed Bags (by size)
  - Total Sold (kg)

---

## Wages & Payroll Module

**Route:** `/wages`

### Features:

- **Employee Registry**:
  - Add/edit employees with: name, type (`monthly` / `daily`), base salary
  - View employee list with contact info

- **Wage Disbursement**:
  - Log payment per employee: amount, date, days worked (for daily workers), payment method
  - Writes to `salaryTransactions` collection
  - Optionally deducts from linked bank account

- **Payroll Summary**:
  - Total wages paid per month
  - Per-employee payment history

---

## Balance Sheet & P&L Module

**Route:** `/balance-pnl`  
**Service:** [balanceSheetAggregation.ts](file:///c:/dev/ERP/rice-erp/src/services/balanceSheetAggregation.ts)

### Aggregated Financial Metrics (System-Computed)

| Metric | Source | Calculation |
|:---|:---|:---|
| **Closing Stock** | `inventory` collection | Sum of `(remainingRawKg + remainingPackedKg) × pricePerKg` per non-exhausted batch |
| **Sundry Debtors** | `ledgerProfiles` (supplier) | Sum of `closingBalance` for all supplier profiles |
| **Sundry Creditors** | `ledgerProfiles` (customer) | Negative sum of `closingBalance` for all customer profiles |
| **Cash in Hand** | `ledgerProfiles` (customer) | Sum of `totalDebit` for all customer profiles |
| **Bank Accounts** | `banks` collection | Live `principalAmount` per bank account |
| **Sales Revenue** | `orders` (confirmed/delivered) | Sum of `totalRevenue` |
| **COGS** | `orders` (confirmed/delivered) | Sum of `totalCostOfGoods` |
| **Operating Expenses** | `salaryTransactions` | Sum of `grossAmount` (or `amount`) |
| **Total Purchases** | `deals` collection | Sum of `totalCost` |
| **Output GST** | Derived | `salesRevenue × 5%` |
| **Input GST** | Derived | `totalPurchases × 5%` |

### Balance Sheet Structure

```
LIABILITIES (Left)              ASSETS (Right)
─────────────────────────────   ────────────────────────────
Capital Account                 Fixed Assets
Current Liabilities:            Loans & Liability
  - Duties & Taxes              Current Assets:
  - Provisions                    - Closing Stock
  - Sundry Creditors              - Deposits
Suspense A/C                      - Loans & Advances
Difference in Opening Bal.        - Sundry Debtors
                                   - Cash in Hand
                                   - Bank Accounts
                                Profit & Loss A/C
```

- All system-computed line items are **read-only** in the UI
- Users can add **manual line items** to any group (stored in `balanceSheetManualEntries`)
- Manual entries support: label, amount (positive or negative for contra entries)

### P&L Statement

```
INCOME                          EXPENSES
─────────────────────────────   ────────────────────────────
Sales Revenue                   Cost of Goods Sold (COGS)
                                Operating Expenses (Wages)
                                Output GST
                                Input GST
```

Net Profit = Sales Revenue − COGS − Operating Expenses

---

## Executive Dashboard

**Route:** `/` (root)  
**Component:** [DashboardPage.tsx](file:///c:/dev/ERP/rice-erp/src/components/dashboard/DashboardPage.tsx)

### KPI Cards

| Card | Metric |
|:---|:---|
| Total Revenue | Sum of all confirmed order revenues |
| Net Profit | Sum of all confirmed order profits |
| Staged Stock | Total available bags (packed, unsold) |
| Raw Stock | Total loose grain remaining (kg) |

### Revenue vs. Profit Chart

- Dual-line spline chart using Recharts
- X-axis: dates of confirmed orders
- Line 1: Revenue per day (blue)
- Line 2: Profit per day (emerald)
- Interactive: hover tooltip shows exact values

### Recent Activity Panel

- Lists the 5 most recent confirmed orders
- Customer name, date, revenue
- Direct "View →" link to `/ledger/{orderId}` COGS detail

---

## PDF Generation

### Invoice PDF

**Template:** [InvoicePDF.tsx](file:///c:/dev/ERP/rice-erp/src/components/pdf/InvoicePDF.tsx)

Generated on the `LedgerDetailPage`. Contains:
- Business/Mill header
- Customer details
- Order date, order ID
- Line-item table: Supplier → Product → Bag Size → Bags → Weight → Purchase Price → Selling Price → Revenue
- Totals: COGS, Revenue, Net Profit
- Styled with `@react-pdf/renderer` StyleSheet

### Ledger Statement PDF

**Template:** [LedgerProfilePdf.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/shared/pdf/LedgerProfilePdf.tsx)

Generated from `LedgerProfileDetail`. Contains:
- Mill/business name and address header
- Entity name and account type
- Date range (From → To)
- Full double-entry ledger table with configurable columns:
  - Date, Particulars, Sub-Particulars (optional), Ref Label (optional), Vch Type (optional), Vch No (optional), Debit, Credit, Balance
- Totals footer: Total Dr | Total Cr | Closing Balance
- Units converted per `activeLedgerUnit` (kg / Quintal / Tonne)

---

## State Management Architecture

### authStore

**File:** [authStore.ts](file:///c:/dev/ERP/rice-erp/src/stores/authStore.ts)

```typescript
interface AuthStore {
  user: AppUser | null;
  loading: boolean;
  role: "superadmin" | "admin" | null;
  status: "pending" | "active" | "removed" | null;
  setUser(user): void;
  clearUser(): void;
}
```

### uiStore

**File:** [uiStore.ts](file:///c:/dev/ERP/rice-erp/src/stores/uiStore.ts)

```typescript
interface UiStore {
  confirmDialog: { title, message, resolve } | null;
  requestConfirm(title, message): Promise<boolean>;  // Awaitable confirm dialog
  resolveConfirm(result: boolean): void;
}
```

### useLedgerStore

**File:** [useLedgerStore.ts](file:///c:/dev/ERP/rice-erp/src/stores/useLedgerStore.ts)

```typescript
interface LedgerStore {
  suppliers: LedgerProfile[];          // All supplier ledger profiles
  customers: LedgerProfile[];          // All customer ledger profiles
  activeProfileEntries: LedgerEntry[]; // Real-time entries for the open profile
  
  fetchSuppliersData(force?): void;
  fetchCustomersData(force?): void;
  subscribeToProfileEntries(profileId): void; // Sets up onSnapshot listener
  updateProfileInStore(type, entityId, patch): void; // Optimistic update
}
```

---

## Service Layer Reference

| Service File | Functions | Description |
|:---|:---|:---|
| [dealService.ts](file:///c:/dev/ERP/rice-erp/src/services/dealService.ts) | `getAllDeals`, `createDeal`, `confirmDelivery`, `deleteDeal`, `createBagDivisions`, `confirmBagDivisions`, `deleteBagDivision`, `subscribeToBagDivisions` | All deal and bag division operations |
| [orderService.ts](file:///c:/dev/ERP/rice-erp/src/services/orderService.ts) | `getAllOrders`, `createOrderWithAllocations`, `confirmOrder`, `deleteOrder` | Full order lifecycle |
| [ledgerProfileService.ts](file:///c:/dev/ERP/rice-erp/src/services/ledgerProfileService.ts) | `getLedgerProfile`, `getLedgerProfilesByType`, `getLedgerEntries`, `addManualLedgerEntry`, `postPaymentVoucherEntry`, `deleteManualLedgerEntry`, `updateLedgerEntry`, `updateLedgerEntryAmount`, `reorderLedgerEntry`, `updateLedgerProfileSettings`, `updateAllLedgerProfilesSettings` | Complete ledger management |
| [ledgerService.ts](file:///c:/dev/ERP/rice-erp/src/services/ledgerService.ts) | `getLedgerForOrder` | Fetches order + allocations for COGS detail page |
| [balanceSheetAggregation.ts](file:///c:/dev/ERP/rice-erp/src/services/balanceSheetAggregation.ts) | `getAggregatedFinancials`, `getClosingStockValue`, `getSundryDebtorsValue`, `getSundryCreditorsValue`, `getCashInHandValue`, `getBankAccountsData`, `getSalesRevenueValue`, `getCostOfGoodsSoldValue`, `getOperatingExpensesValue`, `getTotalPurchasesValue`, `addBalanceSheetManualEntry`, `updateBalanceSheetManualEntry`, `deleteBalanceSheetManualEntry` | All balance sheet computations |
| [supplierService.ts](file:///c:/dev/ERP/rice-erp/src/services/supplierService.ts) | `getAllSuppliers`, `addSupplier`, `updateSupplier` | Supplier CRUD |
| [customerService.ts](file:///c:/dev/ERP/rice-erp/src/services/customerService.ts) | `getAllCustomers`, `addCustomer`, `updateCustomer` | Customer CRUD |
| [inventoryService.ts](file:///c:/dev/ERP/rice-erp/src/services/inventoryService.ts) | `getAllInventory`, `getInventoryForDeal` | Inventory reads |
| [employeeService.ts](file:///c:/dev/ERP/rice-erp/src/services/employeeService.ts) | `getAllEmployees`, `addEmployee`, `logSalaryPayment` | Employee + payroll |
| [riceTypeService.ts](file:///c:/dev/ERP/rice-erp/src/services/riceTypeService.ts) | `getAllRiceTypes`, `addRiceType`, `updateRiceType` | Rice variety catalog |
| [userService.ts](file:///c:/dev/ERP/rice-erp/src/services/userService.ts) | `getAllUsers`, `updateUserStatus`, `updateUserRole` | User management (SuperAdmin) |

---

## File & Symbol Reference Index

### Pages

| File | Route | Description |
|:---|:---|:---|
| [DashboardPage.tsx](file:///c:/dev/ERP/rice-erp/src/components/dashboard/DashboardPage.tsx) | `/` | KPIs, Revenue vs. Profit chart, Recent Activity |
| [DealsPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/DealsPage.tsx) | `/deals` | Three-tab trading hub |
| [InventoryPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/InventoryPage.tsx) | `/inventory` | Visual stock meters per deal |
| [LedgerPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/LedgerPage.tsx) | `/ledger` | Three-tab general ledger |
| [LedgerDetailPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/LedgerDetailPage.tsx) | `/ledger/:orderId` | COGS breakdown + Invoice download |
| [WagesPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/WagesPage.tsx) | `/wages` | Employee registry + payroll |
| [BalancePnLPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/BalancePnLPage.tsx) | `/balance-pnl` | Balance Sheet + P&L statement |

### Critical Components

| Component | Location | Purpose |
|:---|:---|:---|
| `AuthProvider` | `components/auth/` | Firebase auth listener + route gating |
| `AppLayout` | `components/layout/` | Sidebar + main shell |
| `ProtectedRoute` | `components/layout/` | Auth guard for all `/app/*` routes |
| `SuperAdminRoute` | `components/layout/` | Role guard for `/admin/*` routes |
| `LedgerProfileDetail` | `components/ledger/shared/` | Full double-entry ledger per entity |
| `LedgerProfileTable` | `components/ledger/shared/` | Sortable, editable ledger rows |
| `ManualEntryForm` | `components/ledger/shared/` | Add manual debit/credit entry drawer |
| `SupplierBagSelector` | `components/deals/sold/` | Advanced bag picker for orders |
| `AddDealModal` | `components/deals/bought/` | Full purchase deal creation |
| `BagDivisionModal` | `components/deals/bought/` | Bag division creation + confirmation |
| `InvoicePDF` | `components/pdf/` | Customer invoice PDF template |
| `LedgerProfilePdf` | `components/ledger/shared/pdf/` | Ledger statement PDF template |

---

*Generated from source code analysis of `c:/dev/ERP/rice-erp/` on 2026-08-29.*
