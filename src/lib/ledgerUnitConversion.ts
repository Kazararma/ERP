// src/lib/ledgerUnitConversion.ts
// ─── Ledger Unit Conversion Utility ──────────────────────────────────────────
//
// Single source of truth for all quantity/price unit conversions in the Ledger.
// Used by:
//   • LedgerProfileTable (UI sub-particulars display)
//   • LedgerProfilePdf   (PDF sub-particulars display)
//   • LedgerProfileDetail (header dropdown)
//
// IMPORTANT: These conversions are purely presentational — no DB values are
// ever mutated. `quantityKg` is always stored in raw kg; price is always ₹/kg.

export type LedgerDisplayUnit = "kg" | "quintal" | "bag50" | "bag60" | "tonne";

export interface UnitConfig {
  /** Unique identifier, used as Select value */
  id: LedgerDisplayUnit;
  /** Human-readable label for dropdowns */
  label: string;
  /** Abbreviated label shown in column headers, e.g. "Qty (qtl)" */
  headerLabel: string;
  /**
   * Conversion factor FROM kg TO this unit.
   * quantity_in_unit = quantityKg / factor
   * price_per_unit   = pricePerKg * factor
   */
  factor: number;
  /** Unit suffix used in sub-particulars string, e.g. "qtl" */
  suffix: string;
  /** Plural short form used in prose, e.g. "qtls" */
  short: string;
}

export const LEDGER_UNITS: readonly UnitConfig[] = [
  { id: "kg",      label: "Kilograms (kg)",  headerLabel: "Qty (kg)",    factor: 1,    suffix: "kg",   short: "kg"    },
  { id: "quintal", label: "Quintals",         headerLabel: "Qty (qtl)",   factor: 100,  suffix: "qtl",  short: "qtls"  },
  { id: "bag50",   label: "50 kg Bags",       headerLabel: "Qty (bags)",  factor: 50,   suffix: "bag",  short: "bags"  },
  { id: "bag60",   label: "60 kg Bags",       headerLabel: "Qty (bags)",  factor: 60,   suffix: "bag",  short: "bags"  },
  { id: "tonne",   label: "Tonnes",           headerLabel: "Qty (t)",     factor: 1000, suffix: "t",    short: "tonnes"},
] as const;

/** Returns the UnitConfig for a given unit id (falls back to kg). */
export function getUnitConfig(unit: LedgerDisplayUnit): UnitConfig {
  return LEDGER_UNITS.find((u) => u.id === unit) ?? LEDGER_UNITS[0];
}

/**
 * Converts a sub-particulars string like "500 kg @ ₹45.00/kg" into the
 * target unit. If the string doesn't match the expected pattern it is
 * returned verbatim (safe for arbitrary free-text rows).
 *
 * Recognised input patterns:
 *   "<qty> kg @ ₹<price>/kg"
 *   "<qty> kg @ ₹<price>/unit"    (legacy variant written by dealService)
 *
 * Output example (quintal):
 *   "5.00 qtls @ ₹4,500.00/qtl"
 */
export function convertSubParticulars(
  text: string,
  unit: LedgerDisplayUnit
): string {
  if (!text) return text;
  const cfg = getUnitConfig(unit);

  // Match the canonical kg-based pattern. Price may or may not have commas.
  const regex = /(\d+(?:\.\d+)?)\s*kg\s*@\s*₹([\d,]+(?:\.\d+)?)\/(?:kg|unit)/g;

  return text.replace(regex, (_match, qtyStr, priceStr) => {
    const qtyKg      = parseFloat(qtyStr);
    const pricePerKg = parseFloat(priceStr.replace(/,/g, ""));
    if (isNaN(qtyKg) || isNaN(pricePerKg)) return _match;

    const convertedQty   = qtyKg   / cfg.factor;
    const convertedPrice = pricePerKg * cfg.factor;

    const qtyFormatted = convertedQty.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    const priceFormatted = convertedPrice.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `${qtyFormatted} ${cfg.short} @ Rs.${priceFormatted}/${cfg.suffix}`;
  });
}

/**
 * Returns true when the text contains a convertible kg-based pattern.
 * Rows without this pattern display their text verbatim with no unit selector.
 */
export function hasConvertiblePattern(text: string | undefined): boolean {
  if (!text) return false;
  return /\d+(?:\.\d+)?\s*kg\s*@\s*₹[\d,]+(?:\.\d+)?\/(?:kg|unit)/.test(text);
}
