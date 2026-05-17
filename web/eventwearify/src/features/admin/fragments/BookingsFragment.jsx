import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import '../styles/BookingsManagement.css';
import '../../customer/styles/BrowseOutfitsFragment.css';
import {
  Search, Eye, X, CheckCircle, AlertCircle, Clock, User, Phone,
  Calendar, RotateCcw, ChevronRight, ChevronLeft, PackageCheck,
  XCircle, Star, AlertTriangle,
  Loader2, ShoppingBag, Settings, Save, Sun, Plus,
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
  getBookedFittingSlots,
  returnLease,
  extendLease,
  getUnavailableDates,
  updateDirectBookingDates,
  markDirectBookingPickedUp,
  checkDirectBookingAvailability,
  markItemAvailable,
} from '../services/inventoryApi';
import { fetchBookingSettings, saveBookingSettings, getDefaultSettings } from '../services/bookingSettingsApi';
import { authFetch } from '../../../shared/services/apiClient.js';
import FittingToLeaseModal from './FittingToLeaseModal';
import CreateBookingModal from './CreateBookingModal';

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
  'COMPLETED':       { color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)',   dot: '#3b82f6', label: 'Completed' },
  'LEASE_CONVERTED': { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', dot: '#8b5cf6', label: 'Lease Converted' },
};

const FITTING_FLOW_STEPS = ['CONFIRMED', 'COMPLETED'];
const FITTING_FLOW_LABELS = { 'CONFIRMED': 'Confirmed', 'COMPLETED': 'Done' };
const FITTING_NEXT_ACTIONS = {};

const DIRECT_FLOW_STEPS = ['Pending', 'Approved', 'Active Lease', 'Returned', 'Completed'];
// Approved → Active Lease requires explicit admin confirmation via the "Picked Up" button.
// Active Lease uses two dedicated buttons (Returned + Extend) rendered separately.
const DIRECT_NEXT_ACTIONS = {
  'Pending': { label: 'Approve Booking', icon: CheckCircle, next: 'Approved', color: '#15803d' },
};

const CANCELLABLE = ['Pending', 'Approved', 'CONFIRMED'];
const TERMINAL    = ['Completed', 'COMPLETED', 'Cancelled', 'Rejected', 'LEASE_CONVERTED'];

// Default settings are now provided by getDefaultSettings() from bookingSettingsApi

const DAYS = [
  { value: 0, label: 'Sunday' },  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },{ value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

/**
 * Builds the working-hours end datetime for the day of a fitting.
 * This is the canonical expiry boundary used by both frontend and backend.
 * workingHours shape: { endHour: number, endMinute?: number }
 */
const getFittingWorkingEndTime = (booking, workingHours) => {
  if (!booking?.fittingDate) return null;
  const endHour   = workingHours?.endHour   ?? 17;
  const endMinute = workingHours?.endMinute ?? 0;
  return new Date(`${booking.fittingDate}T${String(endHour).padStart(2,'0')}:${String(endMinute).padStart(2,'0')}:00`);
};

/**
 * Returns true when the fitting START time has passed AND the working-hours
 * end time has NOT been reached yet → "Needs Attention".
 * Once the working end time is reached the booking is expired (auto-cancelled
 * by the backend) and must NOT show a warning.
 */
const isFittingInAttentionWindow = (booking, durationMinutes = 30, workingHours = null) => {
  if (!booking?.fittingDate || !booking?.fittingTime) return false;
  const now   = new Date();
  const start = new Date(`${booking.fittingDate}T${booking.fittingTime}:00`);
  // Use the working-hours end time as the expiry wall if available,
  // otherwise fall back to fittingTime + duration (legacy behaviour).
  const expiry = workingHours
    ? getFittingWorkingEndTime(booking, workingHours)
    : new Date(start.getTime() + durationMinutes * 60000);
  if (!expiry) return false;
  return now >= start && now < expiry;
};

/**
 * Returns true when the working-hours end time for the fitting day has
 * already passed → booking is expired and the backend will/has auto-cancelled it.
 * No warning or pending state should be shown after this point.
 */
const isFittingExpiredByWorkingHours = (booking, workingHours) => {
  if (!booking?.fittingDate) return false;
  const expiry = getFittingWorkingEndTime(booking, workingHours);
  if (!expiry) return false;
  return new Date() >= expiry;
};

/**
 * Legacy alias kept for sort-order and backward-compat call sites that
 * only need "is the fitting day/time in the past at all".
 */
const isFittingBeyondDutyWindow = (booking, durationMinutes = 30, workingHours = null) => {
  // If we have working hours, use the end-time wall (stricter / canonical rule).
  if (workingHours) return isFittingExpiredByWorkingHours(booking, workingHours);
  if (!booking?.fittingDate || !booking?.fittingTime) return false;
  const now   = new Date();
  const start = new Date(`${booking.fittingDate}T${booking.fittingTime}:00`);
  return now >= new Date(start.getTime() + durationMinutes * 60000);
};

/**
 * Returns true when an Approved direct booking has passed its pickup deadline.
 * Deadline = working-hours close time on startDate (or midnight of next day when
 * time restrictions are disabled).  Mirrors the backend autoExpireApprovedBookings logic.
 */
const isApprovedDirectBookingExpired = (booking, workingHours) => {
  if (!booking?.startDate) return false;
  const today = new Date().toISOString().split('T')[0];
  const startDate = booking.startDate;
  if (startDate > today) return false;
  if (startDate < today) return true;
  // startDate === today: check working-hours close time
  if (workingHours?.enabled && workingHours?.endHour !== undefined) {
    const endHour   = workingHours.endHour   ?? 17;
    const endMinute = workingHours.endMinute ?? 0;
    const deadline  = new Date(`${startDate}T${String(endHour).padStart(2,'0')}:${String(endMinute).padStart(2,'0')}:00`);
    return new Date() >= deadline;
  }
  return false;
};

/** Legacy helper kept for sort-order and card-highlight purposes.
 *  True when start time has passed (regardless of duty window). */
const isFittingPast = (booking) => {
  if (!booking?.fittingDate) return false;
  const dateStr = booking.fittingDate;
  const timeStr = booking.fittingTime || '23:59';
  const dt = new Date(`${dateStr}T${timeStr}`);
  return dt < new Date();
};

const isToday = (booking) => {
  const today = new Date().toISOString().split('T')[0];
  const date = booking.fittingDate || booking.startDate;
  return date === today;
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
  const getLabel = (step) => isFitting
    ? (FITTING_FLOW_LABELS[step] || step)
    : (BOOKING_STATUS_META[step]?.label || step);
  return (
    <div className="bk-stepper">
      {steps.map((step, i) => (
        <div key={step} className={`bk-step ${i < activeIdx ? 'done' : ''} ${i === activeIdx ? 'active' : ''}`}>
          <div className="bk-step-dot">
            {i < activeIdx ? <CheckCircle size={13} /> : <span>{i + 1}</span>}
          </div>
          <div className="bk-step-label">{getLabel(step)}</div>
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
          <h3><CheckCircle size={15} style={{ marginRight: 6, color: '#15803d' }} />Mark Fitting Done</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="bk-action-context">
            <div className="bk-action-customer">{booking.customerName}</div>
            <div className="bk-action-item">{booking.itemName}</div>
            {booking.fittingDate && (
              <div className="bk-action-dates">
                <Calendar size={11} /> {booking.fittingDate} at {booking.fittingTime}
              </div>
            )}
          </div>
          <div style={{ padding: '0.75rem', background: 'rgba(21,128,61,0.08)', borderRadius: '8px', color: '#15803d', fontSize: '0.82rem' }}>
            <CheckCircle size={14} style={{ display: 'inline', marginRight: '8px' }} />
            Mark this fitting session as completed. You can still create a rental booking afterward.
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="inv-btn-primary"
            style={{ background: '#15803d' }}
            onClick={async () => {
              setSubmitting(true);
              await onConfirm();
              setSubmitting(false);
            }}
            disabled={submitting}
          >
            {submitting ? <Loader2 size={13} className="inv-spinner-inline" /> : <CheckCircle size={13} />}
            Mark as Done
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
          <div style={{ padding: '0.75rem', background: 'rgba(13,148,136,0.08)', borderRadius: 8, color: '#0d9488', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
            <PackageCheck size={13} style={{ display: 'inline', marginRight: 6 }} />
            This will mark the item as <strong>Returned</strong> then immediately <strong>Completed</strong>.
          </div>
          <div style={{ padding: '0.75rem', background: 'rgba(154,52,18,0.08)', borderRadius: 8, color: '#9a3412', fontSize: '0.82rem' }}>
            <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
            The item will automatically enter a <strong>2-day maintenance period</strong> before becoming available again. You can override this early from the inventory page.
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="inv-btn-primary"
            style={{ background: '#0d9488' }}
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

// ─── PickedUpModal ────────────────────────────────────────────────────────────

function PickedUpModal({ booking, onConfirm, onClose }) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><PackageCheck size={15} style={{ marginRight: 6, color: '#15803d' }} />Confirm Item Pickup</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="bk-action-context">
            <div className="bk-action-customer">{booking.customerName}</div>
            <div className="bk-action-item">{booking.itemName}</div>
            <div className="bk-action-dates">{booking.startDate} → {booking.endDate}</div>
          </div>
          <div style={{ padding: '0.75rem', background: 'rgba(21,128,61,0.08)', borderRadius: 8, color: '#15803d', fontSize: '0.82rem' }}>
            <PackageCheck size={13} style={{ display: 'inline', marginRight: 6 }} />
            Confirm that the item has been <strong>physically picked up</strong> by the customer.
            This will activate the lease and enable Return and Extend actions.
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="inv-btn-primary"
            style={{ background: '#15803d' }}
            onClick={async () => { setSubmitting(true); await onConfirm(); setSubmitting(false); }}
            disabled={submitting}
          >
            {submitting ? <Loader2 size={13} className="inv-spinner-inline" /> : <PackageCheck size={13} />}
            Confirm Pickup
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CancelConfirmModal ───────────────────────────────────────────────────────

function CancelConfirmModal({ booking, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handle = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }
    setSubmitting(true);
    await onConfirm(reason);
    setSubmitting(false);
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><XCircle size={15} style={{ marginRight: 6, color: '#991b1b' }} />Cancel Booking</h3>
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
                <Calendar size={11} /> {booking.fittingDate} at {booking.fittingTime}
              </div>
            )}
          </div>
          <div style={{ padding: '0.75rem', background: 'rgba(153,27,27,0.07)', borderRadius: 8, color: '#991b1b', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
            <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
            This will cancel the booking and notify the customer. This action cannot be undone.
          </div>
          <div className="inv-field">
            <label className="inv-field-label">Cancellation Reason *</label>
            <textarea
              className="inv-textarea" rows={3} value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Please explain why this booking is being cancelled..."
              disabled={submitting}
            />
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Keep Booking</button>
          <button
            className="inv-btn-primary"
            style={{ background: '#991b1b' }}
            onClick={handle}
            disabled={submitting || !reason.trim()}
          >
            {submitting ? <Loader2 size={13} className="inv-spinner-inline" /> : <XCircle size={13} />}
            Cancel Booking
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ExtendLeaseModal ─────────────────────────────────────────────────────────

function ExtendLeaseModal({ booking, onConfirm, onClose, bookingSettings }) {
  const [newEndDate, setNewEndDate] = useState('');
  const [unavailableRanges, setUnavailableRanges] = useState([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentEndDate = booking.endDate;

  // minDate = day after current end
  const minDate = useMemo(() => {
    const d = new Date(currentEndDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, [currentEndDate]);

  // maxDate = day before the first future conflict (if any)
  const maxDate = useMemo(() => {
    const future = unavailableRanges
      .filter(r => r.startDate > currentEndDate)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (future.length === 0) return '';
    const d = new Date(future[0].startDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [unavailableRanges, currentEndDate]);

  // All dates at or beyond the first conflict must be blocked in the picker.
  // A cap range [maxDate+1, far future] is added so the DirectDatePicker disables
  // any date that would cause the extension range to overlap a future booking.
  const occupiedRangesForPicker = useMemo(() => {
    if (!maxDate) return unavailableRanges;
    const capD = new Date(maxDate + 'T12:00:00');
    capD.setDate(capD.getDate() + 1);
    const capStart = capD.toISOString().split('T')[0];
    return [...unavailableRanges, { startDate: capStart, endDate: '9999-12-31' }];
  }, [unavailableRanges, maxDate]);

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

  const handle = async () => {
    if (!newEndDate) return;
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
            <DirectDatePicker
              value={newEndDate}
              onChange={setNewEndDate}
              minDate={minDate}
              bookingSettings={bookingSettings}
              occupiedRanges={occupiedRangesForPicker}
              disabled={loadingDates}
              label="new end date"
            />
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="inv-btn-primary"
            style={{ background: '#6b2d39' }}
            onClick={handle}
            disabled={submitting || !newEndDate || loadingDates}
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

// ─── Calendar helpers (shared with EditFittingCalendar) ──────────────────────

const CAL_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DOW_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function calTodayStr() { return new Date().toISOString().split('T')[0]; }

function calIsWorkingDay(dateStr, settings) {
  if (!settings?.enabled) return true;
  if (!dateStr) return true;
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  return (settings.workingDays || [1, 2, 3, 4, 5]).includes(dow);
}

function calIsWorkdayOver(settings) {
  const now = new Date();
  const closeMin = ((settings?.endHour ?? 17) * 60) + (settings?.endMinute ?? 0);
  return (now.getHours() * 60 + now.getMinutes()) >= closeMin;
}

// ─── EditFittingCalendar ──────────────────────────────────────────────────────
// Calendar picker used in the reschedule modal. Grays out past dates, non-working
// days, and fully booked days (all time slots taken for this item).

function EditFittingCalendar({ value, onChange, bookingSettings, itemId, allTimeSlots, disabled }) {
  const today = calTodayStr();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const [view, setView] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [slotData, setSlotData] = useState({});
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    if (!open) return;
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const { year, month } = view;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = new Date(year, month, 1).getDay();

  // Pre-fetch booked slots for visible days so fully-booked days can be marked
  useEffect(() => {
    if (!open || !itemId || !allTimeSlots.length) return;
    const toFetch = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds  = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const key = `${itemId}__${ds}`;
      if (ds < today) continue;
      if (!calIsWorkingDay(ds, bookingSettings)) continue;
      if (fetchedRef.current.has(key)) continue;
      toFetch.push(ds);
    }
    if (!toFetch.length) return;
    toFetch.forEach(ds => fetchedRef.current.add(`${itemId}__${ds}`));
    Promise.all(
      toFetch.map(ds =>
        getBookedFittingSlots(itemId, ds)
          .then(slots => ({ ds, slots }))
          .catch(() => ({ ds, slots: [] }))
      )
    ).then(results => {
      const patch = {};
      results.forEach(({ ds, slots }) => { patch[ds] = slots; });
      setSlotData(prev => ({ ...prev, ...patch }));
    });
  }, [open, year, month, itemId, allTimeSlots.length, today, bookingSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevMonth = () => setView(v => { const d = new Date(v.year, v.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const nextMonth = () => setView(v => { const d = new Date(v.year, v.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const canPrev   = new Date(year, month, 0).toISOString().split('T')[0] >= today;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const fmtCalDate = ds => ds ? new Date(ds + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  return (
    <div className="fitting-cal-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`fitting-cal-trigger${!value ? ' fct-empty' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        <CalendarIcon size={13} style={{ color: value ? '#6b2d39' : '#bbb', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>{value ? fmtCalDate(value) : 'Select a date'}</span>
        <ChevronDown size={13} style={{ color: '#bbb', flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div className="fitting-cal-popup">
          <div className="fitting-cal-header">
            <button type="button" className="fitting-cal-nav" onClick={prevMonth} disabled={!canPrev}><ChevronLeft size={13} /></button>
            <span className="fitting-cal-title">{CAL_MONTH_NAMES[month]} {year}</span>
            <button type="button" className="fitting-cal-nav" onClick={nextMonth}><ChevronRight size={13} /></button>
          </div>

          <div className="fitting-cal-grid">
            {CAL_DOW_LABELS.map(d => <div key={d} className="fitting-cal-dow">{d}</div>)}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const ds         = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isPast     = ds < today || (ds === calTodayStr() && calIsWorkdayOver(bookingSettings));
              const isNonWork  = !calIsWorkingDay(ds, bookingSettings);
              const bookedForDay = slotData[ds];
              const isFullBook = !isPast && !isNonWork && allTimeSlots.length > 0
                && bookedForDay !== undefined && allTimeSlots.every(t => bookedForDay.includes(t));
              const isSelected = ds === value;
              const isToday    = ds === calTodayStr();
              const clickable  = !isPast && !isNonWork && !isFullBook;

              let cls = 'fitting-cal-day';
              if (isPast)        cls += ' fcd-past';
              else if (isNonWork)  cls += ' fcd-closed';
              else if (isFullBook) cls += ' fcd-full';
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
                  title={isPast ? 'Past date' : isNonWork ? 'Closed day' : isFullBook ? 'Fully booked' : undefined}
                >
                  {day}
                  {isFullBook && <span className="fcd-dot fcd-dot-full" />}
                </button>
              );
            })}
          </div>

          <div className="fitting-cal-legend">
            <span><span className="fcl-dot fcl-avail" />Available</span>
            <span><span className="fcl-dot fcl-full" />Fully Booked</span>
            <span><span className="fcl-dot fcl-closed" />Closed</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EditFittingModal ────────────────────────────────────────────────────────

function EditFittingModal({ booking, onSave, onClose, workingHours }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookedItemSlots, setBookedItemSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Build all time slots from settings (same logic as CreateBookingModal)
  const allTimeSlots = useMemo(() => {
    const openMin  = (workingHours?.startHour  ?? 9)  * 60 + (workingHours?.startMinute  ?? 0);
    const closeMin = (workingHours?.endHour    ?? 17) * 60 + (workingHours?.endMinute    ?? 0);
    const step     = workingHours?.fittingDurationMinutes || 30;
    const slots    = [];
    for (let t = openMin; t + step <= closeMin; t += step) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    return slots;
  }, [workingHours]);

  const loadAvailableSlots = useCallback(async (selectedDate) => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setAvailabilityError('');
    try {
      const [slots, itemSlots] = await Promise.all([
        getAvailableTimeSlots(selectedDate),
        getBookedFittingSlots(booking.itemId, selectedDate),
      ]);
      setAvailableSlots(slots || []);
      // Exclude the current booking's own slot from the "booked" list so it stays selectable
      setBookedItemSlots((itemSlots || []).filter(s => s !== booking.fittingTime || date !== booking.fittingDate));
    } catch (error) {
      console.error('Failed to load available slots:', error);
      setAvailableSlots([]);
      setBookedItemSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [booking.itemId, booking.fittingTime, booking.fittingDate, date]);

  const handleDateChange = (newDate) => {
    setDate(newDate);
    setTime('');
    setAvailabilityError('');
    if (newDate) loadAvailableSlots(newDate);
  };

  const handleTimeChange = (e) => {
    setTime(e.target.value);
    setAvailabilityError('');
  };

  const handle = async () => {
    if (!date || !time) return;
    setSaving(true);
    await onSave({ fittingDate: date, fittingTime: time });
    setSaving(false);
  };

  const slotIsAvailable = (slot) =>
    availableSlots.includes(slot) && !bookedItemSlots.includes(slot);

  const dateIsFullyBooked = date && !loadingSlots && allTimeSlots.length > 0
    && allTimeSlots.every(s => bookedItemSlots.includes(s));

  const fmtSlot = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
  };

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
              <EditFittingCalendar
                value={date}
                onChange={handleDateChange}
                bookingSettings={workingHours}
                itemId={booking.itemId}
                allTimeSlots={allTimeSlots}
                disabled={saving}
              />
            </div>
            <div className="inv-field">
              <label className="inv-field-label">
                <AlarmClock size={11} /> New Time
                {loadingSlots && <Loader2 size={11} className="inv-spinner-inline" style={{ marginLeft: 4 }} />}
              </label>
              {!date && <div className="ts-placeholder">Select a date first</div>}
              {date && loadingSlots && (
                <div className="ts-placeholder"><Loader2 size={13} className="inv-spinner-inline" /> Loading…</div>
              )}
              {date && !loadingSlots && dateIsFullyBooked && (
                <div className="ts-placeholder ts-placeholder-full">No available slots for this date</div>
              )}
              {date && !loadingSlots && !dateIsFullyBooked && (
                <select
                  className="inv-select"
                  style={{ width: '100%' }}
                  value={time}
                  onChange={handleTimeChange}
                  disabled={saving}
                >
                  <option value="">Select time</option>
                  {allTimeSlots.map(slot => {
                    const available = slotIsAvailable(slot);
                    return (
                      <option key={slot} value={slot} disabled={!available}>
                        {fmtSlot(slot)}{!available ? ' (Booked)' : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>
          {availabilityError && (
            <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
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
            Fitting sessions are {workingHours?.fittingDurationMinutes ?? 30} min. Max 5 bookings per slot. Booked dates and times are grayed out.
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

// ─── DirectDatePicker (rental booking edit) ───────────────────────────────────

function DirectDatePicker({ value, onChange, minDate, bookingSettings, occupiedRanges, disabled, label }) {
  const today = minDate || calTodayStr();
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

  const isDateBlocked = ds => occupiedRanges?.some(r => ds >= r.startDate && ds <= r.endDate) ?? false;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const fmtDate = ds => ds ? new Date(ds + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  return (
    <div className="fitting-cal-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`fitting-cal-trigger${!value ? ' fct-empty' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        <CalendarIcon size={13} style={{ color: value ? '#6b2d39' : '#bbb', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>{value ? fmtDate(value) : `Select ${label || 'date'}`}</span>
        <ChevronDown size={13} style={{ color: '#bbb', flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div className="fitting-cal-popup">
          <div className="fitting-cal-header">
            <button type="button" className="fitting-cal-nav" onClick={prevMonth} disabled={!canPrev}><ChevronLeft size={13} /></button>
            <span className="fitting-cal-title">{CAL_MONTH_NAMES[month]} {year}</span>
            <button type="button" className="fitting-cal-nav" onClick={nextMonth}><ChevronRight size={13} /></button>
          </div>

          <div className="fitting-cal-grid">
            {CAL_DOW_LABELS.map(d => <div key={d} className="fitting-cal-dow">{d}</div>)}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const ds        = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isPast    = ds < today || (ds === calTodayStr() && calIsWorkdayOver(bookingSettings));
              const isNonWork = !calIsWorkingDay(ds, bookingSettings);
              const isBlocked = isDateBlocked(ds);
              const isSelected = ds === value;
              const isToday   = ds === calTodayStr();
              const clickable = !isPast && !isNonWork && !isBlocked;

              let cls = 'fitting-cal-day';
              if (isPast)        cls += ' fcd-past';
              else if (isNonWork) cls += ' fcd-closed';
              else if (isBlocked) cls += ' fcd-full';
              else               cls += ' fcd-avail';
              if (isSelected)   cls += ' fcd-selected';
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

// ─── EditRentalDatesModal ─────────────────────────────────────────────────────

function EditRentalDatesModal({ booking, onSave, onClose, workingHours }) {
  const [startDate, setStartDate] = useState(booking.startDate || '');
  const [endDate, setEndDate]     = useState(booking.endDate   || '');
  const [occupiedRanges, setOccupiedRanges] = useState([]);
  const [loadingRanges, setLoadingRanges]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [availability, setAvailability] = useState(null);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [datesChanged, setDatesChanged] = useState(false);

  const today = calTodayStr();

  useEffect(() => {
    let cancelled = false;
    setLoadingRanges(true);
    getUnavailableDates(booking.inventoryItemId, booking.id)
      .then(ranges => { if (!cancelled) setOccupiedRanges(Array.isArray(ranges) ? ranges : []); })
      .catch(e => console.error('Failed to load unavailable dates:', e))
      .finally(() => { if (!cancelled) setLoadingRanges(false); });
    return () => { cancelled = true; };
  }, [booking.inventoryItemId, booking.id]);

  useEffect(() => {
    if (!datesChanged) return;
    if (!startDate || !endDate) { setAvailability(null); return; }
    setCheckingAvail(true);
    checkDirectBookingAvailability(booking.inventoryItemId, startDate, endDate, booking.id)
      .then(setAvailability)
      .catch(() => setAvailability(null))
      .finally(() => setCheckingAvail(false));
  }, [booking.inventoryItemId, booking.id, startDate, endDate, datesChanged]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRangeConflicting = (start, end) =>
    occupiedRanges.some(r => start <= r.endDate && end >= r.startDate);

  const totalDays = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000) + 1)
    : 0;

  const dailyRate = (booking.basePrice && booking.totalDays && booking.totalDays > 0)
    ? booking.basePrice / booking.totalDays
    : 0;

  const newBasePrice = dailyRate * totalDays;

  const handleStartChange = newStart => {
    setStartDate(newStart);
    if (endDate && endDate < newStart) setEndDate('');
    setError('');
    setAvailability(null);
    setDatesChanged(true);
  };

  const validate = () => {
    if (!startDate || !endDate) return 'Please select both start and end dates';
    if (endDate < startDate)    return 'End date must be on or after start date';
    if (availability === false || (!checkingAvail && availability === null && isRangeConflicting(startDate, endDate)))
      return 'Selected dates conflict with another booking';
    if (startDate === booking.startDate && endDate === booking.endDate) return 'No changes were made to the dates';
    return null;
  };

  const handle = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    await onSave({ startDate, endDate });
    setSaving(false);
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal-sm" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><Edit3 size={15} style={{ marginRight: 6 }} />Edit Rental Dates</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="bk-action-context">
            <div className="bk-action-customer">{booking.customerName}</div>
            <div className="bk-action-item">{booking.itemName}</div>
            <div className="bk-action-dates" style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={11} /> Current: {booking.startDate} → {booking.endDate}
            </div>
          </div>

          {loadingRanges && (
            <div style={{ fontSize: '0.75rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.5rem' }}>
              <Loader2 size={12} className="inv-spinner-inline" /> Checking availability…
            </div>
          )}

          <div className="inv-modal-grid">
            <div className="inv-field">
              <label className="inv-field-label"><CalendarIcon size={11} /> New Start Date</label>
              <DirectDatePicker
                value={startDate}
                onChange={handleStartChange}
                minDate={today}
                bookingSettings={workingHours}
                occupiedRanges={occupiedRanges}
                disabled={saving || loadingRanges}
                label="start date"
              />
            </div>
            <div className="inv-field">
              <label className="inv-field-label"><CalendarIcon size={11} /> New End Date</label>
              <DirectDatePicker
                value={endDate}
                onChange={d => { setEndDate(d); setError(''); setDatesChanged(true); }}
                minDate={startDate || today}
                bookingSettings={workingHours}
                occupiedRanges={occupiedRanges}
                disabled={saving || loadingRanges || !startDate}
                label="end date"
              />
            </div>
          </div>

          {startDate && endDate && !loadingRanges && (
            <div style={{
              marginTop: '0.5rem', padding: '8px 12px', borderRadius: 6, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 7,
              background: checkingAvail ? '#f9fafb'
                : availability === true  ? 'rgba(21,128,61,0.08)'
                : availability === false ? 'rgba(153,27,27,0.08)'
                : !isRangeConflicting(startDate, endDate) ? 'rgba(21,128,61,0.08)' : 'rgba(153,27,27,0.08)',
              color: checkingAvail ? '#6b7280'
                : availability === true  ? '#15803d'
                : availability === false ? '#991b1b'
                : !isRangeConflicting(startDate, endDate) ? '#15803d' : '#991b1b',
            }}>
              {checkingAvail
                ? <><Loader2 size={13} className="inv-spinner-inline" /> Checking availability…</>
                : availability === true
                  ? <><CheckCircle size={13} /> Dates are available</>
                  : availability === false
                    ? <><AlertCircle size={13} /> Dates conflict with another booking</>
                    : !isRangeConflicting(startDate, endDate)
                      ? <><CheckCircle size={13} /> Dates are available</>
                      : <><AlertCircle size={13} /> Dates conflict with another booking</>}
            </div>
          )}

          {totalDays > 0 && dailyRate > 0 && (
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginTop: '0.75rem', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', marginBottom: 6 }}>
                <span>₱{dailyRate.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} × {totalDays} day{totalDays !== 1 ? 's' : ''}</span>
                <span>₱{newBasePrice.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #e5e7eb', paddingTop: 6 }}>
                <span>New Total</span>
                <span style={{ color: '#c4717f' }}>₱{newBasePrice.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: '0.75rem', padding: '8px 12px', borderRadius: 6, fontSize: 13, background: 'rgba(153,27,27,0.08)', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="inv-btn-primary"
            onClick={handle}
            disabled={saving || !startDate || !endDate || loadingRanges || checkingAvail}
          >
            {saving ? <Loader2 size={13} className="inv-spinner-inline" /> : <Save size={13} />}
            Save Dates
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

function BookingDrawer({ booking, onAction, onCancel, onClose, onEditFitting, onEditRentalDates, onCompleteNoLease, onProceedToLease, onReturn, onExtend, onPickedUp, onMarkItemAvailable, isFitting, workingHours }) {
  const [itemDetails, setItemDetails] = useState(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('details');
  const [markingAvailable, setMarkingAvailable] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  // Tracks current time so the Done button enables/disables automatically
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const nextActions = isFitting ? FITTING_NEXT_ACTIONS : DIRECT_NEXT_ACTIONS;
  const actionDef = nextActions[booking.status];
  const canCancel = CANCELLABLE.includes(booking.status);
  const isTerminal = TERMINAL.includes(booking.status);
  const pastFitting = isFitting && isFittingPast(booking);
  const hasLeaseStarted = booking.leaseStarted || booking.leaseBookingId;
  const isCompletedWithoutLease = isFitting && ['COMPLETED', 'Completed'].includes(booking.status) && !hasLeaseStarted;
  const canCompleteNoLease = isFitting && booking.status === 'CONFIRMED' && !hasLeaseStarted;
  const canProceedToRentalFromConfirmed = isFitting && booking.status === 'CONFIRMED' && !hasLeaseStarted;

  // Done button is only active during the fitting duty window:
  // [fittingTime, workingHoursEndTime) — the working-hours end time is the hard expiry wall.
  const fittingDuration = workingHours?.fittingDurationMinutes || 30;
  const doneWindowActive = useMemo(() => {
    if (!canCompleteNoLease || !booking.fittingDate || !booking.fittingTime) return false;
    const start  = new Date(`${booking.fittingDate}T${booking.fittingTime}:00`);
    // Use working-hours end time as the upper boundary when available.
    const expiry = workingHours
      ? getFittingWorkingEndTime(booking, workingHours)
      : new Date(start.getTime() + fittingDuration * 60000);
    if (!expiry) return false;
    return now >= start && now < expiry;
  }, [canCompleteNoLease, booking.fittingDate, booking.fittingTime, fittingDuration, workingHours, now]);

  const fittingEndTimeLabel = useMemo(() => {
    // Show the working-hours end time as the deadline label when available.
    if (workingHours) {
      const endHour   = workingHours.endHour   ?? 17;
      const endMinute = workingHours.endMinute ?? 0;
      const period    = endHour >= 12 ? 'PM' : 'AM';
      return `${endHour % 12 || 12}:${String(endMinute).padStart(2,'0')} ${period}`;
    }
    // Legacy fallback: fittingTime + duration
    if (!booking.fittingTime) return '';
    const [h, m] = booking.fittingTime.split(':').map(Number);
    const totalMin = h * 60 + m + fittingDuration;
    const eh = Math.floor(totalMin / 60) % 24;
    const em = totalMin % 60;
    const period = eh >= 12 ? 'PM' : 'AM';
    const h12 = eh % 12 || 12;
    return `${h12}:${String(em).padStart(2, '0')} ${period}`;
  }, [booking.fittingTime, fittingDuration, workingHours]);

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

              {isFitting && booking.status === 'CONFIRMED' && (() => {
                const dur = workingHours?.fittingDurationMinutes || 30;
                // Use working-hours end time as the expiry wall (canonical rule).
                const expired  = isFittingExpiredByWorkingHours(booking, workingHours);
                // Only show "in progress" warning inside the attention window and before expiry.
                const inWindow = !expired && isFittingInAttentionWindow(booking, dur, workingHours);
                if (inWindow) {
                  const endHour   = workingHours?.endHour   ?? 17;
                  const endMinute = workingHours?.endMinute ?? 0;
                  const endLabel  = `${endHour % 12 || 12}:${String(endMinute).padStart(2,'0')} ${endHour >= 12 ? 'PM' : 'AM'}`;
                  return (
                    <div className="bk-damage-warning" style={{ background: 'rgba(180,83,9,0.07)', borderColor: 'rgba(180,83,9,0.25)', color: '#b45309' }}>
                      <AlertTriangle size={13} />
                      <span>This fitting is in progress. Mark it as Done before {endLabel} (working hours end), or it will be automatically cancelled.</span>
                    </div>
                  );
                }
                // Once expired, show nothing — the booking is either already cancelled
                // by the backend or will be on the next poll. No warning state needed.
                return null;
              })()}

              {hasLeaseStarted && (
                <div className="bk-damage-warning" style={{ background: 'rgba(124,58,237,0.07)', borderColor: 'rgba(124,58,237,0.2)', color: '#7c3aed' }}>
                  <PackageCheck size={13} />
                  <span>Rental booking #{booking.leaseBookingId?.slice(-8)} has been created from this fitting.</span>
                </div>
              )}

              {!isFitting && booking.status === 'Approved' && booking.startDate && (() => {
                const today = new Date().toISOString().split('T')[0];
                if (booking.startDate <= today) {
                  const endHour   = workingHours?.endHour   ?? 17;
                  const endMinute = workingHours?.endMinute ?? 0;
                  const endLabel  = `${endHour % 12 || 12}:${String(endMinute).padStart(2,'0')} ${endHour >= 12 ? 'PM' : 'AM'}`;
                  return (
                    <div className="bk-damage-warning" style={{ background: 'rgba(180,83,9,0.07)', borderColor: 'rgba(180,83,9,0.25)', color: '#b45309' }}>
                      <AlertTriangle size={13} />
                      <span>
                        Pickup scheduled for today. Click <strong>Picked Up</strong> once the customer collects the item,
                        or cancel. If not confirmed by {workingHours?.enabled ? endLabel : 'end of day'}, this booking will be automatically cancelled.
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

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
                  <div className="bk-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Rental Schedule</span>
                    {(booking.status === 'Pending' || booking.status === 'Approved') && !isTerminal && (
                      <button
                        type="button"
                        className="inv-btn-sm outline"
                        style={{ fontSize: '0.68rem', padding: '0.2rem 0.6rem' }}
                        onClick={() => onEditRentalDates(booking)}
                      >
                        <Edit3 size={10} /> Edit Dates
                      </button>
                    )}
                  </div>
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
              onClick={() => onCancel(booking, isFitting)}
            >
              <XCircle size={12} /> Cancel Booking
            </button>
          )}
          <div style={{ flex: 1 }} />

          {canCompleteNoLease && (
            <button
              className="inv-btn-primary"
              style={{
                background: '#15803d',
                opacity: doneWindowActive ? 1 : 0.5,
                cursor: doneWindowActive ? 'pointer' : 'not-allowed',
              }}
              onClick={() => doneWindowActive && onCompleteNoLease(booking)}
              disabled={!doneWindowActive}
              title={doneWindowActive
                ? 'Mark fitting as done'
                : `Done is active only during the fitting window: ${booking.fittingTime} – ${fittingEndTimeLabel}`}
            >
              <CheckCircle size={13} /> Done <ChevronRight size={13} />
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

          {canProceedToRentalFromConfirmed && (
            <button
              className="inv-btn-primary"
              style={{ background: '#7c3aed' }}
              onClick={() => onProceedToLease(booking)}
            >
              <PackageCheck size={13} /> Skip to Rental <ChevronRight size={13} />
            </button>
          )}

          {/* Approved rental: admin confirms physical pickup — only available on the actual pickup date */}
          {!isFitting && booking.status === 'Approved' && booking.startDate === new Date().toISOString().split('T')[0] && (
            <button
              className="inv-btn-primary"
              style={{ background: '#15803d' }}
              onClick={() => onPickedUp(booking)}
            >
              <PackageCheck size={13} /> Picked Up <ChevronRight size={13} />
            </button>
          )}

          {/* Active Lease: two dedicated action buttons replace the single next-action pattern */}
          {!isFitting && booking.status === 'Active Lease' && (
            <>
              <button
                className="inv-btn-primary"
                style={{ background: '#0d9488' }}
                onClick={() => onReturn(booking)}
              >
                <RotateCcw size={13} /> Returned <ChevronRight size={13} />
              </button>
              <button
                className="inv-btn-primary"
                style={{ background: '#6b2d39' }}
                onClick={() => onExtend(booking)}
              >
                <CalendarIcon size={13} /> Extend <ChevronRight size={13} />
              </button>
            </>
          )}

          {/* Completed: show maintenance status and admin override */}
          {!isFitting && booking.status === 'Completed' && itemDetails && (
            (itemDetails.status === 'Under Maintenance' || itemDetails.status === 'Pending Availability') && (
              <div style={{ padding: '0.75rem', background: 'rgba(154,52,18,0.08)', borderRadius: 8, color: '#9a3412', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
                <strong>Item Status: {itemDetails.status}</strong>
                {itemDetails.status === 'Under Maintenance' && itemDetails.maintenanceEndDate && (
                  <span> — until {itemDetails.maintenanceEndDate}</span>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    className="inv-btn-primary"
                    style={{ background: '#15803d', fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                    onClick={async () => {
                      setMarkingAvailable(true);
                      try {
                        const updated = await onMarkItemAvailable(itemDetails.id);
                        setItemDetails(prev => ({ ...prev, status: updated.status, maintenanceEndDate: null }));
                      } finally {
                        setMarkingAvailable(false);
                      }
                    }}
                    disabled={markingAvailable}
                  >
                    {markingAvailable ? <Loader2 size={12} className="inv-spinner-inline" /> : <CheckCircle size={12} />}
                    {' '}Mark Item Available Now
                  </button>
                </div>
              </div>
            )
          )}

          {actionDef && !isTerminal && !hasLeaseStarted && booking.status !== 'Active Lease' && booking.status !== 'Approved' && (
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

function BookingCard({ booking, isFitting, onOpen, onAction, onReturn, onExtend, onPickedUp, onCancelBooking, selected, onSelect, fittingDurationMinutes = 30, workingHours = null }) {
  const nextActions = isFitting ? FITTING_NEXT_ACTIONS : DIRECT_NEXT_ACTIONS;
  const actionDef = nextActions[booking.status];
  // isPast = started, within working-hours end window (needs attention)
  // Once working-hours end passes the booking is expired — no "Past Due" badge shown.
  const expired = isFitting && booking.status === 'CONFIRMED' && isFittingExpiredByWorkingHours(booking, workingHours);
  const isPast  = !expired && isFitting && booking.status === 'CONFIRMED' && isFittingInAttentionWindow(booking, fittingDurationMinutes, workingHours);
  const hasLeaseStarted = booking.leaseStarted || booking.leaseBookingId;
  const isCompletedWithoutLease = isFitting && ['COMPLETED', 'Completed'].includes(booking.status) && !hasLeaseStarted;
  const isBookingToday = !isPast && isToday(booking);

  return (
    <div className={`bk-card ${isPast ? 'bk-card--alert' : ''} ${isBookingToday ? 'bk-card--today' : ''}`}>
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
            {isBookingToday && (
              <span className="bk-today-badge"><Sun size={9} /> Today</span>
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
              style={{ background: '#0d9488', fontSize: '0.68rem' }}
              onClick={e => { e.stopPropagation(); onReturn(booking); }}
            >
              <RotateCcw size={10} /> Returned
            </button>
            <button
              className="inv-btn-sm"
              style={{ background: '#6b2d39', fontSize: '0.68rem' }}
              onClick={e => { e.stopPropagation(); onExtend(booking); }}
            >
              <CalendarIcon size={10} /> Extend
            </button>
          </div>
        ) : !isFitting && booking.status === 'Approved' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {booking.startDate === new Date().toISOString().split('T')[0] && (
              <button
                className="inv-btn-sm"
                style={{ background: '#15803d', fontSize: '0.68rem' }}
                onClick={e => { e.stopPropagation(); onPickedUp(booking); }}
              >
                <PackageCheck size={10} /> Picked Up
              </button>
            )}
            <button
              className="inv-btn-sm"
              style={{ background: '#991b1b', fontSize: '0.68rem' }}
              onClick={e => { e.stopPropagation(); onCancelBooking(booking, isFitting); }}
            >
              <XCircle size={10} /> Cancel
            </button>
          </div>
        ) : !isFitting && booking.status === 'Pending' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {actionDef && (
              <button
                className="inv-btn-sm"
                style={{ background: actionDef.color, fontSize: '0.7rem' }}
                onClick={e => { e.stopPropagation(); onAction(booking, actionDef); }}
              >
                <actionDef.icon size={10} /> {actionDef.label}
              </button>
            )}
            <button
              className="inv-btn-sm"
              style={{ background: '#991b1b', fontSize: '0.68rem' }}
              onClick={e => { e.stopPropagation(); onCancelBooking(booking, isFitting); }}
            >
              <XCircle size={10} /> Cancel
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
  const [pickedUpModal, setPickedUpModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [editRentalDatesModal, setEditRentalDatesModal] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  // mode: 'loading' (initial full-screen), 'refresh' (spinner only), 'silent' (no indicator)
  const loadData = useCallback(async (mode = 'loading') => {
    if (mode === 'loading') setLoading(true);
    else if (mode === 'refresh') setRefreshing(true);

    try {
      const [fRes, dRes] = await Promise.all([
        getAllFittingBookings(0, 500),
        getAllDirectBookings(0, 500),
      ]);

      let fitting = Array.isArray(fRes?.content) ? fRes.content : [];
      let direct = Array.isArray(dRes?.content) ? dRes.content : [];

      // Normalize backend uppercase statuses to the consistent mixed-case the frontend uses.
      // e.g. "CANCELLED" → "Cancelled", "COMPLETED" → "Completed"
      // NOTE: fitting bookings with status "CONFIRMED" are kept as "CONFIRMED" — the backend
      // auto-confirms them on creation and auto-cancels them if the Done window passes.
      const normalizeStatus = (s) => {
        const map = { CANCELLED: 'Cancelled', COMPLETED: 'Completed', REJECTED: 'Rejected' };
        return map[s] || s;
      };

      fitting = fitting.map(booking => ({
        ...booking,
        status: normalizeStatus(booking.status),
        history: booking.history || [],
        leaseStarted: booking.leaseStarted || false,
        leaseBookingId: booking.leaseBookingId,
      }));

      direct = direct.map(booking => ({
        ...booking,
        bookingStatus: normalizeStatus(booking.bookingStatus),
        history: booking.history || [],
      }));

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
    const interval = setInterval(() => { loadData('silent'); }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  // ── Working-hours expiry watcher ──────────────────────────────────────────
  // Checks every 30 seconds whether any CONFIRMED fitting booking has crossed
  // the working-hours end time. When one is detected the data is silently
  // refreshed so the backend-cancelled status is reflected immediately
  // without waiting for the 60-second general auto-refresh cycle.
  useEffect(() => {
    if (!workingHours) return;
    const check = () => {
      const hasExpired = fittingBookings.some(
        b => b.status === 'CONFIRMED' && isFittingExpiredByWorkingHours(b, workingHours)
      );
      if (hasExpired) loadData('silent');
    };
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [fittingBookings, workingHours, loadData]);

  // ── Approved-rental pickup-deadline watcher ───────────────────────────────
  // Mirrors the backend autoExpireApprovedBookings logic: silently refreshes
  // when an Approved booking's startDate + working-hours end time has passed.
  useEffect(() => {
    const check = () => {
      const hasExpired = directBookings.some(
        b => b.bookingStatus === 'Approved' && isApprovedDirectBookingExpired(b, workingHours)
      );
      if (hasExpired) loadData('silent');
    };
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [directBookings, workingHours, loadData]);

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
    const fitting = fittingBookings.map(b => {
      // Optimistic cancellation: if the working-hours end time for the booking's day
      // has passed and the booking is still CONFIRMED, treat it as Cancelled in the UI
      // immediately. The backend will confirm this on the next poll.
      let status = b.status;
      if (
        status === 'CONFIRMED' &&
        workingHours &&
        isFittingExpiredByWorkingHours(b, workingHours)
      ) {
        status = 'Cancelled';
      }
      return { ...b, _type: 'fitting', status };
    });
    const direct = directBookings.map(b => {
      let status = b.bookingStatus;
      if (status === 'Approved' && isApprovedDirectBookingExpired(b, workingHours)) {
        status = 'Cancelled';
      }
      return { ...b, _type: 'direct', status };
    });

    let combined = bookingType === 'fitting' ? fitting
                 : bookingType === 'direct'  ? direct
                 : [...fitting, ...direct];

    combined = viewTab === 'active'
      ? combined.filter(b => !TERMINAL.includes(b.status))
      : viewTab === 'cancelled'
      ? combined.filter(b => ['Cancelled', 'Rejected'].includes(b.status))
      : combined.filter(b => ['Completed', 'COMPLETED', 'LEASE_CONVERTED'].includes(b.status));

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

    const fittingDur = workingHours?.fittingDurationMinutes || 30;
    combined.sort((a, b) => {
      // Only bookings within the attention window (started, within working hours end) sort to top
      const aPast = a._type === 'fitting' && a.status === 'CONFIRMED' && isFittingInAttentionWindow(a, fittingDur, workingHours);
      const bPast = b._type === 'fitting' && b.status === 'CONFIRMED' && isFittingInAttentionWindow(b, fittingDur, workingHours);
      const aToday = !aPast && isToday(a);
      const bToday = !bPast && isToday(b);
      if (aPast !== bPast) return aPast ? -1 : 1;
      if (aToday !== bToday) return aToday ? -1 : 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return combined;
  }, [fittingBookings, directBookings, bookingType, viewTab, search, filterStat, dateRangeFilter, priceRangeFilter, workingHours]);

  const stats = useMemo(() => {
    const pendingFit   = 0; // fitting bookings are auto-confirmed — no Pending state
    const pendingDir   = directBookings.filter(b => b.bookingStatus === 'Pending').length;
    const approvedFit  = fittingBookings.filter(b => b.status === 'CONFIRMED').length;
    const approvedDir  = directBookings.filter(b => b.bookingStatus === 'Approved').length;
    const activeLease  = directBookings.filter(b => b.bookingStatus === 'Active Lease').length;
    const completedFit = fittingBookings.filter(b => b.status === 'Completed' || b.status === 'COMPLETED').length;
    const completedDir = directBookings.filter(b => b.bookingStatus === 'Completed').length;
    // Only count fittings whose start has passed AND the working-hours end time
    // has NOT yet been reached. Bookings past the end time are expired/auto-cancelled
    // by the backend and must NOT appear in the attention counter.
    const fittingDuration = workingHours?.fittingDurationMinutes || 30;
    const pastFitting  = fittingBookings.filter(
      b => b.status === 'CONFIRMED' &&
           isFittingInAttentionWindow(b, fittingDuration, workingHours) &&
           !isFittingExpiredByWorkingHours(b, workingHours)
    ).length;
    const cancelledFit = fittingBookings.filter(b => ['Cancelled', 'Rejected'].includes(b.status)).length;
    const cancelledDir = directBookings.filter(b => ['Cancelled', 'Rejected'].includes(b.bookingStatus)).length;
    return {
      pending: pendingFit + pendingDir,
      approved: approvedFit + approvedDir,
      active: activeLease,
      completed: completedFit + completedDir,
      pastFitting,
      cancelled: cancelledFit + cancelledDir,
    };
  }, [fittingBookings, directBookings, workingHours]);

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
      showToastMsg('error', error.message || 'Failed to complete fitting');
    }
  }, [showToastMsg, drawer]);

  const handleProceedToLease = useCallback((booking) => {
    fetchItemForLease(booking.itemId);
    setLeaseModal(booking);
  }, [fetchItemForLease]);

  const handlePickedUp = useCallback((booking) => {
    setPickedUpModal(booking);
  }, []);

  const confirmPickedUp = useCallback(async () => {
    if (!pickedUpModal) return;
    try {
      await markDirectBookingPickedUp(pickedUpModal.id);
      setDirectBookings(prev => prev.map(b =>
        b.id === pickedUpModal.id ? { ...b, bookingStatus: 'Active Lease' } : b
      ));
      if (drawer?.id === pickedUpModal.id) {
        setDrawer(prev => prev ? { ...prev, status: 'Active Lease' } : null);
      }
      showToastMsg('success', 'Item picked up — lease is now active');
      setPickedUpModal(null);
    } catch (e) {
      console.error(e);
      showToastMsg('error', e.message || 'Failed to confirm pickup');
    }
  }, [pickedUpModal, drawer, showToastMsg]);

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
      showToastMsg('success', 'Lease returned and completed. Item is now Under Maintenance for 2 days.');
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

  const saveRentalDates = useCallback(async ({ startDate, endDate }) => {
    const booking = editRentalDatesModal;
    if (!booking) return;
    try {
      const updated = await updateDirectBookingDates(booking.id, startDate, endDate);
      setDirectBookings(prev => prev.map(b =>
        b.id === booking.id
          ? { ...b, startDate: updated.startDate, endDate: updated.endDate, totalDays: updated.totalDays, basePrice: updated.basePrice, finalPrice: updated.finalPrice }
          : b
      ));
      if (drawer?.id === booking.id) {
        setDrawer(prev => prev
          ? { ...prev, startDate: updated.startDate, endDate: updated.endDate, totalDays: updated.totalDays, basePrice: updated.basePrice, finalPrice: updated.finalPrice }
          : null);
      }
      showToastMsg('success', `Rental dates updated: ${startDate} → ${endDate}`);
      setEditRentalDatesModal(null);
    } catch (e) {
      console.error(e);
      showToastMsg('error', e.message || 'Failed to update rental dates');
    }
  }, [editRentalDatesModal, drawer, showToastMsg]);

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
        setDirectBookings(prev => [...prev, { ...result, _type: 'direct', bookingStatus: result.bookingStatus || result.status || 'Pending' }]);
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

  const handleCancelBooking = useCallback((booking, isFitting) => {
    setCancelModal({ booking, isFitting });
  }, []);

  const confirmCancelBooking = useCallback(async (reason) => {
    if (!cancelModal) return;
    const { booking, isFitting } = cancelModal;
    try {
      if (isFitting) {
        await updateFittingBookingStatus(booking.id, 'Cancelled');
        setFittingBookings(prev => prev.map(b => {
          if (b.id === booking.id) {
            const newHistory = [...(b.history || []), {
              oldStatus: b.status, newStatus: 'Cancelled',
              timestamp: new Date().toISOString(), actor: 'Admin', note: reason,
            }];
            return { ...b, status: 'Cancelled', history: newHistory };
          }
          return b;
        }));
      } else {
        await updateDirectBookingStatus(booking.id, 'Cancelled');
        setDirectBookings(prev => prev.map(b => {
          if (b.id === booking.id) {
            const newHistory = [...(b.history || []), {
              oldStatus: b.bookingStatus, newStatus: 'Cancelled',
              timestamp: new Date().toISOString(), actor: 'Admin', note: reason,
            }];
            return { ...b, bookingStatus: 'Cancelled', history: newHistory };
          }
          return b;
        }));
      }
      if (drawer?.id === booking.id) setDrawer(null);
      setCancelModal(null);
      showToastMsg('success', 'Booking cancelled successfully');
    } catch (e) {
      console.error(e);
      showToastMsg('error', e.message || 'Failed to cancel booking');
    }
  }, [cancelModal, drawer, showToastMsg]);

  const handleRefresh = useCallback(() => { loadData('refresh'); }, [loadData]);

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

  const todayBookings = viewTab === 'active' ? allBookings.filter(b => isToday(b)) : [];
  const otherBookings = viewTab === 'active' ? allBookings.filter(b => !isToday(b)) : allBookings;

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
          <button className="inv-btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> New Booking
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
            <b>{stats.pastFitting}</b> fitting appointment{stats.pastFitting > 1 ? 's have' : ' has'} passed their scheduled time and {stats.pastFitting > 1 ? 'need' : 'needs'} attention.
          </span>
          <button
            className="inv-btn-sm"
            style={{ background: '#b45309', marginLeft: 'auto' }}
            onClick={() => { setBookingType('fitting'); setViewTab('active'); setFilterStat('CONFIRMED'); }}
          >
            View Now
          </button>
        </div>
      )}

      <div className="inv-tabs">
        <button className={`inv-tab ${viewTab === 'active' ? 'active' : ''}`} onClick={() => { setViewTab('active'); setFilterStat('All'); }}>
          <PackageCheck size={14} /> Active Bookings
        </button>
        <button className={`inv-tab ${viewTab === 'completed' ? 'active' : ''}`} onClick={() => { setViewTab('completed'); setFilterStat('All'); }}>
          <Star size={14} /> Completed &amp; Archived
        </button>
        <button className={`inv-tab ${viewTab === 'cancelled' ? 'active' : ''}`} onClick={() => { setViewTab('cancelled'); setFilterStat('All'); }}>
          <XCircle size={14} /> Cancelled
          {stats.cancelled > 0 && <span className="bk-tab-count">{stats.cancelled}</span>}
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
                  <option value="CONFIRMED">Confirmed (Fitting)</option>
                  <option value="Approved">Approved</option>
                  <option value="Active Lease">Active Lease</option>
                  <option value="Returned">Returned</option>
                </>
              ) : viewTab === 'cancelled' ? (
                <>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Rejected">Rejected</option>
                </>
              ) : (
                <>
                  <option value="Completed">Completed</option>
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
            <p style={{ margin: 0 }}>
              {viewTab === 'active' ? 'No active bookings found.' : viewTab === 'cancelled' ? 'No cancelled bookings.' : 'No completed bookings found.'}
            </p>
          </div>
        ) : (
          <>
            {todayBookings.length > 0 && (
              <>
                <div className="bk-section-divider bk-section-divider--today">
                  <Sun size={13} /> Today's Bookings
                  <span className="bk-section-count">{todayBookings.length}</span>
                </div>
                {todayBookings.map(b => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    isFitting={b._type === 'fitting'}
                    onOpen={setDrawer}
                    onAction={(booking, actionDef) => setActionModal({ booking, actionDef, isFitting: booking._type === 'fitting' })}
                    onReturn={handleReturnLease}
                    onExtend={handleExtendLease}
                    onPickedUp={handlePickedUp}
                    onCancelBooking={handleCancelBooking}
                    selected={selectedBookings.has(b.id)}
                    onSelect={toggleSelect}
                    fittingDurationMinutes={workingHours?.fittingDurationMinutes || 30}
                    workingHours={workingHours}
                  />
                ))}
                {otherBookings.length > 0 && (
                  <div className="bk-section-divider">Other Bookings</div>
                )}
              </>
            )}
            {otherBookings.map(b => (
              <BookingCard
                key={b.id}
                booking={b}
                isFitting={b._type === 'fitting'}
                onOpen={setDrawer}
                onAction={(booking, actionDef) => setActionModal({ booking, actionDef, isFitting: booking._type === 'fitting' })}
                onReturn={handleReturnLease}
                onExtend={handleExtendLease}
                onPickedUp={handlePickedUp}
                onCancelBooking={handleCancelBooking}
                selected={selectedBookings.has(b.id)}
                onSelect={toggleSelect}
                fittingDurationMinutes={workingHours?.fittingDurationMinutes || 30}
                workingHours={workingHours}
              />
            ))}
          </>
        )}
      </div>

      {drawer && (
        <BookingDrawer
          booking={drawer}
          isFitting={drawer._type === 'fitting'}
          onAction={(b, a) => setActionModal({ booking: b, actionDef: a, isFitting: b._type === 'fitting' })}
          onCancel={(bk, isFit) => handleCancelBooking(bk, isFit)}
          onEditFitting={setEditFittingModal}
          onEditRentalDates={setEditRentalDatesModal}
          onCompleteNoLease={setNoLeaseModal}
          onProceedToLease={handleProceedToLease}
          onReturn={handleReturnLease}
          onExtend={handleExtendLease}
          onPickedUp={handlePickedUp}
          onMarkItemAvailable={async (itemId) => {
            const updated = await markItemAvailable(itemId);
            showToastMsg('success', 'Item marked as Available');
            return updated;
          }}
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

      {pickedUpModal && (
        <PickedUpModal
          booking={pickedUpModal}
          onConfirm={confirmPickedUp}
          onClose={() => setPickedUpModal(null)}
        />
      )}

      {cancelModal && (
        <CancelConfirmModal
          booking={cancelModal.booking}
          onConfirm={confirmCancelBooking}
          onClose={() => setCancelModal(null)}
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
          bookingSettings={workingHours}
        />
      )}

      {editRentalDatesModal && (
        <EditRentalDatesModal
          booking={editRentalDatesModal}
          onSave={saveRentalDates}
          onClose={() => setEditRentalDatesModal(null)}
          workingHours={workingHours}
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

      {showCreateModal && (
        <CreateBookingModal
          onSuccess={() => { loadData('refresh'); setShowCreateModal(false); }}
          onClose={() => setShowCreateModal(false)}
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