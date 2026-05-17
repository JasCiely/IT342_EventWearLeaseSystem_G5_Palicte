import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, Mail, Phone, Calendar, Package,
    CheckCircle, XCircle, Clock, AlertCircle,
    ChevronRight, TrendingUp, Activity
} from 'lucide-react';
import '../styles/DashboardFragment.css';
import { getProfile } from '../services/userService';
import { sseService } from '../../../shared/services/sseService';

const formatDate = (s) =>
    s ? new Date(s).toLocaleDateString('en-PH', {
        year: 'numeric', month: 'short', day: 'numeric'
    }) : '—';

const formatDateTime = (s) =>
    s ? new Date(s).toLocaleString('en-PH', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }) : '—';

const mapStatus = (status, type) => {
    if (!status) return 'Unknown';
    if (type === 'fitting') {
        const m = { CONFIRMED: 'Confirmed', COMPLETED: 'Completed', CANCELLED: 'Cancelled', LEASE_CONVERTED: 'Lease Converted' };
        return m[status] || status;
    }
    return status;
};

const getStatusClass = (status, type) => {
    const s = mapStatus(status, type);
    const map = {
        'Confirmed': 'ds-badge-confirmed',
        'Completed': 'ds-badge-completed',
        'Cancelled': 'ds-badge-cancelled',
        'Lease Converted': 'ds-badge-lease',
        'Pending': 'ds-badge-pending',
        'Approved': 'ds-badge-approved',
        'Active Lease': 'ds-badge-active',
        'Returned': 'ds-badge-returned',
        'Rejected': 'ds-badge-rejected',
    };
    return `ds-status-badge ${map[s] || 'ds-badge-default'}`;
};

const isActive = (b) => {
    if (b.type === 'fitting') return b.status === 'CONFIRMED';
    return ['Pending', 'Approved', 'Active Lease'].includes(b.bookingStatus);
};

const isCompleted = (b) => {
    if (b.type === 'fitting') return b.status === 'COMPLETED' || b.status === 'LEASE_CONVERTED';
    return ['Returned', 'Completed'].includes(b.bookingStatus);
};

const isCancelled = (b) => {
    if (b.type === 'fitting') return b.status === 'CANCELLED';
    return ['Rejected', 'Cancelled'].includes(b.bookingStatus);
};

const isUpcoming = (b) => {
    if (!isActive(b)) return false;
    const dateStr = b.type === 'fitting' ? b.fittingDate : b.startDate;
    if (!dateStr) return false;
    return new Date(dateStr) > new Date();
};

const DashboardFragment = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [error, setError] = useState(null);

    const fetchAll = async () => {
        const token = localStorage.getItem('token');
        const [profileData, fittingData, directData] = await Promise.all([
            getProfile(),
            fetch('/api/inventory/bookings/my', {
                headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.ok ? r.json() : []),
            fetch('/api/direct-bookings/my-all-bookings', {
                headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.ok ? r.json() : [])
        ]);
        setProfile(profileData);
        const all = [
            ...(fittingData || []).map(b => ({ ...b, type: 'fitting' })),
            ...(directData || []).map(b => ({
                ...b,
                type: 'direct',
                status: b.bookingStatus,
                itemId: b.inventoryItemId
            }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setBookings(all);
    };

    const load = async () => {
        try {
            setError(null);
            await fetchAll();
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        load();
        sseService.connect();
        const unsub = sseService.on('BOOKING_UPDATE', load);
        return () => unsub();
    }, []);

    const activeBookings = bookings.filter(isActive);
    const upcomingBookings = bookings.filter(isUpcoming);
    const completedBookings = bookings.filter(isCompleted);
    const cancelledBookings = bookings.filter(isCancelled);
    const recentBookings = bookings.slice(0, 5);

    const initials = profile
        ? ((profile.firstName?.charAt(0) || '') + (profile.lastName?.charAt(0) || '')).toUpperCase()
        : '?';

    if (error) {
        return (
            <div className="ds-error">
                <AlertCircle size={40} strokeWidth={1.5} />
                <p>{error}</p>
                <button className="ds-btn-retry" onClick={load}>Retry</button>
            </div>
        );
    }

    return (
        <div className="ds-root">
            <div className="ds-page-header">
                <div>
                    <h1 className="ds-page-title">Dashboard</h1>
                    <p className="ds-page-sub">
                        Welcome back, {profile?.firstName || localStorage.getItem('firstName') || 'Customer'}
                    </p>
                </div>
            </div>

            <div className="ds-stats-row">
                <div className="ds-stat-card ds-stat-active">
                    <div className="ds-stat-icon"><Activity size={22} /></div>
                    <div className="ds-stat-content">
                        <span className="ds-stat-value">{activeBookings.length}</span>
                        <span className="ds-stat-label">Active Bookings</span>
                    </div>
                </div>
                <div className="ds-stat-card ds-stat-upcoming">
                    <div className="ds-stat-icon"><Clock size={22} /></div>
                    <div className="ds-stat-content">
                        <span className="ds-stat-value">{upcomingBookings.length}</span>
                        <span className="ds-stat-label">Upcoming</span>
                    </div>
                </div>
                <div className="ds-stat-card ds-stat-completed">
                    <div className="ds-stat-icon"><CheckCircle size={22} /></div>
                    <div className="ds-stat-content">
                        <span className="ds-stat-value">{completedBookings.length}</span>
                        <span className="ds-stat-label">Completed</span>
                    </div>
                </div>
                <div className="ds-stat-card ds-stat-cancelled">
                    <div className="ds-stat-icon"><XCircle size={22} /></div>
                    <div className="ds-stat-content">
                        <span className="ds-stat-value">{cancelledBookings.length}</span>
                        <span className="ds-stat-label">Cancelled</span>
                    </div>
                </div>
            </div>

            <div className="ds-main-grid">
                <div className="ds-col-left">
                    <div className="ds-card">
                        <div className="ds-card-header">
                            <h3 className="ds-card-title">Active Bookings</h3>
                            <button className="ds-link-btn" onClick={() => navigate('/customer/history')}>
                                View all <ChevronRight size={14} />
                            </button>
                        </div>
                        {activeBookings.length === 0 ? (
                            <div className="ds-empty-mini">
                                <Package size={32} strokeWidth={1.5} />
                                <p>No active bookings</p>
                                <button className="ds-btn-browse" onClick={() => navigate('/customer/outfits')}>
                                    Browse Outfits
                                </button>
                            </div>
                        ) : (
                            <div className="ds-booking-list">
                                {activeBookings.slice(0, 4).map(b => (
                                    <div key={`${b.type}-${b.id || b.bookingId}`} className="ds-booking-item">
                                        <div className="ds-booking-icon">
                                            {b.type === 'fitting' ? <Calendar size={16} /> : <Package size={16} />}
                                        </div>
                                        <div className="ds-booking-info">
                                            <p className="ds-booking-name">{b.itemName}</p>
                                            <p className="ds-booking-date">
                                                {b.type === 'fitting'
                                                    ? `Fitting: ${b.fittingDate || '—'} ${b.fittingTime || ''}`
                                                    : `Rental: ${b.startDate || '—'} → ${b.endDate || '—'}`}
                                            </p>
                                        </div>
                                        <span className={getStatusClass(b.status, b.type)}>
                                            {mapStatus(b.status, b.type)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="ds-card">
                        <div className="ds-card-header">
                            <h3 className="ds-card-title">Recent Transactions</h3>
                            <button className="ds-link-btn" onClick={() => navigate('/customer/history')}>
                                View all <ChevronRight size={14} />
                            </button>
                        </div>
                        {recentBookings.length === 0 ? (
                            <div className="ds-empty-mini">
                                <TrendingUp size={32} strokeWidth={1.5} />
                                <p>No transactions yet</p>
                            </div>
                        ) : (
                            <div className="ds-txn-table-wrap">
                                <table className="ds-txn-table">
                                    <thead>
                                        <tr>
                                            <th>Type</th>
                                            <th>Item</th>
                                            <th>Date</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentBookings.map(b => (
                                            <tr key={`txn-${b.type}-${b.id || b.bookingId}`}>
                                                <td>
                                                    <span className={`ds-type-badge ${b.type}`}>
                                                        {b.type === 'fitting' ? 'Fitting' : 'Rental'}
                                                    </span>
                                                </td>
                                                <td className="ds-item-name">{b.itemName}</td>
                                                <td className="ds-date-cell">{formatDate(b.createdAt)}</td>
                                                <td>
                                                    <span className={getStatusClass(b.status, b.type)}>
                                                        {mapStatus(b.status, b.type)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div className="ds-col-right">
                    <div className="ds-card">
                        <div className="ds-card-header">
                            <h3 className="ds-card-title">Profile</h3>
                            <button className="ds-link-btn" onClick={() => navigate('/customer/profile')}>
                                Edit <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="ds-profile-summary">
                            <div className="ds-avatar">{initials}</div>
                            <div className="ds-profile-info">
                                <p className="ds-profile-name">{profile?.firstName} {profile?.lastName}</p>
                                <div className="ds-profile-detail">
                                    <Mail size={13} />
                                    <span>{profile?.email || '—'}</span>
                                </div>
                                {profile?.phone && (
                                    <div className="ds-profile-detail">
                                        <Phone size={13} />
                                        <span>{profile.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="ds-card">
                        <div className="ds-card-header">
                            <h3 className="ds-card-title">Status Tracking</h3>
                        </div>
                        {activeBookings.length === 0 ? (
                            <div className="ds-empty-mini">
                                <Activity size={28} strokeWidth={1.5} />
                                <p>No active bookings to track</p>
                            </div>
                        ) : (
                            <div className="ds-tracking-list">
                                {activeBookings.slice(0, 3).map((b, idx) => (
                                    <div key={`track-${b.type}-${b.id || b.bookingId}`} className="ds-tracking-item">
                                        <div className="ds-tracking-dot-wrap">
                                            <div className="ds-tracking-dot ds-dot-active" />
                                            {idx < activeBookings.slice(0, 3).length - 1 && (
                                                <div className="ds-tracking-line" />
                                            )}
                                        </div>
                                        <div className="ds-tracking-content">
                                            <p className="ds-tracking-item-name">{b.itemName}</p>
                                            <p className="ds-tracking-type">
                                                {b.type === 'fitting' ? 'Fitting Appointment' : 'Rental Booking'}
                                            </p>
                                            <span className={getStatusClass(b.status, b.type)}>
                                                {mapStatus(b.status, b.type)}
                                            </span>
                                            <p className="ds-tracking-date">
                                                {b.type === 'fitting'
                                                    ? `${b.fittingDate || ''} ${b.fittingTime || ''}`
                                                    : `${b.startDate || ''} → ${b.endDate || ''}`}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="ds-card">
                        <div className="ds-card-header">
                            <h3 className="ds-card-title">Recent Updates</h3>
                        </div>
                        {bookings.length === 0 ? (
                            <div className="ds-empty-mini">
                                <AlertCircle size={28} strokeWidth={1.5} />
                                <p>No recent updates</p>
                            </div>
                        ) : (
                            <div className="ds-updates-list">
                                {bookings.slice(0, 5).map(b => (
                                    <div key={`upd-${b.type}-${b.id || b.bookingId}`} className="ds-update-item">
                                        <div className="ds-update-dot" />
                                        <div>
                                            <p className="ds-update-text">
                                                <strong>{b.itemName}</strong> — {mapStatus(b.status, b.type)}
                                            </p>
                                            <p className="ds-update-time">
                                                {formatDateTime(b.updatedAt || b.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardFragment;
