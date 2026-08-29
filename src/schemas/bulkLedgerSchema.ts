import { z } from "zod";

// ─── Single voucher row ────────────────────────────────────────────────────────
// Each row targets one ledger profile and posts one debit or credit entry.
// VchType values mirror VchTypeEnum from src/types/ledger-profile.ts so the
// written entry is consistent with all other ledger entries in the system.

export const bulkLedgerRowSchema = z.object({
  ledgerType: z.enum(["supplier", "customer", "miscellaneous"], {
    error: "Select a ledger type",
  }),
  profileId: z.string().min(1, "Select a profile"),
  profileName: z.string().min(1), // denormalized at select-time, not user-typed
  entryKind: z.enum(["debit", "credit"], { error: "Select debit or credit" }),
  date: z.string().min(1, "Date is required"), // HTML date input, "YYYY-MM-DD"
  particulars: z.string().min(1, "Particulars are required"),
  subParticulars: z.string().optional(),
  vchType: z.enum(["Purchase", "Payment", "Receipt", "Sale", "Journal", "Manual"]),
  vchNo: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  bankId: z.string().nullable().optional(),
  recordFundMovement: z.boolean().optional(),
  bankMovementDirection: z.enum(["credit", "debit"]).optional(),
});

// ─── Full form schema (array of rows) ─────────────────────────────────────────
// useFieldArray binds to the `rows` key; the min(1) guard prevents an empty submit.

export const bulkLedgerFormSchema = z.object({
  rows: z.array(bulkLedgerRowSchema).min(1, "Add at least one voucher row"),
});

export type BulkLedgerRow = z.infer<typeof bulkLedgerRowSchema>;
export type BulkLedgerFormValues = z.infer<typeof bulkLedgerFormSchema>;
