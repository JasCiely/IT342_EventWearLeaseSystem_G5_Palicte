import { authFetch, publicFetch } from './apiClient.js';

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
      leaseStarted: booking.leaseStarted,
      leaseBookingId: booking.leaseBookingId,
    }));
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    return [];
  }
};

// ── Fitting Availability ────────────────────────────────────────────────────

export const checkFittingAvailability = async (date, time) => {
  try {
    const response = await authFetch(`/inventory/fitting/availability?date=${date}&time=${time}`);
    return response;
  } catch (error) {
    console.error('Error checking fitting availability:', error);
    return { available: false, message: 'Unable to check availability' };
  }
};

export const getAvailableTimeSlots = async (date) => {
  try {
    const response = await authFetch(`/inventory/fitting/available-slots?date=${date}`);
    return response;
  } catch (error) {
    console.error('Error fetching available time slots:', error);
    return [];
  }
};

// ── Fitting to Lease ────────────────────────────────────────────────────────

export const completeFittingWithoutLease = async (bookingId) => {
  try {
    const response = await authFetch(`/admin/bookings/fitting/${bookingId}/complete-no-lease`, {
      method: 'PUT',
    });
    return response;
  } catch (error) {
    console.error('Error completing fitting without lease:', error);
    throw error;
  }
};

export const rescheduleFitting = async (bookingId, fittingDate, fittingTime) => {
  try {
    const response = await authFetch(`/admin/bookings/fitting/${bookingId}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify({ fittingDate, fittingTime }),
    });
    return response;
  } catch (error) {
    console.error('Error rescheduling fitting:', error);
    throw error;
  }
};

export const markLeaseStarted = async (bookingId, directBookingId) => {
  try {
    const response = await authFetch(`/admin/bookings/fitting/${bookingId}/lease-started`, {
      method: 'PUT',
      body: JSON.stringify({ directBookingId }),
    });
    return response;
  } catch (error) {
    console.error('Error marking lease started:', error);
    throw error;
  }
};

// ── Direct Booking ─────────────────────────────────────────────────────────

export const createDirectBooking = async (bookingData) => {
  try {
    const payload = {
      inventoryItemId: bookingData.itemId,
      itemName: bookingData.itemName ?? '',
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
      preferredSize: bookingData.preferredSize || '',
      fittingBookingId: bookingData.fittingBookingId,
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
    if (response && response.content) {
      return response.content;
    }
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Error fetching user direct bookings:', error);
    return [];
  }
};

export const checkDirectBookingAvailability = async (itemId, startDate, endDate, excludeBookingId = null) => {
  try {
    const params = new URLSearchParams({ itemId, startDate, endDate });
    if (excludeBookingId) params.append('excludeBookingId', excludeBookingId);
    const response = await authFetch(`/direct-bookings/availability?${params.toString()}`);
    return response.available === true;
  } catch (error) {
    console.error('Error checking availability:', error);
    return false;
  }
};

// ── Admin Bookings ─────────────────────────────────────────────────────────

export const getAllFittingBookings = async (page = 0, size = 20) => {
  try {
    const response = await authFetch(`/admin/bookings/fitting?page=${page}&size=${size}`);
    return response;
  } catch (error) {
    console.error('Error fetching fitting bookings:', error);
    return { content: [], totalElements: 0 };
  }
};

export const getAllDirectBookings = async (page = 0, size = 20) => {
  try {
    const response = await authFetch(`/admin/bookings/direct?page=${page}&size=${size}`);
    return response;
  } catch (error) {
    console.error('Error fetching direct bookings:', error);
    return { content: [], totalElements: 0 };
  }
};

export const updateFittingBookingStatus = async (bookingId, status) => {
  try {
    const response = await authFetch(`/admin/bookings/fitting/${bookingId}/status?status=${status}`, {
      method: 'PUT',
    });
    return response;
  } catch (error) {
    console.error('Error updating fitting booking status:', error);
    throw error;
  }
};

export const updateDirectBookingStatus = async (bookingId, status) => {
  try {
    const response = await authFetch(`/admin/bookings/direct/${bookingId}/status?status=${status}`, {
      method: 'PUT',
    });
    return response;
  } catch (error) {
    console.error('Error updating direct booking status:', error);
    throw error;
  }
};

// Transitions Active Lease → Returned → Completed and frees inventory.
export const returnLease = async (bookingId) => {
  try {
    const response = await authFetch(`/direct-bookings/${bookingId}/return`, { method: 'PUT' });
    return response;
  } catch (error) {
    console.error('Error returning lease:', error);
    throw error;
  }
};

// Extends an active lease to a new end date (backend validates conflicts).
export const extendLease = async (bookingId, newEndDate) => {
  try {
    const response = await authFetch(`/direct-bookings/${bookingId}/extend`, {
      method: 'PUT',
      body: JSON.stringify({ newEndDate }),
    });
    return response;
  } catch (error) {
    console.error('Error extending lease:', error);
    throw error;
  }
};

// Returns date ranges blocked by other bookings for an item.
export const getUnavailableDates = async (itemId, excludeBookingId = null) => {
  try {
    const params = new URLSearchParams({ itemId });
    if (excludeBookingId) params.append('excludeBookingId', excludeBookingId);
    const response = await authFetch(`/direct-bookings/unavailable-dates?${params.toString()}`);
    return response;
  } catch (error) {
    console.error('Error fetching unavailable dates:', error);
    return [];
  }
};

export const getBookedFittingSlots = async (itemId, date) => {
  try {
    const data = await publicFetch(`/inventory/fitting/booked-slots?itemId=${itemId}&date=${date}`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('getBookedFittingSlots error:', err);
    return [];
  }
};

export const getOccupiedDirectDates = async (itemId) => {
  try {
    const data = await authFetch(`/bookings/direct/occupied-dates?itemId=${itemId}`);
    return Array.isArray(data?.occupiedRanges) ? data.occupiedRanges : [];
  } catch (err) {
    console.error('getOccupiedDirectDates error:', err);
    return [];
  }
};

// ── NEW: Cancel Booking endpoints (no leading /api) ─────────────────────────

export const cancelFittingBooking = async (bookingId) => {
  try {
    // Endpoint: /inventory/bookings/{bookingId}/cancel
    const response = await authFetch(`/inventory/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
    });
    return response;
  } catch (error) {
    console.error('Error cancelling fitting booking:', error);
    throw error;
  }
};

export const updateDirectBookingDates = async (bookingId, startDate, endDate) => {
  try {
    const response = await authFetch(`/admin/bookings/direct/${bookingId}/dates`, {
      method: 'PUT',
      body: JSON.stringify({ startDate, endDate }),
    });
    return response;
  } catch (error) {
    console.error('Error updating rental dates:', error);
    throw error;
  }
};

export const cancelDirectBooking = async (bookingId) => {
  try {
    // Endpoint: /direct-bookings/{bookingId}/cancel
    const response = await authFetch(`/direct-bookings/${bookingId}/cancel`, {
      method: 'PATCH',
    });
    return response;
  } catch (error) {
    console.error('Error cancelling direct booking:', error);
    throw error;
  }
};

export const editCustomerBookingDates = async (bookingId, startDate, endDate) => {
  try {
    const response = await authFetch(`/direct-bookings/${bookingId}/edit-dates`, {
      method: 'PUT',
      body: JSON.stringify({ startDate, endDate }),
    });
    return response;
  } catch (error) {
    console.error('Error editing booking dates:', error);
    throw error;
  }
};

export const rescheduleCustomerFitting = async (bookingId, fittingDate, fittingTime) => {
  try {
    const response = await authFetch(`/inventory/bookings/${bookingId}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ fittingDate, fittingTime }),
    });
    return response;
  } catch (error) {
    console.error('Error rescheduling fitting:', error);
    throw error;
  }
};

// Transitions an Approved direct booking to Active Lease (item physically picked up).
export const markDirectBookingPickedUp = async (bookingId) => {
  try {
    const response = await authFetch(`/admin/bookings/direct/${bookingId}/pickup`, {
      method: 'PUT',
    });
    return response;
  } catch (error) {
    console.error('Error marking booking as picked up:', error);
    throw error;
  }
};

// Reverts an Active Lease booking back to Approved (admin correction for auto-activated records).
export const undoDirectBookingPickup = async (bookingId) => {
  try {
    const response = await authFetch(`/admin/bookings/direct/${bookingId}/undo-pickup`, {
      method: 'PUT',
    });
    return response;
  } catch (error) {
    console.error('Error undoing pickup:', error);
    throw error;
  }
};