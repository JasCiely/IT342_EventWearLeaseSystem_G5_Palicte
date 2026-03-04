import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import Auth from './pages/Auth';
import AdminChangePassword from './pages/AdminChangePassword';
import AdminDashboard from './pages/AdminDashboard';

const AdminRoute = ({ children }) => {
  const role = localStorage.getItem('userRole');
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const firstLogin = localStorage.getItem('firstLogin');

  if (!isAuthenticated || role !== 'ADMIN') return <Navigate to="/auth" replace />;
  if (firstLogin === 'true') return <Navigate to="/admin/change-password" replace />;

  return children;
};

const AdminFirstLoginRoute = ({ children }) => {
  const role = localStorage.getItem('userRole');
  const firstLogin = localStorage.getItem('firstLogin');

  if (role !== 'ADMIN') return <Navigate to="/" replace />;
  if (firstLogin !== 'true') return <Navigate to="/admin/dashboard" replace />;

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />

        {/* Admin first-login password change — guarded */}
        <Route
          path="/admin/change-password"
          element={
            <AdminFirstLoginRoute>
              <AdminChangePassword />
            </AdminFirstLoginRoute>
          }
        />

        <Route
          path="/admin/dashboard"
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