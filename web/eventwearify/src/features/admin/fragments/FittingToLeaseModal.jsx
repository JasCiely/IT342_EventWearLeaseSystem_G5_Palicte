import React, { useState, useEffect } from 'react';
import { Calendar, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

function FittingToLeaseModal({ booking, itemDetails, onConfirm, onClose }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalDays, setTotalDays] = useState(0);
  const [dailyPrice, setDailyPrice] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dateError, setDateError] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  useEffect(() => {
    if (itemDetails?.price) {
      setDailyPrice(itemDetails.price);
    }
  }, [itemDetails]);

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end >= start) {
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        setTotalDays(days);
        setTotalPrice(dailyPrice * days);
        setDateError('');
      } else {
        setDateError('End date must be after start date');
        setTotalDays(0);
        setTotalPrice(0);
      }
    }
  }, [startDate, endDate, dailyPrice]);

  const checkAvailability = async () => {
    if (!startDate || !endDate) return true;
    
    setCheckingAvailability(true);
    try {
      const response = await fetch(
        `http://localhost:8080/api/direct-bookings/availability?itemId=${booking.itemId}&startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`,
          },
        }
      );
      const data = await response.json();
      if (!data.available) {
        setAvailabilityError('This item is not available for the selected dates');
        return false;
      }
      setAvailabilityError('');
      return true;
    } catch (error) {
      console.error('Availability check failed:', error);
      return true;
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      setDateError('Please select both start and end dates');
      return;
    }
    
    const isAvailable = await checkAvailability();
    if (!isAvailable) return;
    
    setSubmitting(true);
    try {
      const payload = {
        itemId: booking.itemId,
        startDate,
        endDate,
        totalDays,
        basePrice: dailyPrice,
        discountAmount: 0,
        finalPrice: totalPrice,
        notes: notes || `Post-fitting rental for ${booking.itemName}`,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        preferredSize: booking.preferredSize,
        fittingBookingId: booking.id,
      };
      
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await fetch('http://localhost:8080/api/direct-bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create rental booking');
      }
      
      const result = await response.json();
      onConfirm(result);
    } catch (error) {
      console.error('Error creating rental booking:', error);
      alert(error.message || 'Failed to create rental booking');
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><Calendar size={16} style={{ marginRight: 8 }} />Proceed to Rental</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        
        <div className="inv-modal-body">
          <div className="bk-action-context">
            <div className="bk-action-customer">{booking.customerName}</div>
            <div className="bk-action-item">{booking.itemName}</div>
            <div className="bk-action-dates">
              Fitting completed: {booking.fittingDate} at {booking.fittingTime}
            </div>
          </div>

          <div className="inv-field">
            <label className="inv-field-label">Daily Rental Rate</label>
            <div className="bk-price-display">
              <span className="bk-currency">₱</span>
              <span className="bk-amount">{dailyPrice.toLocaleString()}</span>
              <span className="bk-per-day">/day</span>
            </div>
          </div>

          <div className="inv-modal-grid">
            <div className="inv-field">
              <label className="inv-field-label">Pickup Date *</label>
              <input
                type="date"
                className="inv-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={today}
              />
            </div>
            <div className="inv-field">
              <label className="inv-field-label">Return Date *</label>
              <input
                type="date"
                className="inv-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || today}
              />
            </div>
          </div>

          {dateError && (
            <div className="bk-error-message">
              <AlertCircle size={12} /> {dateError}
            </div>
          )}

          {availabilityError && (
            <div className="bk-error-message" style={{ color: '#dc2626' }}>
              <AlertCircle size={12} /> {availabilityError}
            </div>
          )}

          {checkingAvailability && (
            <div className="bk-loading-message">
              <Loader2 size={14} className="inv-spinner-inline" /> Checking availability...
            </div>
          )}

          {totalDays > 0 && !dateError && !availabilityError && (
            <div className="bk-price-summary">
              <div className="bk-summary-row">
                <span>{totalDays} day{totalDays !== 1 ? 's' : ''} × ₱{dailyPrice.toLocaleString()}</span>
                <span>₱{(dailyPrice * totalDays).toLocaleString()}</span>
              </div>
              <div className="bk-summary-row total">
                <span>Total Amount</span>
                <span className="bk-total-price">₱{totalPrice.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="inv-field">
            <label className="inv-field-label">Notes (Optional)</label>
            <textarea
              className="inv-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests or instructions..."
            />
          </div>

          <div className="bk-info-note">
            <CheckCircle size={14} />
            <span>By proceeding, you agree to our rental terms and conditions.</span>
          </div>
        </div>

        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="inv-btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !startDate || !endDate || !!dateError || !!availabilityError}
          >
            {submitting ? <Loader2 size={14} className="inv-spinner-inline" /> : <CheckCircle size={14} />}
            Confirm Rental
          </button>
        </div>
      </div>
    </div>
  );
}

export default FittingToLeaseModal;