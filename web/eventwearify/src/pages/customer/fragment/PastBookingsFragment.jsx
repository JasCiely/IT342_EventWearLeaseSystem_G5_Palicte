import React from 'react';
import '../../../components/css/customerDashboard/PastBookingsFragment.css';

const PastBookingsFragment = () => {
    const data = [
        { id: "#124307", outfit: "Barong Tagalog", event: "April 28, 2026", status: "Complete" },
        { id: "#124308", outfit: "Navy Blue Suit", event: "May 15, 2026", status: "Pending" },
    ];

    return (
        <div className="bookings-root">
            <div className="bookings-header">
                <h2 className="bookings-title">Your Past Bookings</h2>
            </div>
            
            <div className="bookings-card">
                <div className="bookings-table-wrap">
                    <table className="bookings-table">
                        <thead>
                            <tr>
                                <th>Booking ID</th>
                                <th>Outfit(s)</th>
                                <th>Event Date</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(item => (
                                <tr key={item.id}>
                                    <td data-label="Booking ID">
                                        <span className="booking-id">{item.id}</span>
                                    </td>
                                    <td data-label="Outfit(s)">
                                        <span className="booking-outfit">{item.outfit}</span>
                                    </td>
                                    <td data-label="Event Date">
                                        {item.event}
                                    </td>
                                    <td data-label="Status">
                                        <span className={`status-badge ${
                                            item.status === 'Complete' ? 'status-complete' : 'status-pending'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td data-label="Action">
                                        <button className="btn-details">View Details</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PastBookingsFragment;