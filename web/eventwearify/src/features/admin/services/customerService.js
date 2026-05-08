// src/services/customerService.js
// Matches your AdminUserService interface and AuthResponse token storage

const BASE_URL = 'http://localhost:8080/api/admin/users';

/**
 * Reads the JWT token from localStorage or sessionStorage.
 * Adjust the key based on where your AuthResponse.token is stored after login.
 * Common keys: 'token', 'authToken', 'jwt', 'accessToken'
 */
const getToken = () =>
  localStorage.getItem('token') ||
  sessionStorage.getItem('token');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

/**
 * GET /api/admin/users?page=0&size=8&search=&status=
 *
 * Returns UserPageResponse:
 * {
 *   content:       UserSummaryResponse[],
 *   page:          number,   // 0-based
 *   size:          number,
 *   totalElements: number,
 *   totalPages:    number,
 * }
 */
export async function fetchCustomers({ 
  page = 0, 
  size = 8, 
  search = '', 
  status = '',
  signal 
} = {}) {
  const params = new URLSearchParams({ page, size, search, status });
  const res = await fetch(`${BASE_URL}?${params}`, {
    method: 'GET',
    headers: authHeaders(),
    signal, // Supports request cancellation
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Unauthorized — please log in again.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch customers (${res.status})`);
  }

  return res.json();
}

/**
 * GET /api/admin/users/{id}
 *
 * Fetch a single customer's full details.
 * Returns a UserSummaryResponse with all available fields.
 */
export async function fetchCustomerDetail(id) {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Unauthorized — please log in again.');
  }
  if (res.status === 404) {
    throw new Error('Customer not found.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch customer (${res.status})`);
  }

  return res.json();
}

/**
 * PATCH /api/admin/users/{id}/status
 * Body: { active: boolean }
 *
 * Updates customer active status.
 * Returns updated UserSummaryResponse.
 */
export async function updateCustomerStatus(id, active) {
  const res = await fetch(`${BASE_URL}/${id}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ active }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Unauthorized — please log in again.');
  }
  if (res.status === 404) {
    throw new Error('Customer not found.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update status (${res.status})`);
  }

  return res.json();
}