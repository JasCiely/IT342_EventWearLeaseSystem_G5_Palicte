package com.backend.service;

import com.backend.dto.request.FittingBookingRequest;
import com.backend.dto.response.FittingBookingResponse;
import com.backend.entity.Booking;
import com.backend.observer.BookingSubject;
import com.backend.observer.EmailNotificationObserver;
import com.backend.observer.InventoryUpdateObserver;
import com.backend.observer.LoggingObserver;
import com.backend.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final BookingSubject bookingSubject;
    private final EmailNotificationObserver emailObserver;
    private final InventoryUpdateObserver inventoryObserver;
    private final LoggingObserver loggingObserver;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @jakarta.annotation.PostConstruct
    public void init() {
        bookingSubject.attach(emailObserver);
        bookingSubject.attach(inventoryObserver);
        bookingSubject.attach(loggingObserver);
        log.info("Booking observers initialized");
    }

    @Transactional
    public FittingBookingResponse createBooking(FittingBookingRequest request) {
        String bookingId = "FT" + System.currentTimeMillis();
        String today = LocalDate.now().format(DATE_FORMATTER);

        boolean hasExisting = bookingRepository.existsActiveBookingByItemAndCustomer(
                request.getItemId(), request.getCustomerEmail(), today);

        if (hasExisting) {
            log.warn("User {} already has active booking for item {}", request.getCustomerEmail(), request.getItemId());
            return FittingBookingResponse.failed("You already have an active booking for this item");
        }

        long slotCount = bookingRepository.countByFittingDateAndFittingTimeAndStatus(
                request.getFittingDate(), request.getFittingTime(), "CONFIRMED");
        if (slotCount >= 5) {
            log.warn("Time slot {} at {} is fully booked", request.getFittingDate(), request.getFittingTime());
            return FittingBookingResponse.failed("This time slot is fully booked. Please choose another time.");
        }

        Booking booking = Booking.builder()
                .bookingId(bookingId)
                .itemId(request.getItemId())
                .itemName(request.getItemName())
                .fittingDate(request.getFittingDate())
                .fittingTime(request.getFittingTime())
                .customerName(request.getCustomerName())
                .customerEmail(request.getCustomerEmail())
                .customerPhone(request.getCustomerPhone())
                .preferredSize(request.getPreferredSize())
                .notes(request.getNotes())
                .userId(request.getUserId())
                .status("CONFIRMED")
                .build();

        Booking savedBooking = bookingRepository.save(booking);
        log.info("Booking saved to database: {} for customer: {}", bookingId, request.getCustomerEmail());

        // Notify all observers (Email, Inventory, Logging)
        bookingSubject.notifyBookingCreated(savedBooking);

        return FittingBookingResponse.success(bookingId);
    }

    @Transactional
    public FittingBookingResponse cancelBooking(String bookingId) {
        Booking booking = bookingRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found: " + bookingId));

        booking.setStatus("CANCELLED");
        Booking cancelledBooking = bookingRepository.save(booking);

        bookingSubject.notifyBookingCancelled(cancelledBooking);

        return FittingBookingResponse.success(bookingId);
    }

    public List<Booking> getBookingsByEmail(String email) {
        return bookingRepository.findByCustomerEmailOrderByCreatedAtDesc(email);
    }

    public List<Booking> getBookingsByUserId(Long userId) {
        return bookingRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<Booking> getUpcomingBookingsByEmail(String email) {
        String today = LocalDate.now().format(DATE_FORMATTER);
        return bookingRepository.findUpcomingBookingsByEmail(email, today);
    }
}