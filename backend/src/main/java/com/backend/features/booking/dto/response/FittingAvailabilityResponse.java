package com.backend.features.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class FittingAvailabilityResponse {
    private boolean available;
    private int bookedCount;
    private int maxSlots;
    private String message;
}