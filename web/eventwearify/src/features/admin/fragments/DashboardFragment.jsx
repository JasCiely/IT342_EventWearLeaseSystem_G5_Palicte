import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck, Clock,
  Package, PackageCheck, AlertCircle,
  TrendingUp, Users, BarChart2, Bell, ArrowRight,
  Zap, ShoppingBag, Activity, Star,
} from 'lucide-react';
import { getAllFittingBookings, getAllDirectBookings, fetchItems } from '../services/inventoryApi';
import { fetchCustomers } from '../services/customerService';
import { sseService } from '../../../shared/services/sseService';
import '../styles/DashboardFragment.css';

const STATUS_META = {
  CONFIRMED:       { label: 'Confirmed',   color: '#0369a1', bg: 'rgba(3,105,161,0.1)' },
  Pending:         { label: 'Pending',     color: '#b45309', bg: 'rgba(180,83,9,0.1)' },
  Approved:        { label: 'Approved',    color: '#15803d', bg: 'rgba(21,128,61,0.1)' },
  Rejected:        { label: 'Rejected',    color: '#991b1b', bg: 'rgba(153,27,27,0.1)' },
  Cancelled:       { label: 'Cancelled',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  CANCELLED:       { label: 'Cancelled',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  Completed:       { label: 'Completed',   color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)' },
  COMPLETED:       { label: 'Completed',   color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)' },
  'Active Lease':  { label: 'Active Lease',color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  Returned:        { label: 'Returned',    color: '#0e7490', bg: 'rgba(14,116,144,0.1)' },
  LEASE_CONVERTED: { label: 'Converted',   color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
};

const formatDate = (s) =>
  s ? new Date(s).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const formatDateTime = (d) =>
  d ? d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const fetchAllPages = async (fetchFn) => {
  const first = await fetchFn(0, 500);
  const content = Array.isArray(first) ? first : (first?.content ?? []);
  const total = first?.totalElements ?? content.length;
  if (total <= 500 || content.length >= total) return content;
  const all = await fetchFn(0, total);
  return Array.isArray(all) ? all : (all?.content ?? []);
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const DashboardFragment = () => {
  const navigate = useNavigate();
  const [error, setError]             = useState(null);
  const [fittings, setFittings]       = useState([]);
  const [directs, setDirects]         = useState([]);
  const [itemCount, setItemCount]     = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  const adminName = localStorage.getItem('firstName') || 'Admin';

  const load = useCallback(async () => {
    setError(null);
    try {
      const [f, d, items, customers] = await Promise.all([
        fetchAllPages(getAllFittingBookings),
        fetchAllPages(getAllDirectBookings),
        fetchItems().catch(() => []),
        fetchCustomers({ page: 0, size: 1 }).catch(() => ({ totalElements: 0 })),
      ]);
      setFittings(Array.isArray(f) ? f : []);
      setDirects(Array.isArray(d) ? d : []);
      setItemCount(Array.isArray(items) ? items.length : 0);
      setCustomerCount(customers?.totalElements ?? 0);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    }
  }, []);

  useEffect(() => {
    load();
    sseService.connect();
    const unsubBooking   = sseService.on('BOOKING_UPDATE',   load);
    const unsubInventory = sseService.on('INVENTORY_UPDATE', load);
    return () => { unsubBooking(); unsubInventory(); };
  }, [load]);

  const totalBookings    = fittings.length + directs.length;
  const activeBookings   = fittings.filter(b => b.status === 'CONFIRMED').length
                         + directs.filter(b => ['Pending', 'Approved'].includes(b.bookingStatus)).length;
  const cancelled        = fittings.filter(b => ['Cancelled', 'CANCELLED'].includes(b.status)).length
                         + directs.filter(b => ['Cancelled', 'Rejected'].includes(b.bookingStatus)).length;
  const completed        = fittings.filter(b => b.status === 'COMPLETED').length
                         + directs.filter(b => b.bookingStatus === 'Completed').length;
  const activeLeases     = directs.filter(b => b.bookingStatus === 'Active Lease').length;
  const pendingApprovals   = directs.filter(b => b.bookingStatus === 'Pending').length;
  const pendingPickups     = directs.filter(b => b.bookingStatus === 'Approved').length;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const pendingPickupsToday = directs.filter(b => b.bookingStatus === 'Approved' && b.startDate === todayStr).length;
  const leaseConverted   = fittings.filter(b => b.status === 'LEASE_CONVERTED').length;

  const itemBookingMap = {};
  [...fittings, ...directs].forEach(b => {
    if (!b.itemName) return;
    itemBookingMap[b.itemName] = (itemBookingMap[b.itemName] || 0) + 1;
  });
  const topItems = Object.entries(itemBookingMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxItemBookings = topItems[0]?.[1] || 1;

  const nowDate = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i), 1);
    const end   = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i) + 1, 1);
    const label = start.toLocaleDateString('en-PH', { month: 'short' });
    const count = [...fittings, ...directs].filter(b => {
      const c = new Date(b.createdAt);
      return c >= start && c < end;
    }).length;
    return { label, count };
  });
  const maxMonthly = Math.max(...monthlyData.map(m => m.count), 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueLeases = directs.filter(b => {
    if (b.bookingStatus !== 'Active Lease') return false;
    const end = b.endDate ? new Date(b.endDate) : null;
    return end && end < today;
  });

  const recent = [
    ...fittings.map(b => ({ ...b, _type: 'fitting' })),
    ...directs.map(b => ({ ...b, _type: 'direct' })),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  const KPI_CARDS = [
    { label: 'Total Bookings',  value: totalBookings,  icon: CalendarCheck, variant: 'total' },
    { label: 'Active Bookings', value: activeBookings, icon: Activity,      variant: 'active' },
    { label: 'Active Leases',   value: activeLeases,   icon: Package,       variant: 'rentals' },
    { label: 'Pending Pickups', value: pendingPickupsToday, icon: PackageCheck,  variant: 'pickup' },
    { label: 'Inventory Items', value: itemCount,      icon: ShoppingBag,   variant: 'items' },
    { label: 'Customers',       value: customerCount,  icon: Users,         variant: 'customers' },
  ];

  if (error) {
    return (
      <div className="adf-state adf-state-error">
        <AlertCircle size={20} />
        <span>{error}</span>
        <button className="adf-retry" onClick={() => load()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="adf-root">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="adf-header">
        <div className="adf-header-left">
          <p className="adf-greeting">{getGreeting()}, {adminName}</p>
          <h1 className="adf-title">Dashboard</h1>
          <p className="adf-subtitle">
            {new Date().toLocaleDateString('en-PH', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────── */}
      <div className="adf-kpi-grid">
        {KPI_CARDS.map(({ label, value, icon: Icon, variant }) => (
          <div key={label} className={`adf-kpi-card adf-kpi-${variant}`}>
            <div className="adf-kpi-icon"><Icon size={18} /></div>
            <div className="adf-kpi-body">
              <span className="adf-kpi-value">{value}</span>
              <span className="adf-kpi-label">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Alerts ──────────────────────────────────────── */}
      {(pendingApprovals > 0 || overdueLeases.length > 0) && (
        <div className="adf-alerts">
          {pendingApprovals > 0 && (
            <div className="adf-alert adf-alert-warning">
              <Bell size={14} />
              <span>
                <strong>{pendingApprovals}</strong> direct booking{pendingApprovals !== 1 ? 's' : ''} awaiting approval
              </span>
              <button className="adf-alert-action" onClick={() => navigate('/admin/bookings')}>
                Review <ArrowRight size={12} />
              </button>
            </div>
          )}
          {overdueLeases.length > 0 && (
            <div className="adf-alert adf-alert-danger">
              <AlertCircle size={14} />
              <span>
                <strong>{overdueLeases.length}</strong> overdue lease{overdueLeases.length !== 1 ? 's' : ''} past return date
              </span>
              <button className="adf-alert-action" onClick={() => navigate('/admin/bookings')}>
                View <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Main Grid ───────────────────────────────────── */}
      <div className="adf-main-grid">

        {/* Left column */}
        <div className="adf-col-left">

          {/* Direct Booking Pipeline */}
          <div className="adf-card">
            <div className="adf-card-header">
              <Zap size={15} className="adf-card-icon" />
              <h3 className="adf-card-title">Direct Booking Pipeline</h3>
            </div>
            <div className="adf-pipeline">
              {[
                { label: 'Pending',      count: pendingApprovals,                                      color: '#b45309', bg: 'rgba(180,83,9,0.07)' },
                { label: 'Approved',     count: pendingPickups,                                        color: '#0369a1', bg: 'rgba(3,105,161,0.07)' },
                { label: 'Active Lease', count: activeLeases,                                          color: '#7c3aed', bg: 'rgba(124,58,237,0.07)' },
                { label: 'Returned',     count: directs.filter(b => b.bookingStatus === 'Returned').length,   color: '#0e7490', bg: 'rgba(14,116,144,0.07)' },
                { label: 'Completed',    count: directs.filter(b => b.bookingStatus === 'Completed').length,  color: '#15803d', bg: 'rgba(21,128,61,0.07)' },
              ].map((stage, i, arr) => (
                <React.Fragment key={stage.label}>
                  <div
                    className="adf-pipeline-stage"
                    style={{ '--stage-color': stage.color, background: stage.bg }}
                  >
                    <span className="adf-pipeline-count" style={{ color: stage.color }}>
                      {stage.count}
                    </span>
                    <span className="adf-pipeline-label" style={{ color: stage.color }}>
                      {stage.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && <div className="adf-pipeline-arrow">›</div>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="adf-card">
            <div className="adf-card-header">
              <BarChart2 size={15} className="adf-card-icon" />
              <h3 className="adf-card-title">Booking Trend</h3>
              <span className="adf-card-sub">Last 6 months</span>
            </div>
            <div className="adf-bar-chart">
              {monthlyData.map(({ label, count }) => (
                <div key={label} className="adf-bar-col">
                  <span className="adf-bar-count">{count > 0 ? count : ''}</span>
                  <div className="adf-bar-track">
                    <div
                      className="adf-bar-fill"
                      style={{ height: `${count > 0 ? Math.max((count / maxMonthly) * 100, 8) : 0}%` }}
                    />
                  </div>
                  <span className="adf-bar-label">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="adf-card">
            <div className="adf-card-header">
              <TrendingUp size={15} className="adf-card-icon" />
              <h3 className="adf-card-title">Recent Activity</h3>
            </div>
            {recent.length === 0 ? (
              <div className="adf-empty">No booking activity yet.</div>
            ) : (
              <div className="adf-table-wrap">
                <div className="adf-table-head">
                  <span>Customer</span>
                  <span>Item</span>
                  <span>Type</span>
                  <span>Status</span>
                  <span>Date</span>
                </div>
                {recent.map((b, i) => {
                  const statusKey = b._type === 'direct' ? b.bookingStatus : b.status;
                  const meta = STATUS_META[statusKey] ?? { label: statusKey || '—', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
                  const initial = (b.customerName || '?')[0].toUpperCase();
                  return (
                    <div
                      key={`${b._type}-${b.id || b.bookingId}`}
                      className="adf-table-row"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <div className="adf-cell-customer">
                        <div className="adf-avatar">{initial}</div>
                        <span>{b.customerName || '—'}</span>
                      </div>
                      <span className="adf-cell-item">{b.itemName || '—'}</span>
                      <span className={`adf-type-badge adf-type-${b._type}`}>
                        {b._type === 'fitting' ? 'Fitting' : 'Direct'}
                      </span>
                      <span className="adf-status-pill" style={{ color: meta.color, background: meta.bg }}>
                        {meta.label}
                      </span>
                      <span className="adf-cell-date">{formatDate(b.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="adf-col-right">

          {/* Status Summary */}
          <div className="adf-card">
            <div className="adf-card-header">
              <Activity size={15} className="adf-card-icon" />
              <h3 className="adf-card-title">Status Summary</h3>
            </div>
            <div className="adf-status-list">
              {[
                { label: 'Confirmed Fittings',   count: fittings.filter(b => b.status === 'CONFIRMED').length, color: '#0369a1' },
                { label: 'Lease Conversions',    count: leaseConverted,   color: '#7c3aed' },
                { label: 'Pending Approvals',    count: pendingApprovals, color: '#b45309' },
                { label: 'Pending Pickups',      count: pendingPickupsToday, color: '#0ea5e9' },
                { label: 'Active Leases',        count: activeLeases,     color: '#7c3aed' },
                { label: 'Cancelled / Rejected', count: cancelled,        color: '#6b7280' },
                { label: 'Completed',            count: completed,        color: '#15803d' },
              ].map(({ label, count, color }) => {
                const pct = totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0;
                return (
                  <div key={label} className="adf-status-item">
                    <div className="adf-status-top">
                      <span className="adf-status-label">{label}</span>
                      <span className="adf-status-count" style={{ color }}>{count}</span>
                    </div>
                    <div className="adf-status-bar-bg">
                      <div
                        className="adf-status-bar-fill"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Booked Items */}
          <div className="adf-card">
            <div className="adf-card-header">
              <Star size={15} className="adf-card-icon" />
              <h3 className="adf-card-title">Top Booked Items</h3>
            </div>
            {topItems.length === 0 ? (
              <div className="adf-empty">No booking data yet.</div>
            ) : (
              <div className="adf-top-items">
                {topItems.map(([name, count], i) => (
                  <div key={name} className="adf-top-item">
                    <span className={
                      `adf-top-rank${i === 0 ? ' adf-rank-gold' : i === 1 ? ' adf-rank-silver' : i === 2 ? ' adf-rank-bronze' : ''}`
                    }>{i + 1}</span>
                    <div className="adf-top-info">
                      <span className="adf-top-name">{name}</span>
                      <div className="adf-top-bar-bg">
                        <div
                          className="adf-top-bar-fill"
                          style={{ width: `${(count / maxItemBookings) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="adf-top-count">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* People Overview */}
          <div className="adf-card">
            <div className="adf-card-header">
              <Users size={15} className="adf-card-icon" />
              <h3 className="adf-card-title">People Overview</h3>
            </div>
            <div className="adf-people-grid">
              <button className="adf-people-item" onClick={() => navigate('/admin/customers')}>
                <div className="adf-people-icon adf-pi-customers"><Users size={18} /></div>
                <span className="adf-people-count">{customerCount}</span>
                <span className="adf-people-label">Customers</span>
              </button>
              <button className="adf-people-item" onClick={() => navigate('/admin/inventory')}>
                <div className="adf-people-icon adf-pi-items"><Package size={18} /></div>
                <span className="adf-people-count">{itemCount}</span>
                <span className="adf-people-label">Items</span>
              </button>
            </div>
          </div>

          {/* Fitting Bookings Snapshot */}
          <div className="adf-card">
            <div className="adf-card-header">
              <Clock size={15} className="adf-card-icon" />
              <h3 className="adf-card-title">Fitting Snapshot</h3>
            </div>
            <div className="adf-fitting-snap">
              {[
                { label: 'Confirmed',  count: fittings.filter(b => b.status === 'CONFIRMED').length,       color: '#0369a1', bg: 'rgba(3,105,161,0.08)' },
                { label: 'Completed',  count: fittings.filter(b => b.status === 'COMPLETED').length,       color: '#15803d', bg: 'rgba(21,128,61,0.08)' },
                { label: 'Converted',  count: leaseConverted,                                              color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
                { label: 'Cancelled',  count: fittings.filter(b => ['Cancelled','CANCELLED'].includes(b.status)).length, color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
              ].map(({ label, count, color, bg }) => (
                <div key={label} className="adf-snap-chip" style={{ background: bg }}>
                  <span className="adf-snap-count" style={{ color }}>{count}</span>
                  <span className="adf-snap-label" style={{ color }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardFragment;
