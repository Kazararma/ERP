"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useMemo } from "react";
import { Employee } from "@/types/employee";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import { useBankStore } from "@/stores/bankStore";
import { useWagesStore } from "@/stores/wagesStore";
import { calculateGross, formatCurrency, maskAccountNumber } from "@/utils/wageCalculator";
import { paySalarySchema } from "@/schemas/bankSchema";
import { z } from "zod";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

type FormValues = z.infer<typeof paySalarySchema>;

export default function PayWageModal({ employee, onSuccess, currentWageMode }: { employee: Employee, onSuccess: () => void, currentWageMode?: string }) {
  const { user } = useAuthStore();
  const { banks } = useBankStore();
  const { paySalary } = useWagesStore();
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Rates entered fresh each time at pay — not stored on employee
  const [fixedSalaryInput, setFixedSalaryInput] = useState<string>(employee.fixedMonthlySalary?.toString() || "");
  const [hourlyRateInput, setHourlyRateInput] = useState<string>("");
  const [ratePerBagInput, setRatePerBagInput] = useState<string>("");

  const derivedWageMode = employee.contractType === 'monthly' ? 'fixed'
    : currentWageMode === 'perBag' ? 'perBag'
    : 'hourly'; // default daily to hourly

  const [localWageMode, setLocalWageMode] = useState<"fixed" | "hourly" | "perBag">(derivedWageMode);

  const { register, handleSubmit, watch, setValue, formState: { errors, isValid } } = useForm<FormValues>({
    resolver: zodResolver(paySalarySchema),
    defaultValues: {
      bankId: '',
      wageMode: localWageMode,
      hoursWorked: undefined,
      bagsCompleted: undefined
    },
    mode: "onChange"
  });

  const toggleWageMode = () => {
    if (employee.contractType !== 'daily') return;
    const newMode = localWageMode === 'hourly' ? 'perBag' : 'hourly';
    setLocalWageMode(newMode);
    setValue('wageMode', newMode, { shouldValidate: true });
  };

  const hoursWorked = watch('hoursWorked');
  const bagsCompleted = watch('bagsCompleted');
  const bankId = watch('bankId');

  const parsedFixedSalary = parseFloat(fixedSalaryInput) || 0;
  const parsedHourlyRate = parseFloat(hourlyRateInput) || 0;
  const parsedRatePerBag = parseFloat(ratePerBagInput) || 0;

  const grossAmount = useMemo(() => {
    try {
      return calculateGross({
        wageMode: localWageMode,
        fixedMonthlySalary: parsedFixedSalary,
        hourlyRate: parsedHourlyRate,
        ratePerBag: parsedRatePerBag,
        hoursWorked: hoursWorked ? Number(hoursWorked) : undefined,
        bagsCompleted: bagsCompleted ? Number(bagsCompleted) : undefined
      });
    } catch {
      return 0;
    }
  }, [localWageMode, parsedFixedSalary, parsedHourlyRate, parsedRatePerBag, hoursWorked, bagsCompleted]);

  const selectedBank = banks.find(b => b.id === bankId);
  const insufficientFunds = selectedBank ? selectedBank.principalAmount < grossAmount : false;

  const onSubmit = async (data: FormValues) => {
    if (!user) return;
    if (grossAmount <= 0) {
      toast.error('Please fill in valid rates and amounts to calculate a wage greater than zero.');
      return;
    }
    if (insufficientFunds) {
      toast.error('Insufficient balance in selected bank.');
      return;
    }

    setSubmitting(true);
    try {
      await paySalary({
        employee,
        bankId: data.bankId,
        bankName: selectedBank?.name || "Unknown Bank",
        wageMode: data.wageMode,
        fixedMonthlySalary: parsedFixedSalary,
        hourlyRate: parsedHourlyRate,
        ratePerBag: parsedRatePerBag,
        hoursWorked: data.hoursWorked,
        bagsCompleted: data.bagsCompleted,
        paidBy: user.uid,
        paidByName: user.displayName || user.email || "Admin"
      });
      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      if (err.message?.startsWith('Insufficient funds')) {
        toast.error(err.message);
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Payment failed: ' + String(err));
        console.error(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Safely get payLog sorted newest first
  const payLog = [...(employee.payLog || [])].sort((a, b) => {
    const timeA = a.paidAt?.toMillis ? a.paidAt.toMillis() : (a.paidAt as unknown as Date).getTime ? (a.paidAt as unknown as Date).getTime() : 0;
    const timeB = b.paidAt?.toMillis ? b.paidAt.toMillis() : (b.paidAt as unknown as Date).getTime ? (b.paidAt as unknown as Date).getTime() : 0;
    return timeB - timeA;
  });

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-5 animate-in fade-in zoom-in duration-300">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-emerald-200">
          <CheckCircle2 className="w-12 h-12 text-emerald-600" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Payment Successful!</h2>
          <p className="text-slate-500 font-medium">The salary has been accurately recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 pt-2">
      
      {/* LEFT COLUMN: Details & History */}
      <div className="md:w-1/2 flex flex-col space-y-6 md:border-r border-slate-200 md:pr-6">
        
        {/* Employee Details */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Worker Details</h3>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Address</span>
              <span className="font-semibold text-slate-800 text-right max-w-[150px] truncate" title={employee.address}>{employee.address || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Contract</span>
              <span className="font-semibold text-slate-800 capitalize">{employee.contractType}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
              <span className="text-slate-500">Bank Details</span>
              <div className="text-right flex flex-col items-end">
                <span className="font-semibold text-slate-800">{employee.bankDetails?.accountHolder || 'N/A'}</span>
                <span className="text-xs text-slate-500">{employee.bankDetails?.bankName || 'Unknown Bank'}</span>
                <span className="text-xs text-slate-500 font-mono mt-0.5">
                  A/C: {employee.bankDetails?.accountNumber || 'N/A'}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  IFSC: {employee.bankDetails?.ifscCode || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div className="flex-1 flex flex-col min-h-[250px] max-h-[300px]">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Payments</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {payLog.length === 0 ? (
              <p className="text-sm text-slate-500 italic text-center py-6 bg-slate-50 rounded-xl border border-slate-100">No payments yet</p>
            ) : (
              payLog.map((log) => {
                const dateObj = log.paidAt?.toMillis ? new Date(log.paidAt.toMillis()) : new Date(log.paidAt as unknown as string);
                return (
                  <div key={log.salaryTxId} className="bg-slate-50 rounded-lg p-3 text-sm border border-slate-100 flex flex-col gap-1.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-slate-700">{format(dateObj, 'dd MMM yyyy')}</p>
                        <p className="text-xs text-slate-500 font-medium">{format(dateObj, 'h:mm a')}</p>
                      </div>
                      <span className="font-bold text-emerald-600 text-base">₹{log.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                        {log.wageMode === 'fixed' ? 'Fixed' : log.wageMode === 'hourly' ? 'Hourly' : 'Per Bag'}
                      </span>
                      <span className="text-xs font-medium text-slate-500 truncate max-w-[120px]">{log.bankName}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Payment Form */}
      <div className="md:w-1/2 flex flex-col">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">New Payment</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 flex-1 flex flex-col justify-between">
          <div className="space-y-5">
            {/* Fixed monthly */}
            {localWageMode === 'fixed' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">📅 Fixed Monthly Mode</p>
                <div className="space-y-1.5">
                  <Label>Salary Amount (₹)</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="e.g. 10000"
                    value={fixedSalaryInput}
                    onChange={e => setFixedSalaryInput(e.target.value)}
                    className="font-semibold"
                  />
                </div>
                {grossAmount > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-medium">Gross Amount:</span>
                    <strong className="text-slate-900 text-lg">{formatCurrency(grossAmount)}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Hourly: enter rate + hours worked */}
            {localWageMode === 'hourly' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">⏱ Hourly Mode</p>
                  {employee.contractType === 'daily' && (
                    <button type="button" onClick={toggleWageMode} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded">Switch to Per Bag</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Rate (₹/hr)</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="e.g. 60"
                      value={hourlyRateInput}
                      onChange={e => setHourlyRateInput(e.target.value)}
                      className="font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hours Worked</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0.5"
                      placeholder="e.g. 8"
                      {...register("hoursWorked", { valueAsNumber: true })}
                      className={errors.hoursWorked ? "border-red-500" : ""}
                    />
                    {errors.hoursWorked && <p className="text-red-500 text-xs">{errors.hoursWorked.message}</p>}
                  </div>
                </div>
                {grossAmount > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-medium">Gross Amount:</span>
                    <strong className="text-slate-900 text-lg">{formatCurrency(grossAmount)}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Per Bag: enter rate + bags completed */}
            {localWageMode === 'perBag' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">📦 Per Bag Mode</p>
                  {employee.contractType === 'daily' && (
                    <button type="button" onClick={toggleWageMode} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded">Switch to Hourly</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Rate (₹/bag)</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="e.g. 25"
                      value={ratePerBagInput}
                      onChange={e => setRatePerBagInput(e.target.value)}
                      className="font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bags Completed</Label>
                    <Input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="e.g. 50"
                      {...register("bagsCompleted", { valueAsNumber: true })}
                      className={errors.bagsCompleted ? "border-red-500" : ""}
                    />
                    {errors.bagsCompleted && <p className="text-red-500 text-xs">{errors.bagsCompleted.message}</p>}
                  </div>
                </div>
                {grossAmount > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-medium">Gross Amount:</span>
                    <strong className="text-slate-900 text-lg">{formatCurrency(grossAmount)}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 flex flex-col">
              <Label>Pay From Bank</Label>
              <select 
                {...register("bankId")}
                className={`flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${errors.bankId ? 'border-red-500' : 'border-slate-200'}`}
              >
                <option value="">Select a bank</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name} — Balance: {formatCurrency(bank.principalAmount)}
                  </option>
                ))}
              </select>
              {errors.bankId && <p className="text-red-500 text-xs">{errors.bankId.message}</p>}
              {insufficientFunds && <p className="text-red-500 text-xs font-semibold mt-1">⚠ Insufficient balance in selected bank</p>}
            </div>

            {/* Summary Box */}
            {selectedBank && grossAmount > 0 && (
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-2 text-sm text-slate-700">
                <div className="flex justify-between"><span>Employee:</span> <span className="font-semibold text-slate-900">{employee.name}</span></div>
                <div className="flex justify-between items-center mt-1"><span>Amount:</span> <span className="font-bold text-emerald-600 text-lg">{formatCurrency(grossAmount)}</span></div>
                <div className="flex justify-between"><span>From Bank:</span> <span className="font-semibold text-slate-900">{selectedBank.name}</span></div>
                <div className="flex justify-between border-t border-blue-200 pt-2 mt-2">
                  <span>New Balance:</span>
                  <span className={`font-bold ${insufficientFunds ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatCurrency(selectedBank.principalAmount - grossAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-8">
            <button type="button" onClick={onSuccess} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-md font-semibold hover:bg-slate-200 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isValid || grossAmount <= 0 || insufficientFunds}
              className="flex-1 bg-emerald-600 text-white py-2.5 rounded-md font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Processing..." : "Pay Salary"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
