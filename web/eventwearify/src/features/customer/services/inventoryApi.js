// features/customer/services/inventoryApi.js
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
  deletePromotion
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
  getBookedFittingSlots,      
  getOccupiedDirectDates,    
} from '../../../shared/services/bookingApi.js';