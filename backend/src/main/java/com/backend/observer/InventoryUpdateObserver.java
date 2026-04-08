package com.backend.observer;

import com.backend.entity.Booking;
import com.backend.entity.Item;
import com.backend.repository.ItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class InventoryUpdateObserver implements BookingObserver {

    private final ItemRepository itemRepository;

    @Override
    public void onBookingCreated(Booking booking) {
        itemRepository.findById(booking.getItemId()).ifPresent(item -> {
            if ("Available".equals(item.getStatus())) {
                item.setStatus("RESERVED");
                itemRepository.save(item);
                log.info("Item {} status updated to RESERVED", item.getId());
            }
        });
    }

    @Override
    public void onBookingCancelled(Booking booking) {
        itemRepository.findById(booking.getItemId()).ifPresent(item -> {
            if ("RESERVED".equals(item.getStatus())) {
                item.setStatus("Available");
                itemRepository.save(item);
                log.info("Item {} status updated to Available", item.getId());
            }
        });
    }
}