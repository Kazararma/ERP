// src/stores/useBalanceSheetStore.ts
// Phase 2 — Zustand store for Balance Sheet dynamic fields.
//
// IMPORTANT: This store is client-side UI/session state ONLY in Phase 2.
// Manual line items are NOT yet persisted to Firestore — that is Phase 3/4.
// A page refresh will reset all manually added rows until Phase 4 wires persistence.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BalanceLineItem,
  BalanceSheetGroup,
  AggregatedFinancials,
  GroupKey,
  RowAdjustment,
  BalanceSide,
} from "@/types/balanceSheet";

// ─── Default Group Scaffold ────────────────────────────────────────────────────
// Pre-populates all groups from blueprint §1.1 in the correct order with zero
// amounts. System-computed rows are seeded here with isSystemComputed: true;
// they will be replaced by Phase 3's hydrateSystemComputedGroups().

function makeId(): string {
  return crypto.randomUUID();
}

export const DEFAULT_GROUPS: BalanceSheetGroup[] = [
  // ── LIABILITIES (Left Column) ────────────────────────────────────────────

  {
    key: "capitalAccount",
    title: "Capital Account",
    side: "liabilities",
    allowManualAdd: true,
    items: [
      {
        id: makeId(),
        label: "Proprietor Capital A/c",
        amount: 0,
        isSystemComputed: false,
      },
    ],
  },

  {
    key: "currentLiabilities.dutiesAndTaxes",
    title: "Duties & Taxes",
    side: "liabilities",
    allowManualAdd: true,
    items: [
      {
        id: makeId(),
        label: "Output GST (5% on Sales)",
        amount: 0,
        isSystemComputed: true,
        source: "outputGst",
      },
      {
        id: makeId(),
        label: "Input GST (5% on Purchases)",
        amount: 0,
        isSystemComputed: true,
        source: "inputGst",
      },
    ],
  },

  {
    key: "currentLiabilities.provisions",
    title: "Provisions",
    side: "liabilities",
    allowManualAdd: true,
    items: [
      {
        id: makeId(),
        label: "Provision for Expenses",
        amount: 0,
        isSystemComputed: false,
      },
    ],
  },

  {
    // NOTE: "Sundry Creditors" here = sum of customer ledger (totalCredit − totalDebit)
    // = money owed BACK to customers. This is intentionally inverted from standard
    // accounting terminology per the business owner's specification. See blueprint §1.1.
    key: "currentLiabilities.sundryCreditors",
    title: "Sundry Creditors",
    side: "liabilities",
    allowManualAdd: false, // system-computed; no manual add directly on this row
    items: [
      {
        id: makeId(),
        label: "Customer Advance / Overpayments",
        amount: 0,
        isSystemComputed: true,
        source: "sundryCreditors",
      },
    ],
  },

  {
    key: "suspenseAc",
    title: "Suspense A/c",
    side: "liabilities",
    allowManualAdd: true,
    items: [
      {
        id: makeId(),
        label: "Unreconciled entries",
        amount: 0,
        isSystemComputed: false,
      },
    ],
  },

  {
    key: "differenceInOpeningBalances",
    title: "Difference in Opening Balances",
    side: "liabilities",
    allowManualAdd: true,
    items: [
      {
        id: makeId(),
        label: "Opening Balance Difference",
        amount: 0,
        isSystemComputed: false,
      },
    ],
  },

  // ── ASSETS (Right Column) ───────────────────────────────────────────────

  {
    // NOTE: "Loans (Liability)" sits on the Assets side per Tally Prime convention.
    // It holds liability-type accounts (e.g. Bank OD A/c) displayed on Assets
    // so the sheet nets correctly. See blueprint §1.1.
    key: "loansLiability",
    title: "Loans (Liability)",
    side: "assets",
    allowManualAdd: true,
    items: [
      { id: makeId(), label: "Bank OD A/c", amount: 0, isSystemComputed: false },
      { id: makeId(), label: "Other Loan Accounts", amount: 0, isSystemComputed: false },
    ],
  },

  {
    key: "fixedAssets",
    title: "Fixed Assets",
    side: "assets",
    allowManualAdd: true,
    items: [
      { id: makeId(), label: "Computer / Printer & Software", amount: 0, isSystemComputed: false },
      { id: makeId(), label: "Land", amount: 0, isSystemComputed: false },
      { id: makeId(), label: "Shop / Building", amount: 0, isSystemComputed: false },
      { id: makeId(), label: "Truck / Vehicle", amount: 0, isSystemComputed: false },
      { id: makeId(), label: "Weighing Equipment", amount: 0, isSystemComputed: false },
    ],
  },

  {
    key: "currentAssets.closingStock",
    title: "Closing Stock",
    side: "assets",
    allowManualAdd: false,
    items: [
      {
        id: makeId(),
        label: "Unsold Inventory (Raw + Packed)",
        amount: 0,
        isSystemComputed: true,
        source: "closingStock",
      },
    ],
  },

  {
    key: "currentAssets.deposits",
    title: "Deposits (Asset)",
    side: "assets",
    allowManualAdd: true,
    items: [
      { id: makeId(), label: "Security Deposits", amount: 0, isSystemComputed: false },
    ],
  },

  {
    key: "currentAssets.loansAndAdvances",
    title: "Loans & Advances (Asset)",
    side: "assets",
    allowManualAdd: true,
    items: [
      { id: makeId(), label: "Advances to Suppliers", amount: 0, isSystemComputed: false },
    ],
  },

  {
    // NOTE: "Sundry Debtors" here = sum of supplier ledger closingBalance
    // = money the business still OWES to suppliers. Inverted from standard
    // accounting (where Sundry Debtors = customers who owe you). Business
    // owner's explicit specification. See blueprint §1.1.
    key: "currentAssets.sundryDebtors",
    title: "Sundry Debtors",
    side: "assets",
    allowManualAdd: false,
    items: [
      {
        id: makeId(),
        label: "Outstanding Supplier Balances",
        amount: 0,
        isSystemComputed: true,
        source: "sundryDebtors",
      },
    ],
  },

  {
    key: "currentAssets.cashInHand",
    title: "Cash-in-Hand",
    side: "assets",
    allowManualAdd: false,
    items: [
      {
        id: makeId(),
        label: "Cash Received from Customers",
        amount: 0,
        isSystemComputed: true,
        source: "cashInHand",
      },
    ],
  },

  {
    key: "currentAssets.bankAccounts",
    title: "Bank Accounts",
    side: "assets",
    allowManualAdd: true,
    items: [
      {
        id: makeId(),
        label: "— (Bank accounts synced from Wages & Bank module in Phase 4)",
        amount: 0,
        isSystemComputed: true,
        source: "bankAccount",
      },
    ],
  },

  {
    key: "profitAndLossAc",
    title: "Profit & Loss A/c",
    side: "assets",
    allowManualAdd: true,
    items: [
      { id: makeId(), label: "Opening Balance", amount: 0, isSystemComputed: false },
      {
        id: makeId(),
        label: "Current Period P&L (fast-follow — Phase 3 extension)",
        amount: 0,
        isSystemComputed: false,
      },
    ],
  },

  // ── P&L EXPENSES (Left Column) ──────────────────────────────────────────

  {
    key: "pnl.cogs",
    title: "Cost of Goods Sold",
    side: "expenses",
    allowManualAdd: true,
    items: [
      {
        id: makeId(),
        label: "Raw Material Purchases",
        amount: 0,
        isSystemComputed: true,
        source: "totalPurchases",
      },
    ],
  },
  {
    key: "pnl.operatingExpenses",
    title: "Operating Expenses",
    side: "expenses",
    allowManualAdd: true,
    items: [
      {
        id: makeId(),
        label: "Wages & Transport",
        amount: 0,
        isSystemComputed: true,
        source: "operatingExpenses",
      },
    ],
  },

  // ── P&L INCOME (Right Column) ───────────────────────────────────────────

  {
    key: "pnl.salesRevenue",
    title: "Sales Revenue",
    side: "income",
    allowManualAdd: true,
    items: [
      {
        id: makeId(),
        label: "Rice Sales",
        amount: 0,
        isSystemComputed: true,
        source: "salesRevenue",
      },
    ],
  },
  {
    key: "pnl.otherIncome",
    title: "Other Income",
    side: "income",
    allowManualAdd: true,
    items: [
      {
        id: makeId(),
        label: "Misc Income",
        amount: 0,
        isSystemComputed: false,
      },
    ],
  },
];

// ─── Store Types ───────────────────────────────────────────────────────────────

interface BalanceSheetState {
  groups: BalanceSheetGroup[];
  deletedSystemItemIds: string[];
  parentTitles: Record<string, string>;
  isSyncing: boolean;
  rowAdjustments: Record<string, RowAdjustment[]>;
  systemEntryOverrides: Record<string, Record<string, { hidden: boolean; overrideAmount?: number }>>;

  // Actions
  addGroup: (group: Omit<BalanceSheetGroup, "items">) => void;
  removeGroup: (groupKey: string) => void;
  restoreGroup: (groupKey: string) => void;
  renameGroup: (groupKey: string, newTitle: string) => void;
  renameParentGroup: (parentKey: string, newTitle: string) => void;
  restoreLiveItems: (groupKey: string) => void;
  addLineItem: (groupKey: GroupKey | string, item: Omit<BalanceLineItem, "id">) => void;
  addGroupWithItem: (params: { groupKey: string, groupTitle: string, side: BalanceSide, itemLabel: string, amount: number }) => void;
  updateLineItem: (groupKey: GroupKey | string, id: string, patch: Partial<Pick<BalanceLineItem, "label" | "amount">>) => void;
  removeLineItem: (groupKey: GroupKey | string, id: string) => void;
  restoreLiveItemAmount: (groupKey: string, id: string) => void;
  hydrateSystemComputedGroups: (data: AggregatedFinancials) => void;
  setManualEntries: (entries: any[]) => void;
  applyRowReceipt: (params: { rowId: string; delta: number; reason?: string }) => void;
  updateRowAdjustment: (rowId: string, adjId: string, newDelta: number) => void;
  deleteRowAdjustment: (rowId: string, adjId: string) => void;
  clearRowAdjustments: (groupKey: string, rowId: string) => void;
  updateSystemEntryOverride: (rowId: string, breakdownId: string, delta: number, overrideData: { hidden: boolean; overrideAmount?: number }) => void;
  restoreMicroRowData: (rowId: string) => void;
  resetToDefault: () => void;
  restoreAllLiveDetails: () => void;

  // Selector
  totalsBySide: () => { liabilities: number; assets: number; delta: number; expenses: number; income: number; netProfit: number };
}

// ─── Store Implementation ──────────────────────────────────────────────────────

export const useBalanceSheetStore = create<BalanceSheetState>()(
  persist(
    (set, get) => ({
      groups: DEFAULT_GROUPS,
      deletedSystemItemIds: [],
      parentTitles: {},
      isSyncing: false,
      rowAdjustments: {},
      systemEntryOverrides: {},

  addGroup: (groupDef) => {
    // Guard: prevent duplicate keys
    const existing = get().groups.find((g) => g.key === groupDef.key);
    if (existing) {
      console.warn(`[BalanceSheet] Group key "${groupDef.key}" already exists — skipped.`);
      return;
    }
    set((state) => ({
      groups: [
        ...state.groups,
        {
          ...groupDef,
          items: [], // new group starts empty
        },
      ],
    }));
  },

  removeGroup: (groupKey) => {
    set((state) => ({
      groups: state.groups.filter((g) => g.key !== groupKey),
    }));
  },

  restoreGroup: (groupKey) => {
    const template = DEFAULT_GROUPS.find((g) => g.key === groupKey);
    if (!template) {
      console.warn(`[BalanceSheet] No default template found for key "${groupKey}"`);
      return;
    }

    set((state) => {
      // Guard: already present
      if (state.groups.some((g) => g.key === groupKey)) return state;

      // Re-create items with fresh IDs so there are no stale ID collisions
      const restoredGroup: BalanceSheetGroup = {
        ...template,
        items: template.items.map((item) => ({ ...item, id: makeId() })),
      };

      // Insert at the same relative position as in DEFAULT_GROUPS
      const defaultIndex = DEFAULT_GROUPS.findIndex((g) => g.key === groupKey);
      const defaultKeys = DEFAULT_GROUPS.map((g) => g.key);

      // Find the best insertion point: after the last group that appears
      // before groupKey in DEFAULT_GROUPS and is currently present.
      const currentKeys = state.groups.map((g) => g.key);
      let insertAt = 0;
      for (let i = defaultIndex - 1; i >= 0; i--) {
        const prevKey = defaultKeys[i];
        const idx = currentKeys.indexOf(prevKey);
        if (idx !== -1) {
          insertAt = idx + 1;
          break;
        }
      }

      const newGroups = [...state.groups];
      newGroups.splice(insertAt, 0, restoredGroup);
      return { groups: newGroups };
    });
  },

  restoreLiveItems: (groupKey) => {
    const template = DEFAULT_GROUPS.find((g) => g.key === groupKey);
    if (!template) return;

    set((state) => {
      // If restoring bank accounts, clear their deleted tracking
      const newDeletedIds = groupKey === "currentAssets.bankAccounts" 
        ? state.deletedSystemItemIds.filter(id => !id.startsWith("bank-"))
        : state.deletedSystemItemIds;

      return {
        deletedSystemItemIds: newDeletedIds,
        groups: state.groups.map((g) => {
        if (g.key === groupKey) {
          const defaultLiveItems = template.items.filter((i) => i.isSystemComputed);
          const missingLiveItems = defaultLiveItems.filter(
            (dli) => !g.items.some((i) => i.isSystemComputed && (i.source === dli.source || i.label === dli.label))
          );
          if (missingLiveItems.length > 0) {
            return {
              ...g,
              items: [...g.items, ...missingLiveItems.map(item => ({ ...item, id: makeId() }))]
            };
          }
        }
        return g;
      }),
      };
    });
  },

  addLineItem: (groupKey, item) => {
    // Guard: never allow manual addition to a system-computed group
    if (item.isSystemComputed) {
      console.warn("[BalanceSheet] Attempted to add a system-computed item manually — blocked.");
      return;
    }
    set((state) => ({
      groups: state.groups.map((g) =>
        g.key === groupKey
          ? { ...g, items: [...g.items, { ...item, id: makeId() }] }
          : g
      ),
    }));
  },

  addGroupWithItem: ({ groupKey, groupTitle, side, itemLabel, amount }) => {
    set((state) => {
      const newGroup: BalanceSheetGroup = {
        key: groupKey,
        title: groupTitle,
        side,
        allowManualAdd: true,
        items: [
          {
            id: makeId(),
            label: itemLabel,
            amount,
            manualDelta: amount,
            isSystemComputed: false
          }
        ]
      };
      
      // Determine where to insert. Find the parent index in DEFAULT_GROUPS if possible?
      // Since it's dynamic, we can just insert it at the end of the section, 
      // or at the end of the array. The PnLContainer will group it properly by its parent prefix.
      return { groups: [...state.groups, newGroup] };
    });
  },

  updateLineItem: (groupKey, id, patch) => {
    set((state) => ({
      groups: state.groups.map((g) =>
        g.key === groupKey
          ? {
              ...g,
              items: g.items.map((item) => {
                if (item.id !== id) return item;
                // Track override if it's a system-computed item and amount changes
                const isAmountPatched = patch.amount !== undefined && patch.amount !== item.amount;
                const isOverridden = item.isSystemComputed ? (item.isOverridden || isAmountPatched) : undefined;
                return { ...item, ...patch, isOverridden };
              }),
            }
          : g
      ),
    }));
  },

  restoreLiveItemAmount: (groupKey, id) => {
    set((state) => ({
      groups: state.groups.map((g) =>
        g.key === groupKey
          ? {
              ...g,
              items: g.items.map((item) => {
                if (item.id !== id || !item.isSystemComputed) return item;
                const baseAmount = item.computedAmount ?? item.amount;
                return { 
                  ...item, 
                  amount: baseAmount + (item.manualDelta || 0), 
                  isOverridden: false 
                };
              }),
            }
          : g
      ),
    }));
  },

  renameGroup: (groupKey, newTitle) => {
    set((state) => ({
      groups: state.groups.map((g) =>
        g.key === groupKey ? { ...g, title: newTitle } : g
      ),
    }));
  },

  renameParentGroup: (parentKey, newTitle) => {
    set((state) => ({
      parentTitles: { ...state.parentTitles, [parentKey]: newTitle },
    }));
  },

  removeLineItem: (groupKey, id) => {
    set((state) => {
      let isSystem = false;
      const newGroups = state.groups.map((g) => {
        if (g.key === groupKey) {
          const item = g.items.find(i => i.id === id);
          if (item && item.isSystemComputed) isSystem = true;
          return {
            ...g,
            items: g.items.filter((item) => item.id !== id),
          };
        }
        return g;
      });
      return {
        groups: newGroups,
        deletedSystemItemIds: isSystem && !state.deletedSystemItemIds.includes(id) 
          ? [...state.deletedSystemItemIds, id] 
          : state.deletedSystemItemIds,
      };
    });
  },

  hydrateSystemComputedGroups: (data) => {
    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.key === "currentAssets.bankAccounts") {
          const manualItems = g.items.filter((i) => !i.isSystemComputed);
          let bankItems: BalanceLineItem[] = data.bankAccounts.length > 0 
            ? data.bankAccounts.map((b) => {
                const existing = g.items.find(i => i.id === `bank-${b.id}`);
                return {
                  id: `bank-${b.id}`,
                  label: existing?.isOverridden ? existing.label : b.name,
                  amount: existing?.isOverridden ? existing.amount : b.balance,
                  isSystemComputed: true,
                  source: "bankAccount",
                  bankAccountId: b.id,
                  isOverridden: existing?.isOverridden,
                  computedAmount: b.balance,
                };
              })
            : [{
                id: "bank-empty",
                label: "No Bank Accounts",
                amount: 0,
                isSystemComputed: true,
                source: "bankAccount",
              }];
          
          bankItems = bankItems.filter(b => !(state.deletedSystemItemIds || []).includes(b.id));
          return { ...g, items: [...bankItems, ...manualItems] };
        }

        return {
          ...g,
          items: g.items.map((item) => {
            if (!item.isSystemComputed) return item;
            
            let compAmt = item.amount;
            
            switch (item.source) {
              case "cogs":
                compAmt = data.cogs; break;
              case "operatingExpenses":
                compAmt = data.operatingExpenses; break;
              case "totalPurchases":
                compAmt = data.totalPurchases; break;
              case "salesRevenue":
                compAmt = data.salesRevenue; break;
              case "closingStock":
                compAmt = data.closingStock; break;
              case "sundryDebtors":
                compAmt = data.sundryDebtors; break;
              case "sundryCreditors":
                compAmt = data.sundryCreditors; break;
              case "cashInHand":
                compAmt = data.cashInHand; break;
              case "outputGst":
                compAmt = data.outputGst; break;
              case "inputGst":
                compAmt = -data.inputGst; break; // Negative to offset the liability
            }

            return { 
              ...item, 
              computedAmount: compAmt, 
              amount: (item.isOverridden ? item.amount : compAmt) + (item.manualDelta || 0)
            };
          }),
        };
      }),
    }));
  },

  setManualEntries: (entries) => {
    set((state) => ({
      groups: state.groups.map((g) => {
        const systemItems = g.items.filter((i) => i.isSystemComputed);
        const groupManualEntries = entries
          .filter((e) => e.groupKey === g.key)
          .map((e) => {
            const existingDelta = g.items.find((i) => i.id === e.id)?.manualDelta || 0;
            return {
              id: e.id,
              label: e.label,
              amount: e.amount + existingDelta,
              manualDelta: existingDelta,
              isSystemComputed: false,
            } as BalanceLineItem;
          });
        
        return { ...g, items: [...systemItems, ...groupManualEntries] };
      }),
    }));
  },

  applyRowReceipt: ({ rowId, delta, reason }) => {
    set((state) => {
      const newAdjustments = { ...state.rowAdjustments };
      const rowAdjs = newAdjustments[rowId] || [];
      newAdjustments[rowId] = [
        ...rowAdjs,
        { id: makeId(), delta, reason, createdAt: new Date().toISOString() },
      ];

      return {
        rowAdjustments: newAdjustments,
        groups: state.groups.map((g) => ({
          ...g,
          items: g.items.map((item) => {
            if (item.id !== rowId) return item;
            const newManualDelta = (item.manualDelta || 0) + delta;
            return {
              ...item,
              manualDelta: newManualDelta,
              amount: item.amount + delta,
            };
          }),
        })),
      };
    });
  },

  updateRowAdjustment: (rowId, adjId, newDelta) => {
    set((state) => {
      const newAdjustments = { ...state.rowAdjustments };
      const rowAdjs = newAdjustments[rowId] || [];
      const adjIndex = rowAdjs.findIndex((a) => a.id === adjId);
      if (adjIndex === -1) return state;

      const oldDelta = rowAdjs[adjIndex].delta;
      const difference = newDelta - oldDelta;

      const updatedAdjs = [...rowAdjs];
      updatedAdjs[adjIndex] = { ...updatedAdjs[adjIndex], delta: newDelta };
      newAdjustments[rowId] = updatedAdjs;

      return {
        rowAdjustments: newAdjustments,
        groups: state.groups.map((g) => ({
          ...g,
          items: g.items.map((item) => {
            if (item.id !== rowId) return item;
            const newManualDelta = (item.manualDelta || 0) + difference;
            return {
              ...item,
              manualDelta: newManualDelta,
              amount: item.amount + difference,
            };
          }),
        })),
      };
    });
  },

  deleteRowAdjustment: (rowId, adjId) => {
    set((state) => {
      const newAdjustments = { ...state.rowAdjustments };
      const rowAdjs = newAdjustments[rowId] || [];
      const adj = rowAdjs.find((a) => a.id === adjId);
      if (!adj) return state;

      const difference = -adj.delta;
      newAdjustments[rowId] = rowAdjs.filter((a) => a.id !== adjId);

      return {
        rowAdjustments: newAdjustments,
        groups: state.groups.map((g) => ({
          ...g,
          items: g.items.map((item) => {
            if (item.id !== rowId) return item;
            const newManualDelta = (item.manualDelta || 0) + difference;
            return {
              ...item,
              manualDelta: newManualDelta,
              amount: item.amount + difference,
            };
          }),
        })),
      };
    });
  },

  updateSystemEntryOverride: (rowId, breakdownId, delta, overrideData) => {
    set((state) => {
      const newOverrides = { ...state.systemEntryOverrides };
      const rowOverrides = { ...(newOverrides[rowId] || {}) };
      
      rowOverrides[breakdownId] = overrideData;
      newOverrides[rowId] = rowOverrides;

      return {
        systemEntryOverrides: newOverrides,
        groups: state.groups.map((g) => ({
          ...g,
          items: g.items.map((item) => {
            if (item.id !== rowId) return item;
            const newSystemDelta = (item.systemDelta || 0) + delta;
            return {
              ...item,
              systemDelta: newSystemDelta,
              amount: item.amount + delta,
            };
          }),
        })),
      };
    });
  },

  restoreMicroRowData: (rowId) => {
    set((state) => {
      const newOverrides = { ...state.systemEntryOverrides };
      delete newOverrides[rowId];
      
      const newAdjustments = { ...state.rowAdjustments };
      delete newAdjustments[rowId];

      return {
        systemEntryOverrides: newOverrides,
        rowAdjustments: newAdjustments,
        groups: state.groups.map((g) => ({
          ...g,
          items: g.items.map((item) => {
            if (item.id !== rowId) return item;
            
            // Revert amount to its computed base (or overridden base)
            const currentManualDelta = item.manualDelta || 0;
            const currentSystemDelta = item.systemDelta || 0;
            const restoredAmount = item.amount - currentManualDelta - currentSystemDelta;

            return {
              ...item,
              manualDelta: 0,
              systemDelta: 0,
              amount: restoredAmount,
            };
          }),
        })),
      };
    });
  },

  clearRowAdjustments: (groupKey, rowId) => {
    set((state) => {
      const newAdjustments = { ...state.rowAdjustments };
      delete newAdjustments[rowId];

      return {
        rowAdjustments: newAdjustments,
        groups: state.groups.map((g) =>
          g.key === groupKey
            ? {
                ...g,
                items: g.items.map((item) => {
                  if (item.id !== rowId) return item;
                  const currentDelta = item.manualDelta || 0;
                  return {
                    ...item,
                    manualDelta: 0,
                    amount: item.amount - currentDelta,
                  };
                }),
              }
            : g
        ),
      };
    });
  },

  resetToDefault: () => {
    set((state) => {
      let newGroups = state.groups.map(g => {
        const defaultG = DEFAULT_GROUPS.find(dg => dg.key === g.key);
        
        // Retain only system computed items, and reset their amount
        const systemItems = g.items.filter(i => i.isSystemComputed).map(i => ({
          ...i,
          amount: i.computedAmount ?? i.amount,
          manualDelta: 0,
          isOverridden: false,
          label: i.isOverridden ? (defaultG?.items.find(di => di.source === i.source)?.label || i.label) : i.label,
        }));
        
        if (systemItems.length === 0 && !defaultG) return null; // Drop completely manual groups
        
        return {
          ...g,
          title: defaultG ? defaultG.title : g.title,
          items: systemItems,
        };
      }).filter(Boolean) as BalanceSheetGroup[];

      // Re-inject any default groups that were completely missing or dropped because they had no system items initially
      for (const dg of DEFAULT_GROUPS) {
        const existing = newGroups.find(g => g.key === dg.key);
        if (!existing) {
           newGroups.push(JSON.parse(JSON.stringify(dg)));
        } else {
           // Make sure the default group's system items are present
           for (const defaultItem of dg.items) {
             if (defaultItem.isSystemComputed && !existing.items.find(i => i.source === defaultItem.source)) {
               existing.items.push(JSON.parse(JSON.stringify(defaultItem)));
             }
           }
        }
      }

      return {
        groups: newGroups,
        deletedSystemItemIds: [],
        parentTitles: {},
        rowAdjustments: {},
      };
    });
  },

  restoreAllLiveDetails: () => {
    set((state) => {
      // Keep everything (including manual items/groups) but restore all system items
      const newGroups = state.groups.map(g => {
        const defaultG = DEFAULT_GROUPS.find(dg => dg.key === g.key);
        
        let newItems = g.items.map(i => {
          if (!i.isSystemComputed) return i;
          return {
            ...i,
            amount: i.computedAmount ?? i.amount,
            manualDelta: 0,
            isOverridden: false,
            label: i.isOverridden ? (defaultG?.items.find(di => di.source === i.source)?.label || i.label) : i.label,
          };
        });

        // Add back any deleted system items for this group
        if (defaultG) {
          for (const defaultItem of defaultG.items) {
            if (defaultItem.isSystemComputed && !newItems.find(i => i.source === defaultItem.source)) {
              newItems.push({
                ...JSON.parse(JSON.stringify(defaultItem)),
                // It will be re-hydrated next time, or we can just push it as zero for now
              });
            }
          }
        }

        return { ...g, items: newItems };
      });

      return {
        groups: newGroups,
        deletedSystemItemIds: [],
        // We do not wipe manual groups or adjustments to manual items.
        // We only wiped adjustments to system items by setting their manualDelta=0 above,
        // but rowAdjustments state for them should ideally be cleared. 
        // We'll leave the array in `rowAdjustments` as history or we could clear it:
        rowAdjustments: Object.fromEntries(
          Object.entries(state.rowAdjustments).filter(([rowId]) => {
            const isSystem = newGroups.some(g => g.items.find(i => i.id === rowId && i.isSystemComputed));
            return !isSystem; // Keep adjustments only for non-system items
          })
        )
      };
    });
  },

  totalsBySide: () => {
    const { groups } = get();
    const liabilities = groups
      .filter((g) => g.side === "liabilities")
      .flatMap((g) => g.items)
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    const assets = groups
      .filter((g) => g.side === "assets")
      .flatMap((g) => g.items)
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    const expenses = groups
      .filter((g) => g.side === "expenses")
      .flatMap((g) => g.items)
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    const income = groups
      .filter((g) => g.side === "income")
      .flatMap((g) => g.items)
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    const netProfit = income - expenses;

    // Inject net profit into the Current Period P&L line item if we are querying it,
    // though the best way is just to have the UI read netProfit.
    
    return { liabilities, assets, delta: assets - liabilities, expenses, income, netProfit };
  },
}),
{
  name: "balance-sheet-storage",
  version: 2,
  migrate: (persistedState: any, version: number) => {
    let state = persistedState;
    if (version === 0) {
      // Migrate to version 1: Replace old GST Payable with new Output/Input GST fields
      if (state && state.groups) {
        state.groups = state.groups.map((g: any) => {
          if (g.key === "currentLiabilities.dutiesAndTaxes") {
            const hasNew = g.items.some((i: any) => i.source === "outputGst" || i.source === "inputGst");
            if (!hasNew) {
              const filteredItems = g.items.filter((i: any) => i.label !== "GST Payable");
              filteredItems.push({
                id: crypto.randomUUID(),
                label: "Output GST (5% on Sales)",
                amount: 0,
                isSystemComputed: true,
                source: "outputGst",
              });
              filteredItems.push({
                id: crypto.randomUUID(),
                label: "Input GST (5% on Purchases)",
                amount: 0,
                isSystemComputed: true,
                source: "inputGst",
              });
              return { ...g, items: filteredItems };
            }
          }
          return g;
        });
      }
    }
    if (version <= 1) {
      // Migrate to version 2: Fix Raw Material Purchases source from cogs to totalPurchases
      if (state && state.groups) {
        state.groups = state.groups.map((g: any) => {
          if (g.key === "pnl.cogs") {
            return {
              ...g,
              items: g.items.map((i: any) => {
                if (i.label === "Raw Material Purchases" && i.source === "cogs") {
                  return { ...i, source: "totalPurchases" };
                }
                return i;
              })
            };
          }
          return g;
        });
      }
    }
    return state;
  },
}
));
