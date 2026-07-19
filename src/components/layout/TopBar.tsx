"use client";

import { Menu, LogOut, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function TopBar() {
  const { user, userDoc } = useAuthStore();
  const { toggleSidebar } = useUiStore();

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="px-4 pt-4 md:px-8">
      <header className="flex h-16 items-center justify-between rounded-2xl bg-white/70 backdrop-blur-md px-6 shadow-sm border border-slate-200/50">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar}
          className="mr-4 rounded-md p-2 text-gray-500 hover:bg-gray-100 md:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-sm font-bold text-slate-800">{user?.displayName || "Loading..."}</span>
          <span className="text-xs text-gray-500 capitalize">{userDoc?.role || "User"}</span>
        </div>
        
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 overflow-hidden ring-2 ring-white shadow-sm">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <User className="h-5 w-5 text-indigo-600" />
          )}
        </div>

        <div className="h-6 w-px bg-gray-200"></div>

        <button 
          onClick={handleLogout}
          className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Sign Out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
      </header>
    </div>
  );
}
