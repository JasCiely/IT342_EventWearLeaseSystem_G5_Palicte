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
  markItemAvailable,
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
  getBookedFittingSlots,
  completeFittingWithoutLease,
  rescheduleFitting,
  markLeaseStarted,
  returnLease,
  extendLease,
  getUnavailableDates,
  getOccupiedDirectDates,
  updateDirectBookingDates,
  markDirectBookingPickedUp,
  undoDirectBookingPickup,
} from '../../../shared/services/bookingApi.js';