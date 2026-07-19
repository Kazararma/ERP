import { create } from "zustand";
import { Customer, Supplier } from "@/types";
import { LedgerProfile } from "@/types/ledger-profile";
import { customerService } from "@/services/customerService";
import { supplierService } from "@/services/supplierService";
import { getLedgerProfilesByType } from "@/services/ledgerProfileService";

interface LedgerStore {
  customers: Customer[];
  suppliers: Supplier[];
  customerProfiles: Record<string, LedgerProfile>;
  supplierProfiles: Record<string, LedgerProfile>;
  isLoadingCustomers: boolean;
  isLoadingSuppliers: boolean;

  fetchCustomersData: (force?: boolean) => Promise<void>;
  fetchSuppliersData: (force?: boolean) => Promise<void>;
  // Optimistic patch — applies local changes to a profile before the refetch lands
  updateProfileInStore: (
    entityType: "supplier" | "customer",
    entityId: string,
    patch: Partial<Pick<LedgerProfile, "totalDebit" | "totalCredit" | "closingBalance">>
  ) => void;
}

export const useLedgerStore = create<LedgerStore>((set, get) => ({
  customers: [],
  suppliers: [],
  customerProfiles: {},
  supplierProfiles: {},
  isLoadingCustomers: false,
  isLoadingSuppliers: false,

  fetchCustomersData: async (force = false) => {
    // Only fetch if empty or force is true
    if (!force && get().customers.length > 0) return;
    
    set({ isLoadingCustomers: true });
    try {
      const custs = await customerService.getAllCustomers();
      const profs = await getLedgerProfilesByType("customer");
      set({ customers: custs, customerProfiles: profs });
    } catch (e) {
      console.error("Failed to fetch customer ledger data:", e);
    } finally {
      set({ isLoadingCustomers: false });
    }
  },

  fetchSuppliersData: async (force = false) => {
    if (!force && get().suppliers.length > 0) return;
    
    set({ isLoadingSuppliers: true });
    try {
      const sups = await supplierService.getAllSuppliers();
      const profs = await getLedgerProfilesByType("supplier");
      set({ suppliers: sups, supplierProfiles: profs });
    } catch (e) {
      console.error("Failed to fetch supplier ledger data:", e);
    } finally {
      set({ isLoadingSuppliers: false });
    }
  },

  updateProfileInStore: (entityType, entityId, patch) => {
    if (entityType === "supplier") {
      set((state) => {
        const existing = state.supplierProfiles[entityId];
        if (!existing) return state;
        return {
          supplierProfiles: {
            ...state.supplierProfiles,
            [entityId]: { ...existing, ...patch },
          },
        };
      });
    } else {
      set((state) => {
        const existing = state.customerProfiles[entityId];
        if (!existing) return state;
        return {
          customerProfiles: {
            ...state.customerProfiles,
            [entityId]: { ...existing, ...patch },
          },
        };
      });
    }
  },
}));
