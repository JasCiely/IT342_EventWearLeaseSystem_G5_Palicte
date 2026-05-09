package com.backend.shared.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Singleton settings row for booking time restrictions.
 * Table: bookingtime_settings
 *
 * Always read/write via id = 1 (upsert pattern in BookingTimeSettingsService).
 * Compatible with Supabase (PostgreSQL).
 */
@Entity
@Table(name = "bookingtime_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingTimeSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    /**
     * Whether time restrictions are active.
     * When false, bookings are accepted at any time.
     */
    @Column(name = "enable_time_restrictions", nullable = false, columnDefinition = "boolean default true")
    private boolean enableTimeRestrictions = true;

    /**
     * Shop opening time in "HH:mm" format, e.g. "09:00".
     */
    @Column(name = "shop_open_time", nullable = false, length = 5, columnDefinition = "varchar(5) default '09:00'")
    private String shopOpenTime = "09:00";

    /**
     * Shop closing time in "HH:mm" format, e.g. "17:00".
     */
    @Column(name = "shop_close_time", nullable = false, length = 5, columnDefinition = "varchar(5) default '17:00'")
    private String shopCloseTime = "17:00";

    /**
     * Comma-separated day-of-week integers.
     * Java convention: 1=Monday … 7=Sunday (ISO), but frontend uses 0=Sunday …
     * 6=Saturday.
     * We store the frontend convention (0–6) to avoid conversion confusion.
     * Default "1,2,3,4,5" = Monday through Friday.
     */
    @Column(name = "working_days", nullable = false, length = 50, columnDefinition = "varchar(50) default '1,2,3,4,5'")
    private String workingDays = "1,2,3,4,5";

    /**
     * IANA timezone identifier, e.g. "Asia/Manila".
     */
    @Column(name = "timezone", nullable = false, length = 100, columnDefinition = "varchar(100) default 'Asia/Manila'")
    private String timezone = "Asia/Manila";

    /**
     * Bookings at or below this price are auto-approved.
     */
    @Column(name = "auto_approve_threshold", nullable = false, precision = 10, scale = 2, columnDefinition = "numeric(10,2) default 500.00")
    private BigDecimal autoApproveThreshold = BigDecimal.valueOf(500);

    /**
     * Duration of each fitting slot in minutes. Default 30.
     * Determines the time-slot grid shown to customers when booking a fitting.
     */
    @Column(name = "fitting_duration_minutes", nullable = false, columnDefinition = "integer default 30")
    private int fittingDurationMinutes = 30;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}