package com.backend.features.booking;

import com.backend.features.booking.dto.request.FittingBookingRequest;
import com.backend.features.booking.dto.response.FittingBookingResponse;
import com.backend.shared.entity.Booking;
import com.backend.shared.email.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final EmailService emailService;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Transactional
    public FittingBookingResponse createBooking(FittingBookingRequest request) {
        // Generate unique booking ID
        String bookingId = "FT" + System.currentTimeMillis();
        String today = LocalDate.now().format(DATE_FORMATTER);

        // Check if user already has a booking for this item (future date)
        boolean hasExisting = bookingRepository.existsActiveBookingByItemAndCustomer(
                request.getItemId(), request.getCustomerEmail(), today);

        if (hasExisting) {
            log.warn("User {} already has active booking for item {}", request.getCustomerEmail(), request.getItemId());
            FittingBookingResponse response = new FittingBookingResponse();
            response.setBookingId(null);
            response.setStatus("FAILED");
            response.setMessage("You already have an active booking for this item");
            return response;
        }

        // Check time slot availability (max 5 per time slot)
        long slotCount = bookingRepository.countByFittingDateAndFittingTimeAndStatus(
                request.getFittingDate(), request.getFittingTime(), "CONFIRMED");
        if (slotCount >= 5) {
            log.warn("Time slot {} at {} is fully booked", request.getFittingDate(), request.getFittingTime());
            FittingBookingResponse response = new FittingBookingResponse();
            response.setBookingId(null);
            response.setStatus("FAILED");
            response.setMessage("This time slot is fully booked. Please choose another time.");
            return response;
        }

        // Create and save booking
        Booking booking = new Booking();
        booking.setBookingId(bookingId);
        booking.setItemId(request.getItemId());
        booking.setItemName(request.getItemName());
        booking.setFittingDate(request.getFittingDate());
        booking.setFittingTime(request.getFittingTime());
        booking.setCustomerName(request.getCustomerName());
        booking.setCustomerEmail(request.getCustomerEmail());
        booking.setCustomerPhone(request.getCustomerPhone());
        booking.setPreferredSize(request.getPreferredSize());
        booking.setNotes(request.getNotes());
        booking.setUserId(request.getUserId());
        booking.setStatus("CONFIRMED");

        Booking savedBooking = bookingRepository.save(booking);
        log.info("Booking saved to database: {} for customer: {}", bookingId, request.getCustomerEmail());

        // Send confirmation email
        try {
            emailService.sendFittingConfirmation(
                    request.getCustomerEmail(),
                    request.getCustomerName(),
                    bookingId,
                    request.getItemName(),
                    request.getFittingDate(),
                    request.getFittingTime());
            log.info("Confirmation email sent to {}", request.getCustomerEmail());
        } catch (Exception e) {
            log.error("Failed to send email: {}", e.getMessage());
        }

        FittingBookingResponse response = new FittingBookingResponse();
        response.setBookingId(bookingId);
        response.setStatus("CONFIRMED");
        response.setMessage("Fitting booked successfully");

        return response;
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

    public Page<Booking> getAllFittingBookings(Pageable pageable) {
        return bookingRepository.findAll(pageable);
    }

    public Booking updateFittingBookingStatus(String bookingId, String status) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        booking.setStatus(status);
        return bookingRepository.save(booking);
    }
}