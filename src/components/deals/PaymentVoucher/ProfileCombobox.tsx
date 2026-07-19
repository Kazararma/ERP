import { useEffect, useState, useMemo } from "react";
import { LedgerProfile } from "@/types/ledger-profile";
import { getLedgerProfilesByType } from "@/services/ledgerProfileService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileComboboxProps {
  entityType: 'supplier' | 'customer';
  value: string;
  onChange: (profileId: string, profile: LedgerProfile) => void;
}

export function ProfileCombobox({ entityType, value, onChange }: ProfileComboboxProps) {
  const [profiles, setProfiles] = useState<LedgerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    getLedgerProfilesByType(entityType)
      .then((data) => {
        setProfiles(Object.values(data));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [entityType]);

  const selectedProfile = value ? profiles.find((p) => p.id === value) : undefined;
  
  const filteredProfiles = useMemo(() => {
    if (!search) return profiles;
    return profiles.filter((p) => 
      p.entityName.toLowerCase().includes(search.toLowerCase())
    );
  }, [profiles, search]);

  return (
    <div className="flex flex-col gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none h-8 gap-1.5 px-2.5",
            "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
            "w-full justify-between bg-white border-slate-200",
            loading ? "pointer-events-none opacity-50" : ""
          )}
          disabled={loading}
        >
          {selectedProfile ? selectedProfile.entityName : `Select a ${entityType}...`}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[300px] sm:w-[400px] p-0 bg-white z-50">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder={`Search ${entityType}...`} 
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading ? (
                <div className="p-4 text-center text-sm text-slate-500">Loading {entityType}s...</div>
              ) : filteredProfiles.length === 0 ? (
                <CommandEmpty>No {entityType}s found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredProfiles.map((profile) => (
                    <CommandItem
                      key={profile.id}
                      value={profile.id}
                      onSelect={() => {
                        onChange(profile.id, profile);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === profile.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {profile.entityName}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedProfile && (
        <div className="flex justify-between items-center text-xs p-3 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex flex-col">
            <span className="text-slate-500 font-bold uppercase tracking-wider mb-0.5">Total Debit</span>
            <span className="font-black text-slate-800">₹{selectedProfile.totalDebit.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 font-bold uppercase tracking-wider mb-0.5">Total Credit</span>
            <span className="font-black text-slate-800">₹{selectedProfile.totalCredit.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-500 font-bold uppercase tracking-wider mb-0.5">Closing Bal</span>
            <span className={`font-black ${selectedProfile.closingBalance > 0 ? 'text-rose-600' : selectedProfile.closingBalance < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
              ₹{Math.abs(selectedProfile.closingBalance).toLocaleString()}
              {selectedProfile.closingBalance > 0 && entityType === 'supplier' ? ' (Cr)' : ''}
              {selectedProfile.closingBalance > 0 && entityType === 'customer' ? ' (Cr)' : ''}
              {selectedProfile.closingBalance < 0 && entityType === 'supplier' ? ' (Dr)' : ''}
              {selectedProfile.closingBalance < 0 && entityType === 'customer' ? ' (Dr)' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
