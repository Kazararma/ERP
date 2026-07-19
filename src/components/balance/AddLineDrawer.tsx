// src/components/balance/AddLineDrawer.tsx
// Phase 2 — Sheet drawer for adding a manual line item to a balance sheet group.
// Follows the exact same pattern as ManualEntryForm.tsx in the Ledger module.
// Wired to React Hook Form + Zod; calls the Zustand store on submit.

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  balanceLineItemSchema,
  BalanceLineItemFormValues,
  GroupKey,
} from "@/types/balanceSheet";
import { useBalanceSheetStore } from "@/stores/useBalanceSheetStore";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddLineDrawerProps {
  open: boolean;
  onClose: () => void;
  groupKey: GroupKey | null;
  groupTitle: string;
  /** When set, the drawer operates in edit mode instead of add mode */
  editItem?: { id: string; label: string; amount: number; isSystemComputed?: boolean } | null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function AddLineDrawer({
  open,
  onClose,
  groupKey,
  groupTitle,
  editItem,
}: AddLineDrawerProps) {
  const { addLineItem, updateLineItem, removeLineItem } = useBalanceSheetStore();
  const isEditing = Boolean(editItem);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BalanceLineItemFormValues>({
    resolver: zodResolver(balanceLineItemSchema) as any,
    defaultValues: { label: "", amount: 0 },
  });

  // Populate form when switching to edit mode
  useEffect(() => {
    if (open && editItem) {
      reset({ label: editItem.label, amount: editItem.amount });
    } else if (open && !editItem) {
      reset({ label: "", amount: 0 });
    }
  }, [open, editItem, reset]);

  const onSubmit = async (values: BalanceLineItemFormValues) => {
    if (!groupKey) return;

    if (isEditing && editItem) {
      updateLineItem(groupKey, editItem.id, {
        label: values.label,
        amount: values.amount,
      });
    } else {
      addLineItem(groupKey, {
        label: values.label,
        amount: values.amount,
        isSystemComputed: false,
      });
    }

    reset();
    onClose();
  };

  const handleDelete = () => {
    if (!groupKey || !editItem) return;
    removeLineItem(groupKey, editItem.id);
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:w-[440px] sm:max-w-[440px] bg-white shadow-2xl p-0 flex flex-col"
      >
        <SheetHeader className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <SheetTitle className="text-xl font-bold text-slate-800">
            {isEditing ? "Edit Line Item" : "Add Line Item"}
          </SheetTitle>
          {groupKey && (
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Group:{" "}
              <span className="text-indigo-600 font-semibold">{groupTitle}</span>
            </p>
          )}
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="p-8 space-y-6 flex-1 overflow-y-auto">
            {/* Label */}
            <div className="space-y-1.5">
              <Label htmlFor="bs-label" className="text-slate-700 font-medium">
                Label <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="bs-label"
                placeholder="e.g. Proprietor Drawings"
                {...register("label")}
                className="shadow-sm"
                autoComplete="off"
              />
              {errors.label && (
                <p className="text-xs text-rose-500 mt-1">
                  {errors.label.message}
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="bs-amount" className="text-slate-800 font-bold">
                Amount (₹) <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="bs-amount"
                type="number"
                step="any"
                placeholder="0.00"
                disabled={editItem?.isSystemComputed}
                {...register("amount")}
                className="shadow-sm text-lg font-mono border-indigo-200 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-50"
              />
              {errors.amount && (
                <p className="text-xs text-rose-500 mt-1">
                  {errors.amount.message}
                </p>
              )}
              {editItem?.isSystemComputed ? (
                <p className="text-xs text-amber-600 font-medium mt-1">
                  Amounts for live rows are automatically calculated.
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">
                  Negative values are permitted for contra/adjustment entries.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200 bg-slate-50/50 flex gap-3 sticky bottom-0 z-10">
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={handleDelete}
                className="text-rose-500 border-rose-200 hover:bg-rose-50 hover:text-rose-700 shrink-0"
                title="Delete this line item"
              >
                <Trash2 size={16} />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-white shadow-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {isSubmitting
                ? "Saving…"
                : isEditing
                ? "Update Line"
                : "Add Line"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
