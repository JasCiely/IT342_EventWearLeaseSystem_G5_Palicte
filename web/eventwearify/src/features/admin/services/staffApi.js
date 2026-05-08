const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/admin';

const getAuthToken = () =>
  localStorage.getItem('accessToken') || localStorage.getItem('token');

const isAuthenticated = () => {
  const token = getAuthToken();
  return token && token !== 'undefined' && token !== 'null';
};

const authFetch = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  if (isAuthenticated() && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, { ...options, headers });

    const contentType = response.headers.get('content-type');
    const text = await response.text();
    const data = contentType?.includes('application/json')
      ? JSON.parse(text)
      : text;

    if (!response.ok) {
      const message = data?.message || data?.error || `API Error: ${response.status}`;
      throw new Error(message);
    }

    return data;
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Please make sure the backend is running on port 8080.');
    }
    throw error;
  }
};

/* ── Staff ──────────────────────────────────────────────── */
export const fetchStaff = async ({ page = 0, size = 100, search = '', status = '' } = {}) => {
  const query = new URLSearchParams({ page, size, search, status }).toString();
  const data = await authFetch(`/staff?${query}`);
  return Array.isArray(data.content) ? data.content : [];
};

export const createStaff = async (staff) =>
  authFetch('/staff', { method: 'POST', body: JSON.stringify(staff) });

export const updateStaff = async (id, staff) =>
  authFetch(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(staff) });

export const deleteStaff = async (id) =>
  authFetch(`/staff/${id}`, { method: 'DELETE' });

/* ── Attendance ─────────────────────────────────────────── */
export const recordAttendance = async () =>
  authFetch('/attendance/record', { method: 'POST' });

export const getTodayAttendance = async () =>
  authFetch('/attendance/today');

export const resetAttendance = async () =>
  authFetch('/attendance/reset', { method: 'DELETE' });

// Unlock a session so records can be edited
export const unlockAttendance = async (date = null) => {
  const query = date ? `?date=${date}` : '';
  return authFetch(`/attendance/unlock${query}`, { method: 'PUT' });
};

// Edit a single staff attendance record (status / isLate / lateMinutes)
export const editAttendanceRecord = async (recordId, data) =>
  authFetch(`/attendance/edit/${recordId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

// Filtered history
export const getAttendanceHistory = async ({ date, staffId, isLate, status } = {}) => {
  const params = new URLSearchParams();
  if (date)                  params.append('date',     date);
  if (staffId)               params.append('staffId',  staffId);
  if (isLate !== undefined)  params.append('isLate',   isLate);
  if (status)                params.append('status',   status);
  return authFetch(`/attendance/history?${params.toString()}`);
};

/* ── Settings ───────────────────────────────────────────── */
export const getSettings = async () => authFetch('/settings');

export const updateSalarySettings = async (defaultDailyRate) =>
  authFetch('/settings/salary', {
    method: 'PUT',
    body: JSON.stringify({ defaultDailyRate }),
  });