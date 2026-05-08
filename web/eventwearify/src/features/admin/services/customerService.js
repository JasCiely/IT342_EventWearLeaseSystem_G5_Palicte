// src/features/admin/services/customerService.js
import { authFetch } from '../../../shared/services/apiClient.js';

const BASE = '/admin/users';

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
  signal,
} = {}) {
  const params = new URLSearchParams({ page, size, search, status });
  return authFetch(`${BASE}?${params}`, { method: 'GET', signal });
}

/**
 * GET /api/admin/users/{id}
 *
 * Fetch a single customer's full details.
 * Returns a UserSummaryResponse with all available fields.
 */
export async function fetchCustomerDetail(id) {
  return authFetch(`${BASE}/${id}`, { method: 'GET' });
}

/**
 * PATCH /api/admin/users/{id}/status
 * Body: { active: boolean }
 *
 * Updates customer active status.
 * Returns updated UserSummaryResponse.
 */
export async function updateCustomerStatus(id, active) {
  return authFetch(`${BASE}/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
}
