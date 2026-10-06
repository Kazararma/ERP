# 🌾 Rice Merchant ERP — Master Technical Summary

> A production-grade, cloud-native Enterprise Resource Planning system custom-built for **Rice Mills, Traders, and Grain Merchants**. The system manages the complete operational lifecycle — raw grain procurement, milling/bag division, customer order fulfillment, inventory tracking, payroll, and financial accounting — with full real-time Firestore synchronisation and atomic transactional integrity throughout.

---

## 📁 Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Architecture & Directory Structure](#3-project-architecture--directory-structure)
4. [Authentication, Authorization & Roles](#4-authentication-authorization--roles)
5. [Database Schema & Data Models](#5-database-schema--data-models)
6. [Core Business Logic & Atomic Transactions](#6-core-business-logic--atomic-transactions)
7. [Deals Module](#7-deals-module)
8. [📒 Ledger Module — Deep Dive (Primary Focus)](#8--ledger-module--deep-dive-primary-focus)
   - 8.1 [Module Overview & Route Structure](#81-module-overview--route-structure)
   - 8.2 [Ledger Data Model](#82-ledger-data-model)
   - 8.3 [Customer Ledger Tab](#83-customer-ledger-tab)
   - 8.4 [Supplier Ledger Tab](#84-supplier-ledger-tab)
   - 8.5 [Miscellaneous Ledger Tab](#85-miscellaneous-ledger-tab)
   - 8.6 [Salary Ledger Tab](#86-salary-ledger-tab)
   - 8.7 [LedgerProfileDetail — The Core Component](#87-ledgerprofiledetail--the-core-component)
   - 8.8 [LedgerProfileTable — Sortable & Editable Rows](#88-ledgerprofiletable--sortable--editable-rows)
   - 8.9 [ManualEntryForm — Drawer Form](#89-manualentryform--drawer-form)
   - 8.10 [LedgerTotalsFooter — Running Totals](#810-ledgertotalsfooter--running-totals)
   - 8.11 [Ledger PDF Export System](#811-ledger-pdf-export-system)
   - 8.12 [Ledger Detail Page (COGS Breakdown)](#812-ledger-detail-page-cogs-breakdown)
   - 8.13 [Payment Voucher System](#813-payment-voucher-system)
   - 8.14 [ledgerProfileService — Complete Service API](#814-ledgerprofileservice--complete-service-api)
   - 8.15 [useLedgerStore — Global State](#815-usledgerstore--global-state)
   - 8.16 [Double-Entry Accounting Convention](#816-double-entry-accounting-convention)
   - 8.17 [Ledger Security Rules](#817-ledger-security-rules)
   - 8.18 [Ledger Unit Conversion System](#818-ledger-unit-conversion-system)
   - 8.19 [Auto-Entry Triggers (System-Generated Entries)](#819-auto-entry-triggers-system-generated-entries)
   - 8.20 [Drag & Drop Reorder Logic](#820-drag--drop-reorder-logic)
9. [Inventory Module](#9-inventory-module)
10. [Wages & Payroll Module](#10-wages--payroll-module)
11. [Balance Sheet & P&L Module](#11-balance-sheet--pl-module)
12. [Executive Dashboard](#12-executive-dashboard)
13. [PDF Generation System](#13-pdf-generation-system)
14. [State Management Architecture](#14-state-management-architecture)
15. [Service Layer Complete Reference](#15-service-layer-complete-reference)
16. [Firestore Security Rules](#16-firestore-security-rules)
17. [File & Symbol Reference Index](#17-file--symbol-reference-index)

---

## 1. System Overview

Rice ERP is a full-stack SaaS web application targeting:
- **Rice Mills** — tracking raw grain procurement, milling stages, and bag creation
- **Traders** — managing multi-supplier purchasing and multi-customer sales
- **Business Owners** — requiring accurate P&L, ledger statements, balance sheets, and professional invoice generation

### Core Data Flow

```
Supplier → Deal (Purchase) → Bag Division (Milling) → Order (Sale) → Customer Ledger → Invoice PDF
                 ↓                      ↓                  ↓
         Supplier Ledger         Inventory Update   Customer Ledger Entry
```

Every operational step produces an **atomic Firestore transaction** that cascades into:
- Inventory state (bag counts, raw/packed/sold totals)
- Ledger profile entries (double-entry debit/credit rows)
- Ledger profile aggregates (`totalDebit`, `totalCredit`, `closingBalance`)
- BagDivision availability counters

---

## 2. Technology Stack

### Frontend

| Layer | Technology | Version | Purpose |
|:---|:---|:---|:---|
| **Core Framework** | React | ^18 | Component-driven UI with concurrent rendering |
| **Language** | TypeScript | ^5 | Strict compile-time type safety across all business models |
| **Build Tool** | Vite | ^8 | Fast bundling, HMR, path alias support (`@/`) |
| **Routing** | React Router DOM | ^7 | Client-side routing with nested route guards |
| **Styling** | Tailwind CSS | ^3.4 | Utility-first responsive design with custom animation tokens |
| **Component Library** | Shadcn/ui + Base UI | latest | Pre-built accessible primitives (Dialog, Tabs, Sheet, Select, etc.) |
| **State Management** | Zustand | ^5 | Lightweight global stores (auth, UI, ledger data) |
| **Charts** | Recharts | ^3 | Interactive revenue vs. profit trendlines on dashboard |
| **Form Handling** | React Hook Form | ^7 | Performant uncontrolled form state management |
| **Validation** | Zod | ^4 | Schema definitions and runtime validation for all forms and data models |
| **PDF Generation** | @react-pdf/renderer | ^4 | Client-side PDF rendering for invoices and ledger statements |
| **File Download** | file-saver | ^2 | Browser-triggered PDF save via `saveAs()` |
| **Drag & Drop** | @dnd-kit/core + @dnd-kit/sortable | ^6/^10 | Reorder ledger entries via drag and drop |
| **Dates** | date-fns | ^4 | Date formatting, parsing and comparison logic |
| **Bengali Calendar** | bengali-calendar | ^8 | Regional date display support for Bengali locale |
| **Notifications** | react-hot-toast + sonner | latest | Success/error toast notifications throughout the app |
| **Icons** | lucide-react | ^1 | Consistent SVG icon set |
| **Theme** | next-themes | ^0.4 | Light/dark mode switching support |

### Backend & Infrastructure

| Layer | Technology | Version | Purpose |
|:---|:---|:---|:---|
| **Database** | Firebase Firestore | ^12 | Real-time NoSQL document DB with multi-document transaction isolation |
| **Authentication** | Firebase Auth | ^12 | Google Sign-In with pending → active admin approval workflow |
| **Hosting** | Firebase Hosting | — | Static site deployment with CDN |
| **Security** | Firestore Security Rules | — | Server-enforced role-based data access control |

### Dev Tooling

| Tool | Purpose |
|:---|:---|
| ESLint | Linting with `--max-warnings 0` strictness |
| PostCSS + Autoprefixer | CSS processing pipeline for Tailwind |
| `tsconfig.json` | Strict TypeScript with `@/` path alias |
| `vite.config.mts` | Vite bundler config with React plugin |
| `tailwind.config.ts` | Design system (colors, fonts, custom animations) |
| `firestore.indexes.json` | Composite index definitions for complex queries |

---

## 3. Project Architecture & Directory Structure

```
c:/dev/ERP/rice-erp/
├── .env.local                          # Firebase credentials (not committed to VCS)
├── .firebaserc                         # Firebase project alias config
├── firebase.json                       # Firebase hosting & Firestore emulator config
├── firestore.rules                     # Firestore security rules (role-based access)
├── firestore.indexes.json              # Composite index definitions for Firestore queries
├── package.json                        # Dependency manifest & npm scripts
├── tailwind.config.ts                  # Design system tokens (colors, fonts, animations)
├── vite.config.mts                     # Vite bundler configuration
├── tsconfig.json                       # TypeScript compiler options (strict + path aliases)
└── src/
    ├── App.tsx                         # Root router — defines ALL client-side routes
    ├── main.tsx                        # Application entry point (ReactDOM.createRoot)
    ├── globals.css                     # Base styles, Google Fonts import, scrollbar overrides
    ├── lib/
    │   ├── firebase.ts                 # Firebase app initialization (db, auth exports)
    │   ├── ledgerUnitConversion.ts     # Kg ↔ Quintal ↔ Tonne display unit conversion
    │   └── utils.ts                    # clsx/tailwind-merge helper (cn())
    ├── types/
    │   ├── deal.ts                     # Deal, Supplier, BagDivision, DealDiscount interfaces
    │   ├── order.ts                    # Order, Customer, OrderAllocation interfaces
    │   ├── inventory.ts                # Inventory, InventoryDivisionSnapshot interfaces
    │   ├── ledger.ts                   # SupplierLedgerEntry (legacy flat collection)
    │   ├── ledger-profile.ts           # LedgerProfile, LedgerEntry, VchType enums (Zod)
    │   ├── balanceSheet.ts             # BalanceLineItem, BalanceSheetGroup, AggregatedFinancials
    │   ├── riceTypes.ts                # RiceType, BagSize, Product, BAG_WEIGHT_KG map
    │   ├── employee.ts                 # Employee interface
    │   ├── salaryTransaction.ts        # SalaryTransaction interface
    │   ├── bank.ts                     # Bank interface
    │   ├── dealLog.ts                  # DealLog interface
    │   ├── miscellaneous.ts            # MiscellaneousProfile interface
    │   └── index.ts                    # Re-exports all public types
    ├── stores/
    │   ├── authStore.ts                # Auth state (user, loading, role, status)
    │   ├── uiStore.ts                  # Modal state + requestConfirm() awaitable dialog
    │   └── useLedgerStore.ts           # Supplier/Customer/Misc profile lists, real-time sync
    ├── hooks/
    │   └── useSupplierLedger.ts        # Hook: fetches SupplierLedgerEntry[] for one supplier
    ├── services/
    │   ├── dealService.ts              # Deal CRUD + BagDivision creation/confirmation
    │   ├── orderService.ts             # Order creation + confirmation transaction
    │   ├── ledgerProfileService.ts     # LedgerProfile CRUD + LedgerEntry management (21KB)
    │   ├── ledgerService.ts            # getLedgerForOrder() — COGS + Invoice data fetch
    │   ├── supplierLedgerService.ts    # Legacy flat supplierLedgerEntries operations
    │   ├── bulkLedgerService.ts        # Bulk ledger operations across multiple profiles
    │   ├── inventoryService.ts         # Inventory reads and status updates
    │   ├── balanceSheetAggregation.ts  # Firestore aggregation for Balance Sheet & P&L
    │   ├── balanceSheetBreakdown.ts    # Detailed breakdown rows for Balance Sheet groups
    │   ├── customerService.ts          # Customer CRUD
    │   ├── supplierService.ts          # Supplier CRUD
    │   ├── riceTypeService.ts          # RiceType CRUD (SuperAdmin only)
    │   ├── employeeService.ts          # Employee registry and salary transaction logs
    │   ├── userService.ts              # User management (status, role updates — SuperAdmin)
    │   ├── miscellaneousService.ts     # Miscellaneous entity CRUD
    │   ├── bagDivisionService.ts       # Thin wrapper for bag division reads
    │   ├── dealLogService.ts           # Deal log event writing
    │   └── migrationService.ts         # One-time data migration scripts
    ├── schemas/
    │   └── (Zod schemas for forms — payment voucher, etc.)
    ├── constants/
    │   └── dealLabels.ts               # Configurable labels like "Bought"/"Sold" display text
    ├── utils/
    │   └── (Shared utility functions)
    └── components/
        ├── admin/                      # SuperAdmin user management panel
        ├── auth/
        │   └── AuthProvider.tsx        # Firebase auth listener + pending state redirect
        ├── layout/
        │   ├── AppLayout.tsx           # Shell: Sidebar + main content area
        │   ├── Sidebar.tsx             # Navigation links, user avatar, sign-out button
        │   ├── ProtectedRoute.tsx      # Redirects unauthenticated/pending/removed users
        │   └── SuperAdminRoute.tsx     # Restricts routes to superadmin role only
        ├── dashboard/
        │   └── DashboardPage.tsx       # KPI cards + revenue/profit trendline chart
        ├── deals/                      # Bought, Sold, Staging sub-tabs
        ├── ledger/                     # ← PRIMARY FOCUS OF THIS DOCUMENT
        │   ├── customer/
        │   │   ├── CustomerLedgerTab.tsx
        │   │   └── profiles/
        │   │       └── CustomerProfilesTab.tsx
        │   ├── supplier/
        │   │   ├── SupplierLedgerTab.tsx
        │   │   ├── SupplierLedgerDetail.tsx
        │   │   └── profiles/
        │   │       └── SupplierProfilesTab.tsx
        │   ├── salary/
        │   │   └── SalaryLedgerTab.tsx
        │   ├── miscellaneous/          # Miscellaneous entity ledger tab
        │   └── shared/
        │       ├── LedgerProfileDetail.tsx   # Full double-entry ledger view per entity
        │       ├── LedgerProfileTable.tsx    # Sortable, editable ledger rows (DnD)
        │       ├── LedgerTotalsFooter.tsx    # Running totals footer row
        │       ├── ManualEntryForm.tsx       # Drawer form: add manual debit/credit entry
        │       └── pdf/
        │           └── LedgerProfilePdf.tsx  # @react-pdf template for ledger statements
        ├── inventory/
        ├── pdf/
        │   └── InvoicePDF.tsx               # @react-pdf template for sales invoices
        ├── wages/
        └── ui/                              # Shadcn/ui primitives
```

---

## 4. Authentication, Authorization & Roles

The app uses a **three-tier user lifecycle** enforced on both the client (React Router guards) and the server (Firestore Security Rules).

### User Lifecycle

```
New Google Sign-In
      │
      ▼
  status: "pending"
  (locked to /pending waiting room — NO database read/write access)
      │
      ▼ (SuperAdmin manually approves)
  ┌────────────────────────────────┐
  │ status: "active"               │  ←── Full operational access
  │ role: "admin" | "superadmin"   │
  └────────────────────────────────┘
      │
      ▼ (SuperAdmin suspends)
  status: "removed"
  (suspended — all database permissions stripped)
```

### Roles & Permissions

| Role | Permissions |
|:---|:---|
| **admin** | Full access to all operational modules: deals, inventory, ledger, wages, balance sheet |
| **superadmin** | All admin permissions + User Management panel at `/admin/users` (approve/suspend/promote users) + RiceType management |

### Route Guards

- **[ProtectedRoute.tsx](file:///c:/dev/ERP/rice-erp/src/components/layout/ProtectedRoute.tsx)** — Redirects unauthenticated or `pending`/`removed` users to login or waiting page
- **[SuperAdminRoute.tsx](file:///c:/dev/ERP/rice-erp/src/components/layout/SuperAdminRoute.tsx)** — Restricts specific routes to `superadmin` role only

### Auth Store

Managed by Zustand in [authStore.ts](file:///c:/dev/ERP/rice-erp/src/stores/authStore.ts):

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

---

## 5. Database Schema & Data Models

### Firestore Collections Overview

| Collection | Description | Size/Scale |
|:---|:---|:---|
| `users` | User auth profiles with role + status | One per registered user |
| `suppliers` | Raw material supplier directory | Hundreds of records |
| `customers` | Client/buyer directory | Hundreds of records |
| `riceTypes` | Master rice variety catalog | ~10 seeded types |
| `deals` | Purchase contracts from suppliers | Grows over time |
| `deals/{id}/bagDivisions` | Subcollection: milling batches per deal | Multiple per deal |
| `orders` | Customer sales orders | Grows over time |
| `orders/{id}/allocations` | Subcollection: per-deal bag allocations | Multiple per order |
| `inventory` | One doc per deal: consolidated raw/packed/sold stock | 1:1 with deals |
| `ledgerProfiles` | One profile per supplier, customer, or miscellaneous entity | One per entity |
| `ledgerProfiles/{id}/entries` | Subcollection: individual double-entry ledger rows | Many per profile |
| `supplierLedgerEntries` | Legacy flat collection for supplier event log | Being phased out |
| `employees` | Employee registry | Tens of records |
| `salaryTransactions` | Wage disbursement records | Grows over time |
| `banks` | Bank account records | Few records |
| `banks/{id}/transactions` | Per-bank debit/credit transaction history | Grows over time |
| `balanceSheetManualEntries` | Manual overrides for balance sheet line items | Few records |

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
// Customer uses same shape with customerId instead of supplierId
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
  supplierName: string;             // Denormalized for fast display
  product: Product;                 // Embedded: productCode, productName, riceTypeId, riceTypeName
  grossAmountKg?: number;           // Raw total before tare deduction
  weightDeductionKg?: number;       // Tare/deduction from gross weight
  totalAmountKg: number;            // Net grain (grossAmountKg - weightDeductionKg)
  remainingAmountKg: number;        // Net kg not yet divided into bag batches
  pricePerKg: number;               // Purchase price — feeds COGS calculation at order confirmation
  grossCost?: number;               // totalAmountKg × pricePerKg (before discount)
  totalCost: number;                // NET cost after any discount
  discount?: DealDiscount | null;   // Optional quantity discount structure
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
  discountKg: number;               // Volume of rice included in discount
  discountRatePerKg: number;        // Rate applied to discounted kg
  discountValue: number;            // discountKg × discountRatePerKg
}

interface Product {
  productCode: string;    // User-defined code per deal, e.g. "LS-001"
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

> **Design note:** No price is stored on `BagDivision`. The `Deal.pricePerKg` is always read at order confirmation time to ensure COGS accuracy.

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
  supplierId: string;           // Denormalized for display
  supplierName: string;
  divisionId: string;           // References the BagDivision used
  product: Product;             // Snapshot at allocation time
  bagSize: BagSize;
  bagWeightKg: number;
  numberOfBags: number;
  weightKg: number;             // numberOfBags × bagWeightKg
  purchasePricePerKg: number;   // Copied from Deal.pricePerKg at allocation time (COGS)
  totalCost: number;            // weightKg × purchasePricePerKg
  sellingPricePerKg: number;    // Selling price for this specific bag size
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
  totalBoughtKg: number;        // Total net purchased in this deal
  totalDividedKg: number;       // Total moved to confirmed bag divisions
  totalSoldKg: number;          // Total sold via confirmed orders
  remainingRawKg: number;       // Loose grain not yet divided
  remainingPackedKg: number;    // Bags available (divided but unsold)
  divisionBreakdown: {          // Per-division snapshot for fast UI reads
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

## 6. Core Business Logic & Atomic Transactions

All inventory-altering and ledger-altering operations use **Firestore `runTransaction()`** to guarantee atomicity under concurrent access.

### Transaction A: Create Deal (Batch Write)

**Trigger:** User submits the Add Deal form.

```
1. Calculate net amounts:
   netAmountKg = grossAmountKg - weightDeductionKg
   grossCost = netAmountKg × pricePerKg
   discountValue = discountKg × discountRatePerKg  (if enabled)
   totalCost = grossCost - discountValue

2. Batch write (3 atomic writes):
   → deals/{dealId}             — New deal (status: "pending_delivery")
   → inventory/{dealId}         — New inventory record (remainingRawKg = netAmountKg)
   → supplierLedgerEntries/{}   — Legacy ledger event (eventType: "purchase_created")
```

### Transaction B: Confirm Delivery

**Trigger:** User clicks "Confirm Delivery" on a DealCard.

```
runTransaction:
  1. Read deal → verify not already confirmed
  2. Update deal: deliveryConfirmed=true, deliveryDate=now, status="delivered"
  3. Write LedgerEntry to ledgerProfiles/{profileId}/entries:
       vchType: "Purchase", entryType: "delivery_confirmed"
       debit: deal.totalCost, credit: 0
       particulars: "{riceTypeName} Purchase"
       subParticulars: "{kg} kg @ ₹{rate}/kg | Discount info..."
  4. Update LedgerProfile aggregate (atomic increment):
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

### Transaction D: Create Order (Batch Write)

**Trigger:** User submits OrderFormModal.

```
writeBatch:
  1. Create orders/{orderId} (status: "draft")
  2. For each allocation:
     → Calculate revenue = weightKg × sellingPricePerKg
     → Calculate profit = revenue - totalCost (COGS)
     → Create orders/{orderId}/allocations/{allocId}
  3. Update order with aggregated totals: totalRevenue, totalCostOfGoods, profit
```

### Transaction E: Confirm Order ⚡ (Most Complex)

**Trigger:** User clicks "Confirm Order" on OrderCard.

```
runTransaction:
  ── ALL READS FIRST (Firestore rule: reads before writes) ──
  1. Read Order document
  2. Read all allocations (subcollection query — reads before transaction start)
  3. Read all referenced BagDivision documents
  4. Read all referenced Inventory documents

  ── COMPUTE ──
  5. For each allocation:
     → Validate BagDivision.availableBags >= allocation.numberOfBags
     → Compute new availableBags (subtract allocation.numberOfBags)
     → Compute new BagDivision status ("exhausted" if 0, "partial" otherwise)
     → Accumulate inventory deltas: remainingPackedKg-=, totalSoldKg+=

  ── ALL WRITES ──
  6. Update all BagDivisions (availableBags, status)
  7. Update all Inventory documents (remainingPackedKg, totalSoldKg, divisionBreakdown)
  8. Update Order: orderConfirmed=true, confirmedAt=now, status="confirmed"
  9. Write LedgerEntry to customer's ledger profile:
       vchType: "Sale", entryType: "order_confirmed"
       credit: totalRevenue, debit: 0
       particulars: "Sale to {customerName}"
  10. Update customer LedgerProfile:
        totalCredit += totalRevenue
        closingBalance -= totalRevenue
```

### Transaction F: Delete Deal (Atomic Cleanup)

**Trigger:** User deletes a deal (only if no bags have been sold from it).

```
Pre-validation (outside transaction):
  → Check all BagDivisions: availableBags === numberOfBags (none sold)

runTransaction:
  1. Read deal (consistency check)
  2. For each BagDivision: verify available = total (no concurrent sells)
  3. Reverse LedgerProfile totals:
     → totalDebit -= sumDebit; totalCredit -= sumCredit
  4. Delete all LedgerProfile entries linked to this dealId
  5. Delete all supplierLedgerEntries linked to this dealId
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
     → Delete LedgerEntry for this order (entryType: "order_confirmed")
     → Reverse LedgerProfile totals:
         totalCredit -= totalRevenue
         closingBalance += totalRevenue
  3. Delete all allocations
  4. Delete order
```

---

## 7. Deals Module

**Route:** `/deals`  
**Entry Point:** [DealsPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/DealsPage.tsx)

The Deals module is divided into three sub-tabs:

### Sub-Tab 1: Bought (Purchase Management)

**Component:** [BoughtTab.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/bought/BoughtTab.tsx)

- **Add Deal Modal** ([AddDealModal.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/bought/AddDealModal.tsx)) — Fields: Supplier, Rice Type, Product Code, Purchase Date, Gross Amount (kg), Weight Deduction (kg), Price/kg, Optional Discount (volume + rate). Live preview of Net Amount, Gross Cost, Discount Value, Net Total Cost. Validated with RHF + Zod.
- **Deal Card** ([DealCard.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/bought/DealCard.tsx)) — Per-deal display: supplier, rice type, product code, net kg, price/kg, total cost. Confirm Delivery, Bag Division, and Delete actions.
- **Bag Division Modal** ([BagDivisionModal.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/bought/BagDivisionModal.tsx)) — Select bag sizes (50kg, 60kg, 1 Quintal, 1 Tonne), enter number of bags per size, live weight validation against `deal.remainingAmountKg`.
- **Supplier Manager** ([SupplierManager.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/bought/SupplierManager.tsx)) — Add/view suppliers CRM panel.

### Sub-Tab 2: Staging (Bag Division View)

**Component:** [TabStaging.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/TabStaging.tsx)

- Lists all deals with active bag divisions
- Shows breakdown per division: bagSize, numberOfBags, availableBags, status chips (`draft`, `ready`, `partial`, `exhausted`)

### Sub-Tab 3: Sold (Sales Management)

**Component:** [SoldTab.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/sold/SoldTab.tsx)

- **Order Card** ([OrderCard.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/sold/OrderCard.tsx)) — Customer, date, total weight, revenue, profit with margin indicator. Confirm Order, Delete, View Ledger actions.
- **Order Form** ([OrderForm.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/sold/OrderForm.tsx)) — Select Customer, Order Date, Notes, then add line items.
- **Supplier Bag Selector** ([SupplierBagSelector.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/sold/SupplierBagSelector.tsx)) — Advanced multi-select UI showing available bags grouped by deal + division. Shows: supplier name, rice type, bag size, available count, purchase price/kg. Supports mixed-source orders. Per-line selling price entry. Live running total of revenue, COGS, and profit margin.
- **Customer Manager** ([CustomerManager.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/sold/CustomerManager.tsx)) — Add/view customers CRM panel.

---

## 8. 📒 Ledger Module — Deep Dive (Primary Focus)

The Ledger module is the **financial heart** of the Rice ERP. It provides a complete double-entry accounting system with per-entity profiles, real-time balance tracking, manual entry management, PDF statement export, and drag-and-drop row reordering.

---

### 8.1 Module Overview & Route Structure

**Primary Route:** `/ledger`  
**Entry Point:** [LedgerPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/LedgerPage.tsx)

```
/ledger                    → LedgerPage (four-tab shell)
├── Customer Ledger Tab    → All customer sales + customer profile ledgers
├── Supplier Ledger Tab    → All purchase events + supplier profile ledgers
├── Miscellaneous Tab      → Miscellaneous entity ledgers
└── Salary Ledger Tab      → Wage disbursement transaction log

/ledger/:orderId           → LedgerDetailPage (COGS breakdown + invoice download)
```

The LedgerPage toolbar contains a **global PDF settings action** — "Apply to All Profiles" — which pushes the current Mill Name, Address, and Contact number to every single `LedgerProfile` document in Firestore in one batch operation.

---

### 8.2 Ledger Data Model

#### `LedgerProfile` (one per entity)

Stored in `ledgerProfiles/{profileId}`. One profile is created atomically whenever a new Supplier, Customer, or Miscellaneous entity is created.

```typescript
// File: src/types/ledger-profile.ts
interface LedgerProfile {
  id: string;               // Firestore doc ID
  entityId: string;         // Supplier, Customer, or Miscellaneous ID
  entityType: "supplier" | "customer" | "miscellaneous";
  entityName: string;       // Denormalized name for display

  // PDF header fields
  millName: string;         // Business/mill name for PDF header
  millDescription: string;  // Address or description line for PDF
  millContact?: string;     // Contact number for PDF

  // Running aggregates (updated atomically via increment() on every entry)
  totalDebit: number;       // Sum of all debit entries
  totalCredit: number;      // Sum of all credit entries
  closingBalance: number;   // totalDebit - totalCredit
                            // Positive = entity owes us money (for suppliers)
                            // Negative = we owe entity money (for customers with credit)

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Profile Bootstrap Logic:**

When a new Supplier or Customer is created in their respective service, a `LedgerProfile` doc is created in the same Firestore batch/transaction using a deterministic ID convention: `"{entityType}_{entityId}"`. This ensures the profile is idempotent (creating it twice won't overwrite existing financial aggregates due to `{ merge: true }`).

```typescript
// In supplierService / customerService:
const profileRef = doc(db, "ledgerProfiles", `${entityType}_${entityId}`);
batch.set(profileRef, {
  id: profileRef.id,
  entityId,
  entityType,
  entityName: formData.name,
  millName: defaultMillName,
  millDescription: defaultMillDesc,
  totalDebit: 0,
  totalCredit: 0,
  closingBalance: 0,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
}, { merge: true });
```

---

#### `LedgerEntry` (individual accounting rows)

Stored in `ledgerProfiles/{profileId}/entries/{entryId}`. Each row represents one side of a double-entry accounting event.

```typescript
// File: src/types/ledger-profile.ts
interface LedgerEntry {
  id: string;                   // Firestore doc ID
  profileId: string;            // Parent LedgerProfile ID
  entityId: string;             // Supplier or Customer ID
  entityType: "supplier" | "customer" | "miscellaneous";

  date: Timestamp;              // Business date of the transaction (user-visible)
  particulars: string;          // Main description line (e.g. "Lal Shonno Purchase")
  subParticulars?: string;      // Detail line (e.g. "680 kg @ ₹45.00/kg")
  refLabel?: string;            // Reference label (e.g. "Code: LS-001")

  vchType: "Purchase" | "Payment" | "Receipt" | "Sale" | "Journal" | "Manual";
  vchNo: number;                // Voucher number for accounting reconciliation

  debit: number;                // ₹ amount (0 if credit entry)
  credit: number;               // ₹ amount (0 if debit entry)

  entryType: LedgerEntryType;   // See enum below
  isManual: boolean;            // True for user-created rows (can be edited/deleted)
  isSystemGenerated: boolean;   // True for auto-generated rows (immutable)

  relatedDocId?: string;        // Deal ID or Order ID that triggered this entry
  quantityKg?: number;          // Stock quantity involved (for rate recalculation)
  pricePerUnit?: number;        // ₹/kg or ₹/unit (auto-recalculated on amount edits)
  riceType?: string;            // Rice type name

  bankId?: string | null;       // Linked bank account (if fund movement involved)
  bankName?: string | null;     // Denormalized bank name

  createdAt: Timestamp;         // Sort key for ordering (mutable for DnD reorder)
  updatedAt: Timestamp;
}

// Entry type enum (controls which entries are hidden from display)
type LedgerEntryType =
  | "purchase_created"        // When a deal is created (legacy)
  | "delivery_confirmed"      // When supplier delivers grain → creates debit entry
  | "bags_divided"            // When bag divisions are confirmed (HIDDEN from UI display)
  | "bags_divided_reverted"   // When a division is deleted (HIDDEN from UI display)
  | "order_confirmed"         // When a customer order is confirmed → creates credit entry
  | "payment_received"        // Payment from customer (manual debit)
  | "payment_made"            // Payment to supplier (manual credit)
  | "manual_debit"            // Manual debit entry by user
  | "manual_credit";          // Manual credit entry by user
```

> **Important:** `bags_divided` and `bags_divided_reverted` entry types are **always filtered out** before displaying entries in the UI and PDF. They serve as internal event markers only.

---

### 8.3 Customer Ledger Tab

**Component:** [CustomerLedgerTab.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/customer/CustomerLedgerTab.tsx)

**Inner Tabs:**

**1. Transaction Events** — Filterable table of all confirmed orders:
- Columns: Date, Customer Name, Volume (kg), Revenue, Profit, Status
- Filter controls: Date range picker + customer name search
- Aggregate KPI cards at top:
  - **Total Revenue** — sum of all confirmed order revenues
  - **Total Profit** — sum of all confirmed order profits
  - **Total Volume** — total kg sold
- Per-row actions:
  - **Delete** → triggers `orderService.deleteOrder()` with full inventory + ledger reversal
  - **Details →** → navigates to `/ledger/{orderId}` for COGS breakdown and invoice download

**2. Ledger Profiles** — [CustomerProfilesTab.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/customer/profiles/CustomerProfilesTab.tsx)
- Lists all customer ledger profiles with:
  - Customer name, total debit, total credit, closing balance
  - Closing balance color-coded (green = credit balance, red = debit balance)
- Click a customer → opens full `LedgerProfileDetail` component

---

### 8.4 Supplier Ledger Tab

**Component:** [SupplierLedgerTab.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/supplier/SupplierLedgerTab.tsx)  
**Detail Component:** [SupplierLedgerDetail.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/supplier/SupplierLedgerDetail.tsx)

**KPI Cards (Legacy event-based):**
- **Total Spend** — sum of `totalValue` for `purchase_created` events
- **Total Kg Bought** — sum of `amountKg` for all purchase entries
- **Total Kg Sold** — sum of `totalWeightKg` for `allocation_deducted` events
- **Net Revenue (Gross)** — sum of `revenueFromSale` for sold allocations

**Transaction Table (Legacy):**
- Shows `purchase_created` events with expand-to-detail toggle
- Expanded row: Supplier Information card + Financial Summary card
- Delivery confirmed badge on purchase rows

**Inner Tabs:**

**1. Transaction Events** — Chronological purchase event log (legacy `supplierLedgerEntries`)

**2. Ledger Profiles** — [SupplierProfilesTab.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/supplier/profiles/SupplierProfilesTab.tsx)
- Lists all supplier ledger profiles with closing balance per supplier
- Click a supplier → opens full `LedgerProfileDetail` component

---

### 8.5 Miscellaneous Ledger Tab

For entities that are neither suppliers nor customers (e.g., utilities, brokers, misc. expenses). Uses the same `LedgerProfile` + `LedgerEntry` structure with `entityType: "miscellaneous"`.

- Managed by `miscellaneousService.ts`
- Profile created via `ensureLedgerProfile()` with `entityType: "miscellaneous"`
- All manual entries supported (no system-generated entries)

---

### 8.6 Salary Ledger Tab

**Component:** `SalaryLedgerTab.tsx`

- Reads from `salaryTransactions` collection
- Filterable by employee name and date range
- Table columns: Employee Name, Date, Amount, Payment Type (monthly/daily), Days Worked, Payment Method
- Does not use the `LedgerProfile` system — is a separate, simpler log

---

### 8.7 LedgerProfileDetail — The Core Component

**File:** [LedgerProfileDetail.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/shared/LedgerProfileDetail.tsx)  
**Size:** 18,557 bytes / 433 lines  
**Used By:** CustomerProfilesTab, SupplierProfilesTab, MiscellaneousTab

This is the most feature-rich component in the entire ERP. It renders a complete, professional double-entry ledger account for any supplier, customer, or miscellaneous entity.

#### State Variables

```typescript
const [localProfile, setLocalProfile] = useState(profile);  // Optimistic profile copy
const [entries, setEntries] = useState<LedgerEntry[]>([]);   // Filtered visible entries
const [loading, setLoading] = useState(true);
const [showForm, setShowForm] = useState(false);             // Manual entry drawer
const [showSettings, setShowSettings] = useState(false);     // PDF heading dialog
const [showPdfOptions, setShowPdfOptions] = useState(false); // PDF column options dialog
const [millName, setMillName] = useState(profile.millName);
const [millDesc, setMillDesc] = useState(profile.millDescription);
const [dateFrom, setDateFrom] = useState<string>("");
const [dateTo, setDateTo] = useState<string>("");
const hasInitializedDates = useRef(false);                   // One-time date auto-init
const [activeLedgerUnit, setActiveLedgerUnit] = useState<LedgerDisplayUnit>("kg");
const [pdfOptions, setPdfOptions] = useState<LedgerPdfOptions>(DEFAULT_PDF_OPTIONS);
```

#### Feature 1: Real-Time Firestore Sync via `onSnapshot`

The component subscribes to the Firestore `entries` subcollection using `onSnapshot` via the Zustand store's `subscribeToProfileEntries(profileId)` method. This sets up a persistent listener that fires every time any entry is created, modified, or deleted — anywhere in the app. The component then reactively re-renders without any manual fetch calls.

```typescript
useEffect(() => {
  setLoading(true);
  hasInitializedDates.current = false;
  subscribeToProfileEntries(profile.id);
}, [profile.id, subscribeToProfileEntries]);
```

Cleanup (unsubscribing the `onSnapshot` listener) happens automatically via the Zustand store's `unsubscribeFromProfileEntries()` when the profile changes.

#### Feature 2: Entry Filtering Logic

After receiving `activeProfileEntries` from the store:

1. **Sort** by business date (day-level), then by `createdAt` timestamp for same-day entries
2. **Filter out** `bags_divided` and `bags_divided_reverted` entries (these are internal markers)
3. **Auto-initialize date range** on first load (sets `dateFrom` = earliest entry date, `dateTo` = latest entry date)
4. **Apply date filter**: entries where `entry.date >= dateFrom && entry.date <= dateTo`

#### Feature 3: Display Unit Switcher

Toggle between **kg**, **Quintal (100 kg)**, and **Tonne (1000 kg)**.

- Controlled by `activeLedgerUnit` state
- Passed to `LedgerProfileTable` for quantity/price column conversion
- Passed to `LedgerProfilePdf` for PDF quantity conversion
- Uses `ledgerUnitConversion.ts` for all arithmetic

#### Feature 4: Add Manual Entry

Button opens `ManualEntryForm` drawer (Sheet component).

After submission:
- Calls `addManualLedgerEntry(profileId, entityId, entityType, form)`
- Triggers Zustand store refresh (`fetchSuppliersData(true)` or `fetchCustomersData(true)`) for sidebar totals
- No manual `setEntries()` needed — `onSnapshot` fires and re-computes automatically

#### Feature 5: Edit Existing Entries (Non-Financial Fields)

Available for ALL entry types (including system-generated):
- Edit `particulars`, `subParticulars`, `refLabel`, `date`, `vchNo` inline in the table
- Calls `updateLedgerEntry(profileId, entryId, updates)` — a simple `updateDoc()` call
- Financial fields (`debit`, `credit`) are stripped from updates to prevent accidental modification

#### Feature 6: Edit Debit/Credit Amounts (Atomic with Cascade)

Available for ALL entry types. Uses `updateLedgerEntryAmount()` which:

1. **Reads** the current entry to compute the delta
2. **Recalculates** `pricePerUnit` = `newAmount / quantityKg`
3. **Rewrites** `subParticulars` with the updated rate string (regex pattern match)
4. **Updates** the entry doc (debit, credit, pricePerUnit, subParticulars)
5. **Cascades delta** to parent profile totals (`totalDebit`, `totalCredit`, `closingBalance`) via `increment()`
6. **If the entry is linked to a Deal** (`isPurchase` = true):
   - Updates `deal.pricePerKg` and `deal.totalCost` to reflect the corrected rate
   - Updates all `supplierLedgerEntries` for that deal (legacy sync)

Optimistic update flow:
```typescript
// 1. Calculate optimistic totals
const optimisticTotalDebit = localProfile.totalDebit + (newDebit - oldDebit);
// 2. Patch Zustand store immediately (sidebar reflects change before DB write)
useLedgerStore.getState().updateProfileInStore(entityType, entityId, {...});
// 3. Run Firestore transaction
await updateLedgerEntryAmount(profileId, entryId, newDebit, newCredit);
// 4. Force full refresh from DB (replaces optimistic values)
useLedgerStore.getState().fetchSuppliersData(true);
```

#### Feature 7: Delete Manual Entry

- Available only for `isManual === true` entries
- Uses `useUiStore.getState().requestConfirm()` for an awaitable confirm dialog
- Calls `deleteManualLedgerEntry(profileId, entry)` which atomically:
  - Deletes the entry doc
  - Reverses profile totals (`-entry.debit`, `-entry.credit`)
  - If `entry.bankId` is set: reverses the linked bank transaction and deletes the bank txn doc
- Triggers store refresh for sidebar

#### Feature 8: Drag & Drop Reorder

- Uses `@dnd-kit/core` + `@dnd-kit/sortable`
- Visual drag handle on each row
- On drop: computes `newCreatedAtMillis` as a value between the neighboring entries' `createdAt` values (midpoint interpolation)
- If both neighbors share the same `date`, the moved entry adopts that date
- Calls `reorderLedgerEntry(profileId, entryId, newCreatedAtMillis, newDateMillis?)`
- **Optimistic UI update** applied immediately, Firestore rollback on failure

#### Feature 9: PDF Export with Column Options

"Export PDF" button opens a column-visibility options dialog:
- **Toggle: Voucher Type column** (`showVchType`)
- **Toggle: Voucher Number column** (`showVchNo`)
- **Toggle: Rate/quantity details line** (`showSubParticulars`)
- **Toggle: Reference label line** (`showRefLabel`)
- "Reset to defaults" link

On confirm:
- Calls `pdf(<LedgerProfilePdf ... options={pdfOptions} activeUnit={activeLedgerUnit} />).toBlob()`
- Saves as `ledger_{EntityName}.pdf` via `file-saver`

#### Feature 10: PDF Heading Settings

Per-profile settings dialog ("PDF Heading" button):
- Edit **Mill Name** and **Sub-Heading / Description** for this specific profile's PDF header
- Calls `updateLedgerProfileSettings(profileId, { millName, millDescription })`

Global settings from LedgerPage toolbar:
- Applies Mill Name, Address, and Contact to ALL ledger profiles at once
- Calls `updateAllLedgerProfilesSettings(settings)` — `Promise.all` over all profile docs

---

### 8.8 LedgerProfileTable — Sortable & Editable Rows

**File:** [LedgerProfileTable.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/shared/LedgerProfileTable.tsx)  
**Size:** 17,022 bytes

The core table rendering component. Implements `@dnd-kit/sortable` for drag-and-drop reordering. Each row is a `SortableItem` wrapped in a drag context.

#### Table Columns

| Column | Description | Editable? |
|:---|:---|:---|
| **Drag Handle** | Grip icon for DnD reorder | — |
| **Date** | Business transaction date (`d-MMM-yy` format) | All entries |
| **Particulars** | Main description + optional `subParticulars` detail line | All entries |
| **Ref Label** | Reference code or document reference | All entries |
| **Vch Type** | Purchase / Sale / Payment / Receipt / Journal / Manual | All entries |
| **Vch No** | Voucher number (inline number input) | All entries |
| **Debit (₹)** | Debit amount (inline editable for all entries) | All entries |
| **Credit (₹)** | Credit amount (inline editable for all entries) | All entries |
| **Balance** | Running balance — cumulative `(debit - credit)` per row | Computed |
| **Actions** | Delete button (manual entries only) | — |

#### Unit Conversion in Table

When `activeUnit` is `"quintal"` or `"tonne"`:
- The `subParticulars` column detects patterns like `"680 kg @ ₹45.00/kg"` using `hasConvertiblePattern()`
- Converts displayed quantity and recalculates displayed rate accordingly
- Uses `convertSubParticularsForDisplay()` from `ledgerUnitConversion.ts`
- Original `subParticulars` string in Firestore is **never modified** — conversion is display-only

#### Color Coding

- **Debit rows**: warm tone styling (red-tinted debit amount)
- **Credit rows**: cool tone styling (green-tinted credit amount)
- **Running balance column**: positive (Dr) = red tone, negative (Cr) = green tone
- **System-generated entries**: subtle visual distinction from manual entries

---

### 8.9 ManualEntryForm — Drawer Form

**File:** [ManualEntryForm.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/shared/ManualEntryForm.tsx)  
**Size:** 13,920 bytes

A slide-out drawer (`Sheet` component) with full React Hook Form + Zod validation.

#### Form Fields

| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| **Entry Kind** | Radio/Toggle (Debit / Credit) | ✓ | Controls which column the amount goes to |
| **Date** | HTML date picker | ✓ | Defaults to today |
| **Particulars** | Text input | ✓ | Main description line |
| **Sub-Particulars** | Text input | — | Optional detail line |
| **Rice Type** | Select dropdown | — | From active `riceTypes` collection |
| **Voucher Type** | Select (Purchase/Payment/Receipt/Sale/Journal/Manual) | ✓ | |
| **Voucher Number** | Number input | ✓ | Auto-suggested as `max(existing vchNo) + 1` |
| **Amount (₹)** | Number input (positive only) | ✓ | |
| **Quantity (kg)** | Number input | — | Auto-generates rate string in `subParticulars` |
| **Price Per Unit** | Number input | — | Combined with quantity for display formatting |
| **Bank Account** | Select dropdown | — | Lists all bank accounts → triggers fund movement |
| **Record Fund Movement** | Toggle checkbox | — | Controls whether bank balance changes |
| **Bank Movement Direction** | Radio (Credit/Debit) | — | Credit = add money to bank, Debit = withdraw |

#### Fund Movement Logic

If `bankId` is selected and `recordFundMovement` is true:
- Reads current bank balance inside transaction
- If direction = "debit": validates `currentBalance - amount >= 0` (overdraft prevention)
- Applies `increment(delta)` to bank's `principalAmount`
- Creates a `banks/{bankId}/transactions/{txnId}` doc linking back to the ledger entry
- The bank transaction is reversible — if the ledger entry is later deleted, the bank transaction is found (via `relatedLedgerEntryId` query) and reversed

#### Zod Validation Schema

```typescript
// File: src/types/ledger-profile.ts
const ManualLedgerEntryFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  particulars: z.string().min(1, "Particulars required"),
  subParticulars: z.string().optional(),
  vchType: VchTypeEnum,
  vchNo: z.number().int().positive("Voucher number must be positive"),
  entryKind: z.enum(["debit", "credit"]),
  amount: z.number().positive("Amount must be positive"),
  quantityKg: z.preprocess((val) => val === "" || isNaN(val) ? undefined : val, z.number().optional()),
  pricePerUnit: z.preprocess((val) => val === "" || isNaN(val) ? undefined : val, z.number().optional()),
  riceType: z.string().optional(),
  bankId: z.string().nullable().optional(),
  recordFundMovement: z.boolean().optional(),
  bankMovementDirection: z.enum(["credit", "debit"]).optional(),
});
```

---

### 8.10 LedgerTotalsFooter — Running Totals

**File:** [LedgerTotalsFooter.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/shared/LedgerTotalsFooter.tsx)  
**Size:** 1,777 bytes

Renders the accounting-standard three-row footer at the bottom of the ledger table:

```
Row 1: Grand Total    | [Total Debit ₹]  | [Total Credit ₹]
Row 2: Dr/Cr Balance  | [Closing Balance on the correct side]
Row 3: Equalised      | [max(Dr,Cr)]     | [max(Dr,Cr)]
```

- `closingBalance = totalDebit - totalCredit`
- If `closing >= 0`: shows "**Dr** Closing Balance" with value in Debit column
- If `closing < 0`: shows "**Cr** Closing Balance" with value in Credit column
- Equalised row shows `max(totalDebit, totalCredit)` on both sides (standard accounting format)
- Numbers formatted with `en-IN` locale (Indian comma format, 2 decimal places)

**Note:** The `totalDebit` and `totalCredit` passed to this component are computed from the **visible (filtered) entries** in the current date range, not from the stored profile aggregates. This ensures the footer accurately reflects the filtered view.

---

### 8.11 Ledger PDF Export System

**Template:** [LedgerProfilePdf.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/shared/pdf/LedgerProfilePdf.tsx)

Built with `@react-pdf/renderer`. Renders a professional A4 landscape PDF ledger statement.

#### PDF Structure

**Header Block:**
- Mill/Business Name (large, bold, centered)
- Mill Description/Address (smaller, centered)
- Contact number (optional, centered)
- Entity Name (medium bold, centered)
- "Ledger Account" label (centered)
- Date range: `{dateFrom} to {dateTo}` (formatted as `d-MMM-yy`)

**Column Headers (A4 Landscape):**
| Date | Particulars | Vch Type* | Vch No* | Debit | Credit |
(*optional — hidden if `showVchType`/`showVchNo` = false)

**Data Rows:**
- Each `LedgerEntry` renders as one row (or two if `subParticulars` is shown)
- `subParticulars` rendered as small gray sub-text below main particulars
- `refLabel` rendered as small blue sub-text below subParticulars
- Manual entries get a light yellow background
- `bags_divided` / `bags_divided_reverted` entries are filtered out before PDF generation
- Unit conversion applied if `activeUnit` ≠ "kg"

**Footer:**
1. Sub-total row: Total Debit | Total Credit
2. Dr/Cr Closing Balance row
3. Equalised Grand Total row (dark background, white text)
4. Page number: `"Page X of Y"` (fixed, bottom-right)

#### PDF Column Configuration (`LedgerPdfOptions`)

```typescript
interface LedgerPdfOptions {
  showVchType: boolean;         // Show/hide Voucher Type column
  showVchNo: boolean;           // Show/hide Voucher Number column
  showSubParticulars: boolean;  // Show/hide detail line under particulars
  showRefLabel: boolean;        // Show/hide reference label line
}
```

Column widths adjust dynamically based on which optional columns are shown, using percentage-based layout.

#### Currency Formatting

All amounts formatted as:
```typescript
n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Result: "1,37,027.00" (Indian comma system)
```

---

### 8.12 Ledger Detail Page (COGS Breakdown)

**Route:** `/ledger/:orderId`  
**Component:** [LedgerDetailPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/LedgerDetailPage.tsx)  
**Service:** `getLedgerForOrder(orderId)` in [ledgerService.ts](file:///c:/dev/ERP/rice-erp/src/services/ledgerService.ts)

Shows full cost-of-goods-sold (COGS) breakdown for a single confirmed order.

#### Customer Information Card

- Customer Name, Order Date, Status, Confirmed At timestamp

#### Allocation Breakdown Table

| Column | Description |
|:---|:---|
| **Supplier** | Source supplier name |
| **Product Code** | e.g. "LS-001" |
| **Rice Type** | e.g. "Lal Shonno" |
| **Bag Size** | 50kg / 60kg / 1 Quintal / 1 Tonne |
| **Bags** | Number of bags in this allocation |
| **Weight** | Total kg for this line (numberOfBags × bagWeightKg) |
| **Purchase Price** | ₹/kg (COGS rate, red) |
| **Selling Price** | ₹/kg (selling rate, green) |
| **COGS** | Total purchase cost for line (red) |
| **Revenue** | Total selling revenue for line (green) |
| **Profit** | Net profit per line (indigo) |

#### Financial Summary Card

- Volume Sold (Quintal + kg breakdown)
- Average Selling Price (₹/Quintal)
- Gross Revenue
- Cost of Goods Sold (-)
- **Net Profit** (highlighted)

#### Invoice Download

- Uses `PDFDownloadLink` from `@react-pdf/renderer`
- Renders `InvoicePDF` component client-side in the browser
- Downloads as `Invoice_{orderId}.pdf`

---

### 8.13 Payment Voucher System

**Components:** [PaymentVoucher/](file:///c:/dev/ERP/rice-erp/src/components/deals/PaymentVoucher/)

A dedicated payment recording system accessible from both Deals and Ledger contexts.

#### Components

- **[PaymentVoucherDialog.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/PaymentVoucher/PaymentVoucherDialog.tsx)** — Dialog wrapper with entity selector
- **[PaymentVoucherForm.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/PaymentVoucher/PaymentVoucherForm.tsx)** — Full form with validation
- **[ProfileCombobox.tsx](file:///c:/dev/ERP/rice-erp/src/components/deals/PaymentVoucher/ProfileCombobox.tsx)** — Searchable combobox to select a ledger profile
- **[paymentVoucherSchema.ts](file:///c:/dev/ERP/rice-erp/src/components/deals/PaymentVoucher/paymentVoucherSchema.ts)** — Zod schema for the voucher form
- **[usePaymentVoucher.ts](file:///c:/dev/ERP/rice-erp/src/components/deals/PaymentVoucher/usePaymentVoucher.ts)** — Form state hook

#### Form Fields

| Field | Description |
|:---|:---|
| **Profile** | Search + select ledger profile (supplier or customer) |
| **Amount** | Payment amount (₹) |
| **Payment Date** | Date of payment |
| **Payment Mode** | Cash / Cheque / Bank Transfer / UPI |
| **Reference Number** | Optional cheque/UTR number |
| **Note** | Optional memo text |
| **Link Bank Account** | Optional — adjusts bank balance atomically |

#### Direction Logic (Accounting Convention)

```
Supplier payment → credit entry (reduces what we owe them)
Customer payment → debit entry (records cash received from them)
```

This is implemented in `postPaymentVoucherEntry()`:

```typescript
const direction = input.entityType === 'supplier' ? 'credit' : 'debit';
const debit = direction === 'debit' ? input.amount : 0;
const credit = direction === 'credit' ? input.amount : 0;
```

#### Service Function: `postPaymentVoucherEntry()`

```typescript
// In ledgerProfileService.ts
export async function postPaymentVoucherEntry(
  input: PaymentVoucherFormValues & { source: 'manual-payment' | 'manual-receipt' }
): Promise<void>
```

Atomically:
1. Reads the profile to confirm it exists
2. Sets debit/credit based on direction logic
3. Creates the `LedgerEntry` doc
4. Updates profile totals via `increment()`
5. Sets `vchType: "Payment"`, `isManual: true`, `isSystemGenerated: false`

---

### 8.14 ledgerProfileService — Complete Service API

**File:** [ledgerProfileService.ts](file:///c:/dev/ERP/rice-erp/src/services/ledgerProfileService.ts)  
**Size:** 21,048 bytes / 537 lines

This is the most complex service file in the entire application.

| Function | Signature | Description |
|:---|:---|:---|
| `getLedgerProfile` | `(entityId: string) → LedgerProfile \| null` | Fetch one profile by supplier/customer ID via Firestore query |
| `getLedgerProfilesByType` | `(entityType) → Record<string, LedgerProfile>` | Fetch all profiles of a type, keyed by `entityId` |
| `getLedgerEntries` | `(profileId, dateFrom?, dateTo?) → LedgerEntry[]` | Fetch + sort entries with optional date filter (client-side) |
| `addManualLedgerEntry` | `(profileId, entityId, entityType, form) → void` | Add manual entry + update profile totals + optional bank movement — `runTransaction` |
| `postPaymentVoucherEntry` | `(input) → void` | Add payment voucher entry with direction logic — `runTransaction` |
| `deleteManualLedgerEntry` | `(profileId, entry) → void` | Delete entry + reverse profile totals + reverse bank txn — `runTransaction` |
| `updateLedgerEntryVchNo` | `(profileId, entryId, newVchNo) → void` | Update voucher number only — simple `updateDoc` |
| `updateLedgerEntry` | `(profileId, entryId, updates) → void` | Update non-financial fields (date, particulars, refLabel, etc.) |
| `updateLedgerEntryAmount` | `(profileId, entryId, newDebit, newCredit) → void` | Atomic amount edit with cascade to deal and supplier ledger — `runTransaction` |
| `updateLedgerProfileSettings` | `(profileId, settings) → void` | Update per-profile PDF heading (millName + millDescription) |
| `updateAllLedgerProfilesSettings` | `(settings) → void` | Apply PDF heading to ALL profiles — `Promise.all` batch |
| `reorderLedgerEntry` | `(profileId, entryId, newCreatedAtMillis, newDateMillis?) → void` | Update sort timestamps for drag-and-drop reordering |
| `ensureLedgerProfile` | `(entityType, entityId, entityName, millDefaults) → void` | Idempotent profile creation with `setDoc({ merge: true })` |

#### Key Implementation Details

**`getLedgerEntries` Sorting:**
```typescript
// 1. Primary sort: business date (day-level, ignoring time)
// 2. Secondary sort: createdAt timestamp (for same-day ordering and DnD control)
entries.sort((a, b) => {
  const dateA = a.date.toDate(); dateA.setHours(0, 0, 0, 0);
  const dateB = b.date.toDate(); dateB.setHours(0, 0, 0, 0);
  const dDiff = dateA.getTime() - dateB.getTime();
  if (dDiff !== 0) return dDiff;
  return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
});
```

**`updateLedgerEntryAmount` — Cascade Chain:**
```
1. Read entry → extract dealId, check isPurchase flag
2. If isPurchase: pre-fetch deal + all supplierLedgerEntries for dealId
3. runTransaction:
   a. Re-read entry for consistent delta (reads before writes rule)
   b. Re-read deal (if applicable)
   c. Compute debitDelta, creditDelta
   d. Recalculate pricePerUnit = totalValue / quantityKg
   e. Update subParticulars regex pattern with new rate
   f. Write entry: { debit, credit, pricePerUnit, subParticulars }
   g. Cascade to profile: { totalDebit+=debitDelta, closingBalance+=debitDelta-creditDelta }
   h. Cascade to deal: { pricePerKg = newPricePerUnit, totalCost = newAmount }
   i. For each supplierLedgerEntry: { pricePerKg, totalValue }
```

---

### 8.15 useLedgerStore — Global State

**File:** [useLedgerStore.ts](file:///c:/dev/ERP/rice-erp/src/stores/useLedgerStore.ts)  
**Size:** 5,315 bytes / 159 lines

Zustand store that serves as the application's central ledger state. All ledger-related components share this store.

```typescript
interface LedgerStore {
  // Entity lists
  customers: Customer[];
  suppliers: Supplier[];
  miscellaneous: MiscellaneousProfile[];

  // Profile maps (keyed by entityId for O(1) lookup)
  customerProfiles: Record<string, LedgerProfile>;
  supplierProfiles: Record<string, LedgerProfile>;
  miscellaneousProfiles: Record<string, LedgerProfile>;

  // Loading states
  isLoadingCustomers: boolean;
  isLoadingSuppliers: boolean;
  isLoadingMiscellaneous: boolean;

  // Fetch actions (lazy + force-refetch support)
  fetchCustomersData: (force?: boolean) => Promise<void>;
  fetchSuppliersData: (force?: boolean) => Promise<void>;
  fetchMiscellaneousData: (force?: boolean) => Promise<void>;

  // Optimistic patch (apply local changes before DB confirms)
  updateProfileInStore: (entityType, entityId, patch) => void;

  // Real-time entries subscription (one profile at a time)
  activeProfileEntries: LedgerEntry[];
  activeProfileUnsubscribe: (() => void) | null;
  subscribeToProfileEntries: (profileId: string) => void;   // Sets up onSnapshot
  unsubscribeFromProfileEntries: () => void;                 // Tears down onSnapshot
}
```

#### `subscribeToProfileEntries` Implementation

```typescript
subscribeToProfileEntries: (profileId: string) => {
  // Unsubscribe from previous profile's listener first
  get().unsubscribeFromProfileEntries();

  const q = query(
    collection(db, "ledgerProfiles", profileId, "entries"),
    orderBy("date", "asc"),
    orderBy("createdAt", "asc")
  );

  // Set up real-time listener
  const unsub = onSnapshot(q, (snap) => {
    set({ activeProfileEntries: snap.docs.map((d) => d.data() as LedgerEntry) });
  });

  set({ activeProfileUnsubscribe: unsub });
},
```

#### Lazy Loading & Caching

- `fetchCustomersData(force = false)` — skips fetch if `customers.length > 0` (cached)
- Pass `force = true` to bypass cache and always refetch from Firestore
- This pattern is used after mutations to ensure sidebar balances reflect the latest state

---

### 8.16 Double-Entry Accounting Convention

The accounting convention used throughout the ERP:

| Scenario | Entity Type | Debit | Credit | Closing Balance Effect |
|:---|:---|:---|:---|:---|
| Delivery confirmed (grain received) | Supplier | `deal.totalCost` | 0 | +totalCost (we owe more) |
| Order confirmed (goods sold) | Customer | 0 | `order.totalRevenue` | -totalRevenue (customer owes us) |
| Payment made to supplier | Supplier | 0 | paymentAmount | -paymentAmount (debt reduced) |
| Payment received from customer | Customer | paymentAmount | 0 | +paymentAmount (debt reduced) |
| Manual debit (any) | Any | amount | 0 | +amount |
| Manual credit (any) | Any | 0 | amount | -amount |

**Formula:** `closingBalance = totalDebit - totalCredit`

For **suppliers**: positive closingBalance means we owe them money (we bought grain but haven't paid).  
For **customers**: negative closingBalance means they owe us money (we sold them goods but haven't received payment).

---

### 8.17 Ledger Security Rules

```javascript
// File: firestore.rules
match /ledgerProfiles/{profileId} {
  allow read: if isAuthenticated() && isActiveUser();
  allow create, update: if isAuthenticated() && isAdmin();
  allow delete: if false;  // Profiles are NEVER deleted

  match /entries/{entryId} {
    allow read: if isAuthenticated() && isActiveUser();
    allow create: if isAuthenticated() && isAdmin();
    // Only manual entries can be updated or deleted
    allow update, delete: if isAuthenticated() && isAdmin()
      && resource.data.isManual == true;
  }
}
```

**Key constraints enforced at the database level:**
- `LedgerProfile` documents can never be deleted (hardcoded `allow delete: if false`)
- System-generated entries (`isManual == false`) cannot be updated or deleted
- Only active users with admin or superadmin role can write to ledger collections

---

### 8.18 Ledger Unit Conversion System

**File:** [src/lib/ledgerUnitConversion.ts](file:///c:/dev/ERP/rice-erp/src/lib/ledgerUnitConversion.ts)

```typescript
type LedgerDisplayUnit = "kg" | "quintal" | "tonne";

const LEDGER_UNITS: { id: LedgerDisplayUnit; label: string; multiplier: number }[] = [
  { id: "kg",      label: "Kg",      multiplier: 1 },
  { id: "quintal", label: "Quintal", multiplier: 100 },   // 1 Quintal = 100 kg
  { id: "tonne",   label: "Tonne",   multiplier: 1000 },  // 1 Tonne = 1000 kg
];
```

Key functions:
- `convertQuantity(kg, unit)` — converts a kg value to the target unit
- `convertPrice(pricePerKg, unit)` — converts ₹/kg price to ₹/unit
- `hasConvertiblePattern(str)` — detects if a `subParticulars` string has a `"{qty} kg @ ₹{rate}/kg"` pattern
- `convertSubParticularsForDisplay(str, unit)` — regex-replaces the pattern with converted values

The conversion is **purely for display**. Firestore always stores quantities in `kg`. The `subParticulars` strings are never modified in the database by unit conversion.

---

### 8.19 Auto-Entry Triggers (System-Generated Entries)

The following existing service functions write `LedgerEntry` documents inside their Firestore transactions:

| Trigger Function | Entry Written | Entity | Debit | Credit | `vchType` | `entryType` |
|:---|:---|:---|:---|:---|:---|:---|
| `dealService.confirmDelivery()` | On delivery confirmed | Supplier | `deal.totalCost` | 0 | `Purchase` | `delivery_confirmed` |
| `dealService.confirmBagDivisions()` | On bags packed | Supplier | 0 | 0 | `Journal` | `bags_divided` (hidden) |
| `dealService.deleteBagDivision()` | On division deleted | Supplier | 0 | 0 | `Journal` | `bags_divided_reverted` (hidden) |
| `orderService.confirmOrder()` | On order confirmed | Customer | 0 | `order.totalRevenue` | `Sale` | `order_confirmed` |
| `ledgerProfileService.postPaymentVoucherEntry()` | On payment recorded | Supplier or Customer | direction-based | direction-based | `Payment` | `manual_debit`/`manual_credit` |

**Write pattern inside `runTransaction`:**

```typescript
// Inside existing runTransaction — appended after existing writes:
const entryRef = doc(collection(db, `ledgerProfiles/${profile.id}/entries`));
transaction.set(entryRef, {
  id: entryRef.id,
  profileId: profile.id,
  entityId: supplierId,
  entityType: "supplier",
  date: serverTimestamp(),
  particulars: `${deal.riceTypeName} Purchase`,
  subParticulars: `${deal.totalAmountKg} kg @ ₹${deal.pricePerKg}/kg`,
  refLabel: `Code: ${deal.product.productCode}`,
  vchType: "Purchase",
  vchNo: nextVchNo,
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

// Also update profile totals atomically (same transaction):
transaction.update(profileRef, {
  totalDebit: increment(deal.totalCost),
  closingBalance: increment(deal.totalCost),
  updatedAt: serverTimestamp(),
});
```

---

### 8.20 Drag & Drop Reorder Logic

The DnD reorder uses **createdAt timestamp interpolation** to maintain sort order:

```typescript
// Compute new position timestamp (midpoint between neighbors)
if (prevEntry && nextEntry) {
  const prevMillis = prevEntry.createdAt?.toMillis() || Date.now();
  const nextMillis = nextEntry.createdAt?.toMillis() || Date.now();
  newMillis = prevMillis + (nextMillis - prevMillis) / 2;

  // Infer new business date from neighbors
  if (prevEntry.date.toMillis() === nextEntry.date.toMillis()) {
    newDateMillis = prevEntry.date.toMillis(); // Adopt shared date
  } else {
    newDateMillis = nextEntry.date.toMillis(); // Adopt next entry's date
  }
} else if (prevEntry) {
  newMillis = (prevEntry.createdAt?.toMillis() || Date.now()) + 1000;
  newDateMillis = prevEntry.date.toMillis();
} else if (nextEntry) {
  newMillis = (nextEntry.createdAt?.toMillis() || Date.now()) - 1000;
  newDateMillis = nextEntry.date.toMillis();
}
```

The `reorderLedgerEntry` service function then writes:
```typescript
await updateDoc(entryRef, {
  createdAt: Timestamp.fromMillis(newCreatedAtMillis),
  ...(newDateMillis !== undefined ? { date: Timestamp.fromMillis(newDateMillis) } : {}),
  updatedAt: serverTimestamp(),
});
```

This approach is elegant because the Firestore `orderBy("date", "asc"), orderBy("createdAt", "asc")` query naturally reflects the new order after the timestamp update, without any array or explicit index management.

---

## 9. Inventory Module

**Route:** `/inventory`  
**Entry Point:** [InventoryPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/InventoryPage.tsx)

### Features

- **Per-Deal Stock Cards** — One card per deal:
  - Supplier name + rice type + product code badge
  - **Raw Stock**: Remaining loose grain (kg) with progress bar
  - **Packed Stock**: Total bags available per division (50kg, 60kg, etc.)
  - **Sold**: Total sold kg
  - Stock ratio bar: Raw vs. Packed vs. Sold as percentage fill
  - Status chip: `in_stock` / `partial` / `exhausted`

- **Bag Division Breakdown** — Per card: available bags by size with available count

- **Filter Controls** — Filter by rice type, supplier, status

- **Summary Stats** — Page-level aggregates:
  - Total Raw Stock (kg)
  - Total Packed Bags (by size)
  - Total Sold (kg)

---

## 10. Wages & Payroll Module

**Route:** `/wages`

### Features

- **Employee Registry** — Add/edit employees with: name, type (`monthly` / `daily`), base salary, contact info
- **Wage Disbursement** — Log payment per employee: amount, date, days worked (daily workers), payment method
  - Writes to `salaryTransactions` collection
  - Optionally deducts from linked bank account
- **Payroll Summary** — Total wages paid per month, per-employee payment history

---

## 11. Balance Sheet & P&L Module

**Route:** `/balance-pnl`  
**Service:** [balanceSheetAggregation.ts](file:///c:/dev/ERP/rice-erp/src/services/balanceSheetAggregation.ts)

### Aggregated Financial Metrics

| Metric | Source Collection | Calculation |
|:---|:---|:---|
| **Closing Stock** | `inventory` | Sum of `(remainingRawKg + remainingPackedKg) × deal.pricePerKg` for non-exhausted deals |
| **Sundry Debtors** | `ledgerProfiles` (supplier type) | Sum of `closingBalance` for all supplier profiles |
| **Sundry Creditors** | `ledgerProfiles` (customer type) | Negative sum of `closingBalance` for all customer profiles |
| **Cash in Hand** | `ledgerProfiles` (customer type) | Sum of `totalDebit` for all customer profiles |
| **Bank Accounts** | `banks` collection | Live `principalAmount` per bank account |
| **Sales Revenue** | `orders` (confirmed + delivered) | Sum of `totalRevenue` |
| **COGS** | `orders` (confirmed + delivered) | Sum of `totalCostOfGoods` |
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
  - Duties & Taxes               Current Assets:
  - Provisions                     - Closing Stock
  - Sundry Creditors               - Deposits
Suspense A/C                       - Loans & Advances
Difference in Opening Bal.         - Sundry Debtors
                                    - Cash in Hand
                                    - Bank Accounts
                                  Profit & Loss A/C
```

- System-computed line items are **read-only** in the UI
- Users can add **manual line items** to any group (stored in `balanceSheetManualEntries`)
- Manual entries: label + amount (positive for normal, negative for contra entries)

### P&L Statement

```
INCOME                          EXPENSES
─────────────────────────────   ────────────────────────────
Sales Revenue                   Cost of Goods Sold (COGS)
                                Operating Expenses (Wages)
                                Output GST
                                Input GST
```

`Net Profit = Sales Revenue − COGS − Operating Expenses`

---

## 12. Executive Dashboard

**Route:** `/` (root)  
**Component:** [DashboardPage.tsx](file:///c:/dev/ERP/rice-erp/src/components/dashboard/DashboardPage.tsx)

### KPI Cards

| Card | Metric | Source |
|:---|:---|:---|
| Total Revenue | Sum of all confirmed order revenues | `orders` collection |
| Net Profit | Sum of all confirmed order profits | `orders` collection |
| Staged Stock | Total available packed bags (unsold) | `inventory` collection |
| Raw Stock | Total loose grain remaining (kg) | `inventory` collection |

### Revenue vs. Profit Chart

- Dual-line spline chart using **Recharts**
- X-axis: dates of confirmed orders
- Line 1: Revenue per day (blue/indigo)
- Line 2: Profit per day (emerald)
- Interactive: hover tooltip with exact values

### Recent Activity Panel

- 5 most recently confirmed orders
- Customer name, date, revenue
- Direct "View →" link to `/ledger/{orderId}` COGS detail page

---

## 13. PDF Generation System

### Invoice PDF

**Template:** [InvoicePDF.tsx](file:///c:/dev/ERP/rice-erp/src/components/pdf/InvoicePDF.tsx)

Generated on the `LedgerDetailPage` via `PDFDownloadLink` (renders asynchronously in browser).

Contents:
- Business/Mill header (name, address)
- Customer details
- Order date, order ID
- Line-item table: Supplier → Product → Bag Size → Bags → Weight → Purchase Price → Selling Price → Revenue
- Totals: COGS, Revenue, Net Profit
- Styled with `@react-pdf/renderer` `StyleSheet`

### Ledger Statement PDF

**Template:** [LedgerProfilePdf.tsx](file:///c:/dev/ERP/rice-erp/src/components/ledger/shared/pdf/LedgerProfilePdf.tsx)

Generated from `LedgerProfileDetail` via `pdf(...).toBlob()` then `saveAs()`.

Contents:
- Mill/business name and address header
- Entity name and account type
- Date range (From → To in `d-MMM-yy` format)
- Full double-entry ledger table with configurable columns
- Totals footer: Total Dr | Total Cr | Closing Balance
- Unit-converted quantities per `activeLedgerUnit` (kg / Quintal / Tonne)
- Page numbers (fixed, landscape A4)

---

## 14. State Management Architecture

### authStore

**File:** [authStore.ts](file:///c:/dev/ERP/rice-erp/src/stores/authStore.ts)

```typescript
interface AuthStore {
  user: AppUser | null;
  loading: boolean;
  role: "superadmin" | "admin" | null;
  status: "pending" | "active" | "removed" | null;
  setUser(user: AppUser | null): void;
  clearUser(): void;
}
```

### uiStore

**File:** [uiStore.ts](file:///c:/dev/ERP/rice-erp/src/stores/uiStore.ts)

```typescript
interface UiStore {
  confirmDialog: { title: string; message: string; resolve: (v: boolean) => void } | null;
  requestConfirm(title: string, message: string): Promise<boolean>; // Awaitable confirm dialog
  resolveConfirm(result: boolean): void;
}
```

Usage pattern:
```typescript
const confirm = await useUiStore.getState().requestConfirm("Delete Entry", "Are you sure?");
if (!confirm) return;
// Proceed with deletion...
```

### useLedgerStore

Covered in detail in [Section 8.15](#815-usledgerstore--global-state).

---

## 15. Service Layer Complete Reference

| Service File | Key Functions | Description |
|:---|:---|:---|
| [dealService.ts](file:///c:/dev/ERP/rice-erp/src/services/dealService.ts) | `getAllDeals`, `createDeal`, `confirmDelivery`, `deleteDeal`, `createBagDivisions`, `confirmBagDivisions`, `deleteBagDivision`, `subscribeToBagDivisions` | All deal and bag division operations |
| [orderService.ts](file:///c:/dev/ERP/rice-erp/src/services/orderService.ts) | `getAllOrders`, `createOrderWithAllocations`, `confirmOrder`, `deleteOrder` | Full order lifecycle |
| [ledgerProfileService.ts](file:///c:/dev/ERP/rice-erp/src/services/ledgerProfileService.ts) | `getLedgerProfile`, `getLedgerProfilesByType`, `getLedgerEntries`, `addManualLedgerEntry`, `postPaymentVoucherEntry`, `deleteManualLedgerEntry`, `updateLedgerEntry`, `updateLedgerEntryAmount`, `reorderLedgerEntry`, `updateLedgerProfileSettings`, `updateAllLedgerProfilesSettings`, `ensureLedgerProfile` | Complete ledger management (21KB) |
| [ledgerService.ts](file:///c:/dev/ERP/rice-erp/src/services/ledgerService.ts) | `getLedgerForOrder` | Fetches order + allocations for COGS detail page |
| [supplierLedgerService.ts](file:///c:/dev/ERP/rice-erp/src/services/supplierLedgerService.ts) | Legacy supplier event log operations | Being phased out in favor of LedgerProfile system |
| [bulkLedgerService.ts](file:///c:/dev/ERP/rice-erp/src/services/bulkLedgerService.ts) | Bulk ledger operations | Batch operations across multiple profiles |
| [balanceSheetAggregation.ts](file:///c:/dev/ERP/rice-erp/src/services/balanceSheetAggregation.ts) | `getAggregatedFinancials`, `getClosingStockValue`, `getSundryDebtorsValue`, `getSundryCreditorsValue`, `getCashInHandValue`, `getBankAccountsData`, `getSalesRevenueValue`, `getCostOfGoodsSoldValue`, `getOperatingExpensesValue`, `getTotalPurchasesValue`, `addBalanceSheetManualEntry`, `updateBalanceSheetManualEntry`, `deleteBalanceSheetManualEntry` | All balance sheet computations |
| [supplierService.ts](file:///c:/dev/ERP/rice-erp/src/services/supplierService.ts) | `getAllSuppliers`, `addSupplier`, `updateSupplier` | Supplier CRUD + LedgerProfile bootstrap |
| [customerService.ts](file:///c:/dev/ERP/rice-erp/src/services/customerService.ts) | `getAllCustomers`, `addCustomer`, `updateCustomer` | Customer CRUD + LedgerProfile bootstrap |
| [inventoryService.ts](file:///c:/dev/ERP/rice-erp/src/services/inventoryService.ts) | `getAllInventory`, `getInventoryForDeal` | Inventory reads and status updates |
| [employeeService.ts](file:///c:/dev/ERP/rice-erp/src/services/employeeService.ts) | `getAllEmployees`, `addEmployee`, `logSalaryPayment` | Employee registry + payroll log |
| [riceTypeService.ts](file:///c:/dev/ERP/rice-erp/src/services/riceTypeService.ts) | `getAllRiceTypes`, `addRiceType`, `updateRiceType` | Rice variety catalog (SuperAdmin only) |
| [userService.ts](file:///c:/dev/ERP/rice-erp/src/services/userService.ts) | `getAllUsers`, `updateUserStatus`, `updateUserRole` | User management (SuperAdmin only) |
| [miscellaneousService.ts](file:///c:/dev/ERP/rice-erp/src/services/miscellaneousService.ts) | `getAllMiscellaneous`, `addMiscellaneous` | Miscellaneous entity CRUD |

---

## 16. Firestore Security Rules

**File:** [firestore.rules](file:///c:/dev/ERP/rice-erp/firestore.rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    function isActiveUser() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.status == "active";
    }
    function isAdmin() {
      return isActiveUser() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ["admin", "superadmin"];
    }
    function isSuperAdmin() {
      return isActiveUser() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "superadmin";
    }

    // Users collection (SuperAdmin only for writes)
    match /users/{uid} {
      allow read: if isAuthenticated() && isActiveUser();
      allow create, update: if isAuthenticated() && isSuperAdmin();
    }

    // Operational collections (admin+)
    match /deals/{dealId} {
      allow read: if isAuthenticated() && isActiveUser();
      allow write: if isAuthenticated() && isAdmin();
      match /bagDivisions/{divisionId} {
        allow read: if isAuthenticated() && isActiveUser();
        allow write: if isAuthenticated() && isAdmin();
      }
    }

    match /orders/{orderId} {
      allow read: if isAuthenticated() && isActiveUser();
      allow write: if isAuthenticated() && isAdmin();
      match /allocations/{allocId} {
        allow read: if isAuthenticated() && isActiveUser();
        allow write: if isAuthenticated() && isAdmin();
      }
    }

    // Ledger profiles (never deletable)
    match /ledgerProfiles/{profileId} {
      allow read: if isAuthenticated() && isActiveUser();
      allow create, update: if isAuthenticated() && isAdmin();
      allow delete: if false;
      match /entries/{entryId} {
        allow read: if isAuthenticated() && isActiveUser();
        allow create: if isAuthenticated() && isAdmin();
        allow update, delete: if isAuthenticated() && isAdmin()
          && resource.data.isManual == true;
      }
    }
  }
}
```

---

## 17. File & Symbol Reference Index

### Pages (Routes)

| File | Route | Description |
|:---|:---|:---|
| [DashboardPage.tsx](file:///c:/dev/ERP/rice-erp/src/components/dashboard/DashboardPage.tsx) | `/` | KPIs, Revenue vs. Profit chart, Recent Activity |
| [DealsPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/DealsPage.tsx) | `/deals` | Three-tab trading hub (Bought, Staging, Sold) |
| [InventoryPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/InventoryPage.tsx) | `/inventory` | Visual stock meters per deal |
| [LedgerPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/LedgerPage.tsx) | `/ledger` | Four-tab general ledger |
| [LedgerDetailPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/LedgerDetailPage.tsx) | `/ledger/:orderId` | COGS breakdown + Invoice download |
| [WagesPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/WagesPage.tsx) | `/wages` | Employee registry + payroll |
| [BalancePnLPage.tsx](file:///c:/dev/ERP/rice-erp/src/pages/app/BalancePnLPage.tsx) | `/balance-pnl` | Balance Sheet + P&L statement |
| [AdminUsersPage.tsx](file:///c:/dev/ERP/rice-erp/src/components/admin/AdminUsersPage.tsx) | `/admin/users` | User approval/suspension panel (SuperAdmin) |

### Critical Components

| Component | Location | Purpose |
|:---|:---|:---|
| `AuthProvider` | `components/auth/` | Firebase auth listener + route gating |
| `AppLayout` | `components/layout/` | Sidebar + main content shell |
| `ProtectedRoute` | `components/layout/` | Auth + status guard for all app routes |
| `SuperAdminRoute` | `components/layout/` | Role guard for admin-only routes |
| **`LedgerProfileDetail`** | `components/ledger/shared/` | **Full double-entry ledger per entity (core)** |
| **`LedgerProfileTable`** | `components/ledger/shared/` | **Sortable, editable ledger rows with DnD** |
| **`ManualEntryForm`** | `components/ledger/shared/` | **Add manual debit/credit entry drawer** |
| **`LedgerTotalsFooter`** | `components/ledger/shared/` | **Running totals + closing balance footer** |
| **`LedgerProfilePdf`** | `components/ledger/shared/pdf/` | **Ledger statement PDF template** |
| `CustomerLedgerTab` | `components/ledger/customer/` | Customer ledger shell + KPIs |
| `SupplierLedgerTab` | `components/ledger/supplier/` | Supplier ledger shell + KPIs |
| `CustomerProfilesTab` | `components/ledger/customer/profiles/` | List of all customer profiles |
| `SupplierProfilesTab` | `components/ledger/supplier/profiles/` | List of all supplier profiles |
| `PaymentVoucherDialog` | `components/deals/PaymentVoucher/` | Payment recording dialog |
| `SupplierBagSelector` | `components/deals/sold/` | Advanced bag picker for orders |
| `AddDealModal` | `components/deals/bought/` | Full purchase deal creation form |
| `BagDivisionModal` | `components/deals/bought/` | Bag division creation + confirmation |
| `InvoicePDF` | `components/pdf/` | Customer invoice PDF template |

### Type Definitions

| File | Key Types |
|:---|:---|
| [ledger-profile.ts](file:///c:/dev/ERP/rice-erp/src/types/ledger-profile.ts) | `LedgerProfile`, `LedgerEntry`, `LedgerEntryType`, `VchType`, `EntityType`, `ManualLedgerEntryForm`, `LedgerPdfParams`, `LedgerPdfOptions` |
| [deal.ts](file:///c:/dev/ERP/rice-erp/src/types/deal.ts) | `Deal`, `BagDivision`, `DealDiscount`, `Product` |
| [order.ts](file:///c:/dev/ERP/rice-erp/src/types/order.ts) | `Order`, `OrderAllocation` |
| [inventory.ts](file:///c:/dev/ERP/rice-erp/src/types/inventory.ts) | `Inventory`, `InventoryDivisionSnapshot` |
| [riceTypes.ts](file:///c:/dev/ERP/rice-erp/src/types/riceTypes.ts) | `RiceType`, `BagSize`, `Product`, `BAG_WEIGHT_KG` |

---

*Document generated from complete source code analysis of `c:/dev/ERP/rice-erp/` — September 2026.*  
*Version reflects the fully-implemented ledger profile system with PDF export, DnD reorder, unit conversion, and payment voucher integration.*
