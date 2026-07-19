import { Employee } from "@/types/employee";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PayWageModal from "./PayWageModal";
import { maskAccountNumber } from "@/utils/wageCalculator";
import { ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeCard({ employee }: { employee: Employee }) {
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Safely get payLog sorted newest first
  const payLog = [...(employee.payLog || [])].sort((a, b) => {
    const timeA = a.paidAt?.toMillis ? a.paidAt.toMillis() : (a.paidAt as unknown as Date).getTime ? (a.paidAt as unknown as Date).getTime() : 0;
    const timeB = b.paidAt?.toMillis ? b.paidAt.toMillis() : (b.paidAt as unknown as Date).getTime ? (b.paidAt as unknown as Date).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <Card className="flex flex-col border-none bg-white/60 backdrop-blur-md shadow-lg shadow-indigo-900/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl overflow-hidden">
      <CardHeader className="pb-4 bg-gradient-to-br from-white/50 to-white/10 border-b border-slate-100">
        <div className="flex items-center gap-4 w-full min-w-0">
          <div className="shrink-0 h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/30">
            {employee.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg md:text-xl font-bold text-slate-800 truncate leading-tight" title={employee.name}>
              {employee.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm uppercase tracking-wider ${
                employee.contractType === 'monthly' ? 'bg-purple-100 text-purple-700' 
                : 'bg-amber-100 text-amber-700'
              }`}>
                {employee.contractType}
              </span>
              <p className="text-xs text-slate-500 font-medium truncate flex-1" title={employee.address}>
                {employee.address || "No Address"}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-5 flex-1 bg-white/50 space-y-3">
        {/* Wages Info */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm bg-slate-50/80 px-3 py-2 rounded-xl">
            <span className="text-slate-500 font-medium">Contract</span>
            <span className="font-bold text-slate-800">
              {employee.contractType === 'monthly'
                ? `₹${employee.fixedMonthlySalary?.toLocaleString()} / mo`
                : 'Daily Worker'}
            </span>
          </div>
        </div>

        {/* Bank Info */}
        <div className="flex justify-between items-center text-sm bg-blue-50/50 px-3 py-2 rounded-xl">
          <span className="text-slate-500 font-medium">{employee.bankDetails?.bankName || "Bank"}</span>
          <span className="font-mono font-medium text-slate-700">
            {employee.bankDetails?.accountNumber ? maskAccountNumber(employee.bankDetails.accountNumber) : "No AC"}
          </span>
        </div>
      </CardContent>

      <CardFooter className="pt-2 pb-4 flex flex-col space-y-3 bg-white/50">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="w-full bg-indigo-50 text-indigo-700 py-2.5 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-indigo-500/25">
            Pay Salary
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>Pay {employee.name}</DialogTitle>
            </DialogHeader>
            <PayWageModal employee={employee} onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>

        <div className="w-full border-t border-slate-100 pt-2">
          <button 
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex items-center justify-between w-full text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <span>Pay History</span>
            {historyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {historyOpen && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
              {payLog.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-2">No payments yet</p>
              ) : (
                payLog.map((log) => {
                  const dateObj = log.paidAt?.toMillis ? new Date(log.paidAt.toMillis()) : new Date(log.paidAt as unknown as string);
                  return (
                    <div key={log.salaryTxId} className="bg-slate-50 rounded-lg p-2.5 text-sm border border-slate-100 flex flex-col gap-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-slate-700">{format(dateObj, 'dd MMM yyyy')}</p>
                          <p className="text-xs text-slate-500">{format(dateObj, 'HH:mm')}</p>
                        </div>
                        <span className="font-bold text-emerald-600">₹{log.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
                          {log.wageMode === 'fixed' ? 'Fixed' : log.wageMode === 'hourly' ? 'Hourly' : 'Per Bag'}
                        </span>
                        <span className="text-xs font-medium text-slate-500 truncate max-w-[120px]">{log.bankName}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
