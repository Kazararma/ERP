"use client";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { CalculatorWidget } from "../shared/CalculatorWidget";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-transparent">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-2 pt-4 sm:p-4 md:p-8 md:pt-4">
          <div className="mx-auto max-w-7xl h-full">
            {children}
          </div>
        </main>
      </div>
      <CalculatorWidget />
    </div>
  );
}
