import { useMemo } from "react";
import { useLedgerStore } from "@/stores/useLedgerStore"; // match existing import style (A1)
import {
  buildProfileRows,
  type LedgerProfileRow,
} from "@/components/ledger/shared/ledgerProfileRows";
import type { EntityType } from "@/types/ledger-profile";

export function useLedgerProfileRows(entityType: EntityType): LedgerProfileRow[] {
  const profileMap = useLedgerStore((s) =>
    entityType === "supplier"
      ? s.supplierProfiles
      : entityType === "customer"
      ? s.customerProfiles
      : s.miscellaneousProfiles
  );
  return useMemo(() => buildProfileRows(profileMap), [profileMap]);
}
