package com.backend.features.booking;

import com.backend.features.booking.dto.request.DirectBookingRequest;
import com.backend.features.booking.dto.response.DirectBookingResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/direct-bookings")
@RequiredArgsConstructor
public class DirectBookingController {

    private final DirectBookingService directBookingService;

    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<?> createDirectBooking(
            @RequestBody DirectBookingRequest request,
            Authentication authentication) {

        try {
            String userId = authentication.getName();
            DirectBookingResponse response = directBookingService.createDirectBooking(userId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.error("Error creating direct booking: {}", e.getMessage());
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            log.error("Unexpected error creating direct booking", e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to create booking");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @GetMapping("/my-bookings")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<Page<DirectBookingResponse>> getUserBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication) {

        String userId = authentication.getName();
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(directBookingService.getUserBookings(userId, pageable));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<DirectBookingResponse>> getAllBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(directBookingService.getAllBookings(pageable));
    }

    @GetMapping("/{bookingId}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('CUSTOMER')")
    public ResponseEntity<?> getBookingById(@PathVariable String bookingId, Authentication authentication) {
        try {
            DirectBookingResponse booking = directBookingService.getBookingById(bookingId);
            if (authentication.getAuthorities().stream()
                    .anyMatch(auth -> auth.getAuthority().equals("ROLE_CUSTOMER"))) {
                String userId = authentication.getName();
                if (!booking.getUserId().equals(userId)) {
                    Map<String, String> error = new HashMap<>();
                    error.put("error", "Access denied");
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
                }
            }
            return ResponseEntity.ok(booking);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{bookingId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateBookingStatus(
            @PathVariable String bookingId,
            @RequestParam String status) {

        try {
            DirectBookingResponse response = directBookingService.updateBookingStatus(bookingId, status);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error updating booking status", e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to update booking status");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    // Transitions Active Lease → Returned → Completed in one call; frees inventory.
    @PutMapping("/{bookingId}/return")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> returnAndCompleteLease(@PathVariable String bookingId) {
        try {
            DirectBookingResponse response = directBookingService.returnAndCompleteLease(bookingId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            log.error("Error returning lease {}", bookingId, e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to return lease");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    // Extends an active lease's end date after validating no conflicts.
    @PutMapping("/{bookingId}/extend")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> extendLease(
            @PathVariable String bookingId,
            @RequestBody Map<String, String> body) {
        try {
            LocalDate newEndDate = LocalDate.parse(body.get("newEndDate"));
            DirectBookingResponse response = directBookingService.extendLease(bookingId, newEndDate);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            log.error("Error extending lease {}", bookingId, e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to extend lease");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    // Returns date ranges blocked by other bookings — used by the admin extend date
    // picker.
    @GetMapping("/unavailable-dates")
    @PreAuthorize("hasRole('ADMIN') or hasRole('CUSTOMER')")
    public ResponseEntity<List<Map<String, String>>> getUnavailableDates(
            @RequestParam String itemId,
            @RequestParam(required = false) String excludeBookingId) {
        List<Map<String, String>> ranges = directBookingService.getUnavailableDateRanges(itemId, excludeBookingId);
        return ResponseEntity.ok(ranges);
    }

    @GetMapping("/availability")
    @PreAuthorize("hasRole('CUSTOMER') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Boolean>> checkAvailability(
            @RequestParam String itemId,
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam(required = false) String excludeBookingId) {

        try {
            LocalDate start = LocalDate.parse(startDate);
            LocalDate end = LocalDate.parse(endDate);
            boolean available = (excludeBookingId != null && !excludeBookingId.isBlank())
                    ? directBookingService.isItemAvailableExcluding(itemId, start, end, excludeBookingId)
                    : directBookingService.isItemAvailable(itemId, start, end);
            Map<String, Boolean> response = new HashMap<>();
            response.put("available", available);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error checking availability", e);
            Map<String, Boolean> response = new HashMap<>();
            response.put("available", false);
            return ResponseEntity.ok(response);
        }
    }

    @GetMapping("/my-all-bookings")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<List<DirectBookingResponse>> getAllMyDirectBookings(Authentication authentication) {
        String userId = authentication.getName();
        List<DirectBookingResponse> bookings = directBookingService.getAllUserBookingsList(userId);
        return ResponseEntity.ok(bookings);
    }

    @PatchMapping("/{bookingId}/cancel")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<?> cancelDirectBooking(
            @PathVariable String bookingId,
            Authentication authentication) {

        try {
            String userId = authentication.getName();
            directBookingService.cancelDirectBooking(bookingId, userId);
            return ResponseEntity.ok(Map.of("message", "Booking cancelled successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (SecurityException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
