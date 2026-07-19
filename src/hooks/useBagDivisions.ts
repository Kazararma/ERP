import { useEffect, useState } from "react";
import { BagDivision } from "@/types/deal";
import { subscribeToBagDivisions } from "@/services/bagDivisionService";

export function useBagDivisions(dealId: string | null): {
  divisions: BagDivision[];
  loading: boolean;
} {
  const [divisions, setDivisions] = useState<BagDivision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) {
      setDivisions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToBagDivisions(dealId, (data) => {
      setDivisions(data);
      setLoading(false);
    });
    return unsub;
  }, [dealId]);

  return { divisions, loading };
}
