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
    private static final int MAX_SLOTS_PER_TIME = 5; // Max 5 fittings per 30-minute slot
    private static final int FITTING_DURATION_MINUTES = 30;

    @Transactional
    public FittingBookingResponse createBooking(FittingBookingRequest request) {
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

        // Check time slot availability (max 5 per 30-min slot)
        long slotCount = bookingRepository.countConfirmedByFittingDateAndTime(
                request.getFittingDate(), request.getFittingTime());
        if (slotCount >= MAX_SLOTS_PER_TIME) {
            log.warn("Time slot {} at {} is fully booked", request.getFittingDate(), request.getFittingTime());
            FittingBookingResponse response = new FittingBookingResponse();
            response.setBookingId(null);
            response.setStatus("FAILED");
            response.setMessage("This time slot is fully booked. Please choose another time.");
            return response;
        }

        // Validate time slot is within working hours (already validated in controller)
        // Validate time slot is on a 30-minute boundary
        if (!isValidTimeSlot(request.getFittingTime())) {
            log.warn("Invalid time slot format: {}", request.getFittingTime());
            FittingBookingResponse response = new FittingBookingResponse();
            response.setBookingId(null);
            response.setStatus("FAILED");
            response.setMessage("Fitting slots are available every 30 minutes (e.g., 09:00, 09:30, 10:00).");
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
        booking.setLeaseStarted(false);

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

    @Transactional
    public Booking completeFittingWithoutLease(String bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!"CONFIRMED".equals(booking.getStatus())) {
            throw new IllegalStateException("Only confirmed bookings can be completed");
        }

        booking.setStatus("COMPLETED");
        Booking saved = bookingRepository.save(booking);

        // Send email notification
        try {
            emailService.sendFittingCompletedNoLease(
                    booking.getCustomerEmail(),
                    booking.getCustomerName(),
                    booking.getBookingId(),
                    booking.getItemName());
            log.info("Fitting completed (no lease) email sent to {}", booking.getCustomerEmail());
        } catch (Exception e) {
            log.error("Failed to send fitting completed email: {}", e.getMessage());
        }

        return saved;
    }

    @Transactional
    public Booking markLeaseStartedFromFitting(String bookingId, String directBookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!"CONFIRMED".equals(booking.getStatus())) {
            throw new IllegalStateException("Only confirmed bookings can be converted to lease");
        }

        booking.setLeaseStarted(true);
        booking.setLeaseBookingId(directBookingId);
        booking.setStatus("LEASE_CONVERTED");

        return bookingRepository.save(booking);
    }

    public boolean checkAvailability(String fittingDate, String fittingTime, String excludeId) {
        long slotCount;
        if (excludeId != null && !excludeId.isEmpty()) {
            slotCount = bookingRepository.countConfirmedByFittingDateAndTimeExcludingId(fittingDate, fittingTime,
                    excludeId);
        } else {
            slotCount = bookingRepository.countConfirmedByFittingDateAndTime(fittingDate, fittingTime);
        }
        return slotCount < MAX_SLOTS_PER_TIME;
    }

    public List<String> getAvailableTimeSlots(String fittingDate) {
        return bookingRepository.findAvailableTimeSlots(fittingDate, MAX_SLOTS_PER_TIME);
    }

    private boolean isValidTimeSlot(String time) {
        if (time == null)
            return false;
        String[] parts = time.split(":");
        if (parts.length < 2)
            return false;
        try {
            int hour = Integer.parseInt(parts[0]);
            int minute = Integer.parseInt(parts[1]);
            return minute == 0 || minute == 30;
        } catch (NumberFormatException e) {
            return false;
        }
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

    @Transactional
    public Booking updateFittingBookingStatus(String bookingId, String status) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        booking.setStatus(status);
        return bookingRepository.save(booking);
    }
}