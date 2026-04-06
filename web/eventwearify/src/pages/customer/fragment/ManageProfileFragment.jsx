import React from 'react';
import '../../../components/css/customerDashboard/ManageProfileFragment.css';

const ManageProfileFragment = () => {
    return (
        <div className="customer-card" style={{ maxWidth: '700px' }}>
            <h2 className="card-title">Account Settings</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#2b1017', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}>JD</div>
                <div>
                    <h3 style={{ margin: 0 }}>John Doe</h3>
                    <p style={{ margin: 0, color: '#666' }}>Customer ID: #CUST-9921</p>
                </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <input type="text" placeholder="First Name" defaultValue="John" style={inputStyle} />
                <input type="text" placeholder="Last Name" defaultValue="Doe" style={inputStyle} />
                <input type="email" placeholder="Email" defaultValue="john.doe@example.com" style={inputStyle} />
                <input type="tel" placeholder="Phone Number" defaultValue="+63 912 345 6789" style={inputStyle} />
            </div>
            <button className="btn-browse" style={{ marginTop: '25px' }}>Update Profile</button>
        </div>
    );
};

const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd' };

export default ManageProfileFragment;