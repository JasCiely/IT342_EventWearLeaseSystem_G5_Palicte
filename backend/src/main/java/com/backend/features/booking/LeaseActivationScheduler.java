package com.backend.features.booking;

import com.backend.shared.sse.SseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class LeaseActivationScheduler {

    private final DirectBookingService directBookingService;
    private final SseService sseService;

    @Scheduled(fixedRate = 60000)
    public void autoExpireApprovedBookings() {
        log.debug("Direct booking pickup-expiry check started");
        directBookingService.autoExpireApprovedBookings();
        sseService.broadcast("BOOKING_UPDATE");
    }
}
