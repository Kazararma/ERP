// src/components/balance/pdf/BalanceSheetPdf.tsx
import React from "react";
import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import type { BalanceSheetGroup } from "@/types/balanceSheet";

interface BalanceSheetPdfParams {
  millName: string;
  millDescription?: string;
  groups: BalanceSheetGroup[];
  liabilitiesTotal: number;
  assetsTotal: number;
}

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingHorizontal: 40,
    paddingVertical: 40,
    color: "#000",
  },
  headerBlock: { marginBottom: 20, alignItems: "center" },
  millName:    { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center" },
  millDesc:    { fontSize: 10, textAlign: "center", marginTop: 2 },
  title:       { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 8 },
  date:        { fontSize: 10, textAlign: "center", marginTop: 4 },

  table: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    borderBottomWidth: 0,
  },
  column: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  lastColumn: {
    flex: 1,
  },
  
  colHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    borderBottomWidth: 1,
    borderColor: "#000",
    padding: 4,
    textAlign: "center",
  },

  groupBlock: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  groupHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  groupTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  groupTotal: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 8,
    marginBottom: 2,
  },
  itemLabel: {
    fontSize: 8,
    fontStyle: "italic",
    flex: 1,
    paddingRight: 4,
  },
  itemAmount: {
    fontSize: 8,
    width: 60,
    textAlign: "right",
  },

  footer: {
    flexDirection: "row",
    borderWidth: 1,
    borderTopWidth: 2,
    borderColor: "#000",
  },
  footerCol: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 6,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  footerLastCol: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 6,
  },
  footerText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  
  pageNumberWrap: { position: "absolute", right: 40, top: 20 },
  pageNumber:     { fontSize: 8, textAlign: "right" }
});

const fmt = (n: number) =>
  n === 0 ? "" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Column({ groups, title }: { groups: BalanceSheetGroup[], title: string }) {
  return (
    <View style={S.column}>
      <Text style={S.colHeader}>{title}</Text>
      <View style={{ flex: 1 }}>
        {groups.map(g => {
          const groupTotal = g.items.reduce((sum, item) => sum + (item.amount || 0), 0);
          return (
            <View key={g.key} style={S.groupBlock} wrap={false}>
              <View style={S.groupHeaderRow}>
                <Text style={S.groupTitle}>{g.title}</Text>
                <Text style={S.groupTotal}>{fmt(groupTotal)}</Text>
              </View>
              {g.items.map(item => (
                <View key={item.id} style={S.itemRow}>
                  <Text style={S.itemLabel}>{item.label}</Text>
                  <Text style={S.itemAmount}>{fmt(item.amount)}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function BalanceSheetPdf({ millName, millDescription, groups, liabilitiesTotal, assetsTotal }: BalanceSheetPdfParams) {
  const liabilities = groups.filter(g => g.side === "liabilities");
  const assets = groups.filter(g => g.side === "assets");
  
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <View style={S.pageNumberWrap}>
          <Text style={S.pageNumber} render={({ pageNumber }) => `Page ${pageNumber}`} fixed />
        </View>

        <View style={S.headerBlock}>
          <Text style={S.millName}>{millName}</Text>
          {millDescription && <Text style={S.millDesc}>{millDescription}</Text>}
          <Text style={S.title}>Balance Sheet</Text>
          <Text style={S.date}>as at {format(new Date(), "d-MMM-yyyy")}</Text>
        </View>

        <View style={S.table}>
          <Column groups={liabilities} title="Liabilities" />
          <View style={S.lastColumn}>
            <Text style={S.colHeader}>Assets</Text>
            <View style={{ flex: 1 }}>
              {assets.map(g => {
                const groupTotal = g.items.reduce((sum, item) => sum + (item.amount || 0), 0);
                return (
                  <View key={g.key} style={S.groupBlock} wrap={false}>
                    <View style={S.groupHeaderRow}>
                      <Text style={S.groupTitle}>{g.title}</Text>
                      <Text style={S.groupTotal}>{fmt(groupTotal)}</Text>
                    </View>
                    {g.items.map(item => (
                      <View key={item.id} style={S.itemRow}>
                        <Text style={S.itemLabel}>{item.label}</Text>
                        <Text style={S.itemAmount}>{fmt(item.amount)}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={S.footer} wrap={false}>
          <View style={S.footerCol}>
            <Text style={S.footerText}>Total</Text>
            <Text style={S.footerText}>{fmt(liabilitiesTotal)}</Text>
          </View>
          <View style={S.footerLastCol}>
            <Text style={S.footerText}>Total</Text>
            <Text style={S.footerText}>{fmt(assetsTotal)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
