// BrowseOutfitsFragment.jsx (updated - remove login, fix filters)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, ChevronDown, LayoutGrid, List, Eye, Calendar,
  CheckCircle, AlertCircle, X, ChevronLeft, ChevronRight,
  Play, Image, Sparkles, Clock, AlertTriangle,
  Loader2, ShoppingBag
} from 'lucide-react';
import '../../../components/css/customerDashboard/BrowseOutfitsFragment.css';

// ────────────────────────────────────────────────────────────
// Shared Data
// ────────────────────────────────────────────────────────────
const ITEM_STATUS_META = {
  'Available': { color: '#15803d', bg: 'rgba(21,128,61,0.1)', dot: '#22c55e' },
  'Leased': { color: '#b45309', bg: 'rgba(180,83,9,0.1)', dot: '#f59e0b' },
  'Maintenance': { color: '#991b1b', bg: 'rgba(153,27,27,0.1)', dot: '#ef4444' },
  'Reserved': { color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)', dot: '#3b82f6' }
};

const CAT_COLORS = { 'Gown': '#c4717f', 'Suit': '#6b2d39', 'Traditional': '#b45309', 'Accessories': '#486581' };

const todayStr = () => new Date().toISOString().split('T')[0];
const fmtDate = (date) => date ? new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const fmtDateTime = (date, time) => {
  if (!date) return '';
  return `${new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })} at ${time}`;
};

// Mock API
const fetchItems = async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return [
    { id: 1, name: "Ivory Lace Ballgown", category: "Gown", subtype: "Wedding Gown", size: "M", color: "Ivory", price: 4500, status: "Available", ageRange: "20-35", description: "Elegant ivory lace ballgown with sweetheart neckline and chapel train.", mediaFiles: [{ url: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400", type: "image" }] },
    { id: 2, name: "Navy Blue Tuxedo", category: "Suit", subtype: "Tuxedo", size: "L", color: "Navy", price: 8000, status: "Available", ageRange: "25-45", description: "Classic navy blue tuxedo with satin lapels.", mediaFiles: [{ url: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400", type: "image" }] },
    { id: 3, name: "Champagne Off-Shoulder", category: "Gown", subtype: "Ball Gown", size: "S", color: "Champagne", price: 5000, status: "Reserved", ageRange: "18-30", description: "Champagne colored off-shoulder gown with ruffled details.", mediaFiles: [{ url: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400", type: "image" }] },
    { id: 4, name: "Barong Tagalog", category: "Traditional", subtype: "Barong", size: "M", color: "White", price: 3500, status: "Available", ageRange: "20-60", description: "Hand-embroidered barong tagalog made from piña fabric.", mediaFiles: [{ url: "https://images.unsplash.com/photo-1615044736721-8b4f92faffd7?w=400", type: "image" }] },
    { id: 5, name: "Corset Wedding Gown", category: "Gown", subtype: "Wedding Gown", size: "XS", color: "Ivory", price: 6200, status: "Available", ageRange: "20-35", description: "Romantic corset wedding gown with 3D floral appliqués.", mediaFiles: [{ url: "https://images.unsplash.com/photo-1594552072238-0d5f7f025d2c?w=400", type: "image" }] },
    { id: 6, name: "Gray Three-Piece Suit", category: "Suit", subtype: "Business", size: "XL", color: "Gray", price: 5500, status: "Maintenance", ageRange: "30-50", description: "Sharp gray three-piece suit for formal business events.", mediaFiles: [{ url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400", type: "image" }] },
  ];
};

const fetchPromotions = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return [
    { id: 1, code: "WEDDING15", type: "percentage", value: 15, items: [1, 3, 5], start: "2026-01-01", end: "2026-12-31", active: true },
    { id: 2, code: "SUIT10", type: "percentage", value: 10, items: [2, 4], start: "2026-01-01", end: "2026-12-31", active: true },
  ];
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
  if (!toast.show) return null;
  setTimeout(() => onClose(), 4000);
  return (
    <div className={`dashboard-toast ${toast.type}`}>
      {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      <span>{toast.message}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────
export default function BrowseOutfitsFragment() {
  const [items, setItems] = useState([]);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [filterSize, setFilterSize] = useState('All');

  const [selectedItem, setSelectedItem] = useState(null);
  const [modal, setModal] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
  
  // Fitting booking form
  const [booking, setBooking] = useState({
    fittingDate: '',
    fittingTime: '10:00 AM',
    name: '',
    email: '',
    phone: '',
    preferredSize: '',
    notes: ''
  });
  const [bookingConfirmed, setBookingConfirmed] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load data
  useEffect(() => {
    const load = async () => {
      try {
        const [itemsData, promosData] = await Promise.all([fetchItems(), fetchPromotions()]);
        setItems(itemsData);
        setPromos(promosData);
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const showToast = (type, message) => setToast({ show: true, type, message });
  const closeToast = () => setToast({ show: false, type: 'success', message: '' });
  const closeModal = () => {
    setModal(null);
    setSelectedItem(null);
    setBookingConfirmed(null);
    setBooking({
      fittingDate: '',
      fittingTime: '10:00 AM',
      name: '',
      email: '',
      phone: '',
      preferredSize: '',
      notes: ''
    });
  };

  // Promo helpers
  const activePromo = useCallback(item => {
    const now = todayStr();
    return promos.find(p => p.active && p.items.includes(item.id) && p.start <= now && p.end >= now);
  }, [promos]);

  const discPrice = item => {
    const p = activePromo(item);
    if (!p) return item.price;
    return p.type === 'percentage' ? item.price * (1 - p.value / 100) : item.price - p.value;
  };

  // Filter items
  const visibleItems = items
    .filter(i => i.status === 'Available' || i.status === 'Reserved')
    .filter(i => {
      const q = search.toLowerCase();
      return (!q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || (i.subtype || '').toLowerCase().includes(q))
        && (filterCat === 'All' || i.category === filterCat)
        && (filterSize === 'All' || i.size === filterSize);
    });

  const categories = [...new Set(visibleItems.map(i => i.category))];
  const sizes = [...new Set(visibleItems.map(i => i.size))].sort();

  // Handle fitting booking submission
  const handleBookingSubmit = async () => {
    if (!booking.fittingDate || !booking.fittingTime) {
      showToast('error', 'Please select a fitting date and time.');
      return;
    }
    if (!booking.name || !booking.email || !booking.phone) {
      showToast('error', 'Please fill in your contact information.');
      return;
    }
    
    const selectedDate = new Date(booking.fittingDate);
    if (selectedDate < new Date(todayStr())) {
      showToast('error', 'Fitting date cannot be in the past.');
      return;
    }

    setSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate booking confirmation
    const confirmation = {
      id: Math.floor(Math.random() * 10000),
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
    setSubmitting(false);
    showToast('success', 'Fitting booked successfully! Check your email for confirmation.');
  };

  if (loading) {
    return (
      <div className="inv-root">
        <div className="inv-loading-state">
          <Loader2 size={32} className="inv-spinner" />
          <p>Loading our collection...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
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

  return (
    <div className="inv-root">
      {/* Header */}
      <div className="inv-top">
        <div>
          <h2 className="inv-title">Browse Our Collection</h2>
          <p className="inv-subtitle">Find the perfect attire for your upcoming events</p>
        </div>
      </div>

      {/* Stats */}
      <div className="inv-stats">
        <div className="inv-stat-card">
          <div className="inv-stat-icon" style={{ background: '#6b2d3918', color: '#6b2d39' }}><ShoppingBag size={18} /></div>
          <div><div className="inv-stat-value">{visibleItems.length}</div><div className="inv-stat-label">Available Items</div></div>
        </div>
        <div className="inv-stat-card">
          <div className="inv-stat-icon" style={{ background: '#15803d18', color: '#15803d' }}><CheckCircle size={18} /></div>
          <div><div className="inv-stat-value">{items.filter(i => i.status === 'Available').length}</div><div className="inv-stat-label">Ready to Rent</div></div>
        </div>
        <div className="inv-stat-card">
          <div className="inv-stat-icon" style={{ background: '#1d4ed818', color: '#1d4ed8' }}><Calendar size={18} /></div>
          <div><div className="inv-stat-value">{items.filter(i => i.status === 'Reserved').length}</div><div className="inv-stat-label">Reserved</div></div>
        </div>
        <div className="inv-stat-card">
          <div className="inv-stat-icon" style={{ background: '#b4530918', color: '#b45309' }}><Clock size={18} /></div>
          <div><div className="inv-stat-value">{categories.length}</div><div className="inv-stat-label">Categories</div></div>
        </div>
      </div>

      {/* Toolbar - Filters side by side */}
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
            <select className="inv-select" value={filterSize} onChange={e => setFilterSize(e.target.value)}>
              <option value="All">All Sizes</option>
              {sizes.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="inv-view-toggle">
            <button className={`inv-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')}><LayoutGrid size={15} /></button>
            <button className={`inv-view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}><List size={15} /></button>
          </div>
        </div>

        {/* GRID VIEW */}
        {viewMode === 'grid' && (
          <div className="inv-grid">
            {visibleItems.length === 0 && <div className="inv-empty-grid">No items found.</div>}
            {visibleItems.map(item => {
              const promo = activePromo(item);
              const price = discPrice(item);
              const files = item.mediaFiles?.length || 0;
              return (
                <div key={item.id} className="inv-grid-card">
                  <div className="inv-grid-media" onClick={() => files && setGallery({ item, startIndex: 0 })}>
                    <MediaThumb item={item} />
                    <div className="inv-grid-media-overlay"><Eye size={16} /> View {files > 1 ? `(${files})` : ''}</div>
                    <div className="inv-grid-status-pin"><StatusBadge status={item.status} /></div>
                    {promo && (
                      <div className="inv-grid-promo-ribbon">
                        <Sparkles size={9} />
                        {promo.type === 'percentage' ? `${promo.value}% OFF` : `₱${promo.value} OFF`}
                      </div>
                    )}
                    {files > 1 && <span className="inv-grid-photo-count"><Image size={9} /> {files}</span>}
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
                        <><span className="inv-price-old">₱{item.price.toLocaleString()}</span><span className="inv-price-new">₱{Math.round(price).toLocaleString()}</span></>
                      ) : (
                        <span className="inv-price">₱{item.price.toLocaleString()}</span>
                      )}
                    </div>
                    {promo && (
                      <div className="inv-promo-code-pill">
                        <Sparkles size={9} />
                        <span>{promo.code}</span>
                        <span className="inv-promo-code-pill-disc">{promo.type === 'percentage' ? `${promo.value}% off` : `₱${promo.value} off`}</span>
                      </div>
                    )}
                  </div>
                  <div className="inv-grid-actions">
                    <button className="inv-icon-btn" onClick={() => { setSelectedItem(item); setModal('view'); }}><Eye size={13} /></button>
                    <button 
                      className="inv-btn-book" 
                      onClick={() => { setSelectedItem(item); setModal('booking'); }} 
                      disabled={item.status !== 'Available'}
                    >
                      <Calendar size={13} /> Book Fitting
                    </button>
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
                  <th style={{ width: 72 }}>Photo</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th style={{ width: 140 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 && (
                    <tr>
                        <td colSpan={8} className="inv-empty">No items found.</td>
                    </tr>
                )}
                {visibleItems.map(item => {
                  const promo = activePromo(item);
                  const price = discPrice(item);
                  const files = item.mediaFiles?.length || 0;
                  return (
                    <tr key={item.id} className={`inv-tr${promo ? ' inv-tr-promo' : ''}`}>
                      <td>
                        <div className="inv-list-thumb" onClick={() => files && setGallery({ item, startIndex: 0 })}>
                          <MediaThumb item={item} />
                          <div className="inv-list-thumb-overlay"><Eye size={12} /></div>
                          {files > 1 && <span className="inv-list-photo-count">{files}</span>}
                        </div>
                      </td>
                      <td>
                        <div className="inv-item-name">{item.name}</div>
                        {promo && (
                          <div className="inv-list-promo-badge">
                            <Sparkles size={9} />
                            <span>{promo.code}</span>
                            <span>·</span>
                            <span>{promo.type === 'percentage' ? `${promo.value}% off` : `₱${promo.value} off`}</span>
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
                            className="inv-btn-book-sm" 
                            onClick={() => { setSelectedItem(item); setModal('booking'); }} 
                            disabled={item.status !== 'Available'}
                          >
                            <Calendar size={12} /> Book Fitting
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
                        <div className="inv-view-promo-banner-sub">{promo.type === 'percentage' ? `${promo.value}% discount applied` : `₱${promo.value} flat discount applied`} · Valid until {fmtDate(promo.end)}</div>
                      </div>
                      <div className="inv-view-promo-banner-price">
                        <span className="inv-view-promo-was">₱{selectedItem.price.toLocaleString()}</span>
                        <span className="inv-view-promo-now">₱{Math.round(price).toLocaleString()}</span>
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
                      ['Daily Rate', promo ? <><span style={{ textDecoration: 'line-through', color: '#bbb', marginRight: '0.4rem' }}>₱{selectedItem.price.toLocaleString()}</span><strong style={{ color: '#15803d' }}>₱{Math.round(price).toLocaleString()}</strong></> : `₱${selectedItem.price.toLocaleString()}`],
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
                  onClick={() => setModal('booking')} 
                  disabled={selectedItem.status !== 'Available'}
                >
                  <Calendar size={14} /> Book Fitting
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* BOOKING FITTING MODAL */}
      {modal === 'booking' && selectedItem && !bookingConfirmed && (() => {
        const promo = activePromo(selectedItem);
        return (
          <div className="inv-overlay" onClick={closeModal}>
            <div className="inv-modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
              <div className="inv-modal-header">
                <h3>Book a Fitting - {selectedItem.name}</h3>
                <button className="inv-modal-close" onClick={closeModal} disabled={submitting}><X size={16} /></button>
              </div>
              
              <div className="inv-modal-body">
                {/* Selected item preview */}
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
                        `₱{selectedItem.price.toLocaleString()}/day`
                      )}
                    </div>
                    {promo && (
                      <div className="inv-promo-code-pill" style={{ marginTop: '0.25rem' }}>
                        <Sparkles size={8} /> {promo.code} - {promo.type === 'percentage' ? `${promo.value}% off` : `₱${promo.value} off`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cancellation Warning */}
                <div className="inv-warning-box">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Important:</strong> If you don't arrive at the scheduled time, your fitting may be cancelled. 
                    Please arrive 10 minutes early.
                  </div>
                </div>

                {/* Fitting Date & Time */}
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

                {/* Customer Information */}
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

                {/* Preferred Size Only */}
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
                  <span className="inv-field-hint">We'll prepare your preferred size if available</span>
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

                {/* Booking Summary Preview */}
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