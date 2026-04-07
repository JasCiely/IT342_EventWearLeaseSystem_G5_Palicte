package com.backend.dto.request;

import lombok.Data;

@Data
public class FittingBookingRequest {
    private String itemId;
    private String itemName;
    private String fittingDate;
    private String fittingTime;
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private String preferredSize;
    private String notes;
    private Long userId;
}