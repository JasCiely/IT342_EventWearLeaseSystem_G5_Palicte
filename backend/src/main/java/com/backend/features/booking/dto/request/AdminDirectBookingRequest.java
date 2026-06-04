package com.backend.features.booking.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class AdminDirectBookingRequest {
    private String customerEmail;
    private String customerName;
    private String customerPhone;
    @JsonAlias("inventoryItemId")
    private String itemId;
    private String itemName;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal basePrice;
    private BigDecimal discountAmount;
    private BigDecimal finalPrice;
    private String notes;
    private String preferredSize;
}
