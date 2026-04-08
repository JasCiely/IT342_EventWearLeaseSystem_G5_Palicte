// src/services/inventoryApi.js

const API_BASE_URL = 'http://localhost:8080/api';

// Helper to get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
};

// Check if user is logged in
const isAuthenticated = () => {
  const token = getAuthToken();
  return token && token !== 'undefined' && token !== 'null';
};

// Helper for API calls with auth
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
  console.log(`API Request: ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (response.status === 401) {
      console.warn('Received 401 Unauthorized, clearing auth token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || `API Error: ${response.status}`);
      }
      return data;
    } else {
      const text = await response.text();
      console.error('Non-JSON response:', text.substring(0, 200));
      if (!response.ok) {
        throw new Error(`Server error (${response.status}). Please check if backend is running.`);
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error('Invalid response format from server');
      }
    }
  } catch (error) {
    console.error('Fetch error:', error);
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Please make sure the backend is running on port 8080');
    }
    throw error;
  }
};

// Fetch all items
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
      finalPrice: item.finalPrice || item.price,
      discountApplied: item.promotionApplied !== 'None' ? item.promotionApplied : null,
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

// Fetch single item by ID with price calculation (uses backend Decorator pattern)
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
      finalPrice: response.finalPrice || response.price,
      discountApplied: response.promotionApplied !== 'None' ? response.promotionApplied : null,
      priceDescription: response.priceDescription || null,
      savings: response.savings || 0,
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

// Fetch item with calculated price (uses Decorator pattern on backend)
export const fetchItemPrice = async (id) => {
  try {
    const response = await authFetch(`/inventory/items/${id}/price`);
    return {
      itemId: response.itemId,
      itemName: response.itemName,
      originalPrice: response.originalPrice,
      finalPrice: response.finalPrice,
      promotionApplied: response.promotionApplied,
      priceDescription: response.priceDescription,
      savings: response.savings,
    };
  } catch (error) {
    console.error('Error fetching item price:', error);
    return null;
  }
};

// Fetch all promotions
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

// Apply promotion to price (uses backend Adapter pattern)
export const applyPromotion = async (promotionCode, originalPrice) => {
  try {
    const response = await authFetch('/inventory/promotions/apply', {
      method: 'POST',
      body: JSON.stringify({ code: promotionCode, originalPrice }),
    });
    return response;
  } catch (error) {
    console.error('Error applying promotion:', error);
    return { finalPrice: originalPrice };
  }
};

// Book a fitting
export const bookFitting = async (bookingData) => {
  try {
    const response = await authFetch('/inventory/book-fitting', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
    return response;
  } catch (error) {
    console.error('Error booking fitting:', error);
    throw error;
  }
};

// Test connection to backend
export const testBackendConnection = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/inventory/items`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch (error) {
    console.error('Backend connection test failed:', error);
    return false;
  }
};

// Get user's bookings
export const getUserBookings = async () => {
  try {
    const response = await authFetch('/inventory/bookings/my');
    const bookingsArray = Array.isArray(response) ? response : (response.content || response.bookings || []);
    return bookingsArray.map(booking => ({
      id: booking.id,
      bookingId: booking.bookingId,
      itemId: booking.itemId,
      itemName: booking.itemName,
      fittingDate: booking.fittingDate,
      fittingTime: booking.fittingTime,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      preferredSize: booking.preferredSize,
      notes: booking.notes,
      status: booking.status,
      createdAt: booking.createdAt,
    }));
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    return [];
  }
};