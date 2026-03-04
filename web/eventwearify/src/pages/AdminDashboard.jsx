import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardHeader from '../components/adminDashboard/AdminDashboardHeader';
import {
  CheckCircle,
  LayoutDashboard,
  Package,
  CalendarCheck,
  Users,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Contact,
} from 'lucide-react';
import '../components/css/adminDashboard/AdminDashboardHeader.css';
import '../components/css/adminDashboard/AdminDashboard.css';

const API_BASE_URL = 'http://localhost:8080/api/auth';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
  { key: 'inventory', label: 'Inventory', icon: Package,          path: '/admin/inventory' },
  { key: 'bookings',  label: 'Bookings',  icon: CalendarCheck,    path: '/admin/bookings' },
  { key: 'staff',     label: 'Staff',     icon: Users,            path: '/admin/staff' },
  { key: 'customers', label: 'Customers', icon: Contact,          path: '/admin/customers' },
  { key: 'profile',   label: 'Profile',   icon: UserCircle,       path: '/admin/profile' },
];

const AdminDashboard = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const firstName  = localStorage.getItem('firstName') || 'Admin';

  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast]         = useState({ show: false, message: '' });

  const activeKey = NAV_ITEMS.find(item => location.pathname.startsWith(item.path))?.key || 'dashboard';

  useEffect(() => {
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
    <div className="admin-layout">

      {/* Fixed top header */}
      <DashboardHeader userName={firstName} onLogout={handleLogout} />

      <div className="admin-body">

        {/* Fixed sidebar */}
        <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>

          {/* Brand mark inside sidebar */}
          {!collapsed && (
            <div className="sidebar-brand">
              <span className="sidebar-brand-dot" />
              <span className="sidebar-brand-text">Admin Panel</span>
            </div>
          )}

          <nav className="sidebar-nav">
            {NAV_ITEMS.map(({ key, label, icon: Icon, path }) => (
              <button
                key={key}
                className={`sidebar-item ${activeKey === key ? 'active' : ''}`}
                onClick={() => navigate(path)}
                title={collapsed ? label : ''}
              >
                <span className="sidebar-icon-wrap">
                  <Icon size={18} />
                </span>
                {!collapsed && <span className="sidebar-label">{label}</span>}
              </button>
            ))}
          </nav>

          {/* Collapse toggle at bottom */}
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(prev => !prev)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </aside>

        {/* Scrollable main content */}
        <main className="admin-main">
          <p style={{ color: '#aaa', fontSize: '0.95rem' }}>
            Admin dashboard content coming soon.
          </p>
        </main>
      </div>

      {/* Success toast */}
      {toast.show && (
        <div className="dashboard-toast success">
          <CheckCircle size={16} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;