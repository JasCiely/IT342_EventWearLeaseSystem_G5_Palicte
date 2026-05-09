import React from 'react';

const DashboardFragment = () => {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Top Welcome Row */}
                <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={cardStyle}>
                        <h4 style={cardTitleStyle}>Welcome back, John!</h4>
                        <p>Next fitting:</p>
                        <p style={{ fontWeight: 'bold' }}>07/23/2026 - 12:00 PM</p>
                    </div>
                    <div style={cardStyle}>
                        <h4 style={cardTitleStyle}>Current Booking Status:</h4>
                        <p style={{ color: '#666' }}>Status: Confirmed</p>
                    </div>
                </div>

                {/* Featured Outfits Grid */}
                <div style={cardStyle}>
                    <h4 style={cardTitleStyle}>Featured Outfits</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '15px' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i}>
                                <div style={{ height: '120px', backgroundColor: '#eee', borderRadius: '8px', marginBottom: '10px' }}></div>
                                <p style={{ margin: '5px 0', fontSize: '14px', fontWeight: 'bold' }}>Styled Outfit</p>
                                <button style={actionButtonStyle}>Check Availability</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={cardStyle}>
                    <h4 style={cardTitleStyle}>Browsing History (Outfits):</h4>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} style={{ width: '40px', height: '50px', backgroundColor: '#ddd', borderRadius: '4px' }}></div>
                        ))}
                    </div>
                </div>

                <div style={cardStyle}>
                    <h4 style={cardTitleStyle}>Schedule</h4>
                    <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #eee', marginBottom: '10px' }}>
                        {/* Simplified Calendar Placeholder */}
                        <div style={{ fontSize: '12px', color: '#999' }}>April 2026</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', fontSize: '10px', marginTop: '5px' }}>
                            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => <div key={d}>{d}</div>)}
                        </div>
                    </div>
                    <button style={{ ...actionButtonStyle, width: '100%', marginBottom: '8px' }}>Schedule Fitting</button>
                    <button style={{ ...actionButtonStyle, width: '100%' }}>Schedule Booking</button>
                </div>
            </div>

            {/* Bottom Row - Past Bookings Table */}
            <div style={{ gridColumn: 'span 2', ...cardStyle, padding: '0' }}>
                <h4 style={{ ...cardTitleStyle, padding: '20px' }}>Your Past Bookings</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9f9f9', textAlign: 'left', borderTop: '1px solid #eee' }}>
                            <th style={tableHeaderStyle}>Booking ID</th>
                            <th style={tableHeaderStyle}>Outfit(s)</th>
                            <th style={tableHeaderStyle}>Event Date</th>
                            <th style={tableHeaderStyle}>Status</th>
                            <th style={tableHeaderStyle}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ borderTop: '1px solid #eee' }}>
                            <td style={tableCellStyle}>124307</td>
                            <td style={tableCellStyle}>Styled Outfit s, Event Event</td>
                            <td style={tableCellStyle}>April 28, 2026</td>
                            <td style={tableCellStyle}><span style={{ color: 'green' }}>Complete</span></td>
                            <td style={tableCellStyle}><button style={{ border: 'none', background: 'none', color: 'maroon', cursor: 'pointer' }}>View Details</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Internal Styles
const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    border: '1px solid #eee'
};

const cardTitleStyle = {
    margin: '0 0 10px 0',
    fontSize: '16px',
    color: '#2b1017'
};

const actionButtonStyle = {
    padding: '8px',
    backgroundColor: '#421a24',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer'
};

const tableHeaderStyle = { padding: '15px', fontSize: '13px', color: '#666' };
const tableCellStyle = { padding: '15px', fontSize: '13px' };

export default DashboardFragment;