const API_BASE_URL = 'http://localhost:8080/api';

const getAuthToken = () => {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
};

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
  console.log(`API Request: ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, { ...options, headers });

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

// ── Fitting Booking ────────────────────────────────────────────────────────

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

// ── Direct Booking ─────────────────────────────────────────────────────────

export const createDirectBooking = async (bookingData) => {
  try {
    const payload = {
      inventoryItemId: bookingData.itemId,
      startDate: bookingData.startDate,
      endDate: bookingData.endDate,
      totalDays: bookingData.totalDays,
      basePrice: bookingData.basePrice,
      discountAmount: bookingData.discountAmount,
      finalPrice: bookingData.finalPrice,
      notes: bookingData.notes || '',
      customerName: bookingData.customerName,
      customerEmail: bookingData.customerEmail,
      customerPhone: bookingData.customerPhone,
      preferredSize: bookingData.preferredSize || ''
    };
    const response = await authFetch('/direct-bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response;
  } catch (error) {
    console.error('Error creating direct booking:', error);
    throw error;
  }
};

export const getUserDirectBookings = async (page = 0, size = 10) => {
  try {
    const response = await authFetch(`/direct-bookings/my-bookings?page=${page}&size=${size}`);
    // Handle paginated response
    if (response && response.content) {
      return response.content;
    }
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Error fetching user direct bookings:', error);
    return [];
  }
};

export const checkDirectBookingAvailability = async (itemId, startDate, endDate) => {
  try {
    const response = await authFetch(
      `/direct-bookings/availability?itemId=${itemId}&startDate=${startDate}&endDate=${endDate}`
    );
    return response.available === true;
  } catch (error) {
    console.error('Error checking availability:', error);
    return false;
  }
};

// ── Misc ───────────────────────────────────────────────────────────────────

export const testBackendConnection = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/inventory/items`, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Backend connection test failed:', error);
    return false;
  }
};