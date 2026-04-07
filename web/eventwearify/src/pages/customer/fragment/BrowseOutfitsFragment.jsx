// BrowseOutfitsFragment.jsx - Ultra-optimized for immediate display
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, ChevronDown, LayoutGrid, List, Eye, Calendar,
  CheckCircle, AlertCircle, X, ChevronLeft, ChevronRight,
  Play, Image, Sparkles, Clock, AlertTriangle,
  Loader2, ShoppingBag
} from 'lucide-react';
import '../../../components/css/customerDashboard/BrowseOutfitsFragment.css';
import { fetchItems, fetchPromotions, bookFitting, getUserBookings } from '../../../services/inventoryApi';

// ────────────────────────────────────────────────────────────
// Shared Data
// ────────────────────────────────────────────────────────────
const ITEM_STATUS_META = {
  'Available': { color: '#15803d', bg: 'rgba(21,128,61,0.1)', dot: '#22c55e' },
  'Leased': { color: '#b45309', bg: 'rgba(180,83,9,0.1)', dot: '#f59e0b' },
  'Maintenance': { color: '#991b1b', bg: 'rgba(153,27,27,0.1)', dot: '#ef4444' },
  'Reserved': { color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)', dot: '#3b82f6' }
};

const CAT_COLORS = { 
  'Gown': '#c4717f', 
  'Suit': '#6b2d39', 
  'Traditional': '#b45309', 
  'Accessories': '#486581' 
};

const todayStr = () => new Date().toISOString().split('T')[0];
const fmtDate = (date) => date ? new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const fmtDateTime = (date, time) => {
  if (!date) return '';
  return `${new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })} at ${time}`;
};

// ────────────────────────────────────────────────────────────
// UI Components
// ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const m = ITEM_STATUS_META[status] || { color: '#888', bg: 'rgba(0,0,0,0.06)', dot: '#888' };
  return (
    <span className="inv-badge" style={{ color: m.color, background: m.bg }}>
      <span className="inv-badge-dot" style={{ background: m.dot }} />
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
        <ShoppingBag size={28} style={{ color: bg, opacity: 0.45 }} />
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
  
  return (
    <img src={first.url} alt={item.name} className="inv-media-img" onClick={onClick} />
  );
}

function MediaGallery({ item, startIndex = 0, onClose }) {
  const files = item.mediaFiles?.length ? item.mediaFiles : [];
  const [idx, setIdx] = useState(startIndex);

  const prev = () => setIdx((idx - 1 + files.length) % files.length);
  const next = () => setIdx((idx + 1) % files.length);

  useEffect(() => {
    const h = e => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') onClose();
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
          <span className="inv-lightbox-catnote">{item.category}{item.subtype ? ` · ${item.subtype}` : ''} · Size {item.size}</span>
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
      const timer = setTimeout(() => onClose(), 4000);
      return () => clearTimeout(timer);
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

// Ultra-fast skeleton component - no animations, just static placeholders
function FastSkeletonCard() {
  return (
    <div className="inv-grid-card skeleton-fast">
      <div className="inv-grid-media skeleton-media-fast"></div>
      <div className="inv-grid-info">
        <div className="skeleton-text-fast" style={{ width: '70%', height: '16px', marginBottom: '8px' }}></div>
        <div className="skeleton-text-fast" style={{ width: '85%', height: '12px', marginBottom: '6px' }}></div>
        <div className="skeleton-text-fast" style={{ width: '40%', height: '14px' }}></div>
      </div>
      <div className="inv-grid-actions">
        <div className="skeleton-btn-fast"></div>
        <div className="skeleton-btn-fast" style={{ width: '100px' }}></div>
      </div>
    </div>
  );
}

function FastSkeletonRow() {
  return (
    <tr className="skeleton-row-fast">
      <td><div className="skeleton-thumb-fast"></div></td>
      <td><div className="skeleton-text-fast" style={{ width: '120px', height: '14px' }}></div></td>
      <td><div className="skeleton-text-fast" style={{ width: '60px', height: '12px' }}></div></td>
      <td><div className="skeleton-text-fast" style={{ width: '80px', height: '12px' }}></div></td>
      <td><div className="skeleton-text-fast" style={{ width: '40px', height: '12px' }}></div></td>
      <td><div className="skeleton-text-fast" style={{ width: '60px', height: '12px' }}></div></td>
      <td><div className="skeleton-badge-fast"></div></td>
      <td><div className="skeleton-btn-fast"></div><div className="skeleton-btn-fast"></div></td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────
// Main Component - Ultra-optimized
// ────────────────────────────────────────────────────────────
export default function BrowseOutfitsFragment() {
  const [items, setItems] = useState([]);
  const [promos, setPromos] = useState([]);
  const [userBookings, setUserBookings] = useState([]);
  const [isItemsLoaded, setIsItemsLoaded] = useState(false);
  const [isPromosLoaded, setIsPromosLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [filterSubcat, setFilterSubcat] = useState('All');
  const [filterSize, setFilterSize] = useState('All');

  const [selectedItem, setSelectedItem] = useState(null);
  const [modal, setModal] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
  
  // Get current user from localStorage - synchronous, happens immediately
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const authToken = useMemo(() => localStorage.getItem('accessToken') || localStorage.getItem('token'), []);
  const isLoggedIn = !!authToken;
  
  // Fitting booking form - initialized immediately
  const [booking, setBooking] = useState({
    fittingDate: '',
    fittingTime: '10:00 AM',
    name: currentUser.name || '',
    email: currentUser.email || '',
    phone: '',
    preferredSize: '',
    notes: ''
  });
  const [bookingConfirmed, setBookingConfirmed] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load data from backend - non-blocking, parallel loading
  useEffect(() => {
    // Load items
    fetchItems()
      .then(itemsData => {
        setItems(itemsData);
        setIsItemsLoaded(true);
      })
      .catch(err => {
        console.error('Error loading items:', err);
        setLoadError(err.message || 'Failed to load items.');
        setIsItemsLoaded(true);
      });
    
    // Load promotions in parallel
    fetchPromotions()
      .then(promosData => {
        setPromos(promosData);
        setIsPromosLoaded(true);
      })
      .catch(err => {
        console.error('Error loading promotions:', err);
        setIsPromosLoaded(true);
      });
    
    // Load user bookings if logged in
    if (isLoggedIn) {
      getUserBookings()
        .then(bookings => setUserBookings(bookings))
        .catch(err => console.error('Error loading user bookings:', err));
    }
  }, [isLoggedIn]);

  const showToast = (type, message) => setToast({ show: true, type, message });
  const closeToast = () => setToast({ show: false, type: 'success', message: '' });
  
  const closeModal = () => {
    setModal(null);
    setSelectedItem(null);
    setBookingConfirmed(null);
    setBooking({
      fittingDate: '',
      fittingTime: '10:00 AM',
      name: currentUser.name || '',
      email: currentUser.email || '',
      phone: '',
      preferredSize: '',
      notes: ''
    });
  };

  // Check if user has already booked this item - memoized for performance
  const hasUserBookedItem = useCallback((itemId) => {
    if (!userBookings.length) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return userBookings.some(booking => 
      String(booking.itemId) === String(itemId) && 
      booking.status === 'CONFIRMED' &&
      new Date(booking.fittingDate) >= today
    );
  }, [userBookings]);

  // Get user's booking for a specific item - memoized
  const getUserBookingForItem = useCallback((itemId) => {
    if (!userBookings.length) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return userBookings.find(booking => 
      String(booking.itemId) === String(itemId) && 
      booking.status === 'CONFIRMED' &&
      new Date(booking.fittingDate) >= today
    );
  }, [userBookings]);

  // Promo helpers - memoized for performance
  const activePromo = useCallback(item => {
    if (!isPromosLoaded || promos.length === 0) return null;
    const now = todayStr();
    const itemId = typeof item.id === 'string' ? parseInt(item.id) : item.id;
    
    const promo = promos.find(p => {
      if (!p.active) return false;
      if (!p.items || !p.items.length) return false;
      
      const promoItemIds = p.items.map(id => typeof id === 'string' ? parseInt(id) : id);
      const itemMatches = promoItemIds.includes(itemId);
      const dateValid = p.start <= now && p.end >= now;
      
      return itemMatches && dateValid;
    });
    
    return promo;
  }, [promos, isPromosLoaded]);

  const discPrice = useCallback(item => {
    const p = activePromo(item);
    if (!p) return item.price;
    
    let discountedPrice = item.price;
    if (p.type === 'percentage') {
      discountedPrice = item.price * (1 - p.value / 100);
    } else if (p.type === 'fixed' || p.type === 'amount') {
      discountedPrice = item.price - p.value;
    }
    
    return Math.max(0, discountedPrice);
  }, [activePromo]);

  // Get available items for filtering - memoized
  const availableItems = useMemo(() => 
    items.filter(i => i.status === 'Available' || i.status === 'Reserved'),
    [items]
  );
  
  // Get unique categories - memoized
  const categories = useMemo(() => 
    [...new Set(availableItems.map(i => i.category))],
    [availableItems]
  );
  
  // Get unique subcategories based on selected category - memoized
  const subcategories = useMemo(() => {
    if (filterCat === 'All') return [];
    return [...new Set(
      availableItems
        .filter(i => i.category === filterCat)
        .map(i => i.subtype)
        .filter(Boolean)
    )].sort();
  }, [availableItems, filterCat]);
  
  // Reset subcategory filter when category changes
  useEffect(() => {
    setFilterSubcat('All');
  }, [filterCat]);
  
  // Get unique sizes - memoized
  const sizes = useMemo(() => 
    [...new Set(availableItems.map(i => i.size))].sort(),
    [availableItems]
  );

  // Filter items - memoized for performance
  const visibleItems = useMemo(() => {
    return availableItems.filter(i => {
      const q = search.toLowerCase();
      return (!q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || (i.subtype || '').toLowerCase().includes(q))
        && (filterCat === 'All' || i.category === filterCat)
        && (filterSubcat === 'All' || i.subtype === filterSubcat)
        && (filterSize === 'All' || i.size === filterSize);
    });
  }, [availableItems, search, filterCat, filterSubcat, filterSize]);

  // Handle fitting booking submission
  const handleBookingSubmit = async () => {
    if (!isLoggedIn) {
      showToast('error', 'Please login first to book a fitting.');
      return;
    }
    
    if (!booking.fittingDate || !booking.fittingTime) {
      showToast('error', 'Please select a fitting date and time.');
      return;
    }
    if (!booking.name || !booking.email || !booking.phone) {
      showToast('error', 'Please fill in your contact information.');
      return;
    }
    
    const selectedDate = new Date(booking.fittingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      showToast('error', 'Fitting date cannot be in the past.');
      return;
    }
    
    if (hasUserBookedItem(selectedItem.id)) {
      const existingBooking = getUserBookingForItem(selectedItem.id);
      showToast('error', `You already have a fitting booked for ${selectedItem.name} on ${fmtDate(existingBooking.fittingDate)}.`);
      return;
    }

    setSubmitting(true);
    
    try {
      const bookingData = {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        fittingDate: booking.fittingDate,
        fittingTime: booking.fittingTime,
        customerName: booking.name,
        customerEmail: booking.email,
        customerPhone: booking.phone,
        preferredSize: booking.preferredSize || selectedItem.size,
        notes: booking.notes,
        userId: currentUser.id || null
      };
      
      const response = await bookFitting(bookingData);
      
      const confirmation = {
        id: response.bookingId || Math.floor(Math.random() * 10000),
        item: selectedItem,
        date: booking.fittingDate,
        time: booking.fittingTime,
        customerName: booking.name,
        customerEmail: booking.email,
        customerPhone: booking.phone,
        preferredSize: booking.preferredSize || selectedItem.size,
        notes: booking.notes,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };
      
      setBookingConfirmed(confirmation);
      
      const newBooking = {
        id: confirmation.id,
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        fittingDate: booking.fittingDate,
        fittingTime: booking.fittingTime,
        status: 'CONFIRMED'
      };
      setUserBookings(prev => [newBooking, ...prev]);
      
      showToast('success', 'Fitting booked successfully! Check your email for confirmation.');
    } catch (error) {
      console.error('Booking error:', error);
      showToast('error', error.message || 'Failed to book fitting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Show error state if needed
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

  // Show skeletons only for the items grid/table, not the whole page
  const showSkeletons = !isItemsLoaded;

  return (
    <div className="inv-root">
      {/* Header - displays immediately */}
      <div className="inv-top">
        <div>
          <h2 className="inv-title">Browse Our Collection</h2>
          <p className="inv-subtitle">Find the perfect attire for your upcoming events</p>
        </div>
        {!isLoggedIn && (
          <div className="inv-login-warning">
            <AlertCircle size={14} />
            <span>Please login to book a fitting</span>
          </div>
        )}
      </div>

      {/* Filters and Toolbar - displays immediately */}
      <div className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-search-wrap">
            <Search size={13} className="inv-search-icon" />
            <input 
              className="inv-search" 
              placeholder="Search items…" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
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
            <button className={`inv-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')}>
              <LayoutGrid size={15} />
            </button>
            <button className={`inv-view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>
              <List size={15} />
            </button>
          </div>
        </div>

        {/* GRID VIEW - with ultra-fast skeletons */}
        {viewMode === 'grid' && (
          <div className="inv-grid">
            {showSkeletons && (
              <>
                {[...Array(12)].map((_, i) => <FastSkeletonCard key={i} />)}
              </>
            )}
            
            {!showSkeletons && visibleItems.length === 0 && (
              <div className="inv-empty-grid">No items found.</div>
            )}
            
            {!showSkeletons && visibleItems.map(item => {
              const promo = activePromo(item);
              const price = discPrice(item);
              const files = item.mediaFiles?.length || 0;
              const alreadyBooked = hasUserBookedItem(item.id);
              const userBooking = getUserBookingForItem(item.id);
              
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
                    {alreadyBooked && (
                      <div className="inv-grid-booked-badge">
                        <CheckCircle size={10} /> Booked for {fmtDate(userBooking.fittingDate)}
                      </div>
                    )}
                  </div>
                  <div className="inv-grid-info">
                    <div className="inv-grid-name">{item.name}</div>
                    <div className="inv-grid-meta">
                      <span className="inv-cat-tag">{item.category}</span>
                      {item.subtype && <span className="inv-subtype-tag">{item.subtype}</span>}
                      <span className="inv-grid-size">{item.size}</span>
                    </div>
                    <div className="inv-grid-price-row">
                      {promo ? (
                        <>
                          <span className="inv-price-old">₱{item.price.toLocaleString()}</span>
                          <span className="inv-price-new">₱{Math.round(price).toLocaleString()}</span>
                        </>
                      ) : (
                        <span className="inv-price">₱{item.price.toLocaleString()}</span>
                      )}
                    </div>
                    {promo && (
                      <div className="inv-promo-code-pill">
                        <Sparkles size={9} />
                        <span>{promo.code}</span>
                      </div>
                    )}
                  </div>
                  <div className="inv-grid-actions">
                    <button className="inv-icon-btn" onClick={() => { setSelectedItem(item); setModal('view'); }}><Eye size={13} /></button>
                    <button 
                      className={`inv-btn-book ${alreadyBooked ? 'inv-btn-booked' : ''}`}
                      onClick={() => { 
                        if (alreadyBooked) {
                          showToast('error', `You already have a fitting booked for this item on ${fmtDate(userBooking.fittingDate)}.`);
                        } else {
                          setSelectedItem(item); 
                          setModal('booking');
                        }
                      }} 
                      disabled={item.status !== 'Available' || alreadyBooked || !isLoggedIn}
                    >
                      <Calendar size={13} /> 
                      {alreadyBooked ? 'Already Booked' : 'Book Fitting'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW - FIXED VERSION */}
        {viewMode === 'list' && (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ width: 72 }}>Photo</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th style={{ width: 160 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {showSkeletons && (
                  <>
                    {[...Array(8)].map((_, i) => <FastSkeletonRow key={i} />)}
                  </>
                )}
                
                {!showSkeletons && visibleItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="inv-empty">No items found.</td>
                  </tr>
                )}
                
                {!showSkeletons && visibleItems.map(item => {
                  const promo = activePromo(item);
                  const price = discPrice(item);
                  const alreadyBooked = hasUserBookedItem(item.id);
                  const userBooking = getUserBookingForItem(item.id);
                  
                  return (
                    <tr key={item.id} className={`inv-tr${promo ? ' inv-tr-promo' : ''}`}>
                      <td>
                        <div className="inv-list-thumb" onClick={() => setGallery({ item, startIndex: 0 })}>
                          <MediaThumb item={item} />
                        </div>
                      </td>
                      <td>
                        <div className="inv-item-name">{item.name}</div>
                        {promo && (
                          <div className="inv-list-promo-badge">
                            <Sparkles size={9} />
                            <span>{promo.code}</span>
                          </div>
                        )}
                        {alreadyBooked && (
                          <div className="inv-list-booked-badge">
                            <CheckCircle size={10} /> Booked for {fmtDate(userBooking.fittingDate)}
                          </div>
                        )}
                      </td>
                      <td><span className="inv-cat-tag">{item.category}</span></td>
                      <td><span className="inv-subtype-tag">{item.subtype}</span></td>
                      <td>{item.size}</td>
                      <td>
                        {promo ? (
                          <div>
                            <div className="inv-price-old">₱{item.price.toLocaleString()}</div>
                            <div className="inv-price-new">₱{Math.round(price).toLocaleString()}</div>
                          </div>
                        ) : (
                          <span className="inv-price">₱{item.price.toLocaleString()}</span>
                        )}
                      </td>
                      <td><StatusBadge status={item.status} /></td>
                      <td>
                        <div className="inv-row-actions">
                          <button className="inv-icon-btn" onClick={() => { setSelectedItem(item); setModal('view'); }}><Eye size={13} /></button>
                          <button 
                            className={`inv-btn-book-sm ${alreadyBooked ? 'inv-btn-booked' : ''}`}
                            onClick={() => {
                              if (alreadyBooked) {
                                showToast('error', `You already have a fitting booked for this item on ${fmtDate(userBooking.fittingDate)}.`);
                              } else {
                                setSelectedItem(item); 
                                setModal('booking');
                              }
                            }} 
                            disabled={item.status !== 'Available' || alreadyBooked || !isLoggedIn}
                          >
                            <Calendar size={12} /> {alreadyBooked ? 'Booked' : 'Book Fitting'}
                          </button>
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
        const alreadyBooked = hasUserBookedItem(selectedItem.id);
        const userBooking = getUserBookingForItem(selectedItem.id);
        
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h4 className="inv-view-name">{selectedItem.name}</h4>
                    <StatusBadge status={selectedItem.status} />
                  </div>
                  {promo && (
                    <div className="inv-view-promo-banner">
                      <Sparkles size={14} />
                      <div>
                        <div className="inv-view-promo-banner-title">Promo Active: <strong>{promo.code}</strong></div>
                        <div className="inv-view-promo-banner-sub">
                          {promo.type === 'percentage' ? `${promo.value}% discount applied` : `₱${promo.value} flat discount applied`}
                        </div>
                      </div>
                      <div className="inv-view-promo-banner-price">
                        <span className="inv-view-promo-was">₱{selectedItem.price.toLocaleString()}</span>
                        <span className="inv-view-promo-now">₱{Math.round(price).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                  {alreadyBooked && (
                    <div className="inv-view-booked-warning">
                      <CheckCircle size={14} />
                      <span>You have already booked a fitting for this item on <strong>{fmtDate(userBooking.fittingDate)}</strong>.</span>
                    </div>
                  )}
                  <div className="inv-view-grid">
                    {[
                      ['Category', selectedItem.category],
                      ['Type', selectedItem.subtype],
                      ['Size', selectedItem.size],
                      ['Color', selectedItem.color],
                      ['Age Range', selectedItem.ageRange],
                      ['Daily Rate', promo ? 
                        <><span style={{ textDecoration: 'line-through', color: '#bbb', marginRight: '0.4rem' }}>₱{selectedItem.price.toLocaleString()}</span>
                        <strong style={{ color: '#15803d' }}>₱{Math.round(price).toLocaleString()}</strong></> : 
                        `₱${selectedItem.price.toLocaleString()}`
                      ],
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
                <button 
                  className="inv-btn-primary" 
                  onClick={() => {
                    if (alreadyBooked) {
                      showToast('error', `You already have a fitting booked for this item on ${fmtDate(userBooking.fittingDate)}.`);
                      closeModal();
                    } else {
                      setModal('booking');
                    }
                  }} 
                  disabled={selectedItem.status !== 'Available' || alreadyBooked || !isLoggedIn}
                >
                  <Calendar size={14} /> 
                  {alreadyBooked ? 'Already Booked' : 'Book Fitting'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* BOOKING FITTING MODAL */}
      {modal === 'booking' && selectedItem && !bookingConfirmed && (() => {
        const alreadyBooked = hasUserBookedItem(selectedItem.id);
        
        if (alreadyBooked) {
          const userBooking = getUserBookingForItem(selectedItem.id);
          setTimeout(() => {
            closeModal();
            showToast('error', `You already have a fitting booked for ${selectedItem.name} on ${fmtDate(userBooking.fittingDate)}.`);
          }, 100);
          return null;
        }
        
        const promo = activePromo(selectedItem);
        
        return (
          <div className="inv-overlay" onClick={closeModal}>
            <div className="inv-modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
              <div className="inv-modal-header">
                <h3>Book a Fitting - {selectedItem.name}</h3>
                <button className="inv-modal-close" onClick={closeModal} disabled={submitting}><X size={16} /></button>
              </div>
              
              <div className="inv-modal-body">
                <div className="inv-lease-item-preview">
                  <div className="inv-lease-preview-thumb">
                    <MediaThumb item={selectedItem} />
                  </div>
                  <div>
                    <div className="inv-lease-preview-name">{selectedItem.name}</div>
                    <div className="inv-lease-preview-price">
                      {promo ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: '#bbb', marginRight: '0.3rem' }}>
                            ₱{selectedItem.price.toLocaleString()}
                          </span>
                          ₱{Math.round(discPrice(selectedItem)).toLocaleString()}/day
                        </>
                      ) : (
                        `₱${selectedItem.price.toLocaleString()}/day`
                      )}
                    </div>
                    {promo && (
                      <div className="inv-promo-code-pill" style={{ marginTop: '0.25rem' }}>
                        <Sparkles size={8} /> {promo.code}
                      </div>
                    )}
                  </div>
                </div>

                <div className="inv-warning-box">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Important:</strong> If you don't arrive at the scheduled time, your fitting may be cancelled. 
                    Please arrive 10 minutes early.
                  </div>
                </div>

                <div className="inv-modal-grid">
                  <div className="inv-field">
                    <label className="inv-field-label">Fitting Date <span className="inv-required">*</span></label>
                    <input
                      className="inv-input"
                      type="date"
                      min={todayStr()}
                      value={booking.fittingDate}
                      onChange={e => setBooking(p => ({ ...p, fittingDate: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                  <div className="inv-field">
                    <label className="inv-field-label">Fitting Time <span className="inv-required">*</span></label>
                    <select
                      className="inv-select"
                      value={booking.fittingTime}
                      onChange={e => setBooking(p => ({ ...p, fittingTime: e.target.value }))}
                      disabled={submitting}
                    >
                      <option value="10:00 AM">10:00 AM</option>
                      <option value="11:00 AM">11:00 AM</option>
                      <option value="1:00 PM">1:00 PM</option>
                      <option value="2:00 PM">2:00 PM</option>
                      <option value="3:00 PM">3:00 PM</option>
                      <option value="4:00 PM">4:00 PM</option>
                      <option value="5:00 PM">5:00 PM</option>
                    </select>
                  </div>
                </div>

                <div className="inv-field">
                  <label className="inv-field-label">Full Name <span className="inv-required">*</span></label>
                  <input
                    className="inv-input"
                    type="text"
                    placeholder="Enter your full name"
                    value={booking.name}
                    onChange={e => setBooking(p => ({ ...p, name: e.target.value }))}
                    disabled={submitting}
                  />
                </div>
                
                <div className="inv-modal-grid">
                  <div className="inv-field">
                    <label className="inv-field-label">Email <span className="inv-required">*</span></label>
                    <input
                      className="inv-input"
                      type="email"
                      placeholder="you@example.com"
                      value={booking.email}
                      onChange={e => setBooking(p => ({ ...p, email: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                  <div className="inv-field">
                    <label className="inv-field-label">Phone <span className="inv-required">*</span></label>
                    <input
                      className="inv-input"
                      type="tel"
                      placeholder="0912 345 6789"
                      value={booking.phone}
                      onChange={e => setBooking(p => ({ ...p, phone: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="inv-field">
                  <label className="inv-field-label">Preferred Size</label>
                  <select
                    className="inv-select"
                    value={booking.preferredSize}
                    onChange={e => setBooking(p => ({ ...p, preferredSize: e.target.value }))}
                    disabled={submitting}
                  >
                    <option value="">Select size (optional)</option>
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                  </select>
                </div>
                
                <div className="inv-field">
                  <label className="inv-field-label">Special Requests</label>
                  <textarea
                    className="inv-textarea"
                    rows={3}
                    placeholder="Any special requests or questions about the fitting?"
                    value={booking.notes}
                    onChange={e => setBooking(p => ({ ...p, notes: e.target.value }))}
                    disabled={submitting}
                  />
                </div>

                <div className="bk-payment-summary">
                  <div className="bk-ps-row total" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                    <span><strong>Fitting Summary</strong></span>
                  </div>
                  <div className="bk-ps-row">
                    <span>Item</span>
                    <span>{selectedItem.name}</span>
                  </div>
                  <div className="bk-ps-row">
                    <span>Fitting Date</span>
                    <span>{booking.fittingDate ? fmtDate(booking.fittingDate) : '—'}</span>
                  </div>
                  <div className="bk-ps-row">
                    <span>Fitting Time</span>
                    <span>{booking.fittingTime || '—'}</span>
                  </div>
                  <div className="bk-ps-row" style={{ fontSize: '0.7rem', color: '#999', justifyContent: 'center', marginTop: '0.5rem' }}>
                    * Fitting is FREE and no obligation to rent
                  </div>
                </div>
              </div>
              
              <div className="inv-modal-footer">
                <button className="inv-btn-ghost" onClick={closeModal} disabled={submitting}>Cancel</button>
                <button 
                  className="inv-btn-primary" 
                  onClick={handleBookingSubmit} 
                  disabled={submitting || !booking.fittingDate || !booking.fittingTime || !booking.name || !booking.email || !booking.phone}
                >
                  {submitting ? <><Loader2 size={14} className="inv-spinner-inline" /> Submitting...</> : <>Confirm Fitting</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* BOOKING CONFIRMATION MODAL */}
      {modal === 'booking' && bookingConfirmed && (
        <div className="inv-overlay" onClick={closeModal}>
          <div className="inv-modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="inv-modal-header" style={{ background: '#15803d08', borderBottomColor: '#15803d20' }}>
              <h3 style={{ color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                  <div className="inv-booking-detail-row">
                    <span className="inv-booking-label">Booking ID:</span>
                    <span className="inv-booking-value">#FT-{bookingConfirmed.id}</span>
                  </div>
                  <div className="inv-booking-detail-row">
                    <span className="inv-booking-label">Item:</span>
                    <span className="inv-booking-value">{bookingConfirmed.item.name}</span>
                  </div>
                  <div className="inv-booking-detail-row">
                    <span className="inv-booking-label">Fitting Date & Time:</span>
                    <span className="inv-booking-value">{fmtDateTime(bookingConfirmed.date, bookingConfirmed.time)}</span>
                  </div>
                  <div className="inv-booking-detail-row">
                    <span className="inv-booking-label">Customer:</span>
                    <span className="inv-booking-value">{bookingConfirmed.customerName}</span>
                  </div>
                </div>

                <div className="inv-reminder-box">
                  <Clock size={14} />
                  <div>
                    <strong>Reminder:</strong> Please arrive 10 minutes before your scheduled time. 
                    If you need to reschedule, please contact us at least 24 hours in advance.
                  </div>
                </div>
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="inv-btn-primary" onClick={closeModal}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Lightbox */}
      {gallery && <MediaGallery item={gallery.item} startIndex={gallery.startIndex} onClose={() => setGallery(null)} />}

      {/* Toast */}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}