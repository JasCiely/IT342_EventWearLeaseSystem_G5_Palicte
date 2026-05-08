package com.backend.features.booking.dto.response;

import lombok.Data;

@Data
public class FittingBookingResponse {
    private String bookingId;
    private String status;
    private String message;
}