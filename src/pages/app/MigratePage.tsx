"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, writeBatch, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRiceTypes } from "@/hooks/useRiceTypes";
import { migrateStagingBatchesToBagDivisions, backfillSupplierLedgerEntries, patchInventoryOverwrites, clearCollection } from "@/services/migrationService";
import { RiceType } from "@/types/riceTypes";
import toast from "react-hot-toast";
import { useUiStore } from "@/stores/uiStore";

export default function MigratePage() {
  const { riceTypes, loading: riceTypesLoading } = useRiceTypes();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>("");

  const fetchLegacyDeals = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "deals"));
    const legacy = snap.docs.map(d => ({ ...d.data(), id: d.id })).filter((d: any) => !d.product);
    setDeals(legacy);
    setLoading(false);
  };

  useEffect(() => {
    fetchLegacyDeals();
  }, []);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const handleMigrateDeal = async (deal: any, index: number) => {
    const code = (document.getElementById(`code-${deal.id}`) as HTMLInputElement)?.value;
    const name = (document.getElementById(`name-${deal.id}`) as HTMLInputElement)?.value;
    const typeId = (document.getElementById(`type-${deal.id}`) as HTMLSelectElement)?.value;

    if (!code || !name || !typeId) {
      toast.error("Please fill all fields");
      return;
    }

    const type = riceTypes.find((t: RiceType) => t.riceTypeId === typeId);
    if (!type) return;

    setMigrating(true);
    try {
      const product = {
        productCode: code,
        productName: name,
        riceTypeId: type.riceTypeId,
        riceTypeCode: type.code,
        riceTypeName: type.displayName
      };

      const batch = writeBatch(db);
      batch.update(doc(db, "deals", deal.id), { product });
      batch.update(doc(db, "inventory", deal.id), { product });
      await batch.commit();

      addLog(`Migrated deal ${deal.id} to use product ${code}`);
      setDeals(prev => prev.filter(d => d.id !== deal.id));
    } catch (e: any) {
      addLog(`Error migrating deal ${deal.id}: ${e.message}`);
    }
    setMigrating(false);
  };

  const handleMigrateStaging = async () => {
    setMigrating(true);
    addLog("Starting staging to divisions migration...");
    const { migrated, errors } = await migrateStagingBatchesToBagDivisions();
    addLog(`Migrated ${migrated} staging batches.`);
    if (errors.length) addLog(`Errors: ${errors.join(", ")}`);
    setMigrating(false);
  };

  const handleBackfillLedger = async () => {
    setMigrating(true);
    addLog("Starting supplier ledger backfill...");
    const { written, errors } = await backfillSupplierLedgerEntries();
    addLog(`Wrote ${written} ledger entries.`);
    if (errors.length) addLog(`Errors: ${errors.join(", ")}`);
    setMigrating(false);
  };

  const handlePatchInventory = async () => {
    setMigrating(true);
    addLog("Starting inventory patch...");
    const { patched, errors } = await patchInventoryOverwrites();
    addLog(`Patched ${patched} inventory records.`);
    if (errors.length) addLog(`Errors: ${errors.join(", ")}`);
    setMigrating(false);
  };

  const handleClearCollection = async () => {
    if (!selectedCollection) return;
    const confirm = await useUiStore.getState().requestConfirm("DANGER", `Are you absolutely sure you want to delete up to 500 documents from "${selectedCollection}"? This CANNOT be undone.`);
    if (!confirm) return;
    
    setMigrating(true);
    addLog(`Clearing collection: ${selectedCollection}...`);
    const { deleted, errors } = await clearCollection(selectedCollection);
    addLog(`Deleted ${deleted} documents from ${selectedCollection}.`);
    if (errors.length) addLog(`Errors: ${errors.join(", ")}`);
    setMigrating(false);
  };

  const handleClearAll = async () => {
    const confirm1 = await useUiStore.getState().requestConfirm("SUPER DANGER", `You are about to wipe ALL collections. Are you 100% sure?`);
    if (!confirm1) return;
    const confirm2 = await useUiStore.getState().requestConfirm("FINAL WARNING", `This is a nuclear option. ALL data will be wiped permanently.`);
    if (!confirm2) return;

    setMigrating(true);
    const collectionsToClear = [
      "deals", "inventory", "orders", "customers", "suppliers", 
      "supplierLedgerEntries", "salaryTransactions", "employees", 
      "banks", "riceTypes"
    ];

    for (const col of collectionsToClear) {
      addLog(`Clearing collection: ${col}...`);
      const { deleted, errors } = await clearCollection(col);
      addLog(`Deleted ${deleted} documents from ${col}.`);
      if (errors.length) addLog(`Errors in ${col}: ${errors.join(", ")}`);
    }
    
    addLog(`Wipe operation completed!`);
    setMigrating(false);
  };

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto pb-24">
      <h1 className="text-2xl font-bold">V1 to V2 Data Migration Tool</h1>
      <p className="text-red-500 font-semibold border border-red-200 bg-red-50 p-4 rounded-lg">
        WARNING: Run these operations once. SuperAdmin only.
      </p>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">1. Backfill Product on Deals</h2>
        {loading || riceTypesLoading ? (
          <div>Loading...</div>
        ) : deals.length === 0 ? (
          <div className="text-emerald-600 font-bold">All deals migrated ✓</div>
        ) : (
          <div className="space-y-4">
            {deals.map((deal, i) => (
              <div key={deal.id} className="border p-4 rounded flex gap-4 items-end bg-white">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-bold text-slate-500">Deal ID: {deal.id}</label>
                  <input id={`code-${deal.id}`} placeholder="Product Code" className="w-full border p-2 text-sm rounded" />
                </div>
                <div className="flex-1 space-y-2">
                  <input id={`name-${deal.id}`} defaultValue={deal.productName || ""} placeholder="Product Name" className="w-full border p-2 text-sm rounded" />
                </div>
                <div className="flex-1 space-y-2">
                  <select id={`type-${deal.id}`} className="w-full border p-2 text-sm rounded">
                    <option value="">Select Rice Type...</option>
                    {riceTypes.map((t: RiceType) => <option key={t.riceTypeId} value={t.riceTypeId}>{t.displayName}</option>)}
                  </select>
                </div>
                <button 
                  disabled={migrating}
                  onClick={() => handleMigrateDeal(deal, i)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 border-t pt-8">
        <h2 className="text-xl font-semibold">2. Migrate Staging Batches</h2>
        <p className="text-sm text-slate-600">Renames `stagingBatches` to `bagDivisions` and normalizes bag sizes.</p>
        <button 
          onClick={handleMigrateStaging} disabled={migrating}
          className="bg-purple-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
        >
          Run Staging Migration
        </button>
      </div>

      <div className="space-y-4 border-t pt-8">
        <h2 className="text-xl font-semibold">3. Backfill Supplier Ledger</h2>
        <p className="text-sm text-slate-600">Reconstructs the `supplierLedgerEntries` immutable timeline from historical data.</p>
        <button 
          onClick={handleBackfillLedger} disabled={migrating}
          className="bg-emerald-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
        >
          Run Ledger Backfill
        </button>
      </div>

      <div className="space-y-4 border-t pt-8">
        <h2 className="text-xl font-semibold">4. Patch Inventory Overwrites</h2>
        <p className="text-sm text-slate-600">Reconstructs missing inventory division breakdowns caused by parallel transaction loop bugs.</p>
        <button 
          onClick={handlePatchInventory} disabled={migrating}
          className="bg-blue-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
        >
          Run Inventory Patch
        </button>
      </div>

      <div className="space-y-4 border-t border-red-200 pt-8 bg-red-50/50 p-6 rounded-xl mt-8">
        <h2 className="text-xl font-semibold text-red-700">5. Danger Zone - Clear Data</h2>
        <p className="text-sm text-red-600">Select a collection to securely delete its documents. (Deletes up to 500 documents per click). Note that subcollections (like bagDivisions or allocations) are not automatically deleted when parent documents are deleted.</p>
        <div className="flex gap-4 items-center">
          <select 
            className="flex h-10 w-64 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            value={selectedCollection}
            onChange={e => setSelectedCollection(e.target.value)}
          >
            <option value="">Select collection...</option>
            <option value="deals">deals</option>
            <option value="inventory">inventory</option>
            <option value="orders">orders</option>
            <option value="customers">customers</option>
            <option value="suppliers">suppliers</option>
            <option value="supplierLedgerEntries">supplierLedgerEntries</option>
            <option value="salaryTransactions">salaryTransactions</option>
            <option value="employees">employees</option>
            <option value="banks">banks</option>
            <option value="riceTypes">riceTypes</option>
          </select>
          <button 
            onClick={handleClearCollection} disabled={migrating || !selectedCollection}
            className="bg-red-600 text-white px-4 py-2 rounded font-bold disabled:opacity-50 shadow-md hover:bg-red-700 transition-colors"
          >
            Delete Data
          </button>
          
          <div className="flex-1"></div>
          
          <button 
            onClick={handleClearAll} disabled={migrating}
            className="bg-black text-red-500 border border-red-500 px-6 py-2 rounded font-black disabled:opacity-50 shadow-md hover:bg-red-950 transition-colors uppercase"
          >
            ☢ NUKE ALL DATA
          </button>
        </div>
      </div>

      <div className="border rounded-lg bg-black text-green-400 p-4 font-mono text-sm h-64 overflow-y-auto">
        <div className="opacity-50">Migration Logs...</div>
        {logs.map((log, i) => <div key={i}>{'>'} {log}</div>)}
      </div>
    </div>
  );
}
