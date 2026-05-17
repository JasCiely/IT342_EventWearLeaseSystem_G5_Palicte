// ════════════════════════════════════════════════════════════
// sharedData.js — Shared constants and data
// Inventory: Uses real backend API
// Bookings: Uses seed data (for now)
// ════════════════════════════════════════════════════════════

// ── API Configuration ─────────────────────────────────────────
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// ── Categories & Subtypes ─────────────────────────────────────
export const CATEGORY_MAP = {
  Gown: [
    // Wedding
    'Wedding Gown',
    'Ball Gown',
    'A-Line Gown',
    'Mermaid Gown',
    'Empire Gown',
    'Sheath Gown',
    'Tea-Length Gown',
    'Trumpet Gown',
    // Pageant & Formal
    'Pageant Gown',
    'Evening Gown',
    'Prom Gown',
    'Debut Gown',
    'Quinceanera Gown',
    // Special Styles
    'Off-Shoulder Gown',
    'Halter Gown',
    'Backless Gown',
    'Two-Piece Gown',
    'Cape Gown',
    'Others',
  ],

  Suit: [
    // Classic Cuts
    'Tuxedo',
    '2-Piece Suit',
    '3-Piece Suit',
    'Business Suit',
    // Fit Styles
    'Slim Fit Suit',
    'Classic Fit Suit',
    'Tailored Suit',
    // Occasion
    'Wedding Suit',
    'Prom Suit',
    'Barong Suit (Formal)',
    // Special
    'White Suit',
    'Pinstripe Suit',
    'Velvet Suit',
    'Others',
  ],

  Barong: [
    // Fabric Types
    'Barong Tagalog (Piña)',
    'Barong Tagalog (Jusi)',
    'Barong Tagalog (Cocoon)',
    'Barong Tagalog (Organza)',
    'Barong Tagalog (Linen)',
    // Style
    'Embroidered Barong',
    'Plain Barong',
    'Short-Sleeve Barong',
    'Long-Sleeve Barong',
    // Occasion
    'Wedding Barong',
    'Debut Barong (Escort)',
    'Formal Event Barong',
    'Kids Barong',
    'Others',
  ],

  Terno: [
    // Traditional
    'Traditional Terno',
    'Maria Clara',
    'Filipiniana Dress',
    // Modern
    'Modern Terno',
    'Butterfly Sleeve Terno',
    'Contemporary Filipiniana',
    // Occasion
    'Wedding Terno',
    'Debut Terno',
    'Formal Terno',
    'Casual Terno',
    'Others',
  ],

  Blazer: [
    // Button Style
    'Single Button Blazer',
    'Double Breasted Blazer',
    // Fit & Cut
    'Fitted Blazer',
    'Structured Blazer',
    'Oversized Blazer',
    'Cropped Blazer',
    // Occasion
    'Formal Blazer',
    'Casual Blazer',
    'Wedding Blazer',
    'Corporate Blazer',
    // Special
    'Sequin Blazer',
    'Velvet Blazer',
    'Embroidered Blazer',
    'Others',
  ],

  Dress: [
    // Length
    'Mini Dress',
    'Midi Dress',
    'Maxi Dress',
    // Style
    'Cocktail Dress',
    'Wrap Dress',
    'A-Line Dress',
    'Bodycon Dress',
    'Shift Dress',
    'Fit & Flare Dress',
    'Slip Dress',
    // Occasion
    'Wedding Guest Dress',
    'Prom Dress',
    'Debut Guest Dress',
    'Formal Dress',
    'Party Dress',
    // Special
    'Lace Dress',
    'Sequin Dress',
    'Floral Dress',
    'Off-Shoulder Dress',
    'Others',
  ],

  Vest: [
    // Formal
    'Formal Vest',
    'Waistcoat',
    'Suit Vest',
    // Special
    'Sequin Vest',
    'Embroidered Vest',
    'Velvet Vest',
    'Satin Vest',
    // Occasion
    'Wedding Vest',
    'Prom Vest',
    'Others',
  ],
};

export const CATEGORIES = Object.keys(CATEGORY_MAP);

// ── Sizes & Colors ────────────────────────────────────────────
export const SIZES  = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
export const COLORS = ['Ivory', 'Black', 'Navy', 'Burgundy', 'Champagne', 'Emerald', 'Rose Gold', 'Silver'];

// ── Color Swatches (for Inventory UI) ────────────────────────
export const COLOR_SWATCHES = {
  Ivory:      '#fffff0',
  Black:      '#1a1a1a',
  Navy:       '#001f5b',
  Burgundy:   '#6b2d39',
  Champagne:  '#f7e7ce',
  Emerald:    '#50c878',
  'Rose Gold':'#b76e79',
  Silver:     '#c0c0c0',
};

export const LIGHT_COLORS = ['Ivory', 'Champagne', 'Silver'];

// ── Category Colors ───────────────────────────────────────────
export const CAT_COLORS = {
  Gown:   '#c4717f',
  Suit:   '#1d4ed8',
  Barong: '#15803d',
  Terno:  '#6b2d39',
  Blazer: '#b45309',
  Dress:  '#e879a0',
  Vest:   '#0e7490',
};

// ── Item Status Metadata ──────────────────────────────────────
export const ITEM_STATUS_META = {
  'Available':            { color: '#15803d', bg: 'rgba(21,128,61,0.08)',  dot: '#15803d' },
  'Under Maintenance':    { color: '#9a3412', bg: 'rgba(154,52,18,0.1)',  dot: '#ea580c' },
  'Pending Availability': { color: '#b45309', bg: 'rgba(180,83,9,0.1)',   dot: '#f59e0b' },
};

export const MANUAL_ITEM_STATUSES = ['Available', 'Under Maintenance', 'Pending Availability'];

// ── Booking Status Metadata ───────────────────────────────────
export const BOOKING_STATUS_META = {
  'Pending':           { color: '#b45309', bg: 'rgba(180,83,9,0.08)',    dot: '#b45309',  step: 1 },
  'Confirmed':         { color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)',   dot: '#1d4ed8',  step: 2 },
  'For Fitting':       { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  dot: '#7c3aed',  step: 3 },
  'Fitted':            { color: '#0e7490', bg: 'rgba(14,116,144,0.08)',  dot: '#0e7490',  step: 4 },
  'Awaiting Payment':  { color: '#c4717f', bg: 'rgba(196,113,127,0.08)', dot: '#c4717f',  step: 5 },
  'Paid / Released':   { color: '#15803d', bg: 'rgba(21,128,61,0.08)',   dot: '#15803d',  step: 6 },
  'Active Lease':      { color: '#b45309', bg: 'rgba(180,83,9,0.08)',    dot: '#b45309',  step: 7 },
  'Returned':          { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  dot: '#7c3aed',  step: 8 },
  'Under Inspection':  { color: '#9a3412', bg: 'rgba(154,52,18,0.08)',   dot: '#9a3412',  step: 9 },
  'Completed':         { color: '#15803d', bg: 'rgba(21,128,61,0.08)',   dot: '#15803d',  step: 10 },
  'Cancelled':         { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', dot: '#6b7280',  step: 0 },
};

// ── Booking-related Constants ─────────────────────────────────
export const STAFF_LIST      = ['Maria Santos', 'Jose Reyes', 'Ana dela Cruz', 'Mark Bautista', 'Admin'];
export const PAYMENT_METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Credit Card'];

// ── Date Helpers ──────────────────────────────────────────────
export const todayStr    = () => new Date().toISOString().split('T')[0];
export const fmtDate     = d => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
export const fmtDateTime = d => d ? new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const genId       = () => `${Date.now().toString(36).toUpperCase()}`;
export const initials    = name => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??';

// ── Auth Helper ───────────────────────────────────────────────
export const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

// ── Leasing & Pricing Utilities ──────────────────────────────
export const getLeasingSettings = () => {
  const saved = localStorage.getItem('leasingSettings');
  return saved ? JSON.parse(saved) : {
    minLeaseDays: 2,
    weeklyDiscount: 100,
    monthlyDiscountCap: 300
  };
};

export const calculateLeasePricing = (dailyRate, startDate, endDate) => {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end - start;
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both dates

  if (totalDays < 0) return null;

  const settings = getLeasingSettings();
  const basePrice = dailyRate * totalDays;

  // Calculate discount: weekly discount accumulates, capped at monthly cap
  const weeks = Math.floor(totalDays / 7);
  const weeklyDiscountAmount = weeks * settings.weeklyDiscount;
  const discount = Math.min(weeklyDiscountAmount, settings.monthlyDiscountCap);
  const finalPrice = basePrice - discount;

  return {
    totalDays,
    basePrice,
    discount,
    finalPrice,
    weeks,
    minLeaseDays: settings.minLeaseDays,
    isValid: totalDays >= settings.minLeaseDays,
    savingsText: weeks > 0 ? `You saved ₱${discount} for ${weeks} week${weeks > 1 ? 's' : ''}` : ''
  };
};