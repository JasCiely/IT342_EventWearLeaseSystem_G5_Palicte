package com.backend.service.impl;

import com.backend.dto.request.DirectBookingRequest;
import com.backend.dto.response.DirectBookingResponse;
import com.backend.entity.DirectBooking;
import com.backend.repository.DirectBookingRepository;
import com.backend.service.DirectBookingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class DirectBookingServiceImpl implements DirectBookingService {

    private final DirectBookingRepository directBookingRepository;

    @Override
    @Transactional
    public DirectBookingResponse createDirectBooking(String userId, DirectBookingRequest request) {
        log.info("Creating direct booking for user {} and item {}", userId, request.getInventoryItemId());

        // Validate dates
        if (request.getStartDate().isAfter(request.getEndDate())) {
            throw new IllegalArgumentException("Start date cannot be after end date");
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

        DirectBooking savedBooking = directBookingRepository.save(booking);

        log.info("Direct booking created successfully with ID: {}", savedBooking.getId());

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

        booking.setBookingStatus(status);
        DirectBooking updatedBooking = directBookingRepository.save(booking);

        log.info("Updated booking {} status to {}", bookingId, status);

        return mapToResponse(updatedBooking);
    }

    @Override
    public boolean isItemAvailable(String itemId, LocalDate startDate, LocalDate endDate) {
        return !directBookingRepository.hasOverlappingBookings(itemId, startDate, endDate);
    }

    private DirectBookingResponse mapToResponse(DirectBooking booking) {
        return new DirectBookingResponse(
                booking.getId(),
                booking.getUserId(),
                booking.getInventoryItemId(),
                booking.getBookingType(),
                booking.getStartDate(),
                booking.getEndDate(),
                booking.getTotalDays(),
                booking.getBasePrice(),
                booking.getDiscountAmount(),
                booking.getFinalPrice(),
                booking.getBookingStatus(),
                booking.getNotes(),
                booking.getCreatedAt(),
                booking.getUpdatedAt());
    }
}
