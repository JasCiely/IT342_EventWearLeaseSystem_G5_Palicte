import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import Auth from './pages/Auth';
import AdminChangePassword from './pages/admin/AdminChangePassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import OAuth2Callback from './pages/OAuth2Callback';
import ForgotPassword from './pages/ForgotPassword';

const AdminRoute = ({ children }) => {
  const role            = localStorage.getItem('userRole');
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const token           = localStorage.getItem('token');
  const firstLogin      = localStorage.getItem('firstLogin');

  if (!token || !isAuthenticated || isAuthenticated === 'false' || role !== 'ADMIN')
    return <Navigate to="/auth" replace />;
  if (firstLogin === 'true')
    return <Navigate to="/admin/change-password" replace />;

  return children;
};

const AdminFirstLoginRoute = ({ children }) => {
  const role       = localStorage.getItem('userRole');
  const firstLogin = localStorage.getItem('firstLogin');

  if (role !== 'ADMIN') return <Navigate to="/" replace />;
  if (firstLogin !== 'true') return <Navigate to="/admin/dashboard" replace />;

  return children;
};

const CustomerRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const token           = localStorage.getItem('token');
  const role            = localStorage.getItem('userRole');

  if (!token || !isAuthenticated || isAuthenticated === 'false')
    return <Navigate to="/auth" replace />;
  if (role === 'ADMIN')
    return <Navigate to="/admin/dashboard" replace />;

  return children;
};

function App() {

  const handleLogin = () => {
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth onLogin={handleLogin} />} />

        {/* Google OAuth2 callback — must be public, no guard */}
        <Route
          path="/oauth2/callback"
          element={<OAuth2Callback onLogin={handleLogin} />}
        />

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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;