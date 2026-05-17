import { authFetch, API_BASE_URL_ROOT } from './apiClient.js';

// ── Items ──────────────────────────────────────────────────────────────────

export const fetchItems = async () => {
  try {
    const response = await authFetch('/inventory/items');
    const itemsArray = Array.isArray(response) ? response : (response.content || response.items || []);
    return itemsArray.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      subtype: item.subtype || '',
      sizes: Array.isArray(item.sizes) ? item.sizes : [],
      price: item.price,
      status: item.status,
      maintenanceEndDate: item.maintenanceEndDate || null,
      ageRange: item.ageRange || '',
      description: item.description || '',
      mediaFiles: item.mediaFiles || [],
    }));
  } catch (error) {
    console.error('Error fetching items:', error);
    throw error;
  }
};

export const fetchItemById = async (id) => {
  try {
    const response = await authFetch(`/inventory/items/${id}`);
    return {
      id: response.id,
      name: response.name,
      category: response.category,
      subtype: response.subtype || '',
      sizes: Array.isArray(response.sizes) ? response.sizes : [],
      price: response.price,
      status: response.status,
      maintenanceEndDate: response.maintenanceEndDate || null,
      ageRange: response.ageRange || '',
      description: response.description || '',
      mediaFiles: response.mediaFiles || [],
    };
  } catch (error) {
    console.error('Error fetching item:', error);
    throw error;
  }
};

export const markItemAvailable = async (itemId) => {
  try {
    const response = await authFetch(`/inventory/items/${itemId}/mark-available`, { method: 'PUT' });
    return response;
  } catch (error) {
    console.error('Error marking item available:', error);
    throw error;
  }
};

// ── Promotions ─────────────────────────────────────────────────────────────

export const fetchPromotions = async () => {
  try {
    const response = await authFetch('/inventory/promotions');
    const promosArray = Array.isArray(response) ? response : (response.content || response.promotions || []);
    return promosArray.map(promo => ({
      id: promo.id,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      items: promo.items || [],
      start: promo.startDate || promo.start,
      end: promo.endDate || promo.end,
      active: promo.active,
    }));
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return [];
  }
};

// ── Misc ───────────────────────────────────────────────────────────────────

export const testBackendConnection = async () => {
  try {
    const response = await fetch(`${API_BASE_URL_ROOT}/inventory/items`, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Backend connection test failed:', error);
    return false;
  }
};

// ── Items (mutations) ──────────────────────────────────────────────────────

export const createItem = async (itemData, files = []) => {
  const fd = new FormData();
  fd.append('data', JSON.stringify(itemData));
  files.forEach(f => fd.append('files', f));
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  const res = await fetch(`${API_BASE_URL_ROOT}/inventory/items`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to create item');
  }
  return res.json();
};

export const updateItem = async (id, itemData, newFiles = [], keepUrls = []) => {
  const fd = new FormData();
  fd.append('data', JSON.stringify(itemData));
  fd.append('keepUrls', JSON.stringify(keepUrls));
  newFiles.forEach(f => fd.append('files', f));
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  const res = await fetch(`${API_BASE_URL_ROOT}/inventory/items/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update item');
  }
  return res.json();
};

export const deleteItem = async (id) => {
  const res = await authFetch(`/inventory/items/${id}`, { method: 'DELETE' });
  return res;
};

// ── Promotions (mutations) ─────────────────────────────────────────────────

export const createPromotion = async (promoData) => {
  return authFetch('/inventory/promotions', {
    method: 'POST',
    body: JSON.stringify(promoData),
  });
};

export const updatePromotion = async (id, promoData) => {
  return authFetch(`/inventory/promotions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(promoData),
  });
};

export const deletePromotion = async (id) => {
  return authFetch(`/inventory/promotions/${id}`, { method: 'DELETE' });
};

// Add to shared/services/inventoryApi.js

// ── Inventory Settings ──────────────────────────────────────────────────────
export const fetchInventorySettings = async () => {
  try {
    // Use public endpoint (no admin role required)
    return await authFetch('/inventory-settings');
  } catch (error) {
    console.error('Error fetching inventory settings:', error);
    // Return defaults as fallback
    return {
      minLeaseDays: 2,
      weeklyDiscount: 100,
      monthlyDiscountCap: 300
    };
  }
};

export const saveInventorySettings = async (settings) => {
  try {
    // Admin-only endpoint (requires ADMIN role)
    return await authFetch('/admin/inventory-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  } catch (error) {
    console.error('Error saving inventory settings:', error);
    throw error;
  }
};