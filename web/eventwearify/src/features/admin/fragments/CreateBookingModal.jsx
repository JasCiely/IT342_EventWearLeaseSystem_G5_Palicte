import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Loader2, CheckCircle, AlertCircle, Search,
  Calendar, ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react';
import { fetchCustomers } from '../services/customerService';
import { fetchItems, fetchInventorySettings } from '../../../shared/services/inventoryApi';
import {
  checkDirectBookingAvailability,
  getBookedFittingSlots,
  getOccupiedDirectDates,
} from '../../../shared/services/bookingApi';
import { authFetch } from '../../../shared/services/apiClient';
import { useBookingSettings } from '../../../shared/hooks/useBookingSettings';
import '../../customer/styles/BrowseOutfitsFragment.css';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

function formatPhone(raw) {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  // Normalize to 10-digit local number (9XXXXXXXXX)
  if (digits.startsWith('63')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return '';
  // Format as +63 9XX-XXX-XXXX
  if (digits.length <= 3) return `+63 ${digits}`;
  if (digits.length <= 6) return `+63 ${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `+63 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ── Calendar / time-slot helpers ──────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const todayStr   = () => new Date().toISOString().split('T')[0];
const fmtCalDate = d  => d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

function min2label(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function min2display(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
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
  return (settings.workingDays || [1, 2, 3, 4, 5]).includes(dow);
}

function isWorkdayOver(settings) {
  const now = new Date();
  const closeMin = ((settings?.endHour ?? 17) * 60) + (settings?.endMinute ?? 0);
  return (now.getHours() * 60 + now.getMinutes()) >= closeMin;
}

// ── FittingDatePicker ─────────────────────────────────────────────────────────
function FittingDatePicker({ value, onChange, minDate, bookingSettings, itemId, timeSlots, slotCacheRef, disabled }) {
  const today = minDate || todayStr();

  const [open, setOpen]         = useState(false);
  const wrapRef                 = useRef(null);
  const [view, setView]         = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  // keyed by date string — only state, never read ref during render
  const [slotData, setSlotData] = useState({});
  // tracks which itemId__date keys have been fetched; ref avoids setState-in-effect
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

  // Fetch slots for visible days not yet fetched; only setState inside .then()
  useEffect(() => {
    if (!itemId || !timeSlots.length) return;
    const toFetch = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds  = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const key = `${itemId}__${ds}`;
      if (ds < today) continue;
      if (!isWorkingDay(ds, bookingSettings)) continue;
      if (fetchedRef.current.has(key)) continue;
      toFetch.push(ds);
    }
    if (!toFetch.length) return;

    toFetch.forEach(ds => fetchedRef.current.add(`${itemId}__${ds}`));
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
      setSlotData(prev => ({ ...prev, ...patch }));
    });
  }, [year, month, itemId, timeSlots.length, today, bookingSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSlots = ds => slotData[ds];

  const prevMonth = () => setView(v => { const d = new Date(v.year, v.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const nextMonth = () => setView(v => { const d = new Date(v.year, v.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const canPrev   = new Date(year, month, 0).toISOString().split('T')[0] >= today;

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
        <span style={{ flex: 1, textAlign: 'left' }}>{value ? fmtCalDate(value) : 'Select a date'}</span>
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
              const isFullBook = !isPast && !isNonWork && timeSlots.length > 0 && slots !== undefined && timeSlots.every(t => slots.includes(t));
              const isSelected = ds === value;
              const isToday    = ds === todayStr();
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

// ── DirectDatePicker ──────────────────────────────────────────────────────────
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

  const isDateBlocked = dateStr => {
    if (!occupiedRanges?.length) return false;
    return occupiedRanges.some(r => dateStr >= r.startDate && dateStr <= r.endDate);
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
              if (isPast)      cls += ' fcd-past';
              else if (isNonWork) cls += ' fcd-closed';
              else if (isBlocked) cls += ' fcd-full';
              else             cls += ' fcd-avail';
              if (isSelected)  cls += ' fcd-selected';
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

// ── Main Modal ────────────────────────────────────────────────────────────────
function CreateBookingModal({ onSuccess, onClose }) {
  const [tab, setTab] = useState('fitting');
  const { settings: bookingSettings } = useBookingSettings();
  const timeSlots    = useMemo(() => buildTimeSlots(bookingSettings), [bookingSettings]);
  const slotCacheRef = useRef({});

  // Customer fields
  const [customerSearch, setCustomerSearch] = useState('');
  const [suggestions, setSuggestions]       = useState([]);
  const [customerName, setCustomerName]     = useState('');
  const [customerEmail, setCustomerEmail]   = useState('');
  const [customerPhone, setCustomerPhone]   = useState('');

  // Item
  const [items, setItems]               = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');

  // Shared optional fields
  const [preferredSize, setPreferredSize] = useState('');
  const [notes, setNotes]                 = useState('');

  // Customer selection tracking
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Item search
  const [itemSearch, setItemSearch]           = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemDropRef                            = useRef(null);

  // Fitting-specific
  const [fittingDate, setFittingDate]             = useState('');
  const [fittingTime, setFittingTime]             = useState('');
  const [bookedFittingSlots, setBookedFittingSlots] = useState([]);
  const [loadingFittingSlots, setLoadingFittingSlots] = useState(false);

  // Direct-specific
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');
  const [availability, setAvailability] = useState(null);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [occupiedRanges, setOccupiedRanges] = useState([]);

  // Inventory settings (for discount calculation)
  const [invSettings, setInvSettings] = useState(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  // Load items and inventory settings on mount
  useEffect(() => {
    fetchItems()
      .then(all => setItems(all.filter(i => i.status === 'Available')))
      .catch(console.error);
    fetchInventorySettings()
      .then(setInvSettings)
      .catch(console.error);
  }, []);

  // Customer search debounce
  useEffect(() => {
    if (!customerSearch.trim()) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      fetchCustomers({ search: customerSearch, size: 5 })
        .then(res => setSuggestions(res.content || []))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // Fetch booked fitting slots when date + item change
  useEffect(() => {
    if (tab !== 'fitting' || !fittingDate || !selectedItemId) {
      setBookedFittingSlots([]);
      return;
    }
    setLoadingFittingSlots(true);
    getBookedFittingSlots(selectedItemId, fittingDate)
      .then(setBookedFittingSlots)
      .catch(() => setBookedFittingSlots([]))
      .finally(() => setLoadingFittingSlots(false));
  }, [fittingDate, selectedItemId, tab]);

  // Clear selected time if it becomes booked
  useEffect(() => {
    if (fittingTime && bookedFittingSlots.includes(fittingTime)) setFittingTime('');
  }, [bookedFittingSlots]);

  // Fetch occupied direct dates when item changes (direct tab)
  useEffect(() => {
    if (tab !== 'direct' || !selectedItemId) { setOccupiedRanges([]); return; }
    getOccupiedDirectDates(selectedItemId)
      .then(setOccupiedRanges)
      .catch(() => setOccupiedRanges([]));
  }, [selectedItemId, tab]);

  // Item dropdown click-outside
  useEffect(() => {
    if (!showItemDropdown) return;
    const h = e => { if (itemDropRef.current && !itemDropRef.current.contains(e.target)) setShowItemDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showItemDropdown]);

  // Check availability when direct dates / item change
  useEffect(() => {
    if (tab !== 'direct' || !selectedItemId || !startDate || !endDate) {
      setAvailability(null);
      return;
    }
    setCheckingAvail(true);
    checkDirectBookingAvailability(selectedItemId, startDate, endDate)
      .then(setAvailability)
      .catch(() => setAvailability(null))
      .finally(() => setCheckingAvail(false));
  }, [tab, selectedItemId, startDate, endDate]);

  const selectCustomer = c => {
    setSelectedCustomer(c);
    setCustomerName(`${c.firstName} ${c.lastName}`);
    setCustomerEmail(c.email);
    setCustomerPhone(c.phone ? formatPhone(c.phone) : '');
    setCustomerSearch('');
    setSuggestions([]);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerSearch('');
  };

  const selectItem = item => {
    setSelectedItemId(item.id);
    setItemSearch(item.name);
    setShowItemDropdown(false);
    setFittingDate('');
    setFittingTime('');
    setStartDate('');
    setEndDate('');
    const szArr = Array.isArray(item.sizes) ? item.sizes.filter(Boolean) : (item.size ? [item.size] : []);
    setPreferredSize(szArr.length === 1 ? szArr[0] : '');
  };

  const clearItem = () => {
    setSelectedItemId('');
    setItemSearch('');
    setShowItemDropdown(false);
    setFittingDate('');
    setFittingTime('');
    setStartDate('');
    setEndDate('');
    setPreferredSize('');
  };

  const selectedItem = items.find(i => i.id === selectedItemId) || null;

  const filteredItems = useMemo(() => {
    const q = itemSearch.toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.name?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q)
    );
  }, [items, itemSearch]);

  const totalDays = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000) + 1)
    : 0;
  const basePrice = selectedItem?.price ? selectedItem.price * totalDays : 0;
  const weeks = Math.floor(totalDays / 7);
  const rawDiscount = weeks * (invSettings?.weeklyDiscount ?? 100);
  const discountAmount = Math.min(rawDiscount, invSettings?.monthlyDiscountCap ?? 300);
  const finalPrice = Math.max(0, basePrice - discountAmount);

  const dateIsFullyBooked = !!fittingDate && !loadingFittingSlots &&
    timeSlots.length > 0 && timeSlots.every(t => bookedFittingSlots.includes(t));

  const handleStartChange = newStart => {
    setStartDate(newStart);
    if (endDate && endDate < newStart) setEndDate('');
  };

  const validate = () => {
    if (!customerName.trim())  return 'Customer name is required';
    if (!customerEmail.trim()) return 'Customer email is required';
    if (!customerPhone.trim()) return 'Customer phone is required';
    let phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.startsWith('63')) phoneDigits = phoneDigits.slice(2);
    else if (phoneDigits.startsWith('0')) phoneDigits = phoneDigits.slice(1);
    if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) return 'Enter a valid PH mobile number (+63 9XX-XXX-XXXX)';
    if (!selectedItemId)       return 'Please select an item';
    if (selectedItem) {
      const szArr = Array.isArray(selectedItem.sizes) ? selectedItem.sizes.filter(Boolean) : (selectedItem.size ? [selectedItem.size] : []);
      if (szArr.length > 1 && !preferredSize) return 'Please select a size for this item';
    }
    if (tab === 'fitting') {
      if (!fittingDate) return 'Please select a fitting date';
      if (!fittingTime) return 'Please select a time slot';
      if (bookedFittingSlots.includes(fittingTime)) return 'Selected time slot is already booked';
    } else {
      if (!startDate || !endDate) return 'Please select rental start and end dates';
      if (new Date(endDate) < new Date(startDate)) return 'End date must be on or after start date';
      if (availability === false) return 'Item is not available for the selected dates';
      if (!selectedItem?.price) return 'Selected item has no price configured';
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSubmitting(true);
    try {
      if (tab === 'fitting') {
        await authFetch('/admin/bookings/fitting', {
          method: 'POST',
          body: JSON.stringify({
            customerEmail,
            customerName,
            customerPhone,
            itemId:    selectedItemId,
            itemName:  selectedItem?.name || '',
            fittingDate,
            fittingTime,
            preferredSize: preferredSize || null,
            notes: notes || null,
          }),
        });
      } else {
        await authFetch('/admin/bookings/direct', {
          method: 'POST',
          body: JSON.stringify({
            customerEmail,
            customerName,
            customerPhone,
            itemId:    selectedItemId,
            itemName:  selectedItem?.name || '',
            startDate,
            endDate,
            basePrice,
            discountAmount,
            finalPrice,
            notes: notes || null,
            preferredSize: preferredSize || null,
          }),
        });
      }
      onSuccess();
    } catch (e) {
      setError(e.message || 'Failed to create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const today = todayStr();

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 5,
  };

  return (
    <div className="inv-overlay" style={{ overflowY: 'auto', alignItems: 'flex-start', paddingTop: '2rem', paddingBottom: '2rem' }} onClick={onClose}>
      <div
        className="inv-modal"
        style={{ maxWidth: 680, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="inv-modal-header">
          <h3 style={{ margin: 0 }}>New Booking</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 1.25rem', flexShrink: 0 }}>
          {[
            { key: 'fitting', label: 'Fitting Appointment' },
            { key: 'direct',  label: 'Direct Rental' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(''); setAvailability(null); }}
              style={{
                padding: '0.55rem 1rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: tab === key ? 600 : 400,
                color: tab === key ? '#c4717f' : '#6b7280',
                borderBottom: tab === key ? '2px solid #c4717f' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="inv-modal-body">

          {/* ── Customer search ── */}
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            {selectedCustomer ? (
              <>
                <label style={labelStyle}>Customer</label>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 12px', background: 'rgba(196,113,127,0.06)',
                  border: '1px solid rgba(196,113,127,0.3)', borderRadius: 8,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedCustomer.firstName} {selectedCustomer.lastName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#6b7280', padding: '3px 10px', fontSize: 12 }}
                  >
                    Change
                  </button>
                </div>
              </>
            ) : (
              <>
                <label style={labelStyle}>Search Customer</label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                  <input
                    className="inv-input"
                    style={{ paddingLeft: 30 }}
                    placeholder="Search by name or email…"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                  />
                </div>
                {suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                    zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    maxHeight: 200, overflowY: 'auto',
                  }}>
                    {suggestions.map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '9px 14px', background: 'none', border: 'none',
                          borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: 13,
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{c.firstName} {c.lastName}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="inv-modal-grid" style={{ marginBottom: '0.75rem' }}>
            <div className="inv-field">
              <label style={labelStyle}>Full Name *</label>
              <input className="inv-input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer full name" />
            </div>
            <div className="inv-field">
              <label style={labelStyle}>Phone *</label>
              <input
                className="inv-input"
                value={customerPhone}
                onChange={e => setCustomerPhone(formatPhone(e.target.value))}
                placeholder="+63 9XX-XXX-XXXX"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="inv-field" style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Email *</label>
            <input className="inv-input" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@email.com" />
          </div>

          {/* ── Item ── */}
          <div className="inv-modal-grid" style={{ marginBottom: '0.75rem' }}>
            <div className="inv-field" ref={itemDropRef} style={{ position: 'relative' }}>
              <label style={labelStyle}>Item *</label>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                <input
                  className="inv-input"
                  style={{ paddingLeft: 30, paddingRight: selectedItemId ? 28 : undefined }}
                  placeholder="Search item by name…"
                  value={itemSearch}
                  onChange={e => {
                    const val = e.target.value;
                    setItemSearch(val);
                    if (selectedItemId) {
                      setSelectedItemId('');
                      setFittingDate(''); setFittingTime(''); setStartDate(''); setEndDate('');
                    }
                    setShowItemDropdown(true);
                  }}
                  onFocus={() => setShowItemDropdown(true)}
                />
                {selectedItemId && (
                  <button
                    type="button"
                    onClick={clearItem}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af', display: 'flex', alignItems: 'center' }}
                    title="Clear selection"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {showItemDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                  zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  maxHeight: 200, overflowY: 'auto',
                }}>
                  {filteredItems.length === 0 ? (
                    <div style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 13 }}>No items found</div>
                  ) : (
                    filteredItems.map(i => (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => selectItem(i)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          width: '100%', textAlign: 'left',
                          padding: '8px 14px',
                          background: i.id === selectedItemId ? 'rgba(196,113,127,0.08)' : 'none',
                          border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: 13,
                        }}
                      >
                        <span style={{ fontWeight: i.id === selectedItemId ? 600 : 400 }}>{i.name}</span>
                        <span style={{ color: '#9ca3af', fontSize: 12 }}>₱{Number(i.price).toLocaleString()}/day</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {(() => {
              if (!selectedItem) return null;
              const szArr = Array.isArray(selectedItem.sizes) ? selectedItem.sizes.filter(Boolean) : (selectedItem.size ? [selectedItem.size] : []);
              if (szArr.length === 0) return null;
              if (szArr.length === 1) return (
                <div className="inv-field">
                  <label style={labelStyle}>Size</label>
                  <div style={{ padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151' }}>{szArr[0]}</div>
                </div>
              );
              return (
                <div className="inv-field">
                  <label style={labelStyle}>Size *</label>
                  <select className="inv-select" style={{ width: '100%' }} value={preferredSize} onChange={e => setPreferredSize(e.target.value)}>
                    <option value="">Select size</option>
                    {szArr.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              );
            })()}
          </div>

          {/* ── Fitting fields ── */}
          {tab === 'fitting' && (
            <div className="inv-modal-grid" style={{ marginBottom: '0.75rem' }}>
              <div className="inv-field">
                <label style={labelStyle}>Fitting Date *</label>
                <FittingDatePicker
                  value={fittingDate}
                  onChange={ds => { setFittingDate(ds); setFittingTime(''); }}
                  minDate={today}
                  bookingSettings={bookingSettings}
                  itemId={selectedItemId}
                  timeSlots={timeSlots}
                  slotCacheRef={slotCacheRef}
                  disabled={submitting || !selectedItemId}
                />
                {!selectedItemId && (
                  <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Select an item first to see availability.</p>
                )}
              </div>
              <div className="inv-field">
                <label style={labelStyle}>
                  Time Slot *
                  {loadingFittingSlots && fittingDate && (
                    <Loader2 size={11} className="inv-spinner-inline" style={{ marginLeft: 4 }} />
                  )}
                </label>
                {!fittingDate && (
                  <div className="ts-placeholder">Select a date first</div>
                )}
                {fittingDate && loadingFittingSlots && (
                  <div className="ts-placeholder">
                    <Loader2 size={13} className="inv-spinner-inline" /> Loading slots…
                  </div>
                )}
                {fittingDate && !loadingFittingSlots && dateIsFullyBooked && (
                  <div className="ts-placeholder ts-placeholder-full">No available slots for this date</div>
                )}
                {fittingDate && !loadingFittingSlots && !dateIsFullyBooked && (
                  <select
                    className="inv-select"
                    style={{ width: '100%' }}
                    value={fittingTime}
                    onChange={e => setFittingTime(e.target.value)}
                    disabled={submitting}
                  >
                    <option value="" disabled>Select a time</option>
                    {timeSlots.map(slot => {
                      const isBooked = bookedFittingSlots.includes(slot);
                      return (
                        <option key={slot} value={slot} disabled={isBooked}>
                          {min2display(slot)}{isBooked ? ' (Booked)' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* ── Direct rental fields ── */}
          {tab === 'direct' && (
            <>
              <div className="inv-modal-grid" style={{ marginBottom: '0.75rem' }}>
                <div className="inv-field">
                  <label style={labelStyle}>Start Date *</label>
                  <DirectDatePicker
                    value={startDate}
                    onChange={handleStartChange}
                    minDate={today}
                    bookingSettings={bookingSettings}
                    occupiedRanges={occupiedRanges}
                    disabled={submitting || !selectedItemId}
                    label="start date"
                  />
                  {!selectedItemId && (
                    <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Select an item first.</p>
                  )}
                </div>
                <div className="inv-field">
                  <label style={labelStyle}>End Date *</label>
                  <DirectDatePicker
                    value={endDate}
                    onChange={newEnd => setEndDate(newEnd)}
                    minDate={startDate || today}
                    bookingSettings={bookingSettings}
                    occupiedRanges={occupiedRanges}
                    disabled={submitting || !selectedItemId || !startDate}
                    label="end date"
                  />
                </div>
              </div>

              {/* Availability indicator */}
              {selectedItemId && startDate && endDate && (
                <div style={{
                  marginBottom: '0.75rem', padding: '8px 12px', borderRadius: 6, fontSize: 13,
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

              {/* Price summary */}
              {selectedItem && totalDays > 0 && (
                <div style={{
                  background: '#f9fafb', borderRadius: 8, padding: '10px 14px',
                  marginBottom: '0.75rem', fontSize: 13,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', marginBottom: 6 }}>
                    <span>₱{Number(selectedItem.price).toLocaleString()} × {totalDays} day{totalDays !== 1 ? 's' : ''}</span>
                    <span>₱{basePrice.toLocaleString()}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', marginBottom: 6 }}>
                      <span>Weekly discount ({weeks} week{weeks !== 1 ? 's' : ''})</span>
                      <span>−₱{discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #e5e7eb', paddingTop: 6 }}>
                    <span>Total</span>
                    <span style={{ color: '#c4717f' }}>₱{finalPrice.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Notes ── */}
          <div className="inv-field">
            <label style={labelStyle}>Notes</label>
            <textarea
              className="inv-input"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: '0.75rem', padding: '8px 12px', borderRadius: 6, fontSize: 13,
              background: 'rgba(153,27,27,0.08)', color: '#991b1b',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="inv-btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 size={13} className="inv-spinner-inline" style={{ marginRight: 4 }} />}
            {submitting ? 'Creating…' : tab === 'fitting' ? 'Create Fitting Booking' : 'Create Rental Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateBookingModal;
