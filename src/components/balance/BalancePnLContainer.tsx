// src/components/balance/BalancePnLContainer.tsx
import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { Scale, Plus, RefreshCw, FileText, Pencil, Trash2, LayoutList, RotateCcw } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useBalanceSheetStore, DEFAULT_GROUPS } from "@/stores/useBalanceSheetStore";
import { AddLineDrawer } from "./AddLineDrawer";
import { AddGroupDrawer } from "./AddGroupDrawer";
import { RestoreGroupPopover } from "./RestoreGroupPopover";
import { ReceiptDialog } from "./ReceiptDialog/ReceiptDialog";
import { MicroRowBreakdown } from "./MicroRowBreakdown";
import { BalanceSheetPdf } from "./pdf/BalanceSheetPdf";
import { getAggregatedFinancials } from "@/services/balanceSheetAggregation";
import type { GroupKey, BalanceLineItem, BalanceSheetGroup, BalanceSide } from "@/types/balanceSheet";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

function hasMissingLiveItems(groupKey: string, currentItems: BalanceLineItem[]) {
  const template = DEFAULT_GROUPS.find((g) => g.key === groupKey);
  if (!template) return false;
  const defaultLive = template.items.filter((i) => i.isSystemComputed);
  return defaultLive.some((dli) => !currentItems.some((i) => i.isSystemComputed && (i.source === dli.source || i.label === dli.label)));
}

const todayStr = new Date().toLocaleDateString("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

// ─── Drawer State ─────────────────────────────────────────────────────────────

interface DrawerState {
  open: boolean;
  groupKey: GroupKey | null;
  groupTitle: string;
  editItem: { id: string; label: string; amount: number; isSystemComputed?: boolean } | null;
}

const CLOSED_DRAWER: DrawerState = {
  open: false,
  groupKey: null,
  groupTitle: "",
  editItem: null,
};

// ─── Shared Editable Component ──────────────────────────────────────────────────

function EditableTitle({
  title,
  onSave,
  className = "",
  inputClassName = "text-[13px] font-bold",
  children,
}: {
  title: string;
  onSave?: (newTitle: string) => void;
  className?: string;
  inputClassName?: string;
  children?: React.ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  // Sync editValue if title changes externally
  useEffect(() => {
    setEditValue(title);
  }, [title]);

  if (!onSave) {
    return (
      <span className={className}>
        {title}
        {children}
      </span>
    );
  }

  return (
    <span className={className}>
      {isEditing ? (
        <input
          autoFocus
          className={`px-1 py-0.5 border border-indigo-300 rounded text-slate-800 outline-none min-w-[120px] w-auto bg-white/80 ${inputClassName}`}
          value={editValue}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            if (editValue.trim() && editValue !== title) onSave(editValue.trim());
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              if (editValue.trim() && editValue !== title) onSave(editValue.trim());
              setIsEditing(false);
            }
            if (e.key === "Escape") {
              setEditValue(title);
              setIsEditing(false);
            }
          }}
        />
      ) : (
        <>
          {title}
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsEditing(true);
            }}
            className="opacity-40 group-hover/grow:opacity-100 group-hover/item:opacity-100 transition-opacity ml-1 text-indigo-500 hover:text-indigo-700"
            title={`Rename ${title}`}
          >
            <Pencil size={10} />
          </button>
          {children}
        </>
      )}
    </span>
  );
}

function EditableAmount({
  amount,
  onSave,
  disabled = false,
  className = "",
}: {
  amount: number;
  onSave: (newAmount: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(amount.toString());

  useEffect(() => {
    setEditValue(amount.toString());
  }, [amount]);

  if (disabled) {
    return <span className={className}>{fmt(amount)}</span>;
  }

  return (
    <span className={`inline-flex items-center justify-end gap-1.5 ${className}`}>
      {isEditing ? (
        <input
          autoFocus
          type="number"
          step="any"
          className="px-1 py-0.5 border border-indigo-300 rounded text-slate-800 outline-none w-28 text-right bg-white/80 tabular-nums"
          value={editValue}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            const num = parseFloat(editValue);
            if (!isNaN(num) && num !== amount) onSave(num);
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              const num = parseFloat(editValue);
              if (!isNaN(num) && num !== amount) onSave(num);
              setIsEditing(false);
            }
            if (e.key === "Escape") {
              setEditValue(amount.toString());
              setIsEditing(false);
            }
          }}
        />
      ) : (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsEditing(true);
            }}
            className="opacity-0 group-hover/item:opacity-50 transition-opacity text-indigo-500 hover:text-indigo-700 mt-0.5"
            title="Edit Amount"
          >
            <Pencil size={9} />
          </button>
          <span>{fmt(amount)}</span>
        </>
      )}
    </span>
  );
}

// ─── Tally Row Sub-components ─────────────────────────────────────────────────

/** A group-level header row: bold name on left, total on right */
function GroupRow({
  title,
  total,
  highlight = false,
  indent = 0,
  onAdd,
  onEditTitle,
  onDelete,
}: {
  title: string;
  total: number;
  highlight?: boolean;
  indent?: number;
  onAdd?: () => void;
  onEditTitle?: (newTitle: string) => void;
  onDelete?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  return (
    <tr
      className={`group/grow border-t border-slate-200 ${
        highlight ? "bg-amber-50" : "hover:bg-slate-50/60"
      }`}
    >
      <td
        className="py-1 pr-2 font-bold text-[13px] text-slate-800"
        style={{ paddingLeft: `${indent * 16 + 4}px` }}
      >
        <span className="flex items-center gap-1">
          {isEditing ? (
            <input
              autoFocus
              className="px-1 py-0.5 border border-indigo-300 rounded text-[13px] font-bold text-slate-800 outline-none min-w-[120px] w-auto bg-white/80"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => {
                if (editValue.trim() && editValue !== title && onEditTitle) {
                  onEditTitle(editValue.trim());
                }
                setIsEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (editValue.trim() && editValue !== title && onEditTitle) {
                    onEditTitle(editValue.trim());
                  }
                  setIsEditing(false);
                }
                if (e.key === "Escape") {
                  setEditValue(title);
                  setIsEditing(false);
                }
              }}
            />
          ) : (
            <>
              {title}
              {onEditTitle && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="opacity-40 group-hover/grow:opacity-100 transition-opacity ml-1 text-indigo-500 hover:text-indigo-700"
                  title={`Rename ${title}`}
                >
                  <Pencil size={10} />
                </button>
              )}
              {onAdd && (
                <button
                  onClick={onAdd}
                  className="opacity-40 group-hover/grow:opacity-100 transition-opacity ml-1 text-indigo-500 hover:text-indigo-700"
                  title={`Add line to ${title}`}
                >
                  <Plus size={11} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete ${title}?`)) {
                      onDelete();
                    }
                  }}
                  className="opacity-0 group-hover/grow:opacity-100 transition-opacity ml-2 text-rose-400 hover:text-rose-600"
                  title={`Delete ${title}`}
                >
                  <Trash2 size={10} />
                </button>
              )}
            </>
          )}
        </span>
      </td>
      <td className="py-1 pl-2 text-right font-bold text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
        {total !== 0 ? fmt(total) : ""}
      </td>
    </tr>
  );
}

function PnLGroupRow({
  group,
  groupTotal,
  onEditTitle,
  onAdd,
  onRestore,
}: {
  group: BalanceSheetGroup;
  groupTotal: number;
  onEditTitle: (newTitle: string) => void;
  onAdd?: () => void;
  onRestore?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(group.title);

  return (
    <tr className="bg-slate-50 border-t border-slate-200 group/grow">
      <td className="py-1 px-1 font-bold text-[13px] text-slate-800">
        <span className="flex items-center gap-1">
          {isEditing ? (
            <input
              autoFocus
              className="px-1 py-0.5 border border-indigo-300 rounded text-[13px] font-bold text-slate-800 outline-none min-w-[120px] w-auto bg-white/80"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => {
                if (editValue.trim() && editValue !== group.title) onEditTitle(editValue.trim());
                setIsEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (editValue.trim() && editValue !== group.title) onEditTitle(editValue.trim());
                  setIsEditing(false);
                }
                if (e.key === "Escape") {
                  setEditValue(group.title);
                  setIsEditing(false);
                }
              }}
            />
          ) : (
            <>
              {group.title}
              <button
                onClick={() => setIsEditing(true)}
                className="opacity-40 group-hover/grow:opacity-100 transition-opacity ml-1 text-indigo-500 hover:text-indigo-700"
                title={`Rename ${group.title}`}
              >
                <Pencil size={10} />
              </button>
              {group.allowManualAdd && (
                <button
                  onClick={onAdd}
                  className="opacity-40 group-hover/grow:opacity-100 transition-opacity ml-1 text-indigo-500 hover:text-indigo-700"
                  title={`Add line to ${group.title}`}
                >
                  <Plus size={10} />
                </button>
              )}
              {group.allowManualAdd && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete ${group.title}?`)) {
                      useBalanceSheetStore.getState().removeGroup(group.key);
                    }
                  }}
                  className="opacity-0 group-hover/grow:opacity-100 transition-opacity ml-2 text-rose-400 hover:text-rose-600"
                  title={`Delete ${group.title}`}
                >
                  <Trash2 size={10} />
                </button>
              )}
              {hasMissingLiveItems(group.key, group.items) && onRestore && (
                <button
                  onClick={onRestore}
                  className="opacity-0 group-hover/grow:opacity-100 transition-opacity text-amber-500 hover:text-amber-700"
                  title="Restore live rows"
                >
                  <RotateCcw size={10} />
                </button>
              )}
            </>
          )}
        </span>
      </td>
      <td className="py-1 px-2 text-right font-bold text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
        {groupTotal !== 0 ? fmt(groupTotal) : ""}
      </td>
    </tr>
  );
}

/** A line-item row: italic label indented, amount at right */
function ItemRow({
  item,
  groupKey,
  onEdit,
  onInlineSave,
  onRestore,
}: {
  item: BalanceLineItem;
  groupKey: string;
  onEdit: (item: BalanceLineItem) => void;
  onInlineSave: (item: BalanceLineItem, newAmount: number) => void;
  onRestore: (groupKey: string, itemId: string) => void;
}) {
  return (
    <tr
      className="group/item cursor-pointer hover:bg-indigo-50/40"
      onClick={() => onEdit(item)}
    >
      <td className="py-0.5 pl-8 pr-2 text-[12px] italic text-slate-500 flex items-center gap-1.5">
        <span className="truncate">{item.label}</span>
        {item.isSystemComputed && (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded-full leading-none">
            <RefreshCw size={7} />
            Live
          </span>
        )}
        <Pencil
          size={10}
          className="opacity-30 group-hover/item:opacity-80 text-indigo-500 shrink-0 transition-opacity ml-1"
        />
      </td>
      <td className="py-0.5 pl-2 text-right text-[12px] text-slate-600 whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          {item.isOverridden && item.isSystemComputed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore(groupKey, item.id);
              }}
              className="text-amber-500 hover:text-amber-700 transition-colors"
              title="Restore computed amount"
            >
              <RotateCcw size={10} />
            </button>
          )}
          <EditableAmount 
            amount={item.amount} 
            onSave={(newAmount) => onInlineSave(item, newAmount)} 
          />
        </div>
      </td>
    </tr>
  );
}

/** A total footer row */
function TotalRow({ label, total }: { label: string; total: number }) {
  return (
    <tr className="border-t-2 border-slate-700 bg-slate-50">
      <td className="py-1.5 px-1 text-[13px] font-black text-slate-800 uppercase tracking-wider">
        {label}
      </td>
      <td className="py-1.5 px-2 text-right text-[13px] font-black text-slate-900 tabular-nums whitespace-nowrap">
        {fmt(total)}
      </td>
    </tr>
  );
}

/** A spacer row */
function SpacerRow() {
  return (
    <tr>
      <td colSpan={2} className="py-1" />
    </tr>
  );
}

// ─── Grouping logic for Tally-style "Current Liabilities" parent rows ─────────

interface ParentGroup {
  key: string;
  title: string;
  children: BalanceSheetGroup[];
  highlight?: boolean;
  isCustom?: boolean;
}

function buildLiabilityParents(groups: BalanceSheetGroup[], parentTitles: Record<string, string>): ParentGroup[] {
  const capitalAccount = groups.filter((g) => g.key === "capitalAccount");
  const currentLiab = groups.filter((g) => g.key.startsWith("currentLiabilities."));
  const suspense = groups.filter((g) => g.key === "suspenseAc");
  const diff = groups.filter((g) => g.key === "differenceInOpeningBalances");
  const custom = groups.filter((g) => g.key.startsWith("custom.liabilities."));
  const rest = groups.filter(
    (g) =>
      !g.key.startsWith("currentLiabilities.") &&
      !g.key.startsWith("custom.") &&
      g.key !== "capitalAccount" &&
      g.key !== "suspenseAc" &&
      g.key !== "differenceInOpeningBalances"
  );

  const result: ParentGroup[] = [];
  if (capitalAccount.length) result.push({ key: "capitalAccount", title: parentTitles["capitalAccount"] || "Capital Account", children: capitalAccount });
  if (currentLiab.length) result.push({ key: "currentLiabilities", title: parentTitles["currentLiabilities"] || "Current Liabilities", children: currentLiab, highlight: true });
  result.push(...suspense.map((g) => ({ key: g.key, title: g.title, children: [g] })));
  result.push(...diff.map((g) => ({ key: g.key, title: g.title, children: [g] })));
  result.push(...rest.map((g) => ({ key: g.key, title: g.title, children: [g] })));
  result.push(...custom.map((g) => ({ key: g.key, title: g.title, children: [g], isCustom: true })));
  return result;
}

function buildAssetParents(groups: BalanceSheetGroup[], parentTitles: Record<string, string>): ParentGroup[] {
  const loansLiab = groups.filter((g) => g.key === "loansLiability");
  const fixedAssets = groups.filter((g) => g.key === "fixedAssets");
  const currentAssets = groups.filter((g) => g.key.startsWith("currentAssets."));
  const pnl = groups.filter((g) => g.key === "profitAndLossAc");
  const custom = groups.filter((g) => g.key.startsWith("custom.assets."));
  const rest = groups.filter(
    (g) =>
      g.key !== "loansLiability" &&
      g.key !== "fixedAssets" &&
      !g.key.startsWith("currentAssets.") &&
      !g.key.startsWith("custom.") &&
      g.key !== "profitAndLossAc"
  );

  const result: ParentGroup[] = [];
  if (loansLiab.length) result.push({ key: "loansLiability", title: parentTitles["loansLiability"] || "Loans (Liability)", children: loansLiab });
  if (fixedAssets.length) result.push({ key: "fixedAssets", title: parentTitles["fixedAssets"] || "Fixed Assets", children: fixedAssets });
  if (currentAssets.length) result.push({ key: "currentAssets", title: parentTitles["currentAssets"] || "Current Assets", children: currentAssets, highlight: true });
  if (pnl.length) result.push({ key: "profitAndLossAc", title: parentTitles["profitAndLossAc"] || "Profit & Loss A/c", children: pnl });
  result.push(...rest.map((g) => ({ key: g.key, title: g.title, children: [g] })));
  result.push(...custom.map((g) => ({ key: g.key, title: g.title, children: [g], isCustom: true })));
  return result;
}

// ─── Tally Column renderer ────────────────────────────────────────────────────

function TallyColumn({
  parents,
  onOpenDrawer,
}: {
  parents: ParentGroup[];
  onOpenDrawer: (state: DrawerState) => void;
}) {
  const renameGroup = useBalanceSheetStore((s) => s.renameGroup);
  const renameParentGroup = useBalanceSheetStore((s) => s.renameParentGroup);
  const removeGroup = useBalanceSheetStore((s) => s.removeGroup);
  const rows: React.ReactNode[] = [];

  for (const parent of parents) {
    const isGroup = parent.children.length > 1 || parent.highlight;
    const parentTotal = parent.children
      .flatMap((g) => g.items)
      .reduce((s, i) => s + (i.amount || 0), 0);

    if (isGroup) {
      // Parent header row (e.g. "Current Liabilities")
      rows.push(
        <GroupRow
          key={`parent-${parent.key}`}
          title={parent.title}
          total={parentTotal}
          highlight={parent.highlight}
          onEditTitle={(newTitle) => renameParentGroup(parent.key, newTitle)}
          indent={0}
        />
      );
      // Children
      for (const group of parent.children) {
        const groupTotal = group.items.reduce((s, i) => s + (i.amount || 0), 0);
        rows.push(
          <GroupRow
            key={`group-${group.key}`}
            title={group.title}
            total={groupTotal}
            indent={1}
            onEditTitle={(newTitle) => renameGroup(group.key, newTitle)}
            onDelete={() => removeGroup(group.key)}
            onAdd={
              group.allowManualAdd
                ? () =>
                    onOpenDrawer({
                      open: true,
                      groupKey: group.key as GroupKey,
                      groupTitle: group.title,
                      editItem: null,
                    })
                : undefined
            }
          />
        );
        for (const item of group.items) {
          rows.push(
            <ItemRow
              key={item.id}
              item={item}
              groupKey={group.key}
              onEdit={(i) =>
                onOpenDrawer({
                  open: true,
                  groupKey: group.key as GroupKey,
                  groupTitle: group.title,
                  editItem: { id: i.id, label: i.label, amount: i.amount, isSystemComputed: i.isSystemComputed },
                })
              }
              onInlineSave={(i, newAmount) => useBalanceSheetStore.getState().updateLineItem(group.key as GroupKey, i.id, { amount: newAmount })}
              onRestore={(gKey, iId) => useBalanceSheetStore.getState().restoreLiveItemAmount(gKey as GroupKey, iId)}
            />
          );
        }
      }
    } else {
      // Single standalone group (e.g. Capital Account)
      const group = parent.children[0];
      const groupTotal = group.items.reduce((s, i) => s + (i.amount || 0), 0);
      rows.push(
        <GroupRow
          key={`group-${group.key}`}
          title={group.title}
          total={groupTotal}
          indent={0}
          onEditTitle={(newTitle) => renameGroup(group.key, newTitle)}
          onDelete={() => removeGroup(group.key)}
          onAdd={
            group.allowManualAdd
              ? () =>
                  onOpenDrawer({
                    open: true,
                    groupKey: group.key as GroupKey,
                    groupTitle: group.title,
                    editItem: null,
                  })
              : undefined
          }
        />
      );
      for (const item of group.items) {
        rows.push(
          <ItemRow
            key={item.id}
            item={item}
            groupKey={group.key}
            onEdit={(i) =>
              onOpenDrawer({
                open: true,
                groupKey: group.key as GroupKey,
                groupTitle: group.title,
                editItem: { id: i.id, label: i.label, amount: i.amount, isSystemComputed: i.isSystemComputed },
              })
            }
            onInlineSave={(i, newAmount) => useBalanceSheetStore.getState().updateLineItem(group.key as GroupKey, i.id, { amount: newAmount })}
            onRestore={(gKey, iId) => useBalanceSheetStore.getState().restoreLiveItemAmount(gKey as GroupKey, iId)}
          />
        );
      }
    }
  }

  // Spacer to push totals to bottom
  rows.push(<SpacerRow key="spacer" />);

  return <>{rows}</>;
}

// ─── BALANCE SHEET TAB ────────────────────────────────────────────────────────

function BalanceSheetTab({
  isLoading,
  lastSyncedAt,
  setExpandedItem,
}: {
  isLoading: boolean;
  lastSyncedAt: string;
  setExpandedItem: (item: BalanceLineItem | null) => void;
}) {
  const [drawer, setDrawer] = useState<DrawerState>(CLOSED_DRAWER);
  const [groupDrawer, setGroupDrawer] = useState<{ open: boolean; side: BalanceSide }>({ open: false, side: "liabilities" });
  
  const groups = useBalanceSheetStore(useShallow((s) => s.groups));
  const parentTitles = useBalanceSheetStore(useShallow((s) => s.parentTitles));
  const totalsBySide = useBalanceSheetStore(useShallow((s) => s.totalsBySide()));
  const { liabilities, assets, delta } = totalsBySide;
  const isBalanced = Math.abs(delta) < 0.01;
  const removeLineItem = useBalanceSheetStore((s) => s.removeLineItem);
  const removeGroup = useBalanceSheetStore((s) => s.removeGroup);
  const restoreLiveItems = useBalanceSheetStore((s) => s.restoreLiveItems);
  const renameGroup = useBalanceSheetStore((s) => s.renameGroup);
  const renameParentGroup = useBalanceSheetStore((s) => s.renameParentGroup);

  const openDrawer = useCallback((state: DrawerState) => setDrawer(state), []);
  const closeDrawer = useCallback(() => setDrawer(CLOSED_DRAWER), []);
  const openGroupDrawer = useCallback((side: BalanceSide) => setGroupDrawer({ open: true, side }), []);
  const closeGroupDrawer = useCallback(() => setGroupDrawer((p) => ({ ...p, open: false })), []);

  const liabGroups = groups.filter((g) => g.side === "liabilities");
  const assetGroups = groups.filter((g) => g.side === "assets");
  const liabParents = buildLiabilityParents(liabGroups, parentTitles);
  const assetParents = buildAssetParents(assetGroups, parentTitles);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm gap-2">
        <RefreshCw size={16} className="animate-spin" />
        Loading financial data…
      </div>
    );
  }

  return (
    <>
      {/* Balance banner */}
      <div
        className={`shrink-0 flex items-center justify-between px-4 py-2 rounded-lg border text-sm font-semibold mb-2 ${
          isBalanced
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-amber-50 border-amber-300 text-amber-800"
        }`}
      >
        <span className="flex items-center gap-2">
          <Scale size={14} />
          {isBalanced
            ? "✓ Balance Sheet is Balanced"
            : `⚠ Unbalanced — ${
                delta > 0 ? "Assets exceed Liabilities" : "Liabilities exceed Assets"
              } by ${fmt(Math.abs(delta))}`}
        </span>
        <span className="text-xs font-normal opacity-70">
          {lastSyncedAt ? `Synced ${lastSyncedAt}` : "Live data synced"}
        </span>
      </div>

      {/* Main ledger table */}
      <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-lg bg-white shadow-sm">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "55%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "1px" }} />
            <col style={{ width: "55%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 border-b-2 border-slate-300">
              <th colSpan={2} className="py-2 px-2 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Liabilities</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to restore all live details? This will reset all system values to their live state, but won't delete your manual rows.")) {
                          useBalanceSheetStore.getState().restoreAllLiveDetails();
                        }
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition-colors"
                      title="Restore all live details"
                    >
                      <RefreshCw size={10} />
                      Live
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to revert all manual changes and restore the default system balance sheet?")) {
                          useBalanceSheetStore.getState().resetToDefault();
                        }
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md transition-colors"
                      title="Restore to system default"
                    >
                      <RotateCcw size={10} />
                      Default
                    </button>
                    <RestoreGroupPopover side="liabilities" />
                    <button
                      onClick={() => openGroupDrawer("liabilities")}
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md transition-colors"
                      title="Add a new major group to Liabilities"
                    >
                      <LayoutList size={10} />
                      + Major Row
                    </button>
                  </div>
                </div>
              </th>
              <td className="bg-slate-300 p-0 w-px" rowSpan={1000} />
              <th colSpan={2} className="py-2 px-2 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Assets</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to restore all live details? This will reset all system values to their live state, but won't delete your manual rows.")) {
                          useBalanceSheetStore.getState().restoreAllLiveDetails();
                        }
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition-colors"
                      title="Restore all live details"
                    >
                      <RefreshCw size={10} />
                      Live
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to revert all manual changes and restore the default system balance sheet?")) {
                          useBalanceSheetStore.getState().resetToDefault();
                        }
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md transition-colors"
                      title="Restore to system default"
                    >
                      <RotateCcw size={10} />
                      Default
                    </button>
                    <RestoreGroupPopover side="assets" />
                    <button
                      onClick={() => openGroupDrawer("assets")}
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md transition-colors"
                      title="Add a new major group to Assets"
                    >
                      <LayoutList size={10} />
                      + Major Row
                    </button>
                  </div>
                </div>
              </th>
            </tr>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-0.5 px-2 text-left text-[10px] font-medium text-slate-400">Name</th>
              <th className="py-0.5 px-2 text-right text-[10px] font-medium text-slate-400 whitespace-nowrap">as at {todayStr}</th>
              <th className="py-0.5 px-2 text-left text-[10px] font-medium text-slate-400">Name</th>
              <th className="py-0.5 px-2 text-right text-[10px] font-medium text-slate-400 whitespace-nowrap">as at {todayStr}</th>
            </tr>
          </thead>
          <tbody>
            {/* Render rows for both sides in sync */}
            {(() => {
              const liabRows: React.ReactNode[] = [];
              const assetRows: React.ReactNode[] = [];

              // Generate liabilities rows
              for (const parent of liabParents) {
                const isGroup = parent.children.length > 1 || parent.highlight;
                const parentTotal = parent.children
                  .flatMap((g) => g.items)
                  .reduce((s, i) => s + (i.amount || 0), 0);

                if (isGroup) {
                  liabRows.push(
                    <tr key={`lp-${parent.key}`} className={`border-t border-slate-200 ${parent.highlight ? "bg-amber-50" : ""}`}>
                      <td className="py-1 px-1 font-bold text-[13px] text-slate-800 group/grow">
                        <EditableTitle title={parent.title} onSave={(newTitle) => renameParentGroup(parent.key, newTitle)} />
                      </td>
                      <td className="py-1 px-2 text-right font-bold text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
                        {fmt(parentTotal)}
                      </td>
                    </tr>
                  );
                  for (const group of parent.children) {
                    const groupTotal = group.items.reduce((s, i) => s + (i.amount || 0), 0);
                    liabRows.push(
                      <tr key={`lg-${group.key}`} className={`${parent.highlight ? "bg-amber-50/60" : ""} group/grow`}>
                        <td className="py-0.5 pl-4 pr-1 font-semibold text-[12.5px] text-slate-700">
                          <EditableTitle title={group.title} onSave={(newTitle) => renameGroup(group.key, newTitle)} className="flex items-center gap-1">
                            {group.allowManualAdd && (
                              <button
                                onClick={() => openDrawer({ open: true, groupKey: group.key as GroupKey, groupTitle: group.title, editItem: null })}
                                className="opacity-40 group-hover/grow:opacity-100 transition-opacity text-indigo-500 hover:text-indigo-700"
                                title={`Add to ${group.title}`}
                              >
                                <Plus size={10} />
                              </button>
                            )}
                            {hasMissingLiveItems(group.key, group.items) && (
                              <button
                                onClick={() => restoreLiveItems(group.key)}
                                className="opacity-40 group-hover/grow:opacity-100 transition-opacity text-amber-500 hover:text-amber-700 ml-1"
                                title="Restore live rows"
                              >
                                <RotateCcw size={10} />
                              </button>
                            )}
                            <button
                              onClick={() => removeGroup(group.key)}
                              className="opacity-40 group-hover/grow:opacity-100 transition-opacity text-red-400 hover:text-red-600 ml-auto"
                              title="Delete this group"
                            >
                              <Trash2 size={10} />
                            </button>
                          </EditableTitle>
                        </td>
                        <td className="py-0.5 px-2 text-right text-[12px] text-slate-800 font-semibold tabular-nums whitespace-nowrap">{fmt(groupTotal)}</td>
                      </tr>
                    );
                    for (const item of group.items) {
                      liabRows.push(
                        <tr
                          key={`li-${item.id}`}
                          className={`group/item ${!item.isSystemComputed ? "hover:bg-indigo-50/40" : "hover:bg-slate-50"} ${parent.highlight ? "bg-amber-50/40" : ""}`}
                        >
                          <td className="py-0.5 pl-8 pr-1 italic text-[12px] text-slate-500 align-top">
                            <span className="flex items-center gap-1.5">
                              <EditableTitle title={item.label} onSave={(newTitle) => useBalanceSheetStore.getState().updateLineItem(group.key as GroupKey, item.id, { label: newTitle })} className="truncate" inputClassName="text-[12px] italic font-normal" />
                              {item.isSystemComputed && <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded-full leading-none shrink-0"><RefreshCw size={7} />Live</span>}
                              {item.isSystemComputed && item.isOverridden && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); useBalanceSheetStore.getState().restoreLiveItemAmount(group.key as GroupKey, item.id); }}
                                  className="opacity-40 group-hover/item:opacity-100 transition-opacity text-amber-500 hover:text-amber-700 shrink-0"
                                  title={`Restore original system amount (${fmt(item.computedAmount || 0)})`}
                                >
                                  <RotateCcw size={10} />
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); !item.isSystemComputed && openDrawer({ open: true, groupKey: group.key as GroupKey, groupTitle: group.title, editItem: { id: item.id, label: item.label, amount: item.amount } }); }}
                                className={`opacity-40 group-hover/item:opacity-100 transition-opacity text-indigo-500 hover:text-indigo-700 shrink-0 ml-auto ${item.isSystemComputed ? 'hidden' : ''}`}
                                title="Edit manual line"
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); removeLineItem(group.key as GroupKey, item.id); }}
                                className="opacity-40 group-hover/item:opacity-100 transition-opacity text-red-400 hover:text-red-600 shrink-0"
                                title="Delete this line"
                              >
                                <Trash2 size={10} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedItem(item); }}
                                className="opacity-40 group-hover/item:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 shrink-0"
                                title="View Audit Breakdown"
                              >
                                <LayoutList size={10} />
                              </button>
                            </span>
                            
                          </td>
                          <td className="py-0.5 px-2 text-right text-[12px] text-slate-600 tabular-nums whitespace-nowrap align-top">
                            <EditableAmount amount={item.amount} onSave={(newAmount) => useBalanceSheetStore.getState().updateLineItem(group.key as GroupKey, item.id, { amount: newAmount })} />
                          </td>
                        </tr>
                      );
                    }
                  }
                } else {
                  const group = parent.children[0];
                  const groupTotal = group.items.reduce((s, i) => s + (i.amount || 0), 0);
                  liabRows.push(
                    <tr key={`lg-${group.key}`} className="border-t border-slate-200 group/grow">
                      <td className="py-1 px-1 font-bold text-[13px] text-slate-800">
                        <span className="flex items-center gap-1">
                          {group.title}
                          {group.allowManualAdd && (
                            <button
                              onClick={() => openDrawer({ open: true, groupKey: group.key as GroupKey, groupTitle: group.title, editItem: null })}
                              className="opacity-0 group-hover/grow:opacity-100 transition-opacity text-indigo-500 hover:text-indigo-700"
                              title={`Add line to ${group.title}`}
                            >
                              <Plus size={10} />
                            </button>
                          )}
                          {hasMissingLiveItems(group.key, group.items) && (
                            <button
                              onClick={() => restoreLiveItems(group.key)}
                              className="opacity-0 group-hover/grow:opacity-100 transition-opacity text-amber-500 hover:text-amber-700 ml-1"
                              title="Restore live rows"
                            >
                              <RotateCcw size={10} />
                            </button>
                          )}
                          <button
                            onClick={() => removeGroup(group.key)}
                            className="opacity-0 group-hover/grow:opacity-100 transition-opacity text-red-400 hover:text-red-600 ml-auto"
                            title="Delete this group"
                          >
                            <Trash2 size={10} />
                          </button>
                        </span>
                      </td>
                      <td className="py-1 px-2 text-right font-bold text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
                        {fmt(groupTotal)}
                      </td>
                    </tr>
                  );
                  for (const item of group.items) {
                    liabRows.push(
                      <tr
                        key={`li-${item.id}`}
                        className={`group/item ${!item.isSystemComputed ? "hover:bg-indigo-50/40" : "hover:bg-slate-50"}`}
                      >
                        <td className="py-0.5 pl-6 pr-1 italic text-[12px] text-slate-500 align-top">
                          <span className="flex items-center gap-1.5">
                            <EditableTitle title={item.label} onSave={(newTitle) => useBalanceSheetStore.getState().updateLineItem(group.key as GroupKey, item.id, { label: newTitle })} className="truncate" inputClassName="text-[12px] italic font-normal" />
                            {item.isSystemComputed && <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded-full leading-none shrink-0"><RefreshCw size={7} />Live</span>}
                            {item.isSystemComputed && item.isOverridden && (
                              <button
                                onClick={(e) => { e.stopPropagation(); useBalanceSheetStore.getState().restoreLiveItemAmount(group.key as GroupKey, item.id); }}
                                className="opacity-40 group-hover/item:opacity-100 transition-opacity text-amber-500 hover:text-amber-700 shrink-0"
                                title={`Restore original system amount (${fmt(item.computedAmount || 0)})`}
                              >
                                <RotateCcw size={10} />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); !item.isSystemComputed && openDrawer({ open: true, groupKey: group.key as GroupKey, groupTitle: group.title, editItem: { id: item.id, label: item.label, amount: item.amount } }); }}
                              className={`opacity-40 group-hover/item:opacity-100 transition-opacity text-indigo-500 hover:text-indigo-700 shrink-0 ml-auto ${item.isSystemComputed ? 'hidden' : ''}`}
                              title="Edit manual line"
                            >
                              <Pencil size={10} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeLineItem(group.key as GroupKey, item.id); }}
                              className="opacity-40 group-hover/item:opacity-100 transition-opacity text-red-400 hover:text-red-600 shrink-0"
                              title="Delete this line"
                            >
                              <Trash2 size={10} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedItem(item); }}
                              className="opacity-40 group-hover/item:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 shrink-0"
                              title="View Audit Breakdown"
                            >
                              <LayoutList size={10} />
                            </button>
                          </span>
                          
                        </td>
                        <td className="py-0.5 px-2 text-right text-[12px] text-slate-600 tabular-nums whitespace-nowrap align-top">
                          <EditableAmount amount={item.amount} onSave={(newAmount) => useBalanceSheetStore.getState().updateLineItem(group.key as GroupKey, item.id, { amount: newAmount })} />
                        </td>
                      </tr>
                    );
                  }
                }
              }

              // Generate assets rows
              for (const parent of assetParents) {
                const isGroup = parent.children.length > 1 || parent.highlight;
                const parentTotal = parent.children
                  .flatMap((g) => g.items)
                  .reduce((s, i) => s + (i.amount || 0), 0);

                if (isGroup) {
                  assetRows.push(
                    <tr key={`ap-${parent.key}`} className={`border-t border-slate-200 ${parent.highlight ? "bg-amber-50" : ""}`}>
                      <td className="py-1 px-1 font-bold text-[13px] text-slate-800 group/grow">
                        <EditableTitle title={parent.title} onSave={(newTitle) => renameParentGroup(parent.key, newTitle)} />
                      </td>
                      <td className="py-1 px-2 text-right font-bold text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
                        {fmt(parentTotal)}
                      </td>
                    </tr>
                  );
                  for (const group of parent.children) {
                    const groupTotal = group.items.reduce((s, i) => s + (i.amount || 0), 0);
                    assetRows.push(
                      <tr key={`ag-${group.key}`} className={`${parent.highlight ? "bg-amber-50/60" : ""} group/grow`}>
                        <td className="py-0.5 pl-4 pr-1 font-semibold text-[12.5px] text-slate-700">
                          <EditableTitle title={group.title} onSave={(newTitle) => renameGroup(group.key, newTitle)} className="flex items-center gap-1">
                            {group.allowManualAdd && (
                              <button
                                onClick={() => openDrawer({ open: true, groupKey: group.key as GroupKey, groupTitle: group.title, editItem: null })}
                                className="opacity-40 group-hover/grow:opacity-100 transition-opacity text-indigo-500 hover:text-indigo-700"
                                title={`Add to ${group.title}`}
                              >
                                <Plus size={10} />
                              </button>
                            )}
                            {hasMissingLiveItems(group.key, group.items) && (
                              <button
                                onClick={() => restoreLiveItems(group.key)}
                                className="opacity-40 group-hover/grow:opacity-100 transition-opacity text-amber-500 hover:text-amber-700 ml-1"
                                title="Restore live rows"
                              >
                                <RotateCcw size={10} />
                              </button>
                            )}
                            <button
                              onClick={() => removeGroup(group.key)}
                              className="opacity-40 group-hover/grow:opacity-100 transition-opacity text-red-400 hover:text-red-600 ml-auto"
                              title="Delete this group"
                            >
                              <Trash2 size={10} />
                            </button>
                          </EditableTitle>
                        </td>
                        <td className="py-0.5 px-2 text-right text-[12px] text-slate-800 font-semibold tabular-nums whitespace-nowrap">{fmt(groupTotal)}</td>
                      </tr>
                    );
                    for (const item of group.items) {
                      assetRows.push(
                        <tr
                          key={`ai-${item.id}`}
                          className={`group/item ${!item.isSystemComputed ? "hover:bg-indigo-50/40" : "hover:bg-slate-50"} ${parent.highlight ? "bg-amber-50/40" : ""}`}
                        >
                          <td className="py-0.5 pl-8 pr-1 italic text-[12px] text-slate-500 align-top">
                            <span className="flex items-center gap-1.5">
                              <EditableTitle title={item.label} onSave={(newTitle) => useBalanceSheetStore.getState().updateLineItem(group.key as GroupKey, item.id, { label: newTitle })} className="truncate" inputClassName="text-[12px] italic font-normal" />
                              {item.isSystemComputed && <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded-full leading-none shrink-0"><RefreshCw size={7} />Live</span>}
                              {item.isSystemComputed && item.isOverridden && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); useBalanceSheetStore.getState().restoreLiveItemAmount(group.key as GroupKey, item.id); }}
                                  className="opacity-40 group-hover/item:opacity-100 transition-opacity text-amber-500 hover:text-amber-700 shrink-0"
                                  title={`Restore original system amount (${fmt(item.computedAmount || 0)})`}
                                >
                                  <RotateCcw size={10} />
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); !item.isSystemComputed && openDrawer({ open: true, groupKey: group.key as GroupKey, groupTitle: group.title, editItem: { id: item.id, label: item.label, amount: item.amount } }); }}
                                className={`opacity-40 group-hover/item:opacity-100 transition-opacity text-indigo-500 hover:text-indigo-700 shrink-0 ml-auto ${item.isSystemComputed ? 'hidden' : ''}`}
                                title="Edit manual line"
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); removeLineItem(group.key as GroupKey, item.id); }}
                                className="opacity-40 group-hover/item:opacity-100 transition-opacity text-red-400 hover:text-red-600 shrink-0"
                                title="Delete this line"
                              >
                                <Trash2 size={10} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedItem(item); }}
                                className="opacity-40 group-hover/item:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 shrink-0"
                                title="View Audit Breakdown"
                              >
                                <LayoutList size={10} />
                              </button>
                            </span>
                            
                          </td>
                          <td className="py-0.5 px-2 text-right text-[12px] text-slate-600 tabular-nums whitespace-nowrap align-top">
                            <EditableAmount amount={item.amount} onSave={(newAmount) => useBalanceSheetStore.getState().updateLineItem(group.key as GroupKey, item.id, { amount: newAmount })} />
                          </td>
                        </tr>
                      );
                    }
                  }
                } else {
                  const group = parent.children[0];
                  const groupTotal = group.items.reduce((s, i) => s + (i.amount || 0), 0);
                  assetRows.push(
                    <tr key={`ag-${group.key}`} className="border-t border-slate-200 group/grow">
                      <td className="py-1 px-1 font-bold text-[13px] text-slate-800 group/grow">
                        <EditableTitle title={group.title} onSave={(newTitle) => renameGroup(group.key, newTitle)} className="flex items-center gap-1">
                          {group.allowManualAdd && (
                            <button
                              onClick={() => openDrawer({ open: true, groupKey: group.key as GroupKey, groupTitle: group.title, editItem: null })}
                              className="opacity-40 group-hover/grow:opacity-100 transition-opacity text-indigo-500 hover:text-indigo-700"
                              title={`Add line to ${group.title}`}
                            >
                              <Plus size={10} />
                            </button>
                          )}
                          {hasMissingLiveItems(group.key, group.items) && (
                            <button
                              onClick={() => restoreLiveItems(group.key)}
                              className="opacity-40 group-hover/grow:opacity-100 transition-opacity text-amber-500 hover:text-amber-700 ml-1"
                              title="Restore live rows"
                            >
                              <RotateCcw size={10} />
                            </button>
                          )}
                          <button
                            onClick={() => removeGroup(group.key)}
                            className="opacity-40 group-hover/grow:opacity-100 transition-opacity text-red-400 hover:text-red-600 ml-auto"
                            title="Delete this group"
                          >
                            <Trash2 size={10} />
                          </button>
                        </EditableTitle>
                      </td>
                      <td className="py-1 px-2 text-right font-bold text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
                        {fmt(groupTotal)}
                      </td>
                    </tr>
                  );
                  for (const item of group.items) {
                    assetRows.push(
                      <tr
                        key={`ai-${item.id}`}
                        className={`group/item ${!item.isSystemComputed ? "hover:bg-indigo-50/40" : "hover:bg-slate-50"}`}
                      >
                        <td className="py-0.5 pl-6 pr-1 italic text-[12px] text-slate-500 align-top">
                          <span className="flex items-center gap-1.5">
                            <EditableTitle title={item.label} onSave={(newTitle) => useBalanceSheetStore.getState().updateLineItem(group.key as GroupKey, item.id, { label: newTitle })} className="truncate" inputClassName="text-[12px] italic font-normal" />
                            {item.isSystemComputed && <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded-full leading-none shrink-0"><RefreshCw size={7} />Live</span>}
                            {item.isSystemComputed && item.isOverridden && (
                              <button
                                onClick={(e) => { e.stopPropagation(); useBalanceSheetStore.getState().restoreLiveItemAmount(group.key as GroupKey, item.id); }}
                                className="opacity-40 group-hover/item:opacity-100 transition-opacity text-amber-500 hover:text-amber-700 shrink-0"
                                title={`Restore original system amount (${fmt(item.computedAmount || 0)})`}
                              >
                                <RotateCcw size={10} />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); !item.isSystemComputed && openDrawer({ open: true, groupKey: group.key as GroupKey, groupTitle: group.title, editItem: { id: item.id, label: item.label, amount: item.amount } }); }}
                              className={`opacity-40 group-hover/item:opacity-100 transition-opacity text-indigo-500 hover:text-indigo-700 shrink-0 ml-auto ${item.isSystemComputed ? 'hidden' : ''}`}
                              title="Edit manual line"
                            >
                              <Pencil size={10} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeLineItem(group.key as GroupKey, item.id); }}
                              className="opacity-40 group-hover/item:opacity-100 transition-opacity text-red-400 hover:text-red-600 shrink-0"
                              title="Delete this line"
                            >
                              <Trash2 size={10} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedItem(item); }}
                              className="opacity-40 group-hover/item:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 shrink-0"
                              title="View Audit Breakdown"
                            >
                              <LayoutList size={10} />
                            </button>
                          </span>
                          
                        </td>
                        <td className="py-0.5 px-2 text-right text-[12px] text-slate-600 tabular-nums whitespace-nowrap align-top">
                          <EditableAmount amount={item.amount} onSave={(newAmount) => useBalanceSheetStore.getState().updateLineItem(group.key as GroupKey, item.id, { amount: newAmount })} />
                        </td>
                      </tr>
                    );
                  }
                }
              }

              // Zip the two columns side by side
              const maxLen = Math.max(liabRows.length, assetRows.length);
              const zipped: React.ReactNode[] = [];
              for (let i = 0; i < maxLen; i++) {
                const lr = liabRows[i];
                const ar = assetRows[i];

                // Extract cells from liab row
                const liabCells = lr
                  ? (() => {
                      const el = lr as React.ReactElement;
                      return el.props.children as React.ReactNode[];
                    })()
                  : [<td key="le" />, <td key="la" />];

                // Extract cells from asset row
                const assetCells = ar
                  ? (() => {
                      const el = ar as React.ReactElement;
                      return el.props.children as React.ReactNode[];
                    })()
                  : [<td key="ae" />, <td key="aa" />];

                // Merge row classes
                const liabCls = lr ? (lr as React.ReactElement).props.className ?? "" : "";
                const assetCls = ar ? (ar as React.ReactElement).props.className ?? "" : "";
                const mergedCls = [liabCls, assetCls].filter(Boolean).join(" ").replace(/border-t[^\s]*/g, "").trim();

                zipped.push(
                  <tr key={i} className={`${mergedCls} border-t border-slate-100`}>
                    {Array.isArray(liabCells) ? liabCells : [liabCells]}
                    <td className="bg-slate-300 p-0 w-px" />
                    {Array.isArray(assetCells) ? assetCells : [assetCells]}
                  </tr>
                );
              }
              return zipped;
            })()}

            {/* Total row */}
            <tr className="border-t-2 border-slate-600 bg-slate-50">
              <td className="py-2 px-1 text-[12px] font-black text-slate-800 uppercase tracking-wider">
                Total Liabilities
              </td>
              <td className="py-2 px-2 text-right text-[12px] font-black text-slate-900 tabular-nums whitespace-nowrap">
                {fmt(liabilities)}
              </td>
              <td className="bg-slate-300 p-0 w-px" />
              <td className="py-2 px-1 text-[12px] font-black text-slate-800 uppercase tracking-wider">
                Total Assets
              </td>
              <td className="py-2 px-2 text-right text-[12px] font-black text-slate-900 tabular-nums whitespace-nowrap">
                {fmt(assets)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AddLineDrawer
        open={drawer.open}
        onClose={closeDrawer}
        groupKey={drawer.groupKey}
        groupTitle={drawer.groupTitle}
        editItem={drawer.editItem}
      />
      <AddGroupDrawer
        open={groupDrawer.open}
        onClose={closeGroupDrawer}
        side={groupDrawer.side}
      />
    </>
  );
}

// ─── P&L TAB ─────────────────────────────────────────────────────────────────

function ProfitLossTab({
  isLoading,
  lastSyncedAt,
  setExpandedItem,
}: {
  isLoading: boolean;
  lastSyncedAt: string;
  setExpandedItem: (item: BalanceLineItem | null) => void;
}) {
  const [drawer, setDrawer] = useState<DrawerState>(CLOSED_DRAWER);
  
  const closeDrawer = useCallback(() => setDrawer(CLOSED_DRAWER), []);
  const openDrawer = useCallback((state: DrawerState) => setDrawer(state), []);

  const groups = useBalanceSheetStore(useShallow((s) => s.groups));
  const removeLineItem = useBalanceSheetStore((s) => s.removeLineItem);
  const restoreLiveItems = useBalanceSheetStore((s) => s.restoreLiveItems);
  const { netProfit, expenses, income } = useBalanceSheetStore(
    useShallow((s) => s.totalsBySide())
  );
  const renameGroup = useBalanceSheetStore((s) => s.renameGroup);

  const expenseGroups = groups.filter((g) => g.side === "expenses");
  const incomeGroups = groups.filter((g) => g.side === "income");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm gap-2">
        <RefreshCw size={16} className="animate-spin" />
        Loading financial data…
      </div>
    );
  }

  const renderPnLRows = (
    groupList: typeof expenseGroups,
    side: "expenses" | "income"
  ) => {
    const rows: React.ReactNode[] = [];
    for (const group of groupList) {
      const groupTotal = group.items.reduce((s, i) => s + (i.amount || 0), 0);
      rows.push(
        <PnLGroupRow
          key={`g-${group.key}`}
          group={group}
          groupTotal={groupTotal}
          onEditTitle={(newTitle) => renameGroup(group.key, newTitle)}
          onAdd={() => openDrawer({ open: true, groupKey: group.key as GroupKey, groupTitle: group.title, editItem: null })}
          onRestore={() => restoreLiveItems(group.key)}
        />
      );
      for (const item of group.items) {
        rows.push(
          <tr
            key={`i-${item.id}`}
            className={`group/item ${!item.isSystemComputed ? "hover:bg-indigo-50/40" : "hover:bg-slate-50"}`}
          >
            <td className="py-0.5 pl-6 pr-1 italic text-[12px] text-slate-500 align-top">
              <span className="flex items-center gap-1.5">
                <span className="truncate">{item.label}</span>
                {!item.isSystemComputed && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openDrawer({ open: true, groupKey: group.key as GroupKey, groupTitle: group.title, editItem: { id: item.id, label: item.label, amount: item.amount, isSystemComputed: item.isSystemComputed } }); }}
                    className="opacity-0 group-hover/item:opacity-50 text-indigo-400 hover:text-indigo-600 shrink-0 ml-1"
                    title="Edit manual line"
                  >
                    <Pencil size={9} />
                  </button>
                )}
                {item.isSystemComputed && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded-full leading-none shrink-0">
                    <RefreshCw size={7} />Live
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeLineItem(group.key as GroupKey, item.id); }}
                  className="opacity-0 group-hover/item:opacity-100 transition-opacity text-red-400 hover:text-red-600 shrink-0 ml-auto"
                  title="Delete this line"
                >
                  <Trash2 size={10} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedItem(item); }}
                  className="opacity-0 group-hover/item:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 shrink-0 ml-2"
                  title="View Audit Breakdown"
                >
                  <LayoutList size={10} />
                </button>
              </span>
              
            </td>
            <td className="py-0.5 px-2 text-right text-[12px] text-slate-600 tabular-nums whitespace-nowrap align-top">
              {item.amount !== 0 ? fmt(item.amount) : ""}
            </td>
          </tr>
        );
      }
    }
    // Net profit goes on expenses side to balance
    if (side === "expenses" && netProfit >= 0) {
      rows.push(
        <tr key="net-profit" className="bg-emerald-50 border-t border-emerald-200">
          <td className="py-0.5 pl-4 pr-1 italic text-[12px] text-emerald-700 font-semibold">Net Profit</td>
          <td className="py-0.5 px-2 text-right text-[12px] text-emerald-700 tabular-nums whitespace-nowrap font-bold">
            {fmt(netProfit)}
          </td>
        </tr>
      );
    }
    // Net loss goes on income side to balance
    if (side === "income" && netProfit < 0) {
      rows.push(
        <tr key="net-loss" className="bg-amber-50 border-t border-amber-200">
          <td className="py-0.5 pl-4 pr-1 italic text-[12px] text-amber-700 font-semibold">Net Loss</td>
          <td className="py-0.5 px-2 text-right text-[12px] text-amber-700 tabular-nums whitespace-nowrap font-bold">
            {fmt(Math.abs(netProfit))}
          </td>
        </tr>
      );
    }
    return rows;
  };

  const expRows = renderPnLRows(expenseGroups, "expenses");
  const incRows = renderPnLRows(incomeGroups, "income");
  const grossTotal = Math.max(expenses, income);

  return (
    <>
      {/* P&L banner */}
      <div
        className={`shrink-0 flex items-center justify-between px-4 py-2 rounded-lg border text-sm font-semibold mb-2 ${
          netProfit >= 0
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-amber-50 border-amber-300 text-amber-800"
        }`}
      >
        <span className="flex items-center gap-2">
          <Scale size={14} />
          {netProfit >= 0 ? `Net Profit: ${fmt(netProfit)}` : `Net Loss: ${fmt(Math.abs(netProfit))}`}
        </span>
        <span className="text-xs font-normal opacity-70">
          {lastSyncedAt ? `Synced ${lastSyncedAt}` : "Live data synced"}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-lg bg-white shadow-sm">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "55%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "1px" }} />
            <col style={{ width: "55%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300">
              <th className="py-2 px-2 text-left text-[11px] font-black text-slate-600 uppercase tracking-widest">Expenses</th>
              <th className="py-2 px-2 text-right text-[10px] font-semibold text-slate-400 whitespace-nowrap">as at {todayStr}</th>
              <td className="bg-slate-300 p-0 w-px" />
              <th className="py-2 px-2 text-left text-[11px] font-black text-slate-600 uppercase tracking-widest">Income</th>
              <th className="py-2 px-2 text-right text-[10px] font-semibold text-slate-400 whitespace-nowrap">as at {todayStr}</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const maxLen = Math.max(expRows.length, incRows.length);
              return Array.from({ length: maxLen }, (_, i) => {
                const er = expRows[i];
                const ir = incRows[i];
                const erCells = er ? (er as React.ReactElement).props.children : [<td key="ee" />, <td key="ea" />];
                const irCells = ir ? (ir as React.ReactElement).props.children : [<td key="ie" />, <td key="ia" />];
                const erCls = er ? (er as React.ReactElement).props.className ?? "" : "";
                const irCls = ir ? (ir as React.ReactElement).props.className ?? "" : "";
                const merged = [erCls, irCls].filter(Boolean).join(" ").replace(/border-t[^\s]*/g, "").trim();
                return (
                  <tr key={i} className={`${merged} border-t border-slate-100`}>
                    {Array.isArray(erCells) ? erCells : [erCells]}
                    <td className="bg-slate-300 p-0 w-px" />
                    {Array.isArray(irCells) ? irCells : [irCells]}
                  </tr>
                );
              });
            })()}
            <tr className="border-t-2 border-slate-600 bg-slate-50">
              <td className="py-2 px-1 text-[12px] font-black text-slate-800 uppercase tracking-wider">Total</td>
              <td className="py-2 px-2 text-right text-[12px] font-black text-slate-900 tabular-nums whitespace-nowrap">{fmt(grossTotal)}</td>
              <td className="bg-slate-300 p-0 w-px" />
              <td className="py-2 px-1 text-[12px] font-black text-slate-800 uppercase tracking-wider">Total</td>
              <td className="py-2 px-2 text-right text-[12px] font-black text-slate-900 tabular-nums whitespace-nowrap">{fmt(grossTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <AddLineDrawer
        open={drawer.open}
        onClose={closeDrawer}
        groupKey={drawer.groupKey}
        groupTitle={drawer.groupTitle}
        editItem={drawer.editItem}
      />
    </>
  );
}

// ─── MAIN CONTAINER ───────────────────────────────────────────────────────────

const TAB_BALANCE = "balance-sheet";
const TAB_PNL = "profit-loss";

export default function BalancePnLContainer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? TAB_BALANCE;

  const { hydrateSystemComputedGroups, setManualEntries } = useBalanceSheetStore();
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<BalanceLineItem | null>(null);

  const groups = useBalanceSheetStore(useShallow((s) => s.groups));
  const { liabilities, assets } = useBalanceSheetStore(useShallow((s) => s.totalsBySide()));

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const financials = await getAggregatedFinancials();
      hydrateSystemComputedGroups(financials);
      const manualSnap = await getDocs(collection(db, "balanceSheetManualEntries"));
      const manualEntries = manualSnap.docs.map((d) => d.data());
      setManualEntries(manualEntries);
      setLastSyncedAt(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch (error) {
      console.error("Failed to load Balance Sheet data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [hydrateSystemComputedGroups, setManualEntries]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setTab = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="flex flex-col h-full p-4 max-w-[1400px] mx-auto gap-3">
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-500/25">
            <Scale className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Balance Sheet &amp; P&amp;L
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Financial position as at{" "}
              <span className="text-indigo-600 font-semibold">{todayStr}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && activeTab === TAB_BALANCE && (
            <PDFDownloadLink
              document={
                <BalanceSheetPdf
                  millName="M/S CHAMUNDA BUILDERS"
                  groups={groups}
                  liabilitiesTotal={liabilities}
                  assetsTotal={assets}
                />
              }
              fileName={`Balance_Sheet_${format(new Date(), "yyyy_MM_dd")}.pdf`}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-white hover:bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg shadow-sm border border-indigo-200 transition-colors"
            >
              <FileText size={12} />
              Export PDF
            </PDFDownloadLink>
          )}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm hover:border-indigo-200 transition-colors disabled:opacity-50"
            title="Refresh live data"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => setReceiptOpen(true)}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 border border-indigo-600 px-3 py-2 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
            title="Post an adjustment receipt to a row"
          >
            <Plus size={14} />
            Receipt
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setTab}
        className="flex flex-col flex-1 min-h-0 gap-3"
      >
        <TabsList className="w-fit shrink-0">
          <TabsTrigger value={TAB_BALANCE}>Balance Sheet</TabsTrigger>
          <TabsTrigger value={TAB_PNL}>Profit &amp; Loss</TabsTrigger>
        </TabsList>

        <TabsContent value={TAB_BALANCE} className="flex flex-col flex-1 min-h-0 mt-0">
          <BalanceSheetTab isLoading={isLoading} lastSyncedAt={lastSyncedAt} setExpandedItem={setExpandedItem} />
        </TabsContent>

        <TabsContent value={TAB_PNL} className="flex flex-col flex-1 min-h-0 mt-0">
          <ProfitLossTab isLoading={isLoading} lastSyncedAt={lastSyncedAt} setExpandedItem={setExpandedItem} />
        </TabsContent>
      </Tabs>

      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} mode={activeTab === TAB_PNL ? "pnl" : "balance"} />

      <Dialog open={expandedItem !== null} onOpenChange={(open) => !open && setExpandedItem(null)}>
        <DialogContent className="max-w-4xl sm:max-w-4xl p-0 overflow-hidden bg-slate-50 border border-slate-200 shadow-xl rounded-xl">
          <DialogHeader className="px-6 py-4 bg-white border-b border-slate-200">
            <DialogTitle className="text-xl font-black text-slate-800">
              Audit Breakdown: <span className="text-indigo-600">{expandedItem?.label}</span>
            </DialogTitle>
            <DialogDescription>
              Detailed view of system application data and manual receipt adjustments.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-slate-50 max-h-[80vh] overflow-y-auto w-full">
            {expandedItem && <MicroRowBreakdown item={expandedItem} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
