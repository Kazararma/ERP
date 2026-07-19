"use client";

import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-emerald-500 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-md space-y-8 rounded-3xl bg-white/10 backdrop-blur-2xl p-10 shadow-2xl border border-white/20 text-center relative z-10">
        <div>
          <div className="mx-auto h-20 w-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-lg border border-white/30 mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
          </div>
          <h2 className="mt-6 text-3xl font-black text-white tracking-tight">Rice Merchant ERP</h2>
          <p className="mt-3 text-indigo-100 font-medium">Securely manage your deals, inventory, and operations.</p>
        </div>
        <button
          onClick={handleLogin}
          className="group relative flex w-full justify-center rounded-xl border border-transparent bg-white px-4 py-3.5 text-sm font-bold text-indigo-600 shadow-lg hover:bg-indigo-50 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
