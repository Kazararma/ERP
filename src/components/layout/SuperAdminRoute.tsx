"use client";

import ProtectedRoute from "./ProtectedRoute";

export default function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requireSuperAdmin={true}>{children}</ProtectedRoute>;
}
