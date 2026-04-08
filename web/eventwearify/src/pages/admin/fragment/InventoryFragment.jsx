import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../../../components/css/adminDashboard/InventoryManagement.css';
import {
  Plus, Search, Edit2, Trash2, Eye, X, Tag, Package, AlertCircle, CheckCircle,
  Percent, DollarSign, Gift, Shirt, LayoutGrid, List, Video, Image, Play, Wrench,
  ChevronDown, ChevronLeft, ChevronRight, Loader2, Sparkles,
} from 'lucide-react';
import {
  CATEGORIES, CATEGORY_MAP, SIZES, COLORS, COLOR_SWATCHES, LIGHT_COLORS,
  CAT_COLORS, ITEM_STATUS_META, MANUAL_ITEM_STATUSES,
  todayStr, fmtDate,
  fetchItems, fetchPromotions,
  createItem as apiCreateItem,
  updateItem as apiUpdateItem,
  deleteItem as apiDeleteItem,
  createPromotion as apiCreatePromotion,
  updatePromotion as apiUpdatePromotion,
  deletePromotion as apiDeletePromotion,
} from './sharedData.js';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
const getMediaFiles = item =>
  item.mediaFiles?.length ? item.mediaFiles
  : item.media            ? [{ url: item.media, type: item.mediaType || 'image' }]
  : [];

// ────────────────────────────────────────────────────────────
// Shared UI atoms
// ────────────────────────────────────────────────────────────
export function StatusBadge({ status, meta = ITEM_STATUS_META }) {
  const m = meta[status] || { color:'#888', bg:'rgba(0,0,0,0.06)', dot:'#888' };
  return (
    <span className="inv-badge" style={{ color:m.color, background:m.bg }}>
      <span className="inv-badge-dot" style={{ background:m.dot }}/>
      {status}
    </span>
  );
}

export function MediaThumb({ item, className = '' }) {
  const bg    = CAT_COLORS[item.category] || '#6b2d39';
  const files = getMediaFiles(item);
  const first = files[0] || null;

  if (!first) return (
    <div className={`inv-media-placeholder ${className}`} style={{'--cat-color': bg}}>
      <Shirt size={28} style={{ color: bg, opacity: 0.45 }}/>
    </div>
  );
  if (first.type === 'video') return (
    <div className={`inv-media-video-thumb ${className}`}>
      <video src={first.url} muted playsInline preload="metadata"
             style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
      <span className="inv-video-badge"><Play size={9} fill="white"/> Video</span>
    </div>
  );
  return (
    <img src={first.url} alt={item.name} className={`inv-media-img ${className}`}
         loading="lazy" style={{ objectFit:'cover', objectPosition:'center top' }}/>
  );
}

export function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className={`dashboard-toast ${toast.type}`}>
      {toast.type === 'success' ? <CheckCircle size={15}/> : <AlertCircle size={15}/>}
      <span>{toast.message}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Fullscreen Gallery Lightbox
// ────────────────────────────────────────────────────────────
function MediaGallery({ item, startIndex = 0, onClose }) {
  const files = getMediaFiles(item);
  const [idx,   setIdx]  = useState(startIndex);
  const [phase, setPhase] = useState('idle');
  const [next,  setNext]  = useState(null);
  const touchX = useRef(null);

  const go = useCallback((newIdx, dir) => {
    if (phase !== 'idle') return;
    setNext(newIdx); setPhase(dir === 'next' ? 'exit-left' : 'exit-right');
  }, [phase]);

  const handleAnimEnd = () => {
    if (phase === 'idle') return;
    setIdx(next); setPhase('idle'); setNext(null);
  };

  const prev      = useCallback(() => go((idx - 1 + files.length) % files.length, 'prev'), [idx, files.length, go]);
  const nextSlide = useCallback(() => go((idx + 1) % files.length, 'next'), [idx, files.length, go]);

  useEffect(() => {
    const h = e => {
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'Escape')     onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [prev, nextSlide, onClose]);

  if (!files.length) return null;

  const slideClass =
    phase === 'exit-left'  ? 'inv-gallery-media-wrap inv-slide-exit-left'
  : phase === 'exit-right' ? 'inv-gallery-media-wrap inv-slide-exit-right'
  :                          'inv-gallery-media-wrap inv-slide-enter';

  const current = files[idx];

  return (
    <div className="inv-lightbox" onClick={onClose}>
      <button className="inv-lightbox-close" onClick={onClose}><X size={18}/></button>
      <div className="inv-lightbox-inner" onClick={e => e.stopPropagation()}>
        <div className="inv-lightbox-topbar">
          <span className="inv-lightbox-itemname">{item.name}</span>
          <span className="inv-lightbox-catnote">{item.category}{item.subtype ? ` · ${item.subtype}` : ''} · Size {item.size}</span>
        </div>
        <div className="inv-gallery-stage"
          onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (touchX.current === null) return;
            const d = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(d) > 42) d < 0 ? nextSlide() : prev();
            touchX.current = null;
          }}>
          <div key={idx} className={slideClass} onAnimationEnd={handleAnimEnd}>
            {current.type === 'video'
              ? <video src={current.url} controls autoPlay className="inv-lightbox-media"/>
              : <img src={current.url} alt={item.name} className="inv-lightbox-media"
                     style={{ objectFit:'contain', objectPosition:'center' }}/>}
          </div>
          {files.length > 1 && (
            <>
              <button className="inv-gallery-arrow inv-gallery-arrow-prev" onClick={e => { e.stopPropagation(); prev(); }}><ChevronLeft size={22}/></button>
              <button className="inv-gallery-arrow inv-gallery-arrow-next" onClick={e => { e.stopPropagation(); nextSlide(); }}><ChevronRight size={22}/></button>
            </>
          )}
        </div>
        <div className="inv-lightbox-footer">
          {files.length > 1 && <span className="inv-gallery-counter">{idx + 1} / {files.length}</span>}
          {files.length > 1 && (
            <div className="inv-gallery-dots">
              {files.map((_, i) => (
                <button key={i} className={`inv-gallery-dot${i === idx ? ' active' : ''}`}
                  onClick={e => { e.stopPropagation(); go(i, i > idx ? 'next' : 'prev'); }}/>
              ))}
            </div>
          )}
        </div>
        {files.length > 1 && (
          <div className="inv-gallery-strip">
            {files.map((f, i) => (
              <button key={i} className={`inv-gallery-strip-thumb${i === idx ? ' active' : ''}`}
                onClick={e => { e.stopPropagation(); go(i, i > idx ? 'next' : 'prev'); }}>
                {f.type === 'video'
                  ? <div className="inv-gallery-strip-video"><Play size={10} fill="white"/></div>
                  : <img src={f.url} alt={`t${i}`} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }}/>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Inline Gallery (inside View modal)
// ────────────────────────────────────────────────────────────
function InlineGallery({ item, onOpenFullscreen }) {
  const files  = getMediaFiles(item);
  const [idx,   setIdx]   = useState(0);
  const [phase, setPhase] = useState('idle');
  const [next,  setNext]  = useState(null);
  const touchX = useRef(null);

  const go = (newIdx, dir) => {
    if (phase !== 'idle') return;
    setNext(newIdx); setPhase(dir === 'next' ? 'exit-left' : 'exit-right');
  };
  const handleAnimEnd = () => {
    if (phase === 'idle') return;
    setIdx(next); setPhase('idle'); setNext(null);
  };

  if (!files.length) return (
    <div className="inv-view-media">
      <MediaThumb item={item} className="inv-view-media-inner"/>
    </div>
  );

  const current = files[idx];
  const slideClass =
    phase === 'exit-left'  ? 'inv-inline-media-wrap inv-slide-exit-left'
  : phase === 'exit-right' ? 'inv-inline-media-wrap inv-slide-exit-right'
  :                          'inv-inline-media-wrap inv-slide-enter';

  return (
    <div className="inv-view-gallery">
      <div className="inv-view-gallery-stage"
        onClick={() => onOpenFullscreen(idx)}
        onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (touchX.current === null) return;
          const d = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(d) > 40) {
            d < 0 ? go((idx+1)%files.length,'next') : go((idx-1+files.length)%files.length,'prev');
          }
          touchX.current = null;
        }}>
        <div key={idx} className={slideClass} onAnimationEnd={handleAnimEnd}>
          {current.type === 'video'
            ? <video src={current.url} muted preload="metadata"
                style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}/>
            : <img src={current.url} alt={item.name} loading="lazy"
                style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }}/>}
        </div>
        <div className="inv-view-gallery-overlay">
          <Eye size={17}/> {current.type === 'video' ? 'Play Video' : 'View Full'}
        </div>
        {files.length > 1 && (
          <>
            <button className="inv-gallery-arrow inv-gallery-arrow-prev sm"
              onClick={e => { e.stopPropagation(); go((idx-1+files.length)%files.length,'prev'); }}><ChevronLeft size={15}/></button>
            <button className="inv-gallery-arrow inv-gallery-arrow-next sm"
              onClick={e => { e.stopPropagation(); go((idx+1)%files.length,'next'); }}><ChevronRight size={15}/></button>
          </>
        )}
        {files.length > 1 && <span className="inv-view-gallery-count">{idx+1}/{files.length}</span>}
      </div>
      {files.length > 1 && (
        <div className="inv-view-gallery-strip">
          {files.map((f, i) => (
            <button key={i} className={`inv-view-strip-thumb${i === idx ? ' active' : ''}`}
              onClick={() => go(i, i > idx ? 'next' : 'prev')}>
              {f.type === 'video'
                ? <div className="inv-gallery-strip-video"><Play size={9} fill="white"/></div>
                : <img src={f.url} alt={`t${i}`}
                    style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Multi-file Drop Zone
// ────────────────────────────────────────────────────────────
function MediaDropZone({ files, onChange, hasError }) {
  const ref  = useRef();
  const [drag, setDrag] = useState(false);

  const addFiles = rawFiles => {
    const valid = Array.from(rawFiles).filter(f =>
      f.type.startsWith('video/') || f.type.startsWith('image/'));
    if (!valid.length) return;
    let done = 0;
    const newOnes = [];
    valid.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        newOnes.push({
          file,
          url:  e.target.result,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          name: file.name,
          isExisting: false,
        });
        done++;
        if (done === valid.length) onChange([...files, ...newOnes]);
      };
      reader.readAsDataURL(file);
    });
  };

  const remove    = (i, e) => { e.stopPropagation(); onChange(files.filter((_, idx) => idx !== i)); };
  const moveLeft  = (i, e) => { e.stopPropagation(); if (i === 0) return; const a=[...files]; [a[i-1],a[i]]=[a[i],a[i-1]]; onChange(a); };
  const moveRight = (i, e) => { e.stopPropagation(); if (i===files.length-1) return; const a=[...files]; [a[i],a[i+1]]=[a[i+1],a[i]]; onChange(a); };

  return (
    <div className="inv-multi-dropzone-wrap">
      <div className={`inv-dropzone${drag?' dragging':''}${hasError?' inv-dropzone-error':''}`}
        onClick={() => ref.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
        <div className="inv-dropzone-hint">
          <div className="inv-dropzone-icons"><Image size={22}/><span>+</span><Video size={22}/></div>
          <span>{files.length > 0 ? 'Add more photos / videos' : 'Drop images or videos, or click to browse'}</span>
          <small>JPEG · PNG · MP4 · MOV · multiple files allowed</small>
          {hasError && (
            <span style={{ color:'#dc2626', fontSize:'0.75rem', fontWeight:600, marginTop:'0.25rem' }}>
              ⚠ At least one photo or video is required
            </span>
          )}
        </div>
        <input ref={ref} type="file" accept="image/*,video/*" multiple style={{ display:'none' }}
               onChange={e => { addFiles(e.target.files); e.target.value=''; }}/>
      </div>
      {files.length > 0 && (
        <div className="inv-media-preview-grid">
          {files.map((f, i) => (
            <div key={i} className={`inv-media-preview-item${i===0?' primary':''}`}>
              {f.type === 'video'
                ? <div className="inv-media-preview-video">
                    <video src={f.url} muted preload="metadata"
                      style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    <span className="inv-video-badge"><Play size={8} fill="white"/> Video</span>
                  </div>
                : <img src={f.url} alt={`media-${i}`}
                    style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }}/>}
              {i === 0 && <span className="inv-media-preview-primary-badge">Cover</span>}
              {f.isExisting && <span className="inv-media-existing-badge">Saved</span>}
              <div className="inv-media-preview-actions">
                <button title="Move left"  onClick={e=>moveLeft(i,e)}  disabled={i===0}><ChevronLeft size={11}/></button>
                <button title="Move right" onClick={e=>moveRight(i,e)} disabled={i===files.length-1}><ChevronRight size={11}/></button>
                <button title="Remove" className="remove" onClick={e=>remove(i,e)}><X size={11}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Grouped Item Checkboxes (promo modal)
// ────────────────────────────────────────────────────────────
function GroupedItemCheckboxes({ items, selected, onChange }) {
  const [openCats, setOpenCats] = useState(() => {
    const initial = {};
    CATEGORIES.forEach(cat => {
      initial[cat] = true;
    });
    return initial;
  });
  
  const [openSubtypes, setOpenSubtypes] = useState(() => {
    return {};
  });

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const ci = items.filter(i => i.category === cat);
    if (!ci.length) return acc;
    const bySubtype = {};
    ci.forEach(item => {
      const st = item.subtype || '(No Type)';
      if (!bySubtype[st]) bySubtype[st] = [];
      bySubtype[st].push(item);
    });
    acc[cat] = bySubtype;
    return acc;
  }, {});

  const catItems = cat => Object.values(grouped[cat] || {}).flat();
  const isCatAll = cat => catItems(cat).length > 0 && catItems(cat).every(i => selected.includes(i.id));
  const isCatPart = cat => {
    const catItemIds = catItems(cat).map(i => i.id);
    const selectedInCat = selected.filter(id => catItemIds.includes(id)).length;
    return selectedInCat > 0 && selectedInCat < catItems(cat).length;
  };
  
  const isStAll = (cat, st) => {
    const stItems = grouped[cat][st] || [];
    return stItems.length > 0 && stItems.every(i => selected.includes(i.id));
  };
  
  const isStPart = (cat, st) => {
    const stItems = grouped[cat][st] || [];
    const selectedInSt = stItems.filter(i => selected.includes(i.id)).length;
    return selectedInSt > 0 && selectedInSt < stItems.length;
  };

  const toggleCatAll = cat => {
    const ids = catItems(cat).map(i => i.id);
    const willSelect = !isCatAll(cat);
    if (willSelect) {
      onChange([...new Set([...selected, ...ids])]);
    } else {
      onChange(selected.filter(id => !ids.includes(id)));
    }
  };
  
  const toggleStAll = (cat, st) => {
    const ids = (grouped[cat][st] || []).map(i => i.id);
    if (isStAll(cat, st)) {
      onChange(selected.filter(id => !ids.includes(id)));
    } else {
      onChange([...new Set([...selected, ...ids])]);
    }
  };
  
  const toggleItem = id => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };
  
  const toggleCatOpen = cat => setOpenCats(p => ({ ...p, [cat]: !p[cat] }));
  const toggleStOpen = key => setOpenSubtypes(p => ({ ...p, [key]: !p[key] }));

  const totalSelected = selected.length;

  return (
    <div className="inv-grouped-items">
      {totalSelected > 0 && (
        <div className="inv-selected-summary">
          <CheckCircle size={12} />
          <span>{totalSelected} item{totalSelected !== 1 ? 's' : ''} selected</span>
        </div>
      )}
      
      {Object.entries(grouped).map(([cat, subtypeMap]) => {
        const allCatItems = catItems(cat);
        const selectedCount = allCatItems.filter(i => selected.includes(i.id)).length;
        const subtypes = Object.keys(subtypeMap);
        const catChecked = isCatAll(cat);
        const catIndeterminate = isCatPart(cat);
        
        return (
          <div key={cat} className="inv-group">
            <div className="inv-group-header" onClick={() => toggleCatOpen(cat)}>
              <label className="inv-group-check" onClick={e => e.stopPropagation()}>
                <input 
                  type="checkbox"
                  checked={catChecked}
                  ref={el => {
                    if (el) {
                      el.indeterminate = catIndeterminate;
                    }
                  }}
                  onChange={() => toggleCatAll(cat)}
                  style={{ accentColor: '#6b2d39' }}
                />
              </label>
              <span className="inv-group-cat">
                <span className="inv-cat-dot" style={{ background: CAT_COLORS[cat] || '#6b2d39' }}/>
                {cat}
                <span className="inv-group-count">{selectedCount}/{allCatItems.length}</span>
              </span>
              <ChevronDown size={13} className={`inv-group-chevron${openCats[cat] ? ' open' : ''}`}/>
            </div>
            
            {openCats[cat] && (
              <div className="inv-group-subtypes">
                {subtypes.map(st => {
                  const stKey = `${cat}__${st}`;
                  const stItems = subtypeMap[st];
                  const stSelCount = stItems.filter(i => selected.includes(i.id)).length;
                  const stChecked = isStAll(cat, st);
                  const stIndeterminate = isStPart(cat, st);
                  
                  return (
                    <div key={st} className="inv-subgroup">
                      <div className="inv-subgroup-header" onClick={() => toggleStOpen(stKey)}>
                        <label className="inv-group-check" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox"
                            checked={stChecked}
                            ref={el => {
                              if (el) {
                                el.indeterminate = stIndeterminate;
                              }
                            }}
                            onChange={() => toggleStAll(cat, st)}
                            style={{ accentColor: '#6b2d39' }}
                          />
                        </label>
                        <span className="inv-subgroup-label">
                          {st}
                          <span className="inv-group-count">{stSelCount}/{stItems.length}</span>
                        </span>
                        <ChevronDown size={11} className={`inv-group-chevron${openSubtypes[stKey] ? ' open' : ''}`}/>
                      </div>
                      
                      {openSubtypes[stKey] && (
                        <div className="inv-group-items">
                          {stItems.map(item => (
                            <label key={item.id} className="inv-checkbox-item inv-group-item">
                              <input 
                                type="checkbox"
                                checked={selected.includes(item.id)}
                                onChange={() => toggleItem(item.id)}
                                style={{ accentColor: '#6b2d39' }}
                              />
                              <div className="inv-group-item-info">
                                <span className="inv-group-item-name">{item.name}</span>
                                <span className="inv-group-item-sub">
                                  Size: {item.size} · Color: {item.color} · ₱{item.price.toLocaleString()}
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      
      {Object.keys(grouped).length === 0 && (
        <div className="inv-empty-items-message">
          <AlertCircle size={16} />
          <span>No items available. Please add items first.</span>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN FRAGMENT
// ════════════════════════════════════════════════════════════
export default function InventoryFragment() {
  const [items, setItems] = useState([]);
  const [promos, setPromos] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [categoryMap, setCategoryMap] = useState(() => {
    const map = {};
    CATEGORIES.forEach(cat => { map[cat] = [...(CATEGORY_MAP[cat] || [])]; });
    return map;
  });

  useEffect(() => {
    const load = async () => {
      setLoadError('');
      try {
        const [itemsData, promosData] = await Promise.all([fetchItems(), fetchPromotions()]);
        setItems(itemsData);
        setPromos(promosData);
        itemsData.forEach(item => {
          if (item.subtype && item.subtype !== 'Others') {
            const defaults = CATEGORY_MAP[item.category] || [];
            if (!defaults.includes(item.subtype)) {
              setCategoryMap(prev => {
                const list = prev[item.category] || [];
                if (list.includes(item.subtype)) return prev;
                const oi = list.indexOf('Others');
                const upd = [...list];
                oi >= 0 ? upd.splice(oi, 0, item.subtype) : upd.push(item.subtype);
                return { ...prev, [item.category]: upd };
              });
            }
          }
        });
        setIsInitialized(true);
      } catch (err) {
        setLoadError(err.message || 'Failed to load inventory data.');
        setIsInitialized(true);
      }
    };
    load();
  }, []);

  const refreshData = async () => {
    try {
      const [itemsData, promosData] = await Promise.all([fetchItems(), fetchPromotions()]);
      setItems(itemsData);
      setPromos(promosData);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

  const registerSubtype = (category, subtype) => {
    if (!subtype || subtype === 'Others') return;
    setCategoryMap(prev => {
      const list = prev[category] || [];
      if (list.includes(subtype)) return prev;
      const oi = list.indexOf('Others');
      const upd = [...list];
      oi >= 0 ? upd.splice(oi, 0, subtype) : upd.push(subtype);
      return { ...prev, [category]: upd };
    });
  };

  const activeCats = CATEGORIES.filter(cat => items.some(i => i.category === cat));
  const activeSubtypes = cat => {
    const used = [...new Set(items.filter(i => i.category === cat).map(i => i.subtype).filter(Boolean))];
    const ordered = (categoryMap[cat] || []).filter(s => used.includes(s));
    used.forEach(s => { if (!ordered.includes(s)) ordered.push(s); });
    return ordered;
  };

  const [tab, setTab] = useState('items');
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [filterSubtype, setFilterSubtype] = useState('All');
  const [filterStat, setFilterStat] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
  const [errors, setErrors] = useState({});
  const [customSubtype, setCustomSubtype] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const blank = { name: '', category: '', subtype: '', size: '', color: 'Ivory', price: '', status: 'Available', mediaFiles: [], ageRange: '', description: '' };
  const blankPromo = { code: '', type: 'percentage', value: '', items: [], start: '', end: '', active: true };
  const [form, setForm] = useState(blank);
  const [promoForm, setPromoForm] = useState(blankPromo);

  const showToast = useCallback((type, msg) => {
    setToast({ show: true, type, message: msg });
    const timer = setTimeout(() => {
      setToast({ show: false, type: 'success', message: '' });
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const closeModal = () => { setModal(null); setSelected(null); setErrors({}); setCustomSubtype(''); setSaving(false); };
  const setF = v => setForm(p => ({ ...p, ...v }));
  const setPF = v => setPromoForm(p => ({ ...p, ...v }));

  const filterSubtypes = filterCat !== 'All' ? activeSubtypes(filterCat) : [];
  const handleFilterCat = cat => { setFilterCat(cat); setFilterSubtype('All'); };

  useEffect(() => {
    if (filterSubtype !== 'All' && filterCat !== 'All') {
      if (!items.some(i => i.category === filterCat && i.subtype === filterSubtype)) setFilterSubtype('All');
    }
    if (filterCat !== 'All' && !activeCats.includes(filterCat)) { setFilterCat('All'); setFilterSubtype('All'); }
  }, [items]);

  const validatePromo = () => {
    const e = {};
    if (!promoForm.code.trim()) e.code = 'Promo code is required.';
    if (!promoForm.value || Number(promoForm.value) <= 0) e.value = 'Value is required.';
    if (!promoForm.start) e.start = 'Valid From date is required.';
    if (!promoForm.end) e.end = 'Valid Until date is required.';
    if (promoForm.start && promoForm.end && promoForm.end < promoForm.start) e.end = 'End date must be after start date.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const getDisplayPrice = (item) => {
    return item.finalPrice || item.price;
  };

  const getOriginalPrice = (item) => {
    return item.price;
  };

  const hasDiscount = (item) => {
    return item.discountApplied !== null && item.discountApplied !== undefined && item.discountApplied !== 'None';
  };

  const getDiscountInfo = (item) => {
    return item.discountApplied;
  };

  const getSavings = (item) => {
    return (item.price - (item.finalPrice || item.price));
  };

  // Helper function to get discount value text (for ribbon/badge)
  const getDiscountValueText = (discountCode) => {
    if (!discountCode) return '';
    const promo = promos.find(p => p.code === discountCode);
    if (!promo) return discountCode;
    if (promo.type === 'percentage') {
      return `${promo.value}% off`;
    } else {
      return `₱${promo.value} off`;
    }
  };

  const saveItem = async () => {
    const finalSubtype = form.subtype === 'Others' ? (customSubtype.trim() || 'Others') : form.subtype;
    const finalForm = { ...form, subtype: finalSubtype };

    const e = {};
    if (!finalForm.mediaFiles?.length) e.media = 'At least one photo or video is required.';
    if (!finalForm.name.trim()) e.name = 'Item name is required.';
    if (!finalForm.category) e.category = 'Category is required.';
    if (!finalForm.subtype || finalForm.subtype === 'Others') e.subtype = 'Please specify the type.';
    if (!finalForm.size) e.size = 'Size is required.';
    if (!finalForm.price || Number(finalForm.price) <= 0) e.price = 'Valid price is required.';
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);

    const keepUrls = finalForm.mediaFiles.filter(f => f.isExisting).map(f => f.url);
    const newFiles = finalForm.mediaFiles.filter(f => !f.isExisting).map(f => f.file);

    const itemData = {
      name: finalForm.name, category: finalForm.category,
      subtype: finalSubtype, size: finalForm.size, color: finalForm.color,
      price: Number(finalForm.price), status: finalForm.status,
      ageRange: finalForm.ageRange, description: finalForm.description,
    };

    try {
      if (modal === 'add') {
        await apiCreateItem(itemData, newFiles);
        showToast('success', 'Item added!');
      } else {
        await apiUpdateItem(selected.id, itemData, newFiles, keepUrls);
        showToast('success', 'Item updated!');
      }
      await refreshData();
      const defaultSubs = CATEGORY_MAP[finalForm.category] || [];
      if (finalSubtype && finalSubtype !== 'Others' && !defaultSubs.includes(finalSubtype))
        registerSubtype(finalForm.category, finalSubtype);
      closeModal();
    } catch (err) {
      showToast('error', err.message || 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  };

  const askDeleteItem = item => setConfirmDelete({ type: 'item', id: item.id, name: item.name });
  const askDeletePromo = promo => setConfirmDelete({ type: 'promo', id: promo.id, name: promo.code });

  const handleConfirmedDelete = async () => {
    if (!confirmDelete) return;
    const { type, id, name } = confirmDelete;
    setConfirmDelete(null);

    try {
      if (type === 'item') {
        await apiDeleteItem(id);
        showToast('success', `"${name}" deleted successfully.`);
      } else {
        await apiDeletePromotion(id);
        showToast('success', `Promo "${name}" deleted successfully.`);
      }
      await refreshData();
    } catch (err) {
      showToast('error', err.message || 'Failed to delete.');
      await refreshData();
    }
  };

  const savePromo = async () => {
    if (!validatePromo()) return;
    setSaving(true);
    try {
      if (selected) {
        await apiUpdatePromotion(selected.id, promoForm);
        showToast('success', 'Promo updated!');
      } else {
        await apiCreatePromotion(promoForm);
        showToast('success', 'Promo created!');
      }
      closeModal();
      await refreshData();
    } catch (err) {
      showToast('error', err.message || 'Failed to save promo.');
    } finally {
      setSaving(false);
    }
  };

  const displayed = items
    .filter(i => {
      const q = search.toLowerCase();
      return (!q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || (i.subtype || '').toLowerCase().includes(q))
        && (filterCat === 'All' || i.category === filterCat)
        && (filterSubtype === 'All' || i.subtype === filterSubtype)
        && (filterStat === 'All' || i.status === filterStat);
    })
    .sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const toggleSort = col => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('asc'); } };

  const stats = {
    total: items.length,
    available: items.filter(i => i.status === 'Available').length,
    leased: items.filter(i => i.status === 'Leased').length,
    maintenance: items.filter(i => i.status === 'Maintenance').length,
  };

  const openEdit = item => {
    const defaultSubs = CATEGORY_MAP[item.category] || [];
    const isCustom = item.subtype && !defaultSubs.includes(item.subtype) && item.subtype !== 'Others';
    setCustomSubtype(isCustom ? item.subtype : '');
    closeModal();
    const existingMedia = getMediaFiles(item).map(mf => ({
      file: null, url: mf.url, type: mf.type,
      name: mf.url.split('/').pop(), isExisting: true,
    }));
    setForm({ ...item, price: String(item.price), mediaFiles: existingMedia });
    setSelected(item); setErrors({}); setModal('edit');
  };

  const ErrMsg = ({ field }) => errors[field]
    ? <span className="inv-field-error"><AlertCircle size={11} /> {errors[field]}</span>
    : null;

  const _subtypeVisible = form.category ? [...(CATEGORY_MAP[form.category] || [])] : [];
  if (form.category) {
    items
      .filter(i => i.category === form.category && i.subtype && i.subtype !== 'Others')
      .forEach(i => {
        if (!_subtypeVisible.includes(i.subtype)) {
          const oi = _subtypeVisible.indexOf('Others');
          oi >= 0 ? _subtypeVisible.splice(oi, 0, i.subtype) : _subtypeVisible.push(i.subtype);
        }
      });
  }
  if (selected?.subtype && selected.subtype !== 'Others' && !_subtypeVisible.includes(selected.subtype)) {
    const _idx = _subtypeVisible.indexOf('Others');
    _idx >= 0 ? _subtypeVisible.splice(_idx, 0, selected.subtype) : _subtypeVisible.push(selected.subtype);
  }
  const _subtypeSelectVal = _subtypeVisible.includes(form.subtype) ? form.subtype : (form.subtype && form.subtype !== 'Others' ? 'Others' : (form.subtype || ''));
  const _subtypeShowCustom = form.subtype === 'Others';

  if (loadError && isInitialized) return (
    <div className="inv-root inv-error-state">
      <AlertCircle size={28} color="#dc2626" />
      <p>{loadError}</p>
      <button className="inv-btn-primary" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  return (
    <div className="inv-root">

      <div className="inv-top">
        <div>
          <h2 className="inv-title">Inventory</h2>
          <p className="inv-subtitle">Manage event wear items and active promotions</p>
        </div>
        <div className="inv-header-actions">
          {tab === 'items' && <button className="inv-btn-primary" onClick={() => { setForm(blank); setErrors({}); setModal('add'); }}><Plus size={14} /> Add Item</button>}
          {tab === 'promos' && <button className="inv-btn-primary" onClick={() => { setSelected(null); setPromoForm(blankPromo); setErrors({}); setModal('promo'); }}><Plus size={14} /> New Promo</button>}
        </div>
      </div>

      <div className="inv-stats">
        {[
          { label: 'Total Items', value: stats.total, icon: Package, color: '#6b2d39' },
          { label: 'Available', value: stats.available, icon: CheckCircle, color: '#15803d' },
          { label: 'Out on Lease', value: stats.leased, icon: Tag, color: '#b45309' },
          { label: 'Maintenance', value: stats.maintenance, icon: Wrench, color: '#9a3412' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div className="inv-stat-card" key={label}>
            <div className="inv-stat-icon" style={{ background: `${color}18`, color }}><Icon size={18} /></div>
            <div><div className="inv-stat-value">{value}</div><div className="inv-stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      <div className="inv-tabs">
        {[{ key: 'items', label: 'Items', icon: Package }, { key: 'promos', label: 'Promotions', icon: Gift }].map(({ key, label, icon: Icon }) => (
          <button key={key} className={`inv-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}><Icon size={13} /> {label}</button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="inv-card">
          <div className="inv-toolbar">
            <div className="inv-search-wrap">
              <Search size={13} className="inv-search-icon" />
              <input className="inv-search" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="inv-filters">
              <select className="inv-select" value={filterCat} onChange={e => handleFilterCat(e.target.value)}>
                <option value="All">All Categories</option>
                {activeCats.map(c => <option key={c}>{c}</option>)}
              </select>
              {filterCat !== 'All' && filterSubtypes.length > 0 && (
                <select className="inv-select" value={filterSubtype} onChange={e => setFilterSubtype(e.target.value)}>
                  <option value="All">All {filterCat}</option>
                  {filterSubtypes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <select className="inv-select" value={filterStat} onChange={e => setFilterStat(e.target.value)}>
                <option value="All">All Statuses</option>
                {Object.keys(ITEM_STATUS_META).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="inv-view-toggle">
              <button className={`inv-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')} title="Grid"><LayoutGrid size={15} /></button>
              <button className={`inv-view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')} title="List"><List size={15} /></button>
            </div>
          </div>

          {viewMode === 'grid' && (
            <div className="inv-grid">
              {displayed.length === 0 && <div className="inv-empty-grid">No items found.</div>}
              {displayed.map(item => {
                const finalPrice = getDisplayPrice(item);
                const originalPrice = getOriginalPrice(item);
                const discount = hasDiscount(item);
                const discountCode = getDiscountInfo(item);
                const discountValueText = getDiscountValueText(discountCode);
                const mFiles = getMediaFiles(item);
                return (
                  <div key={item.id} className={`inv-grid-card${discount ? ' has-promo' : ''}`}>
                    <div className="inv-grid-media" onClick={() => mFiles.length && setGallery({ item, startIndex: 0 })}>
                      <MediaThumb item={item} className="inv-grid-media-inner" />
                      {mFiles.length > 0 && <div className="inv-grid-media-overlay"><Eye size={16} /> View {mFiles.length > 1 ? `(${mFiles.length})` : ''}</div>}
                      {mFiles.length > 1 && <span className="inv-grid-photo-count"><Image size={9} /> {mFiles.length}</span>}
                      <div className="inv-grid-status-pin"><StatusBadge status={item.status} /></div>
                      {discount && discountValueText && (
                        <div className="inv-grid-promo-ribbon">
                          <Sparkles size={9} />
                          {discountValueText}
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
                        {discount ? (
                          <><span className="inv-price-old">₱{originalPrice.toLocaleString()}</span><span className="inv-price-new">₱{Math.round(finalPrice).toLocaleString()}</span></>
                        ) : (
                          <span className="inv-price">₱{originalPrice.toLocaleString()}</span>
                        )}
                      </div>
                      {discount && discountCode && (
                        <div className="inv-promo-code-pill">
                          <Sparkles size={9} />
                          <span>{discountCode}</span>
                        </div>
                      )}
                    </div>
                    <div className="inv-grid-actions">
                      <button className="inv-icon-btn" title="View" onClick={() => { setSelected(item); setModal('view'); }}><Eye size={13} /></button>
                      <button className="inv-icon-btn" title="Edit" onClick={() => openEdit(item)}><Edit2 size={13} /></button>
                      <button className="inv-icon-btn danger" title="Delete" onClick={() => askDeleteItem(item)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th style={{ width: 72 }}>Photo</th>
                    <th className="inv-th-sort" onClick={() => toggleSort('name')}>Name {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}</th>
                    <th className="inv-th-sort" onClick={() => toggleSort('category')}>Category {sortBy === 'category' ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}</th>
                    <th>Type</th><th>Size</th>
                    <th className="inv-th-sort" onClick={() => toggleSort('price')}>Price {sortBy === 'price' ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}</th>
                    <th>Status</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 && (
                    <tr><td colSpan={8} className="inv-empty">No items found.</td></tr>
                  )}
                  {displayed.map(item => {
                    const finalPrice = getDisplayPrice(item);
                    const originalPrice = getOriginalPrice(item);
                    const discount = hasDiscount(item);
                    const discountCode = getDiscountInfo(item);
                    const discountValueText = getDiscountValueText(discountCode);
                    const mFiles = getMediaFiles(item);
                    return (
                      <tr key={item.id} className={`inv-tr${discount ? ' inv-tr-promo' : ''}`}>
                        <td>
                          <div className="inv-list-thumb" onClick={() => mFiles.length && setGallery({ item, startIndex: 0 })}>
                            <MediaThumb item={item} className="inv-list-thumb-inner" />
                            {mFiles.length > 0 && <div className="inv-list-thumb-overlay"><Eye size={12} /></div>}
                            {mFiles.length > 1 && <span className="inv-list-photo-count">{mFiles.length}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="inv-item-name">{item.name}</div>
                          {discount && discountCode && (
                            <div className="inv-list-promo-badge">
                              <Sparkles size={9} />
                              <span>{discountCode}</span>
                            </div>
                          )}
                        </td>
                        <td><span className="inv-cat-tag">{item.category}</span></td>
                        <td><span className="inv-subtype-tag">{item.subtype}</span></td>
                        <td>{item.size}</td>
                        <td>
                          {discount ? (
                            <div>
                              <div className="inv-price-old">₱{originalPrice.toLocaleString()}</div>
                              <div className="inv-price-new">₱{Math.round(finalPrice).toLocaleString()}</div>
                            </div>
                          ) : (
                            <span className="inv-price">₱{originalPrice.toLocaleString()}</span>
                          )}
                        </td>
                        <td><StatusBadge status={item.status} /></td>
                        <td>
                          <div className="inv-row-actions">
                            <button className="inv-icon-btn" onClick={() => { setSelected(item); setModal('view'); }}><Eye size={13} /></button>
                            <button className="inv-icon-btn" onClick={() => openEdit(item)}><Edit2 size={13} /></button>
                            <button className="inv-icon-btn danger" onClick={() => askDeleteItem(item)}><Trash2 size={13} /></button>
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
      )}

      {tab === 'promos' && (
        <div className="inv-card">
          {promos.length === 0 && <div className="inv-empty">No promotions yet.</div>}
          <div className="inv-promo-grid">
            {promos.map(promo => {
              const applicable = items.filter(i => promo.items.includes(i.id));
              const now = todayStr();
              const isLive = promo.active && promo.start <= now && promo.end >= now;
              return (
                <div key={promo.id} className={`inv-promo-card${isLive ? ' inv-promo-card-live' : ''}`}>
                  <div className="inv-promo-card-header">
                    <div className="inv-promo-icon">{promo.type === 'percentage' ? <Percent size={15} /> : <DollarSign size={15} />}</div>
                    <div>
                      <div className="inv-promo-code">{promo.code}</div>
                      <div className="inv-promo-value">{promo.type === 'percentage' ? `${promo.value}% off` : `₱${promo.value} off`}</div>
                    </div>
                    <span className={`inv-promo-active ${isLive ? 'on' : 'off'}`}>{isLive ? 'Live' : 'Off'}</span>
                  </div>
                  <div className="inv-promo-dates">{fmtDate(promo.start)} — {fmtDate(promo.end)}</div>
                  {applicable.length > 0 && (
                    <div className="inv-promo-item-thumbs">
                      {applicable.slice(0, 5).map(i => (
                        <div key={i.id} className="inv-promo-item-thumb-wrap" title={i.name}>
                          <MediaThumb item={i} className="inv-promo-item-thumb-img" />
                        </div>
                      ))}
                      {applicable.length > 5 && <div className="inv-promo-item-thumb-more">+{applicable.length - 5}</div>}
                    </div>
                  )}
                  <div className="inv-promo-items">
                    {applicable.map(i => <span key={i.id} className="inv-promo-item-tag">{i.name}</span>)}
                  </div>
                  <div className="inv-promo-card-actions">
                    <button className="inv-btn-sm outline" onClick={() => { setSelected(promo); setPromoForm({ ...promo }); setErrors({}); setModal('promo'); }}><Edit2 size={10} /> Edit</button>
                    <button className="inv-btn-sm danger" onClick={() => askDeletePromo(promo)}><Trash2 size={10} /> Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(modal === 'add' || modal === 'edit') && (
        <div className="inv-overlay" onClick={closeModal}>
          <div className="inv-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-modal-header">
              <h3>{modal === 'add' ? 'Add New Item' : 'Edit Item'}</h3>
              <button className="inv-modal-close" onClick={closeModal} disabled={saving}><X size={15} /></button>
            </div>
            <div className="inv-modal-body">
              <div className="inv-field">
                <label className="inv-field-label">Photos / Videos <span className="inv-required">*</span></label>
                <MediaDropZone
                  files={form.mediaFiles || []}
                  hasError={!!errors.media}
                  onChange={files => { setF({ mediaFiles: files }); setErrors(p => ({ ...p, media: undefined })); }}
                />
                {errors.media && <span className="inv-field-error"><AlertCircle size={11} /> {errors.media}</span>}
              </div>
              <p className="inv-required-note"><span className="inv-required">*</span> Required fields</p>
              <div className="inv-modal-grid">
                <div className="inv-field inv-field-full">
                  <label className="inv-field-label">Item Name <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.name ? ' inv-input-err' : ''}`} value={form.name}
                    onChange={e => { setF({ name: e.target.value }); setErrors(p => ({ ...p, name: undefined })); }}
                    placeholder="e.g. Ivory Lace Ballgown" disabled={saving} />
                  <ErrMsg field="name" />
                </div>
                <div className="inv-field-full inv-modal-grid" style={{ gap: '0.75rem' }}>
                  <div className="inv-field">
                    <label className="inv-field-label">Category <span className="inv-required">*</span></label>
                    <select className={`inv-input${errors.category ? ' inv-input-err' : ''}`} value={form.category}
                      onChange={e => {
                        setF({ category: e.target.value, subtype: '' });
                        setErrors(p => ({ ...p, category: undefined, subtype: undefined }));
                      }}
                      disabled={saving}>
                      <option value="">— Select category —</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <ErrMsg field="category" />
                  </div>
                  {form.category && form.category !== '' && (
                    <div className="inv-field">
                      <label className="inv-field-label">Type / Subtype <span className="inv-required">*</span></label>
                      <select className={`inv-input${errors.subtype ? ' inv-input-err' : ''}`} value={_subtypeSelectVal}
                        onChange={e => {
                          setF({ subtype: e.target.value });
                          setCustomSubtype('');
                          setErrors(p => ({ ...p, subtype: undefined }));
                        }}
                        disabled={saving}>
                        <option value="">— Select type —</option>
                        {_subtypeVisible.map(s => <option key={s}>{s}</option>)}
                      </select>
                      {_subtypeShowCustom && (
                        <input className="inv-input" style={{ marginTop: '0.5rem' }} value={customSubtype}
                          onChange={e => setCustomSubtype(e.target.value)}
                          placeholder="Type new subtype…"
                          disabled={saving} />
                      )}
                      <ErrMsg field="subtype" />
                    </div>
                  )}
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Size <span className="inv-required">*</span></label>
                  <select className={`inv-input${errors.size ? ' inv-input-err' : ''}`} value={form.size}
                    onChange={e => { setF({ size: e.target.value }); setErrors(p => ({ ...p, size: undefined })); }}
                    disabled={saving}>
                    <option value="">— Select size —</option>
                    {SIZES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ErrMsg field="size" />
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Color</label>
                  <div className="inv-color-wrap">
                    <div className="inv-color-swatches">
                      {COLORS.map(c => {
                        const sw = COLOR_SWATCHES[c] || '#ccc';
                        const isLight = LIGHT_COLORS.includes(c);
                        return (
                          <button key={c} type="button"
                            className={`inv-swatch${form.color === c ? ' active' : ''}`}
                            style={{ background: sw, border: isLight ? '1.5px solid #e4e2df' : '1.5px solid transparent' }}
                            title={c} onClick={() => setF({ color: c })} disabled={saving}>
                            {form.color === c && <span className="inv-swatch-check" style={{ color: isLight ? '#555' : '#fff' }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    <input className="inv-input inv-color-input" value={form.color}
                      onChange={e => setF({ color: e.target.value })} placeholder="Or type a color…" disabled={saving} />
                  </div>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Rental Price (₱) <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.price ? ' inv-input-err' : ''}`} type="number" min="0" value={form.price}
                    onChange={e => { setF({ price: e.target.value }); setErrors(p => ({ ...p, price: undefined })); }}
                    placeholder="0" disabled={saving} />
                  <ErrMsg field="price" />
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Status</label>
                  <select className="inv-input" value={form.status} onChange={e => setF({ status: e.target.value })} disabled={saving}>
                    {MANUAL_ITEM_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Estimated Age Range</label>
                  <div className="inv-age-range-wrap">
                    <input className="inv-input inv-age-input" type="number" min="0" max="120"
                      value={form.ageRange?.split('–')[0] || ''}
                      onChange={e => { const from = e.target.value; const to = form.ageRange?.split('–')[1] || ''; setF({ ageRange: from || to ? `${from}–${to}` : '' }); }}
                      placeholder="From" disabled={saving} />
                    <span className="inv-age-sep">–</span>
                    <input className="inv-input inv-age-input" type="number" min="0" max="120"
                      value={form.ageRange?.split('–')[1] || ''}
                      onChange={e => { const to = e.target.value; const from = form.ageRange?.split('–')[0] || ''; setF({ ageRange: from || to ? `${from}–${to}` : '' }); }}
                      placeholder="To" disabled={saving} />
                    <span className="inv-age-unit">yrs</span>
                  </div>
                </div>
                <div className="inv-field inv-field-full">
                  <label className="inv-field-label">Description</label>
                  <textarea className="inv-textarea" rows={3} value={form.description}
                    onChange={e => setF({ description: e.target.value })}
                    placeholder="Describe the item…" disabled={saving} />
                </div>
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="inv-btn-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="inv-btn-primary" onClick={saveItem} disabled={saving}>
                {saving ? <><Loader2 size={13} className="inv-spinner-inline" /> Saving…</> : (modal === 'add' ? 'Add Item' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'view' && selected && (() => {
        const finalPrice = getDisplayPrice(selected);
        const originalPrice = getOriginalPrice(selected);
        const discount = hasDiscount(selected);
        const discountCode = getDiscountInfo(selected);
        const discountValueText = getDiscountValueText(discountCode);
        const savings = getSavings(selected);
        return (
          <div className="inv-overlay" onClick={closeModal}>
            <div className="inv-modal inv-modal-view" onClick={e => e.stopPropagation()}>
              <div className="inv-modal-header">
                <h3>Item Details</h3>
                <button className="inv-modal-close" onClick={closeModal}><X size={15} /></button>
              </div>
              <div className="inv-modal-body">
                <InlineGallery item={selected} onOpenFullscreen={idx => setGallery({ item: selected, startIndex: idx })} />
                <div className="inv-view-details">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h4 className="inv-view-name">{selected.name}</h4>
                    <StatusBadge status={selected.status} />
                  </div>
                  {discount && discountValueText && (
                    <div className="inv-view-promo-banner">
                      <Sparkles size={14} />
                      <div>
                        <div className="inv-view-promo-banner-title">
                          Promo Active: <strong>{discountValueText}</strong>
                        </div>
                        <div className="inv-view-promo-banner-sub">
                          Promo Code: {discountCode} · Savings of ₱{Math.round(savings).toLocaleString()}
                        </div>
                      </div>
                      <div className="inv-view-promo-banner-price">
                        <span className="inv-view-promo-was">₱{originalPrice.toLocaleString()}</span>
                        <span className="inv-view-promo-now">₱{Math.round(finalPrice).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                  <div className="inv-view-grid">
                    {[
                      ['Category', selected.category],
                      ['Type', selected.subtype],
                      ['Size', selected.size],
                      ['Color', selected.color],
                      ['Age Range', selected.ageRange],
                      ['Rental Price', discount
                        ? <><span style={{ textDecoration: 'line-through', color: '#bbb', marginRight: '0.4rem' }}>₱{originalPrice.toLocaleString()}</span><strong style={{ color: '#15803d' }}>₱{Math.round(finalPrice).toLocaleString()}</strong></>
                        : `₱${originalPrice.toLocaleString()}`],
                    ].map(([k, v]) => v ? (
                      <div key={k} className="inv-view-row">
                        <span className="inv-view-key">{k}</span>
                        <span className="inv-view-val">{v}</span>
                      </div>
                    ) : null)}
                  </div>
                  {selected.description && <p className="inv-view-desc">{selected.description}</p>}
                </div>
              </div>
              <div className="inv-modal-footer">
                <button className="inv-btn-ghost" onClick={closeModal}>Close</button>
                <button className="inv-btn-primary" onClick={() => openEdit(selected)}><Edit2 size={13} /> Edit</button>
              </div>
            </div>
          </div>
        );
      })()}

      {modal === 'promo' && (
        <div className="inv-overlay" onClick={closeModal}>
          <div className="inv-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-modal-header">
              <h3>{selected ? 'Edit Promotion' : 'New Promotion'}</h3>
              <button className="inv-modal-close" onClick={closeModal} disabled={saving}><X size={15} /></button>
            </div>
            <div className="inv-modal-body">
              <p className="inv-required-note"><span className="inv-required">*</span> Required fields</p>
              <div className="inv-modal-grid">
                <div className="inv-field">
                  <label className="inv-field-label">Promo Code <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.code ? ' inv-input-err' : ''}`} value={promoForm.code}
                    onChange={e => { setPF({ code: e.target.value.toUpperCase() }); setErrors(p => ({ ...p, code: undefined })); }}
                    placeholder="e.g. SUMMER20" disabled={saving} />
                  <ErrMsg field="code" />
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Discount Type <span className="inv-required">*</span></label>
                  <select className="inv-input" value={promoForm.type} onChange={e => setPF({ type: e.target.value })} disabled={saving}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₱)</option>
                  </select>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Value <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.value ? ' inv-input-err' : ''}`} type="number" min="0" value={promoForm.value}
                    onChange={e => { setPF({ value: e.target.value }); setErrors(p => ({ ...p, value: undefined })); }}
                    placeholder={promoForm.type === 'percentage' ? 'e.g. 20' : 'e.g. 500'} disabled={saving} />
                  <ErrMsg field="value" />
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Status <span className="inv-required">*</span></label>
                  <select className="inv-input" value={String(promoForm.active)} onChange={e => setPF({ active: e.target.value === 'true' })} disabled={saving}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Valid From <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.start ? ' inv-input-err' : ''}`} type="date" value={promoForm.start}
                    onChange={e => { setPF({ start: e.target.value }); setErrors(p => ({ ...p, start: undefined })); }} disabled={saving} />
                  <ErrMsg field="start" />
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Valid Until <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.end ? ' inv-input-err' : ''}`} type="date" min={promoForm.start} value={promoForm.end}
                    onChange={e => { setPF({ end: e.target.value }); setErrors(p => ({ ...p, end: undefined })); }} disabled={saving} />
                  <ErrMsg field="end" />
                </div>
                <div className="inv-field inv-field-full">
                  <label className="inv-field-label">Applicable Items</label>
                  <GroupedItemCheckboxes items={items} selected={promoForm.items} onChange={ids => setPF({ items: ids })} />
                </div>
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="inv-btn-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="inv-btn-primary" onClick={savePromo} disabled={saving}>
                {saving ? <><Loader2 size={13} className="inv-spinner-inline" /> Saving…</> : (selected ? 'Save Changes' : 'Create Promo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="inv-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="inv-modal inv-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="inv-modal-header">
              <h3>Confirm Delete</h3>
              <button className="inv-modal-close" onClick={() => setConfirmDelete(null)}><X size={15} /></button>
            </div>
            <div className="inv-modal-body">
              <div className="inv-confirm-delete-body">
                <div className="inv-confirm-delete-icon">
                  <Trash2 size={28} />
                </div>
                <p className="inv-confirm-delete-msg">
                  Are you sure you want to delete <strong>"{confirmDelete.name}"</strong>?
                </p>
                <p className="inv-confirm-delete-sub">
                  {confirmDelete.type === 'item'
                    ? 'This will permanently remove the item and all its photos from storage. This cannot be undone.'
                    : 'This will permanently remove the promotion. This cannot be undone.'}
                </p>
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="inv-btn-ghost" onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}>Cancel</button>
              <button className="inv-btn-delete-confirm" onClick={(e) => { e.stopPropagation(); handleConfirmedDelete(); }}><Trash2 size={13} /> Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {gallery && <MediaGallery item={gallery.item} startIndex={gallery.startIndex} onClose={() => setGallery(null)} />}
      <Toast toast={toast} />
    </div>
  );
}