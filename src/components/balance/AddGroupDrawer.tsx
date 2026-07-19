// src/components/balance/AddGroupDrawer.tsx
// Slide-in drawer for adding a new "major row" (group) to Liabilities or Assets.
// The user picks a title; a unique slug key is auto-generated from it.
// After creation the group is empty — line items are added via AddLineDrawer.

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LayoutList } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBalanceSheetStore } from "@/stores/useBalanceSheetStore";
import type { BalanceSide } from "@/types/balanceSheet";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z
    .string()
    .min(1, "Group name is required")
    .max(80, "Max 80 characters")
    .trim(),
});

type FormValues = z.infer<typeof schema>;

/** Converts a human title into a safe camelCase-ish key, e.g. "New Fixed Assets" → "custom.newFixedAssets" */
function toGroupKey(title: string, side: BalanceSide): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `custom.${side}.${slug}.${Date.now()}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddGroupDrawerProps {
  open: boolean;
  onClose: () => void;
  side: BalanceSide;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddGroupDrawer({ open, onClose, side }: AddGroupDrawerProps) {
  const addGroup = useBalanceSheetStore((s) => s.addGroup);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { title: "" },
  });

  useEffect(() => {
    if (open) reset({ title: "" });
  }, [open, reset]);

  const onSubmit = (values: FormValues) => {
    addGroup({
      key: toGroupKey(values.title, side),
      title: values.title.trim(),
      side,
      allowManualAdd: true,
    });
    reset();
    onClose();
  };

  const sideLabel = side === "liabilities" ? "Liabilities" : "Assets";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] sm:max-w-[420px] bg-white shadow-2xl p-0 flex flex-col"
      >
        <SheetHeader className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2 rounded-lg shadow">
              <LayoutList size={16} className="text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold text-slate-800">
                Add Major Row
              </SheetTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Adding to{" "}
                <span className="font-semibold text-indigo-600">{sideLabel}</span>
              </p>
            </div>
          </div>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="p-8 space-y-6 flex-1 overflow-y-auto">
            {/* Info callout */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 text-xs text-indigo-700 leading-relaxed">
              A <strong>major row</strong> is a top-level group heading (like{" "}
              <em>Fixed Assets</em> or <em>Capital Account</em>). After creating
              it, you can add individual line items beneath it using the{" "}
              <strong>＋ Add Line</strong> button that appears on hover.
            </div>

            {/* Group Name */}
            <div className="space-y-1.5">
              <Label htmlFor="group-title" className="text-slate-700 font-medium">
                Group Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="group-title"
                placeholder={
                  side === "liabilities"
                    ? "e.g. Long-term Borrowings"
                    : "e.g. Intangible Assets"
                }
                {...register("title")}
                className="shadow-sm text-base"
                autoComplete="off"
                autoFocus
              />
              {errors.title && (
                <p className="text-xs text-rose-500 mt-1">{errors.title.message}</p>
              )}
              <p className="text-xs text-slate-400">
                This will appear as a bold header row in the{" "}
                {sideLabel} column.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200 bg-slate-50/50 flex gap-3 sticky bottom-0 z-10">
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
              {isSubmitting ? "Creating…" : "Create Group"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
