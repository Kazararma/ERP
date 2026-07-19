import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Inventory } from "@/types/inventory";
import { inventoryService } from "@/services/inventoryService";
import toast from "react-hot-toast";

interface AdjustInventoryModalProps {
  inv: Inventory;
  open: boolean;
  onClose: () => void;
}

export function AdjustInventoryModal({ inv, open, onClose }: AdjustInventoryModalProps) {
  const [type, setType] = useState<"raw" | "packed">("raw");
  const [amountStr, setAmountStr] = useState<string>(inv.remainingRawKg.toString());
  const [reason, setReason] = useState<"manual_adjustment" | "rounding">("manual_adjustment");
  const [loading, setLoading] = useState(false);

  const currentAmount = type === "raw" ? inv.remainingRawKg : inv.remainingPackedKg;
  const newAmount = parseFloat(amountStr) || 0;
  const diff = currentAmount - newAmount;

  const handleTypeChange = (t: "raw" | "packed") => {
    setType(t);
    setAmountStr((t === "raw" ? inv.remainingRawKg : inv.remainingPackedKg).toString());
  };

  const handleRound = () => {
    // Round down to the nearest 10
    const rounded = Math.floor(currentAmount / 10) * 10;
    setAmountStr(rounded.toString());
    setReason("rounding");
  };

  const handleSave = async () => {
    if (newAmount < 0) {
      toast.error("Amount cannot be negative");
      return;
    }
    if (newAmount === currentAmount) {
      onClose();
      return;
    }
    
    setLoading(true);
    try {
      await inventoryService.adjustInventoryAmount(inv.inventoryId, type, newAmount, reason);
      toast.success("Inventory adjusted successfully");
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to adjust inventory: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-white">
        <DialogHeader>
          <DialogTitle>Adjust Stock Amount</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={type === "raw" ? "default" : "outline"}
              onClick={() => handleTypeChange("raw")}
            >
              Raw Stock
            </Button>
            <Button
              variant={type === "packed" ? "default" : "outline"}
              onClick={() => handleTypeChange("packed")}
            >
              Packed Stock
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Amount (kg)</label>
            <Input 
              type="number"
              step="0.01"
              value={amountStr}
              onChange={(e) => {
                setAmountStr(e.target.value);
                setReason("manual_adjustment");
              }}
            />
          </div>

          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
            <div>
              <p className="text-sm text-slate-500">Current: {currentAmount} kg</p>
              <p className="text-sm font-bold text-slate-700">
                Diff: {diff > 0 ? `-${diff} kg (Excess/Loss)` : `+${Math.abs(diff)} kg`}
              </p>
            </div>
            {currentAmount > 10 && (
              <Button size="sm" variant="secondary" onClick={handleRound}>
                Round to 10s
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading || newAmount === currentAmount || isNaN(newAmount)}>
            {loading ? "Saving..." : "Save Adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
