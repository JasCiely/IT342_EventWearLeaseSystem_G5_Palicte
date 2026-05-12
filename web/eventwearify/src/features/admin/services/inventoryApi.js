// Re-exports from shared — do not add feature-specific logic here.
// Inventory-only functions:
export { 
  fetchItems, 
  fetchItemById, 
  fetchPromotions, 
  testBackendConnection,
  createItem,
  updateItem,
  deleteItem,
  createPromotion,
  updatePromotion,
  deletePromotion,
  fetchInventorySettings,
  saveInventorySettings,
} from '../../../shared/services/inventoryApi.js';

// Booking functions:
export {
  bookFitting,
  getUserBookings,
  createDirectBooking,
  getUserDirectBookings,
  checkDirectBookingAvailability,
  getAllFittingBookings,
  getAllDirectBookings,
  updateFittingBookingStatus,
  updateDirectBookingStatus,
  checkFittingAvailability,
  getAvailableTimeSlots,
  completeFittingWithoutLease,
  rescheduleFitting,
  markLeaseStarted,
  returnLease,
  extendLease,
  getUnavailableDates,
} from '../../../shared/services/bookingApi.js';