import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBalanceSheetStore } from "@/stores/useBalanceSheetStore";
import { BalanceSheetGroup } from "@/types/balanceSheet";

interface RowComboboxProps {
  section: "liabilities" | "assets";
  value: string;
  onChange: (groupKey: string, group: BalanceSheetGroup) => void;
}

export function RowCombobox({ section, value, onChange }: RowComboboxProps) {
  const groups = useBalanceSheetStore((s) => s.groups);

  const filteredGroups = useMemo(() => {
    return groups.filter(g => g.side === section);
  }, [groups, section]);

  const selectedGroup = value ? filteredGroups.find((g) => g.key === value) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <Select
        value={value || ""}
        onValueChange={(val) => {
          if (!val) return;
          const group = filteredGroups.find((g) => g.key === val);
          if (group) onChange(val, group);
        }}
      >
        <SelectTrigger className="w-full bg-white border-slate-200">
          <SelectValue placeholder="Select a major row...">
            {selectedGroup ? (
              <span className="truncate font-bold">
                {selectedGroup.title}
              </span>
            ) : (
              "Select a major row..."
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-white z-50 shadow-md border border-slate-200 max-h-[300px]">
          {filteredGroups.map((group) => (
            <SelectItem key={group.key} value={group.key}>
              <span className="font-bold text-slate-800">
                {group.title}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
