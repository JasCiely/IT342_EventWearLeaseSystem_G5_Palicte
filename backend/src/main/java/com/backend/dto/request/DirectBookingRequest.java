package com.backend.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DirectBookingRequest {
    private String inventoryItemId;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer totalDays;
    private BigDecimal basePrice;
    private BigDecimal discountAmount;
    private BigDecimal finalPrice;
    private String notes;
}
