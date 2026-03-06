import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import Auth from './pages/Auth';
import AdminChangePassword from './pages/admin/AdminChangePassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import CustomerDashboard from './pages/customer/CustomerDashboard';

// Guard: only admins who have completed password change can access the dashboard
const AdminRoute = ({ children }) => {
  const role            = localStorage.getItem('userRole');
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const firstLogin      = localStorage.getItem('firstLogin');

  if (!isAuthenticated || role !== 'ADMIN') return <Navigate to="/auth" replace />;
  if (firstLogin === 'true') return <Navigate to="/admin/change-password" replace />;

  return children;
};

// Guard: only admins on first login can access the change-password page
const AdminFirstLoginRoute = ({ children }) => {
  const role       = localStorage.getItem('userRole');
  const firstLogin = localStorage.getItem('firstLogin');

  if (role !== 'ADMIN') return <Navigate to="/" replace />;
  if (firstLogin !== 'true') return <Navigate to="/admin/dashboard" replace />;

  return children;
};

// Guard: only authenticated non-admin users can access customer pages
const CustomerRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const role            = localStorage.getItem('userRole');

  if (!isAuthenticated || isAuthenticated === 'false') return <Navigate to="/auth" replace />;
  if (role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />

        {/* Customer dashboard — guarded */}
        <Route
          path="/dashboard"
          element={
            <CustomerRoute>
              <CustomerDashboard />
            </CustomerRoute>
          }
        />

        {/* Admin first-login password change — guarded */}
        <Route
          path="/admin/change-password"
          element={
            <AdminFirstLoginRoute>
              <AdminChangePassword />
            </AdminFirstLoginRoute>
          }
        />

        {/* All /admin/* paths go to AdminDashboard — sidebar fragments handle the rest */}
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;