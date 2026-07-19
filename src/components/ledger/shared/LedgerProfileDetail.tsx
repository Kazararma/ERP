import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { LedgerProfile, LedgerEntry, LedgerPdfOptions } from "@/types/ledger-profile";
import { LedgerDisplayUnit, LEDGER_UNITS } from "@/lib/ledgerUnitConversion";
import { addManualLedgerEntry, deleteManualLedgerEntry, updateLedgerEntryVchNo, updateLedgerEntry, updateLedgerEntryAmount, updateLedgerProfileSettings, reorderLedgerEntry } from "@/services/ledgerProfileService";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LedgerProfileTable } from "./LedgerProfileTable";
import { LedgerTotalsFooter } from "./LedgerTotalsFooter";
import { ManualEntryForm } from "./ManualEntryForm";
import { LedgerProfilePdf } from "./pdf/LedgerProfilePdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Download, Calendar, Settings, FileText, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUiStore } from "@/stores/uiStore";
import { useLedgerStore } from "@/stores/useLedgerStore";

interface Props {
  profile: LedgerProfile;
}

export function LedgerProfileDetail({ profile }: Props) {
  const [localProfile, setLocalProfile] = useState(profile);
  const [entries, setEntries]       = useState<LedgerEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [millName, setMillName] = useState(profile.millName);
  const [millDesc, setMillDesc] = useState(profile.millDescription);
  const [dateFrom, setDateFrom]     = useState<string>("");
  const [dateTo, setDateTo]         = useState<string>("");
  const hasInitializedDates = useRef(false);
  // Active display unit — controls quantity/price conversion in both table and PDF
  const [activeLedgerUnit, setActiveLedgerUnit] = useState<LedgerDisplayUnit>("kg");


  const DEFAULT_PDF_OPTIONS: LedgerPdfOptions = {
    showVchType: true,
    showVchNo: true,
    showSubParticulars: true,
    showRefLabel: true,
  };
  const [pdfOptions, setPdfOptions] = useState<LedgerPdfOptions>(DEFAULT_PDF_OPTIONS);

  // ── All raw (unfiltered) entries from Firestore ─────────────────────────────
  const [rawEntries, setRawEntries] = useState<any[]>([]);

  // ── Single persistent listener — ONLY depends on profile.id ────────────────
  // Storing ALL entries as rawEntries; date filtering is a separate derived step.
  // This prevents the listener from tearing down when dateFrom/dateTo change,
  // which was the root cause of new entries not appearing without a refresh.
  useEffect(() => {
    setLoading(true);
    hasInitializedDates.current = false;

    const q = query(
      collection(db, `ledgerProfiles/${profile.id}/entries`),
      orderBy("date", "asc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      let data = snap.docs.map((d) => d.data() as any);

      // Same-day entries sorted by creation time
      data.sort((a: any, b: any) => {
        const dateA = a.date.toDate(); dateA.setHours(0, 0, 0, 0);
        const dateB = b.date.toDate(); dateB.setHours(0, 0, 0, 0);
        const dDiff = dateA.getTime() - dateB.getTime();
        if (dDiff !== 0) return dDiff;
        return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
      });

      // Filter out internal bag-split entries
      data = data.filter(
        (e: any) => e.entryType !== "bags_divided" && e.entryType !== "bags_divided_reverted"
      );

      // Auto-populate date filters on very first load only
      if (!hasInitializedDates.current && data.length > 0) {
        hasInitializedDates.current = true;
        const sorted = [...data].sort((a: any, b: any) => a.date.toMillis() - b.date.toMillis());
        setDateFrom(format(sorted[0].date.toDate(), "yyyy-MM-dd"));
        setDateTo(format(sorted[sorted.length - 1].date.toDate(), "yyyy-MM-dd"));
      }

      setRawEntries(data); // store ALL; date filter applied in the effect below
      setLoading(false);
    }, (err) => {
      console.error("Ledger entries listener error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile.id]); // ← only profile.id — listener never restarts on date changes

  // ── Apply date filter reactively whenever rawEntries or date range changes ──
  useEffect(() => {
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : undefined;
    const to   = dateTo   ? new Date(dateTo   + "T23:59:59") : undefined;
    let filtered = rawEntries;
    if (from) filtered = filtered.filter((e: any) => e.date.toDate() >= from);
    if (to)   filtered = filtered.filter((e: any) => e.date.toDate() <= to);
    setEntries(filtered);
  }, [rawEntries, dateFrom, dateTo]);

  const handleManualSubmit = async (form: any) => {
    await addManualLedgerEntry(
      profile.id, profile.entityId, profile.entityType, form
    );
    // Optimistic store refresh so sidebar totals update without waiting for listener
    if (profile.entityType === 'supplier') {
      useLedgerStore.getState().fetchSuppliersData(true);
    } else {
      useLedgerStore.getState().fetchCustomersData(true);
    }
    // No manual fetchEntries() needed — the onSnapshot listener fires automatically
  };

  const handleDelete = async (entry: LedgerEntry) => {
    const confirm = await useUiStore.getState().requestConfirm("Delete Entry", "Delete this manual entry?");
    if (!confirm) return;
    await deleteManualLedgerEntry(profile.id, entry);
    if (profile.entityType === 'supplier') {
      useLedgerStore.getState().fetchSuppliersData(true);
    } else {
      useLedgerStore.getState().fetchCustomersData(true);
    }
    // No manual fetchEntries() needed — the onSnapshot listener fires automatically
  };

  const handleUpdateVchNo = async (entry: LedgerEntry, newVchNo: number) => {
    await updateLedgerEntryVchNo(profile.id, entry.id, newVchNo);
    // No manual fetchEntries() needed — the onSnapshot listener fires automatically
  };

  const handleUpdateEntry = async (entry: LedgerEntry, updates: Partial<LedgerEntry>) => {
    await updateLedgerEntry(profile.id, entry.id, updates);
    // No manual fetchEntries() needed — the onSnapshot listener fires automatically
  };

  const handleUpdateAmount = async (entry: LedgerEntry, newDebit: number, newCredit: number) => {
    // 1. Calculate the new profile totals for optimistic store update
    const oldDebit = entry.debit ?? 0;
    const oldCredit = entry.credit ?? 0;
    const currentProfile = localProfile;
    const optimisticTotalDebit = currentProfile.totalDebit + (newDebit - oldDebit);
    const optimisticTotalCredit = currentProfile.totalCredit + (newCredit - oldCredit);
    const optimisticClosingBalance = optimisticTotalDebit - optimisticTotalCredit;

    // 2. Optimistically patch the Zustand store so sidebar/list reflects immediately
    useLedgerStore.getState().updateProfileInStore(profile.entityType, profile.entityId, {
      totalDebit: optimisticTotalDebit,
      totalCredit: optimisticTotalCredit,
      closingBalance: optimisticClosingBalance,
    });

    // 3. Run the Firestore transaction
    await updateLedgerEntryAmount(profile.id, entry.id, newDebit, newCredit);

    // 4. Cascade full refresh into the Zustand store (replaces optimistic values with real DB data)
    if (profile.entityType === "supplier") {
      useLedgerStore.getState().fetchSuppliersData(true);
    } else {
      useLedgerStore.getState().fetchCustomersData(true);
    }
    // No manual fetchEntries() needed — the onSnapshot listener fires automatically
  };

  const handleReorder = async (newOrder: LedgerEntry[], activeId: string, oldIndex: number, newIndex: number) => {
    // Optimistic UI update
    setEntries(newOrder);

    const movedEntry = newOrder[newIndex];
    const prevEntry = newOrder[newIndex - 1];
    const nextEntry = newOrder[newIndex + 1];

    let newMillis = Date.now();
    let newDateMillis: number | undefined = undefined;

    if (prevEntry && nextEntry) {
      const prevMillis = prevEntry.createdAt?.toMillis() || Date.now();
      const nextMillis = nextEntry.createdAt?.toMillis() || Date.now();
      newMillis = prevMillis + (nextMillis - prevMillis) / 2;
      
      // If we dragged it between two items of the same date, assume that date.
      if (prevEntry.date.toMillis() === nextEntry.date.toMillis()) {
        newDateMillis = prevEntry.date.toMillis();
      } else {
        newDateMillis = nextEntry.date.toMillis();
      }
    } else if (prevEntry) {
      newMillis = (prevEntry.createdAt?.toMillis() || Date.now()) + 1000;
      newDateMillis = prevEntry.date.toMillis();
    } else if (nextEntry) {
      newMillis = (nextEntry.createdAt?.toMillis() || Date.now()) - 1000;
      newDateMillis = nextEntry.date.toMillis();
    }

    try {
      await reorderLedgerEntry(profile.id, activeId, newMillis, newDateMillis);
    } catch (err) {
      console.error("Failed to reorder", err);
      // Revert on failure by triggering a listener refresh via a harmless state touch
      setLoading((v) => v); // no-op — onSnapshot will emit the current Firestore state
    }
  };

  const handlePdfExport = async () => {
    const blob = await pdf(
      <LedgerProfilePdf
        profile={localProfile}
        entries={entries}
        dateFrom={dateFrom ? new Date(dateFrom + "T00:00:00") : new Date()}
        dateTo={dateTo   ? new Date(dateTo + "T23:59:59")   : new Date()}
        options={pdfOptions}
        activeUnit={activeLedgerUnit}
      />
    ).toBlob();
    saveAs(blob, `ledger_${localProfile.entityName.replace(/\s+/g, "_")}.pdf`);
    setShowPdfOptions(false);
  };

  const handleSaveSettings = async () => {
    await updateLedgerProfileSettings(localProfile.id, { millName, millDescription: millDesc });
    setLocalProfile({ ...localProfile, millName, millDescription: millDesc });
    setShowSettings(false);
  };

  const nextVchNo = entries.length > 0
    ? Math.max(...entries.map((e) => e.vchNo)) + 1
    : 1;

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{localProfile.entityName}</h2>
          <p className="text-sm font-medium text-slate-500 capitalize mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {localProfile.entityType} Ledger Account
          </p>
        </div>
        <div className="flex gap-3">
          {/* Display Units dropdown */}
          <div className="relative">
            <Select
              value={activeLedgerUnit}
              onValueChange={(v) => setActiveLedgerUnit(v as LedgerDisplayUnit)}
            >
              <SelectTrigger
                className="h-9 pl-3 pr-2 text-sm font-medium border-slate-200 bg-white shadow-sm gap-1.5 text-slate-600 hover:bg-slate-50"
              >
                <span className="text-slate-400 text-xs font-normal mr-0.5">Unit:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {LEDGER_UNITS.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={() => setShowSettings(true)} className="shadow-sm">
            <Settings size={16} className="mr-2" /> PDF Heading
          </Button>
          <Button variant="outline" onClick={() => setShowPdfOptions(true)} className="shadow-sm">
            <Download size={16} className="mr-2" /> Export PDF
          </Button>
          <Button onClick={() => setShowForm(true)} className="shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus size={16} className="mr-2" /> Add Entry
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-4">
        {/* Date Range Filter */}
        <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm w-fit">
          <div className="flex items-center px-3 gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 border-none shadow-none focus-visible:ring-0 text-sm font-medium bg-transparent" />
          </div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex items-center px-3 gap-2">
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 border-none shadow-none focus-visible:ring-0 text-sm font-medium bg-transparent" />
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading entries…</p>
      ) : (
        <>
          <LedgerProfileTable
            entries={entries}
            activeUnit={activeLedgerUnit}
            onDeleteManual={handleDelete}
            onUpdateVchNo={handleUpdateVchNo}
            onUpdateEntry={handleUpdateEntry}
            onUpdateAmount={handleUpdateAmount}
            onReorder={handleReorder}
          />
          <LedgerTotalsFooter
            totalDebit={entries.reduce((sum, e) => sum + e.debit, 0)}
            totalCredit={entries.reduce((sum, e) => sum + e.credit, 0)}
          />
        </>
      )}

      {/* Manual Entry Drawer */}
      <ManualEntryForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleManualSubmit}
        nextVchNo={nextVchNo}
      />

      {/* PDF Column Options Dialog */}
      <Dialog open={showPdfOptions} onOpenChange={setShowPdfOptions}>
        <DialogContent className="sm:max-w-[400px] bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={18} className="text-indigo-600" />
              PDF Export Options
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-5">
            <p className="text-sm text-slate-500">
              Select which columns and details to include in the generated PDF.
            </p>

            {/* Toggle list */}
            <div className="space-y-3">
              {([
                { key: "showVchType",        label: "Voucher Type column" },
                { key: "showVchNo",          label: "Voucher Number column" },
                { key: "showSubParticulars", label: "Rate / quantity details line" },
                { key: "showRefLabel",       label: "Reference label line" },
              ] as { key: keyof LedgerPdfOptions; label: string }[]).map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={pdfOptions[key]}
                      onChange={(e) =>
                        setPdfOptions((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="
                        peer h-4.5 w-4.5 rounded border-slate-300 text-indigo-600
                        focus:ring-indigo-500 cursor-pointer
                        accent-indigo-600
                      "
                    />
                  </div>
                  <span className="text-sm text-slate-700 group-hover:text-slate-900 select-none">
                    {label}
                  </span>
                </label>
              ))}
            </div>

            {/* Reset to defaults */}
            <button
              type="button"
              onClick={() => setPdfOptions(DEFAULT_PDF_OPTIONS)}
              className="text-xs text-indigo-500 hover:text-indigo-700 underline-offset-2 hover:underline transition-colors"
            >
              Reset to defaults
            </button>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPdfOptions(false)}>Cancel</Button>
            <Button
              onClick={handlePdfExport}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              <Download size={15} /> Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[425px] bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle>Edit PDF Heading</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="millName">Mill / Business Name</Label>
              <Input
                id="millName"
                value={millName}
                onChange={(e) => setMillName(e.target.value)}
                placeholder="e.g. K.R.M Rice Mill"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="millDesc">Sub-Heading / Description</Label>
              <Input
                id="millDesc"
                value={millDesc}
                onChange={(e) => setMillDesc(e.target.value)}
                placeholder="e.g. Ledger Account"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings} className="bg-indigo-600 hover:bg-indigo-700 text-white">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
