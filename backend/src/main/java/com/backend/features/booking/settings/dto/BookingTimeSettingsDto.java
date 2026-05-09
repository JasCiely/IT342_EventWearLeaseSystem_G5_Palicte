package com.backend.features.booking.settings.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Used for both GET response and PUT request body.
 * Working days are serialized as a List<Integer> for easy JS consumption.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookingTimeSettingsDto {

    private boolean enableTimeRestrictions;
    private String shopOpenTime;
    private String shopCloseTime;
    private List<Integer> workingDays;
    private String timezone;
    private BigDecimal autoApproveThreshold;
    private int fittingDurationMinutes;
}