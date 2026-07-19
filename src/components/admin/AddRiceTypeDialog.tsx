import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import { addRiceType } from "@/services/riceTypeService";

export function AddRiceTypeDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !displayName || !user) return;
    setIsSubmitting(true);
    setError("");

    try {
      await addRiceType(code, displayName, user.uid);
      setOpen(false);
      setCode("");
      setDisplayName("");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to add rice type");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors">
            + Add Rice Type
          </button>
        }
      />
      <DialogContent className="sm:max-w-md w-full">
        <DialogTitle className="text-xl font-bold">New Rice Type</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Code</Label>
            <Input 
              placeholder="e.g. ls, ir64" 
              value={code} 
              onChange={e => setCode(e.target.value.toLowerCase().replace(/\s/g, ''))} 
              required
            />
            <p className="text-xs text-slate-500">Short identifier, no spaces.</p>
          </div>
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input 
              placeholder="e.g. Lal Shonno" 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              required
            />
          </div>
          {error && <div className="text-red-500 text-sm font-semibold">{error}</div>}
          <div className="pt-4 flex justify-end gap-3 border-t">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSubmitting || !code || !displayName} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {isSubmitting ? "Adding..." : "Add Rice Type"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
