package com.backend.features.booking;

import com.backend.features.booking.dto.request.AdminDirectBookingRequest;
import com.backend.features.booking.dto.request.AdminFittingBookingRequest;
import com.backend.features.booking.dto.response.DirectBookingResponse;
import com.backend.features.booking.dto.response.FittingBookingResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/bookings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminBookingController {

    private final BookingService bookingService;
    private final DirectBookingService directBookingService;

    @PostMapping("/fitting")
    public ResponseEntity<FittingBookingResponse> createFittingBooking(
            @RequestBody AdminFittingBookingRequest request) {
        return ResponseEntity.ok(bookingService.createFittingBookingForCustomer(request));
    }

    @PostMapping("/direct")
    public ResponseEntity<DirectBookingResponse> createDirectBooking(
            @RequestBody AdminDirectBookingRequest request) {
        return ResponseEntity.ok(directBookingService.createDirectBookingForCustomer(request));
    }
}
