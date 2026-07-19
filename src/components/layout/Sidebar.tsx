"use client";

import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingBag, Database, BookOpen, Users, ShieldAlert, Scale } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Deals", href: "/deals", icon: ShoppingBag },
  { name: "Inventory", href: "/inventory", icon: Database },
  { name: "Ledger", href: "/ledger", icon: BookOpen },
  { name: "Wages", href: "/wages", icon: Users },
  { name: "Balance / PnL", href: "/balance-pnl", icon: Scale },
];

export default function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { userDoc } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const isSuperAdmin = userDoc?.role === "superadmin";

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 md:hidden" 
          onClick={toggleSidebar} 
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white/60 backdrop-blur-xl border-r border-slate-200/50 shadow-2xl transition-transform duration-300 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-center border-b border-slate-200/50 px-4">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/30">
              <Database className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Rice ERP</h1>
          </div>
        </div>
        
        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => {
                  if (window.innerWidth < 768 && sidebarOpen) {
                    toggleSidebar();
                  }
                }}
                className={`group flex items-center space-x-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-300 ${
                  isActive 
                    ? "bg-indigo-500/10 text-indigo-700 shadow-sm" 
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-indigo-600 hover:translate-x-1"
                }`}
              >
                <item.icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-500"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {isSuperAdmin && (
            <>
              <div className="my-4 border-t border-gray-200"></div>
              <Link
                to="/admin/users"
                onClick={() => {
                  if (window.innerWidth < 768 && sidebarOpen) {
                    toggleSidebar();
                  }
                }}
                className={`group flex items-center space-x-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-300 ${
                  pathname === "/admin/users"
                    ? "bg-purple-500/10 text-purple-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-purple-600 hover:translate-x-1"
                }`}
              >
                <ShieldAlert className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${pathname === "/admin/users" ? "text-purple-600" : "text-slate-400 group-hover:text-purple-500"}`} />
                <span>User Admin</span>
              </Link>
              <Link
                to="/admin/migrate"
                onClick={() => {
                  if (window.innerWidth < 768 && sidebarOpen) {
                    toggleSidebar();
                  }
                }}
                className={`group flex items-center space-x-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-300 ${
                  pathname === "/admin/migrate"
                    ? "bg-purple-500/10 text-purple-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-purple-600 hover:translate-x-1"
                }`}
              >
                <Database className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${pathname === "/admin/migrate" ? "text-purple-600" : "text-slate-400 group-hover:text-purple-500"}`} />
                <span>Migrate Data</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </>
  );
}
