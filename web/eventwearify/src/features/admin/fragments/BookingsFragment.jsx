import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../styles/BookingsManagement.css';
import {
  Search, Eye, X, CheckCircle, AlertCircle, Clock, User, Phone,
  Calendar, RotateCcw, ChevronRight, PackageCheck,
  XCircle, Star, AlertTriangle,
  Loader2, ShoppingBag, Settings, Save, Sun,
  Calendar as CalendarIcon, AlarmClock, Edit3, Scissors,
  Image as ImageIcon, Video, RefreshCw
} from 'lucide-react';
import {
  getAllFittingBookings,
  getAllDirectBookings,
  updateFittingBookingStatus,
  updateDirectBookingStatus,
  fetchItemById
} from '../services/inventoryApi';

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
};

// ─── Fitting flow: Pending → Approved → Completed (no lease stages) ─────────
const FITTING_FLOW_STEPS = ['Pending', 'Approved', 'Completed'];
const FITTING_NEXT_ACTIONS = {
  'Pending':  { label: 'Approve Fitting', icon: CheckCircle, next: 'Approved',  color: '#15803d' },
  'Approved': { label: 'Mark as Done',    icon: Star,        next: 'Completed', color: '#1d4ed8' },
};

// ─── Direct booking flow: full lease lifecycle ───────────────────────────────
const DIRECT_FLOW_STEPS = ['Pending', 'Approved', 'Active Lease', 'Returned', 'Completed'];
const DIRECT_NEXT_ACTIONS = {
  'Pending':      { label: 'Approve Booking',  icon: CheckCircle, next: 'Approved',     color: '#15803d' },
  'Approved':     { label: 'Start Lease',       icon: PackageCheck, next: 'Active Lease', color: '#b45309' },
  'Active Lease': { label: 'Mark Returned',     icon: RotateCcw,   next: 'Returned',     color: '#7c3aed' },
  'Returned':     { label: 'Complete',          icon: Star,        next: 'Completed',    color: '#15803d' },
};

const CANCELLABLE = ['Pending', 'Approved'];
const TERMINAL    = ['Completed', 'Cancelled', 'Rejected'];

const DEFAULT_WORKING_HOURS = {
  enabled: true,
  startHour: 9, startMinute: 0,
  endHour: 17,  endMinute: 0,
  workingDays: [1, 2, 3, 4, 5],
  timezone: 'Asia/Manila',
};

const DAYS = [
  { value: 0, label: 'Sunday' },  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },{ value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the fitting appointment has already passed.
 */
const isFittingPast = (booking) => {
  if (!booking.fittingDate) return false;
  const dateStr = booking.fittingDate;
  const timeStr = booking.fittingTime || '23:59';
  const dt = new Date(`${dateStr}T${timeStr}`);
  return dt < new Date();
};

/**
 * Auto-complete past fittings that are still 'Approved'
 */
const autoCompletePastFittings = (bookings, updateFn) => {
  let updated = false;
  bookings.forEach(booking => {
    if (booking._type === 'fitting' && booking.status === 'Approved' && isFittingPast(booking)) {
      updateFn(booking.id, 'Completed', 'Auto-completed by system (past fitting date)');
      updated = true;
    }
  });
  return updated;
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

// ─── ActionModal ─────────────────────────────────────────────────────────────

function ActionModal({ booking, actionDef, onConfirm, onClose }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handle = async () => {
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
            <label className="inv-field-label">Notes <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></label>
            <textarea
              className="inv-textarea" rows={2} value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Any remarks…" disabled={submitting}
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

// ─── EditFittingModal ─────────────────────────────────────────────────────────

function EditFittingModal({ booking, onSave, onClose }) {
  const [date, setDate]       = useState(booking.fittingDate || '');
  const [time, setTime]       = useState(booking.fittingTime || '');
  const [saving, setSaving]   = useState(false);

  const handle = async () => {
    if (!date || !time) return;
    setSaving(true);
    await onSave({ fittingDate: date, fittingTime: time });
    setSaving(false);
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
              <input
                type="date" className="inv-input"
                value={date} onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="inv-field">
              <label className="inv-field-label"><AlarmClock size={11} /> New Time</label>
              <input
                type="time" className="inv-input"
                value={time} onChange={e => setTime(e.target.value)}
              />
            </div>
          </div>
          {date && time && (
            <div className="bk-time-preview" style={{ marginTop: 0 }}>
              <CalendarIcon size={12} />
              New schedule: {new Date(`${date}T${time}`).toLocaleString('en-PH', {
                weekday: 'long', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </div>
          )}
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="inv-btn-primary"
            onClick={handle}
            disabled={saving || !date || !time}
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

function BookingDrawer({ booking, onAction, onCancel, onClose, onEditFitting, isFitting }) {
  const [itemDetails, setItemDetails]   = useState(null);
  const [loadingItem, setLoadingItem]   = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const nextActions = isFitting ? FITTING_NEXT_ACTIONS : DIRECT_NEXT_ACTIONS;
  const actionDef   = nextActions[booking.status];
  const canCancel   = CANCELLABLE.includes(booking.status);
  const isTerminal  = TERMINAL.includes(booking.status);
  const pastFitting = isFitting && isFittingPast(booking);

  useEffect(() => {
    const load = async () => {
      const itemId = booking.itemId || booking.inventoryItemId;
      if (!itemId) return;
      setLoadingItem(true);
      try { 
        const item = await fetchItemById(itemId);
        setItemDetails(item);
        setCurrentMediaIndex(0);
      } catch (e) { console.error(e); }
      finally { setLoadingItem(false); }
    };
    load();
  }, [booking.itemId, booking.inventoryItemId]);

  const mediaFiles = itemDetails?.mediaFiles || [];
  const currentMedia = mediaFiles[currentMediaIndex];
  const hasMultipleMedia = mediaFiles.length > 1;

  const nextMedia = () => setCurrentMediaIndex((prev) => (prev + 1) % mediaFiles.length);
  const prevMedia = () => setCurrentMediaIndex((prev) => (prev - 1 + mediaFiles.length) % mediaFiles.length);

  return (
    <div className="bk-drawer-overlay" onClick={onClose}>
      <div className="bk-drawer" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
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

        {/* ── Body ── */}
        <div className="bk-drawer-body">

          {/* Past-fitting warning */}
          {isFitting && pastFitting && booking.status === 'Approved' && (
            <div className="bk-damage-warning" style={{ background: 'rgba(29,78,216,0.07)', borderColor: 'rgba(29,78,216,0.2)', color: '#1d4ed8' }}>
              <AlertTriangle size={13} />
              <span>This fitting appointment has passed. Mark it as Done or reschedule.</span>
            </div>
          )}

          {/* Flow stepper */}
          <FlowStepper current={booking.status} isFitting={isFitting} />

          {/* Item details with Media Viewer */}
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
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.3rem' }}>{booking.itemName}</div>
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

          {/* Customer */}
          <div className="bk-detail-section">
            <div className="bk-section-label">Customer</div>
            <div className="bk-info-grid">
              <div className="bk-info-row"><User size={12} /><span>{booking.customerName}</span></div>
              {booking.customerPhone && <div className="bk-info-row"><Phone size={12} /><span>{booking.customerPhone}</span></div>}
              {booking.customerEmail && <div className="bk-info-row"><Calendar size={12} /><span>{booking.customerEmail}</span></div>}
            </div>
          </div>

          {/* Fitting schedule */}
          {isFitting && booking.fittingDate && (
            <div className="bk-detail-section">
              <div className="bk-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Fitting Schedule</span>
                {!isTerminal && (
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

          {/* Rental schedule */}
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

          {/* Payment */}
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

          {/* Notes */}
          {booking.notes && (
            <div className="bk-detail-section">
              <div className="bk-section-label">Notes</div>
              <div style={{ padding: '0.65rem 0.85rem', background: '#faf9f7', borderRadius: 8, fontSize: '0.82rem', color: '#555', lineHeight: 1.6 }}>
                {booking.notes}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer with multiple action buttons ── */}
        <div className="bk-drawer-footer">
          {canCancel && (
            <button
              className="inv-btn-sm danger"
              onClick={() => onCancel(booking.id, isFitting)}
            >
              <XCircle size={12} /> Cancel Booking
            </button>
          )}
          <div style={{ flex: 1 }} />
          {actionDef && !isTerminal && (
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
          <h3><Settings size={16} style={{ marginRight: 8 }} />Booking Hours Settings</h3>
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
              <div className="bk-settings-summary">
                <Sun size={14} />
                <span>Bookings accepted only during working hours on working days.</span>
              </div>
            </>
          )}
          {!local.enabled && (
            <div className="bk-settings-summary" style={{ background: '#fff3e0', borderLeftColor: '#f59e0b' }}>
              <AlertTriangle size={14} />
              <span>Time restrictions disabled — bookings accepted anytime.</span>
            </div>
          )}
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

// ─── BookingCard (list row) ───────────────────────────────────────────────────

function BookingCard({ booking, isFitting, onOpen, onAction }) {
  const nextActions = isFitting ? FITTING_NEXT_ACTIONS : DIRECT_NEXT_ACTIONS;
  const actionDef   = nextActions[booking.status];
  const isPast      = isFitting && isFittingPast(booking) && booking.status === 'Approved';

  return (
    <div className={`bk-card ${isPast ? 'bk-card--alert' : ''}`} onClick={() => onOpen(booking)}>
      <div className="bk-card-left">
        <div className="bk-card-avatar">{booking.customerName?.charAt(0)?.toUpperCase() || 'U'}</div>
        <div className="bk-card-info">
          <div className="bk-card-customer">
            {booking.customerName}
            {isPast && (
              <span className="bk-overdue-badge"><AlertTriangle size={9} /> Past Due</span>
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
        {actionDef && !TERMINAL.includes(booking.status) && (
          <button
            className="inv-btn-sm"
            style={{ background: actionDef.color, fontSize: '0.7rem' }}
            onClick={e => { e.stopPropagation(); onAction(booking, actionDef); }}
          >
            <actionDef.icon size={10} /> {actionDef.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookingsManagement() {
  const [fittingBookings, setFittingBookings] = useState([]);
  const [directBookings,  setDirectBookings]  = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [search, setSearch]               = useState('');
  const [filterStat, setFilterStat]       = useState('All');
  const [bookingType, setBookingType]     = useState('all');
  const [viewTab, setViewTab]             = useState('active');
  const [drawer, setDrawer]               = useState(null);
  const [actionModal, setActionModal]     = useState(null);
  const [editFittingModal, setEditFittingModal] = useState(null);
  const [toast, setToast]                 = useState({ show: false, type: 'success', message: '' });
  const [showSettings, setShowSettings]   = useState(false);
  const [workingHours, setWorkingHours]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('bookingWorkingHours')) || DEFAULT_WORKING_HOURS; }
    catch { return DEFAULT_WORKING_HOURS; }
  });

  const showToastMsg = useCallback((type, msg) => {
    setToast({ show: true, type, message: msg });
  }, []);

  // ── Load Data with auto-completion ──────────────────────────────────────────

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
      
      // Auto-complete past fittings that are still 'Approved'
      let fittingUpdated = false;
      fitting = fitting.map(booking => {
        if (booking.status === 'Approved' && isFittingPast(booking)) {
          fittingUpdated = true;
          // Silently auto-complete in UI - actual API call happens separately
          updateFittingBookingStatus(booking.id, 'Completed').catch(console.error);
          return { ...booking, status: 'Completed' };
        }
        return booking;
      });
      
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

  useEffect(() => { loadData(); }, [loadData]);

  // ── Status updates ────────────────────────────────────────────────────────

  const updateFittingStatus = useCallback(async (id, status, note) => {
    try {
      await updateFittingBookingStatus(id, status);
      setFittingBookings(prev => prev.map(b =>
        b.id === id ? { ...b, status } : b
      ));
      // Also update drawer if it's the same booking
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
      setDirectBookings(prev => prev.map(b =>
        b.id === id ? { ...b, bookingStatus: status } : b
      ));
      if (drawer?.id === id && drawer._type === 'direct') {
        setDrawer(prev => prev ? { ...prev, status } : null);
      }
      showToastMsg('success', `Status updated to ${status}`);
    } catch (e) {
      console.error(e);
      showToastMsg('error', 'Failed to update status');
    }
  }, [showToastMsg, drawer]);

  // ─── Edit fitting schedule ─────────────────────────────────────────────────

  const saveFittingSchedule = useCallback(async ({ fittingDate, fittingTime }) => {
    const booking = editFittingModal;
    if (!booking) return;
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const res = await fetch(`http://localhost:8080/api/admin/bookings/fitting/${booking.id}/reschedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fittingDate, fittingTime }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      showToastMsg('error', 'Failed to update schedule — check backend endpoint');
    }
  }, [editFittingModal, drawer, showToastMsg]);

  // ─── Cancel ────────────────────────────────────────────────────────────────

  const cancelFitting = useCallback(async (id) => {
    await updateFittingStatus(id, 'Cancelled', 'Cancelled by admin');
    setDrawer(null);
  }, [updateFittingStatus]);

  const cancelDirect = useCallback(async (id) => {
    await updateDirectStatus(id, 'Cancelled', 'Cancelled by admin');
    setDrawer(null);
  }, [updateDirectStatus]);

  // ─── Manual refresh ───────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  // ─── Computed lists ────────────────────────────────────────────────────────

  const allBookings = useMemo(() => {
    const fitting = fittingBookings.map(b => ({ ...b, _type: 'fitting', status: b.status }));
    const direct  = directBookings.map(b => ({ ...b, _type: 'direct',  status: b.bookingStatus }));

    let combined = bookingType === 'fitting' ? fitting
                 : bookingType === 'direct'  ? direct
                 : [...fitting, ...direct];

    // Tab filter
    combined = viewTab === 'active'
      ? combined.filter(b => !TERMINAL.includes(b.status))
      : combined.filter(b =>  TERMINAL.includes(b.status));

    // Search
    const q = search.toLowerCase();
    if (q) combined = combined.filter(b =>
      b.customerName?.toLowerCase().includes(q) ||
      b.itemName?.toLowerCase().includes(q) ||
      b.id?.toLowerCase().includes(q)
    );

    // Status filter
    if (filterStat !== 'All') combined = combined.filter(b => b.status === filterStat);

    // Sort: past-fitting approved first (they need attention), then by creation date desc
    combined.sort((a, b) => {
      const aPast = a._type === 'fitting' && isFittingPast(a) && a.status === 'Approved';
      const bPast = b._type === 'fitting' && isFittingPast(b) && b.status === 'Approved';
      if (aPast !== bPast) return aPast ? -1 : 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return combined;
  }, [fittingBookings, directBookings, bookingType, viewTab, search, filterStat]);

  const stats = useMemo(() => {
    const pendingFit = fittingBookings.filter(b => b.status === 'Pending').length;
    const pendingDir = directBookings.filter(b => b.bookingStatus === 'Pending').length;
    const approvedFit = fittingBookings.filter(b => b.status === 'Approved').length;
    const approvedDir = directBookings.filter(b => b.bookingStatus === 'Approved').length;
    const activeLease = directBookings.filter(b => b.bookingStatus === 'Active Lease').length;
    const completedFit = fittingBookings.filter(b => b.status === 'Completed').length;
    const completedDir = directBookings.filter(b => b.bookingStatus === 'Completed').length;
    const pastFitting = fittingBookings.filter(b => isFittingPast(b) && b.status === 'Approved').length;
    
    return {
      pending: pendingFit + pendingDir,
      approved: approvedFit + approvedDir,
      active: activeLease,
      completed: completedFit + completedDir,
      pastFitting,
    };
  }, [fittingBookings, directBookings]);

  const fmtHours = () => {
    const f = h => { const ap = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:00 ${ap}`; };
    return workingHours.enabled ? `${f(workingHours.startHour)} – ${f(workingHours.endHour)}` : 'Always open';
  };

  // ─────────────────────────────────────────────────────────────────────────

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

      {/* ── Page header ── */}
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
          <button className="inv-icon-btn" onClick={handleRefresh} disabled={refreshing} title="Refresh">
            <RefreshCw size={16} className={refreshing ? 'inv-spinner-inline' : ''} />
          </button>
          <button className="inv-btn-primary" onClick={() => setShowSettings(true)}>
            <Settings size={14} /> Settings
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="inv-stats">
        {[
          { label: 'Pending',      value: stats.pending,    icon: Clock,        color: '#b45309' },
          { label: 'Approved',     value: stats.approved,   icon: CheckCircle,  color: '#15803d' },
          { label: 'Active Lease', value: stats.active,     icon: PackageCheck, color: '#7c3aed' },
          { label: 'Completed',    value: stats.completed,  icon: Star,         color: '#1d4ed8' },
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

      {/* Past-fitting attention banner */}
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

      {/* ── Tabs ── */}
      <div className="inv-tabs">
        <button className={`inv-tab ${viewTab === 'active' ? 'active' : ''}`} onClick={() => setViewTab('active')}>
          <PackageCheck size={14} /> Active Bookings
        </button>
        <button className={`inv-tab ${viewTab === 'completed' ? 'active' : ''}`} onClick={() => setViewTab('completed')}>
          <Star size={14} /> Completed &amp; Archived
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="inv-card" style={{ padding: '1rem 1.25rem' }}>
        <div className="inv-toolbar" style={{ marginBottom: 0 }}>
          <div className="inv-search-wrap">
            <Search size={13} className="inv-search-icon" />
            <input
              className="inv-search"
              placeholder="Search customer, item, or ID…"
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
                </>
              )}
            </select>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {allBookings.length} booking{allBookings.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* ── List ── */}
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
          />
        ))}
      </div>

      {/* ── Drawer ── */}
      {drawer && (
        <BookingDrawer
          booking={drawer}
          isFitting={drawer._type === 'fitting'}
          onAction={(b, a) => setActionModal({ booking: b, actionDef: a, isFitting: b._type === 'fitting' })}
          onCancel={(id, isFit) => isFit ? cancelFitting(id) : cancelDirect(id)}
          onEditFitting={setEditFittingModal}
          onClose={() => setDrawer(null)}
        />
      )}

      {/* ── Action modal ── */}
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

      {/* ── Edit fitting schedule modal ── */}
      {editFittingModal && (
        <EditFittingModal
          booking={editFittingModal}
          onSave={saveFittingSchedule}
          onClose={() => setEditFittingModal(null)}
        />
      )}

      {/* ── Settings modal ── */}
      {showSettings && (
        <SettingsModal
          settings={workingHours}
          onSave={async (s) => {
            localStorage.setItem('bookingWorkingHours', JSON.stringify(s));
            setWorkingHours(s);
            showToastMsg('success', 'Settings saved');
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      <Toast toast={toast} onClose={() => setToast({ show: false, type: 'success', message: '' })} />
    </div>
  );
}