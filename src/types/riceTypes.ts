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
