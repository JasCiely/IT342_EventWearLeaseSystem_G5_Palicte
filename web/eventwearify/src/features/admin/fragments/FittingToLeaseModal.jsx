import React, { useState, useEffect, useRef } from 'react';
import { Calendar, X, Loader2, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { authFetch } from '../../../shared/services/apiClient.js';
import { getOccupiedDirectDates, checkDirectBookingAvailability } from '../services/inventoryApi.js';
import { useBookingSettings } from '../../../shared/hooks/useBookingSettings';
import '../../customer/styles/BrowseOutfitsFragment.css';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const todayStr   = () => new Date().toISOString().split('T')[0];
const fmtCalDate = d  => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

function isWorkingDay(dateStr, settings) {
  if (!settings?.enabled) return true;
  if (!dateStr) return true;
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  return (settings.workingDays || [1, 2, 3, 4, 5]).includes(dow);
}

function isWorkdayOver(settings) {
  const now = new Date();
  const closeMin = ((settings?.endHour ?? 17) * 60) + (settings?.endMinute ?? 0);
  return (now.getHours() * 60 + now.getMinutes()) >= closeMin;
}

function DirectDatePicker({ value, onChange, minDate, bookingSettings, occupiedRanges, disabled, label }) {
  const today = minDate || todayStr();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const [view, setView] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    if (!open) return;
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const { year, month } = view;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = new Date(year, month, 1).getDay();

  const prevMonth = () => setView(v => { const d = new Date(v.year, v.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const nextMonth = () => setView(v => { const d = new Date(v.year, v.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const canPrev   = new Date(year, month, 0).toISOString().split('T')[0] >= today;

  const isDateBlocked = ds => {
    if (!occupiedRanges?.length) return false;
    return occupiedRanges.some(r => ds >= r.startDate && ds <= r.endDate);
  };

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="fitting-cal-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`fitting-cal-trigger${!value ? ' fct-empty' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        <Calendar size={13} style={{ color: value ? '#6b2d39' : '#bbb', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>{value ? fmtCalDate(value) : `Select ${label || 'date'}`}</span>
        <ChevronDown size={13} style={{ color: '#bbb', flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div className="fitting-cal-popup">
          <div className="fitting-cal-header">
            <button type="button" className="fitting-cal-nav" onClick={prevMonth} disabled={!canPrev}><ChevronLeft size={13} /></button>
            <span className="fitting-cal-title">{MONTH_NAMES[month]} {year}</span>
            <button type="button" className="fitting-cal-nav" onClick={nextMonth}><ChevronRight size={13} /></button>
          </div>

          <div className="fitting-cal-grid">
            {DOW_LABELS.map(d => <div key={d} className="fitting-cal-dow">{d}</div>)}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const ds        = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isPast    = ds < today || (ds === todayStr() && isWorkdayOver(bookingSettings));
              const isNonWork = !isWorkingDay(ds, bookingSettings);
              const isBlocked = isDateBlocked(ds);
              const isSelected = ds === value;
              const isToday   = ds === todayStr();
              const clickable = !isPast && !isNonWork && !isBlocked;

              let cls = 'fitting-cal-day';
              if (isPast)        cls += ' fcd-past';
              else if (isNonWork) cls += ' fcd-closed';
              else if (isBlocked) cls += ' fcd-full';
              else               cls += ' fcd-avail';
              if (isSelected)    cls += ' fcd-selected';
              if (isToday && !isSelected) cls += ' fcd-today';

              return (
                <button
                  key={ds}
                  type="button"
                  className={cls}
                  onClick={() => clickable && (onChange(ds), setOpen(false))}
                  disabled={!clickable}
                  title={isPast ? 'Past date' : isNonWork ? 'Closed day' : isBlocked ? 'Already booked' : undefined}
                >
                  {day}
                  {isBlocked && !isPast && !isNonWork && <span className="fcd-dot fcd-dot-full" />}
                </button>
              );
            })}
          </div>

          <div className="fitting-cal-legend">
            <span><span className="fcl-dot fcl-avail" />Available</span>
            <span><span className="fcl-dot fcl-full" />Booked</span>
            <span><span className="fcl-dot fcl-closed" />Closed</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FittingToLeaseModal({ booking, itemDetails, onConfirm, onClose }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalDays, setTotalDays] = useState(0);
  const [dailyPrice, setDailyPrice] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dateError, setDateError] = useState('');
  const [availability, setAvailability] = useState(null);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [occupiedRanges, setOccupiedRanges] = useState([]);
  const [loadingRanges, setLoadingRanges] = useState(true);
  const { settings: bookingSettings } = useBookingSettings();
  const debounceRef = useRef(null);

  useEffect(() => {
    if (itemDetails?.price) {
      setDailyPrice(itemDetails.price);
    }
  }, [itemDetails]);

  useEffect(() => {
    let cancelled = false;
    setLoadingRanges(true);
    getOccupiedDirectDates(booking.itemId)
      .then(ranges => { if (!cancelled) setOccupiedRanges(ranges || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingRanges(false); });
    return () => { cancelled = true; };
  }, [booking.itemId]);

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
    } else {
      setTotalDays(0);
      setTotalPrice(0);
    }
  }, [startDate, endDate, dailyPrice]);

  useEffect(() => {
    if (!startDate || !endDate || !!dateError) {
      setAvailability(null);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCheckingAvail(true);
      try {
        const avail = await checkDirectBookingAvailability(booking.itemId, startDate, endDate);
        setAvailability(avail);
      } catch {
        setAvailability(null);
      } finally {
        setCheckingAvail(false);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [booking.itemId, startDate, endDate, dateError]);

  const handleStartChange = newStart => {
    setStartDate(newStart);
    if (endDate && endDate < newStart) setEndDate('');
    setDateError('');
    setAvailability(null);
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      setDateError('Please select both pickup and return dates');
      return;
    }
    if (dateError) return;
    if (availability === false) {
      setDateError('Item is not available for the selected dates');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        itemId: booking.itemId,
        itemName: booking.itemName,
        startDate,
        endDate,
        basePrice: totalPrice,
        discountAmount: 0,
        finalPrice: totalPrice,
        notes: notes || `Post-fitting rental for ${booking.itemName}`,
        preferredSize: booking.preferredSize || null,
      };
      const result = await authFetch('/admin/bookings/direct', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onConfirm(result);
    } catch (error) {
      console.error('Error creating rental booking:', error);
      alert(error.message || 'Failed to create rental booking');
    } finally {
      setSubmitting(false);
    }
  };

  const today = todayStr();

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
              <DirectDatePicker
                value={startDate}
                onChange={handleStartChange}
                minDate={today}
                bookingSettings={bookingSettings}
                occupiedRanges={occupiedRanges}
                disabled={submitting || loadingRanges}
                label="pickup date"
              />
            </div>
            <div className="inv-field">
              <label className="inv-field-label">Return Date *</label>
              <DirectDatePicker
                value={endDate}
                onChange={d => { setEndDate(d); setDateError(''); setAvailability(null); }}
                minDate={startDate || today}
                bookingSettings={bookingSettings}
                occupiedRanges={occupiedRanges}
                disabled={submitting || loadingRanges || !startDate}
                label="return date"
              />
            </div>
          </div>

          {startDate && endDate && !dateError && (
            <div style={{
              marginBottom: '0.5rem', padding: '8px 12px', borderRadius: 6, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 7,
              background: checkingAvail ? '#f9fafb'
                : availability === true  ? 'rgba(21,128,61,0.08)'
                : availability === false ? 'rgba(153,27,27,0.08)'
                : '#f9fafb',
              color: checkingAvail ? '#6b7280'
                : availability === true  ? '#15803d'
                : availability === false ? '#991b1b'
                : '#6b7280',
            }}>
              {checkingAvail
                ? <><Loader2 size={13} className="inv-spinner-inline" /> Checking availability…</>
                : availability === true
                  ? <><CheckCircle size={13} /> Item is available for these dates</>
                  : availability === false
                    ? <><AlertCircle size={13} /> Item is not available for these dates</>
                    : null}
            </div>
          )}

          {dateError && (
            <div className="bk-error-message">
              <AlertCircle size={12} /> {dateError}
            </div>
          )}

          {totalDays > 0 && !dateError && availability !== false && (
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
            disabled={submitting || !startDate || !endDate || !!dateError || availability === false || checkingAvail || loadingRanges}
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
