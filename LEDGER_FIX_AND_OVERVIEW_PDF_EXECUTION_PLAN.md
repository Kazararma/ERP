# Execution Plan — Ledger Profile Identity Fix + Ledger Overview PDF

> **Audience:** autonomous coding agent (Gemini Flash). **Repo root:** `c:/dev/ERP/rice-erp/`. All paths below are relative to it.
> **Stack:** React 18, TypeScript 5 (strict), Zustand 5, Firebase Firestore 12, `@react-pdf/renderer` 4, `file-saver`, `date-fns` 4, Tailwind, ESLint with `--max-warnings 0`.

---

## 0. Agent Operating Rules (read first, obey throughout)

1. **Read every file in full before editing it.** The "BEFORE" snippets in this plan are *expected shapes* inferred from the architecture document, **not** copies of the real code. Where the real code differs, preserve existing behaviour and apply the *intent* of the "AFTER" snippet.
2. **Work phase by phase.** After each phase run `npx tsc --noEmit` and `npm run lint`. Both must be clean before you continue. Fix your own errors; do not suppress them (the only permitted `eslint-disable` is the one explicitly shown in Phase 3).
3. **No unused imports/variables. No `any`.** ESLint runs with `--max-warnings 0`.
4. Use the `@/` path alias for imports. Match the *existing* import style of neighbouring files (named vs default export of `useLedgerStore`, which toast library, which Button component).
5. **Do NOT:** modify `firestore.rules`; write to Firestore from any script you run; execute `applyMechanicalFixes` with `dryRun:false`; rename or delete existing exports; refactor anything not listed here.
6. Do not narrate; just implement. At the end, output the **Final Report** described in §10.
7. Suggested git hygiene: `git checkout -b fix/ledger-profile-identity-and-overview-pdf` before starting.

---

## 1. Objective Summary

| # | Objective | Outcome |
|---|---|---|
| 1 | **Bug fix — Ledger profile name mismatch.** In Ledger → Supplier/Customer/Misc → *Ledger Profiles*, clicking a row (e.g. "MANIK MONDAL **") opens the detail view of a different entity ("SWAPAN SK"), and vice-versa. | A clicked row, the expanded `LedgerProfileDetail`, its header name, its PDF filename and its loaded entries **all derive from one `LedgerProfile` object identified by its Firestore doc ID**. Plus a read-only audit tool to detect corrupted data, and a rename-sync so the denormalised `entityName` cannot drift again. |
| 2 | **Feature — "Generate PDF" on the three Ledger Profiles tabs.** | A button on each tab produces an A4 overview PDF listing **every** entity in that category with **Total Debit, Total Credit, Outstanding Balance (Dr/Cr)** plus grand totals, sourced from `useLedgerStore` aggregates. |

---

## 2. Root-Cause Analysis (Bug 1)

### 2.1 Provenance & confidence — read this honestly
This analysis is built from the architecture document and four screenshots. **The component source was not available**, so the flaw below is narrowed by evidence, not proven line-by-line. **Phase 0 makes you find the exact line(s) in the real code.** The fix in Phases 1–3 is *structural*: it removes the whole class of defect regardless of which hypothesis is true.

### 2.2 What the screenshots prove

| Observation | Implication |
|---|---|
| Search "mani" → row **"MANIK MONDAL \*\*"** (Dr ₹31,193.00) → opens header **"SWAPAN SK"** with Lal Shonno purchase entries (15-04-2026 → 13-08-2026). | Row and opened profile disagree. |
| Search "swa" → row **"SWAPAN SK \*\*\*"** (Cr ₹92,86,571.00) → opens header **"Manik mondal"** with CASH PAYMENT / CAR FAIR entries (17-04-2026 → 12-09-2026). | Exact **reciprocal swap** of two entities. |
| List text `MANIK MONDAL **` vs detail text `Manik mondal` (case + trailing `**`). | List name and detail name come from **different fields/objects** (e.g. entity master `name` vs profile `entityName`). |
| Only "some" profiles are affected (per the user). Header and entries inside each opened view look mutually consistent. | Not a global off-by-N index shift. A pure list-index bug would open the *same* profile for two different "index 0" rows; here the two clicks opened two *different* profiles in a *swapped* pattern. Points to a **two-source join / lookup keyed on an unreliable field**, or **stale/duplicated identity data**. |

### 2.3 Ranked hypotheses (verify each against the real code in Phase 0)

| ID | Hypothesis | Where to look | Likelihood |
|---|---|---|---|
| **H1** | The row is a **join of two sources**: name/list from entity master (`suppliers[]`/`customers[]`), profile/click payload from `supplierProfiles[entityId]`. The map key is `profile.entityId` (a *stored field*), not the Firestore doc ID. If two profile docs carry swapped/duplicated `entityId` values, the join returns the other person's profile. | `SupplierProfilesTab.tsx`, `CustomerProfilesTab.tsx`, misc tab; `useLedgerStore.fetch*Data`; `getLedgerProfilesByType` | **High** |
| **H2** | Stored `profile.id` **field** ≠ Firestore **doc ID**. `subscribeToProfileEntries(profile.id)` then reads another profile's `entries` subcollection. | `.data() as LedgerProfile` casts; `LedgerProfileDetail` subscribe effect | Medium |
| **H3** | `LedgerProfileDetail` seeds state with `useState(profile)` / `useState(profile.millName)`. If the instance is ever reused for a different `profile` prop (no `key`), header/settings stay stale. Header likely reads `localProfile.entityName`. | `LedgerProfileDetail.tsx` state block | Medium (latent bug either way) |
| **H4** | Store keeps the **previous** profile's `activeProfileEntries` until the first snapshot of the new one arrives, and never unsubscribes on unmount. Detail briefly renders/initialises date range from the wrong ledger. | `useLedgerStore.subscribeToProfileEntries`, detail's entries effect | Medium (real defect, not the cause of *name* swap) |
| **H5** | Click handler uses an **array index** or **name/`includes()` match** instead of an ID (e.g. filtered index into unfiltered array). | `.map((x, i) => … onClick … [i]` , `.find(… name …)` | Low (contradicted by the swap pattern) — but grep anyway |
| **H6** | `entityName` is a **denormalised copy** never synced when a supplier/customer is renamed → cosmetic drift (explains `Manik mondal` vs `MANIK MONDAL **`), not person-swaps. | `updateSupplier`, `updateCustomer`, misc update | High for *cosmetic* drift |

### 2.4 One-minute discriminating check for the human (put this in your Final Report)
Open both affected ledgers and compare their **closing balance** with the list's figures (`Dr ₹31,193.00` on the "MANIK MONDAL" row; `Cr ₹92,86,571.00` on the "SWAPAN SK" row).
- Row balance == balance shown inside the opened ledger → **the list's *name* is wrong** (name/identity data problem → H1/H6/data).
- Row balance ≠ opened ledger's balance → **the click payload is wrong** (join/lookup problem → H1/H2/H5).

### 2.5 ⚠️ Financial-integrity warning
If the audit (Phase 4) reports `ENTRY_OWNER_MISMATCH` or `DUPLICATE_ENTITY_PROFILE`, ledger entries may have been **posted to the wrong entity** (deal/order confirmation resolves profile by `entityId`). That is a **data-repair decision for a human**. Never auto-repair it.

---

## 3. Assumptions to Verify Before Coding

Record the answer to each in your Final Report.

| # | Question | How to check |
|---|---|---|
| A1 | Is `useLedgerStore` a **named** or **default** export? | `grep -rn "useLedgerStore" src --include=*.tsx \| head` |
| A2 | Which toast lib do ledger components use (`react-hot-toast` vs `sonner`)? | `grep -rn "toast" src/components/ledger` |
| A3 | Exact current row-building/click logic in each of the 3 tabs. | Read the files (Phase 0) |
| A4 | Filename + entity id/name field names of the **Miscellaneous** tab and `src/types/miscellaneous.ts`. | `grep -rln "LedgerProfileDetail" src/components` |
| A5 | Is `EntityType` exported from `src/types/ledger-profile.ts`? | Open file. If not, add `export type EntityType = "supplier" \| "customer" \| "miscellaneous";` |
| A6 | Do existing PDFs call `Font.register`? (₹ glyph support) | `grep -rn "Font.register" src` |
| A7 | Does `fetchSuppliersData(true)` clear the profile maps before refilling? (would unmount an open detail) | Read store. If it does, refill in a **single** `set()` call. |
| A8 | Current list sort order in each tab. | Read tab. Preserve it in `buildProfileRows` (see §5.1 note). |
| A9 | Exact classes of the "Export PDF" button in `LedgerProfileDetail`. | Read file; reuse for visual consistency. |

---

## 4. File Modification Checklist

### New files
- [ ] `src/components/ledger/shared/ledgerProfileRows.ts` — row model, totals, mill-header resolver (pure functions)
- [ ] `src/hooks/useLedgerProfileRows.ts` — store → rows hook
- [ ] `src/components/ledger/shared/pdf/LedgerOverviewPdf.tsx` — `@react-pdf/renderer` template
- [ ] `src/components/ledger/shared/pdf/generateLedgerOverviewPdf.tsx` — build blob + `saveAs`
- [ ] `src/components/ledger/shared/LedgerOverviewPdfButton.tsx` — shared "Generate PDF" button
- [ ] `src/lib/ledgerIdentityAudit.ts` — DEV-only read-only audit + dry-run-by-default mechanical fixer

### Modified files
- [ ] `src/stores/useLedgerStore.ts` — normalise ids on read, entries-owner tracking, stale-listener guard
- [ ] `src/services/ledgerProfileService.ts` — normalise `id: doc.id` on reads; add `syncLedgerProfileName`
- [ ] `src/services/supplierService.ts` — call `syncLedgerProfileName` on rename
- [ ] `src/services/customerService.ts` — same
- [ ] `src/services/miscellaneousService.ts` — same (if an update function exists)
- [ ] `src/components/ledger/supplier/profiles/SupplierProfilesTab.tsx` — ID-based selection + PDF button
- [ ] `src/components/ledger/customer/profiles/CustomerProfilesTab.tsx` — same
- [ ] `src/components/ledger/miscellaneous/<ProfilesTabFile>.tsx` — same (locate via A4)
- [ ] `src/components/ledger/shared/LedgerProfileDetail.tsx` — derive header from props, resync on id change, entries-owner guard, unsubscribe on unmount
- [ ] `src/main.tsx` — DEV-only registration of the audit tool

---

## 5. Step-by-Step Execution

### Phase 0 — Static inspection (no edits)

Run and read the results; then write **one paragraph per tab** in your Final Report stating exactly how rows are built and how the click selects a profile, and which of H1–H6 you confirmed (cite `file:line`).

```bash
grep -n "useState\|onClick\|\.map(\|\.find(\|\.filter(\|key=" src/components/ledger/supplier/profiles/SupplierProfilesTab.tsx
grep -n "useState\|onClick\|\.map(\|\.find(\|\.filter(\|key=" src/components/ledger/customer/profiles/CustomerProfilesTab.tsx
grep -rln "LedgerProfileDetail" src/components
grep -rn "as LedgerProfile" src
grep -rn "localProfile.entityName\|profile.entityName\|entityName" src/components/ledger
grep -rn "getLedgerProfile(" src
grep -rn "\[idx\]\|\[index\]\|\[i\]" src/components/ledger
```

Also read `src/stores/useLedgerStore.ts`, `src/services/ledgerProfileService.ts` (`getLedgerProfilesByType`, `getLedgerProfile`), and `src/types/ledger-profile.ts`.

**STOP-AND-NOTE:** if `getLedgerProfile(entityId)` queries by `entityId` **without** filtering `entityType`, do **not** change it; just list it under "Observations" in the Final Report.

---

### Phase 1 — Shared row model (single source of truth)

**Design rule:** a list row is built from **one `LedgerProfile` object**. Its name, balance, ID and click payload can never disagree because they are the same object. Selection is stored as a **string profile doc ID**, never an object or index. The list is derived from the profile map (not joined with the entity master).

#### 1.1 CREATE `src/components/ledger/shared/ledgerProfileRows.ts`

```ts
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
  return Array.from(byId.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
      numeric: true,
    })
  );
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
```

#### 1.2 CREATE `src/hooks/useLedgerProfileRows.ts`

> ⚠️ **Zustand 5 trap:** never return `Object.values(...)`/`.map(...)` from inside the selector — a new array each call causes an infinite render loop. Select the **stable map reference**, derive with `useMemo`.

```ts
import { useMemo } from "react";
import { useLedgerStore } from "@/stores/useLedgerStore"; // match existing import style (A1)
import {
  buildProfileRows,
  type LedgerProfileRow,
} from "@/components/ledger/shared/ledgerProfileRows";
import type { EntityType } from "@/types/ledger-profile";

export function useLedgerProfileRows(entityType: EntityType): LedgerProfileRow[] {
  const profileMap = useLedgerStore((s) =>
    entityType === "supplier"
      ? s.supplierProfiles
      : entityType === "customer"
      ? s.customerProfiles
      : s.miscellaneousProfiles
  );
  return useMemo(() => buildProfileRows(profileMap), [profileMap]);
}
```

**Checkpoint:** `npx tsc --noEmit && npm run lint`.

---

### Phase 2 — Zustand / Service layer hardening

#### 2.1 `src/services/ledgerProfileService.ts` — never trust the stored `id` field; guard duplicate `entityId`

Everywhere a `LedgerProfile` is read from a snapshot (`getLedgerProfile`, `getLedgerProfilesByType`, and any `.data() as LedgerProfile` found in Phase 0), replace with a doc-ID-normalised copy.

```diff
- const profile = docSnap.data() as LedgerProfile;
+ const profile: LedgerProfile = { ...(docSnap.data() as LedgerProfile), id: docSnap.id }; // doc ID is the truth
```

`getLedgerProfilesByType` — apply this shape (adapt to the existing query):

```ts
const snap = await getDocs(
  query(collection(db, "ledgerProfiles"), where("entityType", "==", entityType))
);
const result: Record<string, LedgerProfile> = {};
snap.docs.forEach((d) => {
  const profile: LedgerProfile = { ...(d.data() as LedgerProfile), id: d.id };
  if (!profile.entityId) {
    console.error("[ledger] profile without entityId", d.id);
    return;
  }
  const existing = result[profile.entityId];
  if (existing) {
    console.error(
      `[ledger] DUPLICATE profiles for ${entityType}:${profile.entityId}`,
      existing.id,
      profile.id
    );
    // keep the one that follows the documented convention `${entityType}_${entityId}`
    if (existing.id === `${entityType}_${profile.entityId}`) return;
  }
  result[profile.entityId] = profile;
});
return result;
```

ADD this function (imports `writeBatch`, `serverTimestamp`, `where`, `query`, `getDocs`, `collection` from `firebase/firestore` only if not already imported):

```ts
/** Keep the denormalised ledgerProfiles.entityName in sync when an entity is renamed. */
export async function syncLedgerProfileName(
  entityType: EntityType,
  entityId: string,
  entityName: string
): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, "ledgerProfiles"),
      where("entityType", "==", entityType),
      where("entityId", "==", entityId)
    )
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) =>
    batch.update(d.ref, { entityName, updatedAt: serverTimestamp() })
  );
  await batch.commit();
}
```

#### 2.2 Rename sync in entity services

In `supplierService.updateSupplier`, `customerService.updateCustomer`, and the misc update function (if any): after the entity document update succeeds, add:

```ts
if (typeof updates.name === "string" && updates.name.trim()) {
  try {
    await syncLedgerProfileName("supplier", supplierId, updates.name.trim()); // "customer" / "miscellaneous" in the others
  } catch (err) {
    console.error("[ledger] failed to sync profile name", err);
  }
}
```
Use the actual parameter names of each function. Do not change function signatures or return types.

#### 2.3 `src/stores/useLedgerStore.ts` — entries-owner tracking + stale-listener guard

Add to the `LedgerStore` interface and initial state:

```ts
/** Which profileId the current `activeProfileEntries` belong to (null until first snapshot). */
activeProfileEntriesFor: string | null;
```
(initial value `null`).

Replace `subscribeToProfileEntries` and update `unsubscribeFromProfileEntries` (keep any extra behaviour the existing versions have):

```ts
subscribeToProfileEntries: (profileId: string) => {
  get().unsubscribeFromProfileEntries();
  // Drop the previous profile's rows immediately so they can never be shown for the new profile.
  set({ activeProfileEntries: [], activeProfileEntriesFor: null });

  const q = query(
    collection(db, "ledgerProfiles", profileId, "entries"),
    orderBy("date", "asc"),
    orderBy("createdAt", "asc")
  );

  const unsub = onSnapshot(
    q,
    (snap) => {
      set({
        activeProfileEntries: snap.docs.map(
          (d) => ({ ...(d.data() as LedgerEntry), id: d.id })
        ),
        activeProfileEntriesFor: profileId, // set atomically with the entries
      });
    },
    (err) => console.error("[ledger] entries listener error", profileId, err)
  );
  set({ activeProfileUnsubscribe: unsub });
},

unsubscribeFromProfileEntries: () => {
  const unsub = get().activeProfileUnsubscribe;
  if (unsub) unsub();
  set({
    activeProfileUnsubscribe: null,
    activeProfileEntries: [],
    activeProfileEntriesFor: null,
  });
},
```

Also in `fetchCustomersData / fetchSuppliersData / fetchMiscellaneousData`:
1. Ensure every profile put in the maps has `id` = Firestore doc ID (via the normalised service functions above).
2. **(A7)** If the fetch currently sets the profile map to `{}` before refilling, remove that intermediate `set`; replace the map in **one** `set()` so an open detail never unmounts during a refresh.
3. Do not change public signatures (`fetch*Data(force?)`).

**Checkpoint:** `npx tsc --noEmit && npm run lint`.

---

### Phase 3 — Fix the bug in the three tabs + the detail view

#### 3.1 Tab pattern (apply to Supplier, Customer, Miscellaneous)

Files:
- `src/components/ledger/supplier/profiles/SupplierProfilesTab.tsx` → `entityType = "supplier"`
- `src/components/ledger/customer/profiles/CustomerProfilesTab.tsx` → `entityType = "customer"`
- misc tab file (A4) → `entityType = "miscellaneous"`

**Expected BEFORE (any of these shapes are the defect; adapt):**
```tsx
// (a) selection stored as object/entity/index
const [selected, setSelected] = useState<LedgerProfile | Supplier | number | null>(null);
// (b) list joined from entity master + profile map
{suppliers.filter(matches).map((s, idx) => (
  <tr key={idx} onClick={() => setSelected(supplierProfiles[s.supplierId] /* or arr[idx] */)}>
    <td>{s.name}</td><td>{fmtBalance(supplierProfiles[s.supplierId]?.closingBalance)}</td>
```

**AFTER (canonical):**
```tsx
import { useLedgerProfileRows } from "@/hooks/useLedgerProfileRows";

const rows = useLedgerProfileRows("supplier");                    // ALL rows, unfiltered
const [search, setSearch] = useState("");
const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

const visibleRows = useMemo(() => {
  const q = search.trim().toLowerCase();
  return q ? rows.filter((r) => r.displayName.toLowerCase().includes(q)) : rows;
}, [rows, search]);

const selectedRow = useMemo(
  () => rows.find((r) => r.profileId === selectedProfileId) ?? null,
  [rows, selectedProfileId]
);

if (selectedRow) {
  return (
    <LedgerProfileDetail
      key={selectedRow.profileId}            // forces a fresh instance per profile
      profile={selectedRow.profile}          // the SAME object the row was built from
      /* ...keep every other existing prop and the existing back-navigation exactly as-is,
         but make "back" call setSelectedProfileId(null) */
    />
  );
}

// list JSX — keep existing markup/classes, change only the data bindings:
{visibleRows.map((row) => (
  <tr
    key={row.profileId}
    onClick={() => setSelectedProfileId(row.profileId)}
  >
    <td>{row.displayName}</td>
    <td>{/* reuse the existing Dr/Cr formatter/colours, fed with row.balance */}</td>
  </tr>
))}
```

Rules:
- Keep the existing search behaviour (substring, case-insensitive — note "swa" matches "BRINDABAN GOSWAMI") but match on `row.displayName`.
- Keep the existing Dr/Cr rendering (`Dr` red when balance ≥ 0, `Cr` green when < 0 — verify against current code and copy it; do **not** change accounting semantics).
- Delete the old selection state/variables so no code path can still select by object/index.
- Remove any now-unused imports/variables (lint).
- If the tab uses `useLedgerStore` to trigger `fetch*Data()` on mount, keep that.
- If the tab previously listed entities that have **no** profile, they will no longer appear (Phase 4 audit reports them as `ENTITY_WITHOUT_PROFILE`). Do not auto-create profiles.

#### 3.2 `src/components/ledger/shared/LedgerProfileDetail.tsx`

**(a) Header/name/filename come from props, not from seeded local state.**
```diff
- {localProfile.entityName}
+ {profile.entityName}
```
Apply to the heading, the `LedgerProfilePdf` `entityName` argument, the `ledger_{EntityName}.pdf` filename, and any toast text (`grep -n "entityName" LedgerProfileDetail.tsx`). `localProfile` remains only for optimistic **totals**.

**(b) Subscription effect: resync on profile change + unsubscribe on unmount.**

BEFORE:
```ts
useEffect(() => {
  setLoading(true);
  hasInitializedDates.current = false;
  subscribeToProfileEntries(profile.id);
}, [profile.id, subscribeToProfileEntries]);
```
AFTER:
```ts
const unsubscribeFromProfileEntries = useLedgerStore((s) => s.unsubscribeFromProfileEntries);
const entriesOwnerId = useLedgerStore((s) => s.activeProfileEntriesFor);

useEffect(() => {
  setLoading(true);
  hasInitializedDates.current = false;
  setLocalProfile(profile);
  setMillName(profile.millName);
  setMillDesc(profile.millDescription);
  setDateFrom("");
  setDateTo("");
  subscribeToProfileEntries(profile.id);
  return () => {
    unsubscribeFromProfileEntries();
  };
  // Intentionally keyed on profile.id only: re-running when the store refreshes the same profile
  // would wipe optimistic totals and the user's date range.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [profile.id, subscribeToProfileEntries, unsubscribeFromProfileEntries]);
```
(Use the same store-access style already used in the file for `subscribeToProfileEntries`.)

**(c) Entries-owner guard** — locate the `useEffect` that consumes `activeProfileEntries` (sorts, filters `bags_divided*`, auto-inits dates, calls `setLoading(false)`). Insert as its **first statement** and add `entriesOwnerId` and `profile.id` to its dependency array:
```ts
if (entriesOwnerId !== profile.id) return; // store rows belong to another profile (or not loaded yet)
```
This keeps `loading === true` until entries for **this** profile arrive, and guarantees the auto date-range is computed from the correct ledger. A profile with zero entries still resolves because the snapshot listener fires with an empty array and sets `activeProfileEntriesFor`.

**Checkpoint:** `npx tsc --noEmit && npm run lint`. Manual test of the bug now (see §7, tests T1–T4).

---

### Phase 4 — Identity audit (read-only) + guarded mechanical fixer

Purpose: tell the human whether the **data** is corrupt (H1/H2/H6) after the code is fixed. Read-only by default; dry-run by default; DEV-only.

#### 4.1 CREATE `src/lib/ledgerIdentityAudit.ts`

> Miscellaneous entity field names: open `src/types/miscellaneous.ts` (A4) and replace `MISC_ID` / `MISC_NAME` below with the real field names (e.g. `miscellaneousId`, `name`).

```ts
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLedgerStore } from "@/stores/useLedgerStore"; // match existing import style
import type { EntityType, LedgerEntry, LedgerProfile } from "@/types/ledger-profile";

export type AuditCode =
  | "ID_FIELD_MISMATCH"          // stored `id` field != Firestore doc id            (mechanical fix)
  | "ID_CONVENTION_MISMATCH"     // doc id != `${entityType}_${entityId}`            (report only)
  | "DUPLICATE_ENTITY_PROFILE"   // 2+ profile docs for same (entityType, entityId)  (HUMAN)
  | "ORPHAN_PROFILE"             // profile whose entity master does not exist       (HUMAN)
  | "ENTITY_WITHOUT_PROFILE"     // entity master with no profile                    (report only)
  | "NAME_COSMETIC_DRIFT"        // same name ignoring case/asterisks/spaces         (mechanical fix)
  | "NAME_MATERIAL_MISMATCH"     // entirely different names                         (HUMAN)
  | "ENTRY_OWNER_MISMATCH";      // entries reference a different entityId/profileId(HUMAN)

export interface AuditIssue {
  code: AuditCode;
  profileDocId: string;
  entityType: EntityType;
  entityId: string;
  profileName: string;
  masterName: string;
  detail: string;
  autoFix?: { field: "id" | "entityName"; value: string };
}

const normName = (s: string) =>
  s.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export async function auditLedgerIdentity(
  opts: { sampleEntries?: boolean } = {}
): Promise<AuditIssue[]> {
  const st = useLedgerStore.getState();
  await Promise.all([
    st.fetchSuppliersData(true),
    st.fetchCustomersData(true),
    st.fetchMiscellaneousData(true),
  ]);
  const fresh = useLedgerStore.getState();

  const masters = new Map<string, string>(); // "type:id" -> master name
  fresh.suppliers.forEach((s) => masters.set(`supplier:${s.supplierId}`, s.name));
  fresh.customers.forEach((c) => masters.set(`customer:${c.customerId}`, c.name));
  fresh.miscellaneous.forEach((m) => masters.set(`miscellaneous:${m.MISC_ID}`, m.MISC_NAME));

  const snap = await getDocs(collection(db, "ledgerProfiles"));
  const issues: AuditIssue[] = [];
  const firstDocByKey = new Map<string, string>();
  const profileKeys = new Set<string>();

  for (const d of snap.docs) {
    const p = d.data() as LedgerProfile;
    const key = `${p.entityType}:${p.entityId}`;
    profileKeys.add(key);
    const master = masters.get(key);
    const base = {
      profileDocId: d.id,
      entityType: p.entityType,
      entityId: p.entityId,
      profileName: p.entityName ?? "",
      masterName: master ?? "",
    };

    if (p.id !== d.id) {
      issues.push({ ...base, code: "ID_FIELD_MISMATCH",
        detail: `stored id="${p.id}" but doc id="${d.id}"`,
        autoFix: { field: "id", value: d.id } });
    }
    if (d.id !== `${p.entityType}_${p.entityId}`) {
      issues.push({ ...base, code: "ID_CONVENTION_MISMATCH",
        detail: `expected doc id "${p.entityType}_${p.entityId}"` });
    }
    const firstDoc = firstDocByKey.get(key);
    if (firstDoc) {
      issues.push({ ...base, code: "DUPLICATE_ENTITY_PROFILE",
        detail: `also present as doc "${firstDoc}"` });
    } else {
      firstDocByKey.set(key, d.id);
    }

    if (master === undefined) {
      issues.push({ ...base, code: "ORPHAN_PROFILE", detail: "no matching entity master document" });
    } else if (master !== (p.entityName ?? "")) {
      const cosmetic = normName(master) === normName(p.entityName ?? "");
      issues.push({
        ...base,
        code: cosmetic ? "NAME_COSMETIC_DRIFT" : "NAME_MATERIAL_MISMATCH",
        detail: `master="${master}" profile="${p.entityName}"`,
        autoFix: cosmetic ? { field: "entityName", value: master } : undefined,
      });
    }

    if (opts.sampleEntries) {
      const es = await getDocs(query(collection(db, "ledgerProfiles", d.id, "entries"), limit(25)));
      const bad = es.docs.filter((e) => {
        const x = e.data() as LedgerEntry;
        return x.entityId !== p.entityId || x.profileId !== d.id;
      }).length;
      if (bad > 0) {
        issues.push({ ...base, code: "ENTRY_OWNER_MISMATCH",
          detail: `${bad} of ${es.size} sampled entries reference a different entityId/profileId` });
      }
    }
  }

  masters.forEach((name, key) => {
    if (profileKeys.has(key)) return;
    const sep = key.indexOf(":");
    issues.push({
      code: "ENTITY_WITHOUT_PROFILE",
      profileDocId: "",
      entityType: key.slice(0, sep) as EntityType,
      entityId: key.slice(sep + 1),
      profileName: "",
      masterName: name,
      detail: "entity has no ledger profile",
    });
  });

  console.table(issues.map(({ autoFix, ...rest }) => ({ ...rest, autoFix: autoFix ? `${autoFix.field} → ${autoFix.value}` : "" })));
  console.info(`[ledger-audit] ${issues.length} issue(s) across ${snap.size} profile(s).`);
  return issues;
}

/** Applies ONLY mechanical fixes, and skips any profile that also has a HUMAN-review issue. Dry run unless dryRun:false. */
export async function applyMechanicalFixes(
  issues: AuditIssue[],
  opts: { dryRun?: boolean } = {}
): Promise<number> {
  const dryRun = opts.dryRun !== false;
  const blocking: AuditCode[] = [
    "ENTRY_OWNER_MISMATCH", "DUPLICATE_ENTITY_PROFILE", "NAME_MATERIAL_MISMATCH", "ORPHAN_PROFILE",
  ];
  const blocked = new Set(issues.filter((i) => blocking.includes(i.code)).map((i) => i.profileDocId));

  const updates = new Map<string, Record<string, string>>();
  issues.forEach((i) => {
    if (!i.autoFix || blocked.has(i.profileDocId)) return;
    const u = updates.get(i.profileDocId) ?? {};
    u[i.autoFix.field] = i.autoFix.value;
    updates.set(i.profileDocId, u);
  });

  console.table(Array.from(updates.entries()).map(([id, u]) => ({ profileDocId: id, ...u })));
  if (dryRun) {
    console.info(`[ledger-audit] DRY RUN: ${updates.size} profile(s) would be updated. Pass { dryRun:false } to apply.`);
    return updates.size;
  }
  const entries = Array.from(updates.entries());
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    entries.slice(i, i + 400).forEach(([id, u]) =>
      batch.update(doc(db, "ledgerProfiles", id), { ...u, updatedAt: serverTimestamp() })
    );
    await batch.commit();
  }
  console.info(`[ledger-audit] updated ${updates.size} profile(s).`);
  return updates.size;
}

declare global {
  interface Window {
    __ledgerAudit?: {
      audit: typeof auditLedgerIdentity;
      fix: typeof applyMechanicalFixes;
    };
  }
}
```

#### 4.2 `src/main.tsx` — DEV-only registration (append near the end, before/after `createRoot(...).render(...)`)

```ts
if (import.meta.env.DEV) {
  void import("@/lib/ledgerIdentityAudit").then((m) => {
    window.__ledgerAudit = { audit: m.auditLedgerIdentity, fix: m.applyMechanicalFixes };
  });
}
```

#### 4.3 Human runbook (include verbatim in the Final Report)
In `npm run dev`, DevTools console:
```js
const issues = await __ledgerAudit.audit({ sampleEntries: true }); // read-only (reads ≈ #profiles × ≤25)
await __ledgerAudit.fix(issues);                                    // DRY RUN – prints what would change
// Only after reviewing: await __ledgerAudit.fix(issues, { dryRun: false });
```

| Audit code | Meaning | Action |
|---|---|---|
| `ID_FIELD_MISMATCH`, `NAME_COSMETIC_DRIFT` | Safe, mechanical | Run `fix(..., {dryRun:false})` after reviewing dry run. (Cosmetic sync will make profile names equal the master names, e.g. `Manik mondal` → `MANIK MONDAL **`.) |
| `NAME_MATERIAL_MISMATCH`, `ENTRY_OWNER_MISMATCH`, `DUPLICATE_ENTITY_PROFILE`, `ORPHAN_PROFILE` | Possible mis-posted ledger data | **Human review. Do not auto-fix.** Compare deal/order `supplierId`/`customerId` against the profile the entries landed in before re-linking anything. |
| `ENTITY_WITHOUT_PROFILE` | Entity invisible in the new list | Decide whether to `ensureLedgerProfile(...)`. |
| `ID_CONVENTION_MISMATCH` | Legacy doc IDs | Report only. |

---

### Phase 5 — Overview PDF (template, generator, button)

**Data contract:** rows come from `useLedgerProfileRows(entityType)` → built from `useLedgerStore` profile aggregates (`totalDebit`, `totalCredit`, `closingBalance`). The PDF covers **all** entities in the category (ignores the search box) and shows **current** balances (not date-filtered). Ordering = on-screen order.

**Font caveat (A6):** `@react-pdf/renderer`'s built-in Helvetica has **no ₹ glyph**. The existing ledger PDF prints plain `1,37,027.00`. Follow that: **never print `₹`** in this PDF; use `Rs.` in text. If `Font.register` exists in the codebase you may reuse that font, but still avoid `₹` unless it is confirmed to render.

#### 5.1 CREATE `src/components/ledger/shared/pdf/LedgerOverviewPdf.tsx`

Pagination is done **explicitly in chunks** (deterministic; does not rely on `fixed` header semantics). Row height is fixed (20pt) and names are truncated to avoid wrapping.

```tsx
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { EntityType } from "@/types/ledger-profile";
import { summarizeRows } from "@/components/ledger/shared/ledgerProfileRows";

export interface LedgerOverviewPdfRow {
  name: string;
  totalDebit: number;
  totalCredit: number;
  balance: number; // >= 0 → Dr, < 0 → Cr
}

export interface LedgerOverviewPdfProps {
  entityType: EntityType;
  rows: LedgerOverviewPdfRow[];
  millName: string;
  millDescription?: string;
  millContact?: string;
  generatedOn: string; // pre-formatted, e.g. "21-Sep-26"
}

const TITLES: Record<EntityType, string> = {
  supplier: "Supplier Ledger Overview",
  customer: "Customer Ledger Overview",
  miscellaneous: "Miscellaneous Ledger Overview",
};
const NAME_HEADER: Record<EntityType, string> = {
  supplier: "Supplier Name",
  customer: "Customer Name",
  miscellaneous: "Account Name",
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
  colNum: { width: "20%", textAlign: "right" },
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
              <View key={`${startIndex + i}`} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
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
```
If TypeScript rejects `textAlign: "right"` inside `StyleSheet.create` typing, cast that literal (`"right" as const`). If `style={[..., {}]}` fails typing, use `i % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row`.

#### 5.2 CREATE `src/components/ledger/shared/pdf/generateLedgerOverviewPdf.tsx`

```tsx
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
```

#### 5.3 CREATE `src/components/ledger/shared/LedgerOverviewPdfButton.tsx`

Copy the **exact** className of the existing "Export PDF" button in `LedgerProfileDetail.tsx` (A9) into `BUTTON_CLASS` below (the value shown is only a fallback). Use the toast library found in A2.

```tsx
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast"; // or: import { toast } from "sonner";  (A2)
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
```

**Checkpoint:** `npx tsc --noEmit && npm run lint`.

---

### Phase 6 — Wire the button into the three tabs

In each tab from Phase 3, wrap the existing heading ("Supplier Ledger Profiles" / "Customer Ledger Profiles" / misc equivalent) in a flex row and add the button on the right. Keep the existing heading element and classes.

```tsx
import { LedgerOverviewPdfButton } from "@/components/ledger/shared/LedgerOverviewPdfButton";

<div className="flex items-center justify-between gap-3">
  {/* existing <h2>…Ledger Profiles</h2> unchanged */}
  <LedgerOverviewPdfButton entityType="supplier" rows={rows} />   {/* "customer" / "miscellaneous" */}
</div>
```
Pass **`rows`** (unfiltered), never `visibleRows`.

**Checkpoint:** `npx tsc --noEmit && npm run lint && npm run build`.

---

## 6. Zustand / Service Layer Summary

| Item | File | Change |
|---|---|---|
| Doc-ID-normalised profile reads | `ledgerProfileService.ts`, store fetchers | `{ ...data, id: docSnap.id }` everywhere; duplicate-`entityId` guard in `getLedgerProfilesByType` |
| New store field | `useLedgerStore.ts` | `activeProfileEntriesFor: string \| null` |
| Entries listener | `useLedgerStore.ts` | clear on subscribe/unsubscribe; `id: d.id` on entries; listener error handler |
| New selector logic for PDF data | **none in the store** | Deliberately a pure `buildProfileRows` + `useLedgerProfileRows` (stable-reference select + `useMemo`) so store shape is unchanged and Zustand 5 loop trap is avoided |
| New service fn | `ledgerProfileService.ts` | `syncLedgerProfileName(entityType, entityId, entityName)` |
| Entity services | supplier/customer/misc | call `syncLedgerProfileName` after a successful rename |

---

## 7. Verification

### Static
```bash
npx tsc --noEmit
npm run lint          # must pass with --max-warnings 0
npm run build
```

### Manual test matrix (run with `npm run dev`)

| ID | Steps | Expected |
|---|---|---|
| T1 | Ledger → Supplier → Ledger Profiles → search `mani` → click the row. | Detail header text equals the row's name; entries load for that profile. |
| T2 | Back → search `swa` → click `SWAPAN SK …`. | Same as T1 for Swapan. |
| T3 | Open 10 different rows in each of the 3 tabs, using Back between each. | Header always equals the clicked row. |
| T4 | Open A, Back, open B quickly. | No flash of A's entries in B; date range corresponds to B. |
| T5 | In detail: add a manual entry / edit an amount. | Sidebar/list balance updates; detail stays open (A7). |
| T6 | Rename a supplier (Deals → Supplier Manager). | Ledger list + detail show the new name after refresh (rename sync). |
| T7 | Each tab → **Generate PDF**. | File `Ledger_Overview_<Type>_<yyyy-MM-dd>.pdf` downloads. Lists **every** profile (search box text ignored), columns Total Debit / Total Credit / Outstanding (Dr/Cr), grand-total bar, page numbers. |
| T8 | Check PDF grand totals. | Total Debit = Σ rows; Total Credit = Σ rows; Net = Σ signed balances (Dr − Cr). |
| T9 | Category with > 50 profiles. | Multiple pages; header row repeated on each page; totals bar on last page only; no overflow. |
| T10 | Empty category. | Button disabled; no crash. |
| T11 | Existing per-profile "Export PDF" & "PDF Heading" in detail. | Still work; filename uses the same name as the list row. |
| T12 | DEV console: run the §4.3 runbook (dry run only). | Table of issues printed; no writes. |

### Definition of Done
- [ ] T1–T12 pass (T12 by the human).
- [ ] `tsc`, `lint`, `build` clean.
- [ ] No selection by object/index remains in any Ledger Profiles tab (`grep -rn "\[idx\]\|\[index\]" src/components/ledger` shows none relevant).
- [ ] `LedgerProfileDetail` is rendered with `key={row.profileId}` in all three tabs.

---

## 8. Expected Visible Changes (tell the user)
1. List row names now come from the **profile's own `entityName`**, the same string the detail header and PDFs use. If the list previously showed the entity-master name (e.g. with trailing `**`) and the profile stores a cosmetically different name, the text may change until the human runs the cosmetic sync (§4.3).
2. Entities without a ledger profile no longer appear in the list (they are reported by the audit).
3. Opening a ledger briefly shows the loading state until *that* profile's entries arrive (previously it could flash the previous ledger).

## 9. Out of Scope
Changing accounting semantics (Dr/Cr rules), `firestore.rules`, the legacy `supplierLedgerEntries`, Salary tab, auto-repairing mis-posted entries, non-Latin (e.g. Bengali) glyph support in the new PDF (Helvetica; register a font as the existing PDFs do if names ever need it).

## 10. Final Report (output this when done)
1. Files created/modified (checklist from §4, ticked).
2. Results of `tsc`, `lint`, `build`.
3. **Phase 0 findings:** per tab, the exact defective code (`file:line`) and which of H1–H6 were confirmed.
4. Answers to A1–A9.
5. Any deviations from this plan and why.
6. The §2.4 discriminating check and the §4.3 runbook, verbatim, for the human.
7. Observations (e.g. `getLedgerProfile(entityId)` lacking an `entityType` filter).
