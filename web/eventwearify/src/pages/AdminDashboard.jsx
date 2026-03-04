import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardHeader from '../components/adminDashboard/AdminDashboardHeader';
import { CheckCircle } from 'lucide-react';
import '../components/css/adminDashboard/AdminDashboardHeader.css';

const API_BASE_URL = 'http://localhost:8080/api/auth';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const firstName = localStorage.getItem('firstName') || 'Admin';

  const [toast, setToast] = useState({ show: false, message: '' });

  useEffect(() => {
    // Show success toast if redirected here after login or password change
    const justLoggedIn = sessionStorage.getItem('showLoginSuccess');
    if (justLoggedIn) {
      sessionStorage.removeItem('showLoginSuccess');
      setToast({ show: true, message: `Welcome back, ${firstName}! You have successfully logged in.` });
      setTimeout(() => setToast({ show: false, message: '' }), 3500);
    }
  }, []);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API_BASE_URL}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (err) {
      console.warn('Logout request failed:', err);
    } finally {
      localStorage.clear();
      navigate('/auth', { replace: true });
    }
  };

  return (
    <div>
      {/* Success toast — lower right */}
      {toast.show && (
        <div className="dashboard-toast success">
          <CheckCircle size={18} />
          <span>{toast.message}</span>
        </div>
      )}

      <DashboardHeader
        userName={firstName}
        onLogout={handleLogout}
      />

      <main style={{ padding: '2rem 4rem' }}>
        <p>Admin dashboard content coming soon.</p>
      </main>
    </div>
  );
};

export default AdminDashboard;