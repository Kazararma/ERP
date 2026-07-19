import { useEffect, useState } from "react";
import { SupplierLedgerEntry } from "@/types/ledger";
import { subscribeToSupplierLedger } from "@/services/supplierLedgerService";

export function useSupplierLedger(supplierId: string | null): {
  entries: SupplierLedgerEntry[];
  loading: boolean;
} {
  const [entries, setEntries] = useState<SupplierLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToSupplierLedger(supplierId, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return unsub;
  }, [supplierId]);

  return { entries, loading };
}
