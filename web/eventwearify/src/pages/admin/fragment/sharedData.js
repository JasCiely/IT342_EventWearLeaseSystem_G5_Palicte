// ════════════════════════════════════════════════════════════
// sharedData.js  — single source of truth for both fragments
// Place at: src/pages/admin/fragment/sharedData.js
// ════════════════════════════════════════════════════════════

// ── Category → Subtypes map ──────────────────────────────────
// Admin can also type a custom subtype via "Others"
export const CATEGORY_MAP = {
  Gown:   ['Ball Gown', 'Pageant Gown', 'A-Line Gown', 'Mermaid Gown', 'Empire Gown', 'Others'],
  Suit:   ['Tuxedo', 'Business Suit', '3-Piece Suit', 'Slim Fit Suit', 'Others'],
  Barong: ['Barong Tagalog', 'Embroidered Barong', 'Piña Barong', 'Jusi Barong', 'Others'],
  Terno:  ['Modern Terno', 'Traditional Terno', 'Butterfly Sleeve Terno', 'Others'],
  Blazer: ['Single Button', 'Double Breasted', 'Structured', 'Casual Blazer', 'Others'],
  Dress:  ['Mini Dress', 'Midi Dress', 'Maxi Dress', 'Cocktail Dress', 'Wrap Dress', 'Others'],
  Vest:   ['Formal Vest', 'Sequin Vest', 'Embroidered Vest', 'Others'],
};

export const CATEGORIES = Object.keys(CATEGORY_MAP);

export const SIZES  = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
export const COLORS = ['Ivory', 'Black', 'Navy', 'Burgundy', 'Champagne', 'Emerald', 'Rose Gold', 'Silver'];

export const CAT_COLORS = {
  Gown:'#c4717f', Suit:'#1d4ed8', Barong:'#15803d',
  Terno:'#6b2d39', Blazer:'#b45309', Dress:'#e879a0', Vest:'#0e7490',
};

// Item availability — driven by booking flow
// NOTE: 'Ready for Rental' is system-set ONLY (after inspection passes).
// It is intentionally excluded from the manual Edit Item status dropdown.
export const ITEM_STATUS_META = {
  'Available':         { color:'#15803d', bg:'rgba(21,128,61,0.08)',   dot:'#15803d' },
  'Reserved':          { color:'#1d4ed8', bg:'rgba(29,78,216,0.08)',   dot:'#1d4ed8' },
  'Leased':            { color:'#b45309', bg:'rgba(180,83,9,0.08)',    dot:'#b45309' },
  'Awaiting Return':   { color:'#dc2626', bg:'rgba(220,38,38,0.08)',   dot:'#dc2626' },
  'Under Inspection':  { color:'#7c3aed', bg:'rgba(124,58,237,0.08)', dot:'#7c3aed' },
  'Ready for Rental':  { color:'#0e7490', bg:'rgba(14,116,144,0.08)', dot:'#0e7490' }, // display only
  'Maintenance':       { color:'#9a3412', bg:'rgba(154,52,18,0.08)',   dot:'#9a3412' },
};

// Statuses admin can manually set in Edit Item (Ready for Rental excluded)
export const MANUAL_ITEM_STATUSES = [
  'Available', 'Reserved', 'Leased', 'Awaiting Return', 'Under Inspection', 'Maintenance',
];

// Booking lifecycle
export const BOOKING_STATUS_META = {
  'Pending':           { color:'#b45309', bg:'rgba(180,83,9,0.08)',    dot:'#b45309',  step:1 },
  'Confirmed':         { color:'#1d4ed8', bg:'rgba(29,78,216,0.08)',   dot:'#1d4ed8',  step:2 },
  'For Fitting':       { color:'#7c3aed', bg:'rgba(124,58,237,0.08)', dot:'#7c3aed',  step:3 },
  'Fitted':            { color:'#0e7490', bg:'rgba(14,116,144,0.08)', dot:'#0e7490',  step:4 },
  'Awaiting Payment':  { color:'#c4717f', bg:'rgba(196,113,127,0.08)',dot:'#c4717f',  step:5 },
  'Paid / Released':   { color:'#15803d', bg:'rgba(21,128,61,0.08)',   dot:'#15803d',  step:6 },
  'Active Lease':      { color:'#b45309', bg:'rgba(180,83,9,0.08)',    dot:'#b45309',  step:7 },
  'Returned':          { color:'#7c3aed', bg:'rgba(124,58,237,0.08)', dot:'#7c3aed',  step:8 },
  'Under Inspection':  { color:'#9a3412', bg:'rgba(154,52,18,0.08)',   dot:'#9a3412',  step:9 },
  'Completed':         { color:'#15803d', bg:'rgba(21,128,61,0.08)',   dot:'#15803d',  step:10 },
  'Cancelled':         { color:'#6b7280', bg:'rgba(107,114,128,0.08)',dot:'#6b7280',  step:0 },
};

export const STAFF_LIST      = ['Maria Santos', 'Jose Reyes', 'Ana dela Cruz', 'Mark Bautista', 'Admin'];
export const PAYMENT_METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Credit Card'];

export const todayStr    = () => new Date().toISOString().split('T')[0];
export const fmtDate     = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—';
export const fmtDateTime = d => d ? new Date(d).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
export const genId       = () => `${Date.now().toString(36).toUpperCase()}`;
export const initials    = name => name ? name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) : '??';

// Items now include `subtype` field
export const SEED_ITEMS = [
  { id:'I001', name:'Ivory Lace Ballgown',    category:'Gown',   subtype:'Ball Gown',         size:'M',  color:'Ivory',     price:1200, status:'Available',        media:null, mediaType:null, description:'Elegant floor-length ballgown with intricate lace overlay and cathedral train.' },
  { id:'I002', name:'Midnight Tuxedo Set',    category:'Suit',   subtype:'Tuxedo',             size:'L',  color:'Black',     price:950,  status:'Leased',           media:null, mediaType:null, description:'Classic black tuxedo with satin lapels and matching tailored trousers.' },
  { id:'I003', name:'Champagne Off-Shoulder', category:'Gown',   subtype:'A-Line Gown',        size:'S',  color:'Champagne', price:1500, status:'Reserved',         media:null, mediaType:null, description:'Glamorous off-shoulder gown in warm champagne tone with beaded waist.' },
  { id:'I004', name:'Navy Barong Tagalog',    category:'Barong', subtype:'Barong Tagalog',      size:'XL', color:'Navy',      price:600,  status:'Available',        media:null, mediaType:null, description:'Handcrafted barong with authentic piña fabric and detailed embroidery.' },
  { id:'I005', name:'Emerald Terno Gown',     category:'Terno',  subtype:'Modern Terno',       size:'M',  color:'Emerald',   price:1800, status:'Maintenance',      media:null, mediaType:null, description:'Traditional terno with modern silhouette in rich emerald green silk.' },
  { id:'I006', name:'Burgundy Blazer',        category:'Blazer', subtype:'Structured',         size:'S',  color:'Burgundy',  price:700,  status:'Awaiting Return',  media:null, mediaType:null, description:'Structured single-button blazer in deep burgundy with gold buttons.' },
  { id:'I007', name:'Rose Gold Mini Dress',   category:'Dress',  subtype:'Mini Dress',         size:'XS', color:'Rose Gold', price:850,  status:'Ready for Rental', media:null, mediaType:null, description:'Sleek metallic mini dress with subtle shimmer and open back.' },
  { id:'I008', name:'Silver Sequin Vest',     category:'Vest',   subtype:'Sequin Vest',        size:'L',  color:'Silver',    price:450,  status:'Available',        media:null, mediaType:null, description:'Eye-catching sequin vest perfect for formal events and galas.' },
  { id:'I009', name:'Pearl Pageant Gown',     category:'Gown',   subtype:'Pageant Gown',       size:'M',  color:'Ivory',     price:2200, status:'Available',        media:null, mediaType:null, description:'Stunning pageant gown with pearl embellishments and dramatic train.' },
];

export const SEED_PROMOS = [
  { id:'P001', code:'MARCH20', type:'percentage', value:20,  items:['I001','I003','I007','I009'], start:'2026-03-01', end:'2026-03-31', active:true },
  { id:'P002', code:'FLAT500', type:'flat',       value:500, items:['I002','I004'],               start:'2026-03-15', end:'2026-04-15', active:true },
];

export const SEED_BOOKINGS = [
  {
    id:'B001', itemId:'I002', itemName:'Midnight Tuxedo Set', itemPrice:950,
    customer:'Juan dela Cruz', contact:'09171234567', eventType:'Wedding',
    rentalStart:'2026-03-01', rentalEnd:'2026-03-08',
    fittingDate:'2026-02-25', fittingTime:'10:00',
    status:'Active Lease', promoCode:null, promoDiscount:0, depositAmount:500,
    finalAmount:950, paymentMethod:'Cash',
    timeline:[
      { status:'Pending',          actor:'System',        at:'2026-02-10 09:00', note:'Customer submitted online' },
      { status:'Confirmed',        actor:'Maria Santos',  at:'2026-02-10 10:30', note:'Confirmed via phone call' },
      { status:'For Fitting',      actor:'Maria Santos',  at:'2026-02-25 10:00', note:'Customer arrived on time' },
      { status:'Fitted',           actor:'Jose Reyes',    at:'2026-02-25 10:45', note:'Fits well, no alterations needed' },
      { status:'Awaiting Payment', actor:'Jose Reyes',    at:'2026-02-25 11:00', note:'Ready for payment' },
      { status:'Paid / Released',  actor:'Ana dela Cruz', at:'2026-02-28 14:00', note:'Cash payment received. Item released.' },
      { status:'Active Lease',     actor:'System',        at:'2026-03-01 00:00', note:'Rental period started' },
    ],
  },
  {
    id:'B002', itemId:'I003', itemName:'Champagne Off-Shoulder', itemPrice:1500,
    customer:'Maria Santos', contact:'09281234567', eventType:'Debut',
    rentalStart:'2026-03-10', rentalEnd:'2026-03-17',
    fittingDate:'2026-03-06', fittingTime:'14:00',
    status:'Fitted', promoCode:'MARCH20', promoDiscount:300, depositAmount:500,
    finalAmount:1200, paymentMethod:null,
    timeline:[
      { status:'Pending',     actor:'System',        at:'2026-02-28 08:00', note:'Walk-in booking' },
      { status:'Confirmed',   actor:'Ana dela Cruz', at:'2026-02-28 08:30', note:'Confirmed and fitting scheduled' },
      { status:'For Fitting', actor:'Ana dela Cruz', at:'2026-03-06 14:00', note:'Customer on time' },
      { status:'Fitted',      actor:'Maria Santos',  at:'2026-03-06 15:00', note:'Slight waist adjustment done' },
    ],
  },
  {
    id:'B003', itemId:'I006', itemName:'Burgundy Blazer', itemPrice:700,
    customer:'Ana Reyes', contact:'09391234567', eventType:'Corporate',
    rentalStart:'2026-02-20', rentalEnd:'2026-02-28',
    fittingDate:'2026-02-18', fittingTime:'11:00',
    status:'Returned', promoCode:null, promoDiscount:0, depositAmount:300,
    finalAmount:700, paymentMethod:'GCash',
    timeline:[
      { status:'Pending',          actor:'System',        at:'2026-02-12 09:00', note:'' },
      { status:'Confirmed',        actor:'Mark Bautista', at:'2026-02-12 10:00', note:'' },
      { status:'For Fitting',      actor:'Mark Bautista', at:'2026-02-18 11:00', note:'' },
      { status:'Fitted',           actor:'Mark Bautista', at:'2026-02-18 11:40', note:'Good fit' },
      { status:'Awaiting Payment', actor:'Mark Bautista', at:'2026-02-18 12:00', note:'' },
      { status:'Paid / Released',  actor:'Admin',         at:'2026-02-19 16:00', note:'GCash confirmed ₱700 + ₱300 deposit' },
      { status:'Active Lease',     actor:'System',        at:'2026-02-20 00:00', note:'' },
      { status:'Returned',         actor:'Jose Reyes',    at:'2026-02-28 15:30', note:'Customer returned on time' },
    ],
  },
  {
    id:'B004', itemId:'I001', itemName:'Ivory Lace Ballgown', itemPrice:1200,
    customer:'Claire Gonzales', contact:'09451234567', eventType:'Wedding',
    rentalStart:'2026-03-15', rentalEnd:'2026-03-22',
    fittingDate:'2026-03-12', fittingTime:'09:00',
    status:'Pending', promoCode:'MARCH20', promoDiscount:240, depositAmount:500,
    finalAmount:960, paymentMethod:null,
    timeline:[
      { status:'Pending', actor:'System', at:'2026-03-05 08:00', note:'Online booking request' },
    ],
  },
  {
    id:'B005', itemId:'I007', itemName:'Rose Gold Mini Dress', itemPrice:850,
    customer:'Sofia Lim', contact:'09561234567', eventType:'Prom',
    rentalStart:'2026-02-15', rentalEnd:'2026-02-22',
    fittingDate:'2026-02-12', fittingTime:'13:00',
    status:'Completed', promoCode:null, promoDiscount:0, depositAmount:300,
    finalAmount:850, paymentMethod:'Bank Transfer',
    timeline:[
      { status:'Pending',          actor:'System',        at:'2026-02-01 10:00', note:'' },
      { status:'Confirmed',        actor:'Maria Santos',  at:'2026-02-01 11:00', note:'' },
      { status:'For Fitting',      actor:'Maria Santos',  at:'2026-02-12 13:00', note:'' },
      { status:'Fitted',           actor:'Jose Reyes',    at:'2026-02-12 13:50', note:'Perfect fit' },
      { status:'Awaiting Payment', actor:'Jose Reyes',    at:'2026-02-12 14:00', note:'' },
      { status:'Paid / Released',  actor:'Ana dela Cruz', at:'2026-02-14 10:00', note:'Bank transfer verified' },
      { status:'Active Lease',     actor:'System',        at:'2026-02-15 00:00', note:'' },
      { status:'Returned',         actor:'Maria Santos',  at:'2026-02-22 16:00', note:'Returned clean, no damage' },
      { status:'Under Inspection', actor:'Jose Reyes',    at:'2026-02-22 16:30', note:'Inspecting...' },
      { status:'Completed',        actor:'Jose Reyes',    at:'2026-02-22 17:00', note:'No damage. Deposit returned. Item → Ready for Rental.' },
    ],
  },
];