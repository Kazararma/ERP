import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { EntityType } from "@/types/ledger-profile";
import type { LedgerProfileRow } from "@/components/ledger/shared/ledgerProfileRows";
import { generateLedgerOverviewPdf } from "@/components/ledger/shared/pdf/generateLedgerOverviewPdf";

const BUTTON_CLASS =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

interface Props {
  entityType: EntityType;
  /** ALL rows for the category — NOT the search-filtered subset. */
  rows: LedgerProfileRow[];
}

export function LedgerOverviewPdfButton({ entityType, rows }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || rows.length === 0) return;
    setBusy(true);
    try {
      await generateLedgerOverviewPdf(entityType, rows);
    } catch (err) {
      console.error("[ledger] overview PDF failed", err);
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || rows.length === 0}
      className={BUTTON_CLASS}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Generate PDF
    </button>
  );
}
