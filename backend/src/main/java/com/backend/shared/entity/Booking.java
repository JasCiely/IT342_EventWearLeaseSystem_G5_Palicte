package com.backend.shared.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
@Data
public class Booking {
    @Id
    private String id;

    @Column(name = "booking_id", unique = true, nullable = false)
    private String bookingId;

    @Column(name = "item_id", nullable = false)
    private String itemId;

    @Column(name = "item_name", nullable = false)
    private String itemName;

    @Column(name = "fitting_date")
    private String fittingDate;

    @Column(name = "fitting_time")
    private String fittingTime;

    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @Column(name = "customer_email", nullable = false)
    private String customerEmail;

    @Column(name = "customer_phone")
    private String customerPhone;

    @Column(name = "preferred_size")
    private String preferredSize;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "lease_started", nullable = false)
    private boolean leaseStarted = false;

    @Column(name = "lease_booking_id")
    private String leaseBookingId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void generateId() {
        if (id == null || id.isEmpty()) {
            id = java.util.UUID.randomUUID().toString();
        }
    }
}