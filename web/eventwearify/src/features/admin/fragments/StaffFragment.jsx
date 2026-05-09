import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Edit2, Trash2, Users, UserCheck, UserX,
  X, CheckCircle, AlertCircle, Settings,
  Wallet, Clock, ToggleLeft, ToggleRight, Shield, Eye, EyeOff,
  Coins, SlidersHorizontal, Lock, Unlock, AlertTriangle,
  CalendarDays, History,
} from 'lucide-react';
import '../styles/StaffManagement.css';
import {
  fetchStaff, createStaff, updateStaff, deleteStaff,
  recordAttendance, getTodayAttendance, resetAttendance,
  unlockAttendance, editAttendanceRecord,
  getSettings, updateSalarySettings,
  getAttendanceHistory,
} from '../services/staffApi';

/* ── Constants ──────────────────────────────────────────── */
const DEFAULT_DAILY_RATE = 300;
const DEFAULT_PASSWORD   = 'EventWear@123';

/* ── Helpers ─────────────────────────────────────────────── */
const getInitials = (name) =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const AVATAR_COLORS = [
  '#6b2d39','#c4717f','#5a7a6b','#7a6b5a','#4a6b8a','#8a4a6b',
];
const avatarColor = (name) =>
  AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];

const formatTime = (dt) => {
  if (!dt) return '—';
  if (Array.isArray(dt)) {
    const [y, mo, d, h = 0, min = 0] = dt;
    return new Date(y, mo - 1, d, h, min)
      .toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }
  return new Date(dt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
};

const todayKey = () => new Date().toISOString().slice(0, 10);

/* ── Toast ───────────────────────────────────────────────── */
function Toast({ toast }) {
  if (!toast.show) return null;
  return (
    <div className={`stf-toast ${toast.type}`}>
      {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      <span>{toast.message}</span>
    </div>
  );
}

/* ── Avatar ──────────────────────────────────────────────── */
function Avatar({ name, size = 36 }) {
  return (
    <div
      className="stf-avatar"
      style={{ width: size, height: size, background: avatarColor(name ?? '?'), fontSize: size * 0.35 }}
    >
      {getInitials(name ?? '?')}
    </div>
  );
}

/* ── Status Badge ────────────────────────────────────────── */
function StatusBadge({ status }) {
  const isOn = status === 'On Duty';
  return (
    <span className={`stf-badge ${isOn ? 'on-duty' : 'off-duty'}`}>
      <span className="stf-badge-dot" />
      {status}
    </span>
  );
}

/* ── Duty Toggle ─────────────────────────────────────────── */
function DutyToggle({ status, onChange, disabled, loading }) {
  const isOn = status === 'On Duty';
  return (
    <button
      className={`stf-duty-toggle ${isOn ? 'on' : 'off'} ${disabled ? 'disabled' : ''} ${loading ? 'loading' : ''}`}
      onClick={disabled || loading ? undefined : onChange}
      title={disabled
        ? 'Attendance locked. Click "View History" to unlock and make changes.'
        : isOn ? 'Click to set Off Duty' : 'Click to set On Duty'}
      disabled={disabled || loading}
    >
      {loading
        ? <><span className="stf-spinner" /><span>Updating…</span></>
        : isOn
          ? <><ToggleRight size={20} /><span>On Duty</span></>
          : <><ToggleLeft  size={20} /><span>Off Duty</span></>}
    </button>
  );
}

/* ── Salary Chip ─────────────────────────────────────────── */
function SalaryChip({ staff, globalRate }) {
  const rate  = staff.customRate ?? globalRate;
  const total = rate * staff.daysWorked;
  return (
    <div className="stf-salary-chip">
      <span className="stf-salary-total">₱{total.toLocaleString()}</span>
      <span className="stf-salary-breakdown">{staff.daysWorked}d × ₱{rate}</span>
    </div>
  );
}

/* ── Attendance History Modal ───────────────────────────── */
function AttendanceHistoryModal({ attendanceEditMode, onStaffRefresh, onToast, onClose }) {
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [error,      setError]      = useState('');
  const [localEditMode, setLocalEditMode] = useState(attendanceEditMode);
  const [updatingRecords, setUpdatingRecords] = useState(new Set());
  const today = todayKey();

  const normalizeDate = (raw) => {
    if (!raw) return 'Unknown';
    if (Array.isArray(raw))
      return `${raw[0]}-${String(raw[1]).padStart(2,'0')}-${String(raw[2]).padStart(2,'0')}`;
    return String(raw).slice(0, 10);
  };

  const fetchHistory = useCallback(async (date) => {
    setError('');
    try {
      const data = await getAttendanceHistory(date ? { date } : {});
      const list = Array.isArray(data) ? data : data.records ?? data.content ?? [];
      setRecords(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(''); }, [fetchHistory]);

  const handleDateChange = (e) => {
    setDateFilter(e.target.value);
    fetchHistory(e.target.value);
  };

  const handleToggleEditMode = async () => {
    if (!localEditMode) {
      try {
        await unlockAttendance(today);
        setLocalEditMode(true);
        fetchHistory(dateFilter);
        onStaffRefresh();
        onToast('Attendance unlocked. You can now edit records.');
      } catch (err) {
        onToast(err.message, 'error');
      }
    } else {
      setLocalEditMode(false);
      onToast('Attendance editing closed.');
    }
  };

  const handleEdit = async (rec, changes) => {
    const id = rec.id;
    setUpdatingRecords(prev => new Set(prev).add(id));
    // Optimistic update
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
    try {
      await editAttendanceRecord(id, {
        status:      changes.status      ?? rec.status,
        isLate:      changes.isLate      ?? rec.isLate,
        lateMinutes: changes.lateMinutes ?? rec.lateMinutes,
      });
      onStaffRefresh();
    } catch (err) {
      // Revert on failure
      setRecords(prev => prev.map(r => r.id === id ? rec : r));
      onToast(err.message, 'error');
    } finally {
      setUpdatingRecords(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const grouped = useMemo(() => {
    const map = {};
    records.forEach(r => {
      const key = normalizeDate(r.attendanceDate);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [records]);

  return (
    <div className="stf-overlay" onClick={onClose}>
      <div className="stf-modal" style={{ maxWidth: 720, maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="stf-modal-header">
          <h3 className="stf-modal-title">
            <History size={15} style={{ color:'#6b2d39' }} /> Attendance History
          </h3>
          <button className="stf-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding:'0.85rem 1.25rem', borderBottom:'1px solid #eeecea', display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
          <CalendarDays size={14} style={{ color:'#bbb', flexShrink:0 }} />
          <label style={{ fontSize:'0.8rem', fontWeight:600, color:'#555', flexShrink:0 }}>Filter by date</label>
          <input type="date" className="stf-input" style={{ maxWidth:200 }} value={dateFilter} onChange={handleDateChange} />
          {dateFilter && (
            <button className="stf-btn-ghost" style={{ padding:'0.35rem 0.75rem', fontSize:'0.78rem' }}
              onClick={() => { setDateFilter(''); fetchHistory(''); }}>
              <X size={12} /> Clear
            </button>
          )}
          <button
            className="stf-btn-primary"
            onClick={handleToggleEditMode}
            style={{ marginLeft:'auto', background: localEditMode ? '#15803d' : '#6b2d39', fontSize:'0.75rem', padding:'0.4rem 0.85rem' }}
          >
            {localEditMode ? <><Lock size={13} /> Lock Session</> : <><Unlock size={13} /> Unlock Today</>}
          </button>
          <span style={{ fontSize:'0.78rem', color:'#bbb' }}>{records.length} record{records.length !== 1 ? 's' : ''}</span>
        </div>

        {localEditMode && (
          <div style={{ padding:'0.6rem 1.25rem', background:'rgba(21,128,61,0.06)', borderBottom:'1px solid rgba(21,128,61,0.15)', display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.78rem', color:'#15803d' }}>
            <Unlock size={13} />
            <span><strong>Edit mode active</strong> — Changes sync instantly to Days Worked &amp; Status.</span>
          </div>
        )}

        <div className="stf-modal-body" style={{ padding:'1rem 1.25rem', gap:'1.25rem' }}>
          {loading ? (
            <div style={{ textAlign:'center', color:'#bbb', padding:'2rem', fontSize:'0.875rem' }}>Loading history…</div>
          ) : error ? (
            <div style={{ padding:'0.75rem', background:'rgba(220,38,38,0.06)', borderRadius:8, color:'#dc2626', fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <AlertCircle size={14} /> {error}
            </div>
          ) : grouped.length === 0 ? (
            <div style={{ textAlign:'center', color:'#bbb', padding:'2.5rem', fontSize:'0.875rem' }}>
              <History size={32} style={{ opacity:0.2, display:'block', margin:'0 auto 0.5rem' }} />
              No attendance records found.
            </div>
          ) : grouped.map(([date, recs]) => {
            const isToday = date === today;
            const canEdit = isToday && localEditMode;
            return (
              <div key={date}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.6rem' }}>
                  <CalendarDays size={13} style={{ color:'#6b2d39' }} />
                  <span style={{ fontWeight:700, fontSize:'0.82rem', color:'#1a1a1a' }}>
                    {date}
                    {isToday && <span style={{ marginLeft:'0.4rem', fontSize:'0.7rem', fontWeight:500, color:'#6b2d39', background:'rgba(107,45,57,0.08)', borderRadius:20, padding:'0.1rem 0.5rem' }}>Today</span>}
                  </span>
                  <span style={{ fontSize:'0.72rem', color:'#bbb' }}>
                    — {recs.filter(r => r.status === 'On Duty').length} on duty · {recs.filter(r => r.status === 'Off Duty').length} off duty
                  </span>
                  {isToday && !localEditMode && (
                    <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.72rem', color:'#999', background:'#f5f3f1', border:'1px solid #e4e2df', borderRadius:20, padding:'0.15rem 0.55rem' }}>
                      <Lock size={10} /> Locked
                    </span>
                  )}
                  {canEdit && (
                    <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.72rem', color:'#15803d', background:'rgba(21,128,61,0.08)', border:'1px solid rgba(21,128,61,0.2)', borderRadius:20, padding:'0.15rem 0.55rem' }}>
                      <Unlock size={10} /> Edit Mode
                    </span>
                  )}
                </div>
                <div className="stf-table-wrap" style={{ marginBottom:'0.25rem' }}>
                  <table className="stf-table">
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th>Status</th>
                        <th>Late</th>
                        <th>Recorded At</th>
                        <th>Edited At</th>
                        {canEdit && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {recs.map(rec => {
                        const isUpdating = updatingRecords.has(rec.id);
                        return (
                          <tr key={rec.id} className="stf-tr">
                            <td>
                              <div className="stf-name-cell">
                                <Avatar name={rec.staffName ?? '?'} size={28} />
                                <div className="stf-name" style={{ fontSize:'0.82rem' }}>{rec.staffName ?? 'Unknown'}</div>
                              </div>
                            </td>
                            <td><StatusBadge status={rec.status} /></td>
                            <td>
                              {canEdit ? (
                                <button
                                  className={`stf-filter-btn ${rec.isLate ? 'active' : ''}`}
                                  style={{ fontSize:'0.72rem', padding:'0.22rem 0.6rem' }}
                                  onClick={() => handleEdit(rec, { isLate: !rec.isLate })}
                                  disabled={isUpdating}
                                >
                                  {rec.isLate ? '⏰ Late' : 'On Time'}
                                </button>
                              ) : (
                                <span style={{ fontSize:'0.78rem', color: rec.isLate ? '#dc2626' : '#15803d', fontWeight:600 }}>
                                  {rec.isLate ? '⏰ Late' : 'On Time'}
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize:'0.78rem', color:'#888' }}>{formatTime(rec.recordedAt)}</td>
                            <td style={{ fontSize:'0.78rem' }}>
                              {rec.editedAt
                                ? <span style={{ color:'#c4717f', fontWeight:600 }}>{formatTime(rec.editedAt)}</span>
                                : <span style={{ color:'#ddd' }}>—</span>}
                            </td>
                            {canEdit && (
                              <td>
                                <button
                                  className={`stf-duty-toggle ${rec.status === 'On Duty' ? 'on' : 'off'}`}
                                  style={{ fontSize:'0.74rem', padding:'0.22rem 0.65rem', whiteSpace:'nowrap' }}
                                  onClick={() => handleEdit(rec, { status: rec.status === 'On Duty' ? 'Off Duty' : 'On Duty' })}
                                  disabled={isUpdating}
                                >
                                  {isUpdating ? 'Updating…' : rec.status === 'On Duty' ? '→ Off Duty' : '→ On Duty'}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        <div className="stf-modal-footer">
          <button className="stf-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── Settings Modal ──────────────────────────────────────── */
function SettingsModal({ globalRate, onSave, onClose }) {
  const [rate, setRate]   = useState(String(globalRate));
  const [error, setError] = useState('');

  const handleSave = () => {
    const v = Number(rate);
    if (!rate || isNaN(v) || v <= 0) { setError('Please enter a valid positive rate.'); return; }
    onSave(v);
  };

  return (
    <div className="stf-overlay" onClick={onClose}>
      <div className="stf-modal stf-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="stf-modal-header">
          <h3 className="stf-modal-title">
            <SlidersHorizontal size={16} style={{ color:'#6b2d39' }} /> Salary Settings
          </h3>
          <button className="stf-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="stf-settings-body">
          <div className="stf-settings-info">
            <Shield size={14} />
            <span>Sets the <strong>global default</strong> daily rate. You can still override per-staff in Edit.</span>
          </div>
          <label className="stf-field-label">Default Daily Salary (₱)</label>
          <div className="stf-input-wrap">
            <span className="stf-input-prefix">₱</span>
            <input
              className={`stf-input stf-input-pfx ${error ? 'error' : ''}`}
              type="number" min="1"
              value={rate}
              onChange={e => { setRate(e.target.value); setError(''); }}
            />
          </div>
          {error && <p className="stf-field-error">{error}</p>}
        </div>
        <div className="stf-modal-footer">
          <button className="stf-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="stf-btn-primary" onClick={handleSave}>
            <CheckCircle size={14} /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Staff Modal ─────────────────────────────────────────── */
const EMPTY_FORM = {
  fullName:'', email:'', role:'Staff', status:'Off Duty', daysWorked:0, customRate:'',
};

function StaffModal({ mode, initial, globalRate, onSave, onClose, attendanceLocked, staffList }) {
  const [form, setForm]     = useState(initial || EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = mode === 'edit';

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required.';
    if (!form.email.trim())    e.email    = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email.';
    const norm = form.email.trim().toLowerCase();
    if (staffList.some(s => s.email.toLowerCase() === norm && s.id !== initial?.id))
      e.email = 'This email is already used by another staff member.';
    if (Number(form.daysWorked) < 0) e.daysWorked = 'Days worked cannot be negative.';
    if (form.customRate !== '' && Number(form.customRate) < 0)
      e.customRate = 'Salary cannot be negative.';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        daysWorked: Number(form.daysWorked || 0),
        customRate: form.customRate === '' ? null : Number(form.customRate),
      });
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setSaving(false);
    }
  };

  const previewRate  = form.customRate !== '' ? Number(form.customRate) : globalRate;
  const previewTotal = previewRate * Number(form.daysWorked || 0);

  return (
    <div className="stf-overlay" onClick={onClose}>
      <div className="stf-modal" onClick={e => e.stopPropagation()}>
        <div className="stf-modal-header">
          <h3 className="stf-modal-title">
            {isEdit
              ? <><Edit2 size={15} style={{ color:'#6b2d39' }} /> Edit Staff Member</>
              : <><Plus  size={15} style={{ color:'#6b2d39' }} /> Add New Staff</>}
          </h3>
          <button className="stf-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="stf-modal-body">
          {errors.form && (
            <div style={{ padding:'0.65rem', background:'rgba(220,38,38,0.07)', borderRadius:8, color:'#dc2626', fontSize:'0.82rem' }}>
              {errors.form}
            </div>
          )}

          <div className="stf-field">
            <label className="stf-field-label">Full Name <span className="stf-required">*</span></label>
            <input className={`stf-input ${errors.fullName ? 'error':''}`}
              placeholder="e.g. Maria Santos" value={form.fullName}
              onChange={e => set('fullName', e.target.value)} />
            {errors.fullName && <p className="stf-field-error">{errors.fullName}</p>}
          </div>

          <div className="stf-field">
            <label className="stf-field-label">Email <span className="stf-required">*</span></label>
            <input className={`stf-input ${errors.email ? 'error':''}`}
              placeholder="staff@eventwear.com" type="email" value={form.email}
              onChange={e => set('email', e.target.value)} />
            {errors.email && <p className="stf-field-error">{errors.email}</p>}
          </div>

          <div className="stf-field-row">
            <div className="stf-field">
              <label className="stf-field-label">Role</label>
              <select className="stf-select" value={form.role} onChange={e => set('role', e.target.value)}>
                <option>Staff</option>
                <option>Senior Staff</option>
                <option>Supervisor</option>
              </select>
            </div>
            <div className="stf-field">
              <label className="stf-field-label">Duty Status</label>
              <select className="stf-select" value={form.status}
                onChange={e => set('status', e.target.value)}
                disabled={attendanceLocked}>
                <option>On Duty</option>
                <option>Off Duty</option>
              </select>
            </div>
          </div>

          {isEdit && (
            <>
              <div className="stf-field">
                <label className="stf-field-label">Custom Daily Rate (₱)
                  <span className="stf-label-note"> — leave blank for global (₱{globalRate})</span>
                </label>
                <div className="stf-input-wrap">
                  <span className="stf-input-prefix">₱</span>
                  <input className={`stf-input stf-input-pfx ${errors.customRate ? 'error':''}`}
                    type="number" min="0" placeholder={`${globalRate} (default)`}
                    value={form.customRate}
                    onChange={e => set('customRate', e.target.value)} />
                </div>
                {errors.customRate && <p className="stf-field-error">{errors.customRate}</p>}
              </div>

              <div className="stf-salary-preview">
                <Coins size={14} />
                <span>
                  <strong>{form.daysWorked || 0} days</strong> × ₱{previewRate} =&nbsp;
                  <strong style={{ color:'#6b2d39' }}>₱{previewTotal.toLocaleString()}</strong>
                </span>
              </div>
            </>
          )}

          {!isEdit && (
            <div className="stf-pw-section">
              <div className="stf-pw-row">
                <div className="stf-field" style={{ flex:1 }}>
                  <label className="stf-field-label">Default Password</label>
                  <div className="stf-input-wrap">
                    <input className="stf-input" type={showPw ? 'text':'password'}
                      value={DEFAULT_PASSWORD} readOnly />
                    <button className="stf-pw-eye" onClick={() => setShowPw(p => !p)} type="button">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="stf-pw-note">
                <Shield size={13} />
                <span>Staff should change their password after first login.</span>
              </div>
            </div>
          )}
        </div>
        <div className="stf-modal-footer">
          <button className="stf-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="stf-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="stf-spinner" /> Saving…</> : <><CheckCircle size={14} />{isEdit ? 'Save Changes' : 'Create Staff Account'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Stat Card ───────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, iconBg, iconColor }) {
  return (
    <div className="stf-stat-card">
      <div className="stf-stat-icon" style={{ background: iconBg }}>
        <Icon size={18} color={iconColor} />
      </div>
      <div>
        <div className="stf-stat-value">{value}</div>
        <div className="stf-stat-label">{label}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main Fragment
══════════════════════════════════════════════════════════ */
const StaffFragment = () => {
  const [staffList,          setStaffList]          = useState([]);
  const [globalRate,         setGlobalRate]         = useState(DEFAULT_DAILY_RATE);
  const [search,             setSearch]             = useState('');
  const [filterStatus,       setFilterStatus]       = useState('All');
  const [modal,              setModal]              = useState(null);
  const [selected,           setSelected]           = useState(null);
  const [attendanceSession,  setAttendanceSession]  = useState(null);
  const [attendanceEditMode, setAttendanceEditMode] = useState(false);
  const [showHistory,        setShowHistory]        = useState(false);
  const [toast,              setToast]              = useState({ show:false, message:'', type:'success' });
  const [togglingIds,        setTogglingIds]        = useState(new Set());

  // Track the last date we loaded data so we can detect day change
  const lastLoadedDate = useRef(todayKey());

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show:true, message, type });
    setTimeout(() => setToast(t => ({ ...t, show:false })), 3200);
  }, []);

  const today = todayKey();
  const attendanceForToday = attendanceSession?.date === today;

  /* ── Loaders ─────────────────────────────────────────── */
  const loadStaff = useCallback(async () => {
    try {
      const staff = await fetchStaff();
      // On a new day, ensure all staff show Off Duty locally until attendance recorded
      const currentDay = todayKey();
      if (lastLoadedDate.current !== currentDay) {
        lastLoadedDate.current = currentDay;
        // Force local status to Off Duty for new day (backend is source of truth, but sync UI)
        setStaffList((staff || []).map(s => ({ ...s, status: 'Off Duty' })));
      } else {
        setStaffList(staff || []);
      }
      return staff;
    } catch (err) {
      showToast(err.message, 'error');
      return null;
    }
  }, [showToast]);

  const loadSettings = useCallback(async () => {
    try {
      const s = await getSettings();
      setGlobalRate(s.defaultDailyRate ?? DEFAULT_DAILY_RATE);
    } catch (err) { showToast(err.message, 'error'); }
  }, [showToast]);

  const loadAttendance = useCallback(async () => {
    try {
      const data = await getTodayAttendance();
      const currentDay = todayKey();

      // If attendance session is from a previous day, treat it as no session for today
      if (data?.date && data.date !== currentDay) {
        setAttendanceSession(null);
        setAttendanceEditMode(false);
        return;
      }

      setAttendanceSession(data);
      setAttendanceEditMode(data?.editable === true || data?.isEditable === true);
    } catch (err) {
      if (!/not been recorded|500|not found/i.test(err.message)) {
        showToast(err.message, 'error');
      }
      setAttendanceSession(null);
      setAttendanceEditMode(false);
    }
  }, [showToast]);

  // Parallel load — no await chaining
  const refreshAllData = useCallback(() => {
    loadStaff();
    loadAttendance();
    loadSettings();
  }, [loadStaff, loadAttendance, loadSettings]);

  useEffect(() => {
    refreshAllData();

    // Check for day change every minute
    const interval = setInterval(() => {
      const currentDay = todayKey();
      if (lastLoadedDate.current !== currentDay) {
        lastLoadedDate.current = currentDay;
        // New day: reset all staff to Off Duty locally, then reload
        setStaffList(prev => prev.map(s => ({ ...s, status: 'Off Duty' })));
        setAttendanceSession(null);
        setAttendanceEditMode(false);
        refreshAllData();
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [refreshAllData]);

  /* ── Attendance Actions ───────────────────────────────── */
  const handleRecordAttendance = async () => {
    if (attendanceForToday) return;
    // Optimistic: mark all staff Off Duty immediately
    setStaffList(prev => prev.map(s => ({ ...s, status: 'Off Duty' })));
    setAttendanceSession({ date: today, records: [], editable: false, isEditable: false });
    try {
      await recordAttendance();
      loadStaff();
      loadAttendance();
      showToast('Attendance recorded. All staff are Off Duty for today.');
    } catch (err) {
      // Revert
      loadStaff();
      loadAttendance();
      showToast(err.message, 'error');
    }
  };

  // Reset: force ALL staff to Off Duty — optimistic + patch each staff record
  const handleResetAttendance = async () => {
    // 1. Instantly force every staff member to Off Duty in the UI
    setStaffList(prev => prev.map(s => ({ ...s, status: 'Off Duty' })));

    try {
      // 2. Call the attendance reset endpoint
      await resetAttendance();

      // 3. Also patch every staff member's status to Off Duty on the backend
      //    because resetAttendance() only resets attendance records, not staff.status
      const currentStaff = await fetchStaff();
      const onDutyStaff = (currentStaff || []).filter(s => s.status === 'On Duty');
      await Promise.all(
        onDutyStaff.map(s =>
          updateStaff(s.id, {
            fullName:   s.fullName,
            role:       s.role,
            status:     'Off Duty',
            customRate: s.customRate ?? null,
          }).catch(() => {}) // don't let one failure block others
        )
      );

      // 4. Re-fetch to get the definitive server state
      const refreshed = await fetchStaff();
      // Force Off Duty again in case backend still shows On Duty
      setStaffList((refreshed || []).map(s => ({ ...s, status: 'Off Duty' })));
      loadAttendance();
      showToast('Attendance reset. All staff are now Off Duty.');
    } catch (err) {
      // Even on error, keep UI as Off Duty and show message
      showToast(err.message, 'error');
      loadStaff();
      loadAttendance();
    }
  };

  /* ── Duty Toggle ─────────────────────────────────────── */
  const handleToggleDuty = async (staff) => {
    const isTodayEditable = attendanceForToday && attendanceEditMode;

    if (!isTodayEditable && attendanceForToday) {
      showToast('Attendance locked. Open "View History" to unlock.', 'error');
      return;
    }

    const newStatus = staff.status === 'On Duty' ? 'Off Duty' : 'On Duty';

    // Optimistic update — instant response
    setStaffList(prev => prev.map(s =>
      s.id === staff.id
        ? { ...s, status: newStatus, daysWorked: newStatus === 'On Duty' ? s.daysWorked + 1 : Math.max(0, s.daysWorked - 1) }
        : s
    ));
    setTogglingIds(prev => new Set(prev).add(staff.id));

    try {
      await updateStaff(staff.id, {
        fullName: staff.fullName,
        role: staff.role,
        status: newStatus,
        customRate: staff.customRate,
      });

      // Also update attendance record if in edit mode
      if (isTodayEditable && attendanceSession?.records) {
        const staffRecord = attendanceSession.records.find(
          r => r.staffId === staff.id || r.staffName === staff.fullName
        );
        if (staffRecord) {
          editAttendanceRecord(staffRecord.id, {
            status: newStatus,
            isLate: staffRecord.isLate || false,
            lateMinutes: staffRecord.lateMinutes || 0,
          }).catch(() => {}); // fire and forget
        }
      }

      // Sync real data in background
      loadStaff();
    } catch (err) {
      // Revert optimistic update
      setStaffList(prev => prev.map(s => s.id === staff.id ? staff : s));
      showToast(err.message, 'error');
    } finally {
      setTogglingIds(prev => { const s = new Set(prev); s.delete(staff.id); return s; });
    }
  };

  /* ── CRUD ────────────────────────────────────────────── */
  const handleAdd = async (form) => {
    const s = await createStaff({
      fullName: form.fullName, email: form.email,
      role: form.role, status: 'Off Duty',
      customRate: form.customRate,
    });
    // Optimistic add
    setStaffList(prev => [...prev, s]);
    setModal(null);
    showToast(`${s.fullName} has been added.`);
    loadStaff(); // sync
  };

  const handleEdit = async (form) => {
    // Optimistic update
    setStaffList(prev => prev.map(s => s.id === selected.id ? { ...s, ...form } : s));
    const prev = selected;
    setModal(null);
    setSelected(null);
    showToast(`${prev.fullName}'s profile updated.`);
    try {
      await updateStaff(prev.id, {
        fullName: form.fullName, role: form.role,
        status: form.status, customRate: form.customRate,
      });
      loadStaff();
    } catch (err) {
      setStaffList(p => p.map(s => s.id === prev.id ? prev : s));
      showToast(err.message, 'error');
    }
  };

  // Delete: no confirm modal — just inline trash button with double-click or single tap
  // We keep a simple "are you sure" inline state instead of a full modal
  const [pendingDelete, setPendingDelete] = useState(null);
  const deleteTimerRef = useRef(null);

  const handleDeleteClick = (staff) => {
    if (pendingDelete?.id === staff.id) {
      // Second click = confirm delete
      clearTimeout(deleteTimerRef.current);
      setPendingDelete(null);
      performDelete(staff);
    } else {
      setPendingDelete(staff);
      deleteTimerRef.current = setTimeout(() => setPendingDelete(null), 3000);
    }
  };

  const performDelete = async (staff) => {
    // Optimistic remove
    setStaffList(prev => prev.filter(s => s.id !== staff.id));
    showToast(`${staff.fullName} removed.`, 'error');
    try {
      await deleteStaff(staff.id);
    } catch (err) {
      setStaffList(prev => [...prev, staff]);
      showToast(err.message, 'error');
    }
  };

  const handleSaveGlobalRate = async (rate) => {
    setGlobalRate(rate);
    setModal(null);
    showToast('Global daily rate updated.');
    try {
      const s = await updateSalarySettings(rate);
      setGlobalRate(s.defaultDailyRate ?? rate);
      loadStaff();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  /* ── Derived ─────────────────────────────────────────── */
  const filtered = useMemo(() =>
    staffList.filter(s => {
      const matchSearch = s.fullName.toLowerCase().includes(search.toLowerCase())
        || s.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'All' || s.status === filterStatus;
      return matchSearch && matchStatus;
    }),
  [staffList, search, filterStatus]);

  const totalStaff   = staffList.length;
  const onDutyCount  = useMemo(() => staffList.filter(s => s.status === 'On Duty').length,  [staffList]);
  const offDutyCount = useMemo(() => staffList.filter(s => s.status === 'Off Duty').length, [staffList]);
  const totalPayroll = useMemo(() =>
    staffList.reduce((acc, s) => acc + (s.customRate ?? globalRate) * s.daysWorked, 0),
  [staffList, globalRate]);

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="stf-root">
      <div className="stf-top">
        <div>
          <h1 className="stf-title">Staff Management</h1>
          <p className="stf-subtitle">Manage staff accounts, duty status, and salary records</p>
        </div>
        <div className="stf-header-actions">
          <button className="stf-btn-ghost" onClick={() => setModal('settings')}>
            <Settings size={15} /> Salary Settings
          </button>
          <button className="stf-btn-primary" onClick={() => setModal('add')}>
            <Plus size={15} /> Add Staff
          </button>
        </div>
      </div>

      {/* ── Attendance Banner ── */}
      <div className={`stf-attendance-banner ${attendanceForToday ? 'recorded' : 'pending'}`}>
        <div className="stf-attendance-icon">
          {attendanceForToday ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
        </div>
        <div className="stf-attendance-text">
          <div className="stf-attendance-title">
            {attendanceForToday
              ? `Today's attendance recorded (${today})`
              : attendanceSession
                ? `Last recorded: ${attendanceSession.date}. Record today now.`
                : 'Attendance not recorded for today'}
          </div>
          <div className="stf-attendance-copy">
            {attendanceForToday
              ? `${onDutyCount} on duty · ${offDutyCount} off duty · ${attendanceEditMode ? 'Edit mode active.' : 'Locked — open History to unlock.'}`
              : 'Click "Record Today" — all staff start as Off Duty.'}
          </div>
        </div>
        <div className="stf-attendance-actions">
          <button className="stf-btn-primary" onClick={() => setShowHistory(true)}>
            <History size={14} /> View History
          </button>
          {attendanceForToday ? (
            <button className="stf-btn-ghost" onClick={handleResetAttendance}>
              Reset to Off Duty
            </button>
          ) : (
            <button className="stf-btn-primary" onClick={handleRecordAttendance}>
              <CheckCircle size={14} /> Record Today
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stf-stats">
        <StatCard icon={Users}     label="Total Staff"   value={totalStaff}
          iconBg="rgba(107,45,57,0.1)"    iconColor="#6b2d39" />
        <StatCard icon={UserCheck} label="On Duty"       value={onDutyCount}
          iconBg="rgba(21,128,61,0.09)"   iconColor="#15803d" />
        <StatCard icon={UserX}     label="Off Duty"      value={offDutyCount}
          iconBg="rgba(220,38,38,0.08)"   iconColor="#dc2626" />
        <StatCard icon={Wallet}    label="Total Payroll" value={`₱${totalPayroll.toLocaleString()}`}
          iconBg="rgba(196,113,127,0.12)" iconColor="#c4717f" />
      </div>

      {/* ── Table ── */}
      <div className="stf-card">
        <div className="stf-toolbar">
          <div className="stf-search-wrap">
            <Search size={14} className="stf-search-icon" />
            <input className="stf-search" placeholder="Search by name or email…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="stf-filters">
            {['All','On Duty','Off Duty'].map(f => (
              <button key={f} className={`stf-filter-btn ${filterStatus === f ? 'active':''}`}
                onClick={() => setFilterStatus(f)}>{f}</button>
            ))}
          </div>
          <div className="stf-rate-badge">
            <Coins size={13} /> ₱{globalRate}/day
          </div>
        </div>

        <div className="stf-table-wrap">
          <table className="stf-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Role</th>
                <th>Duty Status</th>
                <th><CalendarDays size={12} style={{ marginRight:4, verticalAlign:'middle' }} />Days Worked</th>
                <th><Wallet size={12} style={{ marginRight:4, verticalAlign:'middle' }} />Salary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="stf-empty">
                    <Users size={32} style={{ opacity:0.2, display:'block', margin:'0 auto 0.5rem' }} />
                    No staff found.
                  </td>
                </tr>
              ) : filtered.map(staff => (
                <tr key={staff.id} className="stf-tr">
                  <td>
                    <div className="stf-name-cell">
                      <Avatar name={staff.fullName} />
                      <div>
                        <div className="stf-name">{staff.fullName}</div>
                        <div className="stf-email">{staff.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="stf-role-tag">{staff.role}</span></td>
                  <td>
                    <DutyToggle
                      status={staff.status}
                      onChange={() => handleToggleDuty(staff)}
                      disabled={!attendanceEditMode && attendanceForToday}
                      loading={togglingIds.has(staff.id)}
                    />
                  </td>
                  <td>
                    <div className="stf-days-cell">
                      <Clock size={13} style={{ color:'#bbb' }} />
                      <span>{staff.daysWorked} days</span>
                    </div>
                  </td>
                  <td><SalaryChip staff={staff} globalRate={globalRate} /></td>
                  <td>
                    <div className="stf-row-actions">
                      <button className="stf-icon-btn" title="Edit"
                        onClick={() => { setSelected(staff); setModal('edit'); }}>
                        <Edit2 size={14} />
                      </button>
                      {/* Double-click to delete — no modal */}
                      <button
                        className={`stf-icon-btn danger ${pendingDelete?.id === staff.id ? 'pending-delete' : ''}`}
                        title={pendingDelete?.id === staff.id ? 'Click again to confirm removal' : 'Remove staff'}
                        onClick={() => handleDeleteClick(staff)}
                      >
                        <Trash2 size={14} />
                        {pendingDelete?.id === staff.id && (
                          <span className="stf-delete-confirm-hint">Confirm?</span>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="stf-table-footer">
            Showing {filtered.length} of {staffList.length} staff members
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal === 'add' && (
        <StaffModal mode="add" globalRate={globalRate} staffList={staffList}
          onSave={handleAdd} onClose={() => setModal(null)} />
      )}
      {modal === 'edit' && selected && (
        <StaffModal mode="edit"
          initial={{ ...selected, customRate: selected.customRate ?? '' }}
          globalRate={globalRate} staffList={staffList}
          attendanceLocked={!attendanceEditMode && attendanceForToday}
          onSave={handleEdit}
          onClose={() => { setModal(null); setSelected(null); }} />
      )}
      {modal === 'settings' && (
        <SettingsModal globalRate={globalRate}
          onSave={handleSaveGlobalRate}
          onClose={() => setModal(null)} />
      )}
      {showHistory && (
        <AttendanceHistoryModal
          attendanceEditMode={attendanceEditMode}
          onStaffRefresh={loadStaff}
          onToast={showToast}
          onClose={() => { setShowHistory(false); refreshAllData(); }}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
};

export default StaffFragment;