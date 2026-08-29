import { create } from "zustand";
import { Customer, Supplier } from "@/types";
import { MiscellaneousProfile } from "@/types/miscellaneous";
import { LedgerProfile } from "@/types/ledger-profile";
import { customerService } from "@/services/customerService";
import { supplierService } from "@/services/supplierService";
import { miscellaneousService } from "@/services/miscellaneousService";
import { getLedgerProfilesByType } from "@/services/ledgerProfileService";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LedgerEntry } from "@/types/ledger-profile";

interface LedgerStore {
  customers: Customer[];
  suppliers: Supplier[];
  miscellaneous: MiscellaneousProfile[];
  customerProfiles: Record<string, LedgerProfile>;
  supplierProfiles: Record<string, LedgerProfile>;
  miscellaneousProfiles: Record<string, LedgerProfile>;
  isLoadingCustomers: boolean;
  isLoadingSuppliers: boolean;
  isLoadingMiscellaneous: boolean;

  fetchCustomersData: (force?: boolean) => Promise<void>;
  fetchSuppliersData: (force?: boolean) => Promise<void>;
  fetchMiscellaneousData: (force?: boolean) => Promise<void>;
  // Optimistic patch — applies local changes to a profile before the refetch lands
  updateProfileInStore: (
    entityType: "supplier" | "customer" | "miscellaneous",
    entityId: string,
    patch: Partial<Pick<LedgerProfile, "totalDebit" | "totalCredit" | "closingBalance">>
  ) => void;

  activeProfileEntries: LedgerEntry[];
  activeProfileUnsubscribe: (() => void) | null;
  subscribeToProfileEntries: (profileId: string) => void;
  unsubscribeFromProfileEntries: () => void;
}

export const useLedgerStore = create<LedgerStore>((set, get) => ({
  customers: [],
  suppliers: [],
  miscellaneous: [],
  customerProfiles: {},
  supplierProfiles: {},
  miscellaneousProfiles: {},
  isLoadingCustomers: false,
  isLoadingSuppliers: false,
  isLoadingMiscellaneous: false,
  activeProfileEntries: [],
  activeProfileUnsubscribe: null,

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

  fetchMiscellaneousData: async (force = false) => {
    if (!force && get().miscellaneous.length > 0) return;
    
    set({ isLoadingMiscellaneous: true });
    try {
      const misc = await miscellaneousService.getAllMiscellaneous();
      const profs = await getLedgerProfilesByType("miscellaneous");
      set({ miscellaneous: misc, miscellaneousProfiles: profs });
    } catch (e) {
      console.error("Failed to fetch miscellaneous ledger data:", e);
    } finally {
      set({ isLoadingMiscellaneous: false });
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
    } else if (entityType === "customer") {
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
    } else if (entityType === "miscellaneous") {
      set((state) => {
        const existing = state.miscellaneousProfiles[entityId];
        if (!existing) return state;
        return {
          miscellaneousProfiles: {
            ...state.miscellaneousProfiles,
            [entityId]: { ...existing, ...patch },
          },
        };
      });
    }
  },


  subscribeToProfileEntries: (profileId: string) => {
    get().unsubscribeFromProfileEntries();

    const q = query(
      collection(db, "ledgerProfiles", profileId, "entries"),
      orderBy("date", "asc"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      set({ activeProfileEntries: snap.docs.map((d) => d.data() as LedgerEntry) });
    });

    set({ activeProfileUnsubscribe: unsub });
  },

  unsubscribeFromProfileEntries: () => {
    const unsub = get().activeProfileUnsubscribe;
    if (unsub) unsub();
    set({ activeProfileUnsubscribe: null, activeProfileEntries: [] });
  },
}));
