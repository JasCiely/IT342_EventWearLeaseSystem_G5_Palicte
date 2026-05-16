package com.backend.features.booking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class LeaseActivationScheduler {

    private final DirectBookingService directBookingService;

    // Runs every minute — auto-cancels Approved bookings whose pickup deadline has passed.
    // Pickup deadline = working-hours close time on the booking's startDate.
    // If time restrictions are disabled, expires at midnight of the day after startDate.
    @Scheduled(fixedRate = 60000)
    public void autoExpireApprovedBookings() {
        log.debug("Direct booking pickup-expiry check started");
        directBookingService.autoExpireApprovedBookings();
    }
}
