import React, { useState, useMemo } from 'react';
import '../../../components/css/adminDashboard/BookingsManagement.css';
import {
  Plus, Search, Eye, X, CheckCircle, AlertCircle, Clock, User, Phone,
  Calendar, CreditCard, RotateCcw, ChevronRight, Shield, Scissors,
  ClipboardCheck, PackageCheck, XCircle, Banknote, Star, AlertTriangle,
  ChevronDown, Filter,
} from 'lucide-react';
import {
  BOOKING_STATUS_META, ITEM_STATUS_META, SEED_ITEMS, SEED_BOOKINGS, SEED_PROMOS,
  STAFF_LIST, PAYMENT_METHODS, todayStr, fmtDate, fmtDateTime, genId, initials,
} from './sharedData.js';
import { StatusBadge, MediaThumb, Toast } from './InventoryFragment.jsx';

// ── booking flow steps (ordered) ────────────────────────────
const FLOW_STEPS = [
  'Pending','Confirmed','For Fitting','Fitted',
  'Awaiting Payment','Paid / Released','Active Lease',
  'Returned','Under Inspection','Completed',
];

// ── What action button shows per status ─────────────────────
const NEXT_ACTIONS = {
  'Pending':          { label:'Confirm Booking',    icon:CheckCircle,   next:'Confirmed',        actorRole:'Staff/Admin', color:'#1d4ed8' },
  'Confirmed':        { label:'Mark Fitting Done',  icon:Scissors,      next:'Fitted',           actorRole:'Staff',       color:'#7c3aed' },
  'Fitted':           { label:'Request Payment',    icon:Banknote,      next:'Awaiting Payment', actorRole:'Staff',       color:'#c4717f' },
  'Awaiting Payment': { label:'Confirm Payment',    icon:CreditCard,    next:'Paid / Released',  actorRole:'Staff/Admin', color:'#15803d' },
  'Paid / Released':  { label:'Mark as Active Lease',icon:PackageCheck, next:'Active Lease',     actorRole:'System',      color:'#b45309' },
  'Active Lease':     { label:'Mark Returned',      icon:RotateCcw,     next:'Returned',         actorRole:'Staff',       color:'#7c3aed' },
  'Returned':         { label:'Start Inspection',   icon:ClipboardCheck,next:'Under Inspection', actorRole:'Staff',       color:'#9a3412' },
  'Under Inspection': { label:'Complete Inspection',icon:Star,          next:'Completed',        actorRole:'Staff',       color:'#15803d' },
};

// ── which statuses allow cancellation ───────────────────────
const CANCELLABLE = ['Pending','Confirmed'];

function BookingStatusBadge({ status }) {
  return <StatusBadge status={status} meta={BOOKING_STATUS_META}/>;
}

// ── Timeline entry ───────────────────────────────────────────
function TimelineEntry({ entry, isLast }) {
  const m = BOOKING_STATUS_META[entry.status] || {};
  return (
    <div className="bk-timeline-entry">
      <div className="bk-timeline-left">
        <div className="bk-timeline-dot" style={{ background:m.dot||'#ccc', boxShadow:`0 0 0 3px ${(m.dot||'#ccc')}22` }}/>
        {!isLast && <div className="bk-timeline-line"/>}
      </div>
      <div className="bk-timeline-body">
        <div className="bk-timeline-status">{entry.status}</div>
        <div className="bk-timeline-meta">
          <span className="bk-timeline-actor"><User size={10}/> {entry.actor}</span>
          <span className="bk-timeline-time"><Clock size={10}/> {fmtDateTime(entry.at)}</span>
        </div>
        {entry.note && <div className="bk-timeline-note">{entry.note}</div>}
      </div>
    </div>
  );
}

// ── Flow stepper ─────────────────────────────────────────────
function FlowStepper({ current }) {
  if (current === 'Cancelled') return (
    <div className="bk-cancelled-banner"><XCircle size={14}/> This booking was cancelled</div>
  );
  const activeIdx = FLOW_STEPS.indexOf(current);
  return (
    <div className="bk-stepper">
      {FLOW_STEPS.map((step, i) => (
        <div key={step} className={`bk-step ${i < activeIdx?'done':''} ${i===activeIdx?'active':''}`}>
          <div className="bk-step-dot">
            {i < activeIdx ? <CheckCircle size={13}/> : <span>{i+1}</span>}
          </div>
          <div className="bk-step-label">{step}</div>
          {i < FLOW_STEPS.length-1 && <div className="bk-step-connector"/>}
        </div>
      ))}
    </div>
  );
}

// ── Action modal (next step in flow) ─────────────────────────
function ActionModal({ booking, actionDef, onConfirm, onClose }) {
  const [actor,     setActor]     = useState(STAFF_LIST[0]);
  const [note,      setNote]      = useState('');
  // payment fields
  const [payMethod, setPayMethod] = useState('Cash');
  const [payAmount, setPayAmount] = useState(booking.finalAmount || booking.itemPrice);
  // inspection fields
  const [condition, setCondition] = useState('Good');
  const [returnDeposit, setReturnDeposit] = useState(true);
  // fitting notes
  const [fittingNote, setFittingNote] = useState('');

  const isPayment    = booking.status === 'Awaiting Payment';
  const isInspection = booking.status === 'Under Inspection';
  const isFitting    = booking.status === 'Confirmed';

  const handle = () => {
    const payload = { actor, note };
    if (isPayment)    Object.assign(payload, { payMethod, payAmount });
    if (isInspection) Object.assign(payload, { condition, returnDeposit });
    if (isFitting)    payload.note = fittingNote || note;
    onConfirm(payload);
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <h3>{actionDef.label}</h3>
          <button className="inv-modal-close" onClick={onClose}><X size={15}/></button>
        </div>
        <div className="inv-modal-body">
          {/* Context card */}
          <div className="bk-action-context">
            <div className="bk-action-customer">{booking.customer}</div>
            <div className="bk-action-item">{booking.itemName}</div>
            <div className="bk-action-dates">{fmtDate(booking.rentalStart)} → {fmtDate(booking.rentalEnd)}</div>
          </div>

          {/* Staff selector */}
          <div className="inv-field">
            <label className="inv-field-label">Handled By ({actionDef.actorRole})</label>
            <select className="inv-input" value={actor} onChange={e => setActor(e.target.value)}>
              {STAFF_LIST.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Fitting-specific */}
          {isFitting && (
            <div className="inv-field">
              <label className="inv-field-label">Fitting Notes</label>
              <textarea className="inv-textarea" rows={2} value={fittingNote}
                onChange={e => setFittingNote(e.target.value)}
                placeholder="e.g. Fits well, no alterations / slight waist adjustment done"/>
            </div>
          )}

          {/* Payment-specific */}
          {isPayment && (
            <>
              <div className="inv-field">
                <label className="inv-field-label">Payment Method</label>
                <select className="inv-input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="inv-modal-grid">
                <div className="inv-field">
                  <label className="inv-field-label">Amount Received (₱)</label>
                  <input className="inv-input" type="number" value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}/>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Security Deposit (₱)</label>
                  <input className="inv-input" type="number" value={booking.depositAmount} readOnly style={{ opacity:0.6 }}/>
                </div>
              </div>
              <div className="bk-payment-summary">
                <div className="bk-ps-row"><span>Rental Fee</span><span>₱{booking.itemPrice.toLocaleString()}</span></div>
                {booking.promoDiscount > 0 && <div className="bk-ps-row discount"><span>Promo ({booking.promoCode})</span><span>-₱{booking.promoDiscount.toLocaleString()}</span></div>}
                <div className="bk-ps-row"><span>Security Deposit</span><span>₱{booking.depositAmount.toLocaleString()}</span></div>
                <div className="bk-ps-row total"><span>Total Due</span><span>₱{(booking.finalAmount + booking.depositAmount).toLocaleString()}</span></div>
              </div>
            </>
          )}

          {/* Inspection-specific */}
          {isInspection && (
            <>
              <div className="inv-field">
                <label className="inv-field-label">Item Condition</label>
                <div className="bk-condition-btns">
                  {['Good','Minor Damage','Major Damage'].map(c => (
                    <button key={c} className={`bk-condition-btn${condition===c?' active':''} ${c==='Good'?'good':c==='Minor Damage'?'minor':'major'}`}
                      onClick={() => setCondition(c)}>{c}</button>
                  ))}
                </div>
              </div>
              {condition === 'Major Damage' && (
                <div className="bk-damage-warning">
                  <AlertTriangle size={13}/> Item will be sent to <strong>Maintenance</strong>. Deposit will be forfeited.
                </div>
              )}
              <div className="inv-field" style={{ flexDirection:'row', alignItems:'center', gap:'0.6rem' }}>
                <input type="checkbox" id="dep" checked={condition!=='Major Damage'&&returnDeposit}
                  disabled={condition==='Major Damage'}
                  onChange={e => setReturnDeposit(e.target.checked)} style={{ accentColor:'#6b2d39' }}/>
                <label htmlFor="dep" className="inv-field-label" style={{ textTransform:'none', letterSpacing:0, margin:0 }}>
                  Return security deposit (₱{booking.depositAmount.toLocaleString()}) to customer
                </label>
              </div>
            </>
          )}

          {/* Generic notes */}
          {!isFitting && (
            <div className="inv-field">
              <label className="inv-field-label">Notes <span style={{ opacity:0.5, fontWeight:400 }}>(optional)</span></label>
              <textarea className="inv-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Any remarks…"/>
            </div>
          )}
        </div>
        <div className="inv-modal-footer">
          <button className="inv-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn-primary" style={{ background:actionDef.color }} onClick={handle}>
            <actionDef.icon size={13}/> {actionDef.label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New booking modal ────────────────────────────────────────
function NewBookingModal({ items, promos, onSave, onClose }) {
  const blank = {
    customer:'', contact:'', eventType:'Wedding',
    itemId:'', rentalStart:todayStr(), rentalEnd:'',
    fittingDate:'', fittingTime:'10:00',
    promoCode:'', depositAmount:500, notes:'',
  };
  const [form, setForm] = useState(blank);
  const f = v => setForm(p => ({...p, ...v}));

  const selectedItem = items.find(i => i.id === form.itemId);
  const activePromos = promos.filter(p => {
    const now = todayStr();
    return p.active && p.items.includes(form.itemId) && p.start <= now && p.end >= now;
  });
  const appliedPromo = promos.find(p => p.code === form.promoCode && p.items.includes(form.itemId));
  const discount     = appliedPromo ? (appliedPromo.type==='percentage' ? (selectedItem?.price||0)*(appliedPromo.value/100) : appliedPromo.value) : 0;
  const finalAmount  = (selectedItem?.price||0) - discount;

  const save = () => {
    if (!form.customer || !form.itemId || !form.rentalStart || !form.rentalEnd) return;
    onSave({
      ...form,
      id: `B${genId()}`, status:'Pending',
      itemName: selectedItem?.name||'',
      itemPrice: selectedItem?.price||0,
      promoDiscount: discount,
      finalAmount,
      paymentMethod: null,
      timeline:[{ status:'Pending', actor:'System', at: new Date().toISOString().replace('T',' ').slice(0,16), note: form.notes||'Booking submitted' }],
    });
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header"><h3>New Booking Request</h3><button className="inv-modal-close" onClick={onClose}><X size={15}/></button></div>
        <div className="inv-modal-body">
          <div className="inv-modal-grid">
            <div className="inv-field inv-field-full"><label className="inv-field-label">Customer Name *</label><input className="inv-input" value={form.customer} onChange={e => f({customer:e.target.value})} placeholder="Full name"/></div>
            <div className="inv-field"><label className="inv-field-label">Contact Number *</label><input className="inv-input" value={form.contact} onChange={e => f({contact:e.target.value})} placeholder="09xx-xxx-xxxx"/></div>
            <div className="inv-field"><label className="inv-field-label">Event Type</label>
              <select className="inv-input" value={form.eventType} onChange={e => f({eventType:e.target.value})}>
                {['Wedding','Debut','Prom','Corporate','Baptism','Birthday','Other'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="inv-field inv-field-full"><label className="inv-field-label">Select Item *</label>
              <select className="inv-input" value={form.itemId} onChange={e => f({itemId:e.target.value, promoCode:''})}>
                <option value="">— Choose an item —</option>
                {items.filter(i => i.status==='Available').map(i => <option key={i.id} value={i.id}>{i.name} — ₱{i.price.toLocaleString()}</option>)}
              </select>
            </div>
            {selectedItem && (
              <div className="inv-field inv-field-full">
                <div className="bk-selected-item-preview">
                  <MediaThumb item={selectedItem} className="bk-preview-thumb"/>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'0.875rem' }}>{selectedItem.name}</div>
                    <div style={{ fontSize:'0.78rem', color:'#888' }}>{selectedItem.category} · Size {selectedItem.size} · {selectedItem.color}</div>
                    <div style={{ fontSize:'0.825rem', fontWeight:600, color:'#6b2d39', marginTop:'0.2rem' }}>₱{selectedItem.price.toLocaleString()} / rental</div>
                  </div>
                </div>
              </div>
            )}
            <div className="inv-field"><label className="inv-field-label">Rental Start *</label><input className="inv-input" type="date" min={todayStr()} value={form.rentalStart} onChange={e => f({rentalStart:e.target.value})}/></div>
            <div className="inv-field"><label className="inv-field-label">Rental End *</label><input className="inv-input" type="date" min={form.rentalStart||todayStr()} value={form.rentalEnd} onChange={e => f({rentalEnd:e.target.value})}/></div>
            <div className="inv-field"><label className="inv-field-label">Fitting Date</label><input className="inv-input" type="date" min={todayStr()} value={form.fittingDate} onChange={e => f({fittingDate:e.target.value})}/></div>
            <div className="inv-field"><label className="inv-field-label">Fitting Time</label><input className="inv-input" type="time" value={form.fittingTime} onChange={e => f({fittingTime:e.target.value})}/></div>
            <div className="inv-field"><label className="inv-field-label">Security Deposit (₱)</label><input className="inv-input" type="number" value={form.depositAmount} onChange={e => f({depositAmount:Number(e.target.value)})}/></div>
            <div className="inv-field">
              <label className="inv-field-label">Promo Code</label>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <input className="inv-input" value={form.promoCode} onChange={e => f({promoCode:e.target.value.toUpperCase()})} placeholder="Optional" style={{ flex:1 }}/>
              </div>
              {activePromos.length > 0 && !appliedPromo && (
                <div className="bk-promo-hint">Available: {activePromos.map(p => <span key={p.id} className="bk-promo-chip" onClick={() => f({promoCode:p.code})}>{p.code}</span>)}</div>
              )}
              {appliedPromo && <div className="bk-promo-applied"><CheckCircle size={11}/> {appliedPromo.type==='percentage'?`${appliedPromo.value}%`:`₱${appliedPromo.value}`} discount applied</div>}
            </div>
          </div>
          {selectedItem && (
            <div className="bk-payment-summary">
              <div className="bk-ps-row"><span>Rental Fee</span><span>₱{selectedItem.price.toLocaleString()}</span></div>
              {discount > 0 && <div className="bk-ps-row discount"><span>Promo Discount</span><span>-₱{Math.round(discount).toLocaleString()}</span></div>}
              <div className="bk-ps-row"><span>Security Deposit</span><span>₱{form.depositAmount.toLocaleString()}</span></div>
              <div className="bk-ps-row total"><span>Total</span><span>₱{(Math.round(finalAmount)+form.depositAmount).toLocaleString()}</span></div>
            </div>
          )}
          <div className="inv-field"><label className="inv-field-label">Notes</label><textarea className="inv-textarea" rows={2} value={form.notes} onChange={e => f({notes:e.target.value})} placeholder="Any special requests…"/></div>
        </div>
        <div className="inv-modal-footer"><button className="inv-btn-ghost" onClick={onClose}>Cancel</button><button className="inv-btn-primary" onClick={save}>Create Booking</button></div>
      </div>
    </div>
  );
}

// ── Booking detail drawer ────────────────────────────────────
function BookingDrawer({ booking, onAction, onCancel, onClose }) {
  const actionDef = NEXT_ACTIONS[booking.status];
  const canCancel = CANCELLABLE.includes(booking.status);
  const item = SEED_ITEMS.find(i => i.id === booking.itemId);

  return (
    <div className="bk-drawer-overlay" onClick={onClose}>
      <div className="bk-drawer" onClick={e => e.stopPropagation()}>
        <div className="bk-drawer-header">
          <div>
            <div className="bk-drawer-id">#{booking.id}</div>
            <div className="bk-drawer-customer">{booking.customer}</div>
          </div>
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
            <BookingStatusBadge status={booking.status}/>
            <button className="inv-modal-close" onClick={onClose}><X size={15}/></button>
          </div>
        </div>

        <div className="bk-drawer-body">
          {/* Flow stepper */}
          <FlowStepper current={booking.status}/>

          {/* Item preview */}
          {item && (
            <div className="bk-detail-section">
              <div className="bk-section-label">Item</div>
              <div className="bk-item-row">
                <div style={{ width:56, height:56, borderRadius:8, overflow:'hidden', flexShrink:0, border:'1px solid #eeecea' }}>
                  <MediaThumb item={item} className="inv-list-thumb-inner"/>
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:'0.875rem' }}>{booking.itemName}</div>
                  <div style={{ fontSize:'0.78rem', color:'#888', marginTop:'0.15rem' }}>{item.category} · Size {item.size} · {item.color}</div>
                  <StatusBadge status={item.status} meta={ITEM_STATUS_META}/>
                </div>
              </div>
            </div>
          )}

          {/* Customer info */}
          <div className="bk-detail-section">
            <div className="bk-section-label">Customer</div>
            <div className="bk-info-grid">
              <div className="bk-info-row"><User size={12}/><span>{booking.customer}</span></div>
              <div className="bk-info-row"><Phone size={12}/><span>{booking.contact}</span></div>
              <div className="bk-info-row"><Calendar size={12}/><span>Event: {booking.eventType}</span></div>
            </div>
          </div>

          {/* Dates */}
          <div className="bk-detail-section">
            <div className="bk-section-label">Schedule</div>
            <div className="bk-dates-grid">
              <div className="bk-date-card"><div className="bk-date-label">Fitting</div><div className="bk-date-val">{fmtDate(booking.fittingDate)}<span className="bk-date-time">{booking.fittingTime}</span></div></div>
              <div className="bk-date-card"><div className="bk-date-label">Rental Start</div><div className="bk-date-val">{fmtDate(booking.rentalStart)}</div></div>
              <div className="bk-date-card"><div className="bk-date-label">Rental End</div><div className="bk-date-val">{fmtDate(booking.rentalEnd)}</div></div>
            </div>
          </div>

          {/* Payment summary */}
          <div className="bk-detail-section">
            <div className="bk-section-label">Payment</div>
            <div className="bk-payment-summary">
              <div className="bk-ps-row"><span>Rental Fee</span><span>₱{booking.itemPrice.toLocaleString()}</span></div>
              {booking.promoDiscount > 0 && <div className="bk-ps-row discount"><span>Promo ({booking.promoCode})</span><span>-₱{booking.promoDiscount.toLocaleString()}</span></div>}
              <div className="bk-ps-row"><span>Security Deposit</span><span>₱{booking.depositAmount.toLocaleString()}</span></div>
              <div className="bk-ps-row total"><span>Total</span><span>₱{(booking.finalAmount+booking.depositAmount).toLocaleString()}</span></div>
              {booking.paymentMethod && <div className="bk-ps-row"><span>Payment Method</span><span>{booking.paymentMethod}</span></div>}
            </div>
          </div>

          {/* Timeline */}
          <div className="bk-detail-section">
            <div className="bk-section-label">Activity Timeline</div>
            <div className="bk-timeline">
              {[...booking.timeline].reverse().map((entry, i) => (
                <TimelineEntry key={i} entry={entry} isLast={i === booking.timeline.length-1}/>
              ))}
            </div>
          </div>
        </div>

        {/* Action footer */}
        <div className="bk-drawer-footer">
          {canCancel && <button className="inv-btn-sm danger" onClick={() => onCancel(booking.id)}><XCircle size={12}/> Cancel Booking</button>}
          <div style={{ flex:1 }}/>
          {actionDef && booking.status !== 'Completed' && booking.status !== 'Cancelled' && (
            <button className="inv-btn-primary" style={{ background:actionDef.color }} onClick={() => onAction(booking, actionDef)}>
              <actionDef.icon size={13}/> {actionDef.label} <ChevronRight size={13}/>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// BOOKINGS FRAGMENT
// ════════════════════════════════════════════════════════════
export default function BookingsFragment() {
  const [items,    setItems]    = useState(SEED_ITEMS);
  const [bookings, setBookings] = useState(SEED_BOOKINGS);

  const [search,     setSearch]     = useState('');
  const [filterStat, setFilterStat] = useState('All');
  const [drawer,     setDrawer]     = useState(null);   // booking detail
  const [actionModal,setActionModal]= useState(null);   // { booking, actionDef }
  const [newModal,   setNewModal]   = useState(false);
  const [toast,      setToast]      = useState({ show:false, type:'success', message:'' });

  const showToast = (type, msg) => { setToast({ show:true, type, message:msg }); setTimeout(() => setToast({ show:false, type:'success', message:'' }), 3500); };

  // ── Advance booking to next status ──────────────────────────
  const advanceBooking = (booking, actionDef, payload) => {
    const now = new Date().toISOString().replace('T',' ').slice(0,16);
    const nextStatus = actionDef.next;

    setBookings(prev => prev.map(b => {
      if (b.id !== booking.id) return b;
      const updated = {
        ...b,
        status: nextStatus,
        timeline: [...b.timeline, {
          status: nextStatus,
          actor:  payload.actor,
          at:     now,
          note:   payload.note || '',
        }],
      };
      // Payment step extras
      if (booking.status === 'Awaiting Payment') {
        updated.paymentMethod = payload.payMethod;
      }
      return updated;
    }));

    // Update item status alongside booking
    const itemStatusMap = {
      'Confirmed':        'Reserved',
      'Paid / Released':  'Leased',
      'Returned':         'Under Inspection',
      'Completed':        payload.condition === 'Major Damage' ? 'Maintenance' : 'Ready for Rental',
      'Cancelled':        'Available',
    };
    if (itemStatusMap[nextStatus]) {
      setItems(prev => prev.map(i => i.id === booking.itemId ? { ...i, status:itemStatusMap[nextStatus] } : i));
    }

    setActionModal(null);
    if (drawer?.id === booking.id) setDrawer(prev => ({
      ...prev, status: nextStatus,
      timeline: [...prev.timeline, { status:nextStatus, actor:payload.actor, at:now, note:payload.note||'' }],
      ...(booking.status==='Awaiting Payment'?{paymentMethod:payload.payMethod}:{}),
    }));
    showToast('success', `Booking advanced to "${nextStatus}"`);
  };

  // ── Cancel booking ───────────────────────────────────────────
  const cancelBooking = (id) => {
    const now = new Date().toISOString().replace('T',' ').slice(0,16);
    const b = bookings.find(x => x.id === id);
    setBookings(prev => prev.map(x => x.id === id ? {
      ...x, status:'Cancelled',
      timeline:[...x.timeline,{ status:'Cancelled', actor:'Admin', at:now, note:'Booking cancelled' }],
    } : x));
    if (b) setItems(prev => prev.map(i => i.id === b.itemId ? { ...i, status:'Available' } : i));
    setDrawer(null);
    showToast('success','Booking cancelled.');
  };

  // ── New booking ──────────────────────────────────────────────
  const createBooking = (data) => {
    setBookings(p => [data, ...p]);
    setNewModal(false);
    showToast('success','Booking created!');
  };

  // ── Filtered list ────────────────────────────────────────────
  const displayed = useMemo(() => bookings.filter(b => {
    const q = search.toLowerCase();
    return (!q || b.customer.toLowerCase().includes(q) || b.itemName.toLowerCase().includes(q) || b.id.toLowerCase().includes(q))
      && (filterStat === 'All' || b.status === filterStat);
  }), [bookings, search, filterStat]);

  // ── Stats ────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    pending:    bookings.filter(b => b.status === 'Pending').length,
    active:     bookings.filter(b => ['Confirmed','For Fitting','Fitted','Awaiting Payment','Paid / Released','Active Lease'].includes(b.status)).length,
    returned:   bookings.filter(b => ['Returned','Under Inspection'].includes(b.status)).length,
    completed:  bookings.filter(b => b.status === 'Completed').length,
  }), [bookings]);

  return (
    <div className="bk-root">
      {/* Header */}
      <div className="inv-top">
        <div>
          <h2 className="inv-title">Bookings</h2>
          <p className="inv-subtitle">Manage the complete rental lifecycle — from request to return</p>
        </div>
        <button className="inv-btn-primary" onClick={() => setNewModal(true)}><Plus size={14}/> New Booking</button>
      </div>

      {/* Stats */}
      <div className="inv-stats">
        {[
          { label:'Pending Review',  value:stats.pending,   icon:Clock,         color:'#b45309' },
          { label:'Active',          value:stats.active,    icon:CheckCircle,   color:'#1d4ed8' },
          { label:'Awaiting Return', value:stats.returned,  icon:RotateCcw,     color:'#7c3aed' },
          { label:'Completed',       value:stats.completed, icon:Star,          color:'#15803d' },
        ].map(({ label, value, icon:Icon, color }) => (
          <div className="inv-stat-card" key={label}>
            <div className="inv-stat-icon" style={{ background:`${color}18`, color }}><Icon size={18}/></div>
            <div><div className="inv-stat-value">{value}</div><div className="inv-stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Flow legend */}
      <div className="bk-flow-legend">
        <span className="bk-flow-legend-label"><Shield size={11}/> Booking Flow:</span>
        {FLOW_STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <span className="bk-flow-chip" style={{ background:BOOKING_STATUS_META[s]?.bg, color:BOOKING_STATUS_META[s]?.color }}>{s}</span>
            {i < FLOW_STEPS.length-1 && <ChevronRight size={10} style={{ color:'#ccc', flexShrink:0 }}/>}
          </React.Fragment>
        ))}
      </div>

      {/* Toolbar */}
      <div className="inv-card">
        <div className="inv-toolbar" style={{ marginBottom:'0' }}>
          <div className="inv-search-wrap">
            <Search size={13} className="inv-search-icon"/>
            <input className="inv-search" placeholder="Search by customer, item, or booking ID…" value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <div className="inv-filters">
            <select className="inv-select" value={filterStat} onChange={e => setFilterStat(e.target.value)}>
              <option value="All">All Statuses</option>
              {Object.keys(BOOKING_STATUS_META).map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Bookings list */}
      <div className="bk-list">
        {displayed.length === 0 && (
          <div className="inv-card" style={{ textAlign:'center', padding:'3rem', color:'#bbb' }}>No bookings found.</div>
        )}
        {displayed.map(booking => {
          const actionDef = NEXT_ACTIONS[booking.status];
          const last = booking.timeline[booking.timeline.length-1];
          const isOverdue = booking.status === 'Active Lease' && booking.rentalEnd < todayStr();
          return (
            <div key={booking.id} className={`bk-card${isOverdue?' overdue':''}`} onClick={() => setDrawer(booking)}>
              <div className="bk-card-left">
                <div className="bk-card-avatar">{initials(booking.customer)}</div>
                <div className="bk-card-info">
                  <div className="bk-card-customer">{booking.customer}
                    {isOverdue && <span className="bk-overdue-badge"><AlertTriangle size={10}/> Overdue</span>}
                  </div>
                  <div className="bk-card-item">{booking.itemName}</div>
                  <div className="bk-card-meta">
                    <span><Calendar size={10}/> {fmtDate(booking.rentalStart)} — {fmtDate(booking.rentalEnd)}</span>
                    <span><User size={10}/> Last by: {last.actor}</span>
                  </div>
                </div>
              </div>
              <div className="bk-card-right">
                <BookingStatusBadge status={booking.status}/>
                <div className="bk-card-amount">₱{(booking.finalAmount+booking.depositAmount).toLocaleString()}</div>
                {actionDef && (
                  <button className="inv-btn-sm" style={{ background:actionDef.color, fontSize:'0.7rem' }}
                    onClick={e => { e.stopPropagation(); setActionModal({ booking, actionDef }); }}>
                    <actionDef.icon size={10}/> {actionDef.label}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer */}
      {drawer && (
        <BookingDrawer
          booking={drawer}
          onAction={(b, a) => setActionModal({ booking:b, actionDef:a })}
          onCancel={cancelBooking}
          onClose={() => setDrawer(null)}
        />
      )}

      {/* Action modal */}
      {actionModal && (
        <ActionModal
          booking={actionModal.booking}
          actionDef={actionModal.actionDef}
          onConfirm={payload => advanceBooking(actionModal.booking, actionModal.actionDef, payload)}
          onClose={() => setActionModal(null)}
        />
      )}

      {/* New booking modal */}
      {newModal && (
        <NewBookingModal
          items={items}
          promos={SEED_PROMOS}
          onSave={createBooking}
          onClose={() => setNewModal(false)}
        />
      )}

      <Toast toast={toast}/>
    </div>
  );
}