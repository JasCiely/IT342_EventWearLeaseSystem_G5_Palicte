package com.backend.features.inventory;

import com.backend.shared.entity.Item;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class MaintenanceScheduler {

    private final ItemRepository itemRepository;

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void transitionMaintenanceItems() {
        List<Item> due = itemRepository.findMaintenanceItemsDue(LocalDate.now());
        for (Item item : due) {
            item.setStatus("Pending Availability");
            itemRepository.save(item);
            log.info("Item {} maintenance ended — moved to Pending Availability", item.getId());
        }
    }
}
