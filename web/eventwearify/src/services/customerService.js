// src/services/customerService.js
// Matches your AuthServiceImpl which stores token in AuthResponse.token
// and your JwtService which puts "role" + "userId" as claims.

const BASE_URL = 'http://localhost:8080/api/admin/users';

/**
 * Reads the JWT that your AuthController returns in AuthResponse.token.
 * Your frontend stores it after login — adjust the key below if needed.
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
 * Returns Spring Page wrapped in UserPageResponse:
 * {
 *   content:       UserSummaryResponse[],
 *   page:          number,   // 0-based
 *   size:          number,
 *   totalElements: number,
 *   totalPages:    number,
 * }
 */
export async function fetchCustomers({ page = 0, size = 8, search = '', status = '' } = {}) {
  const params = new URLSearchParams({ page, size, search, status });
  const res = await fetch(`${BASE_URL}?${params}`, {
    method: 'GET',
    headers: authHeaders(),
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
 * PATCH /api/admin/users/{id}/status
 * Body: { active: boolean }
 *
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update status (${res.status})`);
  }

  return res.json();
}