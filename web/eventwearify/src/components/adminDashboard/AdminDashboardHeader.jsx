import React from 'react';
import '../css/adminDashboard/AdminDashboardHeader.css';

const DashboardHeader = ({ userName = "Admin", onLogout }) => {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header-content">

        {/* Left — logo / brand */}
        <div className="header-brand">
          <div className="header-brand-mark">
            <span className="header-brand-mark-inner" />
          </div>
          <div className="header-brand-text">
            <span className="header-brand-name">EventWear</span>
            <span className="header-brand-sub">Admin Dashboard</span>
          </div>
        </div>

        {/* Right — welcome + actions */}
        <div className="header-right">
          <div className="header-welcome">
            <span className="header-welcome-greeting">Welcome back,</span>
            <span className="header-welcome-name">{userName}</span>
          </div>

          <div className="header-divider" />

          <button className="btn-browse-outfits" onClick={() => console.log('Browse')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
              <path d="M3 6h18"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            Browse Outfits
          </button>

          <button className="btn-logout" onClick={onLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>

      </div>
    </header>
  );
};

export default DashboardHeader;