package com.backend.features.booking;

import com.backend.features.booking.dto.request.FittingBookingRequest;
import com.backend.features.booking.dto.response.BookingDetailResponse;
import com.backend.features.booking.dto.response.DirectBookingResponse;
import com.backend.features.booking.dto.response.FittingBookingResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;
    private final DirectBookingService directBookingService;

    // ── Fitting Booking (authenticated users) ─────────────────

    @PostMapping("/inventory/book-fitting")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<FittingBookingResponse> bookFitting(
            @RequestBody FittingBookingRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        log.info("Booking fitting for user: {}", userDetails.getUsername());

        if (request.getCustomerEmail() == null || request.getCustomerEmail().isEmpty()) {
            request.setCustomerEmail(userDetails.getUsername());
        }

        FittingBookingResponse response = bookingService.createBooking(request);

        if ("FAILED".equals(response.getStatus())) {
            return ResponseEntity.badRequest().body(response);
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/inventory/bookings/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<BookingDetailResponse>> getMyBookings(
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Fetching bookings for user: {}", userDetails.getUsername());
        List<BookingDetailResponse> bookings = bookingService
                .getBookingsByEmail(userDetails.getUsername())
                .stream()
                .map(BookingDetailResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(bookings);
    }

    // ── Admin: Fitting Bookings ────────────────────────────────

    @GetMapping("/admin/bookings/fitting")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<BookingDetailResponse>> getAllFittingBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<BookingDetailResponse> result = bookingService.getAllFittingBookings(pageable)
                .map(BookingDetailResponse::from);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/admin/bookings/fitting/{bookingId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateFittingBookingStatus(
            @PathVariable String bookingId,
            @RequestParam String status) {
        try {
            BookingDetailResponse dto = BookingDetailResponse.from(
                    bookingService.updateFittingBookingStatus(bookingId, status));
            Map<String, Object> response = new HashMap<>();
            response.put("id", dto.getId());
            response.put("status", dto.getStatus());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ── Admin: Direct Bookings ─────────────────────────────────

    @GetMapping("/admin/bookings/direct")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<DirectBookingResponse>> getAllDirectBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(directBookingService.getAllBookings(pageable));
    }

    @PutMapping("/admin/bookings/direct/{bookingId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateDirectBookingStatus(
            @PathVariable String bookingId,
            @RequestParam String status) {
        try {
            directBookingService.updateBookingStatus(bookingId, status);
            Map<String, Object> response = new HashMap<>();
            response.put("id", bookingId);
            response.put("status", status);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
