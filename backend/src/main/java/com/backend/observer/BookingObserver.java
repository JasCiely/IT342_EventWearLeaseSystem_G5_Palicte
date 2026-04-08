package com.backend.observer;

import com.backend.entity.Booking;

public interface BookingObserver {
    void onBookingCreated(Booking booking);

    void onBookingCancelled(Booking booking);
}