package com.backend.dto.response;

import lombok.Data;

@Data
public class FittingBookingResponse {
    private String bookingId;
    private String status;
    private String message;
}