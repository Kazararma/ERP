// src/types/balanceSheet.ts
// Phase 2 — Type definitions for the Balance Sheet / P&L feature.
// These types are the single source of truth for both the Zustand store
// and the Zod validation schemas. No `any` per blueprint guardrails.

import { z } from "zod";

// ─── Enums & Literals ─────────────────────────────────────────────────────────

export type BalanceSide = "liabilities" | "assets" | "expenses" | "income";

export type SystemComputedSource =
  | "closingStock"
  | "sundryDebtors"
  | "sundryCreditors"
  | "cashInHand"
  | "bankAccount"
  | "outputGst"
  | "inputGst"
  | "cogs"
  | "salesRevenue"
  | "operatingExpenses"
  | "totalPurchases";

// All valid group keys, matching the blueprint §1.1 structure exactly.
export type GroupKey =
  // Liabilities (left column)
  | "capitalAccount"
  | "currentLiabilities.dutiesAndTaxes"
  | "currentLiabilities.provisions"
  | "currentLiabilities.sundryCreditors"
  | "suspenseAc"
  | "differenceInOpeningBalances"
  // Assets (right column)
  | "loansLiability"
  | "fixedAssets"
  | "currentAssets.closingStock"
  | "currentAssets.deposits"
  | "currentAssets.loansAndAdvances"
  | "currentAssets.sundryDebtors"
  | "currentAssets.cashInHand"
  | "currentAssets.bankAccounts"
  | "profitAndLossAc";

// ─── Core Data Models ─────────────────────────────────────────────────────────

export interface RowAdjustment {
  id: string;
  delta: number;
  reason?: string;
  createdAt: string; // ISO timestamp
}

export interface BalanceLineItem {
  id: string; // uuid, generated client-side
  label: string;
  amount: number;
  isSystemComputed: boolean; // true = read-only; fed from Phase 3 aggregation
  source?: SystemComputedSource;
  bankAccountId?: string; // only when source === 'bankAccount'
  isOverridden?: boolean;
  computedAmount?: number; // Original system amount before manual override
  manualDelta?: number; // Accumulated delta from manual receipts
  systemDelta?: number; // Net change from hidden or manually edited system breakdown entries
}

export interface BalanceSheetGroup {
  key: string; // We'll just type this as string for now to allow arbitrary groups
  title: string;
  side: BalanceSide;
  items: BalanceLineItem[];
  allowManualAdd: boolean;
}

export interface AggregatedFinancials {
  closingStock: number;
  sundryDebtors: number;
  sundryCreditors: number;
  cashInHand: number;
  bankAccounts: Array<{ id: string; name: string; balance: number }>;
  salesRevenue: number;
  cogs: number;
  operatingExpenses: number;
  outputGst: number;
  inputGst: number;
  totalPurchases: number;
}

// ─── Zod Validation Schemas ────────────────────────────────────────────────────

/**
 * Schema for a single Balance Sheet line item add/edit form.
 * Zod is the single source of truth for validation — no ad-hoc checks in components.
 */
export const balanceLineItemSchema = z.object({
  label: z
    .string()
    .min(1, "Label is required")
    .max(80, "Label must be 80 characters or less")
    .trim(),
  // z.coerce.number() converts string inputs from HTML inputs to numbers (Zod v4 compatible)
  amount: z
    .coerce
    .number()
    .finite("Amount must be a finite number")
    // Allow negative values (contra entries are valid in accounting)
    // but flag it so the UI can warn the user if unexpected.
    .default(0),
});

export type BalanceLineItemFormValues = z.infer<typeof balanceLineItemSchema>;
