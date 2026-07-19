import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BoughtTab } from "@/components/deals/bought/BoughtTab";
import { SoldTab } from "@/components/deals/sold/SoldTab";
import { DealsFilter, DealsFilterValues } from "@/components/deals/DealsFilter";
import { useState } from "react";
import { DEAL_TYPE_LABELS } from "@/constants/dealLabels";
import { Button } from "@/components/ui/button";
import { PaymentVoucherDialog } from "@/components/deals/PaymentVoucher/PaymentVoucherDialog";
import { WalletCards } from "lucide-react";

export default function DealsPage() {
  const [dateFilter, setDateFilter] = useState<DealsFilterValues>({ type: "all-time" as any, startDate: null, endDate: null, searchQuery: "all-names" });
  const [activeTab, setActiveTab] = useState("bought");
  const [voucherOpen, setVoucherOpen] = useState(false);

  return (
    <div className="flex flex-col h-full gap-4 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deals</h1>
        <Button 
          onClick={() => setVoucherOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold tracking-wide gap-2 shadow-sm rounded-lg"
        >
          <WalletCards className="w-4 h-4" />
          New Voucher
        </Button>
      </div>
      <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="flex flex-col md:flex-row gap-4 justify-between w-full">
            <TabsList className="w-fit">
              <TabsTrigger value="bought">{DEAL_TYPE_LABELS.bought}</TabsTrigger>
              <TabsTrigger value="sold">{DEAL_TYPE_LABELS.sold}</TabsTrigger>
            </TabsList>
            <DealsFilter activeTab={activeTab} onChange={setDateFilter} />
          </div>
          <TabsContent value="bought" className="flex-1 mt-4">
            <BoughtTab dateFilter={dateFilter} />
          </TabsContent>
          <TabsContent value="sold" className="flex-1 mt-4">
            <SoldTab dateFilter={dateFilter} />
          </TabsContent>
        </Tabs>
      </div>

      <PaymentVoucherDialog 
        open={voucherOpen}
        onOpenChange={setVoucherOpen}
        defaultEntityType={activeTab === 'bought' ? 'supplier' : 'customer'}
      />
    </div>
  );
}
