// ==================== BrowseOutfitsFragment.jsx (with live inventory settings) ====================

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, LayoutGrid, List, Eye, Calendar,
  CheckCircle, AlertCircle, X, ChevronLeft, ChevronRight, ChevronDown,
  Play, Sparkles, Clock, AlertTriangle,
  Loader2, ShoppingBag, Info
} from 'lucide-react';
import '../styles/BrowseOutfitsFragment.css';
import {
  fetchItems, fetchPromotions, bookFitting, getUserBookings,
  createDirectBooking, checkDirectBookingAvailability, getUserDirectBookings,
  getBookedFittingSlots,
  getOccupiedDirectDates,
  cancelFittingBooking,
  cancelDirectBooking,
  fetchInventorySettings,           // <-- new import
} from '../services/inventoryApi';
import { getProfile } from '../services/userService';
import { useBookingSettings } from "../../../shared/hooks/useBookingSettings";

// ────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ────────────────────────────────────────────────────────────────────────────
const validatePhilippinePhone = (phone) => {
  const stripped = phone.replace(/\s/g, '');
  return /^\+63\d{10}$/.test(stripped);
};

// ────────────────────────────────────────────────────────────────────────────
// Philippine Phone Input Component with auto-formatting and flag
// ────────────────────────────────────────────────────────────────────────────
const PhilippinePhoneInput = ({ value, onChange, disabled, placeholder = "9XX XXX XXXX" }) => {
  const getRawDigits = (fullNumber) => {
    if (!fullNumber || typeof fullNumber !== 'string') return '';
    const match = fullNumber.match(/^\+63(\d+)$/);
    return match ? match[1] : '';
  };

  const [rawDigits, setRawDigits] = useState(() => getRawDigits(value));

  useEffect(() => {
    setRawDigits(getRawDigits(value));
  }, [value]);

  const formatDisplay = (digits) => {
    if (!digits) return '';
    const cleaned = digits.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
  };

  const handleChange = (e) => {
    let input = e.target.value;
    let digits = input.replace(/\D/g, '');
    if (digits.length > 10) digits = digits.slice(0, 10);
    setRawDigits(digits);
    const fullNumber = digits ? `+63${digits}` : '';
    onChange(fullNumber);
  };

  const isValid = rawDigits.length === 10 && rawDigits.startsWith('9');
  const displayValue = formatDisplay(rawDigits);

  return (
    <div className={`ph-phone-input-wrapper ${!isValid && rawDigits.length > 0 ? 'ph-phone-invalid' : ''}`}>
      <div className="ph-phone-prefix">
        <span className="ph-flag">🇵🇭</span>
        <span className="ph-country-code">+63</span>
      </div>
      <input
        type="tel"
        className="ph-phone-input"
        value={displayValue}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Leasing helpers (now uses injected settings instead of localStorage)
// ────────────────────────────────────────────────────────────────────────────
const DEFAULT_LEASING = { minLeaseDays: 2, weeklyDiscount: 100, monthlyDiscountCap: 300 };

function calculateLeasePricing(dailyRate, startDateStr, endDateStr, settings) {
  if (!startDateStr || !endDateStr) return null;
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
  const savings    = discount > 0 ? `You saved ₱${discount.toLocaleString()} from weekly discounts` : '';
  return { isValid: true, totalDays, weeks, basePrice, discount, finalPrice, savingsText: savings, minLeaseDays: effectiveSettings.minLeaseDays };
}

const to24Hour = (time12) => {
  const [time, period] = time12.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (period === 'AM' && hours === 12) hours = 0;
  if (period === 'PM' && hours !== 12) hours += 12;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// ────────────────────────────────────────────────────────────────────────────
// Time-slot generation helpers
// ────────────────────────────────────────────────────────────────────────────

function min2label(totalMin) {
  const h24 = Math.floor(totalMin / 60);
  const m   = totalMin % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12    = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function buildTimeSlots(settings) {
  const openMin  = (settings.startHour  ?? 9)  * 60 + (settings.startMinute  ?? 0);
  const closeMin = (settings.endHour    ?? 17) * 60 + (settings.endMinute    ?? 0);
  const step     = settings.fittingDurationMinutes || 30;
  const slots    = [];
  for (let t = openMin; t + step <= closeMin; t += step) {
    slots.push(min2label(t));
  }
  return slots;
}

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

// ────────────────────────────────────────────────────────────────────────────
// Direct booking date-range overlap helpers
// ────────────────────────────────────────────────────────────────────────────

function datesOverlap(s1, e1, s2, e2) {
  return s1 <= e2 && e1 >= s2;
}

function classifyDateRange(startDate, endDate, occupiedRanges) {
  if (!startDate || !endDate || !occupiedRanges?.length) return 'free';
  let hasPending = false;
  for (const r of occupiedRanges) {
    if (!datesOverlap(startDate, endDate, r.startDate, r.endDate)) continue;
    if (r.status === 'Approved' || r.status === 'Confirmed') return 'blocked';
    if (r.status === 'Pending') hasPending = true;
  }
  return hasPending ? 'pending' : 'free';
}

// ────────────────────────────────────────────────────────────────────────────
// Shared Data
// ────────────────────────────────────────────────────────────────────────────
const ITEM_STATUS_META = {
  'Available':   { color: '#15803d', bg: 'rgba(21,128,61,0.1)',   dot: '#22c55e' },
  'Leased':      { color: '#b45309', bg: 'rgba(180,83,9,0.1)',    dot: '#f59e0b' },
  'Maintenance': { color: '#991b1b', bg: 'rgba(153,27,27,0.1)',   dot: '#ef4444' },
  'Reserved':    { color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)',   dot: '#3b82f6' },
};

const CAT_COLORS = { Gown: '#c4717f', Suit: '#6b2d39', Traditional: '#b45309', Accessories: '#486581' };

const todayStr    = () => new Date().toISOString().split('T')[0];
const fmtDate     = d => d ? new Date(d).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) : '';
const fmtDateTime = (d, t) => d ? `${fmtDate(d)} at ${t}` : '';

// ────────────────────────────────────────────────────────────────────────────
// UI Components (StatusBadge, MediaThumb, MediaGallery, Toast, Skeletons)
// ────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const m = ITEM_STATUS_META[status] || { color:'#888', bg:'rgba(0,0,0,0.06)', dot:'#888' };
  return (
    <span className="inv-badge" style={{ color:m.color, background:m.bg }}>
      <span className="inv-badge-dot" style={{ background:m.dot }} />
      {status}
    </span>
  );
}

function MediaThumb({ item, onClick }) {
  const files = item.mediaFiles?.length ? item.mediaFiles : [];
  const first = files[0] || null;
  if (!first) {
    const bg = CAT_COLORS[item.category] || '#6b2d39';
    return (
      <div className="inv-media-placeholder" style={{ '--cat-color': bg }} onClick={onClick}>
        <ShoppingBag size={28} style={{ color:bg, opacity:0.45 }} />
      </div>
    );
  }
  if (first.type === 'video') {
    return (
      <div className="inv-media-video-thumb" onClick={onClick}>
        <video src={first.url} muted playsInline preload="metadata" />
        <span className="inv-video-badge"><Play size={9} fill="white" /> Video</span>
      </div>
    );
  }
  return <img src={first.url} alt={item.name} className="inv-media-img" onClick={onClick} />;
}

function MediaGallery({ item, startIndex = 0, onClose }) {
  const files = item.mediaFiles?.length ? item.mediaFiles : [];
  const [idx, setIdx] = useState(startIndex);
  const prev = () => setIdx((idx - 1 + files.length) % files.length);
  const next = () => setIdx((idx + 1) % files.length);

  useEffect(() => {
    const h = e => {
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape')     onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx]);

  if (!files.length) return null;
  const current = files[idx];
  return (
    <div className="inv-lightbox" onClick={onClose}>
      <button className="inv-lightbox-close" onClick={onClose}><X size={18} /></button>
      <div className="inv-lightbox-inner" onClick={e => e.stopPropagation()}>
        <div className="inv-lightbox-topbar">
          <span className="inv-lightbox-itemname">{item.name}</span>
          <span className="inv-lightbox-catnote">{item.category}{item.subtype ? ` · ${item.subtype}` : ''}{(Array.isArray(item.sizes) && item.sizes.length ? ` · Size ${item.sizes.join(', ')}` : item.size ? ` · Size ${item.size}` : '')}</span>
        </div>
        <div className="inv-gallery-stage">
          {current.type === 'video'
            ? <video src={current.url} controls autoPlay className="inv-lightbox-media" />
            : <img src={current.url} alt={item.name} className="inv-lightbox-media" />}
          {files.length > 1 && (
            <>
              <button className="inv-gallery-arrow inv-gallery-arrow-prev" onClick={prev}><ChevronLeft size={22} /></button>
              <button className="inv-gallery-arrow inv-gallery-arrow-next" onClick={next}><ChevronRight size={22} /></button>
            </>
          )}
        </div>
        {files.length > 1 && (
          <div className="inv-lightbox-footer">
            <span className="inv-gallery-counter">{idx + 1} / {files.length}</span>
            <div className="inv-gallery-dots">
              {files.map((_, i) => (
                <button key={i} className={`inv-gallery-dot${i === idx ? ' active' : ''}`} onClick={() => setIdx(i)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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

function FastSkeletonCard() {
  return (
    <div className="inv-grid-card skeleton-fast">
      <div className="inv-grid-media skeleton-media-fast" />
      <div className="inv-grid-info">
        <div className="skeleton-text-fast" style={{ width:'70%', height:'16px', marginBottom:'8px' }} />
        <div className="skeleton-text-fast" style={{ width:'85%', height:'12px', marginBottom:'6px' }} />
        <div className="skeleton-text-fast" style={{ width:'40%', height:'14px' }} />
      </div>
      <div className="inv-grid-actions">
        <div className="skeleton-btn-fast" />
        <div className="skeleton-btn-fast" style={{ width:'100px' }} />
      </div>
    </div>
  );
}

function FastSkeletonRow() {
  return (
    <tr className="skeleton-row-fast">
      <td><div className="skeleton-thumb-fast" /></td>
      <td><div className="skeleton-text-fast" style={{ width:'120px', height:'14px' }} /></td>
      <td><div className="skeleton-text-fast" style={{ width:'60px', height:'12px' }} /></td>
      <td><div className="skeleton-text-fast" style={{ width:'80px', height:'12px' }} /></td>
      <td><div className="skeleton-text-fast" style={{ width:'40px', height:'12px' }} /></td>
      <td><div className="skeleton-text-fast" style={{ width:'60px', height:'12px' }} /></td>
      <td><div className="skeleton-badge-fast" /></td>
      <td><div className="skeleton-btn-fast" /><div className="skeleton-btn-fast" /></td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Fitting Date Picker (unchanged)
// ────────────────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function FittingDatePicker({ value, onChange, minDate, bookingSettings, itemId, timeSlots, slotCacheRef, disabled }) {
  const today = minDate || todayStr();

  const [open, setOpen]             = useState(false);
  const wrapRef                     = useRef(null);
  const [view, setView]             = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [localCache, setLocalCache] = useState({});
  const [loadingSet, setLoadingSet] = useState(new Set());

  useEffect(() => {
    if (!open) return;
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setView({ year: d.getFullYear(), month: d.getMonth() });
    }
  }, [value]);

  const { year, month } = view;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = new Date(year, month, 1).getDay();

  useEffect(() => {
    if (!itemId || !timeSlots.length) return;
    const toFetch = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (ds < today) continue;
      if (!isWorkingDay(ds, bookingSettings)) continue;
      const cKey = `${itemId}__${ds}`;
      if (localCache[ds] !== undefined || slotCacheRef?.current?.[cKey] !== undefined) continue;
      toFetch.push(ds);
    }
    if (!toFetch.length) return;

    setLoadingSet(prev => new Set([...prev, ...toFetch]));
    Promise.all(
      toFetch.map(ds =>
        getBookedFittingSlots(itemId, ds)
          .then(slots => ({ ds, slots }))
          .catch(()    => ({ ds, slots: [] }))
      )
    ).then(results => {
      const patch = {};
      results.forEach(({ ds, slots }) => {
        patch[ds] = slots;
        if (slotCacheRef) slotCacheRef.current[`${itemId}__${ds}`] = slots;
      });
      setLocalCache(prev => ({ ...prev, ...patch }));
      setLoadingSet(prev => {
        const next = new Set(prev);
        results.forEach(({ ds }) => next.delete(ds));
        return next;
      });
    });
  }, [year, month, itemId, timeSlots.length]);

  const getSlots = ds => {
    if (localCache[ds] !== undefined) return localCache[ds];
    return slotCacheRef?.current?.[`${itemId}__${ds}`];
  };

  const prevMonth = () => setView(v => { const d = new Date(v.year, v.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const nextMonth = () => setView(v => { const d = new Date(v.year, v.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const canPrev = new Date(year, month, 0).toISOString().split('T')[0] >= today;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const handleSelect = ds => { onChange(ds); setOpen(false); };

  return (
    <div className="fitting-cal-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`fitting-cal-trigger${!value ? ' fct-empty' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
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
              const ds         = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isPast     = ds < today || (ds === todayStr() && isWorkdayOver(bookingSettings));
              const isNonWork  = !isWorkingDay(ds, bookingSettings);
              const slots      = getSlots(ds);
              const isChecking = loadingSet.has(ds);
              const isFullBook = !isPast && !isNonWork && timeSlots.length > 0 && slots !== undefined && timeSlots.every(t => slots.includes(to24Hour(t)));
              const isSelected = ds === value;
              const isToday    = ds === today;
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
                  onClick={() => clickable && handleSelect(ds)}
                  disabled={!clickable}
                  title={isPast ? 'Past date' : isNonWork ? 'Closed day' : isFullBook ? 'Fully booked' : undefined}
                >
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

// ────────────────────────────────────────────────────────────────────────────
// Direct Date Picker (unchanged)
// ────────────────────────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setView({ year: d.getFullYear(), month: d.getMonth() });
    }
  }, [value]);

  const { year, month } = view;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const prevMonth = () => setView(v => { const d = new Date(v.year, v.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const nextMonth = () => setView(v => { const d = new Date(v.year, v.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const canPrev = new Date(year, month, 0).toISOString().split('T')[0] >= today;

  const isDateBlocked = (dateStr) => {
    if (!occupiedRanges || !occupiedRanges.length) return false;
    return occupiedRanges.some(range => dateStr >= range.startDate && dateStr <= range.endDate);
  };

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const handleSelect = ds => { onChange(ds); setOpen(false); };

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
              const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isPast = ds < today || (ds === todayStr() && isWorkdayOver(bookingSettings));
              const isNonWork = !isWorkingDay(ds, bookingSettings);
              const isBlocked = isDateBlocked(ds);
              const isSelected = ds === value;
              const isToday = ds === todayStr();
              const clickable = !isPast && !isNonWork && !isBlocked;

              let cls = 'fitting-cal-day';
              if (isPast) cls += ' fcd-past';
              else if (isNonWork) cls += ' fcd-closed';
              else if (isBlocked) cls += ' fcd-full';
              else cls += ' fcd-avail';
              if (isSelected) cls += ' fcd-selected';
              if (isToday && !isSelected) cls += ' fcd-today';

              return (
                <button
                  key={ds}
                  type="button"
                  className={cls}
                  onClick={() => clickable && handleSelect(ds)}
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

// ────────────────────────────────────────────────────────────────────────────
// Direct Booking Modal (receives inventorySettings as a prop)
// ────────────────────────────────────────────────────────────────────────────
function DirectBookingModal({ item, onClose, onSuccess, showToast, isLoggedIn, currentUser, bookingSettings, userProfile, inventorySettings }) {
  const [form, setForm] = useState({
    startDate: '', endDate: '', notes: '',
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: '',
    preferredSize: '',
  });

  useEffect(() => {
    if (!userProfile) return;
    const fullName = [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ');
    setForm(p => ({
      ...p,
      ...(fullName ? { name: fullName } : {}),
      email: userProfile.email || p.email,
      ...(userProfile.phone ? { phone: userProfile.phone } : {}),
    }));
  }, [userProfile]);
  const [submitting, setSubmitting]       = useState(false);
  const [availability, setAvailability]   = useState(null);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [occupiedRanges, setOccupiedRanges]   = useState([]);
  const [loadingOccupied, setLoadingOccupied] = useState(true);
  const [overlapStatus, setOverlapStatus] = useState(null);
  const [pendingAcknowledged, setPendingAcknowledged] = useState(false);

  const debounceRef = useRef(null);

  const pricing = useMemo(
    () => calculateLeasePricing(item.price, form.startDate, form.endDate, inventorySettings),
    [item.price, form.startDate, form.endDate, inventorySettings]
  );

  useEffect(() => {
    setLoadingOccupied(true);
    getOccupiedDirectDates(item.id)
      .then(ranges => setOccupiedRanges(ranges))
      .catch(() => setOccupiedRanges([]))
      .finally(() => setLoadingOccupied(false));
  }, [item.id]);

  useEffect(() => {
    if (!form.startDate || !form.endDate || !pricing?.isValid) {
      setOverlapStatus(null);
      setPendingAcknowledged(false);
      return;
    }
    const status = classifyDateRange(form.startDate, form.endDate, occupiedRanges);
    setOverlapStatus(status);
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
        const avail = await checkDirectBookingAvailability(item.id, form.startDate, form.endDate);
        setAvailability(avail);
      } catch {
        setAvailability(null);
      } finally {
        setCheckingAvail(false);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [form.startDate, form.endDate, pricing?.isValid, overlapStatus, item.id]);

  const handleSubmit = async () => {
    if (!isLoggedIn) { showToast('error', 'Please login first to make a booking.'); return; }
    if (!pricing?.isValid) return;
    if (overlapStatus === 'blocked') { showToast('error', 'Selected dates are not available — another booking is confirmed for those dates.'); return; }
    if (availability === false) { showToast('error', 'Selected dates are no longer available. Please choose different dates.'); return; }
    if (!form.name || !form.email || !form.phone) { showToast('error', 'Please fill in your contact information.'); return; }
    if (!validatePhilippinePhone(form.phone)) { showToast('error', 'Invalid Philippine mobile number. Use +63 followed by 10 digits.'); return; }

    setSubmitting(true);
    try {
      const result = await createDirectBooking({
        itemId:         item.id,
        itemName:       item.name,
        startDate:      form.startDate,
        endDate:        form.endDate,
        totalDays:      pricing.totalDays,
        basePrice:      pricing.basePrice,
        discountAmount: pricing.discount,
        finalPrice:     pricing.finalPrice,
        notes:          form.notes,
        customerName:   form.name,
        customerEmail:  form.email,
        customerPhone:  form.phone,
        preferredSize:  form.preferredSize || (Array.isArray(item.sizes) ? item.sizes[0] : item.size) || '',
      });
      onSuccess({
        id:            result.id,
        itemName:      item.name,
        startDate:     form.startDate,
        endDate:       form.endDate,
        totalDays:     pricing.totalDays,
        finalPrice:    pricing.finalPrice,
        customerName:  form.name,
        customerEmail: form.email,
        customerPhone: form.phone,
      });
    } catch (err) {
      showToast('error', err.message || 'Failed to submit direct booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingBlocking = overlapStatus === 'pending' && !pendingAcknowledged;
  const canSubmit = (
    pricing?.isValid &&
    overlapStatus !== 'blocked' &&
    availability !== false &&
    !submitting &&
    !checkingAvail &&
    !pendingBlocking &&
    form.name && form.email && form.phone
  );

  const handleStartChange = (newStart) => {
    setForm(p => ({
      ...p,
      startDate: newStart,
      endDate: p.endDate && p.endDate < newStart ? '' : p.endDate
    }));
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3><ShoppingBag size={16} style={{ marginRight: '8px' }} />Direct Booking — {item.name}</h3>
          <button className="inv-modal-close" onClick={onClose} disabled={submitting}><X size={16} /></button>
        </div>

        <div className="inv-modal-body">
          <div className="inv-lease-item-preview">
            <div className="inv-lease-preview-thumb"><MediaThumb item={item} /></div>
            <div>
              <div className="inv-lease-preview-name">{item.name}</div>
              <div className="inv-lease-preview-price">₱{item.price.toLocaleString()}/day</div>
            </div>
          </div>

          <div className="inv-warning-box">
            <AlertTriangle size={16} />
            <div><strong>Note:</strong> Direct booking requires full payment upon confirmation. You will be contacted for payment and pickup arrangements.</div>
          </div>

          <div className="inv-modal-grid">
            <div className="inv-field">
              <label className="inv-field-label">Rental Start Date <span className="inv-required">*</span></label>
              <DirectDatePicker
                value={form.startDate}
                onChange={handleStartChange}
                minDate={todayStr()}
                bookingSettings={bookingSettings}
                occupiedRanges={occupiedRanges}
                disabled={submitting}
                label="start date"
              />
              {form.startDate && !isWorkingDay(form.startDate, bookingSettings) && (
                <span className="inv-field-hint inv-field-hint-warn">
                  <AlertTriangle size={11} /> Not a working day
                </span>
              )}
            </div>
            <div className="inv-field">
              <label className="inv-field-label">Rental End Date <span className="inv-required">*</span></label>
              <DirectDatePicker
                value={form.endDate}
                onChange={(newEnd) => setForm(p => ({ ...p, endDate: newEnd }))}
                minDate={form.startDate || todayStr()}
                bookingSettings={bookingSettings}
                occupiedRanges={occupiedRanges}
                disabled={submitting || !form.startDate}
                label="end date"
              />
              {form.endDate && !isWorkingDay(form.endDate, bookingSettings) && (
                <span className="inv-field-hint inv-field-hint-warn">
                  <AlertTriangle size={11} /> Not a working day
                </span>
              )}
            </div>
          </div>

          {pricing && !pricing.isValid && (
            <div className="inv-warning-box">
              <AlertTriangle size={16} />
              <div>Minimum lease duration is <strong>{pricing.minLeaseDays} days</strong>. Please extend your rental period.</div>
            </div>
          )}

          {pricing?.isValid && (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {overlapStatus === 'blocked' && (
                <div className="inv-warning-box inv-warning-box-blocked">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Dates not available.</strong> Another booking has already been confirmed
                    for this item during your selected period. Please choose different dates.
                  </div>
                </div>
              )}
              {overlapStatus === 'pending' && !pendingAcknowledged && (
                <div className="inv-warning-box inv-warning-box-pending">
                  <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <strong>Heads up:</strong> Another customer has a <em>pending</em> booking for
                    this item during your selected dates. Their booking is not yet confirmed.
                    <br />
                    Do you still want to continue with these dates?
                    <div className="inv-overlap-actions">
                      <button
                        className="inv-btn-overlap-yes"
                        onClick={() => setPendingAcknowledged(true)}
                        disabled={submitting}
                      >
                        Yes, continue
                      </button>
                      <button
                        className="inv-btn-overlap-no"
                        onClick={() => setForm(p => ({ ...p, startDate: '', endDate: '' }))}
                        disabled={submitting}
                      >
                        No, pick different dates
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {overlapStatus === 'pending' && pendingAcknowledged && (
                <div className="inv-warning-box" style={{ background:'rgba(245,158,11,0.07)', borderColor:'#f59e0b', color:'#b45309' }}>
                  <Info size={14} />
                  <span>Proceeding with dates that have a pending booking. If the other booking is approved first, yours may not be confirmed.</span>
                </div>
              )}
              {overlapStatus !== 'blocked' && checkingAvail && (
                <div className="inv-warning-box" style={{ borderColor:'#6b2d39' }}>
                  <Loader2 size={14} className="inv-spinner-inline" />
                  <span>Checking availability…</span>
                </div>
              )}
              {overlapStatus !== 'blocked' && !checkingAvail && availability === false && (
                <div className="inv-warning-box">
                  <AlertTriangle size={16} />
                  <div>These dates are <strong>not available</strong>. Please choose different dates.</div>
                </div>
              )}
              {overlapStatus !== 'blocked' && !checkingAvail && availability === true && overlapStatus !== 'pending' && (
                <div className="inv-warning-box" style={{ background:'rgba(21,128,61,0.07)', borderColor:'#15803d', color:'#15803d' }}>
                  <CheckCircle size={14} />
                  <span>Dates are available!</span>
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
                <span className="label">Base Price (₱{item.price.toLocaleString()} × {pricing.totalDays} days):</span>
                <span className="value">₱{pricing.basePrice.toLocaleString()}</span>
              </div>
              {pricing.discount > 0 && (
                <div className="inv-pricing-row inv-discount-row">
                  <span className="label">🎉 Weekly Discount ({pricing.weeks} week{pricing.weeks !== 1 ? 's' : ''}):</span>
                  <span className="value">−₱{pricing.discount.toLocaleString()}</span>
                </div>
              )}
              <hr />
              <div className="inv-pricing-row inv-total-row">
                <span className="label"><strong>Total Amount:</strong></span>
                <span className="value"><strong>₱{pricing.finalPrice.toLocaleString()}</strong></span>
              </div>
              {pricing.savingsText && <div className="inv-savings-text">{pricing.savingsText}</div>}
            </div>
          )}

          <div style={{ borderTop:'1px solid #eeecea', marginTop:'0.5rem', paddingTop:'1rem' }}>
            <label style={{ fontSize:'0.75rem', fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'1rem', display:'block' }}>
              Customer Information
            </label>
            <div className="inv-field">
              <label className="inv-field-label">Full Name <span className="inv-required">*</span></label>
              <input className="inv-input" type="text" placeholder="Enter your full name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} disabled={submitting} />
            </div>
            <div className="inv-modal-grid">
              <div className="inv-field">
                <label className="inv-field-label">Email <span className="inv-required">*</span></label>
                <input className="inv-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} disabled={submitting} />
              </div>
              <div className="inv-field">
                <label className="inv-field-label">Phone <span className="inv-required">*</span></label>
                <PhilippinePhoneInput
                  value={form.phone}
                  onChange={(val) => setForm(p => ({ ...p, phone: val }))}
                  disabled={submitting}
                  placeholder="9XX XXX XXXX"
                />
              </div>
            </div>
            <div className="inv-field">
              <label className="inv-field-label">Preferred Size</label>
              <select className="inv-select" value={form.preferredSize} onChange={e => setForm(p => ({ ...p, preferredSize: e.target.value }))} disabled={submitting} style={{ width:'100%' }}>
                <option value="">Select size (optional)</option>
                {(Array.isArray(item.sizes) && item.sizes.length ? item.sizes : item.size ? [item.size] : ['XS','S','M','L','XL','XXL','3XL']).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="inv-field">
            <label className="inv-field-label">Special Instructions</label>
            <textarea className="inv-textarea" rows={3} placeholder="Any specific notes or requirements…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} disabled={submitting} />
          </div>

          <div className="bk-payment-summary">
            <div className="bk-ps-row total" style={{ borderBottom:'none', marginBottom:0, paddingBottom:0 }}>
              <span><strong>Booking Summary</strong></span>
            </div>
            <div className="bk-ps-row"><span>Item</span><span>{item.name}</span></div>
            {form.startDate && <div className="bk-ps-row"><span>Rental Period</span><span>{fmtDate(form.startDate)} – {fmtDate(form.endDate) || '—'}</span></div>}
            {pricing?.isValid && <div className="bk-ps-row"><span>Total Amount</span><span>₱{pricing.finalPrice.toLocaleString()}</span></div>}
          </div>
        </div>

        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="inv-btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting
              ? <><Loader2 size={14} className="inv-spinner-inline" /> Submitting…</>
              : <><ShoppingBag size={13} /> Confirm Booking</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function DirectBookingConfirmModal({ booking, onClose }) {
  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" style={{ maxWidth:'500px' }} onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header" style={{ background:'#15803d08', borderBottomColor:'#15803d20' }}>
          <h3 style={{ color:'#15803d', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <CheckCircle size={20} /> Direct Booking Submitted!
          </h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="inv-modal-body">
          <div className="inv-confirmation-summary">
            <p className="inv-confirmation-message">
              Your direct booking has been submitted and is <strong>pending approval</strong> by our team. We'll notify you once it's confirmed.
            </p>
            <div className="inv-booking-details">
              {booking.id && (
                <div className="inv-booking-detail-row">
                  <span className="inv-booking-label">Booking ID:</span>
                  <span className="inv-booking-value">#DB-{booking.id.slice(-8).toUpperCase()}</span>
                </div>
              )}
              <div className="inv-booking-detail-row"><span className="inv-booking-label">Item:</span><span className="inv-booking-value">{booking.itemName}</span></div>
              <div className="inv-booking-detail-row"><span className="inv-booking-label">Rental Period:</span><span className="inv-booking-value">{fmtDate(booking.startDate)} – {fmtDate(booking.endDate)}</span></div>
              <div className="inv-booking-detail-row"><span className="inv-booking-label">Duration:</span><span className="inv-booking-value">{booking.totalDays} day{booking.totalDays !== 1 ? 's' : ''}</span></div>
              <div className="inv-booking-detail-row"><span className="inv-booking-label">Total Amount:</span><span className="inv-booking-value">₱{booking.finalPrice.toLocaleString()}</span></div>
              <div className="inv-booking-detail-row"><span className="inv-booking-label">Customer:</span><span className="inv-booking-value">{booking.customerName}</span></div>
              <div className="inv-booking-detail-row"><span className="inv-booking-label">Status:</span><span className="inv-booking-value" style={{ color:'#f59e0b', fontWeight:600 }}>Pending Approval</span></div>
            </div>
            <div className="inv-reminder-box">
              <Clock size={14} />
              <div>Our team will review your booking and reach out to confirm payment and pickup arrangements.</div>
            </div>
          </div>
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component 
// ────────────────────────────────────────────────────────────────────────────
export default function BrowseOutfitsFragment() {
  const [items, setItems]             = useState([]);
  const [promos, setPromos]           = useState([]);
  const [userBookings, setUserBookings]     = useState([]);
  const [directBookings, setDirectBookings] = useState([]);
  const [isItemsLoaded, setIsItemsLoaded]   = useState(false);
  const [isPromosLoaded, setIsPromosLoaded] = useState(false);
  const [loadError, setLoadError]     = useState('');

  const [inventorySettings, setInventorySettings] = useState(null); // new state

  const { settings: bookingSettings } = useBookingSettings();

  const [viewMode, setViewMode]       = useState('grid');
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState('All');
  const [filterSubcat, setFilterSubcat] = useState('All');
  const [filterSize, setFilterSize]   = useState('All');

  const [selectedItem, setSelectedItem]         = useState(null);
  const [modal, setModal]                       = useState(null);
  const [gallery, setGallery]                   = useState(null);
  const [toast, setToast]                       = useState({ show: false, type: 'success', message: '' });

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const authToken   = useMemo(() => localStorage.getItem('accessToken') || localStorage.getItem('token'), []);
  const isLoggedIn  = !!authToken;
  const [userProfile, setUserProfile] = useState(null);

  const timeSlots = useMemo(() => buildTimeSlots(bookingSettings), [bookingSettings]);

  const [booking, setBooking] = useState({
    fittingDate: '', fittingTime: '',
    name: currentUser.name || '', email: currentUser.email || '',
    phone: '', preferredSize: '', notes: '',
  });
  const [bookingConfirmed, setBookingConfirmed]           = useState(null);
  const [submitting, setSubmitting]                       = useState(false);
  const [directBookingConfirmed, setDirectBookingConfirmed] = useState(null);

  const [bookedFittingSlots, setBookedFittingSlots]       = useState([]);
  const [loadingFittingSlots, setLoadingFittingSlots]     = useState(false);
  const slotCacheRef = useRef({});

  const [cancelling, setCancelling] = useState(null); // { type: 'fitting'|'direct', id }

  // Fetch inventory settings from backend
  useEffect(() => {
    fetchInventorySettings()
      .then(settings => setInventorySettings(settings))
      .catch(err => console.error('Failed to load inventory settings:', err));
  }, []);

  useEffect(() => {
    fetchItems()
      .then(data => { setItems(data); setIsItemsLoaded(true); })
      .catch(err  => { setLoadError(err.message || 'Failed to load items.'); setIsItemsLoaded(true); });

    fetchPromotions()
      .then(data => { setPromos(data); setIsPromosLoaded(true); })
      .catch(()  => setIsPromosLoaded(true));

    if (isLoggedIn) {
      getProfile()
        .then(data => setUserProfile(data))
        .catch(() => {});

      getUserBookings()
        .then(data => setUserBookings(data))
        .catch(err  => console.error('Error loading user bookings:', err));

      getUserDirectBookings()
        .then(data => {
          const bookings = Array.isArray(data) ? data : [];
          setDirectBookings(bookings);
          localStorage.setItem('userDirectBookings', JSON.stringify(bookings));
        })
        .catch(err => console.error('Error loading direct bookings:', err));
    }
  }, [isLoggedIn]);

  // --------------------------------------------------------------------------
  // Build set of item IDs that the user has already booked (active bookings only)
  // --------------------------------------------------------------------------
  const bookedItemIds = useMemo(() => {
    if (!isLoggedIn) return new Set();
    const fittingIds = userBookings
      .filter(b => b.status !== 'CANCELLED')
      .map(b => String(b.itemId));
    const directIds = directBookings
      .filter(b => b.bookingStatus !== 'Cancelled')
      .map(b => String(b.inventoryItemId));
    return new Set([...fittingIds, ...directIds]);
  }, [userBookings, directBookings, isLoggedIn]);

  useEffect(() => {
    if (modal !== 'booking' || !selectedItem || !booking.fittingDate) {
      setBookedFittingSlots([]);
      return;
    }
    const key = `${selectedItem.id}__${booking.fittingDate}`;
    if (slotCacheRef.current[key] !== undefined) {
      setBookedFittingSlots(slotCacheRef.current[key]);
      return;
    }
    setLoadingFittingSlots(true);
    getBookedFittingSlots(selectedItem.id, booking.fittingDate)
      .then(slots => {
        slotCacheRef.current[key] = slots;
        setBookedFittingSlots(slots);
      })
      .catch(()   => setBookedFittingSlots([]))
      .finally(()  => setLoadingFittingSlots(false));
  }, [modal, selectedItem?.id, booking.fittingDate]);

  // Auto-select first available time slot when booked slots change
  useEffect(() => {
    if (!timeSlots.length) return;
    const firstAvail = timeSlots.find(t => !bookedFittingSlots.includes(to24Hour(t)));
    setBooking(p => ({
      ...p,
      fittingTime: bookedFittingSlots.includes(to24Hour(p.fittingTime))
        ? (firstAvail || '')
        : (p.fittingTime || firstAvail || ''),
    }));
  }, [bookedFittingSlots, timeSlots]);

  useEffect(() => {
    if (modal !== 'booking' || !userProfile) return;
    const fullName = [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ');
    setBooking(p => ({
      ...p,
      ...(fullName ? { name: fullName } : {}),
      email: userProfile.email || p.email,
      ...(userProfile.phone ? { phone: userProfile.phone } : {}),
    }));
  }, [modal, userProfile]);

  const showToast  = (type, message) => setToast({ show: true, type, message });
  const closeToast = () => setToast({ show: false, type: 'success', message: '' });

  const closeModal = () => {
    setModal(null);
    setSelectedItem(null);
    setBookingConfirmed(null);
    setDirectBookingConfirmed(null);
    setBookedFittingSlots([]);
    setBooking({
      fittingDate: '', fittingTime: '',
      name: currentUser.name || '', email: currentUser.email || '',
      phone: '', preferredSize: '', notes: '',
    });
  };

  const handleCancelFitting = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this fitting booking? This action cannot be undone.')) return;
    setCancelling({ type: 'fitting', id: bookingId });
    try {
      await cancelFittingBooking(bookingId);
      const updated = await getUserBookings();
      setUserBookings(updated);
      showToast('success', 'Fitting booking cancelled successfully.');
    } catch (err) {
      showToast('error', err.message || 'Failed to cancel booking.');
    } finally {
      setCancelling(null);
    }
  };

  const handleCancelDirect = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this direct booking? This action cannot be undone.')) return;
    setCancelling({ type: 'direct', id: bookingId });
    try {
      await cancelDirectBooking(bookingId);
      const updated = await getUserDirectBookings();
      setDirectBookings(updated);
      localStorage.setItem('userDirectBookings', JSON.stringify(updated));
      showToast('success', 'Direct booking cancelled successfully.');
    } catch (err) {
      showToast('error', err.message || 'Failed to cancel booking.');
    } finally {
      setCancelling(null);
    }
  };

  const hasUserDirectBookedItem = useCallback(itemId => {
    if (!directBookings.length) return false;
    return directBookings.some(b =>
      String(b.inventoryItemId) === String(itemId) &&
      (b.bookingStatus === 'Pending' || b.bookingStatus === 'Approved' || b.bookingStatus === 'Confirmed') &&
      b.bookingStatus !== 'Cancelled'
    );
  }, [directBookings]);

  const getUserDirectBookingForItem = useCallback(itemId => {
    if (!directBookings.length) return null;
    return directBookings.find(b =>
      String(b.inventoryItemId) === String(itemId) &&
      (b.bookingStatus === 'Pending' || b.bookingStatus === 'Approved' || b.bookingStatus === 'Confirmed') &&
      b.bookingStatus !== 'Cancelled'
    );
  }, [directBookings]);

  const hasUserBookedItem = useCallback(itemId => {
    if (!userBookings.length) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return userBookings.some(b =>
      String(b.itemId) === String(itemId) &&
      b.status === 'CONFIRMED' &&
      new Date(b.fittingDate) >= today &&
      b.status !== 'CANCELLED'
    );
  }, [userBookings]);

  const getUserBookingForItem = useCallback(itemId => {
    if (!userBookings.length) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    return userBookings.find(b =>
      String(b.itemId) === String(itemId) &&
      b.status === 'CONFIRMED' &&
      new Date(b.fittingDate) >= today &&
      b.status !== 'CANCELLED'
    );
  }, [userBookings]);

  const activePromo = useCallback(item => {
    if (!isPromosLoaded || !promos.length) return null;
    const now    = todayStr();
    const itemId = typeof item.id === 'string' ? parseInt(item.id) : item.id;
    return promos.find(p => {
      if (!p.active || !p.items?.length) return false;
      const ids = p.items.map(id => typeof id === 'string' ? parseInt(id) : id);
      return ids.includes(itemId) && p.start <= now && p.end >= now;
    }) || null;
  }, [promos, isPromosLoaded]);

  const discPrice = useCallback(item => {
    const p = activePromo(item);
    if (!p) return item.price;
    const d = p.type === 'percentage' ? item.price * (1 - p.value / 100) : item.price - p.value;
    return Math.max(0, d);
  }, [activePromo]);

  const availableItems = useMemo(() => items.filter(i => i.status === 'Available' || i.status === 'Reserved'), [items]);
  
  const categories     = useMemo(() => [...new Set(availableItems.map(i => i.category))], [availableItems]);
  const subcategories  = useMemo(() => {
    if (filterCat === 'All') return [];
    return [...new Set(availableItems.filter(i => i.category === filterCat).map(i => i.subtype).filter(Boolean))].sort();
  }, [availableItems, filterCat]);
  useEffect(() => { setFilterSubcat('All'); }, [filterCat]);
  const sizes = useMemo(() => {
    const all = new Set();
    availableItems.forEach(i => {
      if (Array.isArray(i.sizes)) i.sizes.forEach(s => all.add(s));
      else if (i.size) all.add(i.size);
    });
    return [...all].sort();
  }, [availableItems]);

  // Filter out items that the user has already booked
  const visibleItems = useMemo(() => availableItems.filter(i => {
    if (bookedItemIds.has(String(i.id))) return false;

    const q = search.toLowerCase();
    return (!q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || (i.subtype||'').toLowerCase().includes(q))
      && (filterCat === 'All'    || i.category === filterCat)
      && (filterSubcat === 'All' || i.subtype  === filterSubcat)
      && (filterSize === 'All'   || (Array.isArray(i.sizes) ? i.sizes.includes(filterSize) : i.size === filterSize));
  }), [availableItems, search, filterCat, filterSubcat, filterSize, bookedItemIds]);

  const handleBookingSubmit = async () => {
    if (!isLoggedIn) { showToast('error', 'Please login first to book a fitting.'); return; }
    if (!booking.fittingDate || !booking.fittingTime) { showToast('error', 'Please select a fitting date and time.'); return; }
    if (!booking.name || !booking.email || !booking.phone) { showToast('error', 'Please fill in your contact information.'); return; }
    if (!validatePhilippinePhone(booking.phone)) { showToast('error', 'Invalid Philippine mobile number. Use +63 followed by 10 digits.'); return; }

    if (bookingSettings.enableTimeRestrictions && !isWorkingDay(booking.fittingDate, bookingSettings)) {
      showToast('error', 'The selected date is not a working day. Please choose a different date.'); return;
    }

    const selDate = new Date(booking.fittingDate);
    const today   = new Date(); today.setHours(0,0,0,0);
    if (selDate < today) { showToast('error', 'Fitting date cannot be in the past.'); return; }

    if (hasUserBookedItem(selectedItem.id) || hasUserDirectBookedItem(selectedItem.id)) {
      showToast('error', `You already have a booking for ${selectedItem.name}. You cannot book another.`); return;
    }

    if (bookedFittingSlots.includes(to24Hour(booking.fittingTime))) {
      showToast('error', `The time slot ${booking.fittingTime} is already booked. Please select another time.`); return;
    }

    setSubmitting(true);
    try {
      const response = await bookFitting({
        itemId: selectedItem.id, itemName: selectedItem.name,
        fittingDate: booking.fittingDate,
        fittingTime: to24Hour(booking.fittingTime),  
        customerName: booking.name, customerEmail: booking.email, customerPhone: booking.phone,
        preferredSize: booking.preferredSize || (Array.isArray(selectedItem.sizes) ? selectedItem.sizes[0] : selectedItem.size) || '',
        notes: booking.notes, userId: currentUser.id || null,
      });
      const confirmation = {
        id: response.bookingId || Math.floor(Math.random() * 10000),
        item: selectedItem,
        date: booking.fittingDate, time: booking.fittingTime,
        customerName: booking.name, customerEmail: booking.email, customerPhone: booking.phone,
        preferredSize: booking.preferredSize || (Array.isArray(selectedItem.sizes) ? selectedItem.sizes[0] : selectedItem.size) || '',
        notes: booking.notes, status: 'confirmed', createdAt: new Date().toISOString(),
      };
      setBookingConfirmed(confirmation);
      setUserBookings(prev => [{
        id: confirmation.id, itemId: selectedItem.id, itemName: selectedItem.name,
        fittingDate: booking.fittingDate, fittingTime: booking.fittingTime, status: 'CONFIRMED',
      }, ...prev]);
      showToast('success', 'Fitting booked successfully! Check your email for confirmation.');
    } catch (error) {
      showToast('error', error.message || 'Failed to book fitting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getItemButtonState = (item) => {
    const fittingBooking = getUserBookingForItem(item.id);
    const directBooking = getUserDirectBookingForItem(item.id);
    const hasFittingBooking = !!fittingBooking;
    const hasDirectBooking = !!directBooking;
    const hasAnyBooking = hasFittingBooking || hasDirectBooking;

    let fittingLabel = 'Book Fitting';
    let directLabel = 'Book Direct';
    if (hasFittingBooking) {
      fittingLabel = 'Fitting Booked';
      directLabel = 'Unavailable';
    } else if (hasDirectBooking) {
      fittingLabel = 'Unavailable';
      directLabel = directBooking.bookingStatus === 'Approved' ? 'Booking Approved' : 'Booking Pending';
    }

    return {
      fittingBookingId: fittingBooking?.id,
      directBookingId: directBooking?.id,
      hasFittingBooking,
      hasDirectBooking,
      hasAnyBooking,
      userFittingBooking: fittingBooking,
      userDirectBooking: directBooking,
      isFittingDisabled: item.status !== 'Available' || !isLoggedIn || hasAnyBooking,
      isDirectDisabled: item.status !== 'Available' || !isLoggedIn || hasAnyBooking,
      fittingLabel,
      directLabel,
    };
  };

  if (loadError && isItemsLoaded) {
    return (
      <div className="inv-root">
        <div className="inv-error-state">
          <AlertCircle size={32} color="#dc2626" />
          <p>{loadError}</p>
          <button className="inv-btn-primary" onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  const showSkeletons = !isItemsLoaded;

  return (
    <div className="inv-root">
      <div className="inv-top">
        <div>
          <h2 className="inv-title">Browse Our Collection</h2>
          <p className="inv-subtitle">Find the perfect attire for your upcoming events</p>
        </div>
        {!isLoggedIn && (
          <div className="inv-login-warning">
            <AlertCircle size={14} />
            <span>Please login to book a fitting or make a direct booking</span>
          </div>
        )}
      </div>

      <div className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-search-wrap">
            <Search size={13} className="inv-search-icon" />
            <input className="inv-search" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="inv-filters">
            <select className="inv-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            {filterCat !== 'All' && subcategories.length > 0 && (
              <select className="inv-select" value={filterSubcat} onChange={e => setFilterSubcat(e.target.value)}>
                <option value="All">All {filterCat}</option>
                {subcategories.map(s => <option key={s}>{s}</option>)}
              </select>
            )}
            <select className="inv-select" value={filterSize} onChange={e => setFilterSize(e.target.value)}>
              <option value="All">All Sizes</option>
              {sizes.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="inv-view-toggle">
            <button className={`inv-view-btn${viewMode==='grid'?' active':''}`} onClick={() => setViewMode('grid')}><LayoutGrid size={15} /></button>
            <button className={`inv-view-btn${viewMode==='list'?' active':''}`} onClick={() => setViewMode('list')}><List size={15} /></button>
          </div>
        </div>

        {/* GRID VIEW */}
        {viewMode === 'grid' && (
          <div className="inv-grid">
            {showSkeletons && [...Array(12)].map((_, i) => <FastSkeletonCard key={i} />)}
            {!showSkeletons && visibleItems.length === 0 && (
              <div className="inv-empty-grid">
                {bookedItemIds.size > 0 
                  ? "You've already booked all available items. Check back later for new arrivals!"
                  : "No items found."}
              </div>
            )}
            {!showSkeletons && visibleItems.map(item => {
              const promo = activePromo(item);
              const price = discPrice(item);
              const files = item.mediaFiles?.length || 0;
              const { hasFittingBooking, hasDirectBooking, hasAnyBooking, userFittingBooking, userDirectBooking, isFittingDisabled, isDirectDisabled, fittingLabel, directLabel, fittingBookingId, directBookingId } = getItemButtonState(item);

              return (
                <div key={item.id} className="inv-grid-card">
                  <div className="inv-grid-media" onClick={() => files && setGallery({ item, startIndex: 0 })}>
                    <MediaThumb item={item} />
                    <div className="inv-grid-media-overlay"><Eye size={16} /> View</div>
                    <div className="inv-grid-status-pin"><StatusBadge status={item.status} /></div>
                    {promo && (
                      <div className="inv-grid-promo-ribbon">
                        <Sparkles size={9} />
                        {promo.type === 'percentage' ? `${promo.value}% OFF` : `₱${promo.value} OFF`}
                      </div>
                    )}
                    {hasAnyBooking && (
                      <div className="inv-grid-booked-badge" style={{ background: hasFittingBooking ? '#6b2d39' : '#c4717f', color:'#fff' }}>
                        {hasFittingBooking
                          ? <><Calendar size={10} /> Fitting: {fmtDate(userFittingBooking.fittingDate)}</>
                          : <><ShoppingBag size={10} /> {userDirectBooking?.bookingStatus === 'Approved' ? 'Approved' : 'Pending'}</>}
                      </div>
                    )}
                  </div>
                  <div className="inv-grid-info">
                    <div className="inv-grid-name">{item.name}</div>
                    <div className="inv-grid-meta">
                      <span className="inv-cat-tag">{item.category}</span>
                      {item.subtype && <span className="inv-subtype-tag">{item.subtype}</span>}
                      {(Array.isArray(item.sizes) ? item.sizes : item.size ? [item.size] : []).length > 0 && (
                        <span className="inv-grid-size">{(Array.isArray(item.sizes) ? item.sizes : [item.size]).join(', ')}</span>
                      )}
                    </div>
                    <div className="inv-grid-price-row">
                      {promo
                        ? <><span className="inv-price-old">₱{item.price.toLocaleString()}</span><span className="inv-price-new">₱{Math.round(price).toLocaleString()}</span></>
                        : <span className="inv-price">₱{item.price.toLocaleString()}</span>}
                    </div>
                    {promo && <div className="inv-promo-code-pill"><Sparkles size={9} /><span>{promo.code}</span></div>}
                  </div>
                  <div className="inv-grid-actions">
                    <button className="inv-icon-btn" onClick={() => { setSelectedItem(item); setModal('view'); }}><Eye size={13} /></button>
                    {hasFittingBooking ? (
                      <button
                        className="inv-btn-cancel"
                        onClick={() => handleCancelFitting(fittingBookingId)}
                        disabled={cancelling?.type === 'fitting' && cancelling?.id === fittingBookingId}
                      >
                        {cancelling?.type === 'fitting' && cancelling?.id === fittingBookingId ? (
                          <Loader2 size={12} className="inv-spinner-inline" />
                        ) : (
                          'Cancel Fitting'
                        )}
                      </button>
                    ) : (
                      <button
                        className={`inv-btn-book${hasFittingBooking ? ' inv-btn-booked' : ''}`}
                        onClick={() => {
                          if (hasAnyBooking) {
                            showToast('error', hasFittingBooking
                              ? `You already have a fitting booked for this item on ${fmtDate(userFittingBooking.fittingDate)}.`
                              : `You already have a direct booking for this item.`);
                          } else {
                            setSelectedItem(item); setModal('booking');
                          }
                        }}
                        disabled={isFittingDisabled}
                      >
                        <Calendar size={13} /> {fittingLabel}
                      </button>
                    )}
                    {hasDirectBooking ? (
                      <button
                        className="inv-btn-cancel-direct"
                        onClick={() => handleCancelDirect(directBookingId)}
                        disabled={cancelling?.type === 'direct' && cancelling?.id === directBookingId}
                      >
                        {cancelling?.type === 'direct' && cancelling?.id === directBookingId ? (
                          <Loader2 size={12} className="inv-spinner-inline" />
                        ) : (
                          'Cancel Direct'
                        )}
                      </button>
                    ) : (
                      <button
                        className={`inv-btn-direct-book${hasDirectBooking ? ' inv-btn-directbooked' : ''}`}
                        onClick={() => {
                          if (hasAnyBooking) {
                            showToast('error', hasDirectBooking
                              ? `You already have a direct booking for this item.`
                              : `You already have a fitting booked for this item on ${fmtDate(userFittingBooking.fittingDate)}.`);
                          } else {
                            setSelectedItem(item); setModal('directBooking');
                          }
                        }}
                        disabled={isDirectDisabled}
                      >
                        <ShoppingBag size={13} /> {directLabel}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW */}
        {viewMode === 'list' && (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ width:72 }}>Photo</th>
                  <th>Name</th><th>Category</th><th>Type</th><th>Size</th><th>Price</th><th>Status</th>
                  <th style={{ width:200 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {showSkeletons && [...Array(8)].map((_, i) => <FastSkeletonRow key={i} />)}
                {!showSkeletons && visibleItems.length === 0 && (
                  <tr><td colSpan={8} className="inv-empty">
                    {bookedItemIds.size > 0 
                      ? "You've already booked all available items. Check back later for new arrivals!"
                      : "No items found."}
                  </td></tr>
                )}
                {!showSkeletons && visibleItems.map(item => {
                  const promo = activePromo(item);
                  const price = discPrice(item);
                  const { hasFittingBooking, hasDirectBooking, hasAnyBooking, userFittingBooking, userDirectBooking, isFittingDisabled, isDirectDisabled, fittingLabel, directLabel, fittingBookingId, directBookingId } = getItemButtonState(item);
                  const fittingLabelSm = hasFittingBooking ? 'Booked' : hasDirectBooking ? 'N/A' : 'Book Fitting';
                  const directLabelSm  = hasDirectBooking  ? (userDirectBooking?.bookingStatus === 'Approved' ? 'Approved' : 'Pending') : hasFittingBooking ? 'N/A' : 'Book Direct';

                  return (
                    <tr key={item.id} className={`inv-tr${promo?' inv-tr-promo':''}`}>
                      <td>
                        <div className="inv-list-thumb" onClick={() => setGallery({ item, startIndex: 0 })}>
                          <MediaThumb item={item} />
                        </div>
                      </td>
                      <td>
                        <div className="inv-item-name">{item.name}</div>
                        {promo && <div className="inv-list-promo-badge"><Sparkles size={9} /><span>{promo.code}</span></div>}
                        {hasAnyBooking && (
                          <div className="inv-list-booked-badge" style={{ background: hasFittingBooking ? '#6b2d39' : '#c4717f', color:'#fff' }}>
                            {hasFittingBooking
                              ? <><Calendar size={10} /> Fitting: {fmtDate(userFittingBooking.fittingDate)}</>
                              : <><ShoppingBag size={10} /> {userDirectBooking?.bookingStatus === 'Approved' ? 'Approved' : 'Pending'}</>}
                          </div>
                        )}
                      </td>
                      <td><span className="inv-cat-tag">{item.category}</span></td>
                      <td><span className="inv-subtype-tag">{item.subtype}</span></td>
                      <td>{Array.isArray(item.sizes) ? item.sizes.join(', ') : item.size || '—'}</td>
                      <td>
                        {promo
                          ? <div><div className="inv-price-old">₱{item.price.toLocaleString()}</div><div className="inv-price-new">₱{Math.round(price).toLocaleString()}</div></div>
                          : <span className="inv-price">₱{item.price.toLocaleString()}</span>}
                      </td>
                      <td><StatusBadge status={item.status} /></td>
                      <td>
                        <div className="inv-row-actions">
                          <button className="inv-icon-btn" onClick={() => { setSelectedItem(item); setModal('view'); }}><Eye size={13} /></button>
                          {hasFittingBooking ? (
                            <button
                              className="inv-btn-cancel-sm"
                              onClick={() => handleCancelFitting(fittingBookingId)}
                              disabled={cancelling?.type === 'fitting' && cancelling?.id === fittingBookingId}
                            >
                              {cancelling?.type === 'fitting' && cancelling?.id === fittingBookingId ? (
                                <Loader2 size={11} className="inv-spinner-inline" />
                              ) : (
                                'Cancel'
                              )}
                            </button>
                          ) : (
                            <button
                              className={`inv-btn-book-sm${hasFittingBooking ? ' inv-btn-booked' : ''}`}
                              onClick={() => {
                                if (hasAnyBooking) {
                                  showToast('error', hasFittingBooking
                                    ? `Already have fitting booked on ${fmtDate(userFittingBooking.fittingDate)}.`
                                    : `You already have a booking for this item.`);
                                } else {
                                  setSelectedItem(item); setModal('booking');
                                }
                              }}
                              disabled={isFittingDisabled}
                            >
                              <Calendar size={12} /> {fittingLabelSm}
                            </button>
                          )}
                          {hasDirectBooking ? (
                            <button
                              className="inv-btn-cancel-sm-direct"
                              onClick={() => handleCancelDirect(directBookingId)}
                              disabled={cancelling?.type === 'direct' && cancelling?.id === directBookingId}
                            >
                              {cancelling?.type === 'direct' && cancelling?.id === directBookingId ? (
                                <Loader2 size={11} className="inv-spinner-inline" />
                              ) : (
                                'Cancel'
                              )}
                            </button>
                          ) : (
                            <button
                              className={`inv-btn-direct-book-sm${hasDirectBooking ? ' inv-btn-directbooked' : ''}`}
                              onClick={() => {
                                if (hasAnyBooking) {
                                  showToast('error', hasFittingBooking
                                    ? `Already have fitting booked on ${fmtDate(userFittingBooking.fittingDate)}.`
                                    : `You already have a booking for this item.`);
                                } else {
                                  setSelectedItem(item); setModal('directBooking');
                                }
                              }}
                              disabled={isDirectDisabled}
                            >
                              <ShoppingBag size={12} /> {directLabelSm}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW MODAL */}
      {modal === 'view' && selectedItem && (() => {
        const promo = activePromo(selectedItem);
        const price = discPrice(selectedItem);
        const { hasFittingBooking, hasDirectBooking, hasAnyBooking, userFittingBooking, userDirectBooking, isFittingDisabled, isDirectDisabled, fittingLabel, directLabel, fittingBookingId, directBookingId } = getItemButtonState(selectedItem);

        return (
          <div className="inv-overlay" onClick={closeModal}>
            <div className="inv-modal inv-modal-view" onClick={e => e.stopPropagation()}>
              <div className="inv-modal-header">
                <h3>Item Details</h3>
                <button className="inv-modal-close" onClick={closeModal}><X size={15} /></button>
              </div>
              <div className="inv-modal-body">
                <div className="inv-view-media" onClick={() => setGallery({ item: selectedItem, startIndex: 0 })}>
                  <MediaThumb item={selectedItem} />
                  <div className="inv-view-media-overlay"><Eye size={17} /> View Full</div>
                </div>
                <div className="inv-view-details">
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
                    <h4 className="inv-view-name">{selectedItem.name}</h4>
                    <StatusBadge status={selectedItem.status} />
                  </div>
                  {promo && (
                    <div className="inv-view-promo-banner">
                      <Sparkles size={14} />
                      <div>
                        <div className="inv-view-promo-banner-title">Promo Active: <strong>{promo.code}</strong></div>
                        <div className="inv-view-promo-banner-sub">{promo.type === 'percentage' ? `${promo.value}% discount applied` : `₱${promo.value} flat discount applied`}</div>
                      </div>
                      <div className="inv-view-promo-banner-price">
                        <span className="inv-view-promo-was">₱{selectedItem.price.toLocaleString()}</span>
                        <span className="inv-view-promo-now">₱{Math.round(price).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                  {hasAnyBooking && (
                    <div className="inv-view-booked-warning" style={{ background: hasFittingBooking ? 'rgba(107,45,57,0.1)' : 'rgba(196,113,127,0.1)', border:`1px solid ${hasFittingBooking?'#6b2d39':'#c4717f'}`, borderRadius:'8px', padding:'0.75rem', marginBottom:'1rem' }}>
                      {hasFittingBooking
                        ? <><Calendar size={14} style={{ color:'#6b2d39' }} /> <span>You have a fitting booked on <strong>{fmtDate(userFittingBooking.fittingDate)}</strong> at <strong>{userFittingBooking.fittingTime}</strong>.</span></>
                        : <><ShoppingBag size={14} style={{ color:'#c4717f' }} /> <span>You have a direct booking for this item — <strong>{userDirectBooking?.bookingStatus === 'Approved' ? 'Approved' : 'Pending Approval'}</strong>.</span></>}
                    </div>
                  )}
                  <div className="inv-view-grid">
                    {[
                      ['Category', selectedItem.category],
                      ['Type', selectedItem.subtype],
                      ['Sizes', Array.isArray(selectedItem.sizes) && selectedItem.sizes.length ? selectedItem.sizes.join(', ') : (selectedItem.size || null)],
                      ['Age Range', selectedItem.ageRange],
                      ['Daily Rate', promo
                        ? <><span style={{ textDecoration:'line-through', color:'#bbb', marginRight:'0.4rem' }}>₱{selectedItem.price.toLocaleString()}</span><strong style={{ color:'#15803d' }}>₱{Math.round(price).toLocaleString()}</strong></>
                        : `₱${selectedItem.price.toLocaleString()}`],
                    ].map(([k, v]) => v && (
                      <div key={k} className="inv-view-row">
                        <span className="inv-view-key">{k}</span>
                        <span className="inv-view-val">{v}</span>
                      </div>
                    ))}
                  </div>
                  {selectedItem.description && <p className="inv-view-desc">{selectedItem.description}</p>}
                </div>
              </div>
              <div className="inv-modal-footer">
                <button className="inv-btn-ghost" onClick={closeModal}>Close</button>
                {hasFittingBooking ? (
                  <button
                    className="inv-btn-cancel"
                    onClick={() => handleCancelFitting(fittingBookingId)}
                    disabled={cancelling?.type === 'fitting' && cancelling?.id === fittingBookingId}
                  >
                    {cancelling?.type === 'fitting' && cancelling?.id === fittingBookingId ? (
                      <Loader2 size={14} className="inv-spinner-inline" />
                    ) : (
                      'Cancel Fitting'
                    )}
                  </button>
                ) : (
                  <button
                    className={`inv-btn-outline${hasAnyBooking ? ' inv-btn-disabled' : ''}`}
                    onClick={() => {
                      if (hasAnyBooking) {
                        showToast('error', hasFittingBooking
                          ? `Already have fitting booked on ${fmtDate(userFittingBooking.fittingDate)}.`
                          : `You already have a booking for this item.`);
                      } else { setModal('booking'); }
                    }}
                    disabled={isFittingDisabled}
                  >
                    <Calendar size={14} /> {fittingLabel}
                  </button>
                )}
                {hasDirectBooking ? (
                  <button
                    className="inv-btn-cancel-direct"
                    onClick={() => handleCancelDirect(directBookingId)}
                    disabled={cancelling?.type === 'direct' && cancelling?.id === directBookingId}
                  >
                    {cancelling?.type === 'direct' && cancelling?.id === directBookingId ? (
                      <Loader2 size={14} className="inv-spinner-inline" />
                    ) : (
                      'Cancel Direct'
                    )}
                  </button>
                ) : (
                  <button
                    className={`inv-btn-primary${hasAnyBooking ? ' inv-btn-disabled' : ''}`}
                    onClick={() => {
                      if (hasAnyBooking) {
                        showToast('error', hasDirectBooking
                          ? `You already have a direct booking (${userDirectBooking?.bookingStatus === 'Approved' ? 'Approved' : 'Pending approval'}).`
                          : `You already have a fitting booked on ${fmtDate(userFittingBooking.fittingDate)}.`);
                      } else { setModal('directBooking'); }
                    }}
                    disabled={isDirectDisabled}
                  >
                    <ShoppingBag size={14} /> {directLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* FITTING BOOKING MODAL */}
      {modal === 'booking' && selectedItem && !bookingConfirmed && (() => {
        const { hasFittingBooking, hasDirectBooking, hasAnyBooking, userFittingBooking } = getItemButtonState(selectedItem);

        if (hasAnyBooking) {
          setTimeout(() => {
            closeModal();
            showToast('error', hasFittingBooking
              ? `You already have a fitting booked for ${selectedItem.name} on ${fmtDate(userFittingBooking.fittingDate)}.`
              : `You already have a booking for ${selectedItem.name}.`);
          }, 100);
          return null;
        }

        const promo = activePromo(selectedItem);
        const selectedDateNonWorking = booking.fittingDate && !isWorkingDay(booking.fittingDate, bookingSettings);
        const dateIsFullyBooked = !!booking.fittingDate && !loadingFittingSlots && timeSlots.length > 0 && timeSlots.every(t => bookedFittingSlots.includes(to24Hour(t)));

        const timeOptions = timeSlots.map(slot => ({
          value: slot,
          label: slot,
          disabled: bookedFittingSlots.includes(to24Hour(slot))
        }));

        const handleTimeChange = (e) => {
          setBooking(p => ({ ...p, fittingTime: e.target.value }));
        };

        return (
          <div className="inv-overlay" onClick={closeModal}>
            <div className="inv-modal" style={{ maxWidth:'560px' }} onClick={e => e.stopPropagation()}>
              <div className="inv-modal-header">
                <h3>Book a Fitting — {selectedItem.name}</h3>
                <button className="inv-modal-close" onClick={closeModal} disabled={submitting}><X size={16} /></button>
              </div>
              <div className="inv-modal-body">
                <div className="inv-lease-item-preview">
                  <div className="inv-lease-preview-thumb"><MediaThumb item={selectedItem} /></div>
                  <div>
                    <div className="inv-lease-preview-name">{selectedItem.name}</div>
                    <div className="inv-lease-preview-price">
                      {promo
                        ? <><span style={{ textDecoration:'line-through', color:'#bbb', marginRight:'0.3rem' }}>₱{selectedItem.price.toLocaleString()}</span>₱{Math.round(discPrice(selectedItem)).toLocaleString()}/day</>
                        : `₱${selectedItem.price.toLocaleString()}/day`}
                    </div>
                    {promo && <div className="inv-promo-code-pill" style={{ marginTop:'0.25rem' }}><Sparkles size={8} /> {promo.code}</div>}
                  </div>
                </div>

                <div className="inv-warning-box">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Important:</strong> If you don't arrive at the scheduled time, your fitting may be cancelled. Please arrive 10 minutes early.
                    {bookingSettings.enabled && (
                      <span> Shop hours: <strong>
                        {min2label((bookingSettings.startHour ?? 9) * 60 + (bookingSettings.startMinute ?? 0))}
                        {' – '}
                        {min2label((bookingSettings.endHour ?? 17) * 60 + (bookingSettings.endMinute ?? 0))}
                      </strong>.</span>
                    )}
                  </div>
                </div>

                <div className="inv-modal-grid">
                  <div className="inv-field">
                    <label className="inv-field-label">Fitting Date <span className="inv-required">*</span></label>
                    <FittingDatePicker
                      value={booking.fittingDate}
                      onChange={ds => setBooking(p => ({ ...p, fittingDate: ds, fittingTime: '' }))}
                      minDate={todayStr()}
                      bookingSettings={bookingSettings}
                      itemId={selectedItem.id}
                      timeSlots={timeSlots}
                      slotCacheRef={slotCacheRef}
                      disabled={submitting}
                    />
                    {selectedDateNonWorking && (
                      <span className="inv-field-hint inv-field-hint-warn">
                        <AlertTriangle size={11} /> Not a working day
                      </span>
                    )}
                  </div>
                  <div className="inv-field">
                    <label className="inv-field-label">
                      Fitting Time <span className="inv-required">*</span>
                      {loadingFittingSlots && booking.fittingDate && (
                        <Loader2 size={11} className="inv-spinner-inline" style={{ marginLeft:'0.4rem' }} />
                      )}
                    </label>
                    {!booking.fittingDate && (
                      <div className="ts-placeholder">Select a date first</div>
                    )}
                    {booking.fittingDate && loadingFittingSlots && (
                      <div className="ts-placeholder"><Loader2 size={13} className="inv-spinner-inline" /> Loading slots…</div>
                    )}
                    {booking.fittingDate && !loadingFittingSlots && dateIsFullyBooked && (
                      <div className="ts-placeholder ts-placeholder-full">No available slots for this date</div>
                    )}
                    {booking.fittingDate && !loadingFittingSlots && !dateIsFullyBooked && (
                      <select
                        className="inv-select time-select-dropdown"
                        value={booking.fittingTime}
                        onChange={handleTimeChange}
                        disabled={submitting}
                        style={{ width: '100%' }}
                      >
                        <option value="" disabled>Select a time</option>
                        {timeOptions.map(opt => (
                          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                            {opt.label} {opt.disabled ? '(Booked)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="inv-field">
                  <label className="inv-field-label">Full Name <span className="inv-required">*</span></label>
                  <input className="inv-input" type="text" placeholder="Enter your full name" value={booking.name} onChange={e => setBooking(p => ({ ...p, name: e.target.value }))} disabled={submitting} />
                </div>
                <div className="inv-modal-grid">
                  <div className="inv-field">
                    <label className="inv-field-label">Email <span className="inv-required">*</span></label>
                    <input className="inv-input" type="email" placeholder="you@example.com" value={booking.email} onChange={e => setBooking(p => ({ ...p, email: e.target.value }))} disabled={submitting} />
                  </div>
                  <div className="inv-field">
                    <label className="inv-field-label">Phone <span className="inv-required">*</span></label>
                    <PhilippinePhoneInput
                      value={booking.phone}
                      onChange={(val) => setBooking(p => ({ ...p, phone: val }))}
                      disabled={submitting}
                      placeholder="9XX XXX XXXX"
                    />
                  </div>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Preferred Size</label>
                  <select className="inv-select" value={booking.preferredSize} onChange={e => setBooking(p => ({ ...p, preferredSize: e.target.value }))} disabled={submitting}>
                    <option value="">Select size (optional)</option>
                    {(Array.isArray(selectedItem?.sizes) && selectedItem.sizes.length ? selectedItem.sizes : selectedItem?.size ? [selectedItem.size] : ['XS','S','M','L','XL','XXL','3XL']).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Special Requests</label>
                  <textarea className="inv-textarea" rows={3} placeholder="Any special requests or questions?" value={booking.notes} onChange={e => setBooking(p => ({ ...p, notes: e.target.value }))} disabled={submitting} />
                </div>

                <div className="bk-payment-summary">
                  <div className="bk-ps-row total" style={{ borderBottom:'none', marginBottom:0, paddingBottom:0 }}>
                    <span><strong>Fitting Summary</strong></span>
                  </div>
                  <div className="bk-ps-row"><span>Item</span><span>{selectedItem.name}</span></div>
                  <div className="bk-ps-row"><span>Fitting Date</span><span>{booking.fittingDate ? fmtDate(booking.fittingDate) : '—'}</span></div>
                  <div className="bk-ps-row"><span>Fitting Time</span><span>{booking.fittingTime || '—'}</span></div>
                  <div className="bk-ps-row" style={{ fontSize:'0.7rem', color:'#999', justifyContent:'center', marginTop:'0.5rem' }}>
                    * Fitting is FREE and no obligation to rent
                  </div>
                </div>
              </div>

              <div className="inv-modal-footer">
                <button className="inv-btn-ghost" onClick={closeModal} disabled={submitting}>Cancel</button>
                <button
                  className="inv-btn-primary"
                  onClick={handleBookingSubmit}
                  disabled={
                    submitting ||
                    !booking.fittingDate ||
                    !booking.fittingTime ||
                    !booking.name ||
                    !booking.email ||
                    !booking.phone ||
                    selectedDateNonWorking ||
                    bookedFittingSlots.includes(to24Hour(booking.fittingTime)) ||
                    (timeSlots.length > 0 && timeSlots.every(t => bookedFittingSlots.includes(to24Hour(t))))
                  }
                >
                  {submitting
                    ? <><Loader2 size={14} className="inv-spinner-inline" /> Submitting…</>
                    : <>Confirm Fitting</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* FITTING CONFIRMATION MODAL */}
      {modal === 'booking' && bookingConfirmed && (
        <div className="inv-overlay" onClick={closeModal}>
          <div className="inv-modal" style={{ maxWidth:'500px' }} onClick={e => e.stopPropagation()}>
            <div className="inv-modal-header" style={{ background:'#6b2d3908', borderBottomColor:'#6b2d3920' }}>
              <h3 style={{ color:'#6b2d39', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <CheckCircle size={20} /> Fitting Confirmed!
              </h3>
              <button className="inv-modal-close" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="inv-modal-body">
              <div className="inv-confirmation-summary">
                <p className="inv-confirmation-message">
                  Your fitting has been successfully booked. We've sent a confirmation to <strong>{bookingConfirmed.customerEmail}</strong>.
                </p>
                <div className="inv-booking-details">
                  <div className="inv-booking-detail-row"><span className="inv-booking-label">Booking ID:</span><span className="inv-booking-value">#FT-{bookingConfirmed.id}</span></div>
                  <div className="inv-booking-detail-row"><span className="inv-booking-label">Item:</span><span className="inv-booking-value">{bookingConfirmed.item.name}</span></div>
                  <div className="inv-booking-detail-row"><span className="inv-booking-label">Date & Time:</span><span className="inv-booking-value">{fmtDateTime(bookingConfirmed.date, bookingConfirmed.time)}</span></div>
                  <div className="inv-booking-detail-row"><span className="inv-booking-label">Customer:</span><span className="inv-booking-value">{bookingConfirmed.customerName}</span></div>
                </div>
                <div className="inv-reminder-box">
                  <Clock size={14} />
                  <div><strong>Reminder:</strong> Please arrive 10 minutes before your scheduled time. To reschedule, contact us at least 24 hours in advance.</div>
                </div>
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="inv-btn-primary" onClick={closeModal}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* DIRECT BOOKING MODAL */}
      {modal === 'directBooking' && selectedItem && (
        <DirectBookingModal
          item={selectedItem}
          onClose={closeModal}
          isLoggedIn={isLoggedIn}
          showToast={showToast}
          currentUser={currentUser}
          bookingSettings={bookingSettings}
          userProfile={userProfile}
          inventorySettings={inventorySettings}  // <-- pass live settings
          onSuccess={confirmed => {
            getUserDirectBookings()
              .then(data => {
                const bookings = Array.isArray(data) ? data : [];
                setDirectBookings(bookings);
                localStorage.setItem('userDirectBookings', JSON.stringify(bookings));
              })
              .catch(err => console.error('Error refreshing direct bookings:', err));
            setDirectBookingConfirmed(confirmed);
            setModal('directBookingConfirm');
          }}
        />
      )}

      {/* DIRECT BOOKING CONFIRM MODAL */}
      {modal === 'directBookingConfirm' && directBookingConfirmed && (
        <DirectBookingConfirmModal booking={directBookingConfirmed} onClose={closeModal} />
      )}

      {gallery && <MediaGallery item={gallery.item} startIndex={gallery.startIndex} onClose={() => setGallery(null)} />}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}