import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardHeader from '../components/AdminDashboardHeader';
import DashboardFragment from '../fragments/DashboardFragment';
import CustomersFragment from '../fragments/CustomersFragment';
import InventoryFragment from '../fragments/InventoryFragment';
import ProfileFragment from '../fragments/ProfileFragment';
import BookingsFragment from '../fragments/BookingsFragment';
import {
  CheckCircle,
  LayoutDashboard,
  Package,
  CalendarCheck,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Contact,
} from 'lucide-react';
import '../styles/AdminDashboardHeader.css';
import '../styles/AdminDashboard.css';
import { API_BASE_URL_ROOT } from '../../../shared/services/apiClient.js';

const API_BASE_URL = `${API_BASE_URL_ROOT}/auth`;

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
  { key: 'inventory', label: 'Inventory', icon: Package,          path: '/admin/inventory' },
  { key: 'bookings',  label: 'Bookings',  icon: CalendarCheck,    path: '/admin/bookings' },
  { key: 'customers', label: 'Customers', icon: Contact,          path: '/admin/customers' },
  { key: 'profile',   label: 'Profile',   icon: UserCircle,       path: '/admin/profile' },
];

// Render the correct fragment based on active nav key
const renderFragment = (key) => {
  switch (key) {
    case 'inventory': return <InventoryFragment />;
    case 'customers': return <CustomersFragment />;
    case 'profile':   return <ProfileFragment />;
    case 'bookings':  return <BookingsFragment />;
    case 'dashboard': return <DashboardFragment />;
    default:          return <DashboardFragment />;
  }
};

const AdminDashboard = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const firstName = localStorage.getItem('firstName') || 'Admin';

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
  }, [firstName]);

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
      <DashboardHeader
        userName={firstName}
        onLogout={handleLogout}
        onBrowse={() => navigate('/admin/inventory')}
      />

      <div className="admin-body">

        {/* Fixed sidebar */}
        <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>

          {!collapsed && (
            <div className="sidebar-brand">
              <span className="sidebar-brand-dot" />
              <span className="sidebar-brand-text">Admin Panel</span>
            </div>
          )}

          <nav className="sidebar-nav">
            {NAV_ITEMS.map(({ key, label, icon, path }) => {
              const Icon = icon;
              return (
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
              );
            })}
          </nav>

          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(prev => !prev)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </aside>

        {/* Main content — renders the active fragment */}
        <main className="admin-main">
          {renderFragment(activeKey)}
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