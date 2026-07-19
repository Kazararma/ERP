import { Timestamp } from "firebase/firestore";
import { BagSize, Product } from "./riceTypes";

export interface Supplier {
  supplierId: string;
  name: string;
  description: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export interface Deal {
  dealId: string;
  supplierId: string;
  supplierName: string;           // Denormalized
  product: Product;               // Embedded product descriptor
  totalAmountKg: number;          // Total raw grain purchased in kg
  remainingAmountKg: number;      // Raw kg not yet divided into bags
  pricePerKg: number;             // Purchase cost per kg — used for COGS at order time
  totalCost: number;              // totalAmountKg × pricePerKg
  purchaseDate: Timestamp;
  deliveryConfirmed: boolean;
  deliveryDate: Timestamp | null;
  status: "pending_delivery" | "delivered" | "dividing" | "completed";
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

/**
 * Represents one batch of bags created from a Deal's raw grain.
 * Stored as a subcollection: deals/{dealId}/bagDivisions/{divisionId}
 * CRITICAL: No price field. Price is resolved from the parent Deal at order time.
 */
export interface BagDivision {
  divisionId: string;
  dealId: string;
  bagSize: BagSize;               // The standardized bag size for this division
  bagWeightKg: number;            // Constant resolved from BAG_WEIGHT_KG[bagSize]
  numberOfBags: number;           // Total bags created
  totalWeightKg: number;          // numberOfBags × bagWeightKg
  availableBags: number;          // Bags not yet allocated to any confirmed order
  divisionConfirmed: boolean;
  divisionDate: Timestamp | null;
  status: "draft" | "ready" | "partial" | "exhausted";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
