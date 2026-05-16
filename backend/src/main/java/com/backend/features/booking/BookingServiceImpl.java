package com.backend.features.booking;

import com.backend.features.booking.dto.request.AdminFittingBookingRequest;
import com.backend.features.booking.dto.request.FittingBookingRequest;
import com.backend.features.booking.dto.response.FittingBookingResponse;
import com.backend.features.booking.settings.BookingTimeSettingsService;
import com.backend.features.booking.settings.dto.BookingTimeSettingsDto;
import com.backend.shared.entity.Booking;
import com.backend.shared.email.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final EmailService emailService;
    private final BookingTimeSettingsService settingsService;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final int MAX_SLOTS_PER_TIME = 5;

    // ── Create Fitting Booking ────────────────────────────────────────────────

    @Transactional
    public FittingBookingResponse createBooking(FittingBookingRequest request) {
        BookingTimeSettingsDto settings = settingsService.getSettings();
        String bookingId = "FT" + System.currentTimeMillis();
        String today = LocalDate.now().format(DATE_FORMATTER);

        // Validate working day
        if (settings.isEnableTimeRestrictions()) {
            LocalDate date = LocalDate.parse(request.getFittingDate(), DATE_FORMATTER);
            int dayOfWeek = date.getDayOfWeek().getValue() % 7; // Convert to 0=Sun..6=Sat
            if (!settings.getWorkingDays().contains(dayOfWeek)) {
                FittingBookingResponse response = new FittingBookingResponse();
                response.setBookingId(null);
                response.setStatus("FAILED");
                response.setMessage("Fittings are not available on this day.");
                return response;
            }

            // Validate working hours
            LocalTime slotTime = LocalTime.parse(request.getFittingTime());
            LocalTime openTime = LocalTime.parse(settings.getShopOpenTime());
            LocalTime closeTime = LocalTime.parse(settings.getShopCloseTime());
            if (slotTime.isBefore(openTime) || slotTime.isAfter(closeTime.minusMinutes(1))) {
                FittingBookingResponse response = new FittingBookingResponse();
                response.setBookingId(null);
                response.setStatus("FAILED");
                response.setMessage("Selected time is outside working hours (" +
                        settings.getShopOpenTime() + " – " + settings.getShopCloseTime() + ").");
                return response;
            }
        }

        // Duplicate check
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

        // Slot capacity check
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

        // Per-item uniqueness check: same item cannot be booked at the same date+time
        // twice
        boolean itemSlotTaken = bookingRepository.existsByItemIdAndFittingDateAndFittingTimeAndStatus(
                request.getItemId(), request.getFittingDate(), request.getFittingTime(), "CONFIRMED");
        if (itemSlotTaken) {
            log.warn("Item {} is already booked at {} {}", request.getItemId(), request.getFittingDate(),
                    request.getFittingTime());
            FittingBookingResponse response = new FittingBookingResponse();
            response.setBookingId(null);
            response.setStatus("FAILED");
            response.setMessage("This time slot is already booked for this item.");
            return response;
        }

        // Validate time slot boundary (must align with fitting duration)
        if (!isValidTimeSlot(request.getFittingTime(), settings.getFittingDurationMinutes())) {
            log.warn("Invalid time slot: {}", request.getFittingTime());
            FittingBookingResponse response = new FittingBookingResponse();
            response.setBookingId(null);
            response.setStatus("FAILED");
            response.setMessage("Fitting slots are available every " +
                    settings.getFittingDurationMinutes() + " minutes.");
            return response;
        }

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
        log.info("Booking saved: {} for customer: {}", bookingId, request.getCustomerEmail());

        try {
            emailService.sendFittingConfirmation(
                    request.getCustomerEmail(), request.getCustomerName(),
                    bookingId, request.getItemName(),
                    request.getFittingDate(), request.getFittingTime());
        } catch (Exception e) {
            log.error("Failed to send email: {}", e.getMessage());
        }

        FittingBookingResponse response = new FittingBookingResponse();
        response.setBookingId(bookingId);
        response.setStatus("CONFIRMED");
        response.setMessage("Fitting booked successfully");
        return response;
    }

    // ── Complete without lease ────────────────────────────────────────────────

    @Transactional
    public Booking completeFittingWithoutLease(String bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        if (!"CONFIRMED".equals(booking.getStatus())) {
            throw new IllegalStateException("Only confirmed bookings can be completed");
        }

        // Backend enforcement: Done is valid from fitting start until working-hours end time
        BookingTimeSettingsDto settings = settingsService.getSettings();
        try {
            LocalDate fDate = LocalDate.parse(booking.getFittingDate(), DATE_FORMATTER);
            LocalTime fTime = LocalTime.parse(booking.getFittingTime());
            LocalDateTime fittingStart = LocalDateTime.of(fDate, fTime);
            LocalDateTime now = LocalDateTime.now();
            if (now.isBefore(fittingStart)) {
                throw new IllegalStateException(
                        "Fitting session has not started yet. Please wait until " + booking.getFittingTime());
            }
            if (settings.isEnableTimeRestrictions()) {
                LocalTime closeTime = LocalTime.parse(settings.getShopCloseTime());
                LocalDateTime workingEnd = LocalDateTime.of(fDate, closeTime);
                if (!now.isBefore(workingEnd)) {
                    throw new IllegalStateException(
                            "Working hours have ended. The booking will be automatically cancelled.");
                }
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Could not validate fitting time window for {}: {}", bookingId, e.getMessage());
        }

        booking.setStatus("COMPLETED");
        Booking saved = bookingRepository.save(booking);
        try {
            emailService.sendFittingCompletedNoLease(
                    booking.getCustomerEmail(), booking.getCustomerName(), booking.getItemName());
        } catch (Exception e) {
            log.error("Failed to send fitting completed email: {}", e.getMessage());
        }
        return saved;
    }

    // ── Lease conversion ──────────────────────────────────────────────────────

    @Transactional
    public Booking markLeaseStartedFromFitting(String bookingId, String directBookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        String status = booking.getStatus();
        if (!"CONFIRMED".equals(status) && !"COMPLETED".equals(status)) {
            throw new IllegalStateException("Only confirmed or completed fittings can be converted to a lease");
        }
        booking.setLeaseStarted(true);
        booking.setLeaseBookingId(directBookingId);
        booking.setStatus("LEASE_CONVERTED");
        return bookingRepository.save(booking);
    }

    // ── Availability ──────────────────────────────────────────────────────────

    public long countBookingsForSlot(String fittingDate, String fittingTime) {
        return bookingRepository.countConfirmedByFittingDateAndTime(fittingDate, fittingTime);
    }

    public boolean checkAvailability(String fittingDate, String fittingTime, String excludeId) {
        long slotCount;
        if (excludeId != null && !excludeId.isEmpty()) {
            slotCount = bookingRepository.countConfirmedByFittingDateAndTimeExcludingId(
                    fittingDate, fittingTime, excludeId);
        } else {
            slotCount = bookingRepository.countConfirmedByFittingDateAndTime(fittingDate, fittingTime);
        }
        return slotCount < MAX_SLOTS_PER_TIME;
    }

    /**
     * Returns available time slots for a given date using the DB settings:
     * - only working days
     * - only within shop open/close hours
     * - slots spaced by fittingDurationMinutes
     * - excludes slots that are fully booked
     */
    public List<String> getAvailableTimeSlots(String fittingDate) {
        BookingTimeSettingsDto settings = settingsService.getSettings();
        List<String> slots = new ArrayList<>();

        // If time restrictions enabled, validate working day
        if (settings.isEnableTimeRestrictions()) {
            try {
                LocalDate date = LocalDate.parse(fittingDate, DATE_FORMATTER);
                int dayOfWeek = date.getDayOfWeek().getValue() % 7;
                if (!settings.getWorkingDays().contains(dayOfWeek)) {
                    return slots; // No slots on non-working days
                }
            } catch (Exception e) {
                log.warn("Invalid fittingDate: {}", fittingDate);
                return slots;
            }
        }

        // Generate time slots from open to close
        LocalTime current = LocalTime.parse(settings.getShopOpenTime());
        LocalTime closeTime = LocalTime.parse(settings.getShopCloseTime());
        int duration = settings.getFittingDurationMinutes() > 0 ? settings.getFittingDurationMinutes() : 30;

        while (!current.isAfter(closeTime.minusMinutes(duration))) {
            String slot = current.format(DateTimeFormatter.ofPattern("HH:mm"));
            long count = bookingRepository.countConfirmedByFittingDateAndTime(fittingDate, slot);
            if (count < MAX_SLOTS_PER_TIME) {
                slots.add(slot);
            }
            current = current.plusMinutes(duration);
        }

        return slots;
    }

    @Override
    public List<String> getBookedFittingSlots(String itemId, String date) {
        return bookingRepository.findBookedTimesByItemAndDate(itemId, date);
    }

    // ── Query helpers ─────────────────────────────────────────────────────────

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

    @Transactional
    public Booking rescheduleFitting(String bookingId, String fittingDate, String fittingTime) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        BookingTimeSettingsDto settings = settingsService.getSettings();

        // Validate working day (same logic as createBooking)
        if (settings.isEnableTimeRestrictions()) {
            LocalDate date = LocalDate.parse(fittingDate, DATE_FORMATTER);
            int dayOfWeek = date.getDayOfWeek().getValue() % 7;
            if (!settings.getWorkingDays().contains(dayOfWeek)) {
                throw new IllegalArgumentException("Fittings are not available on this day.");
            }
            LocalTime slotTime = LocalTime.parse(fittingTime);
            LocalTime openTime = LocalTime.parse(settings.getShopOpenTime());
            LocalTime closeTime = LocalTime.parse(settings.getShopCloseTime());
            if (slotTime.isBefore(openTime) || slotTime.isAfter(closeTime.minusMinutes(1))) {
                throw new IllegalArgumentException("Selected time is outside working hours (" +
                        settings.getShopOpenTime() + " – " + settings.getShopCloseTime() + ").");
            }
        }

        // Time slot alignment (same as createBooking)
        if (!isValidTimeSlot(fittingTime, settings.getFittingDurationMinutes())) {
            throw new IllegalArgumentException("Fitting slots are available every " +
                    settings.getFittingDurationMinutes() + " minutes.");
        }

        // Per-item uniqueness: same item cannot have two CONFIRMED bookings at the same date+time
        boolean itemSlotTaken = bookingRepository.existsByItemIdAndFittingDateAndFittingTimeAndStatusExcludingId(
                booking.getItemId(), fittingDate, fittingTime, bookingId);
        if (itemSlotTaken) {
            throw new IllegalArgumentException("This item is already booked at the selected date and time.");
        }

        booking.setStatus("CONFIRMED");
        booking.setFittingDate(fittingDate);
        booking.setFittingTime(fittingTime);
        return bookingRepository.save(booking);
    }

    // ── Resend email ──────────────────────────────────────────────────────────

    @Override
    public void resendFittingConfirmationEmail(String bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        emailService.sendFittingConfirmation(
                booking.getCustomerEmail(), booking.getCustomerName(),
                booking.getBookingId(), booking.getItemName(),
                booking.getFittingDate(), booking.getFittingTime());
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    @Override
    @Transactional
    public FittingBookingResponse createFittingBookingForCustomer(AdminFittingBookingRequest req) {
        FittingBookingRequest request = new FittingBookingRequest();
        request.setItemId(req.getItemId());
        request.setItemName(req.getItemName());
        request.setFittingDate(req.getFittingDate());
        request.setFittingTime(req.getFittingTime());
        request.setCustomerName(req.getCustomerName());
        request.setCustomerEmail(req.getCustomerEmail());
        request.setCustomerPhone(req.getCustomerPhone());
        request.setPreferredSize(req.getPreferredSize());
        request.setNotes(req.getNotes());
        request.setUserId(null);
        return createBooking(request);
    }

    // ── Auto-cancel past fittings (called by scheduler) ──────────────────────

    @Override
    @Transactional
    public void autoCancelPastFittings() {
        BookingTimeSettingsDto settings = settingsService.getSettings();
        int durationMinutes = settings.getFittingDurationMinutes() > 0 ? settings.getFittingDurationMinutes() : 30;

        String today = LocalDate.now().format(DATE_FORMATTER);
        LocalDateTime now = LocalDateTime.now();

        List<Booking> candidates = bookingRepository.findConfirmedOnOrBeforeDate(today);

        for (Booking booking : candidates) {
            try {
                LocalDate fDate = LocalDate.parse(booking.getFittingDate(), DATE_FORMATTER);
                LocalTime fTime = LocalTime.parse(booking.getFittingTime());
                LocalDateTime fittingEnd = LocalDateTime.of(fDate, fTime).plusMinutes(durationMinutes);

                if (!now.isBefore(fittingEnd)) {
                    booking.setStatus("CANCELLED");
                    bookingRepository.save(booking);
                    log.info("Auto-cancelled past fitting {} scheduled for {} {}",
                            booking.getBookingId(), booking.getFittingDate(), booking.getFittingTime());
                    try {
                        emailService.sendFittingCancellation(
                                booking.getCustomerEmail(), booking.getCustomerName(),
                                booking.getBookingId(), booking.getItemName(),
                                booking.getFittingDate(), booking.getFittingTime());
                    } catch (Exception e) {
                        log.error("Failed to send auto-cancel email for {}: {}", booking.getBookingId(), e.getMessage());
                    }
                }
            } catch (Exception e) {
                log.error("Error processing auto-cancel for booking {}: {}", booking.getId(), e.getMessage());
            }
        }
    }

    private boolean isValidTimeSlot(String time, int durationMinutes) {
        if (time == null)
            return false;
        String[] parts = time.split(":");
        if (parts.length < 2)
            return false;
        try {
            int minute = Integer.parseInt(parts[1]);
            return minute % durationMinutes == 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    @Override
    @Transactional
    public void cancelFittingBooking(String bookingId, String customerEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!booking.getCustomerEmail().equals(customerEmail)) {
            throw new SecurityException("You are not allowed to cancel this booking");
        }

        if (!"CONFIRMED".equals(booking.getStatus())) {
            throw new IllegalStateException("Only confirmed bookings can be cancelled");
        }

        booking.setStatus("CANCELLED");
        bookingRepository.save(booking);
        log.info("Fitting booking {} cancelled by customer {}", bookingId, customerEmail);

        try {
            emailService.sendFittingCancellation(
                    booking.getCustomerEmail(),
                    booking.getCustomerName(),
                    booking.getBookingId(),
                    booking.getItemName(),
                    booking.getFittingDate(),
                    booking.getFittingTime());
        } catch (Exception e) {
            log.error("Failed to send cancellation email for booking {}: {}", bookingId, e.getMessage());
        }
    }

    @Override
    @Transactional
    public Booking rescheduleFittingByCustomer(String bookingId, String customerEmail, String fittingDate, String fittingTime) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!booking.getCustomerEmail().equals(customerEmail)) {
            throw new SecurityException("You are not allowed to reschedule this booking");
        }

        if (!"CONFIRMED".equals(booking.getStatus())) {
            throw new IllegalStateException("Only confirmed bookings can be rescheduled");
        }

        return rescheduleFitting(bookingId, fittingDate, fittingTime);
    }
}