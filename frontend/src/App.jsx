import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';

// Pages
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Customers from './pages/Customers/Customers';
import Employees from './pages/Employees/Employees';
import DesignOrders from './pages/DesignOrders/DesignOrders';
import OrderEntry from './pages/OrderEntry/OrderEntry';
import CustomerOrderPage from './pages/Customer/CustomerOrderPage';
import CustomerOrderList from './pages/Customer/CustomerOrderList';
import DesignCanvas from './pages/DesignCanvas/DesignCanvas';
import Salary from './pages/Salary/Salary';
import PrintView from './pages/Print/PrintView';
import AuditLog from './pages/AuditLog/AuditLog';
import GarmentTemplates from './pages/GarmentTemplates/GarmentTemplates';
import Inventory from './pages/Inventory/Inventory';
import Purchases from './pages/Purchases/Purchases';
import Services from './pages/Services/Services';
import Payments from './pages/Payments/Payments';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-brand flex items-center justify-center mx-auto animate-pulse">
            <span className="text-white text-xl">✂</span>
          </div>
          <p className="text-gray-400 text-sm">Loading Timelines…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/customer"        element={<ProtectedRoute adminOnly><CustomerOrderPage /></ProtectedRoute>} />
                <Route path="/customer/list"   element={<ProtectedRoute adminOnly><CustomerOrderList /></ProtectedRoute>} />
                <Route path="/customer/:id"    element={<ProtectedRoute adminOnly><CustomerOrderPage /></ProtectedRoute>} />
                <Route path="/orders" element={<DesignOrders />} />
                <Route path="/orders/new" element={
                  <ProtectedRoute adminOnly><OrderEntry /></ProtectedRoute>
                } />
                <Route path="/orders/:id/edit" element={
                  <ProtectedRoute adminOnly><OrderEntry /></ProtectedRoute>
                } />
                <Route path="/canvas" element={<DesignCanvas />} />
                <Route path="/print" element={<PrintView />} />
                <Route path="/salary" element={
                  <ProtectedRoute adminOnly><Salary /></ProtectedRoute>
                } />
                <Route path="/audit" element={
                  <ProtectedRoute adminOnly><AuditLog /></ProtectedRoute>
                } />
                <Route path="/garments" element={
                  <ProtectedRoute adminOnly><GarmentTemplates /></ProtectedRoute>
                } />
                <Route path="/inventory" element={
                  <ProtectedRoute adminOnly><Inventory /></ProtectedRoute>
                } />
                <Route path="/purchases" element={
                  <ProtectedRoute adminOnly><Purchases /></ProtectedRoute>
                } />
                <Route path="/services" element={
                  <ProtectedRoute adminOnly><Services /></ProtectedRoute>
                } />
                <Route path="/payments" element={
                  <ProtectedRoute adminOnly><Payments /></ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#1a1228',
              color: '#f1f5f9',
              border: '1px solid #2e2240',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#34d399', secondary: '#0f0a1a' } },
            error: { iconTheme: { primary: '#f43f5e', secondary: '#0f0a1a' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
