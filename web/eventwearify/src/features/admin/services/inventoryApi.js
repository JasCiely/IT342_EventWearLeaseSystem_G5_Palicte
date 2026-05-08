// Re-exports from shared — do not add feature-specific logic here.
// Inventory-only functions:
export { fetchItems, fetchItemById, fetchPromotions, testBackendConnection } from '../../../shared/services/inventoryApi.js';
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
} from '../../../shared/services/bookingApi.js';