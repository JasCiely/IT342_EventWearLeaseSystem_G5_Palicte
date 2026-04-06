import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import Auth from './pages/Auth';
import AdminChangePassword from './pages/admin/AdminChangePassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import OAuth2Callback from './pages/OAuth2Callback';
import ForgotPassword from './pages/ForgotPassword';

const AdminRoute = ({ children }) => {
  const role = localStorage.getItem('userRole');
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const token = localStorage.getItem('token');
  const firstLogin = localStorage.getItem('firstLogin');

  if (!token || !isAuthenticated || isAuthenticated === 'false' || role !== 'ADMIN')
    return <Navigate to="/auth" replace />;
  if (firstLogin === 'true')
    return <Navigate to="/admin/change-password" replace />;

  return children;
};

const AdminFirstLoginRoute = ({ children }) => {
  const role = localStorage.getItem('userRole');
  const firstLogin = localStorage.getItem('firstLogin');

  if (role !== 'ADMIN') return <Navigate to="/" replace />;
  if (firstLogin !== 'true') return <Navigate to="/admin/dashboard" replace />;

  return children;
};

const CustomerRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('userRole');

  if (!token || !isAuthenticated || isAuthenticated === 'false')
    return <Navigate to="/auth" replace />;
  if (role === 'ADMIN')
    return <Navigate to="/admin/dashboard" replace />;

  return children;
};

function App() {
  const handleLogin = () => {
    // Logic for post-login actions if needed
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth onLogin={handleLogin} />} />

        {/* Google OAuth2 callback */}
        <Route
          path="/oauth2/callback"
          element={<OAuth2Callback onLogin={handleLogin} />}
        />

        {/* UPDATED: Customer dashboard paths.
            We use /customer/* so that /customer/outfits, /customer/profile, etc. 
            all load the CustomerDashboard component.
        */}
        <Route
          path="/customer/*"
          element={
            <CustomerRoute>
              <CustomerDashboard />
            </CustomerRoute>
          }
        />

        {/* Admin first-login password change */}
        <Route
          path="/admin/change-password"
          element={
            <AdminFirstLoginRoute>
              <AdminChangePassword />
            </AdminFirstLoginRoute>
          }
        />

        {/* Admin Dashboard wildcard */}
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Default Redirect: If user goes to /dashboard, send to the new /customer/dashboard path */}
        <Route path="/dashboard" element={<Navigate to="/customer/dashboard" replace />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;