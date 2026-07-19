import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerLedgerTab } from "@/components/ledger/customer/CustomerLedgerTab";
import { SupplierLedgerTab } from "@/components/ledger/supplier/SupplierLedgerTab";
import { SalaryLedgerTab } from "@/components/ledger/salary/SalaryLedgerTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Settings } from "lucide-react";
import { updateAllLedgerProfilesSettings } from "@/services/ledgerProfileService";
import toast from "react-hot-toast";

export default function LedgerPage() {
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [millName, setMillName] = useState("M/S JAYDEB GON");
  const [millDesc, setMillDesc] = useState("MONTESWAR ( KAMARSHAL MORE )\nPURBA BARDHAMAN");
  const [millContact, setMillContact] = useState("+91-9064138118");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveGlobalSettings = async () => {
    setIsSaving(true);
    try {
      await updateAllLedgerProfilesSettings({ millName, millDescription: millDesc, millContact });
      setShowGlobalSettings(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save global settings");
    }
    setIsSaving(false);
  };
  return (
    <div className="flex flex-col h-full gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">General Ledger</h1>
        <Button variant="outline" onClick={() => setShowGlobalSettings(true)} className="shadow-sm">
          <Settings size={16} className="mr-2 text-indigo-600" /> Global PDF Headings
        </Button>
      </div>
      <Tabs defaultValue="customer" className="flex-1 flex flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="customer">Customer Ledger</TabsTrigger>
          <TabsTrigger value="supplier">Supplier Ledger</TabsTrigger>
          <TabsTrigger value="salary" className="flex items-center gap-2">
            Salary Ledger
          </TabsTrigger>
        </TabsList>
        <TabsContent value="customer" className="flex-1 mt-4">
          <CustomerLedgerTab />
        </TabsContent>
        <TabsContent value="supplier" className="flex-1 mt-4 h-[calc(100vh-160px)]">
          <SupplierLedgerTab />
        </TabsContent>
        <TabsContent value="salary" className="flex-1 mt-4">
          <SalaryLedgerTab />
        </TabsContent>
      </Tabs>

      {/* Global PDF Settings Dialog */}
      <Dialog open={showGlobalSettings} onOpenChange={setShowGlobalSettings}>
        <DialogContent className="sm:max-w-[450px] bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle>Global PDF Headings</DialogTitle>
            <DialogDescription>
              Set the default PDF headings. This will automatically update the printed headings for <strong>all existing and future ledger accounts</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="globalMillName">Mill / Business Name</Label>
              <Input
                id="globalMillName"
                value={millName}
                onChange={(e) => setMillName(e.target.value)}
                placeholder="e.g. M/S JAYDEB GON"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="globalMillDesc">Address / Description</Label>
              <Input
                id="globalMillDesc"
                value={millDesc}
                onChange={(e) => setMillDesc(e.target.value)}
                placeholder="e.g. MONTESWAR (KAMARSHAL MORE)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="globalMillContact">Contact Number</Label>
              <Input
                id="globalMillContact"
                value={millContact}
                onChange={(e) => setMillContact(e.target.value)}
                placeholder="e.g. +91-9064138118"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGlobalSettings(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSaveGlobalSettings} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSaving ? "Saving to all ledgers..." : "Apply to All Ledgers"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
