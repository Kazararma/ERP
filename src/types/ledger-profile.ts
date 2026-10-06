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

export const EntityTypeEnum = z.enum(["supplier", "customer", "miscellaneous"]);
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
  vchNo: z.coerce.number().int().positive(),

  debit: z.coerce.number().min(0).default(0),   // Amount in ₹; 0 if credit entry
  credit: z.coerce.number().min(0).default(0),  // Amount in ₹; 0 if debit entry

  entryType: LedgerEntryTypeEnum,
  isManual: z.boolean().default(false),  // True for user-created rows
  isSystemGenerated: z.boolean().default(true),

  relatedDocId: z.string().optional(),   // Deal ID / Order ID that triggered this entry
  quantityKg: z.coerce.number().optional(),     // Populated when entry involves stock movement
  pricePerUnit: z.coerce.number().optional(),   // ₹/qtl or ₹/kg
  riceType: z.string().optional(),       // Type of rice

  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
  bankId: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
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

  totalDebit: z.coerce.number().default(0),    // Running aggregate — updated via transaction
  totalCredit: z.coerce.number().default(0),
  closingBalance: z.coerce.number().default(0), // totalDebit - totalCredit (positive = we owe them)

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
  vchNo: z.coerce.number().int().positive("Voucher number must be positive"),
  entryKind: z.enum(["debit", "credit"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  quantityKg: z.coerce.number().optional(),
  pricePerUnit: z.coerce.number().optional(),
  riceType: z.string().optional(),
  bankId: z.string().nullable().optional(),
  recordFundMovement: z.boolean().optional(),
  bankMovementDirection: z.enum(["credit", "debit"]).optional(),
});
export type ManualLedgerEntryForm = z.infer<typeof ManualLedgerEntryFormSchema>;

// ─── PDF Export Params ────────────────────────────────────────────────────────

export interface LedgerPdfParams {
  profile: LedgerProfile;
  entries: LedgerEntry[];
  dateFrom: Date;
  dateTo: Date;
}

// ─── PDF Column Visibility Options ───────────────────────────────────────────
// All flags default to `true` (visible) when not provided.
// Pass `false` to suppress a column from the generated PDF.
export interface LedgerPdfOptions {
  /** Show the Voucher Type column (and its Tally-style sub-detail). Default: true */
  showVchType: boolean;
  /** Show the Voucher Number column. Default: true */
  showVchNo: boolean;
  /** Show the sub-particulars line (qty & rate details). Default: true */
  showSubParticulars: boolean;
  /** Show the Ref Label line. Default: true */
  showRefLabel: boolean;
}

