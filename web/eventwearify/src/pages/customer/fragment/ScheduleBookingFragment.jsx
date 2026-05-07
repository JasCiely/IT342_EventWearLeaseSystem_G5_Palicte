import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { getLeasingSettings, calculateLeasePricing } from '../../admin/fragment/sharedData.js';

const ScheduleBookingFragment = () => {
    const [eventDate, setEventDate] = useState('');
    const [returnDate, setReturnDate] = useState('');
    const [instructions, setInstructions] = useState('');
    const [leasingSettings, setLeasingSettings] = useState(getLeasingSettings());
    const [errors, setErrors] = useState({});
    const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

    useEffect(() => {
        const handleSettingsChange = () => {
            setLeasingSettings(getLeasingSettings());
        };
        window.addEventListener('storage', handleSettingsChange);
        return () => window.removeEventListener('storage', handleSettingsChange);
    }, []);

    const leaseDetails = calculateLeasePricing(500, eventDate, returnDate); // 500 is placeholder daily rate

    const validateAndSubmit = () => {
        const errs = {};

        if (!eventDate) errs.eventDate = 'Event date is required';
        if (!returnDate) errs.returnDate = 'Return date is required';

        if (leaseDetails && !leaseDetails.isValid) {
            errs.returnDate = `Minimum lease is ${leaseDetails.minLeaseDays} days`;
        }

        setErrors(errs);

        if (Object.keys(errs).length === 0) {
            // Submit booking
            setToast({ show: true, type: 'success', message: 'Booking submitted successfully!' });
            setTimeout(() => setToast({ show: false }), 3000);
        }
    };

    return (
        <div className="customer-card" style={{ maxWidth: '800px', margin: 'auto' }}>
            <h2 className="card-title"><Calendar size={20} style={{ marginRight: '8px' }} />Event Booking</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                    <label style={labelStyle}>Event Date</label>
                    <input
                        type="date"
                        style={{...inputStyle, width: '90%', borderColor: errors.eventDate ? '#ef4444' : '#ddd'}}
                        value={eventDate}
                        onChange={e => setEventDate(e.target.value)}
                    />
                    {errors.eventDate && <div style={errorStyle}>{errors.eventDate}</div>}
                </div>
                <div>
                    <label style={labelStyle}>Return Date</label>
                    <input
                        type="date"
                        style={{...inputStyle, width: '90%', borderColor: errors.returnDate ? '#ef4444' : '#ddd'}}
                        value={returnDate}
                        onChange={e => setReturnDate(e.target.value)}
                    />
                    {errors.returnDate && <div style={errorStyle}>{errors.returnDate}</div>}
                </div>
            </div>

            {leaseDetails && !leaseDetails.isValid && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                    <AlertCircle size={14} style={{ color: '#dc2626', marginRight: '6px' }} />
                    <span style={{ color: '#dc2626', fontSize: '14px' }}>Minimum lease is {leaseDetails.minLeaseDays} days</span>
                </div>
            )}

            <label style={{...labelStyle, display: 'block', marginTop: '15px'}}>Special Instructions</label>
            <textarea
                style={{...inputStyle, width: '96%', height: '100px', resize: 'none'}}
                placeholder="Any specific alterations or notes..."
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
            />

            {leaseDetails && (
                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9fb', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px' }}>Lease Duration:</span>
                        <span style={{ fontWeight: '600' }}>{leaseDetails.totalDays} days</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px' }}>Base Price:</span>
                        <span>₱{leaseDetails.basePrice.toLocaleString()}</span>
                    </div>
                    {leaseDetails.discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '14px', color: '#059669' }}>Discount ({leaseDetails.weeks} weeks):</span>
                            <span style={{ color: '#059669' }}>-₱{leaseDetails.discount.toLocaleString()}</span>
                        </div>
                    )}
                    <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '16px', fontWeight: '600' }}>Total:</span>
                        <span style={{ fontSize: '16px', fontWeight: '600' }}>₱{leaseDetails.finalPrice.toLocaleString()}</span>
                    </div>
                    {leaseDetails.savingsText && (
                        <div style={{ marginTop: '8px', fontSize: '14px', color: '#059669', textAlign: 'center' }}>
                            {leaseDetails.savingsText}
                        </div>
                    )}
                </div>
            )}

            <button
                className="btn-logout"
                style={{ marginTop: '20px', width: '100%' }}
                onClick={validateAndSubmit}
                disabled={!leaseDetails || !leaseDetails.isValid}
            >
                Place Rental Booking
            </button>

            {toast.show && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    backgroundColor: toast.type === 'success' ? '#d1fae5' : '#fee2e2',
                    color: toast.type === 'success' ? '#065f46' : '#991b1b',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    <span>{toast.message}</span>
                </div>
            )}
        </div>
    );
};

const labelStyle = { fontSize: '14px', fontWeight: '600', marginBottom: '8px' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd' };
const errorStyle = { color: '#ef4444', fontSize: '12px', marginTop: '4px' };

export default ScheduleBookingFragment;