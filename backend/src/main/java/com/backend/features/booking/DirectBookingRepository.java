package com.backend.features.booking;

import com.backend.shared.entity.DirectBooking;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface DirectBookingRepository extends JpaRepository<DirectBooking, String> {

    Page<DirectBooking> findByUserId(String userId, Pageable pageable);

    Page<DirectBooking> findByBookingStatus(String status, Pageable pageable);

    // Completed and Returned bookings free the item — exclude them from blocking checks
    @Query("SELECT db FROM DirectBooking db WHERE db.inventoryItemId = :itemId AND " +
            "(db.startDate <= :endDate AND db.endDate >= :startDate) AND " +
            "db.bookingStatus NOT IN ('Rejected', 'Cancelled', 'Completed', 'Returned')")
    List<DirectBooking> findOverlappingBookings(@Param("itemId") String itemId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT COUNT(db) > 0 FROM DirectBooking db WHERE db.inventoryItemId = :itemId AND " +
            "(db.startDate <= :endDate AND db.endDate >= :startDate) AND " +
            "db.bookingStatus NOT IN ('Rejected', 'Cancelled', 'Completed', 'Returned')")
    boolean hasOverlappingBookings(@Param("itemId") String itemId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    // For lease extension: same overlap logic but excludes the booking being extended
    @Query("SELECT COUNT(db) > 0 FROM DirectBooking db WHERE db.inventoryItemId = :itemId AND " +
            "db.id <> :excludeId AND " +
            "(db.startDate <= :endDate AND db.endDate >= :startDate) AND " +
            "db.bookingStatus NOT IN ('Rejected', 'Cancelled', 'Completed', 'Returned')")
    boolean hasOverlappingBookingsExcluding(@Param("itemId") String itemId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("excludeId") String excludeId);

    // Finds Approved bookings whose rental start date has arrived — used by the auto-activation scheduler
    @Query("SELECT db FROM DirectBooking db WHERE db.bookingStatus = 'Approved' AND db.startDate <= :today")
    List<DirectBooking> findApprovedBookingsToActivate(@Param("today") LocalDate today);

    // Returns all active (blocking) bookings for an item, optionally excluding one booking (for extend UX)
    @Query("SELECT db FROM DirectBooking db WHERE db.inventoryItemId = :itemId AND " +
            "db.bookingStatus NOT IN ('Rejected', 'Cancelled', 'Completed', 'Returned') AND " +
            "(:excludeId IS NULL OR db.id <> :excludeId)")
    List<DirectBooking> findActiveBookingsForItem(@Param("itemId") String itemId,
            @Param("excludeId") String excludeId);

    // Buffer-aware: checks [startDate, endDate] against each existing booking's effective range [existingStart, existingEnd+2].
    // Pass adjustedStart = startDate.minusDays(2) to enforce the 2-day post-return maintenance block.
    @Query("SELECT COUNT(db) > 0 FROM DirectBooking db WHERE db.inventoryItemId = :itemId AND " +
            "(db.startDate <= :endDate AND db.endDate >= :adjustedStart) AND " +
            "db.bookingStatus NOT IN ('Rejected', 'Cancelled', 'Completed', 'Returned')")
    boolean hasOverlappingBookingsWithBuffer(@Param("itemId") String itemId,
            @Param("adjustedStart") LocalDate adjustedStart,
            @Param("endDate") LocalDate endDate);

    // Buffer-aware version that excludes one booking (for edit/extend flows).
    @Query("SELECT COUNT(db) > 0 FROM DirectBooking db WHERE db.inventoryItemId = :itemId AND " +
            "db.id <> :excludeId AND " +
            "(db.startDate <= :endDate AND db.endDate >= :adjustedStart) AND " +
            "db.bookingStatus NOT IN ('Rejected', 'Cancelled', 'Completed', 'Returned')")
    boolean hasOverlappingBookingsExcludingWithBuffer(@Param("itemId") String itemId,
            @Param("adjustedStart") LocalDate adjustedStart,
            @Param("endDate") LocalDate endDate,
            @Param("excludeId") String excludeId);
}
