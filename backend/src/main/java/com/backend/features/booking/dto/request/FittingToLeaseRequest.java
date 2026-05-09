package com.backend.features.booking.dto.request;

import lombok.Data;

@Data
public class FittingToLeaseRequest {
    private String fittingBookingId;
    private String startDate;
    private String endDate;
    private int totalDays;
    private String notes;
}