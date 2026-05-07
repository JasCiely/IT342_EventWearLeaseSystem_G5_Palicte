package com.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "direct_bookings", indexes = {
        @Index(name = "idx_direct_bookings_user", columnList = "user_id"),
        @Index(name = "idx_direct_bookings_item", columnList = "inventory_item_id"),
        @Index(name = "idx_direct_bookings_dates", columnList = "start_date, end_date"),
        @Index(name = "idx_direct_bookings_status", columnList = "booking_status")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DirectBooking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "inventory_item_id", nullable = false)
    private String inventoryItemId;

    @Column(name = "booking_type", nullable = false)
    private String bookingType = "Direct Booking";

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "total_days", nullable = false)
    private Integer totalDays;

    @Column(name = "base_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal basePrice;

    @Column(name = "discount_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "final_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal finalPrice;

    @Column(name = "booking_status", nullable = false)
    private String bookingStatus = "Pending";

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
