package com.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DirectBookingResponse {
    private String id;
    private String userId;
    private String inventoryItemId;
    private String bookingType;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer totalDays;
    private BigDecimal basePrice;
    private BigDecimal discountAmount;
    private BigDecimal finalPrice;
    private String bookingStatus;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Add these new fields
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private String preferredSize;
}