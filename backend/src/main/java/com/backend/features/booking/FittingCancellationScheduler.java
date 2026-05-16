package com.backend.features.booking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class FittingCancellationScheduler {

    private final BookingService bookingService;

    // Runs every minute — auto-cancels CONFIRMED fittings whose duty window has ended.
    // A fitting duty window = [fittingTime, fittingTime + fittingDurationMinutes).
    // If the admin does not click Done within this window, the booking is cancelled.
    @Scheduled(fixedRate = 60000)
    public void autoCancelPastFittings() {
        log.debug("Fitting auto-cancellation check started");
        bookingService.autoCancelPastFittings();
    }
}
