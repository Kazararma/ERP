import React from "react";
import { format } from "date-fns";
import { useController, useForm } from "react-hook-form";
import { toast } from "sonner";
import { LedgerEntry } from "@/types/ledger-profile";
import { formatCurrency } from "@/lib/utils";
import {
  LedgerDisplayUnit,
  LEDGER_UNITS,
  getUnitConfig,
  convertSubParticulars,
  hasConvertiblePattern,
} from "@/lib/ledgerUnitConversion";
import { Trash2, Edit2, GripVertical, Loader2, Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Re-export so consumers can import the canonical type from here if needed
export type { LedgerDisplayUnit };
export { LEDGER_UNITS };


interface Props {
  entries: LedgerEntry[];
  activeUnit: LedgerDisplayUnit;
  onDeleteManual?: (entry: LedgerEntry) => void;
  onUpdateVchNo?: (entry: LedgerEntry, newVchNo: number) => Promise<void>;
  onUpdateEntry?: (entry: LedgerEntry, updates: Partial<LedgerEntry>) => Promise<void>;
  onUpdateAmount?: (entry: LedgerEntry, newDebit: number, newCredit: number) => Promise<void>;
  onReorder?: (newOrder: LedgerEntry[], activeId: string, oldIndex: number, newIndex: number) => void;
}

export function LedgerProfileTable({ entries, activeUnit, onDeleteManual, onUpdateVchNo, onUpdateEntry, onUpdateAmount, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const unitCfg = getUnitConfig(activeUnit);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = entries.findIndex((item) => item.id === active.id);
      const newIndex = entries.findIndex((item) => item.id === over.id);
      
      if (onReorder) {
        onReorder(arrayMove(entries, oldIndex, newIndex), active.id as string, oldIndex, newIndex);
      }
    }
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-3 py-4 w-10"></th>
              <th className="px-5 py-4 text-left w-28">Date</th>
              {/* Particulars header reflects active unit when convertible rows exist */}
              <th className="px-5 py-4 text-left">
                Particulars
                {activeUnit !== "kg" && (
                  <span className="ml-1.5 text-[9px] font-normal text-indigo-500 normal-case tracking-normal">
                    ({unitCfg.headerLabel})
                  </span>
                )}
              </th>
              <th className="px-5 py-4 text-center w-28">Vch Type</th>
              <th className="px-5 py-4 text-center w-24">Vch No.</th>
              <th className="px-5 py-4 text-right w-36">Debit (₹)</th>
              <th className="px-5 py-4 text-right w-36">Credit (₹)</th>
              <th className="px-5 py-4 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
              {entries.map((entry) => (
                <LedgerTableRow
                  key={entry.id}
                  entry={entry}
                  activeUnit={activeUnit}
                  onDeleteManual={onDeleteManual}
                  onUpdateVchNo={onUpdateVchNo}
                  onUpdateEntry={onUpdateEntry}
                  onUpdateAmount={onUpdateAmount}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </div>
    </DndContext>
  );
}

function LedgerTableRow({ 
  entry, 
  activeUnit,
  onDeleteManual,
  onUpdateVchNo,
  onUpdateEntry,
  onUpdateAmount,
}: { 
  entry: LedgerEntry,
  activeUnit: LedgerDisplayUnit,
  onDeleteManual?: (entry: LedgerEntry) => void,
  onUpdateVchNo?: (entry: LedgerEntry, newVchNo: number) => Promise<void>,
  onUpdateEntry?: (entry: LedgerEntry, updates: Partial<LedgerEntry>) => Promise<void>,
  onUpdateAmount?: (entry: LedgerEntry, newDebit: number, newCredit: number) => Promise<void>,
}) {
  // No per-row unit state — activeUnit is driven from the parent table
  const [isEditingVchNo, setIsEditingVchNo] = React.useState(false);
  const [editVchNoValue, setEditVchNoValue] = React.useState(entry.vchNo.toString());
  
  const [isEditingRow, setIsEditingRow] = React.useState(false);
  const [editState, setEditState] = React.useState({
    date: format(entry.date.toDate(), "yyyy-MM-dd"),
    particulars: entry.particulars,
    subParticulars: entry.subParticulars || "",
    vchType: entry.vchType,
    vchNo: entry.vchNo.toString()
  });
  const [isSaving, setIsSaving] = React.useState(false);
  
  const isConvertible = hasConvertiblePattern(entry.subParticulars);
  // Compute the converted sub-particulars string for display
  const displayedSub = isConvertible
    ? convertSubParticulars(entry.subParticulars ?? "", activeUnit)
    : (entry.subParticulars ?? "");


  const handleVchNoSubmit = async () => {
    const parsed = parseInt(editVchNoValue, 10);
    if (!isNaN(parsed) && parsed !== entry.vchNo && parsed > 0) {
      await onUpdateVchNo?.(entry, parsed);
    } else {
      setEditVchNoValue(entry.vchNo.toString()); // Revert if invalid
    }
    setIsEditingVchNo(false);
  };
  
  const handleRowSave = async () => {
    if (!onUpdateEntry) return;
    setIsSaving(true);
    try {
      await onUpdateEntry(entry, {
        date: new Date(editState.date) as any,
        particulars: editState.particulars,
        subParticulars: editState.subParticulars,
        vchType: editState.vchType as any,
        vchNo: parseInt(editState.vchNo, 10) || entry.vchNo,
      });
      setIsEditingRow(false);
    } finally {
      setIsSaving(false);
    }
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.5, backgroundColor: '#f8fafc', zIndex: 10, position: 'relative' as any } : {})
  };

  return (
    <tr ref={setNodeRef} style={style} className={`hover:bg-slate-50/80 transition-colors group ${isDragging ? 'shadow-lg' : ''}`}>
      <td className="px-3 py-4 text-slate-300 hover:text-slate-500 transition-colors cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical size={16} />
      </td>
      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
        {isEditingRow ? (
          <input type="date" value={editState.date} onChange={e => setEditState({...editState, date: e.target.value})} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
        ) : (
          format(entry.date.toDate(), "dd MMM yy")
        )}
      </td>
      <td className="px-5 py-4">
        {isEditingRow ? (
          <div className="space-y-2">
            <input type="text" value={editState.particulars} onChange={e => setEditState({...editState, particulars: e.target.value})} className="w-full px-2 py-1 text-sm font-semibold border border-slate-300 rounded" placeholder="Particulars" />
            <input type="text" value={editState.subParticulars} onChange={e => setEditState({...editState, subParticulars: e.target.value})} className="w-full px-2 py-1 text-xs border border-slate-300 rounded text-slate-500" placeholder="Sub Particulars" />
          </div>
        ) : (
          <>
            <p className="font-semibold text-slate-800">{entry.particulars}</p>

            {/* Sub-particulars: show converted string when unit is active */}
            {displayedSub && (
              <p className="text-xs text-slate-500 mt-1">{displayedSub}</p>
            )}

            {entry.refLabel && (
              <p className="text-xs text-indigo-600 font-medium mt-1">{entry.refLabel}</p>
            )}
          </>
        )}
      </td>
      <td className="px-5 py-4 text-center">
        {isEditingRow ? (
          <input type="text" value={editState.vchType} onChange={e => setEditState({...editState, vchType: e.target.value as any})} className="w-20 px-2 py-1 text-center text-sm border border-slate-300 rounded" />
        ) : (
          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200/60">
            {entry.vchType}
          </span>
        )}
      </td>
      <td className="px-5 py-4 text-center">
        {isEditingRow ? (
          <input type="number" value={editState.vchNo} onChange={e => setEditState({...editState, vchNo: e.target.value})} className="w-20 px-2 py-1 text-center text-sm font-medium border border-slate-300 rounded" />
        ) : isEditingVchNo ? (
          <input
            autoFocus
            className="w-20 px-2 py-1 text-center text-sm font-medium text-slate-700 bg-white border border-indigo-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            type="number"
            value={editVchNoValue}
            onChange={e => setEditVchNoValue(e.target.value)}
            onBlur={handleVchNoSubmit}
            onKeyDown={e => e.key === 'Enter' && handleVchNoSubmit()}
          />
        ) : (
          <div 
            className="inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 cursor-text group/vch transition-colors"
            onClick={() => {
              if (onUpdateVchNo) setIsEditingVchNo(true);
            }}
            title="Edit Voucher Number"
          >
            <span className="text-slate-600 font-medium">{entry.vchNo}</span>
            {onUpdateVchNo && (
              <Edit2 className="w-3 h-3 text-slate-300 group-hover/vch:text-indigo-500 opacity-0 group-hover/vch:opacity-100 transition-all" />
            )}
          </div>
        )}
      </td>
      <td className="px-5 py-4 text-right">
        <InlineAmountCell
          value={entry.debit}
          colorClass="text-rose-600"
          siblingValue={entry.credit}
          onSave={async (newVal) => {
            // Editing Debit zeroes out Credit to enforce single-side convention
            await onUpdateAmount?.(entry, newVal, newVal > 0 ? 0 : entry.credit);
          }}
          disabled={!onUpdateAmount}
        />
      </td>
      <td className="px-5 py-4 text-right">
        <InlineAmountCell
          value={entry.credit}
          colorClass="text-emerald-600"
          siblingValue={entry.debit}
          onSave={async (newVal) => {
            // Editing Credit zeroes out Debit to enforce single-side convention
            await onUpdateAmount?.(entry, newVal > 0 ? 0 : entry.debit, newVal);
          }}
          disabled={!onUpdateAmount}
        />
      </td>
      <td className="px-5 py-4 text-center">
        {isEditingRow ? (
          <div className="flex flex-col gap-1 items-center">
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRowSave(); }} disabled={isSaving} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Save</button>
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditingRow(false); }} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {onUpdateEntry && (
              <button
                onClick={() => {
                  setEditState({
                    date: format(entry.date.toDate(), "yyyy-MM-dd"),
                    particulars: entry.particulars,
                    subParticulars: entry.subParticulars || "",
                    vchType: entry.vchType,
                    vchNo: entry.vchNo.toString()
                  });
                  setIsEditingRow(true);
                }}
                className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-md transition-all"
                title="Edit ledger row"
              >
                <Edit2 size={16} />
              </button>
            )}
            {onDeleteManual && !entry.isSystemGenerated && (
              <button
                onClick={() => onDeleteManual(entry)}
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-md transition-all"
                title="Delete manual ledger entry"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── InlineAmountCell ─────────────────────────────────────────────────────────
// A self-contained inline-editable cell for a single Debit or Credit amount.
// Clicking the displayed value or the pencil icon switches it to an input.
// Saving (onBlur / Enter) triggers an async callback and shows a toast.

interface InlineAmountCellProps {
  value: number;         // Current stored amount (0 means empty)
  colorClass: string;    // Tailwind text color class for the display value
  siblingValue: number;  // The opposite column's value (for context display)
  onSave: (newValue: number) => Promise<void>;
  disabled?: boolean;
}

function InlineAmountCell({ value, colorClass, onSave, disabled }: InlineAmountCellProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  // Local raw string state for the input — avoids locale formatting issues
  const [inputVal, setInputVal] = React.useState("");

  const handleStartEdit = () => {
    if (disabled) return;
    // Pre-fill with the raw numeric value (empty string if 0)
    setInputVal(value > 0 ? value.toString() : "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInputVal("");
  };

  const handleCommit = async () => {
    const parsed = parseFloat(inputVal);
    const newValue = isNaN(parsed) || inputVal.trim() === "" ? 0 : Math.max(0, parsed);

    // Skip save if value hasn't changed
    if (newValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setIsEditing(false);
    try {
      await onSave(newValue);
      toast.success("Amount updated", {
        description: newValue > 0 ? `Set to ${formatCurrency(newValue)}` : "Cleared to —",
        duration: 2500,
      });
    } catch (err: any) {
      toast.error("Failed to update amount", {
        description: err?.message ?? "An unexpected error occurred.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isSaving) {
    return (
      <div className="flex justify-end items-center pr-1">
        <Loader2 size={15} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        type="number"
        min="0"
        step="0.01"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className={`
          w-full max-w-[130px] ml-auto block
          px-2 py-1 text-right text-sm font-mono font-medium
          border border-indigo-400 rounded-md shadow-sm
          bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500
          ${colorClass}
        `}
        placeholder="0.00"
      />
    );
  }

  return (
    <div
      className={`group/amount flex items-center justify-end gap-1.5 ${disabled ? "" : "cursor-pointer"}`}
      onClick={handleStartEdit}
      title={disabled ? undefined : "Click to edit amount"}
    >
      <span className={`font-mono font-medium ${value > 0 ? colorClass : "text-slate-300"}`}>
        {value > 0 ? formatCurrency(value) : "—"}
      </span>
      {!disabled && (
        <Pencil
          size={11}
          className="text-slate-300 group-hover/amount:text-indigo-500 opacity-0 group-hover/amount:opacity-100 transition-all flex-shrink-0"
        />
      )}
    </div>
  );
}
