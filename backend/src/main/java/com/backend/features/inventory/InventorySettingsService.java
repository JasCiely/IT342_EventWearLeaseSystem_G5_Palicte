package com.backend.features.inventory;

import com.backend.features.inventory.dto.request.InventorySettingsRequest;
import com.backend.features.inventory.dto.response.InventorySettingsResponse;

public interface InventorySettingsService {
    InventorySettingsResponse getSettings();

    InventorySettingsResponse updateSettings(InventorySettingsRequest request);
}