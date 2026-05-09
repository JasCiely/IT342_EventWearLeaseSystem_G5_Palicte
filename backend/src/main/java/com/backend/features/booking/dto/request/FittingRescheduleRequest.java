package com.backend.features.booking.dto.request;

import lombok.Data;

@Data
public class FittingRescheduleRequest {
    private String fittingDate;
    private String fittingTime;
}