package com.backend.features.inventory;

import com.backend.features.inventory.dto.request.InventorySettingsRequest;
import com.backend.features.inventory.dto.response.InventorySettingsResponse;
import com.backend.shared.entity.InventorySettings;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventorySettingsServiceImpl implements InventorySettingsService {

    private final InventorySettingsRepository settingsRepository;

    private static final Long SETTINGS_ID = 1L;

    @PostConstruct
    public void initDefaultSettings() {
        // Atomic insert – does nothing if row already exists
        settingsRepository.createIfNotExists(2, 100, 300);
        log.info("Ensured inventory settings row exists (id={})", SETTINGS_ID);
    }

    @Override
    @Transactional(readOnly = true)
    public InventorySettingsResponse getSettings() {
        InventorySettings settings = settingsRepository.findById(SETTINGS_ID)
                .orElseThrow(() -> new RuntimeException("Inventory settings not found"));
        return toResponse(settings);
    }

    @Override
    @Transactional
    public InventorySettingsResponse updateSettings(InventorySettingsRequest request) {
        int maxRetries = 3;
        for (int attempt = 0; attempt < maxRetries; attempt++) {
            try {
                InventorySettings settings = settingsRepository.findById(SETTINGS_ID)
                        .orElseThrow(() -> new RuntimeException("Inventory settings not found"));
                settings.setMinLeaseDays(request.getMinLeaseDays());
                settings.setWeeklyDiscount(request.getWeeklyDiscount());
                settings.setMonthlyDiscountCap(request.getMonthlyDiscountCap());
                // version auto-incremented by JPA
                InventorySettings saved = settingsRepository.save(settings);
                return toResponse(saved);
            } catch (OptimisticLockingFailureException e) {
                log.warn("Optimistic lock conflict on attempt {} for settings id {}, retrying...",
                        attempt + 1, SETTINGS_ID);
                if (attempt == maxRetries - 1) {
                    log.error("Failed to update settings after {} attempts", maxRetries, e);
                    throw new RuntimeException(
                            "Unable to update settings due to concurrent modification. Please try again.", e);
                }
                try {
                    Thread.sleep(50);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted while retrying update", ie);
                }
            }
        }
        throw new RuntimeException("Unexpected error updating settings");
    }

    private InventorySettingsResponse toResponse(InventorySettings settings) {
        InventorySettingsResponse response = new InventorySettingsResponse();
        response.setId(settings.getId());
        response.setMinLeaseDays(settings.getMinLeaseDays());
        response.setWeeklyDiscount(settings.getWeeklyDiscount());
        response.setMonthlyDiscountCap(settings.getMonthlyDiscountCap());
        return response;
    }
}