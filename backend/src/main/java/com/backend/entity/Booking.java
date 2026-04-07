package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, unique = true)
    private String bookingId;

    @Column(nullable = false)
    private String itemId;

    @Column(nullable = false)
    private String itemName;

    @Column(nullable = false)
    private String fittingDate; // Keep as String, not Date

    @Column(nullable = false)
    private String fittingTime;

    @Column(nullable = false)
    private String customerName;

    @Column(nullable = false)
    private String customerEmail;

    @Column(nullable = false)
    private String customerPhone;

    private String preferredSize;

    @Column(length = 500)
    private String notes;

    private Long userId;

    @Column(nullable = false)
    private String status = "CONFIRMED";

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}