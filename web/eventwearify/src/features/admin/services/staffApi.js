import { authFetch } from '../../../shared/services/apiClient.js';

const ADMIN_BASE = '/admin';

/* ── Staff ──────────────────────────────────────────────── */
export const fetchStaff = async ({ page = 0, size = 100, search = '', status = '' } = {}) => {
  const query = new URLSearchParams({ page, size, search, status }).toString();
  const data = await authFetch(`${ADMIN_BASE}/staff?${query}`);
  return Array.isArray(data.content) ? data.content : [];
};

export const createStaff = async (staff) =>
  authFetch(`${ADMIN_BASE}/staff`, { method: 'POST', body: JSON.stringify(staff) });

export const updateStaff = async (id, staff) =>
  authFetch(`${ADMIN_BASE}/staff/${id}`, { method: 'PUT', body: JSON.stringify(staff) });

export const deleteStaff = async (id) =>
  authFetch(`${ADMIN_BASE}/staff/${id}`, { method: 'DELETE' });

/* ── Attendance ─────────────────────────────────────────── */
export const recordAttendance = async () =>
  authFetch(`${ADMIN_BASE}/attendance/record`, { method: 'POST' });

export const getTodayAttendance = async () =>
  authFetch(`${ADMIN_BASE}/attendance/today`);

export const resetAttendance = async () =>
  authFetch(`${ADMIN_BASE}/attendance/reset`, { method: 'DELETE' });

export const unlockAttendance = async (date = null) => {
  const query = date ? `?date=${date}` : '';
  return authFetch(`${ADMIN_BASE}/attendance/unlock${query}`, { method: 'PUT' });
};

export const editAttendanceRecord = async (recordId, data) =>
  authFetch(`${ADMIN_BASE}/attendance/edit/${recordId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const getAttendanceHistory = async ({ date, staffId, isLate, status } = {}) => {
  const params = new URLSearchParams();
  if (date)                 params.append('date',    date);
  if (staffId)              params.append('staffId', staffId);
  if (isLate !== undefined) params.append('isLate',  isLate);
  if (status)               params.append('status',  status);
  return authFetch(`${ADMIN_BASE}/attendance/history?${params.toString()}`);
};

/* ── Settings ───────────────────────────────────────────── */
export const getSettings = async () => authFetch(`${ADMIN_BASE}/settings`);

export const updateSalarySettings = async (defaultDailyRate) =>
  authFetch(`${ADMIN_BASE}/settings/salary`, {
    method: 'PUT',
    body: JSON.stringify({ defaultDailyRate }),
  });
