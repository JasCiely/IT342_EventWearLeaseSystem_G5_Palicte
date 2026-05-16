package com.backend.features.booking;

import com.backend.features.booking.dto.request.AdminDirectBookingRequest;
import com.backend.features.booking.dto.request.DirectBookingRequest;
import com.backend.features.booking.dto.response.DirectBookingResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface DirectBookingService {
    DirectBookingResponse createDirectBooking(String userId, DirectBookingRequest request);

    Page<DirectBookingResponse> getUserBookings(String userId, Pageable pageable);

    Page<DirectBookingResponse> getAllBookings(Pageable pageable);

    DirectBookingResponse getBookingById(String bookingId);

    DirectBookingResponse updateBookingStatus(String bookingId, String status);

    boolean isItemAvailable(String itemId, LocalDate startDate, LocalDate endDate);

    // Marks the lease as Returned then immediately Completed in one transaction;
    // restores item availability as a side-effect of the status change.
    DirectBookingResponse returnAndCompleteLease(String bookingId);

    // Extends the lease end date after validating that no other booking conflicts.
    DirectBookingResponse extendLease(String bookingId, LocalDate newEndDate);

    // Returns date ranges blocked by other bookings for the same item.
    // excludeBookingId is the current booking being extended (so it doesn't block
    // itself).
    List<Map<String, String>> getUnavailableDateRanges(String itemId, String excludeBookingId);

    // Called by the scheduler: auto-cancels Approved bookings whose pickup deadline has passed.
    void autoExpireApprovedBookings();

    // Transitions an Approved booking to Active Lease when the item is physically picked up.
    DirectBookingResponse markPickedUp(String bookingId);

    // Reverts an Active Lease booking back to Approved (admin correction for auto-activated records).
    DirectBookingResponse undoPickup(String bookingId);

    void resendDirectBookingConfirmationEmail(String bookingId);

    List<DirectBookingResponse> getAllUserBookingsList(String userId);

    void cancelDirectBooking(String bookingId, String userId);

    DirectBookingResponse createDirectBookingForCustomer(AdminDirectBookingRequest request);

    // Edits start and end dates for Pending or Approved bookings, re-validating availability
    // and recalculating total days and price based on the original daily rate.
    DirectBookingResponse updateDirectBookingDates(String bookingId, LocalDate startDate, LocalDate endDate);

    // Same as isItemAvailable but excludes a specific booking from the conflict check
    // (used when editing an existing booking so it doesn't block itself).
    boolean isItemAvailableExcluding(String itemId, LocalDate startDate, LocalDate endDate, String excludeBookingId);
}
