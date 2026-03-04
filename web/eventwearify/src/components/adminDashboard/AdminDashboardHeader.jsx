import React from 'react';
import '../css/adminDashboard/AdminDashboardHeader.css'; 

const DashboardHeader = ({ userName = "Maria", onLogout }) => {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header-content">
        <div className="welcome-section">
          <h1>Welcome back, {userName}!</h1>
          <p className="subtitle">Manage your bookings and explore new outfits.</p>
        </div>
        
        <div className="header-actions">
          <button className="btn-browse-outfits" onClick={() => console.log('Browse')}>
            {/* SVG Shopping Bag Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            Browse Outfits
          </button>
          
          <button className="btn-logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;