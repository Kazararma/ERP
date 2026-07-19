import { useEffect, useState, useMemo } from "react";
import { inventoryService } from "@/services/inventoryService";
import { Inventory, InventoryExcess } from "@/types/inventory";
import { DEAL_TYPE_LABELS } from "@/constants/dealLabels";
import { ALL_BAG_SIZES, BAG_SIZE_LABEL } from "@/types/riceTypes";
import { InventoryCard } from "@/components/inventory/InventoryCard";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Undo2, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import toast from "react-hot-toast";

function SupplierGroup({ supplierName, items }: { supplierName: string; items: Inventory[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider hover:text-slate-800 transition-colors w-full text-left"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {supplierName} <span className="text-xs text-slate-400 normal-case ml-2">({items.length} items)</span>
      </button>
      
      {isOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map(inv => (
            <InventoryCard key={inv.inventoryId} inv={inv} />
          ))}
        </div>
      )}
    </div>
  );
}

function RiceGroup({ group }: { group: { riceTypeName: string; suppliers: Record<string, Inventory[]> } }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="space-y-6">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-4 w-full text-left group"
      >
        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
          {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          {group.riceTypeName}
        </h2>
        <div className="h-px bg-slate-200 flex-1 group-hover:bg-indigo-200 transition-colors"></div>
      </button>
      
      {isOpen && (
        <div className="space-y-6 pl-4 border-l-2 border-slate-100">
          {Object.entries(group.suppliers).map(([supplierName, items]) => (
            <SupplierGroup key={supplierName} supplierName={supplierName} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExcessRow({ item }: { item: InventoryExcess }) {
  const [loading, setLoading] = useState(false);

  const handleRevert = async () => {
    if (!confirm(`Revert this adjustment and restore ${item.amountKg} kg back to inventory?`)) return;
    setLoading(true);
    try {
      await inventoryService.revertExcessRecord(item);
      toast.success(`Restored ${item.amountKg} kg back to inventory`);
    } catch (err: any) {
      toast.error('Failed to revert: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this excess record permanently? The stock will NOT be restored.')) return;
    setLoading(true);
    try {
      await inventoryService.deleteExcessRecord(item.excessId);
      toast.success('Excess record deleted');
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="border-b hover:bg-slate-50/50">
      <td className="px-4 py-3 text-slate-600 text-xs">{new Date(item.createdAt.toMillis()).toLocaleString()}</td>
      <td className="px-4 py-3 font-medium text-slate-700">{item.supplierName}</td>
      <td className="px-4 py-3">{item.product?.productName || item.product?.productCode}</td>
      <td className="px-4 py-3 capitalize">{item.type}</td>
      <td className="px-4 py-3 text-slate-500">{item.reason === 'rounding' ? 'Rounding' : 'Manual Edit'}</td>
      <td className={`px-4 py-3 text-right font-bold ${item.amountKg > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
        {item.amountKg > 0 ? `-${item.amountKg}` : `+${Math.abs(item.amountKg)}`} kg
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={handleRevert}
            disabled={loading}
            title="Revert: Restore this amount back to inventory"
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            title="Delete: Remove this record without restoring stock"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function InventoryPage() {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [excessItems, setExcessItems] = useState<InventoryExcess[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFilter, setDateFilter] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  
  const [bagFilter, setBagFilter] = useState("all");

  useEffect(() => {
    let inventoryLoaded = false;
    let excessLoaded = false;

    const checkLoading = () => {
      if (inventoryLoaded && excessLoaded) setLoading(false);
    };

    const unsubInv = inventoryService.subscribeToInventory(data => {
      setInventories(data);
      inventoryLoaded = true;
      checkLoading();
    });

    const unsubExcess = inventoryService.subscribeToExcessInventory(data => {
      setExcessItems(data);
      excessLoaded = true;
      checkLoading();
    });

    return () => {
      unsubInv();
      unsubExcess();
    };
  }, []);

  const filteredInventories = useMemo(() => {
    return inventories.filter(inv => {
      // 1. Check Date Filter
      if (dateFilter !== 'all' && inv.lastUpdated) {
        const date = inv.lastUpdated.toDate();
        const today = new Date();

        if (dateFilter === 'today') {
          if (date.getDate() !== today.getDate() || 
              date.getMonth() !== today.getMonth() || 
              date.getFullYear() !== today.getFullYear()) return false;
        }
        else if (dateFilter === 'thisMonth') {
          if (date.getMonth() !== today.getMonth() || 
              date.getFullYear() !== today.getFullYear()) return false;
        }
        else if (dateFilter === 'custom' && customStart && customEnd) {
          const start = new Date(customStart);
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (date < start || date > end) return false;
        }
      }

      // 2. Check Bag Filter
      if (bagFilter !== 'all') {
        const hasBagSize = (inv.divisionBreakdown || []).some(
          d => d.bagSize === bagFilter && d.numberOfBags > 0
        );
        if (!hasBagSize) return false;
      }

      return true;
    });
  }, [inventories, dateFilter, customStart, customEnd, bagFilter]);

  const availableInventories = filteredInventories.filter(inv => {
    const raw = inv.remainingRawKg || 0;
    const packed = inv.remainingPackedKg ?? (inv as any).remainingStagedKg ?? 0;
    return raw > 0 || packed > 0;
  });
  
  const exhaustedInventories = filteredInventories.filter(inv => {
    const raw = inv.remainingRawKg || 0;
    const packed = inv.remainingPackedKg ?? (inv as any).remainingStagedKg ?? 0;
    return raw <= 0 && packed <= 0;
  });

  const groupInventories = (invs: Inventory[]) => {
    return invs.reduce((acc, inv) => {
      const typeKey = inv.product?.riceTypeId || 'unknown';
      const typeName = inv.product?.riceTypeName || 'Unknown Type';
      const supplierName = inv.supplierName || 'Unknown Supplier';

      if (!acc[typeKey]) {
        acc[typeKey] = { riceTypeName: typeName, suppliers: {} };
      }
      if (!acc[typeKey].suppliers[supplierName]) {
        acc[typeKey].suppliers[supplierName] = [];
      }
      acc[typeKey].suppliers[supplierName].push(inv);
      return acc;
    }, {} as Record<string, { riceTypeName: string; suppliers: Record<string, Inventory[]> }>);
  };

  const groupedAvailable = groupInventories(availableInventories);
  const groupedExhausted = groupInventories(exhaustedInventories);

  const renderGroup = (grouped: Record<string, { riceTypeName: string; suppliers: Record<string, Inventory[]> }>) => (
    <div className="space-y-12">
      {Object.entries(grouped).map(([riceTypeId, group]) => (
        <RiceGroup key={riceTypeId} group={group} />
      ))}
    </div>
  );

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
        
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
            <select 
              value={bagFilter} 
              onChange={(e) => setBagFilter(e.target.value)}
              className="w-full sm:w-[140px] bg-white border border-slate-200 rounded-md px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Bag Sizes</option>
              {ALL_BAG_SIZES.map(size => (
                <option key={size} value={size}>{BAG_SIZE_LABEL[size]}</option>
              ))}
            </select>

            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full sm:w-[140px] bg-white border border-slate-200 rounded-md px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="thisMonth">This Month</option>
              <option value="custom">Custom Range</option>
            </select>

            {dateFilter === 'custom' && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                <Input 
                  type="date" 
                  value={customStart} 
                  onChange={e => setCustomStart(e.target.value)} 
                  className="w-full sm:w-36 bg-white"
                />
                <span className="text-slate-500 font-medium hidden sm:inline">to</span>
                <Input 
                  type="date" 
                  value={customEnd} 
                  onChange={e => setCustomEnd(e.target.value)} 
                  className="w-full sm:w-36 bg-white"
                />
              </div>
            )}
          </div>
        </div>

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="past">Past Inventory</TabsTrigger>
          <TabsTrigger value="excess">Excess</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-8">
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : availableInventories.length === 0 ? (
            <div className="text-center p-12 border-2 border-dashed rounded-xl bg-white text-slate-500">
              No active inventory found for the selected time period.
            </div>
          ) : (
            renderGroup(groupedAvailable)
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-8">
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : exhaustedInventories.length === 0 ? (
            <div className="text-center p-12 border-2 border-dashed rounded-xl bg-white text-slate-500">
              No past inventory found.
            </div>
          ) : (
            renderGroup(groupedExhausted)
          )}
        </TabsContent>

        <TabsContent value="excess" className="space-y-8">
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : excessItems.length === 0 ? (
            <div className="text-center p-12 border-2 border-dashed rounded-xl bg-white text-slate-500">
              No excess or shortages logged.
            </div>
          ) : (
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3 text-right">Adjustment (kg)</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {excessItems.map(item => (
                    <ExcessRow key={item.excessId} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
