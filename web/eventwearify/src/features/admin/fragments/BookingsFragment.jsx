import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../styles/BookingsManagement.css';
import {
  Search, Eye, X, CheckCircle, AlertCircle, Clock, User, Phone,
  Calendar, RotateCcw, ChevronRight, PackageCheck,
  XCircle, Star, AlertTriangle,
  Loader2, ShoppingBag, Settings, Save, Sun,
  Calendar as CalendarIcon, AlarmClock, Edit3, Scissors,
  Image as ImageIcon, Video, RefreshCw, Download, FileText,
  History, CheckSquare, Square, Mail, MailX,
  TrendingUp, Filter, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  getAllFittingBookings,
  getAllDirectBookings,
  updateFittingBookingStatus,
  updateDirectBookingStatus,
  fetchItemById,
  completeFittingWithoutLease,
  rescheduleFitting,
  checkFittingAvailability,
  getAvailableTimeSlots,
  returnLease,
  extendLease,
  getUnavailableDates,
} from '../services/inventoryApi';
import { fetchBookingSettings, saveBookingSettings, getDefaultSettings } from '../services/bookingSettingsApi';
import { authFetch } from '../../../shared/services/apiClient.js';
import FittingToLeaseModal from './FittingToLeaseModal';

// ─── Status meta ────────────────────────────────────────────────────────────

const BOOKING_STATUS_META = {
  'CONFIRMED':    { color: '#15803d', bg: 'rgba(21,128,61,0.1)',   dot: '#22c55e', label: 'Confirmed' },
  'Pending':      { color: '#b45309', bg: 'rgba(180,83,9,0.1)',    dot: '#f59e0b', label: 'Pending' },
  'Approved':     { color: '#15803d', bg: 'rgba(21,128,61,0.1)',   dot: '#22c55e', label: 'Approved' },
  'Rejected':     { color: '#991b1b', bg: 'rgba(153,27,27,0.1)',   dot: '#ef4444', label: 'Rejected' },
  'Cancelled':    { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', dot: '#9ca3af', label: 'Cancelled' },
  'Completed':    { color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)',   dot: '#3b82f6', label: 'Completed' },
  'Active Lease': { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', dot: '#8b5cf6', label: 'Active Lease' },
  'Returned':     { color: '#0e7490', bg: 'rgba(14,116,144,0.1)', dot: '#06b6d4', label: 'Returned' },
  'LEASE_CONVERTED': { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', dot: '#8b5cf6', label: 'Lease Converted' },
};

const FITTING_FLOW_STEPS = ['Pending', 'Approved', 'Completed'];
const FITTING_NEXT_ACTIONS = {
  'Pending':  { label: 'Approve Fitting', icon: CheckCircle, next: 'Approved',  color: '#15803d' },
  'Approved': { label: 'Mark as Done',    icon: Star,        next: 'Completed', color: '#1d4ed8' },
};

const DIRECT_FLOW_STEPS = ['Pending', 'Approved', 'Active Lease', 'Returned', 'Completed'];
// Active Lease uses two dedicated buttons (Returned + Extend) rendered separately.
// Approved → Active Lease is handled automatically by the backend scheduler.
const DIRECT_NEXT_ACTIONS = {
  'Pending': { label: 'Approve Booking', icon: CheckCircle, next: 'Approved', color: '#15803d' },
};

const CANCELLABLE = ['Pending', 'Approved'];
const TERMINAL    = ['Completed', 'Cancelled', 'Rejected', 'LEASE_CONVERTED'];

// Default settings are now provided by getDefaultSettings() from bookingSettingsApi

const DAYS = [
  { value: 0, label: 'Sunday' },  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },{ value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const isFittingPast = (booking) => {
  if (!booking?.fittingDate) return false;
  const dateStr = booking.fittingDate;
  const timeStr = booking.fittingTime || '23:59';
  const dt = new Date(`${dateStr}T${timeStr}`);
  return dt < new Date();
};

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = BOOKING_STATUS_META[status] || { color: '#888', bg: 'rgba(0,0,0,0.06)', dot: '#888', label: status };
  return (
    <span className="inv-badge" style={{ color: m.color, background: m.bg }}>
      <span className="inv-badge-dot" style={{ background: m.dot }} />
      {m.label || status}
    </span>
  );
}

// ─── FlowStepper ─────────────────────────────────────────────────────────────

function FlowStepper({ current, isFitting }) {
  if (current === 'Cancelled' || current === 'Rejected') {
    return (
      <div className="bk-cancelled-banner">
        <XCircle size={14} /> This booking was {current === 'Cancelled' ? 'cancelled' : 'rejected'}.
      </div>
    );
  }
  const steps = isFitting ? FITTING_FLOW_STEPS : DIRECT_FLOW_STEPS;
  const activeIdx = steps.indexOf(current);
  return (
    <div className="bk-stepper">
      {steps.map((step, i) => (
        <div key={step} className={`bk-step ${i < activeIdx ? 'done' : ''} ${i === activeIdx ? 'active' : ''}`}>
          <div className="bk-step-dot">
            {i < activeIdx ? <CheckCircle size={13} /> : <span>{i + 1}</span>}
          </div>
          <div className="bk-step-label">{step}</div>
          {i < steps.length - 1 && <div className="bk-step-connector" />}
        </div>
      ))}
    </div>
  );
}

// ─── HistoryTimeline ─────────────────────────────────────────────────────────

function HistoryTimeline({ history }) {
  if (!history || history.length === 0) {
    return <div className="bk-history-empty">No history available</div>;
  }

  return (
    <div className="bk-history-timeline">
      {history.map((entry, idx) => (
        <div key={idx} className="bk-history-entry">
          <div className="bk-history-dot" />
          {idx < history.length - 1 && <div className="bk-history-line" />}
          <div className="bk-history-content">
            <div className="bk-history-header">
              <span className="bk-history-status">{entry.oldStatus} → {entry.newStatus}</span>
              <span className="bk-history-date">{new Date(entry.timestamp).toLocaleString()}</span>
            </div>
            <div className="bk-history-details">
              <span className="bk-history-actor">By: {entry.actor || 'System'}</span>
              {entry.note && <span className="bk-history-note">Note: {entry.note}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ActionModal ─────────────────────────────────────────────────────────

function ActionModal({ booking, actionDef, onConfirm, onClose }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isCancel = actionDef.next === 'Cancelled' || actionDef.next === 'Rejected';

  const handle = async () => {
    if (isCancel && !note.trim()) {
      alert('Please provide a reason for cancellation/rejection');
      return;
    }
    setSubmitting(true);
    await onConfirm({ note });
    setSubmitting(false);
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3>{actionDef.label}</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="bk-action-context">
            <div className="bk-action-customer">{booking.customerName}</div>
            <div className="bk-action-item">{booking.itemName}</div>
            {booking.startDate && (
              <div className="bk-action-dates">{booking.startDate} → {booking.endDate}</div>
            )}
            {booking.fittingDate && (
              <div className="bk-action-dates">
                <Calendar size={11} /> Fitting: {booking.fittingDate} at {booking.fittingTime}
              </div>
            )}
          </div>
          <div className="inv-field">
            <label className="inv-field-label">
              {isCancel ? 'Cancellation Reason *' : 'Notes '}
              <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              className="inv-textarea" rows={3} value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={isCancel ? "Please explain why this booking is being cancelled/rejected..." : "Any remarks…"}
              disabled={submitting}
            />
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="inv-btn-primary"
            style={{ background: actionDef.color }}
            onClick={handle} disabled={submitting}
          >
            {submitting ? <Loader2 size={13} className="inv-spinner-inline" /> : <actionDef.icon size={13} />}
            {actionDef.label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NoLeaseConfirmModal ─────────────────────────────────────────────────────

function NoLeaseConfirmModal({ booking, onConfirm, onClose }) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3>Complete Fitting Without Rental</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="bk-action-context">
            <div className="bk-action-customer">{booking.customerName}</div>
            <div className="bk-action-item">{booking.itemName}</div>
          </div>
          <div className="bk-warning-message" style={{ padding: '0.75rem', background: 'rgba(180,83,9,0.1)', borderRadius: '8px', color: '#b45309' }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: '8px' }} />
            This will mark the fitting as completed without creating a rental booking.
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="inv-btn-primary"
            style={{ background: '#1d4ed8' }}
            onClick={async () => {
              setSubmitting(true);
              await onConfirm();
              setSubmitting(false);
            }}
            disabled={submitting}
          >
            {submitting ? <Loader2 size={13} className="inv-spinner-inline" /> : <CheckCircle size={13} />}
            Confirm Completion
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ReturnLeaseModal ─────────────────────────────────────────────────────────

function ReturnLeaseModal({ booking, onConfirm, onClose }) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><RotateCcw size={15} style={{ marginRight: 6 }} />Confirm Return</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="bk-action-context">
            <div className="bk-action-customer">{booking.customerName}</div>
            <div className="bk-action-item">{booking.itemName}</div>
            <div className="bk-action-dates">{booking.startDate} → {booking.endDate}</div>
          </div>
          <div style={{ padding: '0.75rem', background: 'rgba(14,116,144,0.08)', borderRadius: 8, color: '#0e7490', fontSize: '0.82rem' }}>
            <PackageCheck size={13} style={{ display: 'inline', marginRight: 6 }} />
            This will mark the item as <strong>Returned</strong> then immediately <strong>Completed</strong>.
            Inventory availability will be restored.
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="inv-btn-primary"
            style={{ background: '#0e7490' }}
            onClick={async () => { setSubmitting(true); await onConfirm(); setSubmitting(false); }}
            disabled={submitting}
          >
            {submitting ? <Loader2 size={13} className="inv-spinner-inline" /> : <RotateCcw size={13} />}
            Mark Returned &amp; Complete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ExtendLeaseModal ─────────────────────────────────────────────────────────

function ExtendLeaseModal({ booking, onConfirm, onClose }) {
  const [newEndDate, setNewEndDate] = useState('');
  const [unavailableRanges, setUnavailableRanges] = useState([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dateError, setDateError] = useState('');

  const currentEndDate = booking.endDate;

  // minDate = day after current end
  const minDate = useMemo(() => {
    const d = new Date(currentEndDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, [currentEndDate]);

  // maxDate = day before the first future conflict (if any), enforced by the native date input
  const maxDate = useMemo(() => {
    const future = unavailableRanges
      .filter(r => r.startDate > currentEndDate)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (future.length === 0) return '';
    const d = new Date(future[0].startDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [unavailableRanges, currentEndDate]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingDates(true);
      try {
        const ranges = await getUnavailableDates(booking.inventoryItemId, booking.id);
        if (!cancelled) setUnavailableRanges(ranges || []);
      } catch (e) {
        console.error('Failed to load unavailable dates:', e);
      } finally {
        if (!cancelled) setLoadingDates(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [booking.inventoryItemId, booking.id]);

  const handleDateChange = (e) => {
    const val = e.target.value;
    setNewEndDate(val);
    setDateError('');
    if (val && maxDate && val > maxDate) {
      setDateError('Selected date conflicts with another booking for this item.');
    }
  };

  const handle = async () => {
    if (!newEndDate || dateError) return;
    setSubmitting(true);
    await onConfirm(newEndDate);
    setSubmitting(false);
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><CalendarIcon size={15} style={{ marginRight: 6 }} />Extend Lease</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="bk-action-context">
            <div className="bk-action-customer">{booking.customerName}</div>
            <div className="bk-action-item">{booking.itemName}</div>
            <div className="bk-action-dates">Current end: <strong>{currentEndDate}</strong></div>
          </div>

          {loadingDates && (
            <div style={{ fontSize: '0.75rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={12} className="inv-spinner-inline" /> Checking availability…
            </div>
          )}

          {!loadingDates && maxDate && (
            <div style={{ fontSize: '0.72rem', color: '#b45309', background: 'rgba(180,83,9,0.08)', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={11} />
              Max extension: <strong>{maxDate}</strong> — next booking starts after this date
            </div>
          )}
          {!loadingDates && !maxDate && (
            <div style={{ fontSize: '0.72rem', color: '#15803d', background: 'rgba(21,128,61,0.08)', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
              No upcoming conflicts — item is free after {currentEndDate}.
            </div>
          )}

          <div className="inv-field">
            <label className="inv-field-label"><CalendarIcon size={11} /> New End Date</label>
            <input
              type="date"
              className="inv-input"
              value={newEndDate}
              min={minDate}
              max={maxDate || undefined}
              onChange={handleDateChange}
              disabled={loadingDates}
            />
          </div>

          {dateError && (
            <div style={{ color: '#dc2626', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, marginTop: '0.25rem' }}>
              <AlertTriangle size={11} /> {dateError}
            </div>
          )}
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="inv-btn-primary"
            style={{ background: '#7c3aed' }}
            onClick={handle}
            disabled={submitting || !newEndDate || !!dateError || loadingDates}
          >
            {submitting ? <Loader2 size={13} className="inv-spinner-inline" /> : <CalendarIcon size={13} />}
            Extend Lease
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BulkActionModal ─────────────────────────────────────────────────────────

function BulkActionModal({ selectedCount, action, onConfirm, onClose }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handle = async () => {
    if ((action === 'Cancel' || action === 'Reject') && !note.trim()) {
      alert(`Please provide a reason for bulk ${action.toLowerCase()}`);
      return;
    }
    setSubmitting(true);
    await onConfirm({ note });
    setSubmitting(false);
  };

  const actionConfig = {
    'Approve': { icon: CheckCircle, color: '#15803d', label: `Approve ${selectedCount} booking${selectedCount > 1 ? 's' : ''}` },
    'Cancel':  { icon: XCircle,     color: '#991b1b', label: `Cancel ${selectedCount} booking${selectedCount > 1 ? 's' : ''}` },
    'Reject':  { icon: AlertCircle, color: '#b45309', label: `Reject ${selectedCount} booking${selectedCount > 1 ? 's' : ''}` },
  };

  const config = actionConfig[action];
  const Icon = config.icon;

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3>{config.label}</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="bk-action-context">
            <div className="bk-action-customer" style={{ color: config.color }}>
              {config.icon && <config.icon size={14} style={{ marginRight: 6 }} />}
              You are about to {action.toLowerCase()} {selectedCount} booking{selectedCount > 1 ? 's' : ''}
            </div>
          </div>
          <div className="inv-field">
            <label className="inv-field-label">
              {(action === 'Cancel' || action === 'Reject') ? 'Reason *' : 'Notes '}
              <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              className="inv-textarea" rows={3} value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={(action === 'Cancel' || action === 'Reject') ? "Please provide a reason..." : "Any remarks…"}
              disabled={submitting}
            />
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="inv-btn-primary"
            style={{ background: config.color }}
            onClick={handle} disabled={submitting}
          >
            {submitting ? <Loader2 size={13} className="inv-spinner-inline" /> : <Icon size={13} />}
            Confirm {action}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EditFittingModal ────────────────────────────────────────────────────────

function EditFittingModal({ booking, onSave, onClose, workingHours }) {
  const [date, setDate] = useState(booking.fittingDate || '');
  const [time, setTime] = useState(booking.fittingTime || '');
  const [saving, setSaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const isWorkingHour = useCallback((dateStr, timeStr) => {
    if (!workingHours?.enabled) return { valid: true };
    const dt = new Date(`${dateStr}T${timeStr}`);
    const hour = dt.getHours();
    const dayOfWeek = dt.getDay();
    if (!workingHours.workingDays?.includes(dayOfWeek)) {
      return { valid: false, message: 'Selected day is not a working day' };
    }
    if (hour < workingHours.startHour || hour >= workingHours.endHour) {
      return { valid: false, message: `Selected time is outside working hours (${workingHours.startHour}:00 - ${workingHours.endHour}:00)` };
    }
    return { valid: true };
  }, [workingHours]);

  const loadAvailableSlots = async (selectedDate) => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    try {
      const slots = await getAvailableTimeSlots(selectedDate);
      setAvailableSlots(slots || []);
    } catch (error) {
      console.error('Failed to load available slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDate(newDate);
    setAvailabilityError('');
    setTime('');
    if (newDate) loadAvailableSlots(newDate);
  };

  const handleTimeChange = (e) => {
    const newTime = e.target.value;
    setTime(newTime);
    setAvailabilityError('');
    const workingHourCheck = isWorkingHour(date, newTime);
    if (!workingHourCheck.valid) setAvailabilityError(workingHourCheck.message);
  };

  const handle = async () => {
    if (!date || !time) return;
    const workingHourCheck = isWorkingHour(date, time);
    if (!workingHourCheck.valid) return;
    setSaving(true);
    await onSave({ fittingDate: date, fittingTime: time });
    setSaving(false);
  };

  const generateTimeSlots = () => {
    const slots = [];
    const startH = workingHours?.startHour ?? 9;
    const endH   = workingHours?.endHour   ?? 17;
    const dur    = workingHours?.fittingDurationMinutes ?? 30;
    let currentH = startH;
    let currentM = workingHours?.startMinute ?? 0;

    while (currentH < endH || (currentH === endH && currentM === 0)) {
      const slot = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
      slots.push(slot);
      currentM += dur;
      if (currentM >= 60) { currentH += Math.floor(currentM / 60); currentM = currentM % 60; }
    }
    return slots;
  };

  const allTimeSlots = generateTimeSlots();

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><Edit3 size={15} style={{ marginRight: 6 }} />Edit Fitting Schedule</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="bk-action-context">
            <div className="bk-action-customer">{booking.customerName}</div>
            <div className="bk-action-item">{booking.itemName}</div>
            <div className="bk-action-dates" style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={11} /> Current: {booking.fittingDate} at {booking.fittingTime}
            </div>
          </div>
          <div className="inv-modal-grid">
            <div className="inv-field">
              <label className="inv-field-label"><CalendarIcon size={11} /> New Date</label>
              <input
                type="date" className="inv-input"
                value={date} onChange={handleDateChange}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="inv-field">
              <label className="inv-field-label"><AlarmClock size={11} /> New Time</label>
              <select
                className="inv-select"
                value={time}
                onChange={handleTimeChange}
                disabled={!date || loadingSlots}
              >
                <option value="">Select time</option>
                {allTimeSlots.map(slot => {
                  const isAvailable = availableSlots.includes(slot) || slot === booking.fittingTime;
                  return (
                    <option key={slot} value={slot} disabled={!isAvailable}>
                      {slot} {!isAvailable && '(Full)'}
                    </option>
                  );
                })}
              </select>
              {loadingSlots && <Loader2 size={12} className="inv-spinner-inline" style={{ marginTop: 4 }} />}
            </div>
          </div>
          {availabilityError && (
            <div className="bk-error-message" style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              <AlertTriangle size={12} /> {availabilityError}
            </div>
          )}
          {date && time && !availabilityError && (
            <div className="bk-time-preview" style={{ marginTop: 0 }}>
              <CalendarIcon size={12} />
              New schedule: {new Date(`${date}T${time}`).toLocaleString('en-PH', {
                weekday: 'long', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </div>
          )}
          <div className="bk-info-note" style={{ marginTop: '0.5rem', fontSize: '0.7rem' }}>
            <Clock size={12} />
            Fitting sessions are {workingHours?.fittingDurationMinutes ?? 30} minutes long. Maximum 5 bookings per time slot.
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="inv-btn-primary"
            onClick={handle}
            disabled={saving || !date || !time || !!availabilityError}
          >
            {saving ? <Loader2 size={13} className="inv-spinner-inline" /> : <Save size={13} />}
            Save Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MediaViewer ─────────────────────────────────────────────────────────────

function MediaViewer({ file }) {
  if (!file) return null;
  const isVideo = file.fileType?.startsWith('video/');
  const src = file.fileData ? `data:${file.fileType};base64,${file.fileData}` : file.url;
  if (isVideo) {
    return (
      <video className="bk-media-player" controls>
        <source src={src} type={file.fileType} />
      </video>
    );
  }
  return <img src={src} alt="Item" className="bk-media-img" />;
}

// ─── BookingDrawer ────────────────────────────────────────────────────────────

function BookingDrawer({ booking, onAction, onCancel, onClose, onEditFitting, onCompleteNoLease, onProceedToLease, onReturn, onExtend, isFitting, workingHours }) {
  const [itemDetails, setItemDetails] = useState(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('details');
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailSending, setEmailSending] = useState(false);

  const nextActions = isFitting ? FITTING_NEXT_ACTIONS : DIRECT_NEXT_ACTIONS;
  const actionDef = nextActions[booking.status];
  const canCancel = CANCELLABLE.includes(booking.status);
  const isTerminal = TERMINAL.includes(booking.status);
  const pastFitting = isFitting && isFittingPast(booking);
  const hasLeaseStarted = booking.leaseStarted || booking.leaseBookingId;
  const isCompletedWithoutLease = isFitting && booking.status === 'COMPLETED' && !hasLeaseStarted;
  const canCompleteNoLease = isFitting && booking.status === 'CONFIRMED' && !hasLeaseStarted;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const itemId = booking.itemId || booking.inventoryItemId;
      if (!itemId) return;
      setLoadingItem(true);
      try {
        const item = await fetchItemById(itemId);
        if (!cancelled) {
          setItemDetails(item);
          setCurrentMediaIndex(0);
        }
      } catch (e) {
        console.warn('Could not load item details:', e.message);
        if (!cancelled) setItemDetails(null);
      } finally {
        if (!cancelled) setLoadingItem(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [booking.itemId, booking.inventoryItemId]);

  const resendConfirmationEmail = async () => {
    setEmailSending(true);
    try {
      await authFetch(`/admin/bookings/${isFitting ? 'fitting' : 'direct'}/${booking.id}/resend-email`, { method: 'POST' });
      setEmailStatus({ type: 'success', message: 'Confirmation email resent successfully' });
      setTimeout(() => setEmailStatus(null), 3000);
    } catch (e) {
      setEmailStatus({ type: 'error', message: 'Failed to resend email' });
      setTimeout(() => setEmailStatus(null), 3000);
    } finally {
      setEmailSending(false);
    }
  };

  const mediaFiles = itemDetails?.mediaFiles || [];
  const currentMedia = mediaFiles[currentMediaIndex];
  const hasMultipleMedia = mediaFiles.length > 1;

  const nextMedia = () => setCurrentMediaIndex((prev) => (prev + 1) % mediaFiles.length);
  const prevMedia = () => setCurrentMediaIndex((prev) => (prev - 1 + mediaFiles.length) % mediaFiles.length);

  // ── FIX: resolve display name — prefer booking.itemName, fall back to
  //    itemDetails.name (fetched from inventory) for old records where
  //    itemName was never saved to the booking row
  const displayItemName = booking.itemName || itemDetails?.name || 'Unknown Item';

  return (
    <div className="bk-drawer-overlay" onClick={onClose}>
      <div className="bk-drawer" onClick={e => e.stopPropagation()}>

        <div className="bk-drawer-header">
          <div>
            <div className="bk-drawer-id">#{(booking.id || booking.bookingId || '').slice(-8)}</div>
            <div className="bk-drawer-customer">{booking.customerName}</div>
            <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="inv-badge" style={{ background: isFitting ? 'rgba(107,45,57,0.08)' : 'rgba(29,78,216,0.08)', color: isFitting ? '#6b2d39' : '#1d4ed8', fontSize: '0.68rem' }}>
                {isFitting ? <><Scissors size={10} /> Fitting</> : <><PackageCheck size={10} /> Direct Rental</>}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <StatusBadge status={booking.status} />
            <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
          </div>
        </div>

        <div className="bk-drawer-tabs">
          <button className={`bk-tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>
            Details
          </button>
          <button className={`bk-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <History size={12} /> History
          </button>
        </div>

        <div className="bk-drawer-body">

          {activeTab === 'details' && (
            <>
              {emailStatus && (
                <div className={`bk-email-status ${emailStatus.type}`}>
                  {emailStatus.type === 'success' ? <Mail size={12} /> : <MailX size={12} />}
                  {emailStatus.message}
                </div>
              )}

              {isFitting && pastFitting && booking.status === 'Approved' && (
                <div className="bk-damage-warning" style={{ background: 'rgba(29,78,216,0.07)', borderColor: 'rgba(29,78,216,0.2)', color: '#1d4ed8' }}>
                  <AlertTriangle size={13} />
                  <span>This fitting appointment has passed. Mark it as Done or reschedule.</span>
                </div>
              )}

              {hasLeaseStarted && (
                <div className="bk-damage-warning" style={{ background: 'rgba(124,58,237,0.07)', borderColor: 'rgba(124,58,237,0.2)', color: '#7c3aed' }}>
                  <PackageCheck size={13} />
                  <span>Rental booking #{booking.leaseBookingId?.slice(-8)} has been created from this fitting.</span>
                </div>
              )}

              <FlowStepper current={booking.status} isFitting={isFitting} />

              <div className="bk-detail-section">
                <div className="bk-section-label">Item</div>
                <div className="bk-item-row">
                  <div className="bk-item-thumb">
                    {loadingItem ? (
                      <Loader2 size={24} className="inv-spinner-inline" style={{ color: '#c4717f' }} />
                    ) : currentMedia ? (
                      <div className="bk-media-container">
                        <MediaViewer file={currentMedia} />
                        {hasMultipleMedia && (
                          <div className="bk-media-controls">
                            <button onClick={prevMedia} className="bk-media-nav">‹</button>
                            <span className="bk-media-counter">{currentMediaIndex + 1}/{mediaFiles.length}</span>
                            <button onClick={nextMedia} className="bk-media-nav">›</button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bk-no-media">
                        <ShoppingBag size={28} style={{ color: '#c4717f', opacity: 0.5 }} />
                        <span>No image</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    {/* Uses displayItemName which falls back to itemDetails.name
                        for old records that have empty itemName in the DB */}
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                      {displayItemName}
                    </div>
                    {itemDetails && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.3rem' }}>
                        <span className="inv-cat-tag">{itemDetails.category}</span>
                        {itemDetails.subtype && <span className="inv-subtype-tag">{itemDetails.subtype}</span>}
                      </div>
                    )}
                    {booking.preferredSize && (
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>
                        <b>Size:</b> {booking.preferredSize}
                      </div>
                    )}
                    {itemDetails?.color && (
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>
                        <b>Color:</b> {itemDetails.color}
                      </div>
                    )}
                    {itemDetails?.price && (
                      <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600, marginTop: '0.2rem' }}>
                        ₱{itemDetails.price.toLocaleString()}/day
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bk-detail-section">
                <div className="bk-section-label">Customer</div>
                <div className="bk-info-grid">
                  <div className="bk-info-row"><User size={12} /><span>{booking.customerName}</span></div>
                  {booking.customerPhone && <div className="bk-info-row"><Phone size={12} /><span>{booking.customerPhone}</span></div>}
                  {booking.customerEmail && (
                    <div className="bk-info-row">
                      <Mail size={12} /><span>{booking.customerEmail}</span>
                      <button
                        className="bk-resend-email-btn"
                        onClick={resendConfirmationEmail}
                        disabled={emailSending}
                        title="Resend confirmation email"
                      >
                        {emailSending ? <Loader2 size={10} className="inv-spinner-inline" /> : <RefreshCw size={10} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isFitting && booking.fittingDate && (
                <div className="bk-detail-section">
                  <div className="bk-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Fitting Schedule</span>
                    {!isTerminal && !hasLeaseStarted && (
                      <button
                        className="inv-btn-sm outline"
                        style={{ fontSize: '0.68rem', padding: '0.2rem 0.6rem' }}
                        onClick={() => onEditFitting(booking)}
                      >
                        <Edit3 size={10} /> Edit
                      </button>
                    )}
                  </div>
                  <div className="bk-dates-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className={`bk-date-card ${pastFitting ? 'bk-date-card--past' : ''}`}>
                      <div className="bk-date-label">Date</div>
                      <div className="bk-date-val">{booking.fittingDate}</div>
                      {pastFitting && <span className="bk-date-time" style={{ color: '#dc2626' }}>Past</span>}
                    </div>
                    <div className="bk-date-card">
                      <div className="bk-date-label">Time</div>
                      <div className="bk-date-val">{booking.fittingTime}</div>
                    </div>
                  </div>
                </div>
              )}

              {!isFitting && booking.startDate && (
                <div className="bk-detail-section">
                  <div className="bk-section-label">Rental Schedule</div>
                  <div className="bk-dates-grid">
                    <div className="bk-date-card">
                      <div className="bk-date-label">Start</div>
                      <div className="bk-date-val">{booking.startDate}</div>
                    </div>
                    <div className="bk-date-card">
                      <div className="bk-date-label">End</div>
                      <div className="bk-date-val">{booking.endDate}</div>
                    </div>
                    <div className="bk-date-card">
                      <div className="bk-date-label">Days</div>
                      <div className="bk-date-val">{booking.totalDays || '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {(booking.finalPrice || booking.basePrice) && (
                <div className="bk-detail-section">
                  <div className="bk-section-label">Payment</div>
                  <div className="bk-payment-summary">
                    <div className="bk-ps-row"><span>Base Price</span><span>₱{(booking.basePrice || booking.finalPrice || 0).toLocaleString()}</span></div>
                    {booking.discountAmount > 0 && (
                      <div className="bk-ps-row discount"><span>Discount</span><span>-₱{booking.discountAmount.toLocaleString()}</span></div>
                    )}
                    <div className="bk-ps-row total"><span>Total</span><span>₱{(booking.finalPrice || booking.basePrice || 0).toLocaleString()}</span></div>
                  </div>
                </div>
              )}

              {booking.notes && (
                <div className="bk-detail-section">
                  <div className="bk-section-label">Notes</div>
                  <div style={{ padding: '0.65rem 0.85rem', background: '#faf9f7', borderRadius: 8, fontSize: '0.82rem', color: '#555', lineHeight: 1.6 }}>
                    {booking.notes}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="bk-detail-section">
              <div className="bk-section-label">Status History</div>
              <HistoryTimeline history={booking.history || []} />
            </div>
          )}
        </div>

        <div className="bk-drawer-footer">
          {canCancel && !hasLeaseStarted && (
            <button
              className="inv-btn-sm danger"
              onClick={() => onCancel(booking.id, isFitting)}
            >
              <XCircle size={12} /> Cancel Booking
            </button>
          )}
          <div style={{ flex: 1 }} />

          {canCompleteNoLease && (
            <button
              className="inv-btn-sm outline"
              style={{ borderColor: '#1d4ed8', color: '#1d4ed8' }}
              onClick={() => onCompleteNoLease(booking)}
            >
              <XCircle size={12} /> Did Not Proceed
            </button>
          )}

          {isCompletedWithoutLease && (
            <button
              className="inv-btn-primary"
              style={{ background: '#15803d' }}
              onClick={() => onProceedToLease(booking)}
            >
              <PackageCheck size={13} /> Proceed to Rental <ChevronRight size={13} />
            </button>
          )}

          {/* Active Lease: two dedicated action buttons replace the single next-action pattern */}
          {!isFitting && booking.status === 'Active Lease' && (
            <>
              <button
                className="inv-btn-primary"
                style={{ background: '#0e7490' }}
                onClick={() => onReturn(booking)}
              >
                <RotateCcw size={13} /> Returned <ChevronRight size={13} />
              </button>
              <button
                className="inv-btn-primary"
                style={{ background: '#7c3aed' }}
                onClick={() => onExtend(booking)}
              >
                <CalendarIcon size={13} /> Extend <ChevronRight size={13} />
              </button>
            </>
          )}

          {actionDef && !isTerminal && !hasLeaseStarted && booking.status !== 'Active Lease' && (
            <button
              className="inv-btn-primary"
              style={{ background: actionDef.color }}
              onClick={() => onAction(booking, actionDef)}
            >
              <actionDef.icon size={13} /> {actionDef.label} <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BookingCard ──────────────────────────────────────────────────────────────

function BookingCard({ booking, isFitting, onOpen, onAction, onReturn, onExtend, selected, onSelect }) {
  const nextActions = isFitting ? FITTING_NEXT_ACTIONS : DIRECT_NEXT_ACTIONS;
  const actionDef = nextActions[booking.status];
  const isPast = isFitting && isFittingPast(booking) && booking.status === 'Approved';
  const hasLeaseStarted = booking.leaseStarted || booking.leaseBookingId;
  const isCompletedWithoutLease = isFitting && booking.status === 'COMPLETED' && !hasLeaseStarted;

  return (
    <div className={`bk-card ${isPast ? 'bk-card--alert' : ''}`}>
      <div className="bk-card-select" onClick={e => e.stopPropagation()}>
        <button className="bk-checkbox-btn" onClick={() => onSelect(booking.id)}>
          {selected ? <CheckSquare size={16} color="#c4717f" /> : <Square size={16} />}
        </button>
      </div>
      <div className="bk-card-left" onClick={() => onOpen(booking)}>
        <div className="bk-card-avatar">{booking.customerName?.charAt(0)?.toUpperCase() || 'U'}</div>
        <div className="bk-card-info">
          <div className="bk-card-customer">
            {booking.customerName}
            {isPast && (
              <span className="bk-overdue-badge"><AlertTriangle size={9} /> Past Due</span>
            )}
            {isCompletedWithoutLease && (
              <span className="bk-overdue-badge" style={{ background: 'rgba(29,78,216,0.1)', color: '#1d4ed8' }}>
                <CheckCircle size={9} /> Fitting Done
              </span>
            )}
            {hasLeaseStarted && (
              <span className="bk-overdue-badge" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
                <PackageCheck size={9} /> Lease Created
              </span>
            )}
          </div>
          <div className="bk-card-item">{booking.itemName}</div>
          <div className="bk-card-meta">
            <span>
              {isFitting
                ? <><Calendar size={10} /> {booking.fittingDate} at {booking.fittingTime}</>
                : <><Calendar size={10} /> {booking.startDate} — {booking.endDate}</>}
            </span>
            <span>
              <span className="inv-badge-dot" style={{ background: isFitting ? '#c4717f' : '#3b82f6' }} />
              {isFitting ? 'Fitting' : 'Rental'}
            </span>
          </div>
        </div>
      </div>
      <div className="bk-card-right">
        <StatusBadge status={booking.status} />
        {(booking.finalPrice || booking.basePrice) ? (
          <div className="bk-card-amount">₱{(booking.finalPrice || booking.basePrice || 0).toLocaleString()}</div>
        ) : null}
        {!isFitting && booking.status === 'Active Lease' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <button
              className="inv-btn-sm"
              style={{ background: '#0e7490', fontSize: '0.68rem' }}
              onClick={e => { e.stopPropagation(); onReturn(booking); }}
            >
              <RotateCcw size={10} /> Returned
            </button>
            <button
              className="inv-btn-sm"
              style={{ background: '#7c3aed', fontSize: '0.68rem' }}
              onClick={e => { e.stopPropagation(); onExtend(booking); }}
            >
              <CalendarIcon size={10} /> Extend
            </button>
          </div>
        ) : (
          actionDef && !TERMINAL.includes(booking.status) && !hasLeaseStarted && (
            <button
              className="inv-btn-sm"
              style={{ background: actionDef.color, fontSize: '0.7rem' }}
              onClick={e => { e.stopPropagation(); onAction(booking, actionDef); }}
            >
              <actionDef.icon size={10} /> {actionDef.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ─── ExportModal ─────────────────────────────────────────────────────────────

function ExportModal({ bookings, onClose, onExport }) {
  const [format, setFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    await onExport(bookings, format);
    setExporting(false);
    onClose();
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><Download size={15} style={{ marginRight: 6 }} />Export Bookings</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="inv-field">
            <label className="inv-field-label">Export Format</label>
            <div className="bk-export-options">
              <label className="bk-radio-label">
                <input type="radio" value="csv" checked={format === 'csv'} onChange={() => setFormat('csv')} />
                <FileText size={14} /> CSV (.csv)
              </label>
              <label className="bk-radio-label">
                <input type="radio" value="json" checked={format === 'json'} onChange={() => setFormat('json')} />
                <FileText size={14} /> JSON (.json)
              </label>
            </div>
          </div>
          <div className="bk-export-summary">
            Exporting {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 size={13} className="inv-spinner-inline" /> : <Download size={13} />}
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SettingsModal ────────────────────────────────────────────────────────────

function SettingsModal({ settings, onSave, onClose }) {
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);

  const fmt = (h) => {
    const ap = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:00 ${ap}`;
  };

  const toggleDay = (d) => setLocal(p => ({
    ...p,
    workingDays: p.workingDays.includes(d)
      ? p.workingDays.filter(x => x !== d)
      : [...p.workingDays, d],
  }));

  const handle = async () => {
    setSaving(true);
    await onSave(local);
    setSaving(false);
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><Settings size={16} style={{ marginRight: 8 }} />Booking Settings</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="inv-field" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className="inv-field-label">Enable Time Restrictions</label>
            <button
              className={`bk-toggle-btn ${local.enabled ? 'active' : ''}`}
              onClick={() => setLocal(p => ({ ...p, enabled: !p.enabled }))}
            >
              {local.enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {local.enabled && (
            <>
              <div className="inv-field">
                <label className="inv-field-label"><Clock size={12} /> Working Hours</label>
                <div className="bk-time-range">
                  <div className="bk-time-select">
                    <span>Start</span>
                    <select value={local.startHour} onChange={e => setLocal(p => ({ ...p, startHour: +e.target.value }))}>
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
                    </select>
                  </div>
                  <span>→</span>
                  <div className="bk-time-select">
                    <span>End</span>
                    <select value={local.endHour} onChange={e => setLocal(p => ({ ...p, endHour: +e.target.value }))}>
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
                    </select>
                  </div>
                </div>
                <div className="bk-time-preview">
                  <AlarmClock size={12} /> {fmt(local.startHour)} – {fmt(local.endHour)}
                </div>
              </div>
              <div className="inv-field">
                <label className="inv-field-label"><CalendarIcon size={12} /> Working Days</label>
                <div className="bk-days-grid">
                  {DAYS.map(d => (
                    <button
                      key={d.value}
                      className={`bk-day-btn ${local.workingDays.includes(d.value) ? 'active' : ''}`}
                      onClick={() => toggleDay(d.value)}
                    >
                      {d.label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="inv-field">
                <label className="inv-field-label">Timezone</label>
                <input className="inv-input" value={local.timezone} onChange={e => setLocal(p => ({ ...p, timezone: e.target.value }))} placeholder="Asia/Manila" />
              </div>
            </>
          )}

          <div className="inv-divider" />
          <div className="inv-field">
            <label className="inv-field-label">Auto-approve Threshold</label>
            <div className="bk-auto-approve">
              <span className="bk-currency-prefix">₱</span>
              <input
                type="number"
                className="inv-input"
                value={local.autoApproveThreshold}
                onChange={e => setLocal(p => ({ ...p, autoApproveThreshold: +e.target.value }))}
                style={{ width: '120px' }}
              />
              <span className="bk-auto-approve-hint">and below</span>
            </div>
            <div className="bk-settings-summary" style={{ marginTop: 8 }}>
              <TrendingUp size={14} />
              <span>Bookings with total price ≤ ₱{local.autoApproveThreshold} will be auto-approved</span>
            </div>
          </div>

          <div className="inv-field">
            <label className="inv-field-label"><Clock size={12} /> Fitting Duration (minutes)</label>
            <input
              type="number"
              className="inv-input"
              value={local.fittingDurationMinutes}
              min={5}
              max={120}
              step={5}
              onChange={e => setLocal(p => ({ ...p, fittingDurationMinutes: +e.target.value || 30 }))}
              style={{ width: '100px' }}
            />
          </div>

          <div className="bk-settings-summary">
            <Sun size={14} />
            <span>{local.enabled ? 'Bookings accepted only during working hours on working days.' : 'Time restrictions disabled — bookings accepted anytime.'}</span>
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn-primary" onClick={handle} disabled={saving}>
            {saving ? <Loader2 size={14} className="inv-spinner-inline" /> : <Save size={14} />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (toast.show) {
      const t = setTimeout(onClose, 4000);
      return () => clearTimeout(t);
    }
  }, [toast.show, onClose]);
  if (!toast.show) return null;
  return (
    <div className={`dashboard-toast ${toast.type}`}>
      {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      <span>{toast.message}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookingsManagement() {
  const [fittingBookings, setFittingBookings] = useState([]);
  const [directBookings, setDirectBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStat, setFilterStat] = useState('All');
  const [bookingType, setBookingType] = useState('all');
  const [viewTab, setViewTab] = useState('active');
  const [drawer, setDrawer] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [editFittingModal, setEditFittingModal] = useState(null);
  const [noLeaseModal, setNoLeaseModal] = useState(null);
  const [leaseModal, setLeaseModal] = useState(null);
  const [itemDetailsForLease, setItemDetailsForLease] = useState(null);
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
  const [returnModal, setReturnModal] = useState(null);
  const [extendModal, setExtendModal] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: '', end: '' });
  const [priceRangeFilter, setPriceRangeFilter] = useState({ min: '', max: '' });
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [workingHours, setWorkingHours] = useState(getDefaultSettings);

  // Load settings from backend on mount
  useEffect(() => {
    fetchBookingSettings().then(setWorkingHours).catch(console.error);
  }, []);

  const showToastMsg = useCallback((type, msg) => {
    setToast({ show: true, type, message: msg });
  }, []);

  const loadData = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    else setLoading(true);

    try {
      const [fRes, dRes] = await Promise.all([
        getAllFittingBookings(0, 500),
        getAllDirectBookings(0, 500),
      ]);

      let fitting = Array.isArray(fRes?.content) ? fRes.content : [];
      let direct = Array.isArray(dRes?.content) ? dRes.content : [];

      let fittingUpdated = false;
      fitting = fitting.map(booking => {
        if (booking.status === 'Approved' && isFittingPast(booking)) {
          fittingUpdated = true;
          updateFittingBookingStatus(booking.id, 'Completed').catch(console.error);
          return { ...booking, status: 'Completed', history: booking.history || [] };
        }
        return { ...booking, history: booking.history || [], leaseStarted: booking.leaseStarted || false, leaseBookingId: booking.leaseBookingId };
      });

      direct = direct.map(booking => ({ ...booking, history: booking.history || [] }));

      if (fittingUpdated) {
        showToastMsg('success', `${fittingUpdated} past fitting${fittingUpdated > 1 ? 's were' : ' was'} auto-completed`);
      }

      setFittingBookings(fitting);
      setDirectBookings(direct);
    } catch (e) {
      console.error(e);
      showToastMsg('error', 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToastMsg]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => { loadData(false); }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  const fetchItemForLease = useCallback(async (itemId) => {
    try {
      const item = await authFetch(`/inventory/items/${itemId}`);
      setItemDetailsForLease(item);
    } catch (error) {
      console.error('Error fetching item details:', error);
    }
  }, []);

  const allBookings = useMemo(() => {
    const fitting = fittingBookings.map(b => ({ ...b, _type: 'fitting', status: b.status }));
    const direct = directBookings.map(b => ({ ...b, _type: 'direct', status: b.bookingStatus }));

    let combined = bookingType === 'fitting' ? fitting
                 : bookingType === 'direct'  ? direct
                 : [...fitting, ...direct];

    combined = viewTab === 'active'
      ? combined.filter(b => !TERMINAL.includes(b.status))
      : combined.filter(b => TERMINAL.includes(b.status));

    const q = search.toLowerCase();
    if (q) combined = combined.filter(b =>
      b.customerName?.toLowerCase().includes(q) ||
      b.customerEmail?.toLowerCase().includes(q) ||
      b.itemName?.toLowerCase().includes(q) ||
      b.id?.toLowerCase().includes(q)
    );

    if (filterStat !== 'All') combined = combined.filter(b => b.status === filterStat);

    if (dateRangeFilter.start) {
      combined = combined.filter(b => {
        const date = b.fittingDate || b.startDate;
        return date >= dateRangeFilter.start;
      });
    }
    if (dateRangeFilter.end) {
      combined = combined.filter(b => {
        const date = b.fittingDate || b.startDate;
        return date <= dateRangeFilter.end;
      });
    }

    const price = (b) => b.finalPrice || b.basePrice || 0;
    if (priceRangeFilter.min) combined = combined.filter(b => price(b) >= parseFloat(priceRangeFilter.min));
    if (priceRangeFilter.max) combined = combined.filter(b => price(b) <= parseFloat(priceRangeFilter.max));

    combined.sort((a, b) => {
      const aPast = a._type === 'fitting' && isFittingPast(a) && a.status === 'Approved';
      const bPast = b._type === 'fitting' && isFittingPast(b) && b.status === 'Approved';
      if (aPast !== bPast) return aPast ? -1 : 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return combined;
  }, [fittingBookings, directBookings, bookingType, viewTab, search, filterStat, dateRangeFilter, priceRangeFilter]);

  const stats = useMemo(() => {
    const pendingFit   = fittingBookings.filter(b => b.status === 'Pending').length;
    const pendingDir   = directBookings.filter(b => b.bookingStatus === 'Pending').length;
    const approvedFit  = fittingBookings.filter(b => b.status === 'Approved').length;
    const approvedDir  = directBookings.filter(b => b.bookingStatus === 'Approved').length;
    const activeLease  = directBookings.filter(b => b.bookingStatus === 'Active Lease').length;
    const completedFit = fittingBookings.filter(b => b.status === 'Completed').length;
    const completedDir = directBookings.filter(b => b.bookingStatus === 'Completed').length;
    const pastFitting  = fittingBookings.filter(b => isFittingPast(b) && b.status === 'Approved').length;
    return {
      pending: pendingFit + pendingDir,
      approved: approvedFit + approvedDir,
      active: activeLease,
      completed: completedFit + completedDir,
      pastFitting,
    };
  }, [fittingBookings, directBookings]);

  const toggleSelectAll = useCallback(() => {
    if (selectedBookings.size === allBookings.length) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(allBookings.map(b => b.id)));
    }
  }, [allBookings, selectedBookings.size]);

  const toggleSelect = useCallback((id) => {
    setSelectedBookings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const getBulkActions = useCallback(() => {
    const selectedStatuses = new Set(allBookings.filter(b => selectedBookings.has(b.id)).map(b => b.status));
    const actions = [];
    if (selectedStatuses.has('Pending')) {
      actions.push({ label: 'Approve', action: 'Approve', color: '#15803d' });
      actions.push({ label: 'Reject',  action: 'Reject',  color: '#991b1b' });
    }
    if (selectedStatuses.has('Pending') || selectedStatuses.has('Approved')) {
      actions.push({ label: 'Cancel', action: 'Cancel', color: '#6b7280' });
    }
    return actions;
  }, [allBookings, selectedBookings]);

  const updateFittingStatus = useCallback(async (id, status, note) => {
    try {
      await updateFittingBookingStatus(id, status);
      setFittingBookings(prev => prev.map(b => {
        if (b.id === id) {
          const newHistory = [...(b.history || []), {
            oldStatus: b.status, newStatus: status,
            timestamp: new Date().toISOString(), actor: 'Admin', note,
          }];
          return { ...b, status, history: newHistory };
        }
        return b;
      }));
      if (drawer?.id === id && drawer._type === 'fitting') {
        setDrawer(prev => prev ? { ...prev, status } : null);
      }
      showToastMsg('success', `Status updated to ${status}`);
    } catch (e) {
      console.error(e);
      showToastMsg('error', 'Failed to update status');
    }
  }, [showToastMsg, drawer]);

  const updateDirectStatus = useCallback(async (id, status, note) => {
    try {
      await updateDirectBookingStatus(id, status);
      setDirectBookings(prev => prev.map(b => {
        if (b.id === id) {
          const newHistory = [...(b.history || []), {
            oldStatus: b.bookingStatus, newStatus: status,
            timestamp: new Date().toISOString(), actor: 'Admin', note,
          }];
          return { ...b, bookingStatus: status, history: newHistory };
        }
        return b;
      }));
      if (drawer?.id === id && drawer._type === 'direct') {
        setDrawer(prev => prev ? { ...prev, status } : null);
      }
      showToastMsg('success', `Status updated to ${status}`);
    } catch (e) {
      console.error(e);
      showToastMsg('error', 'Failed to update status');
    }
  }, [showToastMsg, drawer]);

  const handleCompleteNoLease = useCallback(async (booking) => {
    try {
      await completeFittingWithoutLease(booking.id);
      setFittingBookings(prev => prev.map(b => {
        if (b.id === booking.id) {
          const newHistory = [...(b.history || []), {
            oldStatus: b.status, newStatus: 'COMPLETED',
            timestamp: new Date().toISOString(), actor: 'Admin',
            note: 'Fitting completed without proceeding to lease',
          }];
          return { ...b, status: 'COMPLETED', history: newHistory };
        }
        return b;
      }));
      if (drawer?.id === booking.id) {
        setDrawer(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
      }
      showToastMsg('success', 'Fitting marked as completed without lease');
      setNoLeaseModal(null);
    } catch (error) {
      console.error('Error completing fitting without lease:', error);
      showToastMsg('error', 'Failed to complete fitting');
    }
  }, [showToastMsg, drawer]);

  const handleProceedToLease = useCallback((booking) => {
    fetchItemForLease(booking.itemId);
    setLeaseModal(booking);
  }, [fetchItemForLease]);

  const handleReturnLease = useCallback((booking) => {
    setReturnModal(booking);
  }, []);

  const confirmReturnLease = useCallback(async () => {
    if (!returnModal) return;
    try {
      await returnLease(returnModal.id);
      setDirectBookings(prev => prev.map(b =>
        b.id === returnModal.id ? { ...b, bookingStatus: 'Completed' } : b
      ));
      showToastMsg('success', 'Lease returned and completed');
      setReturnModal(null);
      setDrawer(null);
    } catch (e) {
      console.error(e);
      showToastMsg('error', 'Failed to return lease');
    }
  }, [returnModal, showToastMsg]);

  const handleExtendLease = useCallback((booking) => {
    setExtendModal(booking);
  }, []);

  const confirmExtendLease = useCallback(async (newEndDate) => {
    if (!extendModal) return;
    try {
      const updated = await extendLease(extendModal.id, newEndDate);
      setDirectBookings(prev => prev.map(b =>
        b.id === extendModal.id
          ? { ...b, endDate: updated.endDate || newEndDate, totalDays: updated.totalDays }
          : b
      ));
      if (drawer?.id === extendModal.id) {
        setDrawer(prev => prev
          ? { ...prev, endDate: updated.endDate || newEndDate, totalDays: updated.totalDays }
          : null);
      }
      showToastMsg('success', `Lease extended to ${newEndDate}`);
      setExtendModal(null);
    } catch (e) {
      console.error(e);
      showToastMsg('error', 'Extension failed — dates may conflict with another booking');
    }
  }, [extendModal, drawer, showToastMsg]);

  const handleLeaseConfirm = useCallback(async (result) => {
    try {
      await authFetch(`/admin/bookings/fitting/${leaseModal.id}/lease-started`, {
        method: 'PUT',
        body: JSON.stringify({ directBookingId: result.id }),
      });
      setFittingBookings(prev => prev.map(b =>
        b.id === leaseModal.id
          ? { ...b, leaseStarted: true, leaseBookingId: result.id, status: 'LEASE_CONVERTED' }
          : b
      ));
      if (result) {
        setDirectBookings(prev => [...prev, { ...result, _type: 'direct', bookingStatus: result.status || 'Pending' }]);
      }
      showToastMsg('success', 'Rental booking created successfully!');
      setLeaseModal(null);
      setItemDetailsForLease(null);
      setDrawer(null);
    } catch (error) {
      console.error('Error updating fitting booking:', error);
      showToastMsg('error', 'Rental booking created but failed to update fitting record');
    }
  }, [leaseModal, showToastMsg]);

  const saveFittingSchedule = useCallback(async ({ fittingDate, fittingTime }) => {
    const booking = editFittingModal;
    if (!booking) return;
    try {
      await rescheduleFitting(booking.id, fittingDate, fittingTime);
      setFittingBookings(prev => prev.map(b =>
        b.id === booking.id ? { ...b, fittingDate, fittingTime } : b
      ));
      if (drawer?.id === booking.id) {
        setDrawer(d => ({ ...d, fittingDate, fittingTime }));
      }
      showToastMsg('success', 'Fitting schedule updated');
      setEditFittingModal(null);
    } catch (e) {
      console.error(e);
      showToastMsg('error', 'Failed to update schedule');
    }
  }, [editFittingModal, drawer, showToastMsg]);

  const bulkUpdateStatus = useCallback(async (status, note) => {
    const selectedIds = Array.from(selectedBookings);
    const fittingToUpdate = fittingBookings.filter(b => selectedIds.includes(b.id));
    const directToUpdate  = directBookings.filter(b => selectedIds.includes(b.id));
    let successCount = 0, errorCount = 0;

    for (const booking of fittingToUpdate) {
      try {
        await updateFittingBookingStatus(booking.id, status);
        setFittingBookings(prev => prev.map(b => {
          if (b.id === booking.id) {
            const newHistory = [...(b.history || []), {
              oldStatus: b.status, newStatus: status,
              timestamp: new Date().toISOString(), actor: 'Admin (Bulk)', note,
            }];
            return { ...b, status, history: newHistory };
          }
          return b;
        }));
        successCount++;
      } catch { errorCount++; }
    }

    for (const booking of directToUpdate) {
      try {
        await updateDirectBookingStatus(booking.id, status);
        setDirectBookings(prev => prev.map(b => {
          if (b.id === booking.id) {
            const newHistory = [...(b.history || []), {
              oldStatus: b.bookingStatus, newStatus: status,
              timestamp: new Date().toISOString(), actor: 'Admin (Bulk)', note,
            }];
            return { ...b, bookingStatus: status, history: newHistory };
          }
          return b;
        }));
        successCount++;
      } catch { errorCount++; }
    }

    showToastMsg('success', `Updated ${successCount} booking${successCount !== 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
    setSelectedBookings(new Set());
    setBulkAction(null);
  }, [selectedBookings, fittingBookings, directBookings, showToastMsg]);

  const cancelFitting = useCallback(async (id) => {
    await updateFittingStatus(id, 'Cancelled', 'Cancelled by admin');
    setDrawer(null);
  }, [updateFittingStatus]);

  const cancelDirect = useCallback(async (id) => {
    await updateDirectStatus(id, 'Cancelled', 'Cancelled by admin');
    setDrawer(null);
  }, [updateDirectStatus]);

  const handleRefresh = useCallback(() => { loadData(true); }, [loadData]);

  const handleExport = useCallback((bookingsToExport, format) => {
    const exportData = bookingsToExport.map(b => ({
      ID: b.id,
      Type: b._type === 'fitting' ? 'Fitting' : 'Rental',
      Customer: b.customerName,
      Email: b.customerEmail,
      Phone: b.customerPhone,
      Item: b.itemName,
      Status: b.status,
      ...(b._type === 'fitting' ? {
        FittingDate: b.fittingDate,
        FittingTime: b.fittingTime,
      } : {
        StartDate: b.startDate,
        EndDate: b.endDate,
        TotalDays: b.totalDays,
        TotalPrice: b.finalPrice || b.basePrice,
      }),
      Notes: b.notes,
      CreatedAt: b.createdAt,
    }));

    if (format === 'csv') {
      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(row => Object.values(row).map(v => `"${v || ''}"`).join(','));
      const csv = [headers, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookings_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookings_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    showToastMsg('success', `Exported ${exportData.length} bookings`);
  }, [showToastMsg]);

  const fmtHours = () => {
    const f = h => { const ap = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:00 ${ap}`; };
    return workingHours.enabled ? `${f(workingHours.startHour)} – ${f(workingHours.endHour)}` : 'Always open';
  };

  if (loading) {
    return (
      <div className="bk-root" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Loader2 size={32} className="inv-spinner-inline" />
        <p style={{ color: '#aaa', marginTop: 12 }}>Loading bookings…</p>
      </div>
    );
  }

  return (
    <div className="bk-root">

      <div className="inv-top">
        <div>
          <h2 className="inv-title">Bookings Management</h2>
          <p className="inv-subtitle">Fitting appointments &amp; direct rental bookings</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="bk-working-hours-badge">
            <Clock size={14} />
            <span>{fmtHours()}</span>
          </div>
          <button className="inv-icon-btn" onClick={handleRefresh} disabled={refreshing} title="Refresh now">
            <RefreshCw size={16} className={refreshing ? 'inv-spinner-inline' : ''} />
          </button>
          <button className="inv-btn-primary" onClick={() => setShowSettings(true)}>
            <Settings size={14} /> Settings
          </button>
        </div>
      </div>

      <div className="inv-stats">
        {[
          { label: 'Pending',      value: stats.pending,   icon: Clock,        color: '#b45309' },
          { label: 'Approved',     value: stats.approved,  icon: CheckCircle,  color: '#15803d' },
          { label: 'Active Lease', value: stats.active,    icon: PackageCheck, color: '#7c3aed' },
          { label: 'Completed',    value: stats.completed, icon: Star,         color: '#1d4ed8' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div className="inv-stat-card" key={label}>
            <div className="inv-stat-icon" style={{ background: `${color}18`, color }}><Icon size={18} /></div>
            <div>
              <div className="inv-stat-value">{value}</div>
              <div className="inv-stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {stats.pastFitting > 0 && (
        <div className="bk-alert-banner">
          <AlertTriangle size={15} />
          <span>
            <b>{stats.pastFitting}</b> fitting appointment{stats.pastFitting > 1 ? 's have' : ' has'} passed their scheduled time and need attention.
          </span>
          <button
            className="inv-btn-sm"
            style={{ background: '#b45309', marginLeft: 'auto' }}
            onClick={() => { setBookingType('fitting'); setViewTab('active'); setFilterStat('Approved'); }}
          >
            View Now
          </button>
        </div>
      )}

      <div className="inv-tabs">
        <button className={`inv-tab ${viewTab === 'active' ? 'active' : ''}`} onClick={() => setViewTab('active')}>
          <PackageCheck size={14} /> Active Bookings
        </button>
        <button className={`inv-tab ${viewTab === 'completed' ? 'active' : ''}`} onClick={() => setViewTab('completed')}>
          <Star size={14} /> Completed &amp; Archived
        </button>
      </div>

      <div className="inv-card" style={{ padding: '1rem 1.25rem' }}>
        <div className="inv-toolbar" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="inv-search-wrap">
            <Search size={13} className="inv-search-icon" />
            <input
              className="inv-search"
              placeholder="Search customer, email, item, or ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="inv-filters">
            <select className="inv-select" value={bookingType} onChange={e => setBookingType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="fitting">Fitting Only</option>
              <option value="direct">Rental Only</option>
            </select>
            <select className="inv-select" value={filterStat} onChange={e => setFilterStat(e.target.value)}>
              <option value="All">All Statuses</option>
              {viewTab === 'active' ? (
                <>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Active Lease">Active Lease</option>
                  <option value="Returned">Returned</option>
                </>
              ) : (
                <>
                  <option value="Completed">Completed</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="LEASE_CONVERTED">Lease Converted</option>
                </>
              )}
            </select>
            <button
              className={`inv-icon-btn ${showAdvancedFilters ? 'active' : ''}`}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              title="Advanced Filters"
            >
              <Filter size={14} />
              {showAdvancedFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {allBookings.length} booking{allBookings.length !== 1 ? 's' : ''}
            {selectedBookings.size > 0 && ` (${selectedBookings.size} selected)`}
          </div>
          <button className="inv-btn-ghost" onClick={() => setShowExport(true)} disabled={allBookings.length === 0}>
            <Download size={13} /> Export
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="bk-advanced-filters">
            <div className="bk-filter-group">
              <label>Date Range</label>
              <div className="bk-date-range">
                <input type="date" value={dateRangeFilter.start} onChange={e => setDateRangeFilter(prev => ({ ...prev, start: e.target.value }))} />
                <span>to</span>
                <input type="date" value={dateRangeFilter.end} onChange={e => setDateRangeFilter(prev => ({ ...prev, end: e.target.value }))} />
              </div>
            </div>
            <div className="bk-filter-group">
              <label>Price Range (₱)</label>
              <div className="bk-price-range">
                <input type="number" placeholder="Min" value={priceRangeFilter.min} onChange={e => setPriceRangeFilter(prev => ({ ...prev, min: e.target.value }))} />
                <span>to</span>
                <input type="number" placeholder="Max" value={priceRangeFilter.max} onChange={e => setPriceRangeFilter(prev => ({ ...prev, max: e.target.value }))} />
              </div>
            </div>
            <button className="inv-btn-sm" onClick={() => {
              setDateRangeFilter({ start: '', end: '' });
              setPriceRangeFilter({ min: '', max: '' });
            }}>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {selectedBookings.size > 0 && (
        <div className="bk-bulk-bar">
          <div className="bk-bulk-info">
            <CheckSquare size={14} />
            <span>{selectedBookings.size} booking{selectedBookings.size !== 1 ? 's' : ''} selected</span>
            <button className="inv-btn-sm ghost" onClick={() => setSelectedBookings(new Set())}>Clear</button>
            <button className="inv-btn-sm ghost" onClick={toggleSelectAll}>
              {selectedBookings.size === allBookings.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="bk-bulk-actions">
            {getBulkActions().map(action => (
              <button
                key={action.action}
                className="inv-btn-sm"
                style={{ background: action.color }}
                onClick={() => setBulkAction(action.action)}
              >
                {action.label} Selected
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bk-list">
        {allBookings.length === 0 ? (
          <div className="inv-card" style={{ textAlign: 'center', padding: '3rem', color: '#ccc' }}>
            <ShoppingBag size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>{viewTab === 'active' ? 'No active bookings found.' : 'No completed bookings found.'}</p>
          </div>
        ) : allBookings.map(b => (
          <BookingCard
            key={b.id}
            booking={b}
            isFitting={b._type === 'fitting'}
            onOpen={setDrawer}
            onAction={(booking, actionDef) => setActionModal({ booking, actionDef, isFitting: booking._type === 'fitting' })}
            onReturn={handleReturnLease}
            onExtend={handleExtendLease}
            selected={selectedBookings.has(b.id)}
            onSelect={toggleSelect}
          />
        ))}
      </div>

      {drawer && (
        <BookingDrawer
          booking={drawer}
          isFitting={drawer._type === 'fitting'}
          onAction={(b, a) => setActionModal({ booking: b, actionDef: a, isFitting: b._type === 'fitting' })}
          onCancel={(id, isFit) => isFit ? cancelFitting(id) : cancelDirect(id)}
          onEditFitting={setEditFittingModal}
          onCompleteNoLease={setNoLeaseModal}
          onProceedToLease={handleProceedToLease}
          onReturn={handleReturnLease}
          onExtend={handleExtendLease}
          onClose={() => setDrawer(null)}
          workingHours={workingHours}
        />
      )}

      {actionModal && (
        <ActionModal
          booking={actionModal.booking}
          actionDef={actionModal.actionDef}
          onConfirm={async ({ note }) => {
            if (actionModal.isFitting) {
              await updateFittingStatus(actionModal.booking.id, actionModal.actionDef.next, note);
            } else {
              await updateDirectStatus(actionModal.booking.id, actionModal.actionDef.next, note);
            }
            setActionModal(null);
            setDrawer(null);
          }}
          onClose={() => setActionModal(null)}
        />
      )}

      {noLeaseModal && (
        <NoLeaseConfirmModal
          booking={noLeaseModal}
          onConfirm={() => handleCompleteNoLease(noLeaseModal)}
          onClose={() => setNoLeaseModal(null)}
        />
      )}

      {returnModal && (
        <ReturnLeaseModal
          booking={returnModal}
          onConfirm={confirmReturnLease}
          onClose={() => setReturnModal(null)}
        />
      )}

      {extendModal && (
        <ExtendLeaseModal
          booking={extendModal}
          onConfirm={confirmExtendLease}
          onClose={() => setExtendModal(null)}
        />
      )}

      {bulkAction && (
        <BulkActionModal
          selectedCount={selectedBookings.size}
          action={bulkAction}
          onConfirm={async ({ note }) => {
            let status;
            switch (bulkAction) {
              case 'Approve': status = 'Approved'; break;
              case 'Cancel':  status = 'Cancelled'; break;
              case 'Reject':  status = 'Rejected'; break;
              default: return;
            }
            await bulkUpdateStatus(status, note);
          }}
          onClose={() => setBulkAction(null)}
        />
      )}

      {editFittingModal && (
        <EditFittingModal
          booking={editFittingModal}
          onSave={saveFittingSchedule}
          onClose={() => setEditFittingModal(null)}
          workingHours={workingHours}
        />
      )}

      {leaseModal && itemDetailsForLease && (
        <FittingToLeaseModal
          booking={leaseModal}
          itemDetails={itemDetailsForLease}
          onConfirm={handleLeaseConfirm}
          onClose={() => {
            setLeaseModal(null);
            setItemDetailsForLease(null);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={workingHours}
          onSave={async (s) => {
            try {
              const saved = await saveBookingSettings(s);
              setWorkingHours(saved);
              showToastMsg('success', 'Settings saved');
            } catch (e) {
              console.error(e);
              showToastMsg('error', 'Failed to save settings');
            }
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showExport && (
        <ExportModal
          bookings={allBookings}
          onExport={handleExport}
          onClose={() => setShowExport(false)}
        />
      )}

      <Toast toast={toast} onClose={() => setToast({ show: false, type: 'success', message: '' })} />
    </div>
  );
}