import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, Clock, User, Mail, Phone, Tag, FileText, Package, Image as ImageIcon, AlertCircle } from 'lucide-react';
import '../styles/MyBookingsFragment.css';

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
        return status === 'COMPLETED' ? 'Complete' : 'Pending';
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
    const className = displayStatus.toLowerCase().replace(/\s/g, '-');
    return `status-badge status-${className}`;
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

const PastBookingsFragment = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const fetchFittingBookings = fetch('/api/inventory/bookings/my', {
            headers: { Authorization: `Bearer ${token}` },
        }).then(res => res.ok ? res.json() : []);

        const fetchDirectBookings = fetch('/api/direct-bookings/my-all-bookings', {
            headers: { Authorization: `Bearer ${token}` },
        }).then(res => res.ok ? res.json() : []);

        Promise.all([fetchFittingBookings, fetchDirectBookings])
            .then(([fittingData, directData]) => {
                const fittingWithType = (fittingData || []).map(b => ({ ...b, type: 'fitting' }));
                const directWithType = (directData || []).map(b => ({
                    ...b,
                    type: 'direct',
                    status: b.bookingStatus,
                    itemId: b.inventoryItemId,   // add this to enable image fetching
                }));
                const all = [...fittingWithType, ...directWithType].sort((a, b) => 
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                setBookings(all);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const getDisplayId = (booking) => {
        return booking.type === 'fitting' ? booking.bookingId : booking.id;
    };

    const getDisplayDate = (booking) => {
        if (booking.type === 'fitting') return booking.fittingDate;
        return `${booking.startDate} to ${booking.endDate}`;
    };

    return (
        <div className="bookings-root">
            <div className="bookings-header">
                <h2 className="bookings-title">Your Bookings</h2>
            </div>

            <div className="bookings-card">
                <div className="bookings-table-wrap">
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
                            <button className="btn-retry" onClick={() => window.location.reload()}>Retry</button>
                        </div>
                    ) : bookings.length === 0 ? (
                        <div className="empty-state">
                            <Package size={40} strokeWidth={1.5} />
                            <p>No bookings found</p>
                            <p className="empty-sub">Start exploring our collection to make your first booking.</p>
                        </div>
                    ) : (
                        <table className="bookings-table">
                            <thead>
                                <tr>
                                    <th>Booking ID</th>
                                    <th>Outfit(s)</th>
                                    <th>Event Date / Rental Period</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map(booking => (
                                    <tr key={`${booking.type}-${booking.id || booking.bookingId}`}>
                                        <td data-label="Booking ID">
                                            <span className="booking-id">{getDisplayId(booking)}</span>
                                        </td>
                                        <td data-label="Outfit(s)">
                                            <span className="booking-outfit">{booking.itemName}</span>
                                        </td>
                                        <td data-label="Event Date / Rental Period">
                                            {getDisplayDate(booking)}
                                        </td>
                                        <td data-label="Status">
                                            <span className={getStatusClass(booking.status, booking.type)}>
                                                {mapStatus(booking.status, booking.type)}
                                            </span>
                                        </td>
                                        <td data-label="Action">
                                            <button className="btn-details" onClick={() => setSelectedBooking(booking)}>
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
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

export default PastBookingsFragment;