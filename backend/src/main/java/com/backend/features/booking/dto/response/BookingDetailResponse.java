package com.backend.features.booking.dto.response;

import com.backend.shared.entity.Booking;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
public class BookingDetailResponse {
    private String id;
    private String bookingId;
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
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static BookingDetailResponse from(Booking booking) {
        BookingDetailResponse dto = new BookingDetailResponse();
        dto.setId(booking.getId());
        dto.setBookingId(booking.getBookingId());
        dto.setItemId(booking.getItemId());
        dto.setItemName(booking.getItemName());
        dto.setFittingDate(booking.getFittingDate());
        dto.setFittingTime(booking.getFittingTime());
        dto.setCustomerName(booking.getCustomerName());
        dto.setCustomerEmail(booking.getCustomerEmail());
        dto.setCustomerPhone(booking.getCustomerPhone());
        dto.setPreferredSize(booking.getPreferredSize());
        dto.setNotes(booking.getNotes());
        dto.setUserId(booking.getUserId());
        dto.setStatus(booking.getStatus());
        dto.setCreatedAt(booking.getCreatedAt());
        dto.setUpdatedAt(booking.getUpdatedAt());
        return dto;
    }
}
