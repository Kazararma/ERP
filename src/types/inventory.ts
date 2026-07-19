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

export interface InventoryExcess {
  excessId: string;
  inventoryId: string;
  dealId: string;
  supplierId: string;
  supplierName: string;
  product: Product;
  type: "raw" | "packed";
  amountKg: number;
  reason: "rounding" | "manual_adjustment";
  createdAt: Timestamp;
}
