import { Timestamp } from "firebase/firestore";
import { BagSize, Product } from "./riceTypes";

/**
 * All event types that can appear in the Supplier Ledger.
 * Each is written atomically alongside the domain action that triggers it.
 */
export type SupplierLedgerEventType =
  | "purchase_created"      // A new Deal was created for this supplier
  | "delivery_confirmed"    // deliveryConfirmed was set to true on a Deal
  | "bags_divided"          // A BagDivision was confirmed on a Deal
  | "allocation_deducted";  // Bags from this supplier were sold in a confirmed Order

export interface SupplierLedgerEntry {
  entryId: string;
  supplierId: string;
  supplierName: string;
  dealId: string;
  eventType: SupplierLedgerEventType;
  eventDate: Timestamp;
  product: Product;               // Snapshot at event time

  // Financial fields — populated based on eventType
  amountKg?: number;
  pricePerKg?: number;
  totalValue?: number;            // amountKg × pricePerKg
  bagSize?: BagSize;
  numberOfBags?: number;
  totalWeightKg?: number;

  // Populated only for allocation_deducted
  relatedOrderId?: string;
  customerName?: string;
  revenueFromSale?: number;       // numberOfBags × bagWeightKg × order.sellingPricePerKg

  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
}
