import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { API_BASE_URL_ROOT } from './shared/services/apiClient.js';
import Index from './features/home/pages/Index';
import Auth from './features/auth/pages/Auth';
import ForgotPassword from './features/auth/pages/ForgotPassword';
import OAuth2Callback from './features/auth/pages/OAuth2Callback';
import AdminChangePassword from './features/admin/pages/AdminChangePassword';
import AdminDashboard from './features/admin/pages/AdminDashboard';
import CustomerDashboard from './features/customer/pages/CustomerDashboard';

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
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('token');
      const isAuth = localStorage.getItem('isAuthenticated');

      const isAuthPage = window.location.pathname.includes('/auth') ||
                         window.location.pathname.includes('/oauth2/callback') ||
                         window.location.pathname === '/';

      if (!token || isAuth !== 'true' || isAuthPage) return;

      try {
        const response = await fetch(`${API_BASE_URL_ROOT}/auth/validate-token`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.warn('Token validation failed - clearing session');
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/auth';
        }
      } catch (error) {
        console.error('Token validation error:', error);
      }
    };

    validateToken();
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => setSessionExpired(true);
    window.addEventListener('sessionExpired', handleSessionExpired);
    return () => window.removeEventListener('sessionExpired', handleSessionExpired);
  }, []);

  const handleSessionExpiredOkay = () => {
    setSessionExpired(false);
    window.location.href = '/auth';
  };

  const handleLogin = () => {};

  return (
    <>
      {sessionExpired && (
        <div className="session-timeout-modal">
          <div className="session-timeout-content">
            <h3>Session Inactive</h3>
            <p>Your session has become inactive. Please log in again.</p>
            <button className="stay-logged-in-btn" onClick={handleSessionExpiredOkay}>
              Okay
            </button>
          </div>
        </div>
      )}
      <Router>
        <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth onLogin={handleLogin} />} />

        {/* Google OAuth2 callback */}
        <Route
          path="/oauth2/callback"
          element={<OAuth2Callback onLogin={handleLogin} />}
        />

        {/* Customer dashboard paths */}
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

        {/* Default Redirect */}
        <Route path="/dashboard" element={<Navigate to="/customer/dashboard" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </>
  );
}

export default App;