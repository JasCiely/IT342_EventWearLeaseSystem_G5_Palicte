import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, Clock, User, Mail, Phone, Tag, FileText, Package, Image as ImageIcon, AlertCircle, Trash2, Loader2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import '../styles/MyBookingsFragment.css';
import { cancelFittingBooking, cancelDirectBooking } from '../services/inventoryApi';

const formatDateTime = (s) =>
    s ? new Date(s).toLocaleString('en-PH', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    }) : '—';

const mapStatus = (status, type) => {
    if (!status) return 'Unknown';
    if (type === 'fitting') {
        if (status === 'CONFIRMED') return 'Confirmed';
        if (status === 'COMPLETED') return 'Completed';
        if (status === 'CANCELLED') return 'Cancelled';
        if (status === 'LEASE_CONVERTED') return 'Lease Converted';
        return status;
    }
    const statusMap = {
        'Pending': 'Pending',
        'Approved': 'Approved',
        'Active Lease': 'Active Lease',
        'Returned': 'Returned',
        'Completed': 'Completed',
        'Rejected': 'Rejected',
        'Cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
};

const getStatusClass = (status, type) => {
    const displayStatus = mapStatus(status, type);
    const classMap = {
        'Confirmed': 'status-confirmed',
        'Completed': 'status-completed',
        'Cancelled': 'status-cancelled',
        'Lease Converted': 'status-lease-converted',
        'Pending': 'status-pending',
        'Approved': 'status-approved',
        'Active Lease': 'status-active-lease',
        'Returned': 'status-returned',
        'Rejected': 'status-rejected',
        'Unknown': 'status-unknown'
    };
    return `status-badge ${classMap[displayStatus] || 'status-default'}`;
};

// Active booking = still ongoing or pending (can be cancelled or in progress)
const isActive = (booking) => {
    if (booking.type === 'fitting') {
        return booking.status === 'CONFIRMED';
    } else {
        return ['Pending', 'Approved', 'Active Lease'].includes(booking.bookingStatus);
    }
};

// Cancellable only if active and not already past
const isCancellable = (booking) => {
    if (booking.type === 'fitting') {
        return booking.status === 'CONFIRMED';
    } else {
        return booking.bookingStatus === 'Pending' || booking.bookingStatus === 'Approved';
    }
};

function BookingDetailModal({ booking, onClose }) {
    const [imageUrl, setImageUrl] = useState(null);
    const [mediaLoading, setMediaLoading] = useState(!!booking.itemId);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    useEffect(() => {
        if (!booking.itemId) return;
        const token = localStorage.getItem('token');
        fetch(`/api/inventory/items/${booking.itemId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                const files = data?.mediaFiles || [];
                const first = files.find(f => f.type === 'image') || files[0];
                setImageUrl(first?.url || null);
            })
            .catch(() => setImageUrl(null))
            .finally(() => setMediaLoading(false));
    }, [booking.itemId]);

    const isFitting = booking.type === 'fitting';
    const displayStatus = mapStatus(booking.status, booking.type);

    return ReactDOM.createPortal(
        <div className="bdm-overlay" onClick={onClose}>
            <div className="bdm-modal" onClick={(e) => e.stopPropagation()}>
                <button className="bdm-close-btn-top" onClick={onClose} aria-label="Close">
                    <X size={20} />
                </button>

                <div className="bdm-container">
                    <div className="bdm-image-section">
                        {mediaLoading && <div className="bdm-shimmer" />}
                        {!mediaLoading && imageUrl && !imgError ? (
                            <img src={imageUrl} alt={booking.itemName} className="bdm-main-img" onError={() => setImgError(true)} />
                        ) : (
                            <div className="bdm-placeholder">
                                <ImageIcon size={48} strokeWidth={1} />
                                <span>Image Unavailable</span>
                            </div>
                        )}
                        <div className="bdm-status-float">
                            <span className={getStatusClass(booking.status, booking.type)}>
                                {displayStatus}
                            </span>
                        </div>
                    </div>

                    <div className="bdm-details-section">
                        <header className="bdm-header">
                            <div className="bdm-type-indicator">
                                {isFitting ? (
                                    <><Calendar size={14} /> Fitting Appointment</>
                                ) : (
                                    <><Package size={14} /> Rental Booking</>
                                )}
                            </div>
                            <span className="bdm-sub">Ref: {isFitting ? booking.bookingId : booking.id}</span>
                            <h2 className="bdm-title">{booking.itemName}</h2>
                        </header>

                        <div className="bdm-scroll-area">
                            <section className="bdm-grid-section">
                                <h4 className="bdm-label">
                                    {isFitting ? 'Appointment Details' : 'Rental Period'}
                                </h4>
                                <div className="bdm-card-grid">
                                    {isFitting ? (
                                        <>
                                            <div className="bdm-mini-card">
                                                <Calendar size={16} />
                                                <div>
                                                    <label>Date</label>
                                                    <p>{booking.fittingDate || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="bdm-mini-card">
                                                <Clock size={16} />
                                                <div>
                                                    <label>Time</label>
                                                    <p>{booking.fittingTime || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="bdm-mini-card">
                                                <Tag size={16} />
                                                <div>
                                                    <label>Size</label>
                                                    <p>{booking.preferredSize || '—'}</p>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bdm-mini-card">
                                                <Calendar size={16} />
                                                <div>
                                                    <label>Start Date</label>
                                                    <p>{booking.startDate || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="bdm-mini-card">
                                                <Calendar size={16} />
                                                <div>
                                                    <label>End Date</label>
                                                    <p>{booking.endDate || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="bdm-mini-card">
                                                <Tag size={16} />
                                                <div>
                                                    <label>Total Days</label>
                                                    <p>{booking.totalDays || '—'}</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </section>

                            <section className="bdm-grid-section">
                                <h4 className="bdm-label">Customer Contact</h4>
                                <div className="bdm-contact-card">
                                    <div className="bdm-contact-row">
                                        <User size={16} />
                                        <span>{booking.customerName}</span>
                                    </div>
                                    <div className="bdm-contact-row">
                                        <Mail size={16} />
                                        <span>{booking.customerEmail}</span>
                                    </div>
                                    {booking.customerPhone && (
                                        <div className="bdm-contact-row">
                                            <Phone size={16} />
                                            <span>{booking.customerPhone}</span>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {!isFitting && booking.finalPrice && (
                                <section className="bdm-grid-section">
                                    <h4 className="bdm-label">Price Details</h4>
                                    <div className="bdm-notes-box">
                                        <Package size={14} className="notes-icon" />
                                        <p>₱{Number(booking.finalPrice).toLocaleString()}</p>
                                    </div>
                                </section>
                            )}

                            {booking.notes && (
                                <section className="bdm-grid-section">
                                    <h4 className="bdm-label">Notes</h4>
                                    <div className="bdm-notes-box">
                                        <FileText size={14} className="notes-icon" />
                                        <p>{booking.notes}</p>
                                    </div>
                                </section>
                            )}
                        </div>

                        <footer className="bdm-footer">
                            <Package size={14} />
                            <span>Booked on {formatDateTime(booking.createdAt)}</span>
                        </footer>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

const BookingsView = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [cancellingId, setCancellingId] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('active'); // 'active' or 'completed'

    const fetchBookings = () => {
        const token = localStorage.getItem('token');
        const fetchFittingBookings = fetch('/api/inventory/bookings/my', {
            headers: { Authorization: `Bearer ${token}` },
        }).then(res => res.ok ? res.json() : []);

        const fetchDirectBookings = fetch('/api/direct-bookings/my-all-bookings', {
            headers: { Authorization: `Bearer ${token}` },
        }).then(res => res.ok ? res.json() : []);

        return Promise.all([fetchFittingBookings, fetchDirectBookings])
            .then(([fittingData, directData]) => {
                const fittingWithType = (fittingData || []).map(b => ({ ...b, type: 'fitting' }));
                const directWithType = (directData || []).map(b => ({
                    ...b,
                    type: 'direct',
                    status: b.bookingStatus,
                    itemId: b.inventoryItemId,
                }));
                const all = [...fittingWithType, ...directWithType].sort((a, b) => 
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                setBookings(all);
            });
    };

    const loadData = async () => {
        try {
            setError(null);
            await fetchBookings();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleCancel = async (booking) => {
        const confirmMsg = booking.type === 'fitting' 
            ? 'Cancel this fitting appointment? This action cannot be undone.'
            : 'Cancel this rental booking? Cancellation is permanent.';
        if (!window.confirm(confirmMsg)) return;

        setCancellingId(booking.type === 'fitting' ? booking.bookingId : booking.id);
        try {
            if (booking.type === 'fitting') {
                await cancelFittingBooking(booking.id);
            } else {
                await cancelDirectBooking(booking.id);
            }
            await fetchBookings(); // refresh list
        } catch (err) {
            console.error('Cancel error:', err);
            alert(err.message || 'Failed to cancel booking. Please try again.');
        } finally {
            setCancellingId(null);
        }
    };

    const getDisplayId = (booking) => {
        return booking.type === 'fitting' ? booking.bookingId : booking.id;
    };

    const getDisplayDate = (booking) => {
        if (booking.type === 'fitting') return booking.fittingDate;
        return `${booking.startDate} → ${booking.endDate}`;
    };

    const getBookingTypeLabel = (booking) => {
        return booking.type === 'fitting' ? 'Fitting' : 'Rental';
    };

    // Filter based on active tab
    const activeBookings = bookings.filter(isActive);
    const completedBookings = bookings.filter(b => !isActive(b));

    const displayedBookings = activeTab === 'active' ? activeBookings : completedBookings;
    const showCancelButton = activeTab === 'active'; // Only active tab shows cancel possibility (but we also check per booking)

    const renderBookingTable = (bookingsList) => (
        <div className="bookings-table-wrap">
            <table className="bookings-table">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Booking ID</th>
                        <th>Outfit(s)</th>
                        <th>Date / Period</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {bookingsList.map(booking => {
                        const cancellable = showCancelButton && isCancellable(booking);
                        const isCancelling = cancellingId === (booking.type === 'fitting' ? booking.bookingId : booking.id);
                        return (
                            <tr key={`${booking.type}-${booking.id || booking.bookingId}`} className={cancellable ? 'cancellable-row' : ''}>
                                <td data-label="Type">
                                    <span className={`booking-type-badge ${booking.type}`}>
                                        {booking.type === 'fitting' ? (
                                            <><Calendar size={12} /> Fitting</>
                                        ) : (
                                            <><Package size={12} /> Rental</>
                                        )}
                                    </span>
                                </td>
                                <td data-label="Booking ID">
                                    <span className="booking-id">{getDisplayId(booking)}</span>
                                </td>
                                <td data-label="Outfit(s)">
                                    <span className="booking-outfit">{booking.itemName}</span>
                                </td>
                                <td data-label="Date / Period">
                                    {getDisplayDate(booking)}
                                </td>
                                <td data-label="Status">
                                    <span className={getStatusClass(booking.status, booking.type)}>
                                        {mapStatus(booking.status, booking.type)}
                                    </span>
                                </td>
                                <td data-label="Action">
                                    <div className="action-buttons">
                                        <button className="btn-details" onClick={() => setSelectedBooking(booking)}>
                                            View Details
                                        </button>
                                        {cancellable && (
                                            <button 
                                                className="btn-cancel" 
                                                onClick={() => handleCancel(booking)}
                                                disabled={isCancelling}
                                                title="Cancel this booking"
                                            >
                                                {isCancelling ? (
                                                    <Loader2 size={14} className="spinner-inline" />
                                                ) : (
                                                    <>
                                                        <Trash2 size={14} />
                                                        Cancel
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        {!cancellable && showCancelButton && (
                                            <button className="btn-cancel-disabled" disabled title="This booking cannot be cancelled">
                                                <Trash2 size={14} /> Cancel
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="bookings-root">
            <div className="bookings-header">
                <h2 className="bookings-title">Your Bookings</h2>
                <button className="btn-refresh" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw size={16} className={refreshing ? 'spin' : ''} /> Refresh
                </button>
            </div>

            {/* Tab Buttons */}
            <div className="bookings-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                    onClick={() => setActiveTab('active')}
                >
                    Active & Pending
                    <span className="tab-count">{activeBookings.length}</span>
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('completed')}
                >
                    Completed & Cancelled
                    <span className="tab-count">{completedBookings.length}</span>
                </button>
            </div>

            <div className="bookings-card">
                {loading ? (
                    <div className="loading-wrapper">
                        <div className="spinner"></div>
                        <div className="skeleton-table">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="skeleton-row">
                                    <div className="skeleton-cell"></div>
                                    <div className="skeleton-cell"></div>
                                    <div className="skeleton-cell"></div>
                                    <div className="skeleton-cell"></div>
                                    <div className="skeleton-cell"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <AlertCircle size={40} strokeWidth={1.5} />
                        <p>Error: {error}</p>
                        <button className="btn-retry" onClick={handleRefresh}>Retry</button>
                    </div>
                ) : displayedBookings.length === 0 ? (
                    <div className="empty-state">
                        <Package size={40} strokeWidth={1.5} />
                        <p>No {activeTab === 'active' ? 'active' : 'completed/cancelled'} bookings.</p>
                        <p className="empty-sub">
                            {activeTab === 'active' 
                                ? 'Your active bookings will appear here.' 
                                : 'Past or cancelled bookings will appear here.'}
                        </p>
                    </div>
                ) : (
                    renderBookingTable(displayedBookings)
                )}
            </div>

            {selectedBooking && (
                <BookingDetailModal
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                />
            )}
        </div>
    );
};

export default BookingsView;