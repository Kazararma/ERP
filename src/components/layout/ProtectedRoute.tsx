"use client";

import { useAuthStore } from "@/stores/authStore";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function ProtectedRoute({ children, requireSuperAdmin = false }: { children: React.ReactNode, requireSuperAdmin?: boolean }) {
  const { user, userDoc, loading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/login");
      } else if (userDoc?.status === "pending") {
        navigate("/pending");
      } else if (requireSuperAdmin && userDoc?.role !== "superadmin") {
        navigate("/dashboard");
      }
    }
  }, [user, userDoc, loading, navigate, requireSuperAdmin]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-xl font-semibold text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || userDoc?.status !== "active" || (requireSuperAdmin && userDoc?.role !== "superadmin")) {
    return null;
  }

  return <>{children}</>;
}
