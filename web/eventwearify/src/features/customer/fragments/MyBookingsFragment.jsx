import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  X, Calendar, Clock, User, Mail, Phone, Tag, FileText, Package,
  Image as ImageIcon, AlertCircle, Trash2, Loader2,
  CheckCircle, ChevronLeft, ChevronRight, ChevronDown,
  AlertTriangle, Info, Edit2
} from 'lucide-react';
import { sseService } from '../../../shared/services/sseService';
import '../styles/MyBookingsFragment.css';
import '../styles/BrowseOutfitsFragment.css';
import {
  cancelFittingBooking, cancelDirectBooking,
  getUnavailableDates, checkDirectBookingAvailability,
  getBookedFittingSlots, editCustomerBookingDates, rescheduleCustomerFitting,
  fetchInventorySettings,
} from '../services/inventoryApi';
import { useBookingSettings } from '../../../shared/hooks/useBookingSettings';

// ── Shared helpers (mirrors BrowseOutfitsFragment) ───────────────────────────

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const DEFAULT_LEASING = { minLeaseDays: 2, weeklyDiscount: 100, monthlyDiscountCap: 300 };

const todayStr       = () => new Date().toISOString().split('T')[0];
const fmtDate        = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) : '';
// Leasing bookings must be placed at least 2 days before the pickup date.
const minLeasingStart = () => { const d = new Date(); d.setDate(d.getDate() + 2); return d.toISOString().split('T')[0]; };

const to24Hour = (time12) => {
  const [time, period] = time12.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (period === 'AM' && hours === 12) hours = 0;
  if (period === 'PM' && hours !== 12) hours += 12;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const fmt24to12 = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

function min2label(totalMin) {
  const h24 = Math.floor(totalMin / 60);
  const m   = totalMin % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12    = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function buildTimeSlots(settings) {
  const openMin  = (settings?.startHour  ?? 9)  * 60 + (settings?.startMinute  ?? 0);
  const closeMin = (settings?.endHour    ?? 17) * 60 + (settings?.endMinute    ?? 0);
  const step     = settings?.fittingDurationMinutes || 30;
  const slots    = [];
  for (let t = openMin; t + step <= closeMin; t += step) slots.push(min2label(t));
  return slots;
}

function isWorkingDay(dateStr, settings) {
  if (!settings?.enabled) return true;
  if (!dateStr) return true;
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  return (settings.workingDays || [1,2,3,4,5]).includes(dow);
}

function isWorkdayOver(settings) {
  const now = new Date();
  const closeMin = ((settings?.endHour ?? 17) * 60) + (settings?.endMinute ?? 0);
  return (now.getHours() * 60 + now.getMinutes()) >= closeMin;
}

function datesOverlap(s1, e1, s2, e2) { return s1 <= e2 && e1 >= s2; }

function classifyDateRange(startDate, endDate, occupiedRanges) {
  if (!startDate || !endDate || !occupiedRanges?.length) return 'free';
  let hasPending = false;
  for (const r of occupiedRanges) {
    if (!datesOverlap(startDate, endDate, r.startDate, r.endDate)) continue;
    if (r.status === 'Approved' || r.status === 'Active Lease' || r.status === 'Under Maintenance') return 'blocked';
    if (r.status === 'Pending') hasPending = true;
  }
  return hasPending ? 'pending' : 'free';
}

function calculateLeasePricing(dailyRate, startDateStr, endDateStr, settings) {
  if (!startDateStr || !endDateStr || !dailyRate) return null;
  const start = new Date(startDateStr);
  const end   = new Date(endDateStr);
  if (isNaN(start) || isNaN(end) || end < start) return null;
  const effectiveSettings = settings || DEFAULT_LEASING;
  const totalDays = Math.round((end - start) / 86_400_000) + 1;
  if (totalDays < effectiveSettings.minLeaseDays) {
    return { isValid: false, totalDays, minLeaseDays: effectiveSettings.minLeaseDays };
  }
  const basePrice  = dailyRate * totalDays;
  const weeks      = Math.floor(totalDays / 7);
  const rawDisc    = weeks * effectiveSettings.weeklyDiscount;
  const discount   = Math.min(rawDisc, effectiveSettings.monthlyDiscountCap);
  const finalPrice = Math.max(0, basePrice - discount);
  const savingsText = discount > 0 ? `You save ₱${discount.toLocaleString()} from weekly discounts` : '';
  return { isValid: true, totalDays, weeks, basePrice, discount, finalPrice, savingsText, minLeaseDays: effectiveSettings.minLeaseDays };
}

// ── DirectDatePicker (mirrors BrowseOutfitsFragment) ─────────────────────────

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

  const isDateBlocked = (dateStr) => {
    if (!occupiedRanges || !occupiedRanges.length) return false;
    return occupiedRanges.some(range => dateStr >= range.startDate && dateStr <= range.endDate);
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
        <span style={{ flex: 1, textAlign: 'left' }}>{value ? fmtDate(value) : `Select ${label || 'date'}`}</span>
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
              const ds = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isPast    = ds < today || (ds === todayStr() && isWorkdayOver(bookingSettings));
              const isNonWork = !isWorkingDay(ds, bookingSettings);
              const isBlocked = isDateBlocked(ds);
              const isSelected = ds === value;
              const isToday    = ds === todayStr();
              const clickable  = !isPast && !isNonWork && !isBlocked;
              let cls = 'fitting-cal-day';
              if (isPast) cls += ' fcd-past';
              else if (isNonWork) cls += ' fcd-closed';
              else if (isBlocked) cls += ' fcd-full';
              else cls += ' fcd-avail';
              if (isSelected) cls += ' fcd-selected';
              if (isToday && !isSelected) cls += ' fcd-today';
              return (
                <button key={ds} type="button" className={cls} onClick={() => clickable && (onChange(ds), setOpen(false))} disabled={!clickable}
                  title={isPast ? 'Past date' : isNonWork ? 'Closed day' : isBlocked ? 'Already booked' : undefined}>
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

// ── FittingDatePicker (mirrors BrowseOutfitsFragment) ────────────────────────

function FittingDatePicker({ value, onChange, minDate, bookingSettings, itemId, timeSlots, slotCacheRef, disabled }) {
  const today = minDate || todayStr();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const [view, setView] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [localCache, setLocalCache]   = useState({});
  const [loadingSet, setLoadingSet]   = useState(new Set());

  useEffect(() => {
    if (!open) return;
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const { year, month } = view;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = new Date(year, month, 1).getDay();

  useEffect(() => {
    if (!itemId || !timeSlots.length) return;
    const externalCache = slotCacheRef?.current || {};
    const initialPatch = {};
    const toFetch = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (ds < today) continue;
      if (!isWorkingDay(ds, bookingSettings)) continue;
      const cKey = `${itemId}__${ds}`;
      if (localCache[ds] !== undefined || externalCache[cKey] !== undefined) {
        if (externalCache[cKey] !== undefined && localCache[ds] === undefined) {
          initialPatch[ds] = externalCache[cKey];
        }
        continue;
      }
      toFetch.push(ds);
    }

    if (Object.keys(initialPatch).length) {
      queueMicrotask(() => {
        setLocalCache(prev => ({ ...prev, ...initialPatch }));
      });
    }
    if (!toFetch.length) return;

    queueMicrotask(() => {
      setLoadingSet(prev => new Set([...prev, ...toFetch]));
    });
    Promise.all(
      toFetch.map(ds => getBookedFittingSlots(itemId, ds).then(slots => ({ ds, slots })).catch(() => ({ ds, slots: [] })))
    ).then(results => {
      const patch = {};
      results.forEach(({ ds, slots }) => {
        patch[ds] = slots;
        if (slotCacheRef) slotCacheRef.current[`${itemId}__${ds}`] = slots;
      });
      setLocalCache(prev => ({ ...prev, ...patch }));
      setLoadingSet(prev => { const next = new Set(prev); results.forEach(({ ds }) => next.delete(ds)); return next; });
    });
  }, [year, month, itemId, timeSlots.length, today, bookingSettings, localCache, slotCacheRef, daysInMonth]);

  const getSlots = ds => localCache[ds];

  const prevMonth = () => setView(v => { const d = new Date(v.year, v.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const nextMonth = () => setView(v => { const d = new Date(v.year, v.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const canPrev   = new Date(year, month, 0).toISOString().split('T')[0] >= today;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="fitting-cal-wrap" ref={wrapRef}>
      <button type="button" className={`fitting-cal-trigger${!value ? ' fct-empty' : ''}`}
        onClick={() => {
          if (disabled) return;
          if (!open && value) {
            const d = new Date(value + 'T00:00:00');
            setView({ year: d.getFullYear(), month: d.getMonth() });
          }
          setOpen(o => !o);
        }} disabled={disabled}>
        <Calendar size={13} style={{ color: value ? '#6b2d39' : '#bbb', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>{value ? fmtDate(value) : 'Select a date'}</span>
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
              const ds         = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isPast     = ds < today || (ds === todayStr() && isWorkdayOver(bookingSettings));
              const isNonWork  = !isWorkingDay(ds, bookingSettings);
              const slots      = getSlots(ds);
              const isChecking = loadingSet.has(ds);
              const isFullBook = !isPast && !isNonWork && timeSlots.length > 0 && slots !== undefined && timeSlots.every(t => slots.includes(to24Hour(t)));
              const isSelected = ds === value;
              const isToday    = ds === todayStr();
              const clickable  = !isPast && !isNonWork && !isFullBook;
              let cls = 'fitting-cal-day';
              if (isPast) cls += ' fcd-past';
              else if (isNonWork) cls += ' fcd-closed';
              else if (isFullBook) cls += ' fcd-full';
              else cls += ' fcd-avail';
              if (isSelected) cls += ' fcd-selected';
              if (isToday && !isSelected) cls += ' fcd-today';
              return (
                <button key={ds} type="button" className={cls}
                  onClick={() => clickable && (onChange(ds), setOpen(false))} disabled={!clickable}
                  title={isPast ? 'Past date' : isNonWork ? 'Closed day' : isFullBook ? 'Fully booked' : undefined}>
                  {day}
                  {isChecking && !isPast && !isNonWork && <span className="fcd-dot fcd-dot-checking" />}
                  {isFullBook && !isChecking && <span className="fcd-dot fcd-dot-full" />}
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

// ── EditDirectBookingModal ────────────────────────────────────────────────────

function EditDirectBookingModal({ booking, onClose, onSuccess, bookingSettings, inventorySettings }) {
  const isActiveLease = booking.bookingStatus === 'Active Lease';
  const dailyRate = (booking.basePrice && booking.totalDays && booking.totalDays > 0)
    ? parseFloat(booking.basePrice) / booking.totalDays
    : 0;

  const [form, setForm] = useState({
    startDate: booking.startDate || '',
    endDate:   booking.endDate   || '',
  });
  const [occupiedRanges, setOccupiedRanges]   = useState([]);
  const [loadingOccupied, setLoadingOccupied] = useState(true);
  const [availability, setAvailability]       = useState(null);
  const [checkingAvail, setCheckingAvail]     = useState(false);
  const [overlapStatus, setOverlapStatus]     = useState(null);
  const [pendingAcknowledged, setPendingAcknowledged] = useState(false);
  const [formError, setFormError]             = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const debounceRef = useRef(null);

  const pricing = useMemo(
    () => calculateLeasePricing(dailyRate, form.startDate, form.endDate, inventorySettings),
    [dailyRate, form.startDate, form.endDate, inventorySettings]
  );

  useEffect(() => {
    setLoadingOccupied(true);
    getUnavailableDates(booking.inventoryItemId, booking.id)
      .then(ranges => setOccupiedRanges(Array.isArray(ranges) ? ranges : []))
      .catch(() => setOccupiedRanges([]))
      .finally(() => setLoadingOccupied(false));
  }, [booking.inventoryItemId, booking.id]);

  useEffect(() => {
    if (!form.startDate || !form.endDate || !pricing?.isValid) {
      setOverlapStatus(null);
      setPendingAcknowledged(false);
      return;
    }
    setOverlapStatus(classifyDateRange(form.startDate, form.endDate, occupiedRanges));
    setPendingAcknowledged(false);
  }, [form.startDate, form.endDate, pricing?.isValid, occupiedRanges]);

  useEffect(() => {
    if (!form.startDate || !form.endDate || !pricing?.isValid || overlapStatus === 'blocked') {
      setAvailability(null);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCheckingAvail(true);
      try {
        const avail = await checkDirectBookingAvailability(booking.inventoryItemId, form.startDate, form.endDate, booking.id);
        setAvailability(avail);
      } catch {
        setAvailability(null);
      } finally {
        setCheckingAvail(false);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [form.startDate, form.endDate, pricing?.isValid, overlapStatus, booking.inventoryItemId, booking.id]);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleStartChange = (newStart) => {
    setForm(p => ({ ...p, startDate: newStart, endDate: p.endDate && p.endDate < newStart ? '' : p.endDate }));
  };

  const pendingBlocking = overlapStatus === 'pending' && !pendingAcknowledged;
  // For Pending/Approved bookings, start date must be at least 2 days away.
  const startDateValid = isActiveLease || form.startDate >= minLeasingStart();
  const canSubmit = pricing?.isValid && startDateValid && overlapStatus !== 'blocked' && availability !== false && !submitting && !checkingAvail && !pendingBlocking;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!isActiveLease && form.startDate < minLeasingStart()) {
      setFormError(`Leasing bookings must be made at least 2 days in advance. Earliest start: ${fmtDate(minLeasingStart())}.`);
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await editCustomerBookingDates(booking.id, form.startDate, form.endDate);
      onSuccess();
      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to update booking dates. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><Edit2 size={16} style={{ marginRight: '8px' }} />Edit Rental Dates — {booking.itemName}</h3>
          <button className="inv-modal-close" onClick={onClose} disabled={submitting}><X size={16} /></button>
        </div>

        <div className="inv-modal-body">
          {isActiveLease && (
            <div className="inv-warning-box" style={{ background: 'rgba(245,158,11,0.07)', borderColor: '#f59e0b', color: '#b45309' }}>
              <Info size={16} />
              <div><strong>Active Lease:</strong> Start date is locked. You may only change the end date.</div>
            </div>
          )}

          <div className="inv-modal-grid">
            <div className="inv-field">
              <label className="inv-field-label">Rental Start Date <span className="inv-required">*</span></label>
              {isActiveLease ? (
                <div className="fitting-cal-trigger" style={{ cursor: 'not-allowed', opacity: 0.6 }}>
                  <Calendar size={13} style={{ color: '#6b2d39', flexShrink: 0 }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{fmtDate(form.startDate)}</span>
                </div>
              ) : (
                <DirectDatePicker
                  value={form.startDate}
                  onChange={handleStartChange}
                  minDate={minLeasingStart()}
                  bookingSettings={bookingSettings}
                  occupiedRanges={occupiedRanges}
                  disabled={submitting || loadingOccupied}
                  label="start date"
                />
              )}
            </div>
            <div className="inv-field">
              <label className="inv-field-label">Rental End Date <span className="inv-required">*</span></label>
              <DirectDatePicker
                value={form.endDate}
                onChange={(newEnd) => setForm(p => ({ ...p, endDate: newEnd }))}
                minDate={isActiveLease ? todayStr() : (form.startDate || todayStr())}
                bookingSettings={bookingSettings}
                occupiedRanges={occupiedRanges}
                disabled={submitting || loadingOccupied || (!isActiveLease && !form.startDate)}
                label="end date"
              />
            </div>
          </div>

          {formError && (
            <div className="inv-modal-error">
              <AlertTriangle size={16} />
              <span>{formError}</span>
            </div>
          )}
          {pricing && !pricing.isValid && (
            <div className="inv-warning-box">
              <AlertTriangle size={16} />
              <div>Minimum lease duration is <strong>{pricing.minLeaseDays} days</strong>. Please extend your rental period.</div>
            </div>
          )}

          {pricing?.isValid && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {overlapStatus === 'blocked' && (
                <div className="inv-warning-box inv-warning-box-blocked">
                  <AlertTriangle size={16} />
                  <div><strong>Dates not available.</strong> Another confirmed booking occupies this period. Choose different dates.</div>
                </div>
              )}
              {overlapStatus === 'pending' && !pendingAcknowledged && (
                <div className="inv-warning-box inv-warning-box-pending">
                  <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <strong>Heads up:</strong> Another customer has a <em>pending</em> booking overlapping these dates.
                    <div className="inv-overlap-actions">
                      <button className="inv-btn-overlap-yes" onClick={() => setPendingAcknowledged(true)} disabled={submitting}>Yes, continue</button>
                      <button className="inv-btn-overlap-no" onClick={() => setForm(p => ({ ...p, startDate: booking.startDate, endDate: booking.endDate }))} disabled={submitting}>Reset dates</button>
                    </div>
                  </div>
                </div>
              )}
              {overlapStatus !== 'blocked' && checkingAvail && (
                <div className="inv-warning-box" style={{ borderColor: '#6b2d39' }}>
                  <Loader2 size={14} className="inv-spinner-inline" /><span>Checking availability…</span>
                </div>
              )}
              {overlapStatus !== 'blocked' && !checkingAvail && availability === false && (
                <div className="inv-warning-box">
                  <AlertTriangle size={16} />
                  <div>These dates are <strong>not available</strong>. Please choose different dates.</div>
                </div>
              )}
              {overlapStatus !== 'blocked' && !checkingAvail && availability === true && overlapStatus !== 'pending' && (
                <div className="inv-warning-box" style={{ background: 'rgba(21,128,61,0.07)', borderColor: '#15803d', color: '#15803d' }}>
                  <CheckCircle size={14} /><span>Dates are available!</span>
                </div>
              )}
            </div>
          )}

          {pricing?.isValid && (
            <div className="inv-pricing-summary">
              <div className="inv-pricing-row">
                <span className="label">Lease Duration:</span>
                <span className="value">{pricing.totalDays} day{pricing.totalDays !== 1 ? 's' : ''}</span>
              </div>
              <div className="inv-pricing-row">
                <span className="label">Base Price (₱{dailyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {pricing.totalDays} days):</span>
                <span className="value">₱{pricing.basePrice.toLocaleString()}</span>
              </div>
              {pricing.discount > 0 && (
                <div className="inv-pricing-row inv-discount-row">
                  <span className="label">Weekly Discount ({pricing.weeks} week{pricing.weeks !== 1 ? 's' : ''}):</span>
                  <span className="value">−₱{pricing.discount.toLocaleString()}</span>
                </div>
              )}
              <hr />
              <div className="inv-pricing-row inv-total-row">
                <span className="label"><strong>New Total Amount:</strong></span>
                <span className="value"><strong>₱{pricing.finalPrice.toLocaleString()}</strong></span>
              </div>
              {pricing.savingsText && <div className="inv-savings-text">{pricing.savingsText}</div>}
            </div>
          )}
        </div>

        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="inv-btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting
              ? <><Loader2 size={14} className="inv-spinner-inline" /> Saving…</>
              : <><Edit2 size={13} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── RescheduleFittingModal ────────────────────────────────────────────────────

function RescheduleFittingModal({ booking, onClose, onSuccess, bookingSettings }) {
  const timeSlots   = useMemo(() => buildTimeSlots(bookingSettings), [bookingSettings]);
  const slotCacheRef = useRef({});

  const [form, setForm] = useState({
    fittingDate: booking.fittingDate || '',
    fittingTime: fmt24to12(booking.fittingTime) || '',
  });
  const [bookedSlots, setBookedSlots]   = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [formError, setFormError]       = useState('');
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!form.fittingDate || !booking.itemId) { setBookedSlots([]); return; }
    const cKey = `${booking.itemId}__${form.fittingDate}`;
    if (slotCacheRef.current[cKey] !== undefined) {
      setBookedSlots(slotCacheRef.current[cKey]);
      return;
    }
    setLoadingSlots(true);
    getBookedFittingSlots(booking.itemId, form.fittingDate)
      .then(slots => {
        slotCacheRef.current[cKey] = slots;
        setBookedSlots(slots);
      })
      .catch(() => setBookedSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [form.fittingDate, booking.itemId]);

  // Auto-select first available slot when date changes
  useEffect(() => {
    if (!timeSlots.length) return;
    const firstAvail = timeSlots.find(t => !bookedSlots.includes(to24Hour(t)));
    setForm(p => ({
      ...p,
      fittingTime: bookedSlots.includes(to24Hour(p.fittingTime))
        ? (firstAvail || '')
        : (p.fittingTime || firstAvail || ''),
    }));
  }, [bookedSlots, timeSlots]);

  const selectedTimeBooked = form.fittingTime && bookedSlots.includes(to24Hour(form.fittingTime));
  const canSubmit = form.fittingDate && form.fittingTime && !selectedTimeBooked && !submitting && !loadingSlots;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!form.fittingDate || !form.fittingTime) return;
    if (bookingSettings?.enableTimeRestrictions && !isWorkingDay(form.fittingDate, bookingSettings)) {
      setFormError('Selected date is not a working day.');
      return;
    }
    if (selectedTimeBooked) {
      setFormError('That time slot is already booked. Please select another.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      await rescheduleCustomerFitting(booking.id, form.fittingDate, to24Hour(form.fittingTime));
      onSuccess();
      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to reschedule. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const dateIsNonWorking = form.fittingDate && !isWorkingDay(form.fittingDate, bookingSettings);

  return ReactDOM.createPortal(
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><Calendar size={16} style={{ marginRight: '8px' }} />Reschedule Fitting — {booking.itemName}</h3>
          <button className="inv-modal-close" onClick={onClose} disabled={submitting}><X size={16} /></button>
        </div>

        <div className="inv-modal-body">
          <div style={{ marginBottom: '0.75rem', padding: '0.75rem 1rem', background: '#faf9f7', borderRadius: '8px', fontSize: '0.82rem', color: '#666' }}>
            <Calendar size={13} style={{ display: 'inline', marginRight: '6px', color: '#6b2d39' }} />
            Current: <strong>{fmtDate(booking.fittingDate)}</strong> at <strong>{fmt24to12(booking.fittingTime)}</strong>
          </div>

          <div className="inv-field">
            <label className="inv-field-label">New Date <span className="inv-required">*</span></label>
            <FittingDatePicker
              value={form.fittingDate}
              onChange={ds => setForm(p => ({ ...p, fittingDate: ds, fittingTime: '' }))}
              minDate={todayStr()}
              bookingSettings={bookingSettings}
              itemId={booking.itemId}
              timeSlots={timeSlots}
              slotCacheRef={slotCacheRef}
              disabled={submitting}
            />
            {dateIsNonWorking && (
              <span className="inv-field-hint inv-field-hint-warn">
                <AlertTriangle size={11} /> Not a working day
              </span>
            )}
          </div>

          {formError && (
            <div className="inv-modal-error" style={{ marginBottom: '1rem' }}>
              <AlertTriangle size={16} />
              <span>{formError}</span>
            </div>
          )}
          <div className="inv-field" style={{ marginTop: '1rem' }}>
            <label className="inv-field-label">New Time <span className="inv-required">*</span></label>
            {loadingSlots ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.83rem', color: '#888', padding: '0.5rem 0' }}>
                <Loader2 size={14} className="inv-spinner-inline" /> Checking availability…
              </div>
            ) : (
              <select
                className="inv-select"
                value={form.fittingTime}
                onChange={e => setForm(p => ({ ...p, fittingTime: e.target.value }))}
                disabled={submitting || !form.fittingDate}
                style={{ width: '100%' }}
              >
                <option value="">Select a time slot</option>
                {timeSlots.map(slot => {
                  const isBooked = bookedSlots.includes(to24Hour(slot));
                  return (
                    <option key={slot} value={slot} disabled={isBooked}>
                      {slot}{isBooked ? ' — Fully Booked' : ''}
                    </option>
                  );
                })}
              </select>
            )}
            {selectedTimeBooked && (
              <span className="inv-field-hint inv-field-hint-error">
                <AlertTriangle size={11} /> This time slot is already booked
              </span>
            )}
          </div>
        </div>

        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="inv-btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting
              ? <><Loader2 size={14} className="inv-spinner-inline" /> Saving…</>
              : <><Calendar size={13} /> Confirm Reschedule</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDateTime = (s) =>
  s ? new Date(s).toLocaleString('en-PH', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

const mapStatus = (status, type) => {
  if (!status) return 'Unknown';
  if (type === 'fitting') {
    if (status === 'CONFIRMED') return 'Confirmed';
    if (status === 'COMPLETED') return 'Completed';
    if (status === 'CANCELLED') return 'Cancelled';
    if (status === 'LEASE_CONVERTED') return 'Lease Converted';
    return status;
  }
  const statusMap = { Pending:'Pending', Approved:'Approved', 'Active Lease':'Active Lease', Returned:'Returned', Completed:'Completed', Rejected:'Rejected', Cancelled:'Cancelled' };
  return statusMap[status] || status;
};

const getStatusClass = (status, type) => {
  const displayStatus = mapStatus(status, type);
  const classMap = {
    'Confirmed':'status-confirmed', 'Completed':'status-completed', 'Cancelled':'status-cancelled',
    'Lease Converted':'status-lease-converted', 'Pending':'status-pending', 'Approved':'status-approved',
    'Active Lease':'status-active-lease', 'Returned':'status-returned', 'Rejected':'status-rejected', 'Unknown':'status-unknown',
  };
  return `status-badge ${classMap[displayStatus] || 'status-default'}`;
};

const isActive = (booking) => {
  if (booking.type === 'fitting') return booking.status === 'CONFIRMED';
  return ['Pending', 'Approved', 'Active Lease'].includes(booking.bookingStatus);
};

const isCancellable = (booking) => {
  if (booking.type === 'fitting') return booking.status === 'CONFIRMED';
  return booking.bookingStatus === 'Pending' || booking.bookingStatus === 'Approved';
};

const isEditable = (booking) => {
  if (booking.type === 'fitting') return booking.status === 'CONFIRMED';
  return ['Pending', 'Approved', 'Active Lease'].includes(booking.bookingStatus);
};

// ── BookingDetailModal ────────────────────────────────────────────────────────

function BookingDetailModal({ booking, onClose }) {
  const [imageUrl, setImageUrl]     = useState(null);
  const [mediaLoading, setMediaLoading] = useState(!!booking.itemId);
  const [imgError, setImgError]     = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!booking.itemId) return;
    const token = localStorage.getItem('token');
    fetch(`/api/inventory/items/${booking.itemId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const files = data?.mediaFiles || [];
        const first = files.find(f => f.type === 'image') || files[0];
        setImageUrl(first?.url || null);
      })
      .catch(() => setImageUrl(null))
      .finally(() => setMediaLoading(false));
  }, [booking.itemId]);

  const isFitting = booking.type === 'fitting';
  const displayStatus = mapStatus(booking.status, booking.type);

  return ReactDOM.createPortal(
    <div className="bdm-overlay" onClick={onClose}>
      <div className="bdm-modal" onClick={e => e.stopPropagation()}>
        <button className="bdm-close-btn-top" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="bdm-container">
          <div className="bdm-image-section">
            {mediaLoading && <div className="bdm-shimmer" />}
            {!mediaLoading && imageUrl && !imgError
              ? <img src={imageUrl} alt={booking.itemName} className="bdm-main-img" onError={() => setImgError(true)} />
              : <div className="bdm-placeholder"><ImageIcon size={48} strokeWidth={1} /><span>Image Unavailable</span></div>}
            <div className="bdm-status-float">
              <span className={getStatusClass(booking.status, booking.type)}>{displayStatus}</span>
            </div>
          </div>
          <div className="bdm-details-section">
            <header className="bdm-header">
              <div className="bdm-type-indicator">
                {isFitting ? <><Calendar size={14} /> Fitting Appointment</> : <><Package size={14} /> Rental Booking</>}
              </div>
              <span className="bdm-sub">Ref: {isFitting ? booking.bookingId : booking.id}</span>
              <h2 className="bdm-title">{booking.itemName}</h2>
            </header>
            <div className="bdm-scroll-area">
              <section className="bdm-grid-section">
                <h4 className="bdm-label">{isFitting ? 'Appointment Details' : 'Rental Period'}</h4>
                <div className="bdm-card-grid">
                  {isFitting ? (
                    <>
                      <div className="bdm-mini-card"><Calendar size={16} /><div><label>Date</label><p>{booking.fittingDate || '—'}</p></div></div>
                      <div className="bdm-mini-card"><Clock size={16} /><div><label>Time</label><p>{booking.fittingTime ? fmt24to12(booking.fittingTime) : '—'}</p></div></div>
                      <div className="bdm-mini-card"><Tag size={16} /><div><label>Size</label><p>{booking.preferredSize || '—'}</p></div></div>
                    </>
                  ) : (
                    <>
                      <div className="bdm-mini-card"><Calendar size={16} /><div><label>Start Date</label><p>{booking.startDate || '—'}</p></div></div>
                      <div className="bdm-mini-card"><Calendar size={16} /><div><label>End Date</label><p>{booking.endDate || '—'}</p></div></div>
                      <div className="bdm-mini-card"><Tag size={16} /><div><label>Total Days</label><p>{booking.totalDays || '—'}</p></div></div>
                    </>
                  )}
                </div>
              </section>
              <section className="bdm-grid-section">
                <h4 className="bdm-label">Customer Contact</h4>
                <div className="bdm-contact-card">
                  <div className="bdm-contact-row"><User size={16} /><span>{booking.customerName}</span></div>
                  <div className="bdm-contact-row"><Mail size={16} /><span>{booking.customerEmail}</span></div>
                  {booking.customerPhone && <div className="bdm-contact-row"><Phone size={16} /><span>{booking.customerPhone}</span></div>}
                </div>
              </section>
              {!isFitting && booking.finalPrice && (
                <section className="bdm-grid-section">
                  <h4 className="bdm-label">Price Details</h4>
                  <div className="bdm-notes-box"><Package size={14} className="notes-icon" /><p>₱{Number(booking.finalPrice).toLocaleString()}</p></div>
                  <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>Cash Payment:</span>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: '12px',
                      background: booking.paymentStatus === 'Paid' ? 'rgba(21,128,61,0.12)' : 'rgba(180,83,9,0.12)',
                      color: booking.paymentStatus === 'Paid' ? '#15803d' : '#b45309',
                    }}>
                      {booking.paymentStatus === 'Paid' ? '✓ Paid' : 'Unpaid'}
                    </span>
                    {booking.paymentStatus === 'Paid' && booking.paymentDate && (
                      <span style={{ fontSize: '0.72rem', color: '#aaa' }}>
                        on {new Date(booking.paymentDate).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                      </span>
                    )}
                  </div>
                </section>
              )}
              {booking.notes && (
                <section className="bdm-grid-section">
                  <h4 className="bdm-label">Notes</h4>
                  <div className="bdm-notes-box"><FileText size={14} className="notes-icon" /><p>{booking.notes}</p></div>
                </section>
              )}
            </div>
            <footer className="bdm-footer"><Package size={14} /><span>Booked on {formatDateTime(booking.createdAt)}</span></footer>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CancelBookingConfirmModal({ booking, onClose, onConfirm, loading, error }) {
  if (!booking) return null;
  const actionLabel = booking.type === 'fitting' ? 'fitting appointment' : 'rental booking';
  const infoLabel   = booking.type === 'fitting' ? booking.fittingDate : `${booking.startDate} → ${booking.endDate}`;
  return ReactDOM.createPortal(
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3>Cancel {actionLabel}?</h3>
          <button className="inv-modal-close" onClick={onClose} disabled={loading}><X size={16} /></button>
        </div>
        <div className="inv-modal-body">
          <p style={{ margin: 0, color: '#4b5563' }}>
            This action cannot be undone. Confirming cancellation will remove this booking from your active reservations.
          </p>
          <div className="inv-modal-grid" style={{ marginTop: '1rem', gap: '0.75rem' }}>
            <div className="inv-mini-card">
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.5rem' }}>Booking</label>
              <p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{booking.type === 'fitting' ? booking.bookingId : booking.id}</p>
            </div>
            <div className="inv-mini-card">
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.5rem' }}>Date / Period</label>
              <p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{infoLabel}</p>
            </div>
          </div>
          {error && (
            <div className="inv-modal-error" style={{ marginTop: '1rem' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={loading}>Keep booking</button>
          <button className="inv-btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? <><Loader2 size={14} className="spinner-inline" /> Cancelling…</> : <><Trash2 size={14} /> Confirm cancellation</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── BookingsView ──────────────────────────────────────────────────────────────

const BookingsView = () => {
  const [bookings, setBookings]             = useState([]);
  const [error, setError]                   = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingBooking, setEditingBooking]   = useState(null);
  const [cancelConfirmBooking, setCancelConfirmBooking] = useState(null);
  const [cancelError, setCancelError]         = useState('');
  const [cancelLoading, setCancelLoading]     = useState(false);
  const [cancellingId, setCancellingId]       = useState(null);
  const [activeTab, setActiveTab]             = useState('active');

  const { settings: bookingSettings } = useBookingSettings();
  const [inventorySettings, setInventorySettings] = useState(null);

  useEffect(() => {
    fetchInventorySettings()
      .then(s => setInventorySettings(s))
      .catch(() => {});
  }, []);

  const fetchBookings = useCallback(() => {
    const token = localStorage.getItem('token');
    const fetchFitting = fetch('/api/inventory/bookings/my', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : []);
    const fetchDirect = fetch('/api/direct-bookings/my-all-bookings', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : []);

    return Promise.all([fetchFitting, fetchDirect]).then(([fittingData, directData]) => {
      const fittingWithType = (fittingData || []).map(b => ({ ...b, type: 'fitting' }));
      const directWithType  = (directData  || []).map(b => ({ ...b, type: 'direct', status: b.bookingStatus, itemId: b.inventoryItemId }));
      const all = [...fittingWithType, ...directWithType].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setBookings(all);
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      await fetchBookings();
    } catch (err) {
      setError(err.message);
    }
  }, [fetchBookings]);

  useEffect(() => {
    void loadData();
    sseService.connect();
    const unsub = sseService.on('BOOKING_UPDATE', loadData);
    return () => unsub();
  }, [loadData]);

  const handleCancel = (booking) => {
    setCancelConfirmBooking(booking);
    setCancelError('');
  };

  const confirmCancel = async () => {
    if (!cancelConfirmBooking) return;
    const booking = cancelConfirmBooking;
    const bookingKey = booking.type === 'fitting' ? booking.bookingId : booking.id;
    setCancelLoading(true);
    setCancellingId(bookingKey);
    setCancelError('');
    try {
      if (booking.type === 'fitting') await cancelFittingBooking(booking.id);
      else await cancelDirectBooking(booking.id);
      await fetchBookings();
      setCancelConfirmBooking(null);
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel booking. Please try again.');
    } finally {
      setCancelLoading(false);
      setCancellingId(null);
    }
  };

  const getDisplayId   = b => b.type === 'fitting' ? b.bookingId : b.id;
  const getDisplayDate = b => b.type === 'fitting' ? b.fittingDate : `${b.startDate} → ${b.endDate}`;

  const activeBookings    = bookings.filter(isActive);
  const completedBookings = bookings.filter(b => !isActive(b));
  const displayedBookings = activeTab === 'active' ? activeBookings : completedBookings;
  const showCancelButton  = activeTab === 'active';

  const renderBookingTable = (bookingsList) => (
    <div className="bookings-table-wrap">
      <table className="bookings-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Booking ID</th>
            <th>Outfit(s)</th>
            <th>Date / Period</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {bookingsList.map(booking => {
            const cancellable  = showCancelButton && isCancellable(booking);
            const editable     = showCancelButton && isEditable(booking);
            const isCancelling = cancellingId === (booking.type === 'fitting' ? booking.bookingId : booking.id);
            return (
              <tr key={`${booking.type}-${booking.id || booking.bookingId}`} className={cancellable ? 'cancellable-row' : ''}>
                <td data-label="Type">
                  <span className={`booking-type-badge ${booking.type}`}>
                    {booking.type === 'fitting' ? <><Calendar size={12} /> Fitting</> : <><Package size={12} /> Rental</>}
                  </span>
                </td>
                <td data-label="Booking ID"><span className="booking-id">{getDisplayId(booking)}</span></td>
                <td data-label="Outfit(s)"><span className="booking-outfit">{booking.itemName}</span></td>
                <td data-label="Date / Period">{getDisplayDate(booking)}</td>
                <td data-label="Status">
                  <span className={getStatusClass(booking.status, booking.type)}>
                    {mapStatus(booking.status, booking.type)}
                  </span>
                  {booking.type === 'direct' && (
                    <span style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: booking.paymentStatus === 'Paid' ? 'rgba(21,128,61,0.12)' : 'rgba(180,83,9,0.12)',
                      color: booking.paymentStatus === 'Paid' ? '#15803d' : '#b45309',
                    }}>
                      {booking.paymentStatus === 'Paid' ? '✓ Paid' : 'Unpaid'}
                    </span>
                  )}
                </td>
                <td data-label="Action">
                  <div className="action-buttons">
                    <button className="btn-details" onClick={() => setSelectedBooking(booking)}>View Details</button>
                    {editable && (
                      <button className="btn-edit" onClick={() => setEditingBooking(booking)} title="Edit booking">
                        <Edit2 size={14} />
                        {booking.type === 'fitting' ? 'Reschedule' : 'Edit Dates'}
                      </button>
                    )}
                    {cancellable && (
                      <button className="btn-cancel" onClick={() => handleCancel(booking)} disabled={isCancelling} title="Cancel this booking">
                        {isCancelling ? <Loader2 size={14} className="spinner-inline" /> : <><Trash2 size={14} />Cancel</>}
                      </button>
                    )}
                    {!cancellable && showCancelButton && (
                      <button className="btn-cancel-disabled" disabled title="Cannot be cancelled at this stage"><Trash2 size={14} /> Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="bookings-root">
      <div className="bookings-header">
        <h2 className="bookings-title">Your Bookings</h2>
      </div>

      <div className="bookings-tabs">
        <button className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
          Active &amp; Pending <span className="tab-count">{activeBookings.length}</span>
        </button>
        <button className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
          Completed &amp; Cancelled <span className="tab-count">{completedBookings.length}</span>
        </button>
      </div>

      <div className="bookings-card">
        {error ? (
          <div className="error-state">
            <AlertCircle size={40} strokeWidth={1.5} />
            <p>Error: {error}</p>
            <button className="btn-retry" onClick={loadData}>Retry</button>
          </div>
        ) : displayedBookings.length === 0 ? (
          <div className="empty-state">
            <Package size={40} strokeWidth={1.5} />
            <p>No {activeTab === 'active' ? 'active' : 'completed/cancelled'} bookings.</p>
            <p className="empty-sub">
              {activeTab === 'active' ? 'Your active bookings will appear here.' : 'Past or cancelled bookings will appear here.'}
            </p>
          </div>
        ) : renderBookingTable(displayedBookings)}
      </div>

      {selectedBooking && (
        <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}

      {editingBooking && editingBooking.type === 'direct' && (
        <EditDirectBookingModal
          booking={editingBooking}
          onClose={() => setEditingBooking(null)}
          onSuccess={() => { setEditingBooking(null); loadData(); }}
          bookingSettings={bookingSettings}
          inventorySettings={inventorySettings}
        />
      )}

      {editingBooking && editingBooking.type === 'fitting' && (
        <RescheduleFittingModal
          booking={editingBooking}
          onClose={() => setEditingBooking(null)}
          onSuccess={() => { setEditingBooking(null); loadData(); }}
          bookingSettings={bookingSettings}
        />
      )}

      {cancelConfirmBooking && (
        <CancelBookingConfirmModal
          booking={cancelConfirmBooking}
          onClose={() => { setCancelConfirmBooking(null); setCancelError(''); }}
          onConfirm={confirmCancel}
          loading={cancelLoading}
          error={cancelError}
        />
      )}
    </div>
  );
};

export default BookingsView;
