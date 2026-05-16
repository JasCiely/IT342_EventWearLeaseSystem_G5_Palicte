package com.backend.features.booking.dto.request;

import lombok.Data;

@Data
public class AdminFittingBookingRequest {
    private String customerEmail;
    private String customerName;
    private String customerPhone;
    private String itemId;
    private String itemName;
    private String fittingDate;
    private String fittingTime;
    private String preferredSize;
    private String notes;
}
