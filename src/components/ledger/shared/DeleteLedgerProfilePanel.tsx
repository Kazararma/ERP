"use client";

import { useState } from "react";
import { LedgerProfile } from "@/types/ledger-profile";
import { getLedgerEntryCount } from "@/services/ledgerProfileService";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { useUiStore } from "@/stores/uiStore";
import toast from "react-hot-toast";

interface Props {
  profile: LedgerProfile;
  allProfiles: LedgerProfile[];
  onDeleted?: () => void;
}

export function DeleteLedgerProfilePanel({ profile, allProfiles, onDeleted }: Props) {
  const [loading, setLoading] = useState(false);
  
  const duplicateNameProfiles = allProfiles.filter(p => 
    p.entityName.trim().toLowerCase() === profile.entityName.trim().toLowerCase() && 
    p.id !== profile.id
  );
  
  const hasDuplicates = duplicateNameProfiles.length > 0;
  
  const handleDelete = async () => {
    try {
      setLoading(true);
      
      const count = await getLedgerEntryCount(profile.id);
      
      const confirm1 = await useUiStore.getState().requestConfirm(
        "Delete Ledger Profile",
        `Are you sure you want to delete the ledger profile for "${profile.entityName}"?\n\nIt currently has ${count} entry records.\nThis action CANNOT be undone.`
      );
      
      if (!confirm1) return;
      
      const confirm2 = await useUiStore.getState().requestConfirm(
        "Final Warning",
        "Type 'yes' in your mind... Just kidding. But seriously, this will wipe all ledger records for this profile. Are you absolutely certain?"
      );
      
      if (!confirm2) return;
      
      await useLedgerStore.getState().deleteProfile(profile.entityType, profile.id);
      toast.success("Ledger profile deleted successfully");
      
      if (onDeleted) onDeleted();
      
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to delete profile");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="mt-6 pt-6 border-t border-red-100 bg-red-50/30 p-4 rounded-xl">
      <h3 className="text-red-800 font-bold mb-2 text-sm uppercase tracking-wider">Danger Zone</h3>
      <p className="text-slate-600 text-sm mb-4">
        Deleting this profile will permanently remove all of its ledger entries.
      </p>
      
      {hasDuplicates && (
        <div className="mb-4 bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200 text-sm">
          <p className="font-bold mb-1">Duplicate Name Detected</p>
          <p>
            There is another profile with the name "{profile.entityName}". You might be looking to delete this one to resolve the duplication.
          </p>
        </div>
      )}
      
      <button 
        onClick={handleDelete} 
        disabled={loading}
        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
      >
        {loading && <div className="w-4 h-4 border-2 border-red-700 border-t-transparent rounded-full animate-spin"></div>}
        {loading ? "Deleting..." : "Delete Profile"}
      </button>
    </div>
  );
}
