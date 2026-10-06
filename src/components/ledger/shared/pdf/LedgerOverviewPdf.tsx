import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { EntityType } from "@/types/ledger-profile";
import { summarizeRows } from "@/components/ledger/shared/ledgerProfileRows";

export interface LedgerOverviewPdfProps {
  entityType: EntityType;
  rows: { name: string; totalDebit: number; totalCredit: number; balance: number }[];
  millName: string;
  millDescription?: string;
  millContact?: string;
  generatedOn: string;
}

const TITLES: Record<EntityType, string> = {
  supplier: "Supplier Balances",
  customer: "Customer Balances",
  miscellaneous: "Miscellaneous Balances",
};

const NAME_HEADER: Record<EntityType, string> = {
  supplier: "Supplier Name",
  customer: "Customer Name",
  miscellaneous: "Profile Name",
};

// Conservative capacities for A4 portrait (row height 20pt). Last page also holds the totals bar.
const FIRST_PAGE_ROWS = 20;
const NEXT_PAGE_ROWS = 30;

const DR = "#b91c1c";
const CR = "#047857";

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtBalance = (n: number) => {
  const r = Math.round(n * 100) / 100;
  if (r === 0) return "0.00";
  return `${fmt(Math.abs(r))} ${r > 0 ? "Dr" : "Cr"}`;
};
const balanceColor = (n: number) => (Math.round(n * 100) === 0 ? "#0f172a" : n > 0 ? DR : CR);
const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function paginate<T>(items: T[]): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [items.slice(0, FIRST_PAGE_ROWS)];
  for (let i = FIRST_PAGE_ROWS; i < items.length; i += NEXT_PAGE_ROWS) {
    pages.push(items.slice(i, i + NEXT_PAGE_ROWS));
  }
  return pages;
}

const styles = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 44, paddingHorizontal: 32, fontSize: 9, fontFamily: "Helvetica", color: "#0f172a" },
  millName: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center" },
  millLine: { fontSize: 9, textAlign: "center", color: "#475569", marginTop: 2 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 12 },
  meta: { fontSize: 8, textAlign: "center", color: "#64748b", marginTop: 3, marginBottom: 10 },
  summaryRow: { flexDirection: "row", marginBottom: 4 },
  summaryBox: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 3, paddingVertical: 5, paddingHorizontal: 7, marginRight: 6 },
  summaryLabel: { fontSize: 7, color: "#64748b", marginBottom: 2 },
  summaryValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  grossLine: { fontSize: 8, color: "#475569", marginBottom: 8 },
  tableHeader: { flexDirection: "row", height: 22, alignItems: "center", backgroundColor: "#f1f5f9", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#cbd5e1" },
  headCell: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#334155", paddingHorizontal: 6 },
  row: { flexDirection: "row", height: 20, alignItems: "center", borderBottomWidth: 0.5, borderColor: "#e2e8f0" },
  rowAlt: { backgroundColor: "#f8fafc" },
  cell: { paddingHorizontal: 6, fontSize: 9 },
  colSno: { width: "7%" },
  colName: { width: "33%" },
  colNum: { width: "20%", textAlign: "right" as const },
  totalsBar: { flexDirection: "row", height: 26, alignItems: "center", backgroundColor: "#0f172a", marginTop: 6, borderRadius: 2 },
  totalsText: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 9, paddingHorizontal: 6 },
  footer: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#94a3b8" },
});

export function LedgerOverviewPdf({
  entityType, rows, millName, millDescription, millContact, generatedOn,
}: LedgerOverviewPdfProps) {
  const totals = summarizeRows(rows);
  const pages = paginate(rows);

  return (
    <Document title={TITLES[entityType]} author={millName}>
      {pages.map((pageRows, pageIndex) => {
        const isFirst = pageIndex === 0;
        const isLast = pageIndex === pages.length - 1;
        const startIndex = isFirst ? 0 : FIRST_PAGE_ROWS + (pageIndex - 1) * NEXT_PAGE_ROWS;

        return (
          <Page key={pageIndex} size="A4" style={styles.page}>
            {isFirst && (
              <View>
                <Text style={styles.millName}>{millName}</Text>
                {millDescription ? <Text style={styles.millLine}>{millDescription}</Text> : null}
                {millContact ? <Text style={styles.millLine}>{millContact}</Text> : null}
                <Text style={styles.title}>{TITLES[entityType]}</Text>
                <Text style={styles.meta}>
                  As on {generatedOn} · Amounts in Rs. · Dr = debit balance, Cr = credit balance
                </Text>

                <View style={styles.summaryRow}>
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryLabel}>Entities</Text>
                    <Text style={styles.summaryValue}>{totals.entityCount}</Text>
                  </View>
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryLabel}>Total Debit</Text>
                    <Text style={styles.summaryValue}>{fmt(totals.totalDebit)}</Text>
                  </View>
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryLabel}>Total Credit</Text>
                    <Text style={styles.summaryValue}>{fmt(totals.totalCredit)}</Text>
                  </View>
                  <View style={[styles.summaryBox, { marginRight: 0 }]}>
                    <Text style={styles.summaryLabel}>Net Outstanding</Text>
                    <Text style={[styles.summaryValue, { color: balanceColor(totals.netBalance) }]}>
                      {fmtBalance(totals.netBalance)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.grossLine}>
                  Sum of Dr balances: {fmt(totals.grossDrBalance)}   ·   Sum of Cr balances: {fmt(totals.grossCrBalance)}
                </Text>
              </View>
            )}

            <View style={styles.tableHeader}>
              <Text style={[styles.headCell, styles.colSno]}>#</Text>
              <Text style={[styles.headCell, styles.colName]}>{NAME_HEADER[entityType]}</Text>
              <Text style={[styles.headCell, styles.colNum]}>Total Debit</Text>
              <Text style={[styles.headCell, styles.colNum]}>Total Credit</Text>
              <Text style={[styles.headCell, styles.colNum]}>Outstanding Balance</Text>
            </View>

            {pageRows.map((r, i) => (
              <View key={`${startIndex + i}`} style={i % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row} wrap={false}>
                <Text style={[styles.cell, styles.colSno]}>{startIndex + i + 1}</Text>
                <Text style={[styles.cell, styles.colName]}>{truncate(r.name, 42)}</Text>
                <Text style={[styles.cell, styles.colNum]}>{fmt(r.totalDebit)}</Text>
                <Text style={[styles.cell, styles.colNum]}>{fmt(r.totalCredit)}</Text>
                <Text style={[styles.cell, styles.colNum, { color: balanceColor(r.balance), fontFamily: "Helvetica-Bold" }]}>
                  {fmtBalance(r.balance)}
                </Text>
              </View>
            ))}

            {isLast && (
              <View style={styles.totalsBar} wrap={false}>
                <Text style={[styles.totalsText, styles.colSno]} />
                <Text style={[styles.totalsText, styles.colName]}>Grand Total</Text>
                <Text style={[styles.totalsText, styles.colNum]}>{fmt(totals.totalDebit)}</Text>
                <Text style={[styles.totalsText, styles.colNum]}>{fmt(totals.totalCredit)}</Text>
                <Text style={[styles.totalsText, styles.colNum]}>{fmtBalance(totals.netBalance)}</Text>
              </View>
            )}

            <View style={styles.footer} fixed>
              <Text>{millName} — {TITLES[entityType]}</Text>
              <Text>Page {pageIndex + 1} of {pages.length}</Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
