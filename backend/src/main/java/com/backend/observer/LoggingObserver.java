package com.backend.observer;

import com.backend.entity.Booking;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class LoggingObserver implements BookingObserver {

    @Override
    public void onBookingCreated(Booking booking) {
        log.info("📅 BOOKING CREATED: ID={}, Customer={}, Item={}, Date={}, Time={}",
                booking.getBookingId(),
                booking.getCustomerEmail(),
                booking.getItemName(),
                booking.getFittingDate(),
                booking.getFittingTime());
    }

    @Override
    public void onBookingCancelled(Booking booking) {
        log.info("❌ BOOKING CANCELLED: ID={}, Customer={}, Item={}",
                booking.getBookingId(),
                booking.getCustomerEmail(),
                booking.getItemName());
    }
}