import { useState, useEffect } from "react";
import { inventoryService } from "@/services/inventoryService";
import { dealService } from "@/services/dealService";
import { Inventory } from "@/types/inventory";
import { Deal } from "@/types/deal";
import { BagSize, BAG_WEIGHT_KG, BAG_SIZE_LABEL, Product } from "@/types/riceTypes";

export interface PendingAllocation {
  dealId: string;
  supplierId: string;
  supplierName: string;
  divisionId: string;
  product: Product;
  bagSize: BagSize;
  bagWeightKg: number;
  numberOfBags: number;
  weightKg: number;
  purchasePricePerKg: number;
  totalCost: number;
}

interface Props {
  filterRiceTypeId: string;
  targetOrderAmountKg: number;
  onAllocationsChange: (allocations: PendingAllocation[]) => void;
}

export function SupplierBagSelector({ filterRiceTypeId, targetOrderAmountKg, onAllocationsChange }: Props) {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [dealsMap, setDealsMap] = useState<Record<string, Deal>>({});
  const [allocations, setAllocations] = useState<PendingAllocation[]>([]);
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [sellingPrices, setSellingPrices] = useState<Record<string, number>>({});
  const [inputQtys, setInputQtys] = useState<Record<string, string>>({});
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = inventoryService.subscribeToInventory((data) => {
      setInventories(data.filter(inv => inv.status !== "exhausted"));
    });
    dealService.getAllDeals().then(deals => {
      const map: Record<string, Deal> = {};
      deals.forEach(d => map[d.dealId] = d);
      setDealsMap(map);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const finalAllocations = allocations.map(a => {
      const priceKey = `${a.supplierId}_${a.product.riceTypeId}_${a.bagSize}`;
      const price = sellingPrices[priceKey] || 0;
      return {
        ...a,
        sellingPricePerKg: price,
        revenue: a.weightKg * price
      };
    });
    onAllocationsChange(finalAllocations as any);
  }, [allocations, sellingPrices, onAllocationsChange]);

  const handleAddAllocation = (inv: Inventory, div: any, quantity: number) => {
    if (quantity <= 0 || quantity > div.availableBags) return;
    const deal = dealsMap[inv.dealId];
    if (!deal) return;

    setAllocations(prev => {
      const existingIdx = prev.findIndex(a => a.divisionId === div.divisionId);
      const newQty = existingIdx >= 0 ? prev[existingIdx].numberOfBags + quantity : quantity;
      
      if (newQty > div.availableBags) return prev;

      const alloc: PendingAllocation = {
        dealId: inv.dealId,
        supplierId: inv.supplierId,
        supplierName: inv.supplierName,
        divisionId: div.divisionId,
        product: inv.product,
        bagSize: div.bagSize as BagSize,
        bagWeightKg: BAG_WEIGHT_KG[div.bagSize as BagSize],
        numberOfBags: newQty,
        weightKg: newQty * BAG_WEIGHT_KG[div.bagSize as BagSize],
        purchasePricePerKg: deal.pricePerKg,
        totalCost: newQty * BAG_WEIGHT_KG[div.bagSize as BagSize] * deal.pricePerKg
      };

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = alloc;
        return next;
      }
      return [...prev, alloc];
    });
  };

  const handleRemoveAllocation = (divisionId: string) => {
    setAllocations(prev => prev.filter(a => a.divisionId !== divisionId));
  };

  const handleUpdateAllocationQty = (divisionId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveAllocation(divisionId);
      return;
    }
    setAllocations(prev => {
      const idx = prev.findIndex(a => a.divisionId === divisionId);
      if (idx === -1) return prev;
      
      const alloc = prev[idx];
      const next = [...prev];
      next[idx] = {
        ...alloc,
        numberOfBags: newQty,
        weightKg: newQty * alloc.bagWeightKg,
        totalCost: newQty * alloc.bagWeightKg * alloc.purchasePricePerKg
      };
      return next;
    });
  };

  const handleBulkAddAllocations = (newAllocs: {inv: Inventory, div: any, quantity: number}[]) => {
    setAllocations(prev => {
      const next = [...prev];
      for (const {inv, div, quantity} of newAllocs) {
        if (quantity <= 0) continue;
        const deal = dealsMap[inv.dealId];
        if (!deal) continue;

        const currentTotalWeight = next.reduce((sum, a) => sum + a.weightKg, 0);
        let remainingNeededKg = targetOrderAmountKg - currentTotalWeight;
        if (remainingNeededKg <= 0) continue; 

        const bagWeight = BAG_WEIGHT_KG[div.bagSize as BagSize];
        
        let maxBagsWeCanAdd = Math.floor(remainingNeededKg / bagWeight);

        const actualQuantityToAdd = Math.min(quantity, maxBagsWeCanAdd);
        if (actualQuantityToAdd <= 0) continue;

        const existingIdx = next.findIndex(a => a.divisionId === div.divisionId);
        const currentQty = existingIdx >= 0 ? next[existingIdx].numberOfBags : 0;
        const newQty = Math.min(currentQty + actualQuantityToAdd, div.availableBags);
        if (newQty <= currentQty) continue;

        const alloc: PendingAllocation = {
          dealId: inv.dealId,
          supplierId: inv.supplierId,
          supplierName: inv.supplierName,
          divisionId: div.divisionId,
          product: inv.product,
          bagSize: div.bagSize as BagSize,
          bagWeightKg: bagWeight,
          numberOfBags: newQty,
          weightKg: newQty * bagWeight,
          purchasePricePerKg: deal.pricePerKg,
          totalCost: newQty * bagWeight * deal.pricePerKg
        };

        if (existingIdx >= 0) {
          next[existingIdx] = alloc;
        } else {
          next.push(alloc);
        }
      }
      return next;
    });
  };

  const handleAutoFulfill = (groupItems: Inventory[]) => {
    // Current total weight might be updated via state, but we need it here
    const currentTotalWeight = allocations.reduce((sum, a) => sum + a.weightKg, 0);
    let remainingNeededKg = targetOrderAmountKg - currentTotalWeight;
    if (remainingNeededKg <= 0) return;

    const allDivs: { inv: Inventory, div: any }[] = [];
    groupItems.forEach(inv => {
      (inv.divisionBreakdown || []).forEach(div => {
        // Calculate how many bags are actually available (subtract already allocated)
        const allocatedQty = allocations.find(a => a.divisionId === div.divisionId)?.numberOfBags || 0;
        if (div.availableBags > allocatedQty) {
          allDivs.push({ inv, div: { ...div, actuallyAvailable: div.availableBags - allocatedQty } });
        }
      });
    });

    // Sort by cheapest per kg first, then by largest bag to fill bulk quickly
    allDivs.sort((a, b) => {
      const priceA = dealsMap[a.inv.dealId]?.pricePerKg || 0;
      const priceB = dealsMap[b.inv.dealId]?.pricePerKg || 0;
      if (priceA !== priceB) return priceA - priceB;
      return BAG_WEIGHT_KG[b.div.bagSize as BagSize] - BAG_WEIGHT_KG[a.div.bagSize as BagSize];
    });

    const bulkAdds: {inv: Inventory, div: any, quantity: number}[] = [];

    for (const { inv, div } of allDivs) {
      if (remainingNeededKg <= 0) break;
      const bagWeight = BAG_WEIGHT_KG[div.bagSize as BagSize];
      
      let bagsToTake = Math.floor(remainingNeededKg / bagWeight);
      
      bagsToTake = Math.min(bagsToTake, div.actuallyAvailable);
      if (bagsToTake > 0) {
        bulkAdds.push({ inv, div, quantity: bagsToTake });
        remainingNeededKg -= bagsToTake * bagWeight;
      }
    }

    if (bulkAdds.length > 0) {
      handleBulkAddAllocations(bulkAdds);
    }
  };

  const totalWeight = allocations.reduce((sum, a) => sum + a.weightKg, 0);
  const totalCogs = allocations.reduce((sum, a) => sum + a.totalCost, 0);
  const totalRevenue = allocations.reduce((sum, a) => {
    const priceKey = `${a.supplierId}_${a.product.riceTypeId}_${a.bagSize}`;
    return sum + (a.weightKg * (sellingPrices[priceKey] || 0));
  }, 0);
  const totalProfit = totalRevenue - totalCogs;

  const filteredInventories = filterRiceTypeId ? inventories.filter(inv => inv.product.riceTypeId === filterRiceTypeId) : inventories;

  const supplierGroups = filteredInventories.reduce((acc, inv) => {
    if (!acc[inv.supplierId]) acc[inv.supplierId] = { supplierName: inv.supplierName, items: [] };
    acc[inv.supplierId].items.push(inv);
    return acc;
  }, {} as Record<string, { supplierName: string, items: Inventory[] }>);

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6">
      <div className="border rounded-xl p-4 bg-white shadow-sm space-y-4 lg:col-span-5 max-h-[70vh] overflow-y-auto">
        <h3 className="font-bold text-slate-800">AVAILABLE STOCK</h3>
        <div className="space-y-4">
          {Object.entries(supplierGroups).map(([suppId, group]) => {
            const isExpanded = expandedSuppliers[suppId] !== false; // Default true
            return (
            <div key={suppId} className="border rounded-lg overflow-hidden shadow-sm">
              <div 
                className="bg-slate-100 px-3 py-2 border-b flex justify-between items-center cursor-pointer hover:bg-slate-200 transition-colors"
                onClick={() => setExpandedSuppliers(prev => ({ ...prev, [suppId]: !isExpanded }))}
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs w-3">{isExpanded ? '▼' : '▶'}</span>
                  <span className="font-bold text-sm text-slate-800">{group.supplierName}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleAutoFulfill(group.items); }}
                  disabled={totalWeight >= targetOrderAmountKg}
                  className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  Auto-Fulfill
                </button>
              </div>
              {isExpanded && (
              <div className="p-2 space-y-3 bg-slate-50">
                {group.items.map(inv => {
                  const activeDivs = (inv.divisionBreakdown || []).filter(d => d.availableBags > 0);
                  if (activeDivs.length === 0) return null;
                  return (
                    <div key={inv.inventoryId} className="bg-white border rounded p-2 text-sm shadow-sm">
                      <div className="font-semibold text-slate-700 mb-2">
                        {inv.product.productCode} · {inv.product.riceTypeName}
                      </div>
                      <div className="space-y-1.5">
                        {activeDivs.map(div => {
                          const allocated = allocations.find(a => a.divisionId === div.divisionId)?.numberOfBags || 0;
                          const availableNow = div.availableBags - allocated;
                          return (
                            <div 
                              key={div.divisionId} 
                              className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                            >
                              <div className="flex gap-2 items-center flex-wrap">
                                <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded text-xs shadow-sm border shrink-0">{BAG_SIZE_LABEL[div.bagSize as BagSize]}</span>
                                <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  ₹{(dealsMap[inv.dealId]?.pricePerKg * BAG_WEIGHT_KG[div.bagSize as BagSize] || 0).toLocaleString()}/bag (₹{dealsMap[inv.dealId]?.pricePerKg || 0}/kg)
                                </span>
                                <span className="text-[10px] font-medium bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0 whitespace-nowrap">
                                  <span className="font-bold text-emerald-900 text-xs">{availableNow}</span> avail
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <input 
                                  type="number" 
                                  step="any"
                                  min="1" 
                                  max={availableNow}
                                  value={inputQtys[div.divisionId] || ""}
                                  onChange={e => setInputQtys(prev => ({ ...prev, [div.divisionId]: e.target.value }))}
                                  placeholder="Qty"
                                  className="w-12 h-6 text-xs border border-slate-200 rounded px-1 text-center font-bold"
                                />
                                <button 
                                  onClick={() => {
                                    const qty = parseInt(inputQtys[div.divisionId] || "1", 10);
                                    if (!isNaN(qty) && qty > 0) {
                                      handleBulkAddAllocations([{inv, div, quantity: Math.min(qty, availableNow)}]);
                                      setInputQtys(prev => ({ ...prev, [div.divisionId]: "" }));
                                    }
                                  }}
                                  disabled={availableNow <= 0 || totalWeight >= targetOrderAmountKg}
                                  className="h-6 flex items-center justify-center text-[10px] bg-indigo-600 text-white px-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  ADD
                                </button>
                                <button 
                                  onClick={() => handleBulkAddAllocations([{inv, div, quantity: availableNow}])}
                                  disabled={availableNow <= 0 || totalWeight >= targetOrderAmountKg}
                                  className="h-6 text-[10px] bg-indigo-100 text-indigo-700 px-2 rounded font-bold uppercase hover:bg-indigo-200 disabled:opacity-50"
                                >
                                  All
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
            );
          })}
          {Object.keys(supplierGroups).length === 0 && (
             <div className="text-center p-8 text-slate-400 text-sm">No active stock available.</div>
          )}
        </div>
      </div>

      <div className="border-2 border-dashed border-indigo-200 rounded-xl p-4 bg-indigo-50/50 space-y-4 self-start sticky top-0 lg:col-span-4 max-h-[70vh] overflow-y-auto">
        <h3 className="font-bold text-indigo-900 flex items-center gap-2">
          ORDER SUMMARY
        </h3>

        {/* Dynamic Selling Price Inputs per Rice Type */}
        {allocations.length > 0 && (
          <div className="bg-white p-3 rounded-xl border shadow-sm mb-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Set Selling Prices</h4>
            <div className="space-y-4">
              {Object.entries(
                allocations.reduce((acc, a) => {
                  const groupKey = `${a.supplierId}_${a.product.riceTypeId}`;
                  if (!acc[groupKey]) {
                    acc[groupKey] = {
                      supplierName: a.supplierName,
                      riceTypeName: a.product.riceTypeName,
                      bagSizes: new Set<BagSize>()
                    };
                  }
                  acc[groupKey].bagSizes.add(a.bagSize);
                  return acc;
                }, {} as Record<string, {supplierName: string, riceTypeName: string, bagSizes: Set<BagSize>}>)
              ).map(([groupKey, group]) => (
                <div key={groupKey} className="border border-slate-100 bg-slate-50 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-800 text-sm">{group.supplierName}</span>
                    <span className="text-slate-400 text-xs">/</span>
                    <span className="font-bold text-indigo-700 text-sm">{group.riceTypeName}</span>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-2">
                    {Array.from(group.bagSizes).map(bagSize => {
                      const priceKey = `${groupKey}_${bagSize}`;
                      const allocForThisKey = allocations.find(a => `${a.supplierId}_${a.product.riceTypeId}_${a.bagSize}` === priceKey)!;
                      const costPerBagString = `Cost: ₹${(allocForThisKey.purchasePricePerKg * allocForThisKey.bagWeightKg).toLocaleString()}/bag (₹${allocForThisKey.purchasePricePerKg}/kg)`;
                      return (
                        <div key={priceKey} className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 block flex items-center justify-between">
                            <span>{BAG_SIZE_LABEL[bagSize]}</span>
                            <span className="text-slate-400 font-medium">Selling ₹/kg</span>
                          </label>
                          <input 
                            type="number" 
                            step="any"
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-semibold bg-white shadow-inner focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                            placeholder="0.00"
                            value={sellingPrices[priceKey] || ""}
                            onChange={e => setSellingPrices(prev => ({ ...prev, [priceKey]: parseFloat(e.target.value) || 0 }))}
                          />
                          <div className="text-[9px] text-slate-500 font-semibold mt-0.5">
                            {costPerBagString}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          {allocations.length === 0 ? (
            <div className="py-8 flex items-center justify-center text-slate-400 text-sm font-medium border-2 border-dashed rounded-xl border-slate-200 bg-white/50">
              Click "+1" or "Auto-Fulfill" to allocate bags
            </div>
          ) : (
            allocations.map(alloc => {
              const priceKey = `${alloc.supplierId}_${alloc.product.riceTypeId}_${alloc.bagSize}`;
              const sellingPrice = sellingPrices[priceKey] || 0;
              const rev = alloc.weightKg * sellingPrice;
              const profit = rev - alloc.totalCost;
              return (
                <div key={alloc.divisionId} className="bg-white border-l-4 border-l-indigo-500 border-y border-r rounded shadow-sm p-3 relative">
                  <button 
                    onClick={() => handleRemoveAllocation(alloc.divisionId)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1"
                  >
                    ✕
                  </button>
                  <div className="text-xs font-bold text-slate-500 mb-1 flex flex-col xl:flex-row xl:items-center justify-between pr-6 gap-1">
                    <span>{alloc.supplierName}</span>
                    <span className="text-[9px] text-slate-400 font-medium bg-slate-50 border border-slate-100 px-1.5 rounded w-fit">Cost: ₹{(alloc.purchasePricePerKg * alloc.bagWeightKg).toLocaleString()}/bag (₹{alloc.purchasePricePerKg}/kg)</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                      {BAG_SIZE_LABEL[alloc.bagSize as BagSize]} × 
                      <div className="flex items-center gap-1 bg-slate-100 rounded px-1">
                        <button 
                          onClick={() => handleUpdateAllocationQty(alloc.divisionId, alloc.numberOfBags - 1)}
                          className="text-slate-500 hover:text-indigo-600 px-1 font-bold"
                        >
                          -
                        </button>
                        <span className="text-indigo-600 font-bold min-w-[20px] text-center">{alloc.numberOfBags}</span>
                        <button 
                          onClick={() => {
                            let available = 0;
                            for (const i of inventories) {
                              const d = (i.divisionBreakdown || []).find(d => d.divisionId === alloc.divisionId);
                              if (d) { available = d.availableBags; break; }
                            }
                            if (alloc.numberOfBags < available && totalWeight < targetOrderAmountKg) {
                              handleUpdateAllocationQty(alloc.divisionId, alloc.numberOfBags + 1);
                            }
                          }}
                          disabled={totalWeight >= targetOrderAmountKg}
                          className="text-slate-500 hover:text-indigo-600 px-1 font-bold disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                      bags
                    </div>
                    <div className="font-bold text-slate-700">{alloc.weightKg.toLocaleString()} kg</div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold pt-1 border-t border-slate-100">
                    <div className="text-slate-500">Rev: <span className="text-slate-700">₹{rev.toLocaleString()}</span></div>
                    <div className="text-slate-500">Cost: <span className="text-slate-700">₹{alloc.totalCost.toLocaleString()}</span></div>
                    <div className={profit >= 0 ? "text-emerald-600" : "text-red-600"}>Profit: ₹{profit.toLocaleString()}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="border-2 border-solid border-slate-200 rounded-xl p-4 bg-white space-y-4 self-start sticky top-0 lg:col-span-3 shadow-sm">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          FINANCIALS
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Target Amount:</span>
            <span className="font-bold text-indigo-700 text-base">{targetOrderAmountKg.toLocaleString()} kg</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Allocated Weight:</span>
            <span className={`font-bold text-base ${totalWeight >= targetOrderAmountKg ? 'text-emerald-600' : 'text-slate-800'}`}>
              {totalWeight.toLocaleString()} kg
            </span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-slate-500 font-medium">COGS:</span>
            <span className="font-semibold text-slate-600">₹{totalCogs.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Revenue:</span>
            <span className="font-semibold text-slate-600">₹{totalRevenue.toLocaleString()}</span>
          </div>
          <div className="flex flex-col pt-2 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-4">
            <span className="font-bold text-slate-800 text-sm mb-1">Expected Profit</span>
            <span className={`font-black text-2xl ${totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              ₹{totalProfit.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
