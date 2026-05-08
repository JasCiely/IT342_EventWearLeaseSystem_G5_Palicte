package com.backend.features.booking;

import com.backend.features.booking.dto.request.DirectBookingRequest;
import com.backend.features.booking.dto.response.DirectBookingResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;

public interface DirectBookingService {
    DirectBookingResponse createDirectBooking(String userId, DirectBookingRequest request);

    Page<DirectBookingResponse> getUserBookings(String userId, Pageable pageable);

    Page<DirectBookingResponse> getAllBookings(Pageable pageable);

    DirectBookingResponse getBookingById(String bookingId);

    DirectBookingResponse updateBookingStatus(String bookingId, String status);

    boolean isItemAvailable(String itemId, LocalDate startDate, LocalDate endDate);
}
