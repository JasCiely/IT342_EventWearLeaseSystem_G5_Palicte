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

    // Runs daily at midnight — promotes Approved bookings whose startDate has arrived to Active Lease.
    @Scheduled(cron = "0 0 0 * * *")
    public void activateDueLeases() {
        log.info("Scheduled lease auto-activation started");
        directBookingService.activateDueLeases();
    }
}
