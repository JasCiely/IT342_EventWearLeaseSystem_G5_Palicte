package com.backend.repository;

import com.backend.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, String> {

    List<Booking> findByCustomerEmailOrderByCreatedAtDesc(String email);

    List<Booking> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<Booking> findByItemIdAndCustomerEmailAndStatus(String itemId, String customerEmail, String status);

    // Find by booking ID
    Optional<Booking> findByBookingId(String bookingId);

    // Fixed: Compare string dates properly
    @Query("SELECT b FROM Booking b WHERE b.customerEmail = :email AND b.status = 'CONFIRMED' AND b.fittingDate >= :today ORDER BY b.fittingDate ASC")
    List<Booking> findUpcomingBookingsByEmail(@Param("email") String email, @Param("today") String today);

    long countByFittingDateAndFittingTimeAndStatus(String fittingDate, String fittingTime, String status);

    // Check if user has active booking for an item
    @Query("SELECT COUNT(b) > 0 FROM Booking b WHERE b.itemId = :itemId AND b.customerEmail = :email AND b.status = 'CONFIRMED' AND b.fittingDate >= :today")
    boolean existsActiveBookingByItemAndCustomer(@Param("itemId") String itemId, @Param("email") String email,
            @Param("today") String today);
}