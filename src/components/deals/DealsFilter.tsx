import { useState, useEffect } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supplierService } from "@/services/supplierService";
import { customerService } from "@/services/customerService";
import { DEAL_TYPE_LABELS } from "@/constants/dealLabels";

export type DateFilterType = "all-time" | "today" | "previous" | "monthly" | "custom";

export interface DealsFilterValues {
  type: DateFilterType;
  startDate: Date | null;
  endDate: Date | null;
  searchQuery: string;
}

export function DealsFilter({ activeTab, onChange }: { activeTab: string, onChange: (filters: DealsFilterValues) => void }) {
  const [type, setType] = useState<DateFilterType>("all-time");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [searchQuery, setSearchQuery] = useState("all-names");
  const [options, setOptions] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const loadOptions = async () => {
      setSearchQuery("all-names"); // Reset selected filter when tab changes
      if (activeTab === "bought") {
        const suppliers = await supplierService.getAllSuppliers();
        setOptions(suppliers.map(s => ({ id: s.supplierId, name: s.name })));
      } else {
        const customers = await customerService.getAllCustomers();
        setOptions(customers.map(c => ({ id: c.customerId, name: c.name })));
      }
    };
    loadOptions();
  }, [activeTab]);

  const handleTypeChange = (val: DateFilterType) => {
    setType(val);
    applyFilter(val, customStart, customEnd, selectedMonth, searchQuery);
  };

  const applyFilter = (filterType: DateFilterType, start: string, end: string, month: string, search: string) => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (filterType === "today") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (filterType === "previous") {
      startDate = subDays(now, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = subDays(now, 1);
      endDate.setHours(23, 59, 59, 999);
    } else if (filterType === "monthly") {
      const date = new Date(month + "-01T00:00:00");
      startDate = startOfMonth(date);
      endDate = endOfMonth(date);
    } else if (filterType === "custom") {
      startDate = start ? new Date(start + "T00:00:00") : null;
      if (startDate) startDate.setHours(0, 0, 0, 0);
      endDate = end ? new Date(end + "T23:59:59") : null;
      if (endDate) endDate.setHours(23, 59, 59, 999);
    }

    onChange({ type: filterType, startDate, endDate, searchQuery: search === "all-names" ? "" : search });
  };

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="space-y-1.5 w-full md:w-auto">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{activeTab === "bought" ? "Supplier Filter" : "Customer Filter"}</label>
        <Select 
          value={searchQuery} 
          onValueChange={(val) => {
            setSearchQuery(val || "");
            applyFilter(type, customStart, customEnd, selectedMonth, val || "");
          }}
        >
          <SelectTrigger className="w-full md:w-[200px] bg-white border-slate-200">
            <SelectValue placeholder={activeTab === "bought" ? "All Suppliers" : "All Customers"}>
              {searchQuery === "all-names" 
                ? (activeTab === "bought" ? "All Suppliers" : "All Customers") 
                : searchQuery === "one-time"
                ? (activeTab === "bought" ? "One-Time Suppliers" : "One-Time Customers")
                : options.find(o => o.id === searchQuery)?.name || searchQuery}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-white z-50 shadow-md border border-slate-200">
            <SelectItem value="all-names">{activeTab === "bought" ? "All Suppliers" : "All Customers"}</SelectItem>
            <SelectItem value="one-time">{activeTab === "bought" ? "One-Time Suppliers" : "One-Time Customers"}</SelectItem>
            {options.map(opt => (
              <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-1.5 w-full md:w-auto">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date Range</label>
        <Select value={type} onValueChange={(val) => handleTypeChange((val as DateFilterType) || "all-time")}>
          <SelectTrigger className="w-full md:w-[160px] bg-white border-slate-200">
            <SelectValue placeholder="Filter by date" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50 shadow-md border border-slate-200">
            <SelectItem value="all-time">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="previous">Previous Date</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {type === "monthly" && (
        <div className="space-y-1.5 w-full md:w-auto mt-2 md:mt-0">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider md:opacity-0 block md:inline-block">Month</label>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              applyFilter(type, customStart, customEnd, e.target.value, searchQuery);
            }}
            className="w-full md:w-[160px] bg-white border-slate-200"
          />
        </div>
      )}

      {type === "custom" && (
        <div className="space-y-1.5 w-full md:w-auto mt-2 md:mt-0">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider md:opacity-0 block md:inline-block">Range</label>
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                applyFilter(type, e.target.value, customEnd, selectedMonth, searchQuery);
              }}
              className="w-full md:w-[140px] bg-white border-slate-200"
            />
            <span className="text-slate-400 font-medium text-sm hidden sm:inline">to</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                applyFilter(type, customStart, e.target.value, selectedMonth, searchQuery);
              }}
              className="w-full md:w-[140px] bg-white border-slate-200"
            />
          </div>
        </div>
      )}
    </div>
  );
}
