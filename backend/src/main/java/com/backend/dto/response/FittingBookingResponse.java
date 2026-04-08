package com.backend.dto.response;

import lombok.Data;
import java.util.List;

@Data
public class FittingBookingResponse {
    private String bookingId;
    private String status;
    private String message;

    // Static factory methods for cleaner response creation
    public static FittingBookingResponse success(String bookingId) {
        FittingBookingResponse response = new FittingBookingResponse();
        response.setBookingId(bookingId);
        response.setStatus("CONFIRMED");
        response.setMessage("Fitting booked successfully");
        return response;
    }

    public static FittingBookingResponse failed(String message) {
        FittingBookingResponse response = new FittingBookingResponse();
        response.setBookingId(null);
        response.setStatus("FAILED");
        response.setMessage(message);
        return response;
    }
}