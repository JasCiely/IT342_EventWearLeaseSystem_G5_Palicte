package com.backend.controller;

import com.backend.entity.Booking;
import com.backend.entity.DirectBooking;
import com.backend.repository.BookingRepository;
import com.backend.repository.DirectBookingRepository;
import com.backend.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/admin/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingRepository bookingRepository;
    private final DirectBookingRepository directBookingRepository;
    private final EmailService emailService;

    // Get all fitting bookings
    @GetMapping("/fitting")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<Booking>> getAllFittingBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Booking> bookings = bookingRepository.findAll(pageable);
        return ResponseEntity.ok(bookings);
    }

    // Get all direct bookings
    @GetMapping("/direct")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<DirectBooking>> getAllDirectBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<DirectBooking> bookings = directBookingRepository.findAll(pageable);
        return ResponseEntity.ok(bookings);
    }

    // Update fitting booking status
    @PutMapping("/fitting/{bookingId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateFittingBookingStatus(
            @PathVariable String bookingId,
            @RequestParam String status) {
        try {
            Booking booking = bookingRepository.findById(bookingId)
                    .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
            booking.setStatus(status);
            bookingRepository.save(booking);

            Map<String, Object> response = new HashMap<>();
            response.put("id", booking.getId());
            response.put("status", booking.getStatus());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Update direct booking status
    @PutMapping("/direct/{bookingId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateDirectBookingStatus(
            @PathVariable String bookingId,
            @RequestParam String status) {
        try {
            DirectBooking booking = directBookingRepository.findById(bookingId)
                    .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
            String oldStatus = booking.getBookingStatus();
            booking.setBookingStatus(status);
            directBookingRepository.save(booking);

            // Send email notification only when status changes to Approved or Rejected
            if (("Approved".equals(status) || "Rejected".equals(status)) && !oldStatus.equals(status)) {
                try {
                    emailService.sendDirectBookingStatusUpdate(
                            booking.getCustomerEmail(),
                            booking.getCustomerName(),
                            booking.getItemName() != null ? booking.getItemName() : "Item",
                            status,
                            bookingId);
                } catch (Exception e) {
                    log.warn("Failed to send status update email: {}", e.getMessage());
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("id", booking.getId());
            response.put("status", booking.getBookingStatus());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}