package com.backend.features.booking;

import com.backend.features.booking.dto.request.FittingBookingRequest;
import com.backend.features.booking.dto.response.FittingBookingResponse;
import com.backend.shared.entity.Booking;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface BookingService {
    FittingBookingResponse createBooking(FittingBookingRequest request);

    List<Booking> getBookingsByEmail(String email);

    List<Booking> getBookingsByUserId(Long userId);

    List<Booking> getUpcomingBookingsByEmail(String email);

    Page<Booking> getAllFittingBookings(Pageable pageable);

    Booking updateFittingBookingStatus(String bookingId, String status);

    Booking completeFittingWithoutLease(String bookingId);

    Booking markLeaseStartedFromFitting(String bookingId, String directBookingId);

    boolean checkAvailability(String fittingDate, String fittingTime, String excludeId);

    List<String> getAvailableTimeSlots(String fittingDate);

    List<String> getBookedFittingSlots(String itemId, String date);
}