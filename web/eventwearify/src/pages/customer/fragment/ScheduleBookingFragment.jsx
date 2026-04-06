import React from 'react';

const ScheduleBookingFragment = () => {
    return (
        <div className="customer-card" style={{ maxWidth: '800px', margin: 'auto' }}>
            <h2 className="card-title">Event Booking</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                    <label style={labelStyle}>Event Date</label>
                    <input type="date" style={{...inputStyle, width: '90%'}} />
                </div>
                <div>
                    <label style={labelStyle}>Return Date</label>
                    <input type="date" style={{...inputStyle, width: '90%'}} />
                </div>
            </div>
            <label style={{...labelStyle, display: 'block', marginTop: '15px'}}>Special Instructions</label>
            <textarea style={{...inputStyle, width: '96%', height: '100px', resize: 'none'}} placeholder="Any specific alterations or notes..."></textarea>
            
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9fb', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '14px' }}>Estimated Total: <strong>₱0.00</strong></p>
            </div>
            <button className="btn-logout" style={{ marginTop: '20px', width: '100%' }}>Place Rental Booking</button>
        </div>
    );
};

const labelStyle = { fontSize: '14px', fontWeight: '600', marginBottom: '8px' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd' };

export default ScheduleBookingFragment;