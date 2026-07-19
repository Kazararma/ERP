# Rice-ERP: "Balance / PnL Section" — Technical Build Blueprint

> **Audience note (read first):** This document is written directly for the AI coding agent (Gemini Flash, running inside Antigravity IDE) that will implement this feature. Follow every phase **in sequence**. Do not skip ahead to UI polish before the data layer (Phase 3) is correct — in an ERP, a beautiful screen showing wrong numbers is worse than no screen at all.

---

## 0. Context You Must Respect

You are extending an existing production codebase, **Rice-ERP**. Do not introduce new libraries, state managers, styling systems, or PDF tools. Reuse what already exists:

| Concern | Existing Tool — REUSE THIS |
|---|---|
| Framework | React 18 + TypeScript 5 (strict mode) |
| Bundler | Vite 8 |
| Routing | React Router DOM v7 |
| Global state | Zustand v5 |
| Forms | React Hook Form + Zod |
| Database | Firebase Firestore (NoSQL, transaction-based) |
| Auth/Roles | Firebase Auth — `Admin` / `SuperAdmin` |
| UI Kit | Shadcn UI (Radix primitives) + Tailwind CSS v3 |
| Charts | Recharts |
| Icons | Lucide React |
| PDF Export | `@react-pdf/renderer` |

**Non-negotiable engineering principle carried over from the rest of the app:** this ERP's core philosophy is *strict data integrity*. Every write that touches financial totals (ledgers, inventory valuation, bank balances) MUST go through a Firestore Transaction (`runTransaction`), exactly like the existing Deals/Wages modules do. Never use a bare `updateDoc`/`setDoc` for anything that affects a balance.

---

## 1. Feature Overview

Build a new **"Balance / PnL Section"** with two tabs:

1. **Balance Sheet** — dual-column Tally Prime-style layout: **Liabilities on the left**, **Assets on the right**, both visible simultaneously on one screen (no separate sub-pages), each side individually scrollable, both columns totaled and cross-checked against each other.
2. **Profit & Loss** — a second tab (structure defined in Phase 1; logic can follow the same aggregation pattern established in Phase 3).

### 1.1 Balance Sheet Structure (mandatory field mapping)

> The exact group order and column placement below is taken directly from `exampleofupdate.jpeg` (a real Tally Prime Balance Sheet export). Match this structure — including which side each group appears on — exactly. Do not "correct" the placement of `Loans (Liability)` under Assets; that is standard Tally behavior (a liability-type group with a net contra/overdraft balance is displayed on the opposite column so the sheet nets correctly), and the reference screenshot confirms it belongs there.

**LIABILITIES (Left Column)** — in this order:
- **Capital Account** — manual/dynamic entry group (owner's equity accounts, e.g. proprietor name with drawings/capital balance). In the reference image this is a single named line (`BINAYAK SAMANTA`); support one or more named capital accounts as dynamic rows.
- **Current Liabilities**
  - Duties & Taxes — manual/dynamic entries
  - Provisions — manual/dynamic entries
  - **Sundry Creditors** — *system-computed*: sum across all **customer** ledger profiles of `(totalCredit − totalDebit)`, i.e. money the business owes back to customers (advances, overpayments). Only include ledger profiles typed `customer`.
- **Suspense A/c** — manual entry, catch-all for unreconciled amounts
- **Difference in Opening Balances** — manual entry, single reconciliation row (Tally auto-generates this when opening balances don't tie out; here it's an optional manual adjustment). Include the group but it may remain `0` / hidden if unused.

**ASSETS (Right Column)** — in this order:
- **Loans (Liability)** — manual/dynamic group. This group name is intentionally counterintuitive (see note above) — it holds liability-type accounts (e.g. `Bank OD A/c` — a bank overdraft) that Tally displays on the Assets side. Build it as a plain manual/dynamic entry group, visually identical to the other Assets groups, positioned first in the right column exactly as in the reference image.
- **Fixed Assets** — manual/dynamic group (e.g. Computer/Printer & Software, Land, Shop, Truck Purchase, Weighing equipment, etc., per the reference image). All manual/dynamic line items — no system computation for this group in this build.
- **Current Assets**
  - **Closing Stock** — *system-computed*: sum of the COGS-based valuation of all unsold inventory (Raw + Staged/Packed stock not yet Sold), pulled from the Inventory module's per-batch COGS tracking.
  - Deposits (Asset) — manual/dynamic entry
  - Loans & Advances (Asset) — manual/dynamic entry
  - **Sundry Debtors** — *system-computed*: sum across all **supplier** ledger profiles of the outstanding `closingBalance` (money the business still owes suppliers). Only include ledger profiles typed `supplier`.
  - **Cash-in-Hand** — *system-computed*: sum of all cash-designated payments received from customers (i.e., customer-side ledger entries or bank-transaction entries flagged `method: cash`).
  - **Bank Accounts** — *system-computed*: live reference to each Bank Account document's current principal balance, from the existing Wages & Bank module. Do not duplicate this data — read it directly. Render each account as its own sub-row (the reference image shows one netted figure, but per this project's requirements, break it out per-account — see Phase 4.3).
  - Additional manual insurance/tax sub-lines (e.g. LICI, Stock Insurance, TCS in the reference image) — supported generically via the "+ Add Line" affordance under Current Assets; do not hardcode these specific labels.
- **Profit & Loss A/c** — manual/dynamic group with two sub-lines: Opening Balance and Current Period. For this build, treat both as manual entries (a live-computed "Current Period" figure fed from the P&L tab is a natural fast-follow once Phase 3's pattern is extended to P&L — flag this, don't build it now).

> ⚠️ **Naming collision warning to resolve during Phase 3, not silently:** The prompt describes "Sundry Debtors" using supplier-ledger logic and "Sundry Creditors" using customer-ledger logic. This is **inverted from standard accounting terminology** (normally Sundry Debtors = customers who owe you, Sundry Creditors = suppliers you owe). The reference image only confirms *which column* each label sits in — it does not reveal this company's underlying formula. **Do not silently "correct" it.** Implement exactly the mapping given above (it is the business owner's explicit specification), but add an inline code comment and a UI tooltip on both labels clarifying the definition being used, so future maintainers aren't confused.

### 1.2 Editability & Dynamic Fields

- Every line item must be editable inline.
- Users can add arbitrary new line items ("dynamic fields") under any group (e.g., add a new Provision, a new Loan entry, a new Suspense line) via an "+ Add Line" affordance per section.
- System-computed fields (Closing Stock, Sundry Debtors, Sundry Creditors, Cash-in-Hand, Bank Accounts) are **read-only** — they display live aggregated values and are visually distinguished (e.g., a small "🔗 Synced" badge) from manually editable fields, but the user should still be able to add manual *adjustment* lines beside them if needed.

---

## Phase 1 — UI Scaffolding & Routing

**Objective:** Stand up the navigable shell with zero real data — static/mock structure only, wired into the existing app shell.

### 1.1 Routing
- Add a new route, e.g. `/balance-pnl`, registered in the existing React Router v7 route tree alongside `Deals`, `Ledger`, `Inventory`, `Wages`.
- Add a sidebar nav entry using an appropriate Lucide icon (e.g., `Scale` or `BookOpen`).
- Route must sit behind the existing role-based route guard — accessible to `Admin` and `SuperAdmin` (same tier as Ledgers/Inventory, not `/admin`-restricted).

### 1.2 Page Layout
- Create `BalancePnLPage.tsx` as the route entry component.
- Use Shadcn `Tabs` component for the two top-level tabs: `Balance Sheet` | `Profit & Loss`. Persist active tab in the URL (`?tab=balance-sheet`) so it's shareable/refreshable.

### 1.3 Balance Sheet Tab Layout

**Reference:** `exampleofupdate.jpeg` — a genuine Tally Prime export. Replicate its *structure* (columns, grouping, totals) using this project's own premium visual language (Indigo/Violet/Slate/Emerald, Shadcn cards, soft shadows) — do not literally reskin Tally's grey/blue enterprise-legacy look.

- Two-column CSS grid (`grid-cols-1 lg:grid-cols-2`), collapsing to stacked on mobile.
- Left column header: **"Liabilities"** — right column header: **"Assets"**. Directly under each header, show the entity/mill name and the reporting date (mirrors `M/S CHAMUNDA BUILDERS — 25-26` / `as at 21-Sep-25` in the reference image) — pull mill name from existing app settings, date defaults to "today" with a date picker to view historical snapshots if that capability already exists elsewhere in the app (otherwise scope to current-date only).
- Each column is composed of nested Shadcn `Card` components, **one per group, in the exact order specified in §1.1**:
  - Left: Capital Account → Current Liabilities (with Duties & Taxes / Provisions / Sundry Creditors as sub-rows) → Suspense A/c → Difference in Opening Balances.
  - Right: Loans (Liability) → Fixed Assets → Current Assets (with Closing Stock / Deposits / Loans & Advances / Sundry Debtors / Cash-in-Hand / Bank Accounts / other manual sub-lines) → Profit & Loss A/c.
- Group header rows for multi-line groups (e.g. "Current Liabilities", "Current Assets") should visually echo the reference image's highlighted group-total row (amber/highlighted band with the group's running subtotal right-aligned) — use an Emerald/Indigo-tinted background instead of Tally's amber, consistent with this app's palette, but keep the same functional pattern: group name + bold subtotal on one row, indented line items below.
- Sub-line items are indented and italicized/muted for their label (matching the reference image's treatment of named sub-accounts like `BINAYAK SAMANTA` or `Bank OD A/c`), with the amount right-aligned in a monospace or tabular-nums font for column alignment.
- Within each Card, render line items as rows: `Label | Editable Amount Input | (optional delete icon for user-added rows)`.
- Sticky footer row per column showing **Total Liabilities** / **Total Assets** (mirrors the bold `Total` row at the bottom of the reference image, ruled off with a top border), plus a top-level banner showing whether the sheet is balanced (`Total Assets − Total Liabilities === 0`), styled green if balanced, amber/red with the delta amount if not.
- "+ Add Line" ghost-button at the bottom of each editable group (Capital Account, Current Liabilities → Duties & Taxes, → Provisions, Suspense A/c, Difference in Opening Balances, Loans (Liability), Fixed Assets, Current Assets → Deposits/Loans & Advances/other manual sub-lines, Profit & Loss A/c). Do **not** add this button directly to system-computed rows (Closing Stock, Sundry Debtors, Sundry Creditors, Cash-in-Hand, Bank Accounts) — those render from live data only, though the "+ Add Line" on their parent group (Current Assets / Current Liabilities) can still be used to add unrelated manual sub-lines alongside them.
- Follow existing visual language: Indigo/Violet primaries, Slate/Emerald accents, soft `shadow-sm`/`shadow-md`, rounded cards, muted secondary text for sub-labels — match the aesthetic already established in the Ledger and Inventory screens. Reuse existing Tailwind theme tokens; do not introduce new colors.

### 1.4 Profit & Loss Tab Layout (scaffold only in this phase)
- Mirror the same dual-column philosophy: **Expenses (Left)** vs **Income (Right)**, with Gross Profit/Net Profit computed at the bottom.
- For this phase, scaffold the Card/column structure with placeholder groups; full aggregation logic for P&L is out of scope for the 4 phases below unless you extend Phase 3's pattern — note this as a fast-follow.

### 1.5 Deliverables checklist for Phase 1
- [ ] Route added and guarded correctly
- [ ] Sidebar nav entry added
- [ ] Tabs component with URL-synced state
- [ ] Balance Sheet dual-column static UI with all groups from section 1.1 present (hardcoded placeholder values, `0`)
- [ ] "+ Add Line" buttons present (non-functional stub `onClick` for now)
- [ ] Responsive on mobile (stacked columns)
- [ ] Visually consistent with existing Ledger/Inventory screens

---

## Phase 2 — State Management (Zustand) for Dynamic Fields

**Objective:** Model the Balance Sheet as client state that supports arbitrary user-added rows, before wiring to Firestore.

### 2.1 Store shape
Create `useBalanceSheetStore.ts` (Zustand). Model each editable group as an array of line items:

```ts
interface BalanceLineItem {
  id: string;            // uuid, generated client-side for new rows
  label: string;
  amount: number;
  isSystemComputed: boolean;  // true = read-only, sourced from Firestore aggregation
  source?: 'closingStock' | 'sundryDebtors' | 'sundryCreditors' | 'cashInHand' | 'bankAccount';
  bankAccountId?: string;      // only when source === 'bankAccount'
}

interface BalanceSheetGroup {
  key: string;             // 'capitalAccount' | 'currentLiabilities.dutiesAndTaxes' | 'currentLiabilities.provisions' | 'currentLiabilities.sundryCreditors' | 'suspenseAcLiabilities' | 'differenceInOpeningBalances' | 'loansLiabilityAssets' | 'fixedAssets' | 'currentAssets.closingStock' | 'currentAssets.deposits' | 'currentAssets.loansAndAdvances' | 'currentAssets.sundryDebtors' | 'currentAssets.cashInHand' | 'currentAssets.bankAccounts' | 'profitAndLossAc' | ...
  title: string;
  side: 'liabilities' | 'assets';
  items: BalanceLineItem[];
  allowManualAdd: boolean;
}

interface BalanceSheetState {
  groups: BalanceSheetGroup[];
  lastSyncedAt: Timestamp | null;
  isSyncing: boolean;

  addLineItem: (groupKey: string, item: Omit<BalanceLineItem, 'id'>) => void;
  updateLineItem: (groupKey: string, id: string, patch: Partial<BalanceLineItem>) => void;
  removeLineItem: (groupKey: string, id: string) => void;
  hydrateSystemComputedGroups: (data: AggregatedFinancials) => void; // called by Phase 3 output
  totalsBySide: () => { liabilities: number; assets: number; delta: number };
}
```

### 2.2 Validation with Zod
- Define a `balanceLineItemSchema` (Zod) mirroring `BalanceLineItem`, enforcing:
  - `label`: non-empty string, max 80 chars
  - `amount`: number, finite, and — critically — allow negative values only where accounting convention permits (e.g., contra entries); otherwise `.nonnegative()`
- Wire every "Add Line" and inline-edit input through **React Hook Form**, using `zodResolver(balanceLineItemSchema)` per row or per add-line modal (a Shadcn `Dialog`/`Drawer`, consistent with how the Ledger's "Manual Entry" drawer already works — reuse that drawer pattern).
- On submit, call the appropriate store action (`addLineItem` / `updateLineItem`). Do not let unvalidated data enter the Zustand store.

### 2.3 Persistence boundary (important)
- Zustand here is **UI/session state**, not the source of truth. Manual line items must be persisted to Firestore (new collection, see Phase 3.4) on save — don't rely on Zustand alone or a refresh will lose data.
- System-computed groups are **never** written back by the client — they are always derived/read, never mutated through this store's persistence path.

### 2.4 Deliverables checklist for Phase 2
- [ ] Zustand store created with typed actions
- [ ] Zod schemas for every line-item shape
- [ ] React Hook Form wired for Add/Edit flows via existing Drawer/Dialog pattern
- [ ] `totalsBySide()` selector correctly sums both columns live as items are added/edited/removed
- [ ] Manual items are distinguishable in state (`isSystemComputed: false`) from synced ones

---

## Phase 3 — Firestore Aggregation Logic

**Objective:** Compute the five system-driven figures correctly, efficiently, and consistently with the rest of the app's transaction-safety guarantees.

> **Read-heavy, not write-heavy:** Unlike Deals/Wages, this feature mostly *reads and aggregates* existing collections rather than mutating them. You do NOT need a Firestore Transaction for the aggregation reads themselves (transactions are for atomic read-modify-write). However, any **manual Balance Sheet line item** the user adds/edits/deletes DOES need transactional writes if it affects a total that's also read elsewhere — apply the same `runTransaction` discipline used in the Ledger's manual-entry feature.

### 3.1 Collections you will read (do not modify their schemas)
Assume (confirm against actual codebase before coding) the following existing collections:
- `ledgerProfiles` — docs with `type: 'supplier' | 'customer'`, `totalDebit`, `totalCredit`, `closingBalance`.
- `deals` / `inventoryBatches` — docs tracking `rawWeight`, `stagedWeight`, `soldWeight`, and `costPerUnit` (COGS) per batch, per the Inventory module's progress-bar logic.
- `bankAccounts` — docs with `name`, `currentBalance`.
- `bankTransactions` (or ledger entries with a `method` field) — used to isolate cash-designated receipts.

**Action required before writing aggregation code:** Inspect the actual Firestore schema in the codebase (collection names, field names) — the names above are inferred from the summary doc and may not match exactly. Do not guess field names blindly; grep the existing Deals/Ledger/Wages components for their Firestore read calls and mirror the exact field names found there.

### 3.2 Aggregation formulas (per the business owner's explicit mapping — see §1.1 warning)

```
Closing Stock (Asset)
  = Σ over all inventory batches of:
      (rawWeight_remaining + stagedWeight_remaining) × costPerUnit_of_that_batch
    // "Sold" weight is excluded — only unsold stock counts.

Sundry Debtors (Asset)
  = Σ over ledgerProfiles where type === 'supplier' of closingBalance
    // money the business still owes suppliers

Sundry Creditors (Liability)
  = Σ over ledgerProfiles where type === 'customer' of (totalCredit − totalDebit)
    // money the business owes back to customers (net credit position)

Cash-in-Hand (Asset)
  = Σ of customer-side ledger/bank entries where method === 'cash'
    // "sum of money received from customers" via cash channel

Bank Accounts (Asset)
  = Σ over bankAccounts of currentBalance
    // list each account as its own line item AND show the group total
```

### 3.3 Implementation approach
- Create `services/balanceSheetAggregation.ts` exporting one async function per formula above, plus a composed `getAggregatedFinancials(): Promise<AggregatedFinancials>` that runs them (use `Promise.all` for parallel reads — these are independent queries).
- For **Closing Stock**, do the per-batch multiplication in application code after fetching batch docs — do not attempt this as a Firestore query (Firestore can't do computed sums server-side); fine for current data volume, but add a code comment flagging this as a candidate for a Cloud Function + aggregation doc if the batch count grows large (see 3.5).
- Use Firestore's `getCountFromServer`/`getAggregateFromServer` (`sum()`, `count()`) where the field-level sum aligns exactly with a stored field (e.g., summing `currentBalance` across `bankAccounts`, or `closingBalance` across filtered `ledgerProfiles`) — this avoids pulling every document down to the client and is more efficient than manual reduce. Fall back to manual reduction only where computed multiplication (Closing Stock) is required.
- Each aggregation function must independently handle empty collections (return `0`, not `undefined`/`NaN`) and log a console warning (not throw) if a document is missing an expected field, so one malformed doc doesn't crash the whole Balance Sheet.

### 3.4 New Firestore collection for manual entries
- Create `balanceSheetManualEntries` collection: `{ id, side: 'liabilities'|'assets', groupKey, label, amount, createdBy, updatedAt }`.
- Writes to this collection (add/edit/delete) go through `runTransaction` when the operation must remain consistent with a simultaneously-displayed total (in practice here: simple sequential single-doc writes are acceptable since these don't compete with other concurrent financial operations the way Deals/Wages do — but re-read the doc inside the transaction if you build an "adjustment" feature that reads-then-writes based on a computed total, to avoid stale-read races).

### 3.5 Performance note (flag, don't necessarily build yet)
- At current expected scale (single mill/trader business), client-side aggregation on page load is fine. Add a code comment noting that if ledger/inventory document counts grow into the thousands, this should migrate to a Cloud Function that maintains a single `financialSummary` document updated incrementally via Firestore triggers — out of scope for this build, but leave the aggregation functions cleanly separated (in `services/`, not inline in components) so that swap is easy later.

### 3.6 Deliverables checklist for Phase 3
- [ ] `services/balanceSheetAggregation.ts` with 5 typed async functions + 1 composed function
- [ ] Verified actual Firestore field/collection names against existing codebase (not assumed)
- [ ] Empty-state and malformed-doc handling in every aggregation function
- [ ] `balanceSheetManualEntries` collection + CRUD functions, transactional where race conditions are possible
- [ ] Used `getAggregateFromServer`/`sum()` where applicable instead of full-collection client reduction

---

## Phase 4 — Connecting Data to UI

**Objective:** Wire Phase 3's live data into Phase 1's UI via Phase 2's store, and finish the interactive experience.

### 4.1 Data hydration
- On `BalancePnLPage` mount, call `getAggregatedFinancials()` (Phase 3.3), then call `hydrateSystemComputedGroups()` (Phase 2.1) to populate the read-only rows in the Zustand store.
- In parallel, fetch `balanceSheetManualEntries` (Phase 3.4) and merge into the corresponding editable groups in the store.
- Show a loading skeleton (Shadcn `Skeleton` components matching card shapes) while both fetches resolve — do not show `0` values during load, as that could be misread as an actual empty balance sheet.
- Store `lastSyncedAt` and render a small "Synced Xs ago" indicator near the top, with a manual refresh icon button that re-runs the aggregation.

### 4.2 Live totals & balance-check banner
- Wire `totalsBySide()` from the store to the sticky footer totals built in Phase 1.
- Implement the balanced/unbalanced banner: green check + "Balanced" when `delta === 0` (allow a small epsilon, e.g. `Math.abs(delta) < 0.01`, to guard against floating-point rounding); otherwise show the exact delta amount and which side is short, in amber/red.

### 4.3 Editing flow
- Wire the per-row inline amount input (manual items only) to `updateLineItem`, debounced (e.g. 500ms) before persisting to Firestore, or persist explicitly on blur — choose blur-based commit for financial data to avoid partial/accidental writes on every keystroke.
- Wire "+ Add Line" buttons to open the Drawer/Dialog built in Phase 2.2; on submit, call `addLineItem` and persist to `balanceSheetManualEntries`.
- Wire the delete icon (manual items only) to a confirmation `AlertDialog` (Shadcn) before calling `removeLineItem` + deleting the Firestore doc — never allow silent deletion of a financial line item.
- System-computed rows: clicking them should not open an edit form; instead, show a small popover/tooltip explaining the source (e.g., "Synced from 3 supplier ledgers" or "Synced from Bank Accounts: SBI Current, Cash Box"). For **Bank Accounts**, render each account as its own read-only sub-row (not just one lump sum) so the user can trace it back to the Wages & Bank module.

### 4.4 PDF export (consistency with existing pattern)
- Reuse the existing `@react-pdf/renderer` setup from the Ledger module's "Export PDF" feature to add an "Export Balance Sheet PDF" button, replicating the dual-column layout and the same customizable header (Mill Name) already used for ledger statements.

### 4.5 Deliverables checklist for Phase 4
- [ ] Live data replaces all placeholder values from Phase 1
- [ ] Loading skeleton state implemented (no flash of `0`)
- [ ] Balanced/unbalanced banner working with epsilon tolerance
- [ ] Manual edit/add/delete fully wired to Firestore with confirmation on delete
- [ ] System-computed rows are read-only with source tooltip/popover
- [ ] Bank Accounts broken into per-account sub-rows, traceable to Wages & Bank module
- [ ] PDF export implemented, matching existing Ledger PDF style

---

## 5. Cross-Phase Guardrails (apply throughout)

1. **TypeScript strict mode**: no `any`. Define all interfaces (`BalanceLineItem`, `BalanceSheetGroup`, `AggregatedFinancials`, etc.) in a shared `types/balanceSheet.ts`.
2. **Zod is the single source of truth for validation** — do not duplicate validation logic ad hoc inside components.
3. **Never let a manual entry silently overwrite a system-computed field** — enforce this at the type level (`isSystemComputed: boolean` should gate the UI's editability, and ideally also gate the Firestore write path, e.g. Firestore Security Rules rejecting writes to `balanceSheetManualEntries` docs with a `source` field set).
4. **Match existing visual language exactly** — no new color tokens, no new component library. If a Shadcn component you need doesn't exist yet in the project, install it via the existing Shadcn CLI convention already used elsewhere in the repo.
5. **Role gating**: confirm this route/module is visible to `Admin` and `SuperAdmin` only, consistent with Ledgers/Inventory/Wages — not the `/admin`-only SuperAdmin routes.
6. **Do not fabricate field names.** Before Phase 3, grep the actual codebase for real Firestore collection/field names in the Ledger, Deals, Inventory, and Wages modules and use those exact names. If a needed field doesn't exist yet (e.g., no `method: 'cash'` flag on ledger entries for Cash-in-Hand), flag this back to the user as a schema gap rather than inventing a workaround.
7. **Build order is mandatory**: Phase 1 → 2 → 3 → 4. Do not wire real Firestore data into unfinished UI, and do not build aggregation logic before the state shape it feeds into is defined.

---

## 6. Open Questions to Surface Back to the Business Owner (do not silently assume)

- Confirm the Sundry Debtors/Creditors terminology mapping in §1.1 is intentional (it's inverted vs. standard accounting usage) — the reference image confirms *placement* but not the underlying formula.
- Confirm whether Cash-in-Hand should also net out cash paid *out* (e.g., cash wages, cash purchases) or only track cash *received* from customers, as literally specified.
- Confirm whether Fixed Assets, Loans (Liability), Suspense A/c, Difference in Opening Balances, and Profit & Loss A/c need to be fully functional in v1, or can ship as empty/manual-only groups purely to complete the visual structure shown in the reference image (this blueprint assumes the latter — manual-only for now).
- Confirm P&L tab's income/expense field mapping (not fully specified in the original brief) before extending Phase 3's aggregation pattern to it.
