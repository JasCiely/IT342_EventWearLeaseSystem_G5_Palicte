// BrowseOutfitsFragment.jsx - Integrated with Strategy & Decorator Patterns
import React, { useState, useEffect, useCallback, useMemo, startTransition } from 'react';
import {
  Search, LayoutGrid, List, Eye, Calendar,
  CheckCircle, AlertCircle, X, ChevronLeft, ChevronRight,
  Play, Sparkles, Clock, AlertTriangle, Percent, DollarSign,
  Loader2, ShoppingBag
} from 'lucide-react';
import '../../../components/css/customerDashboard/BrowseOutfitsFragment.css';
import { 
  fetchItems, 
  fetchPromotions, 
  bookFitting, 
  getUserBookings,
  calculateRentalPrice 
} from '../../../services/inventoryApi';

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

// Strategy Pattern: Rental duration options
const RENTAL_STRATEGIES = {
  daily: { 
    name: 'Daily Rate', 
    discount: 0, 
    multiplier: 1,
    description: 'Best for short-term events'
  },
  weekly: { 
    name: 'Weekly Rate', 
    discount: 15, 
    multiplier: 7,
    description: '15% off • Best for week-long events'
  },
  monthly: { 
    name: 'Monthly Rate', 
    discount: 30, 
    multiplier: 30,
    description: '30% off • Best for long-term rentals'
  }
};

const todayStr = () => new Date().toISOString().split('T')[0];
const fmtDate = (date) => date ? new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const fmtDateTime = (date, time) => {
  if (!date) return '';
  return `${new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })} at ${time}`;
};

const EMPTY_ARRAY = [];

// ────────────────────────────────────────────────────────────
// Optimized UI Components (memoized)
// ────────────────────────────────────────────────────────────
const StatusBadge = React.memo(({ status }) => {
  const m = ITEM_STATUS_META[status] || { color: '#888', bg: 'rgba(0,0,0,0.06)', dot: '#888' };
  return (
    <span className="inv-badge" style={{ color: m.color, background: m.bg }}>
      <span className="inv-badge-dot" style={{ background: m.dot }} />
      {status}
    </span>
  );
});

const MediaThumb = React.memo(({ item, onClick }) => {
  const files = item.mediaFiles?.length ? item.mediaFiles : EMPTY_ARRAY;
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
    <img src={first.url} alt={item.name} className="inv-media-img" onClick={onClick} loading="lazy" />
  );
});

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

// Ultra-fast skeleton components
const FastSkeletonCard = () => (
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

const FastSkeletonRow = () => (
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

// Optimized Grid Card Component
const GridCard = React.memo(({ 
  item, promoCode, discountValueText, finalPrice, originalPrice, 
  discountActive, alreadyBooked, userBooking, rentalStrategy,
  onView, onBook, onImageClick, onRentalStrategyChange 
}) => {
  const files = item.mediaFiles?.length || 0;
  
  // Calculate rental price based on selected strategy (Decorator + Strategy combined)
  const getRentalPrice = () => {
    let price = originalPrice;
    
    // Apply promotion discount first (Decorator pattern)
    if (discountActive && finalPrice) {
      price = finalPrice;
    }
    
    // Apply rental duration discount (Strategy pattern)
    if (rentalStrategy && rentalStrategy !== 'daily') {
      const strategy = RENTAL_STRATEGIES[rentalStrategy];
      if (strategy && strategy.discount > 0) {
        price = price * (1 - strategy.discount / 100);
      }
    }
    
    return Math.round(price);
  };
  
  const rentalPrice = getRentalPrice();
  const hasRentalDiscount = rentalStrategy !== 'daily';
  const rentalStrategyInfo = RENTAL_STRATEGIES[rentalStrategy];
  
  return (
    <div className="inv-grid-card">
      <div className="inv-grid-media" onClick={() => files && onImageClick(item, 0)}>
        <MediaThumb item={item} />
        <div className="inv-grid-media-overlay"><Eye size={16} /> View</div>
        <div className="inv-grid-status-pin"><StatusBadge status={item.status} /></div>
        {discountActive && discountValueText && (
          <div className="inv-grid-promo-ribbon">
            <Sparkles size={9} />
            {discountValueText}
          </div>
        )}
        {alreadyBooked && userBooking && (
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
        
        {/* Rental Strategy Selector */}
        <div className="inv-rental-strategy-selector">
          <select 
            className="inv-strategy-select"
            value={rentalStrategy}
            onChange={(e) => onRentalStrategyChange(item.id, e.target.value)}
            disabled={alreadyBooked}
          >
            <option value="daily">Daily Rate</option>
            <option value="weekly">Weekly Rate (15% off)</option>
            <option value="monthly">Monthly Rate (30% off)</option>
          </select>
        </div>
        
        <div className="inv-grid-price-row">
          {hasRentalDiscount || discountActive ? (
            <>
              <span className="inv-price-old">
                ₱{Math.round(originalPrice).toLocaleString()}/day
              </span>
              <span className="inv-price-new">
                ₱{rentalPrice.toLocaleString()}/day
              </span>
              {hasRentalDiscount && (
                <span className="inv-rental-badge">
                  {rentalStrategyInfo?.discount}% off
                </span>
              )}
            </>
          ) : (
            <span className="inv-price">₱{Math.round(originalPrice).toLocaleString()}/day</span>
          )}
        </div>
        
        {promoCode && (
          <div className="inv-promo-code-pill">
            <Sparkles size={9} />
            <span>{promoCode}</span>
          </div>
        )}
        
        {rentalStrategy !== 'daily' && (
          <div className="inv-strategy-desc">
            <Percent size={8} />
            <span>{rentalStrategyInfo?.description}</span>
          </div>
        )}
      </div>
      <div className="inv-grid-actions">
        <button className="inv-icon-btn" onClick={() => onView(item)}><Eye size={13} /></button>
        <button 
          className={`inv-btn-book ${alreadyBooked ? 'inv-btn-booked' : ''}`}
          onClick={() => onBook(item, rentalStrategy)} 
          disabled={item.status !== 'Available' || alreadyBooked}
        >
          <Calendar size={13} /> 
          {alreadyBooked ? 'Already Booked' : 'Book Fitting'}
        </button>
      </div>
    </div>
  );
});

// Optimized List Row Component
const ListRow = React.memo(({ 
  item, promoCode, finalPrice, originalPrice, discountActive, 
  alreadyBooked, userBooking, rentalStrategy,
  onView, onBook, onImageClick, onRentalStrategyChange 
}) => {
  const getRentalPrice = () => {
    let price = originalPrice;
    if (discountActive && finalPrice) price = finalPrice;
    if (rentalStrategy && rentalStrategy !== 'daily') {
      const strategy = RENTAL_STRATEGIES[rentalStrategy];
      if (strategy && strategy.discount > 0) {
        price = price * (1 - strategy.discount / 100);
      }
    }
    return Math.round(price);
  };
  
  const rentalPrice = getRentalPrice();
  const hasRentalDiscount = rentalStrategy !== 'daily';
  
  return (
    <tr className={`inv-tr${discountActive || hasRentalDiscount ? ' inv-tr-promo' : ''}`}>
      <td>
        <div className="inv-list-thumb" onClick={() => onImageClick(item, 0)}>
          <MediaThumb item={item} />
        </div>
      </td>
      <td>
        <div className="inv-item-name">{item.name}</div>
        {promoCode && (
          <div className="inv-list-promo-badge">
            <Sparkles size={9} />
            <span>{promoCode}</span>
          </div>
        )}
        {alreadyBooked && userBooking && (
          <div className="inv-list-booked-badge">
            <CheckCircle size={10} /> Booked for {fmtDate(userBooking.fittingDate)}
          </div>
        )}
        {/* Rental Strategy Selector for list view */}
        <div className="inv-list-strategy-selector">
          <select 
            className="inv-strategy-select-sm"
            value={rentalStrategy}
            onChange={(e) => onRentalStrategyChange(item.id, e.target.value)}
            disabled={alreadyBooked}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly (-15%)</option>
            <option value="monthly">Monthly (-30%)</option>
          </select>
        </div>
      </td>
      <td><span className="inv-cat-tag">{item.category}</span></td>
      <td><span className="inv-subtype-tag">{item.subtype}</span></td>
      <td>{item.size}</td>
      <td>
        {discountActive || hasRentalDiscount ? (
          <div>
            <div className="inv-price-old">₱{Math.round(originalPrice).toLocaleString()}/day</div>
            <div className="inv-price-new">₱{rentalPrice.toLocaleString()}/day</div>
          </div>
        ) : (
          <span className="inv-price">₱{Math.round(originalPrice).toLocaleString()}/day</span>
        )}
      </td>
      <td><StatusBadge status={item.status} /></td>
      <td>
        <div className="inv-row-actions">
          <button className="inv-icon-btn" onClick={() => onView(item)}><Eye size={13} /></button>
          <button 
            className={`inv-btn-book-sm ${alreadyBooked ? 'inv-btn-booked' : ''}`}
            onClick={() => onBook(item, rentalStrategy)} 
            disabled={item.status !== 'Available' || alreadyBooked}
          >
            <Calendar size={12} /> {alreadyBooked ? 'Booked' : 'Book'}
          </button>
        </div>
      </td>
    </tr>
  );
});

// ────────────────────────────────────────────────────────────
// Main Component - Integrated with Strategy & Decorator Patterns
// ────────────────────────────────────────────────────────────
export default function BrowseOutfitsFragment() {
  // State
  const [items, setItems] = useState([]);
  const [promos, setPromos] = useState([]);
  const [userBookings, setUserBookings] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  
  // Strategy Pattern: Store selected rental strategy per item
  const [rentalStrategies, setRentalStrategies] = useState(() => ({}));

  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [filterSubcat, setFilterSubcat] = useState('All');
  const [filterSize, setFilterSize] = useState('All');

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedRentalStrategy, setSelectedRentalStrategy] = useState('daily');
  const [modal, setModal] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
  
  // Get current user
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const authToken = useMemo(() => localStorage.getItem('accessToken') || localStorage.getItem('token'), []);
  const isLoggedIn = !!authToken;
  
  // Booking form state
  const [booking, setBooking] = useState({
    fittingDate: '',
    fittingTime: '10:00 AM',
    rentalDays: 1,
    rentalStrategy: 'daily',
    name: currentUser.name || '',
    email: currentUser.email || '',
    phone: '',
    preferredSize: '',
    notes: ''
  });
  const [bookingConfirmed, setBookingConfirmed] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  // Create a promo map for O(1) lookup
  const promoMap = useMemo(() => {
    const map = new Map();
    promos.forEach(promo => {
      map.set(promo.code, promo);
    });
    return map;
  }, [promos]);

  // Pre-process items with computed values
  const processedItems = useMemo(() => {
    return items.map(item => {
      const discountApplied = item.discountApplied;
      const discountActive = discountApplied !== null && discountApplied !== undefined;
      const promo = discountActive ? promoMap.get(discountApplied) : null;
      
      let discountValueText = null;
      if (promo) {
        discountValueText = promo.type === 'percentage' 
          ? `${promo.value}% off` 
          : `₱${promo.value} off`;
      }
      
      return {
        ...item,
        discountActive,
        promoCode: discountApplied,
        discountValueText,
        finalPrice: item.finalPrice || item.price,
        originalPrice: item.price,
      };
    });
  }, [items, promoMap]);

  // Load data with Promise.all
  useEffect(() => {
    Promise.all([
      fetchItems(),
      fetchPromotions(),
      isLoggedIn ? getUserBookings() : Promise.resolve([])
    ])
      .then(([itemsData, promosData, bookingsData]) => {
        startTransition(() => {
          setItems(itemsData);
          setPromos(promosData);
          if (isLoggedIn) setUserBookings(bookingsData);
          setIsLoaded(true);
        });
      })
      .catch(err => {
        console.error('Error loading data:', err);
        startTransition(() => {
          setLoadError(err.message || 'Failed to load items.');
          setIsLoaded(true);
        });
      });
  }, [isLoggedIn]);

  // Handle rental strategy change for an item
  const handleRentalStrategyChange = useCallback(async (itemId, strategy) => {
    setRentalStrategies(prev => ({ ...prev, [itemId]: strategy }));
    
    // Optional: Call backend to get calculated price with Strategy pattern
    const item = processedItems.find(i => i.id === itemId);
    if (item) {
      setCalculatingPrice(true);
      try {
        const days = strategy === 'daily' ? 1 : (strategy === 'weekly' ? 7 : 30);
        const priceResult = await calculateRentalPrice(itemId, strategy, days);
        console.log(`Strategy ${strategy} price for ${item.name}: ₱${priceResult.finalPrice}/day`);
      } catch (error) {
        console.error('Error calculating rental price:', error);
      } finally {
        setCalculatingPrice(false);
      }
    }
  }, [processedItems]);

  // Get user's rental strategy for an item
  const getItemRentalStrategy = useCallback((itemId) => {
    return rentalStrategies[itemId] || 'daily';
  }, [rentalStrategies]);

  // Calculate total rental price based on strategy and promotion (Decorator + Strategy)
  const calculateTotalPrice = useCallback((item, rentalDays, rentalStrategy) => {
    let basePrice = item.finalPrice || item.price;
    
    // Apply Strategy pattern discount
    if (rentalStrategy === 'weekly') {
      const weeks = Math.ceil(rentalDays / 7);
      return basePrice * 7 * 0.85 * weeks;
    } else if (rentalStrategy === 'monthly') {
      const months = Math.ceil(rentalDays / 30);
      return basePrice * 30 * 0.70 * months;
    }
    
    return basePrice * rentalDays;
  }, []);

  // Booked items tracking
  const bookedItemIds = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const set = new Set();
    userBookings.forEach(booking => {
      if (booking.status === 'CONFIRMED' && new Date(booking.fittingDate) >= today) {
        set.add(String(booking.itemId));
      }
    });
    return set;
  }, [userBookings]);

  const hasUserBookedItem = useCallback((itemId) => {
    return bookedItemIds.has(String(itemId));
  }, [bookedItemIds]);

  const getUserBookingForItem = useCallback((itemId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return userBookings.find(booking => 
      String(booking.itemId) === String(itemId) && 
      booking.status === 'CONFIRMED' &&
      new Date(booking.fittingDate) >= today
    );
  }, [userBookings]);

  // Filters
  const categories = useMemo(() => {
    const cats = new Set();
    processedItems.forEach(i => {
      if (i.status === 'Available' || i.status === 'Reserved') {
        cats.add(i.category);
      }
    });
    return ['All', ...Array.from(cats)];
  }, [processedItems]);
  
  const getSubcategories = useCallback((category) => {
    if (category === 'All') return ['All'];
    const subs = new Set();
    processedItems.forEach(i => {
      if ((i.status === 'Available' || i.status === 'Reserved') && i.category === category && i.subtype) {
        subs.add(i.subtype);
      }
    });
    return ['All', ...Array.from(subs).sort()];
  }, [processedItems]);
  
  const subcategories = useMemo(() => getSubcategories(filterCat), [getSubcategories, filterCat]);
  
  const sizes = useMemo(() => {
    const sizeSet = new Set();
    processedItems.forEach(i => {
      if (i.status === 'Available' || i.status === 'Reserved') {
        sizeSet.add(i.size);
      }
    });
    return ['All', ...Array.from(sizeSet).sort()];
  }, [processedItems]);

  // Filter items
  const visibleItems = useMemo(() => {
    const searchLower = search.toLowerCase();
    return processedItems.filter(i => {
      if (i.status !== 'Available' && i.status !== 'Reserved') return false;
      
      if (searchLower) {
        const matchesSearch = i.name.toLowerCase().includes(searchLower) || 
                             i.category.toLowerCase().includes(searchLower) || 
                             (i.subtype || '').toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      if (filterCat !== 'All' && i.category !== filterCat) return false;
      if (filterSubcat !== 'All' && i.subtype !== filterSubcat) return false;
      if (filterSize !== 'All' && i.size !== filterSize) return false;
      
      return true;
    });
  }, [processedItems, search, filterCat, filterSubcat, filterSize]);

  const showToast = useCallback((type, message) => {
    setToast({ show: true, type, message });
  }, []);

  const closeToast = useCallback(() => {
    setToast({ show: false, type: 'success', message: '' });
  }, []);
  
  const closeModal = useCallback(() => {
    setModal(null);
    setSelectedItem(null);
    setBookingConfirmed(null);
    setBooking({
      fittingDate: '',
      fittingTime: '10:00 AM',
      rentalDays: 1,
      rentalStrategy: 'daily',
      name: currentUser.name || '',
      email: currentUser.email || '',
      phone: '',
      preferredSize: '',
      notes: ''
    });
  }, [currentUser.name, currentUser.email]);

  // Handle booking submission with Strategy pattern
  const handleBookingSubmit = useCallback(async () => {
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
      // Calculate total price using Strategy pattern
      const totalPrice = calculateTotalPrice(selectedItem, booking.rentalDays, booking.rentalStrategy);
      const strategyInfo = RENTAL_STRATEGIES[booking.rentalStrategy];
      
      const bookingData = {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        fittingDate: booking.fittingDate,
        fittingTime: booking.fittingTime,
        rentalDays: booking.rentalDays,
        rentalStrategy: booking.rentalStrategy,
        rentalStrategyName: strategyInfo?.name || 'Daily Rate',
        rentalDiscount: strategyInfo?.discount || 0,
        totalPrice: totalPrice,
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
        rentalDays: booking.rentalDays,
        rentalStrategy: booking.rentalStrategy,
        totalPrice: totalPrice,
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
      
      showToast('success', `Fitting booked successfully! Total: ₱${Math.round(totalPrice).toLocaleString()}`);
    } catch (error) {
      console.error('Booking error:', error);
      showToast('error', error.message || 'Failed to book fitting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [isLoggedIn, booking, selectedItem, currentUser, hasUserBookedItem, getUserBookingForItem, showToast, calculateTotalPrice]);

  const handleViewItem = useCallback((item) => {
    setSelectedItem(item);
    setModal('view');
  }, []);

  const handleBookItem = useCallback((item, rentalStrategy) => {
    setSelectedItem(item);
    setSelectedRentalStrategy(rentalStrategy);
    setBooking(prev => ({ ...prev, rentalStrategy }));
    setModal('booking');
  }, []);

  const handleImageClick = useCallback((item, index) => {
    if (item.mediaFiles?.length) {
      setGallery({ item, startIndex: index });
    }
  }, []);

  // Error state
  if (loadError && isLoaded) {
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

  const showSkeletons = !isLoaded;

  return (
    <div className="inv-root">
      {/* Header */}
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

      {/* Filters and Toolbar */}
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
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            
            {filterCat !== 'All' && subcategories.length > 1 && (
              <select className="inv-select" value={filterSubcat} onChange={e => setFilterSubcat(e.target.value)}>
                {subcategories.map(s => <option key={s}>{s}</option>)}
              </select>
            )}
            
            <select className="inv-select" value={filterSize} onChange={e => setFilterSize(e.target.value)}>
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

        {/* GRID VIEW */}
        {viewMode === 'grid' && (
          <div className="inv-grid">
            {showSkeletons && [...Array(12)].map((_, i) => <FastSkeletonCard key={i} />)}
            
            {!showSkeletons && visibleItems.length === 0 && (
              <div className="inv-empty-grid">No items found.</div>
            )}
            
            {!showSkeletons && visibleItems.map(item => {
              const alreadyBooked = hasUserBookedItem(item.id);
              const userBooking = alreadyBooked ? getUserBookingForItem(item.id) : null;
              const itemRentalStrategy = getItemRentalStrategy(item.id);
              
              return (
                <GridCard
                  key={item.id}
                  item={item}
                  promoCode={item.promoCode}
                  discountValueText={item.discountValueText}
                  finalPrice={item.finalPrice}
                  originalPrice={item.originalPrice}
                  discountActive={item.discountActive}
                  alreadyBooked={alreadyBooked}
                  userBooking={userBooking}
                  rentalStrategy={itemRentalStrategy}
                  onView={handleViewItem}
                  onBook={handleBookItem}
                  onImageClick={handleImageClick}
                  onRentalStrategyChange={handleRentalStrategyChange}
                />
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
                  <th style={{ width: 72 }}>Photo</th>
                  <th>Name & Options</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th style={{ width: 160 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {showSkeletons && [...Array(8)].map((_, i) => <FastSkeletonRow key={i} />)}
                
                {!showSkeletons && visibleItems.length === 0 && (
                  <tr><td colSpan={8} className="inv-empty">No items found.</td></tr>
                )}
                
                {!showSkeletons && visibleItems.map(item => {
                  const alreadyBooked = hasUserBookedItem(item.id);
                  const userBooking = alreadyBooked ? getUserBookingForItem(item.id) : null;
                  const itemRentalStrategy = getItemRentalStrategy(item.id);
                  
                  return (
                    <ListRow
                      key={item.id}
                      item={item}
                      promoCode={item.promoCode}
                      finalPrice={item.finalPrice}
                      originalPrice={item.originalPrice}
                      discountActive={item.discountActive}
                      alreadyBooked={alreadyBooked}
                      userBooking={userBooking}
                      rentalStrategy={itemRentalStrategy}
                      onView={handleViewItem}
                      onBook={handleBookItem}
                      onImageClick={handleImageClick}
                      onRentalStrategyChange={handleRentalStrategyChange}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW MODAL */}
      {modal === 'view' && selectedItem && (
        <div className="inv-overlay" onClick={closeModal}>
          <div className="inv-modal inv-modal-view" onClick={e => e.stopPropagation()}>
            <div className="inv-modal-header">
              <h3>Item Details</h3>
              <button className="inv-modal-close" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="inv-modal-body">
              <div className="inv-view-media" onClick={() => handleImageClick(selectedItem, 0)}>
                <MediaThumb item={selectedItem} />
                <div className="inv-view-media-overlay"><Eye size={17} /> View Full</div>
              </div>
              <div className="inv-view-details">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h4 className="inv-view-name">{selectedItem.name}</h4>
                  <StatusBadge status={selectedItem.status} />
                </div>
                
                {selectedItem.discountActive && selectedItem.discountValueText && (
                  <div className="inv-view-promo-banner">
                    <Sparkles size={14} />
                    <div>
                      <div className="inv-view-promo-banner-title">Promo Active: <strong>{selectedItem.discountValueText}</strong></div>
                      <div className="inv-view-promo-banner-sub">Promo Code: {selectedItem.promoCode}</div>
                    </div>
                    <div className="inv-view-promo-banner-price">
                      <span className="inv-view-promo-was">₱{selectedItem.originalPrice.toLocaleString()}</span>
                      <span className="inv-view-promo-now">₱{Math.round(selectedItem.finalPrice).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                
                <div className="inv-view-grid">
                  {[
                    ['Category', selectedItem.category],
                    ['Type', selectedItem.subtype],
                    ['Size', selectedItem.size],
                    ['Color', selectedItem.color],
                    ['Age Range', selectedItem.ageRange],
                    ['Base Daily Rate', `₱${selectedItem.originalPrice.toLocaleString()}`],
                    ...(selectedItem.discountActive ? [['Promo Daily Rate', `₱${Math.round(selectedItem.finalPrice).toLocaleString()}`]] : []),
                  ].map(([k, v]) => v && (
                    <div key={k} className="inv-view-row">
                      <span className="inv-view-key">{k}</span>
                      <span className="inv-view-val">{v}</span>
                    </div>
                  ))}
                </div>
                
                {/* Rental Strategy Options in View Modal */}
                <div className="inv-view-strategy-section">
                  <label className="inv-field-label">Rental Duration Options:</label>
                  <div className="inv-strategy-options">
                    {Object.entries(RENTAL_STRATEGIES).map(([key, strategy]) => (
                      <div key={key} className="inv-strategy-option">
                        <div className="inv-strategy-option-header">
                          <strong>{strategy.name}</strong>
                          {strategy.discount > 0 && (
                            <span className="inv-strategy-discount-badge">{strategy.discount}% OFF</span>
                          )}
                        </div>
                        <div className="inv-strategy-option-price">
                          {strategy.discount > 0 ? (
                            <>
                              <span className="strikethrough">₱{Math.round(selectedItem.finalPrice || selectedItem.originalPrice)}/day</span>
                              <span className="discounted">
                                ₱{Math.round((selectedItem.finalPrice || selectedItem.originalPrice) * (1 - strategy.discount / 100))}/day
                              </span>
                            </>
                          ) : (
                            <span>₱{Math.round(selectedItem.finalPrice || selectedItem.originalPrice)}/day</span>
                          )}
                        </div>
                        <div className="inv-strategy-option-desc">{strategy.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {selectedItem.description && <p className="inv-view-desc">{selectedItem.description}</p>}
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="inv-btn-ghost" onClick={closeModal}>Close</button>
              <button 
                className="inv-btn-primary" 
                onClick={() => {
                  if (hasUserBookedItem(selectedItem.id)) {
                    const userBooking = getUserBookingForItem(selectedItem.id);
                    showToast('error', `You already have a fitting booked for this item on ${fmtDate(userBooking.fittingDate)}.`);
                    closeModal();
                  } else {
                    setSelectedRentalStrategy('daily');
                    setBooking(prev => ({ ...prev, rentalStrategy: 'daily' }));
                    setModal('booking');
                  }
                }} 
                disabled={selectedItem.status !== 'Available' || hasUserBookedItem(selectedItem.id) || !isLoggedIn}
              >
                <Calendar size={14} /> 
                {hasUserBookedItem(selectedItem.id) ? 'Already Booked' : 'Book Fitting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING FITTING MODAL with Strategy Pattern Integration */}
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
        
        const basePrice = selectedItem.finalPrice || selectedItem.originalPrice;
        const strategy = RENTAL_STRATEGIES[booking.rentalStrategy];
        const dailyRate = strategy.discount > 0 
          ? basePrice * (1 - strategy.discount / 100)
          : basePrice;
        const totalPrice = dailyRate * booking.rentalDays;
        
        return (
          <div className="inv-overlay" onClick={closeModal}>
            <div className="inv-modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
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
                      {selectedItem.discountActive && (
                        <div className="promo-badge-sm">
                          <Sparkles size={10} /> {selectedItem.promoCode}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Strategy Pattern: Rental Duration Selector */}
                <div className="inv-field">
                  <label className="inv-field-label">Rental Duration Plan <span className="inv-required">*</span></label>
                  <div className="inv-strategy-selector-buttons">
                    {Object.entries(RENTAL_STRATEGIES).map(([key, strat]) => (
                      <button
                        key={key}
                        type="button"
                        className={`inv-strategy-btn ${booking.rentalStrategy === key ? 'active' : ''}`}
                        onClick={() => setBooking(prev => ({ ...prev, rentalStrategy: key }))}
                        disabled={submitting}
                      >
                        <div className="inv-strategy-btn-name">{strat.name}</div>
                        {strat.discount > 0 && (
                          <div className="inv-strategy-btn-discount">{strat.discount}% OFF</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rental Days Input */}
                <div className="inv-field">
                  <label className="inv-field-label">Number of Rental Days <span className="inv-required">*</span></label>
                  <input
                    className="inv-input"
                    type="number"
                    min="1"
                    max="365"
                    value={booking.rentalDays}
                    onChange={e => setBooking(prev => ({ ...prev, rentalDays: Math.max(1, parseInt(e.target.value) || 1) }))}
                    disabled={submitting}
                  />
                </div>

                {/* Price Breakdown */}
                <div className="bk-payment-summary">
                  <div className="bk-ps-row total">
                    <span><strong>Price Summary</strong></span>
                  </div>
                  <div className="bk-ps-row">
                    <span>Daily Rate ({strategy.name})</span>
                    <span>₱{Math.round(dailyRate).toLocaleString()}/day</span>
                  </div>
                  {strategy.discount > 0 && (
                    <div className="bk-ps-row">
                      <span>Discount Applied</span>
                      <span style={{ color: '#15803d' }}>-{strategy.discount}%</span>
                    </div>
                  )}
                  {selectedItem.discountActive && (
                    <div className="bk-ps-row">
                      <span>Promo Code ({selectedItem.promoCode})</span>
                      <span style={{ color: '#15803d' }}>Applied</span>
                    </div>
                  )}
                  <div className="bk-ps-row">
                    <span>Rental Days</span>
                    <span>{booking.rentalDays} day{booking.rentalDays !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="bk-ps-row total" style={{ borderTop: '1px solid #e2e8f0', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                    <span><strong>Total Rental Price</strong></span>
                    <span><strong>₱{Math.round(totalPrice).toLocaleString()}</strong></span>
                  </div>
                  <div className="bk-ps-row" style={{ fontSize: '0.7rem', color: '#999', justifyContent: 'center', marginTop: '0.5rem' }}>
                    * Fitting is FREE and no obligation to rent
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
              </div>
              
              <div className="inv-modal-footer">
                <button className="inv-btn-ghost" onClick={closeModal} disabled={submitting}>Cancel</button>
                <button 
                  className="inv-btn-primary" 
                  onClick={handleBookingSubmit} 
                  disabled={submitting || !booking.fittingDate || !booking.fittingTime || !booking.name || !booking.email || !booking.phone}
                >
                  {submitting ? <><Loader2 size={14} className="inv-spinner-inline" /> Submitting...</> : <>Confirm Booking • ₱{Math.round(totalPrice).toLocaleString()}</>}
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
                <CheckCircle size={20} /> Booking Confirmed!
              </h3>
              <button className="inv-modal-close" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="inv-modal-body">
              <div className="inv-confirmation-summary">
                <p className="inv-confirmation-message">
                  Your booking has been successfully confirmed. We've sent a confirmation to <strong>{bookingConfirmed.customerEmail}</strong>.
                </p>
                
                <div className="inv-booking-details">
                  <div className="inv-booking-detail-row">
                    <span className="inv-booking-label">Booking ID:</span>
                    <span className="inv-booking-value">#BK-{bookingConfirmed.id}</span>
                  </div>
                  <div className="inv-booking-detail-row">
                    <span className="inv-booking-label">Item:</span>
                    <span className="inv-booking-value">{bookingConfirmed.item.name}</span>
                  </div>
                  <div className="inv-booking-detail-row">
                    <span className="inv-booking-label">Rental Plan:</span>
                    <span className="inv-booking-value">
                      {RENTAL_STRATEGIES[bookingConfirmed.rentalStrategy]?.name || 'Daily Rate'}
                      {bookingConfirmed.rentalDays > 0 && ` • ${bookingConfirmed.rentalDays} day(s)`}
                    </span>
                  </div>
                  <div className="inv-booking-detail-row">
                    <span className="inv-booking-label">Total Price:</span>
                    <span className="inv-booking-value" style={{ color: '#15803d', fontWeight: 'bold' }}>
                      ₱{Math.round(bookingConfirmed.totalPrice).toLocaleString()}
                    </span>
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
      {gallery && (
        <div className="inv-lightbox" onClick={() => setGallery(null)}>
          <button className="inv-lightbox-close" onClick={() => setGallery(null)}><X size={18} /></button>
          <div className="inv-lightbox-inner" onClick={e => e.stopPropagation()}>
            <div className="inv-lightbox-topbar">
              <span className="inv-lightbox-itemname">{gallery.item.name}</span>
            </div>
            <div className="inv-gallery-stage">
              {gallery.item.mediaFiles?.[gallery.startIndex]?.type === 'video' ? (
                <video src={gallery.item.mediaFiles[gallery.startIndex].url} controls autoPlay className="inv-lightbox-media" />
              ) : (
                <img src={gallery.item.mediaFiles?.[gallery.startIndex]?.url} alt={gallery.item.name} className="inv-lightbox-media" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}