package com.backend.features.booking.dto.response;

import lombok.Data;

@Data
public class FittingToLeaseResponse {
    private String directBookingId;
    private String status;
    private String message;
    private Double finalPrice;
}