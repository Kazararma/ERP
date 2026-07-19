import { useState } from "react";
import { DEAL_TYPE_LABELS } from "@/constants/dealLabels";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BagDivision } from "@/types/deal";
import { deleteBagDivision } from "@/services/bagDivisionService";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useUiStore } from "@/stores/uiStore";

interface Props {
  dealId: string;
  divisions: BagDivision[];
  onUpdate: () => void;
}

export function EditDivisionsModal({ dealId, divisions, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleDelete = async (divisionId: string) => {
    const confirmed = await useUiStore.getState().requestConfirm("Revert Division", "Are you sure you want to revert this division? The bags will be removed from inventory and converted back to raw stock.");
    if (!confirmed) return;
    
    setLoadingId(divisionId);
    try {
      await deleteBagDivision(dealId, divisionId);
      toast.success("Division reverted successfully");
      onUpdate();
      // If that was the last division, close the modal automatically
      if (divisions.length === 1) setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete division");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <button 
            className="ml-2 text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors"
            title="Edit Divisions"
          >
            Edit
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Edit Packings</DialogTitle>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-500 mb-4">
            If you made a mistake while packing bags, you can delete a packing event to revert it.
          </p>
          
          {divisions.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-4">No packings found.</div>
          ) : (
            <div className="space-y-2">
              {divisions.map((div, i) => {
                const isPartiallySold = div.availableBags < div.numberOfBags;
                return (
                  <div key={div.divisionId} className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">Event {i + 1}: {div.numberOfBags} × {div.bagSize}</div>
                      <div className="text-xs text-slate-500">
                        {isPartiallySold ? (
                          <span className="text-amber-600 font-semibold">⚠️ Cannot delete (some bags sold)</span>
                        ) : (
                          <span>All {div.availableBags} bags available</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(div.divisionId)}
                      disabled={loadingId === div.divisionId || isPartiallySold}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isPartiallySold ? `Cannot delete ${DEAL_TYPE_LABELS.sold.toLowerCase()} bags` : "Delete packing"}
                    >
                      {loadingId === div.divisionId ? "..." : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="flex justify-end pt-4 mt-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-slate-50">Done</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
