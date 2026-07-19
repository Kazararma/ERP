import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BagSize, BAG_WEIGHT_KG, ALL_BAG_SIZES, BAG_SIZE_LABEL } from "@/types/riceTypes";
import { createBagDivisions, confirmBagDivisions } from "@/services/bagDivisionService";

interface Props {
  dealId: string;
  remainingAmountKg: number;
  onUpdate?: () => void;
}

export function BagDivisionModal({ dealId, remainingAmountKg, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Set<BagSize>>(new Set());
  const [bags, setBags] = useState<Partial<Record<BagSize, number>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleSize = (size: BagSize) => {
    const next = new Set(selectedSizes);
    if (next.has(size)) {
      next.delete(size);
      setBags(prev => { const n = {...prev}; delete n[size]; return n; });
    } else {
      next.add(size);
      setBags(prev => ({ ...prev, [size]: 0 }));
    }
    setSelectedSizes(next);
  };

  const totalAllocated = Array.from(selectedSizes).reduce((sum, size) => sum + (bags[size] || 0) * BAG_WEIGHT_KG[size], 0);
  const unallocated = remainingAmountKg - totalAllocated;
  const totalBags = Array.from(selectedSizes).reduce((sum, size) => sum + (bags[size] || 0), 0);

  const fillMax = (size: BagSize) => {
    const availableForThisSize = unallocated + ((bags[size] || 0) * BAG_WEIGHT_KG[size]);
    const maxBags = Math.floor(availableForThisSize / BAG_WEIGHT_KG[size]);
    setBags(prev => ({ ...prev, [size]: maxBags }));
  };

  const isValid = selectedSizes.size > 0 && totalAllocated > 0 && unallocated >= 0;

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const entries = Array.from(selectedSizes).map(size => ({ bagSize: size, numberOfBags: bags[size] || 0 })).filter(e => e.numberOfBags > 0);
      const divisions = await createBagDivisions(dealId, entries);
      await confirmBagDivisions(dealId, divisions.map(d => d.divisionId));
      setOpen(false);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to divide bags");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded">
            Divide into Bags
          </button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogTitle>Divide Bags</DialogTitle>
        <div className="mt-4 space-y-6">
          {error && <div className="text-red-500 text-sm p-2 bg-red-50 rounded border border-red-200">{error}</div>}
          
          <div>
            <div className="text-sm font-semibold mb-2">1. Select bag sizes</div>
            <div className="flex gap-2">
              {ALL_BAG_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => toggleSize(size)}
                  className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${selectedSizes.has(size) ? "bg-indigo-100 border-indigo-300 text-indigo-800" : "bg-white border-gray-200 hover:bg-gray-50"}`}
                >
                  {BAG_SIZE_LABEL[size]}
                </button>
              ))}
            </div>
          </div>

          {selectedSizes.size > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2">2. Enter quantities</div>
              <div className="space-y-3">
                {Array.from(selectedSizes).map(size => (
                  <div key={size} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium">{BAG_SIZE_LABEL[size]}</div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        className="w-24 h-8"
                        value={bags[size] === 0 ? "" : bags[size]}
                        onChange={(e) => setBags(prev => ({ ...prev, [size]: parseInt(e.target.value) || 0 }))}
                      />
                      <span className="text-sm text-gray-500">bags</span>
                      <button 
                        onClick={() => fillMax(size)}
                        className="ml-2 px-2 py-1 text-[10px] font-bold uppercase text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded transition-colors"
                      >
                        Max
                      </button>
                    </div>
                    <div className="text-sm font-semibold ml-auto">= {(bags[size] || 0) * BAG_WEIGHT_KG[size]} kg</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-lg border flex justify-between text-sm">
            <div><span className="text-slate-500">Total bags:</span> <span className="font-bold">{totalBags}</span></div>
            <div><span className="text-slate-500">Allocated weight:</span> <span className="font-bold text-indigo-600">{totalAllocated} kg</span></div>
            <div><span className="text-slate-500">Unallocated raw:</span> <span className={`font-bold ${unallocated < 0 ? "text-red-500" : "text-emerald-600"}`}>{unallocated} kg</span></div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 border rounded text-sm font-semibold hover:bg-slate-50">Cancel</button>
            <button 
              onClick={onSubmit} 
              disabled={loading || !isValid} 
              className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Confirming..." : "Confirm Division"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
