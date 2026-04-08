package com.backend.observer;

import com.backend.entity.Booking;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;

@Component
public class BookingSubject {

    private final List<BookingObserver> observers = new ArrayList<>();

    public void attach(BookingObserver observer) {
        observers.add(observer);
    }

    public void detach(BookingObserver observer) {
        observers.remove(observer);
    }

    public void notifyBookingCreated(Booking booking) {
        for (BookingObserver observer : observers) {
            observer.onBookingCreated(booking);
        }
    }

    public void notifyBookingCancelled(Booking booking) {
        for (BookingObserver observer : observers) {
            observer.onBookingCancelled(booking);
        }
    }
}