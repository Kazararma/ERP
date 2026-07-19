# RISE ERP - Detailed Technical and Functional Summary

RISE ERP (Rice Merchant ERP) is a state-of-the-art, premium Enterprise Resource Planning application custom-built for Rice Merchants, Traders, and Mill Operators. It tracks the complete rice lifecycle from purchasing raw grain, staging/milling, and selling finished bags, to inventory management, profit/loss calculations, employee wages, and security roles.

This document serves as a comprehensive guide to the system's architecture, technology stack, data models, and functional modules, with a special emphasis on the **Ledger** and **Wages** sections, tailored for AI ingestion and context building.

---

## 🛠️ Technology Stack

The project features a modern, performant, and decoupled tech stack leveraging serverless resources for security, scalability, and speed.

| Layer | Technology | Details / Purpose |
| :--- | :--- | :--- |
| **Core Framework** | React 18 | Component-driven UI rendering and state-driven DOM updates. |
| **Routing** | React Router DOM v7 | Client-side routing with route guarding for auth/permissions. |
| **Build Tool** | Vite 8 | High-performance bundling and fast hot module replacement. |
| **Language** | TypeScript 5 | Strict type definitions ensuring compile-time safety. |
| **Database** | Firebase Firestore | NoSQL document database used for real-time data sync and transaction isolation. |
| **Authentication** | Firebase Auth | Handles secure user sign-in via Google Authentication. |
| **Styling** | Tailwind CSS v3 | Utility-first styling supplemented with custom animations and variables. |
| **State Management**| Zustand v5 | Lightweight, fast global store for auth status and UI states. |
| **Charts / Viz** | Recharts v3 | Renders dynamic dashboards with interactive trendlines. |
| **Form Handling** | React Hook Form v7| Manages form state, submission lifecycle, and input performance. |
| **Validation** | Zod v4 | Schema definitions and runtime validation for form payloads. |
| **PDF Generation** | @react-pdf/renderer | Generates pixel-perfect PDF client invoices directly in the browser. |

---

## 💎 Features & Functional Modules

### Executive Dashboard
- **Financial KPIs**: Highlights Total Revenue, Net Profit, Staged Stock, and Raw Stock using stylized visual panels.
- **Visual Trends**: Embeds a dual-line spline chart tracking daily Revenue vs. Profit progression.
- **Recent Activity**: Lists recent sales orders alongside direct shortcuts to general ledger detail screens.

### Trading Hub
- **Purchasing (Bought)**: Handles vendor contacts and logs bulk raw material purchases.
- **Milling (Staging)**: Packages bulk loose grains into retail-ready bags (e.g., 50kg, 25kg bags).
- **Sales (Sold)**: Handles customer relationships and registers outgoing client shipments, dynamically allocating stock from staging batches.

### Real-Time Stock Room (Inventory)
- **Dynamic Bars**: Progress bars visualizing the ratio of Raw vs. Staged vs. Sold material per deal.
- **Stock Tracking**: Quantitative cards split into loose raw weight, packaged bag counts, and total bulk sold.
- **Depletion Tagging**: Automates tags for current stock status (`in_stock`, `partial`, `exhausted`).

---

## 📕 Deep Dive: Ledger Section

The **Ledger Module** is the financial backbone of the RISE ERP, built to guarantee data integrity through isolated Firestore Transactions. This ensures calculations remain consistent even under concurrent usage.

### Core Ledger Features:
1. **Financial Log & Indexing**: A centralized index of all historical verified transactions. It tracks every cash inflow (sales) and outflow (purchases, labor/wages).
2. **Cost of Goods Sold (COGS) Breakdown**: The ledger provides a highly detailed view of the origins of each sold item. It breaks down every line item in an order to show exactly which staging batch and which raw supplier the grain came from. This enables pinpoint accuracy for individual allocation costs and real profit margins.
3. **Transaction Immutability**: Once an order or a purchase is confirmed, it is finalized within the database via a transactional block. Stock is depleted, revenue/profit is calculated, and the ledger entry is locked.
4. **Automated PDF Invoicing**: Integrates `@react-pdf/renderer` (`src/components/pdf/`) to automatically generate structured billing receipts in PDF format. Operators can download client invoices with a single click from the ledger detail screens.
5. **Customer and Supplier Sub-ledgers**: The UI components are modularized (`src/components/ledger/customer` and `src/components/ledger/supplier`) to separate accounts payable (suppliers) from accounts receivable (customers), ensuring streamlined views for operators tracking outstanding debts.

### Ledger Data Models & Workflows:
The ledger relies on the intersection of the `deals`, `stagingBatches`, `orders`, and `allocations` collections. 
When an order is confirmed, a Firebase transaction executes that:
- Reads the order and associated allocations.
- Validates availability against `stagingBatches`.
- Deducts stock and updates statuses to `exhausted` or `partial`.
- Automatically calculates and locks in the `totalCostOfGoods` and `profit` on the `Order` document, finalizing the ledger entry.

---

## 👷 Deep Dive: Wages Section

The **Wages Module** handles internal workforce management and labor costs, critical for an operation running mills and staging facilities. All UI elements for this reside in `src/components/wages/`.

### Core Wage Features:
1. **Staff Registry (`EmployeeCard.tsx` / `EmployeeForm.tsx`)**: 
   - Maintains a detailed list of all employees operating the mill/storage facilities.
   - Categorizes workers by contract type: explicitly distinguishing between **monthly** contract workers (fixed salary) and **daily** wage workers (paid per day/shift).
2. **Wage Disbursement Log**: 
   - Records the days worked for each employee.
   - Logs specific salary amounts, payment schedules, and pay history.
   - Maintains a historical record of all payments made, allowing labor costs to be cross-referenced against the general ledger for holistic operational cost tracking.
3. **Pay Wage Modal (`PayWageModal.tsx`)**: 
   - A dedicated interactive interface for authorizing and issuing payments to employees.
   - Streamlines the workflow for administrators to input hours/days worked for daily earners and process their payouts securely.
4. **Workforce Dashboard (`WagesPage.tsx`)**: 
   - Central hub for Admins and SuperAdmins to oversee total payroll expenses, review upcoming pay periods, and manage employee profiles seamlessly.

---

## 🔐 Security & Architecture

### User Access & Roles
- **Firebase Auth** + **Firestore Security Rules** protect the database at the query level.
- **Roles**:
  - `SuperAdmin`: Accesses all modules, manages user approvals, and promotes roles.
  - `Admin`: Standard business operators (manages suppliers, deals, inventory, sales, payroll).
- **Status Pipeline**: New accounts start as `pending` (locked out) until approved to `active` by a SuperAdmin.

### Data Model Overview
- **Users**: Access mappings (`uid`, `role`, `status`).
- **Suppliers & Customers**: CRM baseline entries.
- **Deals & Staging Batches**: Purchases and raw processing batches.
- **Orders & Allocations**: Sales, revenue, profit, and batch mapping.
- **Inventory**: Consolidated stock tracking for quick dashboard rendering.
