import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../../../components/css/adminDashboard/InventoryManagement.css';
import {
  Plus, Search, Edit2, Trash2, Eye, X, Tag, Package, AlertCircle, CheckCircle,
  Percent, DollarSign, Gift, Shirt, LayoutGrid, List, Video, Image, Play, Wrench,
  ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  CATEGORIES, CATEGORY_MAP, SIZES, COLORS, CAT_COLORS,
  ITEM_STATUS_META, MANUAL_ITEM_STATUSES,
  SEED_ITEMS, SEED_PROMOS, todayStr, fmtDate, genId,
} from './sharedData.js';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Normalise any item to a mediaFiles array */
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
  const bg       = CAT_COLORS[item.category] || '#6b2d39';
  const files    = getMediaFiles(item);
  const first    = files[0] || null;

  if (!first) return (
    <div className={`inv-media-placeholder ${className}`} style={{'--cat-color':bg}}>
      <Shirt size={26} style={{ color:bg, opacity:0.55 }}/>
    </div>
  );
  if (first.type === 'video') return (
    <div className={`inv-media-video-thumb ${className}`}>
      <video src={first.url} muted playsInline preload="metadata"
             style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
      <span className="inv-video-badge"><Play size={9} fill="white"/> Video</span>
    </div>
  );
  return <img src={first.url} alt={item.name} className={`inv-media-img ${className}`}/>;
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
// Fullscreen Gallery Lightbox  (animated swipe left/right)
// ────────────────────────────────────────────────────────────
function MediaGallery({ item, startIndex = 0, onClose }) {
  const files      = getMediaFiles(item);
  const [idx,  setIdx]  = useState(startIndex);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'exit-left' | 'exit-right'
  const [next,  setNext]  = useState(null);
  const touchX = useRef(null);

  const go = useCallback((newIdx, dir) => {
    if (phase !== 'idle') return;
    setNext(newIdx);
    setPhase(dir === 'next' ? 'exit-left' : 'exit-right');
  }, [phase]);

  // After exit animation ends, swap slide
  const handleAnimEnd = () => {
    if (phase === 'idle') return;
    setIdx(next);
    setPhase('idle');
    setNext(null);
  };

  const prev = useCallback(() => go((idx - 1 + files.length) % files.length, 'prev'), [idx, files.length, go]);
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
        {/* ── Stage ── */}
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
              : <img   src={current.url} alt={item.name}   className="inv-lightbox-media"/>}
          </div>

          {files.length > 1 && (
            <>
              <button className="inv-gallery-arrow inv-gallery-arrow-prev"
                onClick={e => { e.stopPropagation(); prev(); }}>
                <ChevronLeft size={22}/>
              </button>
              <button className="inv-gallery-arrow inv-gallery-arrow-next"
                onClick={e => { e.stopPropagation(); nextSlide(); }}>
                <ChevronRight size={22}/>
              </button>
            </>
          )}
        </div>

        {/* ── Caption ── */}
        <div className="inv-lightbox-caption">
          <strong>{item.name}</strong>
          <span>{item.category}{item.subtype ? ` · ${item.subtype}` : ''} · Size {item.size} · {item.color}</span>
          {files.length > 1 && <span className="inv-gallery-counter">{idx + 1} / {files.length}</span>}
        </div>

        {/* ── Dot indicators ── */}
        {files.length > 1 && (
          <div className="inv-gallery-dots">
            {files.map((_, i) => (
              <button key={i}
                className={`inv-gallery-dot${i === idx ? ' active' : ''}`}
                onClick={e => { e.stopPropagation(); go(i, i > idx ? 'next' : 'prev'); }}/>
            ))}
          </div>
        )}

        {/* ── Thumbnail strip ── */}
        {files.length > 1 && (
          <div className="inv-gallery-strip">
            {files.map((f, i) => (
              <button key={i}
                className={`inv-gallery-strip-thumb${i === idx ? ' active' : ''}`}
                onClick={e => { e.stopPropagation(); go(i, i > idx ? 'next' : 'prev'); }}>
                {f.type === 'video'
                  ? <div className="inv-gallery-strip-video"><Play size={10} fill="white"/></div>
                  : <img src={f.url} alt={`t${i}`}/>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Inline Gallery  (inside View modal — swipeable + strip)
// ────────────────────────────────────────────────────────────
function InlineGallery({ item, onOpenFullscreen }) {
  const files  = getMediaFiles(item);
  const [idx,   setIdx]   = useState(0);
  const [phase, setPhase] = useState('idle');
  const [next,  setNext]  = useState(null);
  const touchX = useRef(null);

  const go = (newIdx, dir) => {
    if (phase !== 'idle') return;
    setNext(newIdx);
    setPhase(dir === 'next' ? 'exit-left' : 'exit-right');
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
      {/* Main stage */}
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
                style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            : <img src={current.url} alt={item.name}
                style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
        </div>

        <div className="inv-view-gallery-overlay">
          <Eye size={17}/> {current.type === 'video' ? 'Play Video' : 'View Full'}
        </div>

        {files.length > 1 && (
          <>
            <button className="inv-gallery-arrow inv-gallery-arrow-prev sm"
              onClick={e => { e.stopPropagation(); go((idx-1+files.length)%files.length,'prev'); }}>
              <ChevronLeft size={15}/>
            </button>
            <button className="inv-gallery-arrow inv-gallery-arrow-next sm"
              onClick={e => { e.stopPropagation(); go((idx+1)%files.length,'next'); }}>
              <ChevronRight size={15}/>
            </button>
          </>
        )}
        {files.length > 1 && <span className="inv-view-gallery-count">{idx+1}/{files.length}</span>}
      </div>

      {/* Thumbnail strip */}
      {files.length > 1 && (
        <div className="inv-view-gallery-strip">
          {files.map((f, i) => (
            <button key={i}
              className={`inv-view-strip-thumb${i === idx ? ' active' : ''}`}
              onClick={() => go(i, i > idx ? 'next' : 'prev')}>
              {f.type === 'video'
                ? <div className="inv-gallery-strip-video"><Play size={9} fill="white"/></div>
                : <img src={f.url} alt={`t${i}`}/>}
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
        newOnes.push({ url: e.target.result, type: file.type.startsWith('video/') ? 'video' : 'image', name: file.name });
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
      {/* Drop target */}
      <div className={`inv-dropzone${drag?' dragging':''}${hasError?' inv-dropzone-error':''}`}
        onClick={() => ref.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
        <div className="inv-dropzone-hint">
          <div className="inv-dropzone-icons"><Image size={20}/><span>+</span><Video size={20}/></div>
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

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="inv-media-preview-grid">
          {files.map((f, i) => (
            <div key={i} className={`inv-media-preview-item${i===0?' primary':''}`}>
              {f.type === 'video'
                ? <div className="inv-media-preview-video">
                    <video src={f.url} muted preload="metadata" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                    <span className="inv-video-badge"><Play size={8} fill="white"/> Video</span>
                  </div>
                : <img src={f.url} alt={`media-${i}`}/>}
              {i === 0 && <span className="inv-media-preview-primary-badge">Cover</span>}
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
// • Clicking the category checkbox selects-all AND auto-opens
// • Items are further grouped by subtype inside each category
// ────────────────────────────────────────────────────────────
function GroupedItemCheckboxes({ items, selected, onChange }) {
  const [openCats,     setOpenCats]     = useState({});
  const [openSubtypes, setOpenSubtypes] = useState({});

  // Build: { category: { subtype: [items] } }
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

  const catItems   = cat => Object.values(grouped[cat] || {}).flat();
  const isCatAll   = cat => catItems(cat).every(i => selected.includes(i.id));
  const isCatPart  = cat => catItems(cat).some(i => selected.includes(i.id)) && !isCatAll(cat);

  const isStAll    = (cat, st) => (grouped[cat][st] || []).every(i => selected.includes(i.id));
  const isStPart   = (cat, st) => (grouped[cat][st] || []).some(i => selected.includes(i.id)) && !isStAll(cat, st);

  // Clicking category checkbox → toggle all + auto-open if selecting
  const toggleCatAll = cat => {
    const ids = catItems(cat).map(i => i.id);
    const willSelect = !isCatAll(cat);
    willSelect
      ? onChange([...new Set([...selected, ...ids])])
      : onChange(selected.filter(id => !ids.includes(id)));
    // Auto-open when selecting, keep open if already open
    if (willSelect) setOpenCats(p => ({ ...p, [cat]: true }));
  };

  const toggleStAll = (cat, st) => {
    const ids = (grouped[cat][st] || []).map(i => i.id);
    isStAll(cat, st)
      ? onChange(selected.filter(id => !ids.includes(id)))
      : onChange([...new Set([...selected, ...ids])]);
    if (!isStAll(cat, st)) setOpenSubtypes(p => ({ ...p, [`${cat}__${st}`]: true }));
  };

  const toggleItem    = id  => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const toggleCatOpen = cat => setOpenCats(p => ({ ...p, [cat]: !p[cat] }));
  const toggleStOpen  = key => setOpenSubtypes(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="inv-grouped-items">
      {Object.entries(grouped).map(([cat, subtypeMap]) => {
        const allCatItems = catItems(cat);
        const selectedCount = allCatItems.filter(i => selected.includes(i.id)).length;
        const subtypes = Object.keys(subtypeMap);

        return (
          <div key={cat} className="inv-group">
            {/* ── Category row ── */}
            <div className="inv-group-header" onClick={() => toggleCatOpen(cat)}>
              <label className="inv-group-check" onClick={e => e.stopPropagation()}>
                <input type="checkbox"
                  checked={isCatAll(cat)}
                  ref={el => { if (el) el.indeterminate = isCatPart(cat); }}
                  onChange={() => toggleCatAll(cat)}
                  style={{ accentColor:'#6b2d39' }}/>
              </label>
              <span className="inv-group-cat">
                <span className="inv-cat-dot" style={{ background: CAT_COLORS[cat] || '#6b2d39' }}/>
                {cat}
                <span className="inv-group-count">{selectedCount}/{allCatItems.length}</span>
              </span>
              <ChevronDown size={13} className={`inv-group-chevron${openCats[cat] ? ' open' : ''}`}/>
            </div>

            {/* ── Category content: subtypes ── */}
            {openCats[cat] && (
              <div className="inv-group-subtypes">
                {subtypes.map(st => {
                  const stKey   = `${cat}__${st}`;
                  const stItems = subtypeMap[st];
                  const stSelCount = stItems.filter(i => selected.includes(i.id)).length;

                  return (
                    <div key={st} className="inv-subgroup">
                      {/* Subtype header row */}
                      <div className="inv-subgroup-header" onClick={() => toggleStOpen(stKey)}>
                        <label className="inv-group-check" onClick={e => e.stopPropagation()}>
                          <input type="checkbox"
                            checked={isStAll(cat, st)}
                            ref={el => { if (el) el.indeterminate = isStPart(cat, st); }}
                            onChange={() => toggleStAll(cat, st)}
                            style={{ accentColor:'#6b2d39' }}/>
                        </label>
                        <span className="inv-subgroup-label">
                          {st}
                          <span className="inv-group-count">{stSelCount}/{stItems.length}</span>
                        </span>
                        <ChevronDown size={11} className={`inv-group-chevron${openSubtypes[stKey] ? ' open' : ''}`}/>
                      </div>

                      {/* Items under this subtype */}
                      {openSubtypes[stKey] && (
                        <div className="inv-group-items">
                          {stItems.map(item => (
                            <label key={item.id} className="inv-checkbox-item inv-group-item">
                              <input type="checkbox"
                                checked={selected.includes(item.id)}
                                onChange={() => toggleItem(item.id)}
                                style={{ accentColor:'#6b2d39' }}/>
                              <div className="inv-group-item-info">
                                <span className="inv-group-item-name">{item.name}</span>
                                <span className="inv-group-item-sub">Size {item.size} · {item.color} · ₱{item.price.toLocaleString()}</span>
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
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN FRAGMENT
// ════════════════════════════════════════════════════════════
export default function InventoryFragment() {
  const [items,  setItems]  = useState(SEED_ITEMS);
  const [promos, setPromos] = useState(SEED_PROMOS);

  const [categoryMap, setCategoryMap] = useState(() => {
    const map = {};
    CATEGORIES.forEach(cat => { map[cat] = [...(CATEGORY_MAP[cat]||[])]; });
    SEED_ITEMS.forEach(item => {
      if (item.subtype && item.subtype !== 'Others' && map[item.category]) {
        if (!map[item.category].includes(item.subtype)) {
          const oi = map[item.category].indexOf('Others');
          oi >= 0 ? map[item.category].splice(oi,0,item.subtype) : map[item.category].push(item.subtype);
        }
      }
    });
    return map;
  });

  const registerSubtype = (category, subtype) => {
    if (!subtype || subtype==='Others') return;
    setCategoryMap(prev => {
      const list = prev[category]||[];
      if (list.includes(subtype)) return prev;
      const oi = list.indexOf('Others');
      const upd = [...list];
      oi >= 0 ? upd.splice(oi,0,subtype) : upd.push(subtype);
      return { ...prev, [category]: upd };
    });
  };

  const activeCats     = CATEGORIES.filter(cat => items.some(i => i.category === cat));
  const activeSubtypes = cat => {
    const used    = [...new Set(items.filter(i=>i.category===cat).map(i=>i.subtype).filter(Boolean))];
    const ordered = (categoryMap[cat]||[]).filter(s=>used.includes(s));
    used.forEach(s=>{ if(!ordered.includes(s)) ordered.push(s); });
    return ordered;
  };

  const [tab,           setTab]           = useState('items');
  const [viewMode,      setViewMode]      = useState('grid');
  const [search,        setSearch]        = useState('');
  const [filterCat,     setFilterCat]     = useState('All');
  const [filterSubtype, setFilterSubtype] = useState('All');
  const [filterStat,    setFilterStat]    = useState('All');
  const [sortBy,        setSortBy]        = useState('name');
  const [sortDir,       setSortDir]       = useState('asc');
  const [modal,         setModal]         = useState(null);
  const [selected,      setSelected]      = useState(null);
  const [gallery,       setGallery]       = useState(null);   // { item, startIndex }
  const [toast,         setToast]         = useState({ show:false, type:'success', message:'' });
  const [errors,        setErrors]        = useState({});
  const [customSubtype, setCustomSubtype] = useState('');

  const blank      = { name:'', category:'', subtype:'', size:'', color:'Ivory', price:'', status:'Available', mediaFiles:[], ageRange:'', description:'' };
  const blankPromo = { code:'', type:'percentage', value:'', items:[], start:'', end:'', active:true };
  const [form,      setForm]      = useState(blank);
  const [promoForm, setPromoForm] = useState(blankPromo);

  const showToast  = (type, msg) => { setToast({show:true,type,message:msg}); setTimeout(()=>setToast({show:false,type:'success',message:''}),3000); };
  const closeModal = () => { setModal(null); setSelected(null); setErrors({}); setCustomSubtype(''); };
  const setF  = v => setForm(p=>({...p,...v}));
  const setPF = v => setPromoForm(p=>({...p,...v}));

  const filterSubtypes  = filterCat !== 'All' ? activeSubtypes(filterCat) : [];
  const handleFilterCat = cat => { setFilterCat(cat); setFilterSubtype('All'); };

  useEffect(() => {
    if (filterSubtype!=='All' && filterCat!=='All') {
      if (!items.some(i=>i.category===filterCat&&i.subtype===filterSubtype)) setFilterSubtype('All');
    }
    if (filterCat!=='All' && !activeCats.includes(filterCat)) { setFilterCat('All'); setFilterSubtype('All'); }
  }, [items]);

  const validatePromo = () => {
    const e = {};
    if (!promoForm.code.trim())  e.code  = 'Promo code is required.';
    if (!promoForm.value||Number(promoForm.value)<=0) e.value='Value is required.';
    if (!promoForm.start)        e.start = 'Valid From date is required.';
    if (!promoForm.end)          e.end   = 'Valid Until date is required.';
    if (promoForm.start&&promoForm.end&&promoForm.end<promoForm.start) e.end='End date must be after start date.';
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const saveItem = () => {
    const finalSubtype = form.subtype==='Others' ? (customSubtype.trim()||'Others') : form.subtype;
    const finalForm    = { ...form, subtype: finalSubtype };

    const e = {};
    if (!finalForm.mediaFiles?.length)                           e.media    = 'At least one photo or video is required.';
    if (!finalForm.name.trim())                                  e.name     = 'Item name is required.';
    if (!finalForm.category)                                     e.category = 'Category is required.';
    if (!finalForm.subtype||finalForm.subtype==='Others')        e.subtype  = 'Please specify the type.';
    if (!finalForm.size)                                         e.size     = 'Size is required.';
    if (!finalForm.price||Number(finalForm.price)<=0)           e.price    = 'Valid price is required.';
    if (Object.keys(e).length) { setErrors(e); return; }

    const defaultSubs = CATEGORY_MAP[finalForm.category]||[];
    if (finalSubtype && finalSubtype!=='Others' && !defaultSubs.includes(finalSubtype))
      registerSubtype(finalForm.category, finalSubtype);

    if (modal==='add') {
      setItems(p=>[...p, { ...finalForm, id:`I${genId()}`, price:Number(finalForm.price) }]);
      showToast('success','Item added!');
    } else {
      setItems(p=>p.map(i=>i.id===selected.id ? { ...finalForm, id:selected.id, price:Number(finalForm.price) } : i));
      showToast('success','Item updated!');
    }
    closeModal();
  };

  const deleteItem = id => { setItems(p=>p.filter(i=>i.id!==id)); showToast('success','Item deleted.'); };

  const savePromo = () => {
    if (!validatePromo()) return;
    if (selected) {
      setPromos(p=>p.map(x=>x.id===selected.id ? { ...promoForm,id:selected.id,value:Number(promoForm.value) } : x));
      showToast('success','Promo updated!');
    } else {
      setPromos(p=>[...p, { ...promoForm,id:`P${genId()}`,value:Number(promoForm.value) }]);
      showToast('success','Promo created!');
    }
    closeModal();
  };

  const activePromo = item => {
    const now = todayStr();
    return promos.find(p=>p.active&&p.items.includes(item.id)&&p.start<=now&&p.end>=now);
  };
  const discPrice = item => {
    const p = activePromo(item);
    return p ? (p.type==='percentage' ? item.price*(1-p.value/100) : item.price-p.value) : item.price;
  };

  const displayed = items
    .filter(i => {
      const q=search.toLowerCase();
      return (!q||i.name.toLowerCase().includes(q)||i.category.toLowerCase().includes(q)||(i.subtype||'').toLowerCase().includes(q))
        && (filterCat==='All'||i.category===filterCat)
        && (filterSubtype==='All'||i.subtype===filterSubtype)
        && (filterStat==='All'||i.status===filterStat);
    })
    .sort((a,b) => {
      let va=a[sortBy],vb=b[sortBy];
      if(typeof va==='string'){va=va.toLowerCase();vb=vb.toLowerCase();}
      return sortDir==='asc'?(va>vb?1:-1):(va<vb?1:-1);
    });

  const toggleSort = col => { if(sortBy===col) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortBy(col);setSortDir('asc');} };

  const stats = {
    total:       items.length,
    available:   items.filter(i=>i.status==='Available').length,
    leased:      items.filter(i=>i.status==='Leased').length,
    maintenance: items.filter(i=>i.status==='Maintenance').length,
  };

  const ErrMsg = ({ field }) => errors[field] ? <span className="inv-field-error">{errors[field]}</span> : null;

  // Subtype dropdown helpers for add/edit modal
  const _subtypeUsed    = form.category ? [...new Set(items.filter(i=>i.category===form.category&&i.subtype&&i.subtype!=='Others').map(i=>i.subtype))] : [];
  const _subtypeFull    = form.category ? [...(categoryMap[form.category]||[])] : [];
  const _subtypeVisible = _subtypeFull.filter(s=>s==='Others'||_subtypeUsed.includes(s));
  if (selected?.subtype&&selected.subtype!=='Others'&&!_subtypeVisible.includes(selected.subtype)) {
    const _idx=_subtypeVisible.indexOf('Others');
    _idx>=0?_subtypeVisible.splice(_idx,0,selected.subtype):_subtypeVisible.push(selected.subtype);
  }
  const _subtypeSelectVal  = _subtypeVisible.includes(form.subtype)?form.subtype:(form.subtype&&form.subtype!=='Others'?'Others':(form.subtype||''));
  const _subtypeShowCustom = form.subtype==='Others';

  // ── Open edit from view modal ──
  const openEdit = item => {
    const defaultSubs = CATEGORY_MAP[item.category]||[];
    const isCustom = item.subtype && !defaultSubs.includes(item.subtype) && item.subtype!=='Others';
    setCustomSubtype(isCustom ? item.subtype : '');
    closeModal();
    setForm({ ...item, mediaFiles: getMediaFiles(item) });
    setSelected(item); setErrors({}); setModal('edit');
  };

  return (
    <div className="inv-root">

      {/* ── Header ── */}
      <div className="inv-top">
        <div>
          <h2 className="inv-title">Inventory</h2>
          <p className="inv-subtitle">Manage event wear items and active promotions</p>
        </div>
        <div className="inv-header-actions">
          {tab==='items'  && <button className="inv-btn-primary" onClick={()=>{ setForm(blank); setErrors({}); setModal('add'); }}><Plus size={14}/> Add Item</button>}
          {tab==='promos' && <button className="inv-btn-primary" onClick={()=>{ setSelected(null); setPromoForm(blankPromo); setErrors({}); setModal('promo'); }}><Plus size={14}/> New Promo</button>}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="inv-stats">
        {[
          { label:'Total Items',  value:stats.total,       icon:Package,     color:'#6b2d39' },
          { label:'Available',    value:stats.available,   icon:CheckCircle, color:'#15803d' },
          { label:'Out on Lease', value:stats.leased,      icon:Tag,         color:'#b45309' },
          { label:'Maintenance',  value:stats.maintenance, icon:Wrench,      color:'#9a3412' },
        ].map(({ label,value,icon:Icon,color }) => (
          <div className="inv-stat-card" key={label}>
            <div className="inv-stat-icon" style={{ background:`${color}18`,color }}><Icon size={18}/></div>
            <div><div className="inv-stat-value">{value}</div><div className="inv-stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="inv-tabs">
        {[{key:'items',label:'Items',icon:Package},{key:'promos',label:'Promotions',icon:Gift}].map(({key,label,icon:Icon})=>(
          <button key={key} className={`inv-tab${tab===key?' active':''}`} onClick={()=>setTab(key)}><Icon size={13}/> {label}</button>
        ))}
      </div>

      {/* ════ ITEMS TAB ════ */}
      {tab==='items' && (
        <div className="inv-card">
          {/* Toolbar */}
          <div className="inv-toolbar">
            <div className="inv-search-wrap">
              <Search size={13} className="inv-search-icon"/>
              <input className="inv-search" placeholder="Search items…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="inv-filters">
              <select className="inv-select" value={filterCat} onChange={e=>handleFilterCat(e.target.value)}>
                <option value="All">All Categories</option>
                {activeCats.map(c=><option key={c}>{c}</option>)}
              </select>
              {filterCat!=='All'&&filterSubtypes.length>0&&(
                <select className="inv-select" value={filterSubtype} onChange={e=>setFilterSubtype(e.target.value)}>
                  <option value="All">All {filterCat}</option>
                  {filterSubtypes.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <select className="inv-select" value={filterStat} onChange={e=>setFilterStat(e.target.value)}>
                <option value="All">All Statuses</option>
                {Object.keys(ITEM_STATUS_META).map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="inv-view-toggle">
              <button className={`inv-view-btn${viewMode==='grid'?' active':''}`} onClick={()=>setViewMode('grid')} title="Grid"><LayoutGrid size={15}/></button>
              <button className={`inv-view-btn${viewMode==='list'?' active':''}`} onClick={()=>setViewMode('list')} title="List"><List size={15}/></button>
            </div>
          </div>

          {/* Grid */}
          {viewMode==='grid' && (
            <div className="inv-grid">
              {displayed.length===0 && <div className="inv-empty-grid">No items found.</div>}
              {displayed.map(item => {
                const promo=activePromo(item), disc=discPrice(item);
                const mFiles=getMediaFiles(item);
                return (
                  <div key={item.id} className="inv-grid-card">
                    <div className="inv-grid-media" onClick={()=>mFiles.length&&setGallery({item,startIndex:0})}>
                      <MediaThumb item={item} className="inv-grid-media-inner"/>
                      {mFiles.length>0&&<div className="inv-grid-media-overlay"><Eye size={16}/> View</div>}
                      {mFiles.length>1&&<span className="inv-grid-photo-count"><Image size={9}/> {mFiles.length}</span>}
                      <div className="inv-grid-status-pin"><StatusBadge status={item.status}/></div>
                      {promo&&<div className="inv-grid-promo-pin"><Tag size={9}/> {promo.code}</div>}
                    </div>
                    <div className="inv-grid-info">
                      <div className="inv-grid-name">{item.name}</div>
                      <div className="inv-grid-meta">
                        <span className="inv-cat-tag">{item.category}</span>
                        {item.subtype&&<span className="inv-subtype-tag">{item.subtype}</span>}
                        <span className="inv-grid-size">{item.size}</span>
                      </div>
                      <div className="inv-grid-price-row">
                        {promo?<><span className="inv-price-old">₱{item.price.toLocaleString()}</span><span className="inv-price-new">₱{Math.round(disc).toLocaleString()}</span></>:<span className="inv-price">₱{item.price.toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="inv-grid-actions">
                      <button className="inv-icon-btn" title="View"   onClick={()=>{ setSelected(item); setModal('view'); }}><Eye size={13}/></button>
                      <button className="inv-icon-btn" title="Edit"   onClick={()=>openEdit(item)}><Edit2 size={13}/></button>
                      <button className="inv-icon-btn danger" title="Delete" onClick={()=>deleteItem(item.id)}><Trash2 size={13}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List */}
          {viewMode==='list' && (
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th style={{width:68}}>Media</th>
                    <th className="inv-th-sort" onClick={()=>toggleSort('name')}>Name {sortBy==='name'?(sortDir==='asc'?'↑':'↓'):<span style={{opacity:0.3}}>↕</span>}</th>
                    <th className="inv-th-sort" onClick={()=>toggleSort('category')}>Category {sortBy==='category'?(sortDir==='asc'?'↑':'↓'):<span style={{opacity:0.3}}>↕</span>}</th>
                    <th>Type</th><th>Size</th>
                    <th className="inv-th-sort" onClick={()=>toggleSort('price')}>Price {sortBy==='price'?(sortDir==='asc'?'↑':'↓'):<span style={{opacity:0.3}}>↕</span>}</th>
                    <th>Status</th><th style={{width:100}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.length===0&&<tr><td colSpan={8} className="inv-empty">No items found.</td></tr>}
                  {displayed.map(item => {
                    const promo=activePromo(item),disc=discPrice(item);
                    const mFiles=getMediaFiles(item);
                    return (
                      <tr key={item.id} className="inv-tr">
                        <td>
                          <div className="inv-list-thumb" onClick={()=>mFiles.length&&setGallery({item,startIndex:0})}>
                            <MediaThumb item={item} className="inv-list-thumb-inner"/>
                            {mFiles.length>0&&<div className="inv-list-thumb-overlay"><Eye size={12}/></div>}
                            {mFiles.length>1&&<span className="inv-list-photo-count">{mFiles.length}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="inv-item-name">{item.name}</div>
                          {promo&&<span className="inv-promo-tag"><Tag size={9}/> {promo.code}</span>}
                        </td>
                        <td><span className="inv-cat-tag">{item.category}</span></td>
                        <td><span className="inv-subtype-tag">{item.subtype}</span></td>
                        <td>{item.size}</td>
                        <td>{promo?<div><div className="inv-price-old">₱{item.price.toLocaleString()}</div><div className="inv-price-new">₱{Math.round(disc).toLocaleString()}</div></div>:<span className="inv-price">₱{item.price.toLocaleString()}</span>}</td>
                        <td><StatusBadge status={item.status}/></td>
                        <td><div className="inv-row-actions">
                          <button className="inv-icon-btn" onClick={()=>{ setSelected(item); setModal('view'); }}><Eye size={13}/></button>
                          <button className="inv-icon-btn" onClick={()=>openEdit(item)}><Edit2 size={13}/></button>
                          <button className="inv-icon-btn danger" onClick={()=>deleteItem(item.id)}><Trash2 size={13}/></button>
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════ PROMOS TAB ════ */}
      {tab==='promos' && (
        <div className="inv-card">
          {promos.length===0&&<div className="inv-empty">No promotions yet.</div>}
          <div className="inv-promo-grid">
            {promos.map(promo => {
              const applicable=items.filter(i=>promo.items.includes(i.id));
              return (
                <div key={promo.id} className="inv-promo-card">
                  <div className="inv-promo-card-header">
                    <div className="inv-promo-icon">{promo.type==='percentage'?<Percent size={15}/>:<DollarSign size={15}/>}</div>
                    <div>
                      <div className="inv-promo-code">{promo.code}</div>
                      <div className="inv-promo-value">{promo.type==='percentage'?`${promo.value}% off`:`₱${promo.value} off`}</div>
                    </div>
                    <span className={`inv-promo-active ${promo.active?'on':'off'}`}>{promo.active?'Active':'Off'}</span>
                  </div>
                  <div className="inv-promo-dates">{fmtDate(promo.start)} — {fmtDate(promo.end)}</div>
                  <div className="inv-promo-items">{applicable.map(i=><span key={i.id} className="inv-promo-item-tag">{i.name}</span>)}</div>
                  <div className="inv-promo-card-actions">
                    <button className="inv-btn-sm outline" onClick={()=>{ setSelected(promo); setPromoForm({...promo}); setErrors({}); setModal('promo'); }}><Edit2 size={10}/> Edit</button>
                    <button className="inv-btn-sm danger"  onClick={()=>{ setPromos(p=>p.filter(x=>x.id!==promo.id)); showToast('success','Promo deleted.'); }}><Trash2 size={10}/> Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ MODAL: Add / Edit Item ══ */}
      {(modal==='add'||modal==='edit') && (
        <div className="inv-overlay" onClick={closeModal}>
          <div className="inv-modal" onClick={e=>e.stopPropagation()}>
            <div className="inv-modal-header">
              <h3>{modal==='add'?'Add New Item':'Edit Item'}</h3>
              <button className="inv-modal-close" onClick={closeModal}><X size={15}/></button>
            </div>
            <div className="inv-modal-body">

              {/* Multi-photo upload */}
              <div className="inv-field">
                <label className="inv-field-label">Photos / Videos <span className="inv-required">*</span></label>
                <MediaDropZone
                  files={form.mediaFiles||[]}
                  hasError={!!errors.media}
                  onChange={files=>{ setF({mediaFiles:files}); setErrors(p=>({...p,media:undefined})); }}
                />
                {errors.media&&<span className="inv-field-error"><AlertCircle size={11}/> {errors.media}</span>}
              </div>

              <p className="inv-required-note"><span className="inv-required">*</span> Required fields</p>

              <div className="inv-modal-grid">
                {/* Name */}
                <div className="inv-field inv-field-full">
                  <label className="inv-field-label">Item Name <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.name?' inv-input-err':''}`} value={form.name} onChange={e=>setF({name:e.target.value})} placeholder="e.g. Ivory Lace Ballgown"/>
                  <ErrMsg field="name"/>
                </div>

                {/* Category + Subtype */}
                <div className="inv-field-full inv-modal-grid" style={{gap:'0.75rem'}}>
                  <div className="inv-field">
                    <label className="inv-field-label">Category <span className="inv-required">*</span></label>
                    <select className={`inv-input${errors.category?' inv-input-err':''}`} value={form.category}
                      onChange={e=>{ setF({category:e.target.value,subtype:''}); setErrors(p=>({...p,category:undefined,subtype:undefined})); }}>
                      <option value="">— Select category —</option>
                      {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                    <ErrMsg field="category"/>
                  </div>
                  {form.category&&(
                    <div className="inv-field">
                      <label className="inv-field-label">Type / Subtype <span className="inv-required">*</span></label>
                      <select className={`inv-input${errors.subtype?' inv-input-err':''}`} value={_subtypeSelectVal}
                        onChange={e=>{ setF({subtype:e.target.value}); setCustomSubtype(''); setErrors(p=>({...p,subtype:undefined})); }}>
                        <option value="">— Select type —</option>
                        {_subtypeVisible.map(s=><option key={s}>{s}</option>)}
                      </select>
                      {_subtypeShowCustom&&(
                        <input className="inv-input" style={{marginTop:'0.5rem'}} value={customSubtype}
                          onChange={e=>setCustomSubtype(e.target.value)} placeholder="Type new subtype…"/>
                      )}
                      <ErrMsg field="subtype"/>
                    </div>
                  )}
                </div>

                {/* Size */}
                <div className="inv-field">
                  <label className="inv-field-label">Size <span className="inv-required">*</span></label>
                  <select className={`inv-input${errors.size?' inv-input-err':''}`} value={form.size}
                    onChange={e=>{ setF({size:e.target.value}); setErrors(p=>({...p,size:undefined})); }}>
                    <option value="">— Select size —</option>
                    {SIZES.map(s=><option key={s}>{s}</option>)}
                  </select>
                  <ErrMsg field="size"/>
                </div>

                {/* Color */}
                <div className="inv-field">
                  <label className="inv-field-label">Color</label>
                  <div className="inv-color-wrap">
                    <div className="inv-color-swatches">
                      {COLORS.map(c => {
                        const sw={Ivory:'#fffff0',Black:'#1a1a1a',Navy:'#001f5b',Burgundy:'#6b2d39',Champagne:'#f7e7ce',Emerald:'#50c878','Rose Gold':'#b76e79',Silver:'#c0c0c0'}[c]||'#ccc';
                        return (
                          <button key={c} type="button" className={`inv-swatch${form.color===c?' active':''}`}
                            style={{background:sw,border:['Ivory','Champagne','Silver'].includes(c)?'1.5px solid #e4e2df':'1.5px solid transparent'}}
                            title={c} onClick={()=>setF({color:c})}>
                            {form.color===c&&<span className="inv-swatch-check" style={{color:['Ivory','Champagne','Silver'].includes(c)?'#555':'#fff'}}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    <input className="inv-input inv-color-input" value={form.color} onChange={e=>setF({color:e.target.value})} placeholder="Or type a color…"/>
                  </div>
                </div>

                {/* Price */}
                <div className="inv-field">
                  <label className="inv-field-label">Rental Price (₱) <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.price?' inv-input-err':''}`} type="number" min="0" value={form.price}
                    onChange={e=>{ setF({price:e.target.value}); setErrors(p=>({...p,price:undefined})); }} placeholder="0"/>
                  <ErrMsg field="price"/>
                </div>

                {/* Status */}
                <div className="inv-field">
                  <label className="inv-field-label">Status</label>
                  <select className="inv-input" value={form.status} onChange={e=>setF({status:e.target.value})}>
                    {MANUAL_ITEM_STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                  <span className="inv-field-hint">Note: "Ready for Rental" is set automatically after inspection.</span>
                </div>

                {/* Estimated Age Range — optional */}
                <div className="inv-field">
                  <label className="inv-field-label">
                    Estimated Age Range
                    <span className="inv-optional-tag">optional</span>
                  </label>
                  <div className="inv-age-range-wrap">
                    <input
                      className="inv-input inv-age-input"
                      type="number" min="0" max="120"
                      value={form.ageRange?.split('–')[0] || ''}
                      onChange={e => {
                        const from = e.target.value;
                        const to   = form.ageRange?.split('–')[1] || '';
                        setF({ ageRange: from || to ? `${from}–${to}` : '' });
                      }}
                      placeholder="From"
                    />
                    <span className="inv-age-sep">–</span>
                    <input
                      className="inv-input inv-age-input"
                      type="number" min="0" max="120"
                      value={form.ageRange?.split('–')[1] || ''}
                      onChange={e => {
                        const to   = e.target.value;
                        const from = form.ageRange?.split('–')[0] || '';
                        setF({ ageRange: from || to ? `${from}–${to}` : '' });
                      }}
                      placeholder="To"
                    />
                    <span className="inv-age-unit">yrs</span>
                  </div>
                  <span className="inv-field-hint">e.g. 18–35 yrs — helps clients find the right fit</span>
                </div>

                {/* Description */}
                <div className="inv-field inv-field-full">
                  <label className="inv-field-label">Description</label>
                  <textarea className="inv-textarea" rows={3} value={form.description} onChange={e=>setF({description:e.target.value})} placeholder="Describe the item…"/>
                </div>
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="inv-btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="inv-btn-primary" onClick={saveItem}>{modal==='add'?'Add Item':'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: View Item ══ */}
      {modal==='view' && selected && (
        <div className="inv-overlay" onClick={closeModal}>
          <div className="inv-modal inv-modal-view" onClick={e=>e.stopPropagation()}>
            <div className="inv-modal-header">
              <h3>Item Details</h3>
              <button className="inv-modal-close" onClick={closeModal}><X size={15}/></button>
            </div>
            <div className="inv-modal-body">
              {/* Swipeable inline gallery */}
              <InlineGallery
                item={selected}
                onOpenFullscreen={idx => setGallery({ item: selected, startIndex: idx })}
              />
              <div className="inv-view-details">
                <div style={{display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap'}}>
                  <h4 className="inv-view-name">{selected.name}</h4>
                  <StatusBadge status={selected.status}/>
                </div>
                <div className="inv-view-grid">
                  {[['Category',selected.category],['Type',selected.subtype],['Size',selected.size],['Color',selected.color],['Age Range',selected.ageRange],['Rental Price',`₱${selected.price.toLocaleString()}`]].map(([k,v])=>v?(
                    <div key={k} className="inv-view-row"><span className="inv-view-key">{k}</span><span className="inv-view-val">{v}</span></div>
                  ):null)}
                </div>
                {selected.description&&<p className="inv-view-desc">{selected.description}</p>}
                {activePromo(selected)&&(
                  <div className="inv-view-promo"><Gift size={12}/><span>Promo <strong>{activePromo(selected).code}</strong> — <strong>₱{Math.round(discPrice(selected)).toLocaleString()}</strong> after discount</span></div>
                )}
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="inv-btn-ghost" onClick={closeModal}>Close</button>
              <button className="inv-btn-primary" onClick={()=>openEdit(selected)}><Edit2 size={13}/> Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Promo ══ */}
      {modal==='promo' && (
        <div className="inv-overlay" onClick={closeModal}>
          <div className="inv-modal" onClick={e=>e.stopPropagation()}>
            <div className="inv-modal-header">
              <h3>{selected?'Edit Promotion':'New Promotion'}</h3>
              <button className="inv-modal-close" onClick={closeModal}><X size={15}/></button>
            </div>
            <div className="inv-modal-body">
              <p className="inv-required-note"><span className="inv-required">*</span> Required fields</p>
              <div className="inv-modal-grid">
                <div className="inv-field">
                  <label className="inv-field-label">Promo Code <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.code?' inv-input-err':''}`} value={promoForm.code}
                    onChange={e=>{ setPF({code:e.target.value.toUpperCase()}); setErrors(p=>({...p,code:undefined})); }} placeholder="e.g. SUMMER20"/>
                  <ErrMsg field="code"/>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Discount Type <span className="inv-required">*</span></label>
                  <select className="inv-input" value={promoForm.type} onChange={e=>setPF({type:e.target.value})}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₱)</option>
                  </select>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Value <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.value?' inv-input-err':''}`} type="number" min="0" value={promoForm.value}
                    onChange={e=>{ setPF({value:e.target.value}); setErrors(p=>({...p,value:undefined})); }}
                    placeholder={promoForm.type==='percentage'?'e.g. 20':'e.g. 500'}/>
                  <ErrMsg field="value"/>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Status <span className="inv-required">*</span></label>
                  <select className="inv-input" value={String(promoForm.active)} onChange={e=>setPF({active:e.target.value==='true'})}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  <span className="inv-field-hint">Inactive promos won't apply even if dates are valid.</span>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Valid From <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.start?' inv-input-err':''}`} type="date" value={promoForm.start}
                    onChange={e=>{ setPF({start:e.target.value}); setErrors(p=>({...p,start:undefined})); }}/>
                  <ErrMsg field="start"/>
                </div>
                <div className="inv-field">
                  <label className="inv-field-label">Valid Until <span className="inv-required">*</span></label>
                  <input className={`inv-input${errors.end?' inv-input-err':''}`} type="date" min={promoForm.start} value={promoForm.end}
                    onChange={e=>{ setPF({end:e.target.value}); setErrors(p=>({...p,end:undefined})); }}/>
                  <ErrMsg field="end"/>
                </div>
                <div className="inv-field inv-field-full">
                  <label className="inv-field-label">Applicable Items</label>
                  <span className="inv-field-hint" style={{marginBottom:'0.5rem',display:'block'}}>
                    Expand a category to select specific items. Select the category checkbox to toggle all.
                  </span>
                  <GroupedItemCheckboxes items={items} selected={promoForm.items} onChange={ids=>setPF({items:ids})}/>
                  {promoForm.items.length>0&&(
                    <div className="inv-promo-selected-count">
                      <CheckCircle size={11}/> {promoForm.items.length} item{promoForm.items.length!==1?'s':''} selected
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="inv-btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="inv-btn-primary" onClick={savePromo}>{selected?'Save Changes':'Create Promo'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen gallery */}
      {gallery && <MediaGallery item={gallery.item} startIndex={gallery.startIndex} onClose={()=>setGallery(null)}/>}
      <Toast toast={toast}/>
    </div>
  );
}