import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { receiptSchema, ReceiptFormValues } from "./receiptSchema";
import { useReceiptEntry } from "./useReceiptEntry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Loader2, PlusCircle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { useBalanceSheetStore } from "@/stores/useBalanceSheetStore";
import { useMemo, useEffect } from "react";

interface ReceiptFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  mode?: "balance" | "pnl";
}

export function ReceiptForm({ onSuccess, onCancel, mode = "balance" }: ReceiptFormProps) {
  const isPnL = mode === "pnl";
  const { submit, isSubmitting } = useReceiptEntry();
  const groups = useBalanceSheetStore((s) => s.groups);
  const parentTitles = useBalanceSheetStore((s) => s.parentTitles);
  
  const form = useForm({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      section: isPnL ? "expenses" : "liabilities",
      majorRowKey: "",
      minorRowMode: "existing",
      minorRowSelection: "",
      newMinorRowName: "",
      microRowMode: "existing",
      microRowSelection: "",
      newMicroRowName: "",
      amount: "" as any,
      direction: "add",
    }
  });

  const section = form.watch("section");
  const majorRowKey = form.watch("majorRowKey");
  const minorRowMode = form.watch("minorRowMode");
  const minorRowSelection = form.watch("minorRowSelection");
  const microRowMode = form.watch("microRowMode");
  const microRowSelection = form.watch("microRowSelection");

  // Determine available Major Rows based on the section and mode
  const majorRows = useMemo(() => {
    const list: { key: string, title: string, isParent: boolean }[] = [];

    if (isPnL) {
      // P&L mode: filter to expenses/income groups only (pnl.* prefix)
      const pnlGroups = groups.filter(g => g.side === section && g.key.startsWith('pnl.'));
      for (const g of pnlGroups) {
        list.push({ key: g.key, title: g.title, isParent: false });
      }
      // Also show any non-pnl standalone P&L side groups the user may have added
      const standaloneGroups = groups.filter(g => g.side === section && !g.key.startsWith('pnl.') && !g.key.includes('.'));
      for (const g of standaloneGroups) {
        if (!list.find(x => x.key === g.key)) {
          list.push({ key: g.key, title: g.title, isParent: false });
        }
      }
      return list;
    }

    // Balance Sheet mode (original logic)
    const hasCurrentLiabilities = groups.some(g => g.side === section && g.key.startsWith('currentLiabilities.'));
    const hasCurrentAssets = groups.some(g => g.side === section && g.key.startsWith('currentAssets.'));
    
    if (section === "liabilities" && hasCurrentLiabilities) {
      list.push({ key: 'currentLiabilities', title: parentTitles['currentLiabilities'] || "Current Liabilities", isParent: true });
    }
    if (section === "assets" && hasCurrentAssets) {
      list.push({ key: 'currentAssets', title: parentTitles['currentAssets'] || "Current Assets", isParent: true });
    }

    const standaloneGroups = groups.filter(g => g.side === section && !g.key.includes('.'));
    for (const g of standaloneGroups) {
      if (!list.find(x => x.key === g.key)) {
         list.push({ key: g.key, title: g.title, isParent: false });
      }
    }
    return list;
  }, [section, groups, parentTitles, isPnL]);

  const isMajorParent = majorRowKey ? !!majorRows.find(m => m.key === majorRowKey)?.isParent : false;

  // Determine Minor Rows based on Major Row selected
  const minorRows = useMemo(() => {
    if (!majorRowKey || !isMajorParent) return [];
    return groups
      .filter(g => g.key.startsWith(`${majorRowKey}.`))
      .map(g => ({ key: g.key, title: g.title }));
  }, [majorRowKey, isMajorParent, groups]);

  // Determine Micro Rows based on Minor Row selected (or Major Row if standalone)
  const microRows = useMemo(() => {
    if (!majorRowKey) return [];
    if (isMajorParent) {
      if (minorRowMode === 'new' || !minorRowSelection) return [];
      const grp = groups.find(g => g.key === minorRowSelection);
      if (!grp) return [];
      return grp.items.map(i => ({ key: i.id, title: i.label }));
    } else {
      const grp = groups.find(g => g.key === majorRowKey);
      if (!grp) return [];
      return grp.items.map(i => ({ key: i.id, title: i.label }));
    }
  }, [majorRowKey, isMajorParent, minorRowMode, minorRowSelection, groups]);

  // If majorRow is a standalone group, we force minorRowMode to "none" 
  // so validation passes easily.
  useEffect(() => {
    if (majorRowKey) {
      if (isMajorParent) {
        form.setValue("minorRowMode", "existing");
      } else {
        form.setValue("minorRowMode", "none");
      }
      form.setValue("minorRowSelection", "");
      form.setValue("microRowSelection", "");
    }
  }, [majorRowKey, isMajorParent, form]);

  const onSubmit = async (values: any) => {
    try {
      await submit(values as ReceiptFormValues);
      toast.success("Receipt posted successfully!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to post receipt");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Section Toggle */}
      <div className="flex bg-slate-100 p-1 rounded-lg">
        {isPnL ? (
          // P&L mode: Expenses / Income
          <>
            <button
              type="button"
              onClick={() => { form.setValue("section", "expenses"); form.setValue("majorRowKey", ""); }}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${section === 'expenses' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Expenses
            </button>
            <button
              type="button"
              onClick={() => { form.setValue("section", "income"); form.setValue("majorRowKey", ""); }}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${section === 'income' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Income
            </button>
          </>
        ) : (
          // Balance Sheet mode: Liability / Asset
          <>
            <button
              type="button"
              onClick={() => { form.setValue("section", "liabilities"); form.setValue("majorRowKey", ""); }}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${section === 'liabilities' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Liability
            </button>
            <button
              type="button"
              onClick={() => { form.setValue("section", "assets"); form.setValue("majorRowKey", ""); }}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${section === 'assets' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Asset
            </button>
          </>
        )}
      </div>

      {/* Major Row Selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Select Major Row
        </label>
        <Controller
          name="majorRowKey"
          control={form.control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-white border-slate-200 h-9">
                <SelectValue placeholder="Select a major row...">
                  {majorRowKey ? majorRows.find(m => m.key === majorRowKey)?.title || majorRowKey : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white z-50 shadow-md">
                {majorRows.map((mr) => (
                  <SelectItem key={mr.key} value={mr.key}>
                    <span className="font-bold text-slate-800">{mr.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {form.formState.errors.majorRowKey && (
          <p className="text-xs text-rose-500 font-medium">
            {form.formState.errors.majorRowKey.message as string}
          </p>
        )}
      </div>

      {/* Minor Row Selection/Creation (Only for Parent Groups) */}
      {majorRowKey && isMajorParent && (
        <>
          <div className="flex justify-between items-center bg-slate-50 p-1 rounded-md border border-slate-100">
            <button
              type="button"
              onClick={() => {
                form.setValue("minorRowMode", "existing");
                form.setValue("minorRowSelection", "");
              }}
              className={`flex-1 py-1 text-xs font-bold rounded transition-all ${minorRowMode === 'existing' ? 'bg-white shadow-sm text-indigo-700 border border-indigo-100' : 'text-slate-500'}`}
            >
              Select Minor Row
            </button>
            <button
              type="button"
              onClick={() => {
                form.setValue("minorRowMode", "new");
                form.setValue("newMinorRowName", "");
              }}
              className={`flex-1 py-1 text-xs font-bold rounded transition-all flex items-center justify-center gap-1 ${minorRowMode === 'new' ? 'bg-white shadow-sm text-indigo-700 border border-indigo-100' : 'text-slate-500'}`}
            >
              <PlusCircle size={12} /> Create New
            </button>
          </div>

          {minorRowMode === 'existing' && (
            <div className="space-y-1.5 pl-4 border-l-2 border-indigo-100">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Select Minor Row
              </label>
              <Controller
                name="minorRowSelection"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full bg-white border-slate-200 h-9">
                      <SelectValue placeholder="Select a minor row...">
                        {minorRowSelection ? minorRows.find(m => m.key === minorRowSelection)?.title || minorRowSelection : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 shadow-md">
                      {minorRows.map((mr) => (
                        <SelectItem key={mr.key} value={mr.key}>
                          <span className="font-medium text-slate-800">{mr.title}</span>
                        </SelectItem>
                      ))}
                      {minorRows.length === 0 && (
                         <div className="px-2 py-2 text-sm text-slate-500">No minor rows found.</div>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.minorRowSelection && (
                <p className="text-xs text-rose-500 font-medium">
                  {form.formState.errors.minorRowSelection.message as string}
                </p>
              )}
            </div>
          )}

          {minorRowMode === 'new' && (
            <div className="space-y-1.5 pl-4 border-l-2 border-indigo-100">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                New Minor Row Name
              </label>
              <Input 
                {...form.register("newMinorRowName")}
                type="text" 
                placeholder="e.g. Current Assets / Custom Tax" 
                className="bg-white font-medium h-9"
              />
              {form.formState.errors.newMinorRowName && (
                <p className="text-xs text-rose-500 font-medium">
                  {form.formState.errors.newMinorRowName.message as string}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Micro Row Selection/Creation */}
      {majorRowKey && (
        <>
          <div className="flex justify-between items-center bg-slate-50 p-1 rounded-md border border-slate-100 mt-2">
            <button
              type="button"
              onClick={() => {
                form.setValue("microRowMode", "existing");
                form.setValue("microRowSelection", "");
              }}
              className={`flex-1 py-1 text-xs font-bold rounded transition-all ${microRowMode === 'existing' ? 'bg-white shadow-sm text-teal-700 border border-teal-100' : 'text-slate-500'}`}
            >
              Select Micro Row
            </button>
            <button
              type="button"
              onClick={() => {
                form.setValue("microRowMode", "new");
                form.setValue("newMicroRowName", "");
              }}
              className={`flex-1 py-1 text-xs font-bold rounded transition-all flex items-center justify-center gap-1 ${microRowMode === 'new' ? 'bg-white shadow-sm text-teal-700 border border-teal-100' : 'text-slate-500'}`}
            >
              <PlusCircle size={12} /> Create New
            </button>
          </div>

          {microRowMode === 'existing' && (
            <div className="space-y-1.5 pl-4 border-l-2 border-teal-100">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Select Micro Row
              </label>
              <Controller
                name="microRowSelection"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isMajorParent && minorRowMode === 'new'}>
                    <SelectTrigger className="w-full bg-white border-slate-200 h-9">
                      <SelectValue placeholder={isMajorParent && minorRowMode === 'new' ? "Must create new micro row" : "Select a micro row..."}>
                        {microRowSelection ? microRows.find(m => m.key === microRowSelection)?.title || microRowSelection : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 shadow-md">
                      {microRows.map((mr) => (
                        <SelectItem key={mr.key} value={mr.key}>
                          <span className="text-slate-700 text-sm">{mr.title}</span>
                        </SelectItem>
                      ))}
                      {microRows.length === 0 && (
                         <div className="px-2 py-2 text-sm text-slate-500">No micro rows found.</div>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.microRowSelection && (
                <p className="text-xs text-rose-500 font-medium">
                  {form.formState.errors.microRowSelection.message as string}
                </p>
              )}
            </div>
          )}

          {microRowMode === 'new' && (
            <div className="space-y-1.5 pl-4 border-l-2 border-teal-100">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                New Micro Row Name
              </label>
              <Input 
                {...form.register("newMicroRowName")}
                type="text" 
                placeholder="e.g. Receipt Adjustment / Output GST (18%)" 
                className="bg-white font-medium h-9"
              />
              {form.formState.errors.newMicroRowName && (
                <p className="text-xs text-rose-500 font-medium">
                  {form.formState.errors.newMicroRowName.message as string}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {majorRowKey && (
        <div className="flex gap-4 mt-2">
          {/* Direction Toggle */}
          <div className="space-y-1.5 shrink-0">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Action
            </label>
            <Controller
              name="direction"
              control={form.control}
              render={({ field }) => (
                <ToggleGroup 
                  value={field.value ? [field.value] : []} 
                  onValueChange={(v: string[]) => { if (v && v.length > 0) field.onChange(v[0]); }}
                  className="justify-start bg-slate-100 p-1 rounded-lg"
                >
                  <ToggleGroupItem value="add" className="text-xs font-bold data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-700 aria-pressed:bg-emerald-100 aria-pressed:text-emerald-700 aria-checked:bg-emerald-100 aria-checked:text-emerald-700 data-selected:bg-emerald-100 data-selected:text-emerald-700 h-9 px-3">
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </ToggleGroupItem>
                  <ToggleGroupItem value="subtract" className="text-xs font-bold data-[state=on]:bg-rose-100 data-[state=on]:text-rose-700 aria-pressed:bg-rose-100 aria-pressed:text-rose-700 aria-checked:bg-rose-100 aria-checked:text-rose-700 data-selected:bg-rose-100 data-selected:text-rose-700 h-9 px-3">
                    <Minus className="w-3 h-3 mr-1" /> Subtract
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            />
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5 flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Amount (₹)
            </label>
            <Input 
              {...form.register("amount")}
              type="number" 
              step="any"
              placeholder="0.00" 
              className="bg-white font-medium h-9"
            />
            {form.formState.errors.amount && (
              <p className="text-xs text-rose-500 font-medium">
                {form.formState.errors.amount.message as string}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || !majorRowKey}
          className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post Receipt"}
        </Button>
      </div>
    </form>
  );
}
