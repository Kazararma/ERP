import { useEffect, useState } from "react";
import { RiceType } from "@/types/riceTypes";
import { subscribeToActiveRiceTypes } from "@/services/riceTypeService";

/**
 * Returns all active rice types from Firestore in real time.
 * Components use this to populate the "Type of Rice" dropdown.
 */
export function useRiceTypes(): { riceTypes: RiceType[]; loading: boolean } {
  const [riceTypes, setRiceTypes] = useState<RiceType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToActiveRiceTypes((types) => {
      setRiceTypes(types);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { riceTypes, loading };
}
