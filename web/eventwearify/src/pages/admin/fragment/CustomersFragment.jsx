import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  Search, Users, UserCheck, UserX,
  ChevronLeft, ChevronRight,
  Mail, Calendar, MoreHorizontal, Filter,
  Eye, UserMinus, UserPlus, Loader2, AlertCircle,
} from 'lucide-react';
import { fetchCustomers, updateCustomerStatus } from '../../../services/customerService';
import '../../../components/css/adminDashboard/CustomersFragment.css';

/* ── helpers ─────────────────────────────────────────────── */
const getInitials = (f, l) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();
const formatDate  = (s) => s
  ? new Date(s).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
  : '—';

const AVATAR_COLORS = ['#6b2d39','#8b3a4a','#a34f60','#4a1f28','#7a3040','#5c2433','#92455a','#3d1820'];
const getAvatarColor = (id) => {
  const n = id ? [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0) : 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
};

const getPageNumbers = (page, totalPages) => {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  let start = Math.max(1, page - 1);
  let end   = Math.min(totalPages, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

const PAGE_SIZE = 8;

/* ── Memoized Row Component ─────────────────────────────── */
const CustomerRow = React.memo(({ customer, index, openMenu, setOpenMenu, togglingId, handleToggleStatus, btnRefs }) => {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (openMenu !== customer.id || !btnRefs.current[customer.id]) return;
    const rect = btnRefs.current[customer.id].getBoundingClientRect();
    setPos({
      top:  rect.bottom + window.scrollY + 6,
      left: rect.right  + window.scrollX - 210,
    });
  }, [openMenu, customer.id]);

  return (
    <div
      key={customer.id}
      className={`cf-row${togglingId === customer.id ? ' toggling' : ''}`}
      style={{ animationDelay: `${index * 20}ms` }}
    >
      <div className="cf-td col-customer">
        <div className="cf-customer-cell">
          <div className="cf-avatar" style={{ background: getAvatarColor(customer.id) }}>
            {getInitials(customer.firstName, customer.lastName)}
          </div>
          <span className="cf-name">{customer.firstName} {customer.lastName}</span>
        </div>
      </div>
      <div className="cf-td col-email">
        <div className="cf-email-cell">
          <Mail size={13} className="cf-email-icon" />
          {customer.email}
        </div>
      </div>
      <div className="cf-td col-joined">
        <div className="cf-date-cell">
          <Calendar size={13} className="cf-date-icon" />
          {formatDate(customer.createdAt)}
        </div>
      </div>
      <div className="cf-td col-status">
        <span className={`cf-badge ${customer.active ? 'active' : 'inactive'}`}>
          {customer.active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="cf-td col-action">
        <div className="cf-actions-wrap">
          <button
            ref={el => btnRefs.current[customer.id] = el}
            className={`cf-menu-btn${openMenu === customer.id ? ' open' : ''}`}
            onClick={() => setOpenMenu(openMenu === customer.id ? null : customer.id)}
            disabled={togglingId === customer.id}
          >
            {togglingId === customer.id
              ? <Loader2 size={15} className="cf-spin" />
              : <MoreHorizontal size={16} />
            }
          </button>

          {openMenu === customer.id && (
            <DropdownContent
              customer={customer}
              togglingId={togglingId}
              handleToggleStatus={handleToggleStatus}
              setOpenMenu={setOpenMenu}
              pos={pos}
            />
          )}
        </div>
      </div>
    </div>
  );
});

CustomerRow.displayName = 'CustomerRow';

/* ── Memoized Dropdown Content ─────────────────────────── */
const DropdownContent = React.memo(({ customer, togglingId, handleToggleStatus, setOpenMenu, pos }) => {
  const portalRoot = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.cf-dropdown')) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setOpenMenu]);

  return ReactDOM.createPortal(
    <div className="cf-dropdown" style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}>
      <div className="cf-dropdown-header">
        <div className="cf-dropdown-avatar" style={{ background: getAvatarColor(customer.id) }}>
          {getInitials(customer.firstName, customer.lastName)}
        </div>
        <div className="cf-dropdown-info">
          <span className="cf-dropdown-name">{customer.firstName} {customer.lastName}</span>
          <span className={`cf-dropdown-status ${customer.active ? 'active' : 'inactive'}`}>
            {customer.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
      <div className="cf-dropdown-divider" />
      <button className="cf-dropdown-item" onClick={() => setOpenMenu(null)}>
        <Eye size={14} className="cf-dropdown-icon" />
        View Details
      </button>
      <button
        className={`cf-dropdown-item ${customer.active ? 'danger' : 'success'}`}
        onClick={() => handleToggleStatus(customer)}
        disabled={togglingId === customer.id}
      >
        {customer.active
          ? <><UserMinus size={14} className="cf-dropdown-icon" />Deactivate</>
          : <><UserPlus  size={14} className="cf-dropdown-icon" />Activate</>
        }
      </button>
    </div>,
    document.body
  );
});

DropdownContent.displayName = 'DropdownContent';

/* ── Main component ──────────────────────────────────────── */
export default function CustomersFragment() {
  const [customers,  setCustomers]  = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error,      setError]      = useState(null);

  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');
  const [page,       setPage]       = useState(1);

  const [openMenu,   setOpenMenu]   = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });

  const btnRefs           = useRef({});
  const searchTimer       = useRef(null);
  const statsTimer        = useRef(null);
  const abortController   = useRef(new AbortController());

  /* ── Optimized page loader with abort support ─────────── */
  const loadPage = useCallback(async (p, s, f) => {
    // Cancel previous request
    abortController.current.abort();
    abortController.current = new AbortController();

    setError(null);
    try {
      const status = f === 'all' ? '' : f;
      const data = await fetchCustomers({ 
        page: p - 1, 
        size: PAGE_SIZE, 
        search: s, 
        status,
        signal: abortController.current.signal
      });
      
      setCustomers(data.content);
      setTotalItems(data.totalElements);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    }
  }, []);

  /* ── Optimized stats loader with debounce ──────────────── */
  const loadStats = useCallback(async () => {
    try {
      const [all, active, inactive] = await Promise.all([
        fetchCustomers({ page: 0, size: 1, search: '', status: '' }),
        fetchCustomers({ page: 0, size: 1, search: '', status: 'active' }),
        fetchCustomers({ page: 0, size: 1, search: '', status: 'inactive' }),
      ]);
      setStats({
        total:    all.totalElements,
        active:   active.totalElements,
        inactive: inactive.totalElements,
      });
    } catch (_) { /* non-critical */ }
  }, []);

  /* ── Parallel initial load ───────────────────────────── */
  useEffect(() => {
    // Load page and stats in parallel
    Promise.all([
      loadPage(1, '', 'all'),
      loadStats()
    ]);

    return () => {
      abortController.current.abort();
      clearTimeout(searchTimer.current);
      clearTimeout(statsTimer.current);
    };
  }, [loadPage, loadStats]);

  /* ── Debounced search (200ms for faster response) ────── */
  const handleSearch = useCallback((e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadPage(1, val, filter);
    }, 200);
  }, [filter, loadPage]);

  /* ── Instant filter with no debounce ────────────────── */
  const handleFilter = useCallback((f) => {
    setFilter(f);
    setPage(1);
    loadPage(1, search, f);
  }, [search, loadPage]);

  /* ── Pagination without delay ───────────────────────── */
  const handlePage = useCallback((p) => {
    setPage(p);
    loadPage(p, search, filter);
  }, [search, filter, loadPage]);

  /* ── Toggle status with optimistic update ──────────── */
  const handleToggleStatus = useCallback(async (customer) => {
    setOpenMenu(null);
    setTogglingId(customer.id);
    
    try {
      const updated = await updateCustomerStatus(customer.id, !customer.active);
      
      // Update immediately
      setCustomers(prev => 
        prev.map(c => c.id === updated.id ? updated : c)
      );
      
      // Refresh stats
      clearTimeout(statsTimer.current);
      statsTimer.current = setTimeout(loadStats, 100);
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  }, [loadStats]);

  /* ── Memoized page numbers ──────────────────────────── */
  const pageNums = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages]);
  
  const start = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end   = Math.min(page * PAGE_SIZE, totalItems);

  return (
    <div className="cf-root">

      {/* ── Top block ── */}
      <div className="cf-top">
        <div className="cf-header">
          <div>
            <h2 className="cf-title">Customers</h2>
            <p className="cf-subtitle">All registered users on the platform</p>
          </div>
        </div>

        <div className="cf-stats">
          <div className="cf-stat-card">
            <div className="cf-stat-icon total"><Users size={18} /></div>
            <div>
              <p className="cf-stat-value">{stats.total}</p>
              <p className="cf-stat-label">Total Customers</p>
            </div>
          </div>
          <div className="cf-stat-card">
            <div className="cf-stat-icon active"><UserCheck size={18} /></div>
            <div>
              <p className="cf-stat-value">{stats.active}</p>
              <p className="cf-stat-label">Active</p>
            </div>
          </div>
          <div className="cf-stat-card">
            <div className="cf-stat-icon inactive"><UserX size={18} /></div>
            <div>
              <p className="cf-stat-value">{stats.inactive}</p>
              <p className="cf-stat-label">Inactive</p>
            </div>
          </div>
        </div>

        <div className="cf-toolbar">
          <div className="cf-search-wrap">
            <Search size={15} className="cf-search-icon" />
            <input
              className="cf-search"
              placeholder="Search by name or email…"
              value={search}
              onChange={handleSearch}
            />
          </div>
          <div className="cf-filters">
            <Filter size={14} style={{ color: '#999' }} />
            {['all', 'active', 'inactive'].map(f => (
              <button
                key={f}
                className={`cf-filter-btn${filter === f ? ' active' : ''}`}
                onClick={() => handleFilter(f)}
              >
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="cf-table-card">

        <div className="cf-thead">
          <div className="cf-thead-row">
            <span className="cf-th col-customer">Customer</span>
            <span className="cf-th col-email">Email</span>
            <span className="cf-th col-joined">Joined</span>
            <span className="cf-th col-status">Status</span>
            <span className="cf-th col-action"></span>
          </div>
        </div>

        <div className="cf-tbody">

          {error && (
            <div className="cf-state-row error">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button className="cf-retry-btn" onClick={() => loadPage(page, search, filter)}>
                Retry
              </button>
            </div>
          )}

          {!error && customers.length === 0 && (
            <div className="cf-empty">No customers found.</div>
          )}

          {!error && customers.map((c, i) => (
            <CustomerRow
              key={c.id}
              customer={c}
              index={i}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              togglingId={togglingId}
              handleToggleStatus={handleToggleStatus}
              btnRefs={btnRefs}
            />
          ))}

        </div>
      </div>

      {/* ── Pagination ── */}
      {!error && totalItems > 0 && (
        <div className="cf-pagination">
          <span className="cf-page-info">Showing {start}–{end} of {totalItems}</span>
          <div className="cf-page-btns">
            <button className="cf-page-btn" disabled={page === 1} onClick={() => handlePage(page - 1)}>
              <ChevronLeft size={15} />
            </button>
            {pageNums[0] > 1 && (
              <>
                <button className="cf-page-btn num" onClick={() => handlePage(1)}>1</button>
                {pageNums[0] > 2 && <span className="cf-page-ellipsis">…</span>}
              </>
            )}
            {pageNums.map(n => (
              <button key={n} className={`cf-page-btn num${page === n ? ' active' : ''}`} onClick={() => handlePage(n)}>
                {n}
              </button>
            ))}
            {pageNums.at(-1) < totalPages && (
              <>
                {pageNums.at(-1) < totalPages - 1 && <span className="cf-page-ellipsis">…</span>}
                <button className="cf-page-btn num" onClick={() => handlePage(totalPages)}>{totalPages}</button>
              </>
            )}
            <button className="cf-page-btn" disabled={page === totalPages} onClick={() => handlePage(page + 1)}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}