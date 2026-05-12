package com.backend.shared.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "inventory_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventorySettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // singleton record, always id = 1

    @Column(name = "min_lease_days", nullable = false)
    private Integer minLeaseDays = 2;

    @Column(name = "weekly_discount", nullable = false)
    private Integer weeklyDiscount = 100;

    @Column(name = "monthly_discount_cap", nullable = false)
    private Integer monthlyDiscountCap = 300;

    @Version
    @Column(name = "version", nullable = false)
    private Long version = 0L; // optimistic lock

    @Column(name = "created_at", updatable = false)
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