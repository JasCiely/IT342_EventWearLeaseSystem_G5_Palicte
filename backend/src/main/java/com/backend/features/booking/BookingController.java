package com.backend.features.booking;

import com.backend.features.booking.dto.request.FittingBookingRequest;
import com.backend.features.booking.dto.request.FittingRescheduleRequest;
import com.backend.features.booking.dto.response.BookingDetailResponse;
import com.backend.features.booking.dto.response.DirectBookingResponse;
import com.backend.features.booking.dto.response.FittingAvailabilityResponse;
import com.backend.features.booking.dto.response.FittingBookingResponse;
import com.backend.shared.entity.Booking;
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

import java.time.LocalDate;
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
    @PreAuthorize("hasRole('CUSTOMER')")
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
    @PreAuthorize("hasRole('CUSTOMER')")
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

    // ── Fitting Availability Check ────────────────────────────────

    @GetMapping("/inventory/fitting/availability")
    public ResponseEntity<FittingAvailabilityResponse> checkFittingAvailability(
            @RequestParam String date,
            @RequestParam String time) {
        boolean available = bookingService.checkAvailability(date, time, null);
        long bookedCount = bookingService.countBookingsForSlot(date, time);
        return ResponseEntity.ok(new FittingAvailabilityResponse(
                available, (int) bookedCount, 5,
                available ? "Slot available" : "This time slot is fully booked"));
    }

    @GetMapping("/inventory/fitting/available-slots")
    public ResponseEntity<List<String>> getAvailableTimeSlots(@RequestParam String date) {
        return ResponseEntity.ok(bookingService.getAvailableTimeSlots(date));
    }

    @GetMapping("/inventory/fitting/booked-slots")
    public ResponseEntity<List<String>> getBookedFittingSlots(
            @RequestParam String itemId,
            @RequestParam String date) {
        return ResponseEntity.ok(bookingService.getBookedFittingSlots(itemId, date));
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

    @PutMapping("/admin/bookings/fitting/{bookingId}/lease-started")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> markLeaseStarted(
            @PathVariable String bookingId,
            @RequestBody Map<String, String> body) {
        try {
            String directBookingId = body.get("directBookingId");
            Booking booking = bookingService.markLeaseStartedFromFitting(bookingId, directBookingId);
            Map<String, Object> response = new HashMap<>();
            response.put("id", booking.getId());
            response.put("status", booking.getStatus());
            response.put("leaseStarted", booking.isLeaseStarted());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/admin/bookings/fitting/{bookingId}/complete-no-lease")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> completeFittingWithoutLease(@PathVariable String bookingId) {
        try {
            Booking booking = bookingService.completeFittingWithoutLease(bookingId);
            Map<String, Object> response = new HashMap<>();
            response.put("id", booking.getId());
            response.put("status", booking.getStatus());
            response.put("message", "Fitting marked as completed without lease");
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/admin/bookings/fitting/{bookingId}/reschedule")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> rescheduleFitting(
            @PathVariable String bookingId,
            @RequestBody FittingRescheduleRequest request) {
        try {
            // Slot capacity check (max 5 per time slot, excluding this booking)
            boolean available = bookingService.checkAvailability(request.getFittingDate(), request.getFittingTime(),
                    bookingId);
            if (!available) {
                return ResponseEntity.badRequest().body(Map.of("error", "This time slot is fully booked"));
            }

            // Working-day, working-hours, slot-alignment, and per-item uniqueness
            // are validated inside rescheduleFitting and throw IllegalArgumentException
            bookingService.rescheduleFitting(bookingId, request.getFittingDate(), request.getFittingTime());

            Map<String, Object> response = new HashMap<>();
            response.put("id", bookingId);
            response.put("fittingDate", request.getFittingDate());
            response.put("fittingTime", request.getFittingTime());
            response.put("message", "Fitting rescheduled successfully");
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            // Distinguishes "not found" from validation errors by message content
            String msg = e.getMessage();
            if (msg != null && msg.equals("Booking not found")) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.badRequest().body(Map.of("error", msg));
        }
    }

    @GetMapping("/admin/bookings/fitting/{bookingId}/check-availability")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<FittingAvailabilityResponse> checkAvailabilityForReschedule(
            @PathVariable String bookingId,
            @RequestParam String date,
            @RequestParam String time) {
        boolean available = bookingService.checkAvailability(date, time, bookingId);
        return ResponseEntity.ok(new FittingAvailabilityResponse(
                available, 0, 5,
                available ? "Slot available" : "This time slot is fully booked"));
    }

    // ── Direct Booking: Occupied Dates (customer-facing) ──────

    @GetMapping("/bookings/direct/occupied-dates")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getOccupiedDirectDates(@RequestParam String itemId) {
        List<Map<String, String>> ranges = directBookingService.getUnavailableDateRanges(itemId, null);
        Map<String, Object> response = new HashMap<>();
        response.put("occupiedRanges", ranges);
        return ResponseEntity.ok(response);
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

    @PostMapping("/admin/bookings/fitting/{bookingId}/resend-email")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> resendFittingEmail(@PathVariable String bookingId) {
        try {
            bookingService.resendFittingConfirmationEmail(bookingId);
            return ResponseEntity.ok(Map.of("message", "Email resent successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/admin/bookings/direct/{bookingId}/resend-email")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> resendDirectBookingEmail(@PathVariable String bookingId) {
        try {
            directBookingService.resendDirectBookingConfirmationEmail(bookingId);
            return ResponseEntity.ok(Map.of("message", "Email resent successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/admin/bookings/direct/{bookingId}/dates")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateDirectBookingDates(
            @PathVariable String bookingId,
            @RequestBody Map<String, String> body) {
        try {
            LocalDate startDate = LocalDate.parse(body.get("startDate"));
            LocalDate endDate   = LocalDate.parse(body.get("endDate"));
            DirectBookingResponse response = directBookingService.updateDirectBookingDates(bookingId, startDate, endDate);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            String msg = e.getMessage();
            if ("Booking not found".equals(msg)) return ResponseEntity.notFound().build();
            return ResponseEntity.badRequest().body(Map.of("error", msg));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
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
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/admin/bookings/direct/{bookingId}/pickup")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> markDirectBookingPickedUp(@PathVariable String bookingId) {
        try {
            DirectBookingResponse response = directBookingService.markPickedUp(bookingId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/admin/bookings/direct/{bookingId}/undo-pickup")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> undoDirectBookingPickup(@PathVariable String bookingId) {
        try {
            DirectBookingResponse response = directBookingService.undoPickup(bookingId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/inventory/bookings/{bookingId}/cancel")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<?> cancelFittingBooking(
            @PathVariable String bookingId,
            @AuthenticationPrincipal UserDetails userDetails) {

        try {
            bookingService.cancelFittingBooking(bookingId, userDetails.getUsername());
            return ResponseEntity.ok(Map.of("message", "Booking cancelled successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (SecurityException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}