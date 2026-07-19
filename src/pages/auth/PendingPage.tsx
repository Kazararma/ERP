"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function PendingPage() {
  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg text-center">
        <div>
          <h2 className="mt-6 text-2xl font-bold text-yellow-600">Account Pending</h2>
          <p className="mt-4 text-gray-600">
            Your account is currently pending approval from a SuperAdmin. You will be able to access the system once approved.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="mt-6 w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
