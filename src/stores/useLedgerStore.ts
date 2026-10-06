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
import { toNum, round2 } from "@/utils/number";

const normalizeProfile = (p: LedgerProfile): LedgerProfile => {
  const td = toNum(p.totalDebit);
  const tc = toNum(p.totalCredit);
  return {
    ...p,
    totalDebit: round2(td),
    totalCredit: round2(tc),
    closingBalance: round2(td - tc),
  };
};

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
  removeProfile: (entityType: "supplier" | "customer" | "miscellaneous", profileId: string) => void;
  deleteProfile: (entityType: "supplier" | "customer" | "miscellaneous", profileId: string) => Promise<void>;

  activeProfileEntries: LedgerEntry[];
  activeProfileUnsubscribe: (() => void) | null;
  /** Which profileId the current `activeProfileEntries` belong to (null until first snapshot). */
  activeProfileEntriesFor: string | null;
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
  activeProfileEntriesFor: null,

  fetchCustomersData: async (force = false) => {
    // Only fetch if empty or force is true
    if (!force && get().customers.length > 0) return;
    
    set({ isLoadingCustomers: true });
    try {
      const custs = await customerService.getAllCustomers();
      let profs = await getLedgerProfilesByType("customer");
      for (const key in profs) {
        profs[key] = normalizeProfile(profs[key]);
      }
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
      let profs = await getLedgerProfilesByType("supplier");
      for (const key in profs) {
        profs[key] = normalizeProfile(profs[key]);
      }
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
      let profs = await getLedgerProfilesByType("miscellaneous");
      for (const key in profs) {
        profs[key] = normalizeProfile(profs[key]);
      }
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
            [entityId]: normalizeProfile({ ...existing, ...patch }),
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
            [entityId]: normalizeProfile({ ...existing, ...patch }),
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
            [entityId]: normalizeProfile({ ...existing, ...patch }),
          },
        };
      });
    }
  },

  removeProfile: (entityType, profileId) => {
    if (entityType === "supplier") {
      set((state) => {
        const { [profileId]: _, ...rest } = state.supplierProfiles;
        return { supplierProfiles: rest };
      });
    } else if (entityType === "customer") {
      set((state) => {
        const { [profileId]: _, ...rest } = state.customerProfiles;
        return { customerProfiles: rest };
      });
    } else if (entityType === "miscellaneous") {
      set((state) => {
        const { [profileId]: _, ...rest } = state.miscellaneousProfiles;
        return { miscellaneousProfiles: rest };
      });
    }
  },

  deleteProfile: async (entityType, profileId) => {
    // Note: the backend deletion should be done via service first, this just updates the store
    // Or we can import deleteLedgerProfile from here? No, the PRD says "Add removeProfile and deleteProfile actions to src/stores/useLedgerStore.ts".
    // Wait, let's just make deleteProfile call deleteLedgerProfile and removeProfile.
    const { deleteLedgerProfile } = await import("@/services/ledgerProfileService");
    await deleteLedgerProfile(profileId);
    get().removeProfile(entityType, profileId);
  },


  subscribeToProfileEntries: (profileId: string) => {
    get().unsubscribeFromProfileEntries();
    // Drop the previous profile's rows immediately so they can never be shown for the new profile.
    set({ activeProfileEntries: [], activeProfileEntriesFor: null });

    const q = query(
      collection(db, "ledgerProfiles", profileId, "entries"),
      orderBy("date", "asc"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        set({
          activeProfileEntries: snap.docs.map(
            (d) => ({ ...(d.data() as LedgerEntry), id: d.id })
          ),
          activeProfileEntriesFor: profileId, // set atomically with the entries
        });
      },
      (err) => console.error("[ledger] entries listener error", profileId, err)
    );

    set({ activeProfileUnsubscribe: unsub });
  },

  unsubscribeFromProfileEntries: () => {
    const unsub = get().activeProfileUnsubscribe;
    if (unsub) unsub();
    set({
      activeProfileUnsubscribe: null,
      activeProfileEntries: [],
      activeProfileEntriesFor: null,
    });
  },
}));
