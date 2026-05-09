import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
  const [isValidatingToken, setIsValidatingToken] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('token');
      const isAuth = localStorage.getItem('isAuthenticated');
      
      // Skip validation if on auth pages or no token
      const isAuthPage = window.location.pathname.includes('/auth') || 
                         window.location.pathname.includes('/oauth2/callback') ||
                         window.location.pathname === '/';
      
      if (!token || isAuth !== 'true' || isAuthPage) {
        setIsValidatingToken(false);
        return;
      }
      
      try {
        console.log('Validating token...');
        
        // Try to validate token with a simple API call
        const response = await fetch('http://localhost:8080/api/auth/validate-token', {
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
        } else {
          console.log('Token is valid');
        }
      } catch (error) {
        console.error('Token validation error:', error);
        // On network error, allow user to continue
        // They'll get 401 on first API call if token is actually invalid
      }
      
      setIsValidatingToken(false);
    };

    validateToken();
  }, []);

  if (isValidatingToken) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #e0e0e0',
            borderTop: '3px solid #c4717f',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 0.8s linear infinite'
          }}></div>
          <p style={{ color: '#6b7280', fontSize: '14px', fontFamily: 'sans-serif' }}>
            Validating session...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

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
  );
}

export default App;