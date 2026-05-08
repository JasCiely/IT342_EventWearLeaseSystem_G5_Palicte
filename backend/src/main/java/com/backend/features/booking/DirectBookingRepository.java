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

    @Query("SELECT db FROM DirectBooking db WHERE db.inventoryItemId = :itemId AND " +
            "((db.startDate <= :endDate AND db.endDate >= :startDate) OR " +
            "(db.startDate <= :startDate AND db.endDate >= :startDate)) AND " +
            "db.bookingStatus NOT IN ('Rejected', 'Cancelled')")
    List<DirectBooking> findOverlappingBookings(@Param("itemId") String itemId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT COUNT(db) > 0 FROM DirectBooking db WHERE db.inventoryItemId = :itemId AND " +
            "((db.startDate <= :endDate AND db.endDate >= :startDate) OR " +
            "(db.startDate <= :startDate AND db.endDate >= :startDate)) AND " +
            "db.bookingStatus NOT IN ('Rejected', 'Cancelled')")
    boolean hasOverlappingBookings(@Param("itemId") String itemId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
