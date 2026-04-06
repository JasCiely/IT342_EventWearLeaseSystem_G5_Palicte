import React from 'react';
import '../../../components/css/customerDashboard/PastBookingsFragment.css';

const PastBookingsFragment = () => {
    const data = [
        { id: "124307", outfit: "Barong Tagalog", event: "April 28, 2026", status: "Complete" },
        { id: "124308", outfit: "Navy Blue Suit", event: "May 15, 2026", status: "Pending" },
    ];

    return (
        <div className="customer-card" style={{ padding: '0' }}>
            <div style={{ padding: '20px' }}>
                <h2 className="card-title">Your Past Bookings</h2>
            </div>
            <table className="customer-table">
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
                            <td>{item.id}</td>
                            <td>{item.outfit}</td>
                            <td>{item.event}</td>
                            <td>
                                <span className={`status-badge ${item.status === 'Complete' ? 'status-complete' : ''}`} 
                                      style={{ backgroundColor: item.status === 'Pending' ? '#fff4e5' : '' }}>
                                    {item.status}
                                </span>
                            </td>
                            <td><button className="btn-view-details">View Details</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default PastBookingsFragment;