package com.backend.features.booking;

import com.backend.shared.sse.SseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class FittingCancellationScheduler {

    private final BookingService bookingService;
    private final SseService sseService;

    @Scheduled(fixedRate = 60000)
    public void autoCancelPastFittings() {
        log.debug("Fitting auto-cancellation check started");
        bookingService.autoCancelPastFittings();
        sseService.broadcast("BOOKING_UPDATE");
    }
}
