import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from './components/auth/AuthProvider';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import SuperAdminRoute from './components/layout/SuperAdminRoute';
import { Toaster } from 'react-hot-toast';
import { GlobalConfirmDialog } from './components/ui/GlobalConfirmDialog';

import LoginPage from './pages/auth/LoginPage';
import PendingPage from './pages/auth/PendingPage';
import DashboardPage from './pages/app/DashboardPage';
import DealsPage from './pages/app/DealsPage';
import InventoryPage from './pages/app/InventoryPage';
import LedgerPage from './pages/app/LedgerPage';
import LedgerDetailPage from './pages/app/LedgerDetailPage';
import WagesPage from './pages/app/WagesPage';
import UsersPage from './pages/admin/UsersPage';
import MigratePage from './pages/app/MigratePage';
import BalancePnLPage from './pages/app/BalancePnLPage';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <GlobalConfirmDialog />
      <AuthProvider>
        <Routes>
          {/* Public / Auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pending" element={<PendingPage />} />
          
          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><AppShell><DashboardPage /></AppShell></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><AppShell><DashboardPage /></AppShell></ProtectedRoute>} />
          <Route path="/deals" element={<ProtectedRoute><AppShell><DealsPage /></AppShell></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><AppShell><InventoryPage /></AppShell></ProtectedRoute>} />
          <Route path="/ledger" element={<ProtectedRoute><AppShell><LedgerPage /></AppShell></ProtectedRoute>} />
          <Route path="/ledger/:orderId" element={<ProtectedRoute><AppShell><LedgerDetailPage /></AppShell></ProtectedRoute>} />
          <Route path="/wages/*" element={<ProtectedRoute><AppShell><WagesPage /></AppShell></ProtectedRoute>} />
          <Route path="/balance-pnl" element={<ProtectedRoute><AppShell><BalancePnLPage /></AppShell></ProtectedRoute>} />
          
          {/* SuperAdmin routes */}
          <Route path="/admin/users" element={<SuperAdminRoute><AppShell><UsersPage /></AppShell></SuperAdminRoute>} />
          <Route path="/admin/migrate" element={<SuperAdminRoute><AppShell><MigratePage /></AppShell></SuperAdminRoute>} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
