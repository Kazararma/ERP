// src/components/ledger/shared/pdf/LedgerProfilePdf.tsx
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import type { LedgerPdfParams, LedgerPdfOptions } from "@/types/ledger-profile";
import {
  LedgerDisplayUnit,
  getUnitConfig,
  convertSubParticulars,
  hasConvertiblePattern,
} from "@/lib/ledgerUnitConversion";

const COL = {
  date:        "12%",
  particulars: "33%",
  vchType:     "22%",
  vchNo:       "8%",
  debit:       "12.5%",
  credit:      "12.5%",
};

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingHorizontal: 40,
    paddingVertical: 40,
    color: "#000",
  },

  /* ── Header ── */
  headerBlock: { marginBottom: 12, alignItems: "center" },
  millName:    { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center" },
  millDesc:    { fontSize: 10, textAlign: "center", marginTop: 2 },
  entityName:  { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 8 },
  ledgerLabel: { fontSize: 10, textAlign: "center", marginTop: 2 },
  dateRange:   { fontSize: 10, textAlign: "center", marginTop: 16, marginBottom: 8 },

  /* ── Table ── */
  tableHeader: { 
    flexDirection: "row", 
    borderTopWidth: 1, 
    borderBottomWidth: 1, 
    borderColor: "#000", 
    paddingVertical: 4,
    alignItems: "center"
  },
  tableRow:       { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0 },

  colDate:        { width: COL.date,        paddingHorizontal: 2 },
  colParticulars: { width: COL.particulars, paddingHorizontal: 2 },
  colVchType:     { width: COL.vchType,     paddingHorizontal: 2, textAlign: "center" },
  colVchNo:       { width: COL.vchNo,       paddingHorizontal: 2, textAlign: "right", paddingRight: 10 },
  colDebit:       { width: COL.debit,       paddingHorizontal: 2, textAlign: "right" },
  colCredit:      { width: COL.credit,      paddingHorizontal: 2, textAlign: "right" },

  headerText:     { fontFamily: "Helvetica-Bold", fontSize: 9 },
  
  partTitle:      { fontFamily: "Helvetica-Bold", fontSize: 9 },
  partSub:        { fontSize: 7.5, fontStyle: "italic", marginTop: 1.5, color: "#222" },
  vchMain:        { fontFamily: "Helvetica-Bold", fontSize: 9 },
  vchSub:         { fontSize: 7.5, marginTop: 1.5, color: "#222" },

  /* ── Footer ── */
  footerRow:       { flexDirection: "row", paddingVertical: 3 },
  footerTotal:     { 
    flexDirection: "row", 
    paddingVertical: 4, 
    borderTopWidth: 1, 
    borderTopColor: "#000",
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    marginTop: 2 
  },
  footerBold:      { fontFamily: "Helvetica-Bold", fontSize: 9 },
  
  pageNumberWrap: { position: "absolute", right: 2, top: -14 },
  pageNumber:     { fontSize: 8, textAlign: "right" }
});

const fmt = (n: number) =>
  n === 0 ? "" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LedgerProfilePdf({
  profile,
  entries,
  dateFrom,
  dateTo,
  options,
  activeUnit = "kg",
}: LedgerPdfParams & { options?: LedgerPdfOptions; activeUnit?: LedgerDisplayUnit }) {
  const unitCfg = getUnitConfig(activeUnit);
  const totalDebit  = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const closing     = totalDebit - totalCredit;
  const equalised   = Math.max(totalDebit, totalCredit);

  // In Tally, closing balance is placed on the side that needs it to balance the totals.
  // If Credit is higher, we need Debit to balance. So it goes on Debit side, with a "Cr" label.
  const isCreditBal = closing < 0;
  const balanceLabel = isCreditBal ? "Cr        Closing Balance" : "Dr        Closing Balance";
  const closingDebit = isCreditBal ? Math.abs(closing) : 0;
  const closingCredit = !isCreditBal ? Math.abs(closing) : 0;

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.headerBlock}>
          <Text style={S.millName}>{profile.millName}</Text>
          <Text style={S.millDesc}>{profile.millDescription}</Text>
          {/* millContact/phone intentionally omitted from PDF output */}
          <Text style={S.entityName}>{profile.entityName}</Text>
          <Text style={S.ledgerLabel}>
            {profile.entityType === "supplier" ? "Supplier Ledger Statement" :
             profile.entityType === "customer" ? "Customer Ledger Statement" :
             "Miscellaneous Ledger Statement"}
          </Text>
        </View>

        <Text style={S.dateRange}>
          {format(dateFrom, "d-MMM-yy")} to {format(dateTo, "d-MMM-yy")}
        </Text>

        {/* ── Column Headers ── */}
        <View style={{ position: "relative" }}>
          <View style={S.pageNumberWrap}>
            <Text
              style={S.pageNumber}
              render={({ pageNumber }) => `Page ${pageNumber}`}
              fixed
            />
          </View>
          <View style={S.tableHeader}>
            <Text style={[S.colDate,        S.headerText]}>Date</Text>
            <Text style={[S.colParticulars, S.headerText]}>
              Particulars{activeUnit !== "kg" ? ` (${unitCfg.headerLabel})` : ""}
            </Text>
            {(options?.showVchType ?? true) && (
              <Text style={[S.colVchType, S.headerText]}>Vch Type</Text>
            )}
            {(options?.showVchNo ?? true) && (
              <Text style={[S.colVchNo, S.headerText]}>Vch No.</Text>
            )}
            <Text style={[S.colDebit,  S.headerText]}>Debit</Text>
            <Text style={[S.colCredit, S.headerText]}>Credit</Text>
          </View>
        </View>

        {/* ── Rows ── */}
        {entries.map((entry) => {
          const prefix = entry.debit > 0 ? "Cr " : "Dr ";
          // Convert sub-particulars to the active display unit.
          // convertSubParticulars handles both unit conversion AND 2-dp price formatting
          // in one pass. Non-convertible rows are returned verbatim.
          let displayedSub = hasConvertiblePattern(entry.subParticulars)
            ? convertSubParticulars(entry.subParticulars ?? "", activeUnit)
            : (entry.subParticulars ?? "");

          // Sanitize unicode characters that Helvetica doesn't support well
          displayedSub = displayedSub.replace(/₹/g, "Rs.").replace(/−/g, "-");
          const safeParticulars = entry.particulars.replace(/₹/g, "Rs.").replace(/−/g, "-");

          return (
            <View key={entry.id} style={S.tableRow} wrap={false}>
              <Text style={S.colDate}>{format(entry.date.toDate(), "d-MMM-yy")}</Text>
              
              <View style={S.colParticulars}>
                <Text style={S.partTitle}>{prefix} {safeParticulars}</Text>
                {(options?.showSubParticulars ?? true) && displayedSub
                  ? <Text style={S.partSub}>{displayedSub}</Text>
                  : null}
              </View>
              
              {(options?.showVchType ?? true) && (
                <View style={S.colVchType}>
                  <Text style={S.vchMain}>{entry.vchType}</Text>
                  {/* Simulated Tally vch sub-details */}
                  {entry.vchType === "Purchase" || entry.vchType === "Sale" ? (
                    <Text style={S.vchSub}>{fmt(entry.debit || entry.credit)} {entry.debit > 0 ? "Cr" : "Dr"}</Text>
                  ) : (
                    <Text style={S.vchSub}>{format(entry.date.toDate(), "d-M-yyyy")}    {fmt(entry.debit || entry.credit)} {entry.debit > 0 ? "Cr" : "Dr"}</Text>
                  )}
                </View>
              )}

              {(options?.showVchNo ?? true) && (
                <Text style={S.colVchNo}>{entry.vchNo}</Text>
              )}
              <Text style={S.colDebit}>{fmt(entry.debit)}</Text>
              <Text style={S.colCredit}>{fmt(entry.credit)}</Text>
            </View>
          );
        })}

        {/* ── Footer ── */}
        <View style={{ marginTop: 10 }} wrap={false}>
          {/* Sub-total row */}
          <View style={S.footerRow}>
            <Text style={{ width: "74%" }}></Text>
            <Text style={[S.colDebit, S.footerBold]}>{fmt(totalDebit)}</Text>
            <Text style={[S.colCredit, S.footerBold]}>{fmt(totalCredit)}</Text>
          </View>

          {/* Closing balance row */}
          <View style={S.footerRow}>
            <View style={{ width: COL.date }}></View>
            <Text style={[{ width: COL.particulars }, S.footerBold]}>{balanceLabel}</Text>
            <View style={{ width: COL.vchType }}></View>
            <View style={{ width: COL.vchNo }}></View>
            <Text style={[S.colDebit,  S.footerBold]}>{fmt(closingDebit)}</Text>
            <Text style={[S.colCredit, S.footerBold]}>{fmt(closingCredit)}</Text>
          </View>

          {/* Equalised grand total */}
          <View style={S.footerTotal}>
            <Text style={{ width: "74%" }}></Text>
            <Text style={[S.colDebit,  S.footerBold]}>{fmt(equalised)}</Text>
            <Text style={[S.colCredit, S.footerBold]}>{fmt(equalised)}</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
