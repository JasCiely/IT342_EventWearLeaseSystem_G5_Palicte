package com.backend.service.impl;

import com.backend.dto.request.DirectBookingRequest;
import com.backend.dto.response.DirectBookingResponse;
import com.backend.entity.DirectBooking;
import com.backend.entity.Item;
import com.backend.repository.DirectBookingRepository;
import com.backend.repository.ItemRepository;
import com.backend.service.DirectBookingService;
import com.backend.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DirectBookingServiceImpl implements DirectBookingService {

    private final DirectBookingRepository directBookingRepository;
    private final EmailService emailService;
    private final ItemRepository itemRepository;

    @Override
    @Transactional
    public DirectBookingResponse createDirectBooking(String userId, DirectBookingRequest request) {
        log.info("Creating direct booking for user {} and item {}", userId, request.getInventoryItemId());

        // Validate dates
        if (request.getStartDate().isAfter(request.getEndDate())) {
            throw new IllegalArgumentException("Start date cannot be after end date");
        }

        // Validate customer information
        if (request.getCustomerName() == null || request.getCustomerName().trim().isEmpty()) {
            throw new IllegalArgumentException("Customer name is required");
        }
        if (request.getCustomerEmail() == null || request.getCustomerEmail().trim().isEmpty()) {
            throw new IllegalArgumentException("Customer email is required");
        }
        if (request.getCustomerPhone() == null || request.getCustomerPhone().trim().isEmpty()) {
            throw new IllegalArgumentException("Customer phone is required");
        }

        // Check availability
        if (!isItemAvailable(request.getInventoryItemId(), request.getStartDate(), request.getEndDate())) {
            throw new IllegalArgumentException("Item is not available for the selected dates");
        }

        // Calculate total days
        int totalDays = (int) ChronoUnit.DAYS.between(request.getStartDate(), request.getEndDate()) + 1;

        // Validate pricing
        if (request.getBasePrice() == null || request.getBasePrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Base price must be greater than zero");
        }

        if (request.getDiscountAmount() == null) {
            request.setDiscountAmount(BigDecimal.ZERO);
        }

        if (request.getFinalPrice() == null) {
            request.setFinalPrice(request.getBasePrice().subtract(request.getDiscountAmount()));
        }

        // Create booking entity
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

        // Set customer information
        booking.setCustomerName(request.getCustomerName());
        booking.setCustomerEmail(request.getCustomerEmail());
        booking.setCustomerPhone(request.getCustomerPhone());
        booking.setPreferredSize(request.getPreferredSize());

        // Fetch and set item name
        Optional<Item> item = itemRepository.findById(request.getInventoryItemId());
        if (item.isPresent()) {
            booking.setItemName(item.get().getName());
        } else {
            booking.setItemName("Item");
        }

        DirectBooking savedBooking = directBookingRepository.save(booking);

        log.info("Direct booking created successfully with ID: {}", savedBooking.getId());

        // Send confirmation email
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
            log.info("Confirmation email sent for booking: {}", savedBooking.getId());
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

        // Send status update email only if status changed to Approved or Rejected
        try {
            if ("Approved".equals(status) || "Rejected".equals(status)) {
                emailService.sendDirectBookingStatusUpdate(
                        updatedBooking.getCustomerEmail(),
                        updatedBooking.getCustomerName(),
                        updatedBooking.getItemName(),
                        status,
                        updatedBooking.getId());
                log.info("Status update email sent for booking: {}", bookingId);
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