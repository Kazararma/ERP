// src/components/balance/RestoreGroupPopover.tsx
// Shows a dropdown list of default groups that have been deleted.
// Each entry has a one-click "Restore" button that re-inserts the group
// at its original position using the store's restoreGroup() action.

import { useState, useRef, useEffect } from "react";
import { RotateCcw, ChevronDown, CheckCircle2 } from "lucide-react";
import { useBalanceSheetStore } from "@/stores/useBalanceSheetStore";
import { DEFAULT_GROUPS } from "@/stores/useBalanceSheetStore";
import type { BalanceSide } from "@/types/balanceSheet";

interface RestoreGroupPopoverProps {
  side: BalanceSide;
}

export function RestoreGroupPopover({ side }: RestoreGroupPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groups = useBalanceSheetStore((s) => s.groups);
  const restoreGroup = useBalanceSheetStore((s) => s.restoreGroup);

  // Default groups that belong to this side and are currently absent
  const missingDefaults = DEFAULT_GROUPS.filter(
    (d) => d.side === side && !groups.some((g) => g.key === d.key)
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Nothing to show if no defaults are missing
  if (missingDefaults.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-colors"
        title="Restore a deleted default group"
      >
        <RotateCcw size={10} />
        Restore
        <ChevronDown
          size={9}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-1 overflow-hidden">
          <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
            Deleted default groups
          </p>
          {missingDefaults.map((group) => (
            <button
              key={group.key}
              onClick={() => {
                restoreGroup(group.key);
                // Auto-close if nothing left
                if (missingDefaults.length <= 1) setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors group"
            >
              <span className="font-medium truncate">{group.title}</span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <CheckCircle2 size={12} />
                Restore
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
