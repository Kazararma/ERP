import type { EntityType, LedgerProfile } from "@/types/ledger-profile";

export interface LedgerProfileRow {
  /** Firestore DOCUMENT ID of ledgerProfiles/{id}. The ONLY key used for selection and React keys. */
  profileId: string;
  entityId: string;
  entityType: EntityType;
  /** Single canonical display name (profile.entityName). Used by list, detail header and PDFs. */
  displayName: string;
  totalDebit: number;
  totalCredit: number;
  /** Stored closingBalance (>= 0 → Dr, < 0 → Cr). Same figure the list already shows. */
  balance: number;
  /** The exact profile object this row was built from. Pass THIS to <LedgerProfileDetail />. */
  profile: LedgerProfile;
}

const toNum = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/**
 * Build display rows from a profile map. Pure + deterministic.
 * NOTE (A8): if the tab currently uses a different sort than name A→Z, replace the
 * comparator below with that existing ordering so the screen does not change.
 */
export function buildProfileRows(
  profileMap: Record<string, LedgerProfile>
): LedgerProfileRow[] {
  const byId = new Map<string, LedgerProfileRow>();
  Object.values(profileMap).forEach((p) => {
    if (!p || !p.id) return;
    if (byId.has(p.id)) return; // same doc reachable via two keys → keep one
    byId.set(p.id, {
      profileId: p.id,
      entityId: p.entityId,
      entityType: p.entityType,
      displayName: (p.entityName ?? "").trim() || "(Unnamed)",
      totalDebit: toNum(p.totalDebit),
      totalCredit: toNum(p.totalCredit),
      balance: toNum(p.closingBalance),
      profile: p,
    });
  });
  return Array.from(byId.values()).sort((a, b) => {
    const timeA = a.profile.createdAt?.toMillis() || 0;
    const timeB = b.profile.createdAt?.toMillis() || 0;
    return timeB - timeA; // Descending order to match original sort
  });
}

export interface LedgerOverviewTotals {
  entityCount: number;
  totalDebit: number;
  totalCredit: number;
  /** Sum of row balances (Dr positive, Cr negative). */
  netBalance: number;
  /** Sum of all Dr (positive) balances. */
  grossDrBalance: number;
  /** Sum of absolute values of all Cr (negative) balances. */
  grossCrBalance: number;
}

/** Sums in integer paise to avoid floating-point drift. */
export function summarizeRows(
  rows: ReadonlyArray<Pick<LedgerProfileRow, "totalDebit" | "totalCredit" | "balance">>
): LedgerOverviewTotals {
  let debit = 0;
  let credit = 0;
  let net = 0;
  let dr = 0;
  let cr = 0;
  rows.forEach((r) => {
    debit += Math.round(r.totalDebit * 100);
    credit += Math.round(r.totalCredit * 100);
    const b = Math.round(r.balance * 100);
    net += b;
    if (b > 0) dr += b;
    else if (b < 0) cr += -b;
  });
  return {
    entityCount: rows.length,
    totalDebit: debit / 100,
    totalCredit: credit / 100,
    netBalance: net / 100,
    grossDrBalance: dr / 100,
    grossCrBalance: cr / 100,
  };
}

export interface MillHeader {
  millName: string;
  millDescription: string;
  millContact: string;
}

function mostCommon(values: Array<string | undefined>): string {
  const counts = new Map<string, number>();
  values.forEach((v) => {
    const t = (v ?? "").trim();
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  });
  let best = "";
  let bestN = 0;
  counts.forEach((n, k) => {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  });
  return best;
}

/** PDF header = most common non-empty mill fields among the given profiles ("Apply to All" makes them identical). */
export function resolveMillHeader(profiles: ReadonlyArray<LedgerProfile>): MillHeader {
  return {
    millName: mostCommon(profiles.map((p) => p.millName)) || "Rice Mill",
    millDescription: mostCommon(profiles.map((p) => p.millDescription)),
    millContact: mostCommon(profiles.map((p) => p.millContact)),
  };
}
