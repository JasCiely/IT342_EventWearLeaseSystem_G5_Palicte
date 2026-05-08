import React from 'react';

const ScheduleFittingFragment = () => {
    return (
        <div className="customer-card" style={{ maxWidth: '600px', margin: 'auto' }}>
            <h2 className="card-title">Schedule a Fitting</h2>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>Pick a date and time to try on your selected outfits at our boutique.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600' }}>Select Outfit</label>
                <select style={inputStyle}><option>Select from your wishlist...</option></select>
                
                <label style={{ fontSize: '14px', fontWeight: '600' }}>Preferred Date</label>
                <input type="date" style={inputStyle} />
                
                <label style={{ fontSize: '14px', fontWeight: '600' }}>Preferred Time</label>
                <input type="time" style={inputStyle} />
                
                <button className="btn-logout" style={{ marginTop: '10px', width: '100%' }}>Confirm Fitting Schedule</button>
            </div>
        </div>
    );
};

const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' };

export default ScheduleFittingFragment;