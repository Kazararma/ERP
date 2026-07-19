import { useState, useEffect } from "react";
import { Loader2, Receipt, Database, Pencil, Trash2, EyeOff, Eye, RotateCcw } from "lucide-react";
import { BalanceLineItem } from "@/types/balanceSheet";
import { useBalanceSheetStore } from "@/stores/useBalanceSheetStore";
import {
  BreakdownItem,
  getDebtorsBreakdown,
  getCreditorsBreakdown,
  getCashInHandBreakdown,
  getClosingStockBreakdown,
  getSalesRevenueBreakdown,
  getCogsBreakdown,
  getOperatingExpensesBreakdown,
  getGstBreakdown,
  getBankAccountBreakdown,
  getTotalPurchasesBreakdown,
} from "@/services/balanceSheetBreakdown";
import { format } from "date-fns";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

interface MicroRowBreakdownProps {
  item: BalanceLineItem;
}

function EditableBreakdownAmount({ 
  amount, 
  isHidden, 
  onSave 
}: { 
  amount: number, 
  isHidden: boolean, 
  onSave: (n: number) => void 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(amount.toString());
  
  if (isEditing) {
    return (
      <input 
        autoFocus
        type="number"
        value={val}
        onChange={e => setVal(e.target.value)}
        className="w-20 px-1 py-0.5 text-right border border-indigo-300 rounded text-xs tabular-nums text-slate-800"
        onClick={e => e.stopPropagation()}
        onBlur={() => {
          const n = parseFloat(val);
          if (!isNaN(n) && n !== amount) onSave(n);
          setIsEditing(false);
        }}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            const n = parseFloat(val);
            if (!isNaN(n) && n !== amount) onSave(n);
            setIsEditing(false);
          }
          if (e.key === 'Escape') {
            setVal(amount.toString());
            setIsEditing(false);
          }
        }}
      />
    );
  }
  
  return (
    <span className="flex items-center justify-end gap-1 group/amt cursor-pointer" onClick={(e) => { e.stopPropagation(); !isHidden && setIsEditing(true); }}>
      {!isHidden && <Pencil size={10} className="opacity-0 group-hover/amt:opacity-100 text-indigo-400 hover:text-indigo-600 transition-opacity" />}
      <span className={isHidden ? 'line-through text-slate-400' : ''}>{fmt(amount)}</span>
    </span>
  );
}

export function MicroRowBreakdown({ item }: MicroRowBreakdownProps) {
  const [systemData, setSystemData] = useState<BreakdownItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const rowAdjustments = useBalanceSheetStore((s) => s.rowAdjustments[item.id]) || [];
  const systemEntryOverrides = useBalanceSheetStore(s => s.systemEntryOverrides[item.id]) || {};
  
  const updateSystemEntryOverride = useBalanceSheetStore(s => s.updateSystemEntryOverride);
  const updateRowAdjustment = useBalanceSheetStore(s => s.updateRowAdjustment);
  const deleteRowAdjustment = useBalanceSheetStore(s => s.deleteRowAdjustment);
  const restoreMicroRowData = useBalanceSheetStore(s => s.restoreMicroRowData);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!item.isSystemComputed || !item.source) {
        if (isMounted) setSystemData([]);
        return;
      }

      setIsLoading(true);
      let data: BreakdownItem[] = [];

      try {
        switch (item.source) {
          case "sundryDebtors":
            data = await getDebtorsBreakdown();
            break;
          case "sundryCreditors":
            data = await getCreditorsBreakdown();
            break;
          case "cashInHand":
            data = await getCashInHandBreakdown();
            break;
          case "closingStock":
            data = await getClosingStockBreakdown();
            break;
          case "outputGst":
            data = await getGstBreakdown("output");
            break;
          case "inputGst":
            data = await getGstBreakdown("input");
            break;
          case "bankAccount":
            if (item.bankAccountId) {
              data = await getBankAccountBreakdown(item.bankAccountId);
            }
            break;
          case "cogs":
            data = await getCogsBreakdown();
            break;
          case "salesRevenue":
            data = await getSalesRevenueBreakdown();
            break;
          case "operatingExpenses":
            data = await getOperatingExpensesBreakdown();
            break;
          case "totalPurchases":
            data = await getTotalPurchasesBreakdown();
            break;
          default:
            break;
        }

        if (isMounted) setSystemData(data);
      } catch (err) {
        console.error("Failed to load breakdown", err);
        if (isMounted) setSystemData([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [item]);

  const hasOverrides = Object.keys(systemEntryOverrides).length > 0 || rowAdjustments.length > 0;

  return (
    <div className="flex flex-col gap-3 w-full text-slate-800" onClick={(e) => e.stopPropagation()}>
      
      {/* Global Restore Action */}
      {hasOverrides && (
        <div className="flex justify-end mb-1">
          <button
            onClick={() => {
              if (confirm("Are you sure you want to restore all original data? This will remove all hidden items, edited amounts, and receipt entries for this row.")) {
                restoreMicroRowData(item.id);
              }
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-md transition-colors shadow-sm"
          >
            <RotateCcw size={12} />
            Restore Original Data
          </button>
        </div>
      )}

      <div className="flex flex-row gap-4 h-full">
        {/* System Data */}
        <div className="flex-1 border border-slate-200 rounded-lg bg-white overflow-hidden flex flex-col shadow-sm h-[400px]">
          <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Database size={14} className="text-slate-500" />
              <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">System Breakdown</h4>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Live Data</span>
          </div>
          
          <div className="p-0 overflow-y-auto flex-1 relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading breakdown...
              </div>
            ) : systemData && systemData.length > 0 ? (
              <table className="w-full text-xs">
                <tbody>
                  {systemData.map((b) => {
                    const override = systemEntryOverrides[b.id] || { hidden: false };
                    const isHidden = override.hidden;
                    const effectiveAmount = override.overrideAmount !== undefined ? override.overrideAmount : b.amount;

                    return (
                      <tr key={b.id} className={`group/sysrow border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${isHidden ? 'bg-slate-50/50 opacity-60' : ''}`}>
                        <td className="py-2.5 px-3">
                          <div className={`font-semibold ${isHidden ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                            {b.label}
                          </div>
                          {b.subtitle && <div className="text-[10px] text-slate-400 mt-0.5">{b.subtitle}</div>}
                        </td>
                        <td className="py-2.5 px-3 w-[120px]">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                const newHidden = !isHidden;
                                const currentAmt = effectiveAmount;
                                const diff = newHidden ? -currentAmt : currentAmt;
                                updateSystemEntryOverride(item.id, b.id, diff, { hidden: newHidden, overrideAmount: override.overrideAmount });
                              }}
                              className="opacity-0 group-hover/sysrow:opacity-100 transition-opacity text-slate-400 hover:text-slate-700"
                              title={isHidden ? "Restore system entry" : "Hide system entry"}
                            >
                              {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                            <EditableBreakdownAmount 
                              amount={effectiveAmount} 
                              isHidden={isHidden} 
                              onSave={(n) => {
                                const diff = n - effectiveAmount;
                                updateSystemEntryOverride(item.id, b.id, diff, { hidden: false, overrideAmount: n });
                              }} 
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs text-center p-8">
                <Database size={24} className="mb-2 opacity-20" />
                <p>No system data found.</p>
                {!item.isSystemComputed && (
                  <p className="mt-1 text-[10px]">This is a manually created row.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Manual Receipt Adjustments */}
        <div className="flex-1 border border-indigo-100 rounded-lg bg-white overflow-hidden flex flex-col shadow-sm h-[400px]">
          <div className="bg-indigo-50/80 px-3 py-2 border-b border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Receipt size={14} className="text-indigo-500" />
              <h4 className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Receipt Entries</h4>
            </div>
            <span className="text-[10px] text-indigo-400 font-medium">Manual Adjustments</span>
          </div>

          <div className="p-0 overflow-y-auto flex-1 relative">
            {rowAdjustments.length > 0 ? (
              <table className="w-full text-xs">
                <tbody>
                  {rowAdjustments.map((adj) => {
                    const isPositive = adj.delta > 0;
                    return (
                      <tr key={adj.id} className="group/adjrow border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-700">
                            {adj.reason || "Manual Receipt Adjustment"}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {format(new Date(adj.createdAt), "dd MMM yyyy, HH:mm")}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 w-[120px]">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                if (confirm("Delete this receipt adjustment?")) {
                                  deleteRowAdjustment(item.id, adj.id);
                                }
                              }}
                              className="opacity-0 group-hover/adjrow:opacity-100 transition-opacity text-rose-400 hover:text-rose-600"
                              title="Delete receipt"
                            >
                              <Trash2 size={12} />
                            </button>
                            <span className={`font-bold whitespace-nowrap ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                              <EditableBreakdownAmount 
                                amount={adj.delta} 
                                isHidden={false} 
                                onSave={(n) => {
                                  updateRowAdjustment(item.id, adj.id, n);
                                }} 
                              />
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs p-8 text-center">
                <Receipt size={24} className="mb-2 opacity-20" />
                <p>No manual receipt entries found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
