import { Timestamp } from "firebase/firestore";
import { BagSize, Product } from "./riceTypes";

export interface Customer {
  customerId: string;
  name: string;
  description: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export interface Order {
  orderId: string;
  customerId: string;
  customerName: string;           // Denormalized
  orderDate: Timestamp;
  totalWeightKg: number;          // Sum of all allocation weights
  sellingPricePerKg?: number;     // Legacy: Single selling price applied to the whole order
  totalRevenue: number;           // Sum of all allocation revenues
  totalCostOfGoods: number;       // Sum of all allocation totalCosts
  profit: number;                 // totalRevenue - totalCostOfGoods
  orderConfirmed: boolean;
  confirmedAt: Timestamp | null;
  status: "draft" | "confirmed" | "delivered";
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

/**
 * One line item in an order, linking to a specific BagDivision from a specific Deal.
 * Stored as subcollection: orders/{orderId}/allocations/{allocationId}
 */
export interface OrderAllocation {
  allocationId: string;
  dealId: string;
  supplierId: string;             // Denormalized for supplier ledger queries
  supplierName: string;           // Denormalized
  divisionId: string;             // References BagDivision document
  product: Product;               // Snapshot of the product at allocation time
  bagSize: BagSize;
  bagWeightKg: number;
  numberOfBags: number;
  weightKg: number;               // numberOfBags × bagWeightKg
  purchasePricePerKg: number;     // Copied from Deal.pricePerKg at allocation time
  totalCost: number;              // weightKg × purchasePricePerKg (COGS for this line)
  sellingPricePerKg: number;      // Selling price specifically assigned to this bag type
  revenue: number;                // weightKg × sellingPricePerKg
  profit: number;                 // revenue - totalCost
  createdAt: Timestamp;
}
