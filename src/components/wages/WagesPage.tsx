"use client";

import { useEffect, useState } from "react";
import { employeeService } from "@/services/employeeService";
import { Employee } from "@/types/employee";
import EmployeeCard from "./EmployeeCard";
import EmployeeForm from "./EmployeeForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BankTab } from "./bank/BankTab";
import { useBankStore } from "@/stores/bankStore";
import { useWagesStore } from "@/stores/wagesStore";

export default function WagesPage() {
  const { employees, isLoading: loading, fetchEmployees } = useWagesStore();
  const [open, setOpen] = useState(false);
  const { subscribeBanks } = useBankStore();

  useEffect(() => {
    const unsubEmployees = fetchEmployees();
    const unsubBanks = subscribeBanks();
    return () => { 
      unsubEmployees();
      unsubBanks(); 
    };
  }, [subscribeBanks, fetchEmployees]);

  return (
    <div className="flex flex-col h-full gap-4 p-6">
      <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-900 to-indigo-600 bg-clip-text text-transparent">Employee Wages</h1>
      
      <Tabs defaultValue="employees" className="flex-1 flex flex-col mt-4">
        <TabsList className="w-fit mb-4">
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="bank">Bank / Treasury</TabsTrigger>
        </TabsList>
        
        <TabsContent value="employees" className="flex-1 space-y-6">
          <div className="flex justify-between items-center bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-lg shadow-indigo-900/5 border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">Staff Registry</h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-indigo-700 hover:shadow-indigo-500/25 transition-all duration-300 hover:-translate-y-0.5">
                Add Employee
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] sm:max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>Add New Employee</DialogTitle>
                </DialogHeader>
                <EmployeeForm onSuccess={() => { setOpen(false); }} />
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
          ) : employees.length === 0 ? (
            <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 backdrop-blur-sm text-slate-500 font-medium">
              No employees found. Add an employee to manage wages.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {employees.map(employee => (
                <EmployeeCard key={employee.id || (employee as any).employeeId} employee={employee} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bank" className="flex-1">
          <BankTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
