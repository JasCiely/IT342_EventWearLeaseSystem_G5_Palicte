package com.backend.features.booking;

import com.backend.features.booking.dto.request.DirectBookingRequest;
import com.backend.features.booking.dto.response.DirectBookingResponse;
import com.backend.shared.entity.DirectBooking;
import com.backend.features.booking.DirectBookingRepository;
import com.backend.features.booking.DirectBookingService;
import com.backend.shared.email.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DirectBookingServiceImpl implements DirectBookingService {

    private final DirectBookingRepository directBookingRepository;
    private final EmailService emailService;

    @Override
    @Transactional
    public DirectBookingResponse createDirectBooking(String userId, DirectBookingRequest request) {
        log.info("Creating direct booking for user {} and item {}", userId, request.getInventoryItemId());

        if (request.getStartDate().isAfter(request.getEndDate())) {
            throw new IllegalArgumentException("Start date cannot be after end date");
        }

        if (request.getCustomerName() == null || request.getCustomerName().trim().isEmpty()) {
            throw new IllegalArgumentException("Customer name is required");
        }
        if (request.getCustomerEmail() == null || request.getCustomerEmail().trim().isEmpty()) {
            throw new IllegalArgumentException("Customer email is required");
        }
        if (request.getCustomerPhone() == null || request.getCustomerPhone().trim().isEmpty()) {
            throw new IllegalArgumentException("Customer phone is required");
        }

        if (!isItemAvailable(request.getInventoryItemId(), request.getStartDate(), request.getEndDate())) {
            throw new IllegalArgumentException("Item is not available for the selected dates");
        }

        int totalDays = (int) ChronoUnit.DAYS.between(request.getStartDate(), request.getEndDate()) + 1;

        if (request.getBasePrice() == null || request.getBasePrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Base price must be greater than zero");
        }

        if (request.getDiscountAmount() == null) {
            request.setDiscountAmount(BigDecimal.ZERO);
        }

        if (request.getFinalPrice() == null) {
            request.setFinalPrice(request.getBasePrice().subtract(request.getDiscountAmount()));
        }

        DirectBooking booking = new DirectBooking();
        booking.setUserId(userId);
        booking.setInventoryItemId(request.getInventoryItemId());
        booking.setStartDate(request.getStartDate());
        booking.setEndDate(request.getEndDate());
        booking.setTotalDays(totalDays);
        booking.setBasePrice(request.getBasePrice());
        booking.setDiscountAmount(request.getDiscountAmount());
        booking.setFinalPrice(request.getFinalPrice());
        booking.setNotes(request.getNotes());
        booking.setBookingStatus("Pending");
        booking.setCustomerName(request.getCustomerName());
        booking.setCustomerEmail(request.getCustomerEmail());
        booking.setCustomerPhone(request.getCustomerPhone());
        booking.setPreferredSize(request.getPreferredSize());
        booking.setItemName(request.getItemName() != null ? request.getItemName() : "");

        DirectBooking savedBooking = directBookingRepository.save(booking);
        log.info("Direct booking created successfully with ID: {}", savedBooking.getId());

        try {
            emailService.sendDirectBookingConfirmation(
                    savedBooking.getCustomerEmail(),
                    savedBooking.getCustomerName(),
                    savedBooking.getId(),
                    savedBooking.getItemName(),
                    savedBooking.getStartDate().toString(),
                    savedBooking.getEndDate().toString(),
                    savedBooking.getTotalDays(),
                    savedBooking.getFinalPrice());
        } catch (Exception e) {
            log.warn("Failed to send confirmation email for booking {}: {}", savedBooking.getId(), e.getMessage());
        }

        return mapToResponse(savedBooking);
    }

    @Override
    public Page<DirectBookingResponse> getUserBookings(String userId, Pageable pageable) {
        return directBookingRepository.findByUserId(userId, pageable)
                .map(this::mapToResponse);
    }

    @Override
    public Page<DirectBookingResponse> getAllBookings(Pageable pageable) {
        return directBookingRepository.findAll(pageable)
                .map(this::mapToResponse);
    }

    @Override
    public DirectBookingResponse getBookingById(String bookingId) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        return mapToResponse(booking);
    }

    @Override
    @Transactional
    public DirectBookingResponse updateBookingStatus(String bookingId, String status) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        String oldStatus = booking.getBookingStatus();
        booking.setBookingStatus(status);
        DirectBooking updatedBooking = directBookingRepository.save(booking);

        log.info("Updated booking {} status from {} to {}", bookingId, oldStatus, status);

        try {
            if ("Approved".equals(status) || "Rejected".equals(status)) {
                emailService.sendDirectBookingStatusUpdate(
                        updatedBooking.getCustomerEmail(),
                        updatedBooking.getCustomerName(),
                        updatedBooking.getItemName(),
                        status,
                        updatedBooking.getId());
            }
        } catch (Exception e) {
            log.warn("Failed to send status update email for booking {}: {}", bookingId, e.getMessage());
        }

        return mapToResponse(updatedBooking);
    }

    @Override
    public boolean isItemAvailable(String itemId, LocalDate startDate, LocalDate endDate) {
        return !directBookingRepository.hasOverlappingBookings(itemId, startDate, endDate);
    }

    @Override
    @Transactional
    public DirectBookingResponse returnAndCompleteLease(String bookingId) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!"Active Lease".equals(booking.getBookingStatus())) {
            throw new IllegalArgumentException("Only active leases can be returned");
        }

        // ACTIVE → RETURNED → COMPLETED in one transaction
        booking.setBookingStatus("Returned");
        directBookingRepository.save(booking);

        booking.setBookingStatus("Completed");
        DirectBooking completed = directBookingRepository.save(booking);

        log.info("Lease {} returned and completed", bookingId);

        try {
            emailService.sendLeaseCompletedEmail(
                    completed.getCustomerEmail(),
                    completed.getCustomerName(),
                    completed.getItemName(),
                    completed.getId());
        } catch (Exception e) {
            log.warn("Failed to send lease completed email for booking {}: {}", bookingId, e.getMessage());
        }

        return mapToResponse(completed);
    }

    @Override
    @Transactional
    public DirectBookingResponse extendLease(String bookingId, LocalDate newEndDate) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!"Active Lease".equals(booking.getBookingStatus())) {
            throw new IllegalArgumentException("Only active leases can be extended");
        }

        if (!newEndDate.isAfter(booking.getEndDate())) {
            throw new IllegalArgumentException("New end date must be after current end date");
        }

        // Check for conflicts in the extension window only (day after current end to new end)
        if (directBookingRepository.hasOverlappingBookingsExcluding(
                booking.getInventoryItemId(),
                booking.getEndDate().plusDays(1),
                newEndDate,
                bookingId)) {
            throw new IllegalArgumentException("The selected extension dates conflict with another booking");
        }

        LocalDate oldEndDate = booking.getEndDate();
        booking.setEndDate(newEndDate);
        booking.setTotalDays((int) ChronoUnit.DAYS.between(booking.getStartDate(), newEndDate) + 1);

        DirectBooking updated = directBookingRepository.save(booking);
        log.info("Lease {} extended from {} to {}", bookingId, oldEndDate, newEndDate);

        return mapToResponse(updated);
    }

    @Override
    public List<Map<String, String>> getUnavailableDateRanges(String itemId, String excludeBookingId) {
        List<DirectBooking> active = directBookingRepository.findActiveBookingsForItem(itemId, excludeBookingId);
        List<Map<String, String>> ranges = new ArrayList<>();
        for (DirectBooking b : active) {
            Map<String, String> range = new HashMap<>();
            range.put("startDate", b.getStartDate().toString());
            range.put("endDate", b.getEndDate().toString());
            ranges.add(range);
        }
        return ranges;
    }

    @Override
    @Transactional
    public void activateDueLeases() {
        List<DirectBooking> due = directBookingRepository.findApprovedBookingsToActivate(LocalDate.now());
        for (DirectBooking booking : due) {
            booking.setBookingStatus("Active Lease");
            directBookingRepository.save(booking);
            log.info("Auto-activated lease for booking {} (item: {})", booking.getId(), booking.getItemName());
        }
        if (!due.isEmpty()) {
            log.info("Auto-activated {} lease(s)", due.size());
        }
    }

    @Override
    public void resendDirectBookingConfirmationEmail(String bookingId) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        emailService.sendDirectBookingConfirmation(
                booking.getCustomerEmail(), booking.getCustomerName(),
                booking.getId(), booking.getItemName(),
                booking.getStartDate().toString(), booking.getEndDate().toString(),
                booking.getTotalDays(), booking.getFinalPrice());
    }

    private DirectBookingResponse mapToResponse(DirectBooking booking) {
        DirectBookingResponse response = new DirectBookingResponse();
        response.setId(booking.getId());
        response.setUserId(booking.getUserId());
        response.setInventoryItemId(booking.getInventoryItemId());
        response.setItemName(booking.getItemName());
        response.setBookingType(booking.getBookingType());
        response.setStartDate(booking.getStartDate());
        response.setEndDate(booking.getEndDate());
        response.setTotalDays(booking.getTotalDays());
        response.setBasePrice(booking.getBasePrice());
        response.setDiscountAmount(booking.getDiscountAmount());
        response.setFinalPrice(booking.getFinalPrice());
        response.setBookingStatus(booking.getBookingStatus());
        response.setNotes(booking.getNotes());
        response.setCreatedAt(booking.getCreatedAt());
        response.setUpdatedAt(booking.getUpdatedAt());
        response.setCustomerName(booking.getCustomerName());
        response.setCustomerEmail(booking.getCustomerEmail());
        response.setCustomerPhone(booking.getCustomerPhone());
        response.setPreferredSize(booking.getPreferredSize());
        return response;
    }
}
