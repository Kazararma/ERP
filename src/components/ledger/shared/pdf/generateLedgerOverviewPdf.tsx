import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import type { EntityType } from "@/types/ledger-profile";
import { resolveMillHeader, type LedgerProfileRow } from "@/components/ledger/shared/ledgerProfileRows";
import { LedgerOverviewPdf } from "./LedgerOverviewPdf";

const LABEL: Record<EntityType, string> = {
  supplier: "Supplier",
  customer: "Customer",
  miscellaneous: "Miscellaneous",
};

export async function generateLedgerOverviewPdf(
  entityType: EntityType,
  rows: LedgerProfileRow[]
): Promise<void> {
  if (rows.length === 0) throw new Error("No ledger profiles to include in the PDF.");

  const header = resolveMillHeader(rows.map((r) => r.profile));
  const now = new Date();

  const blob = await pdf(
    <LedgerOverviewPdf
      entityType={entityType}
      rows={rows.map((r) => ({
        name: r.displayName,
        totalDebit: r.totalDebit,
        totalCredit: r.totalCredit,
        balance: r.balance,
      }))}
      millName={header.millName}
      millDescription={header.millDescription}
      millContact={header.millContact}
      generatedOn={format(now, "d-MMM-yy")}
    />
  ).toBlob();

  saveAs(blob, `Ledger_Overview_${LABEL[entityType]}_${format(now, "yyyy-MM-dd")}.pdf`);
}
