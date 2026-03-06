import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

const CustomerDashboard = () => {
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const firstName = localStorage.getItem('firstName') || 'there';

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Show welcome toast if redirected here after a successful login
  useEffect(() => {
    if (sessionStorage.getItem('showLoginSuccess') === 'true') {
      sessionStorage.removeItem('showLoginSuccess');
      showToast(`Welcome back, ${firstName}!`, 'success');
    }
  }, []);

  return (
    <div>
      {/* Toast notification — same pattern as Auth / AdminDashboard */}
      {toast.show && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '8px',
            backgroundColor: toast.type === 'error' ? '#fee2e2' : '#d1fae5',
            color: toast.type === 'error' ? '#b91c1c' : '#065f46',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontWeight: 500,
          }}
        >
          {toast.type === 'error'
            ? <AlertCircle size={18} />
            : <CheckCircle size={18} />
          }
          <span>{toast.message}</span>
        </div>
      )}

      {/* Replace the content below with your actual customer dashboard UI */}
      <h1>Customer Dashboard</h1>
      <p>Welcome, {firstName}!</p>
    </div>
  );
};

export default CustomerDashboard;