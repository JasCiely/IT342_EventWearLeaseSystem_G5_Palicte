package com.backend.features.inventory.dto.response;

import lombok.Data;

@Data
public class InventorySettingsResponse {
    private Long id;
    private Integer minLeaseDays;
    private Integer weeklyDiscount;
    private Integer monthlyDiscountCap;
}