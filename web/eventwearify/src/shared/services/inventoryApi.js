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
      size: item.size,
      color: item.color,
      price: item.price,
      status: item.status,
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
      size: response.size,
      color: response.color,
      price: response.price,
      status: response.status,
      ageRange: response.ageRange || '',
      description: response.description || '',
      mediaFiles: response.mediaFiles || [],
    };
  } catch (error) {
    console.error('Error fetching item:', error);
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