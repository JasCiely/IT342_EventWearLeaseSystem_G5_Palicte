import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  CalendarDays,
  TicketCheck,
  UserCircle,
  History,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles
} from 'lucide-react';

// 1. Import your actual logo file
import eventWearLogo from '../../assets/logo.png'; 

// Isolated CSS
import '../../components/css/customerDashboard/CustomerDashboardUnique.css';

// Fragments
import DashboardFragment from './fragment/DashboardFragment';
import BrowseOutfitsFragment from './fragment/BrowseOutfitsFragment';
import ScheduleFittingFragment from './fragment/ScheduleFittingFragment';
import ScheduleBookingFragment from './fragment/ScheduleBookingFragment';
import ManageProfileFragment from './fragment/ManageProfileFragment';
import PastBookingsFragment from './fragment/PastBookingsFragment';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/customer/dashboard' },
  { key: 'outfits', label: 'Browse Outfits', icon: ShoppingBag, path: '/customer/outfits' },
  { key: 'fitting', label: 'Schedule Fitting', icon: CalendarDays, path: '/customer/fitting' },
  { key: 'booking', label: 'Book Event', icon: TicketCheck, path: '/customer/booking' },
  { key: 'profile', label: 'My Profile', icon: UserCircle, path: '/customer/profile' },
  { key: 'history', label: 'Past Bookings', icon: History, path: '/customer/history' },
];

const renderFragment = (key) => {
  switch (key) {
    case 'dashboard': return <DashboardFragment />;
    case 'outfits': return <BrowseOutfitsFragment />;
    case 'fitting': return <ScheduleFittingFragment />;
    case 'booking': return <ScheduleBookingFragment />;
    case 'profile': return <ManageProfileFragment />;
    case 'history': return <PastBookingsFragment />;
    default: return <DashboardFragment />;
  }
};

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const firstName = localStorage.getItem('firstName') || 'Customer';

  const activeKey = NAV_ITEMS.find(item => location.pathname.startsWith(item.path))?.key || 'dashboard';

  const handleLogout = () => {
    localStorage.clear();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="cust-layout">
      {/* Matched Fixed Header from image_a9cb88.png */}
      <header className="cust-header">
        <div className={`cust-header-brand ${collapsed ? 'collapsed' : ''}`}>
          {/* Logo Container with your actual logo.png */}
          <div className="cust-logo-container">
            <img src={eventWearLogo} alt="Logo" className="cust-actual-logo" />
          </div>
          <div className="cust-brand-text">
            <span className="cust-brand-name">EventWear</span>
            <span className="cust-brand-sub">Customer Portal</span>
          </div>
        </div>

        <div className="cust-header-right">
          <div className="cust-welcome-box">
            <span className="cust-welcome-greet">Welcome back,</span>
            <span className="cust-welcome-name">{firstName}</span>
          </div>
          <div className="cust-divider" />
          <button className="cust-btn-action" onClick={() => navigate('/customer/outfits')}>
            <Sparkles size={16} />
            <span>New Booking</span>
          </button>
          <button className="cust-btn-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="cust-body">
        {/* Sidebar Font and Layout matched to image_a94784.png */}
        <aside className={`cust-sidebar ${collapsed ? 'collapsed' : ''}`}>
          {!collapsed && (
            <div className="cust-sidebar-label">
              <span className="cust-sidebar-dot" />
              <span className="cust-sidebar-label-text">Menu</span>
            </div>
          )}

          <nav className="cust-nav-list">
            {NAV_ITEMS.map(({ key, label, icon: Icon, path }) => (
              <button
                key={key}
                className={`cust-nav-item ${activeKey === key ? 'active' : ''}`}
                onClick={() => navigate(path)}
                title={collapsed ? label : ''}
              >
                <span className="cust-icon-wrap">
                  <Icon size={18} />
                </span>
                {!collapsed && <span className="cust-label-text">{label}</span>}
              </button>
            ))}
          </nav>

          <button className="cust-sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </aside>

        <main className="cust-main">
          {renderFragment(activeKey)}
        </main>
      </div>
    </div>
  );
};

export default CustomerDashboard;