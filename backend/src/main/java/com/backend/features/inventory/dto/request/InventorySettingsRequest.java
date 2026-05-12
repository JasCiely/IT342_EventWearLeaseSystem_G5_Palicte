package com.backend.features.inventory.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class InventorySettingsRequest {

    @NotNull(message = "minLeaseDays is required")
    @Min(value = 1, message = "minLeaseDays must be at least 1")
    private Integer minLeaseDays;

    @NotNull(message = "weeklyDiscount is required")
    @Min(value = 0, message = "weeklyDiscount cannot be negative")
    private Integer weeklyDiscount;

    @NotNull(message = "monthlyDiscountCap is required")
    @Min(value = 0, message = "monthlyDiscountCap cannot be negative")
    private Integer monthlyDiscountCap;
}