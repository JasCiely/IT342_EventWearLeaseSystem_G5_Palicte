package com.backend.observer;

import com.backend.entity.Booking;
import com.backend.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class EmailNotificationObserver implements BookingObserver {

    private final EmailService emailService;

    @Override
    public void onBookingCreated(Booking booking) {
        try {
            emailService.sendFittingConfirmation(
                    booking.getCustomerEmail(),
                    booking.getCustomerName(),
                    booking.getBookingId(),
                    booking.getItemName(),
                    booking.getFittingDate(),
                    booking.getFittingTime());
            log.info("Email sent to {}", booking.getCustomerEmail());
        } catch (Exception e) {
            log.error("Failed to send email: {}", e.getMessage());
        }
    }

    @Override
    public void onBookingCancelled(Booking booking) {
        try {
            // Optional: Add cancellation email method to EmailService
            log.info("Cancellation notification for booking: {}", booking.getBookingId());
        } catch (Exception e) {
            log.error("Failed to send cancellation email: {}", e.getMessage());
        }
    }
}