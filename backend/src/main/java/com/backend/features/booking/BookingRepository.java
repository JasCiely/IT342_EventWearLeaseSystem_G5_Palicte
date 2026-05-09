package com.backend.features.booking;

import com.backend.shared.entity.Booking;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<Booking, String> {

        List<Booking> findByCustomerEmailOrderByCreatedAtDesc(String email);

        List<Booking> findByUserIdOrderByCreatedAtDesc(Long userId);

        List<Booking> findByItemIdAndCustomerEmailAndStatus(String itemId, String customerEmail, String status);

        @Query("SELECT b FROM Booking b WHERE b.customerEmail = :email AND b.status = 'CONFIRMED' AND b.fittingDate >= :today ORDER BY b.fittingDate ASC")
        List<Booking> findUpcomingBookingsByEmail(@Param("email") String email, @Param("today") String today);

        // Updated: Count confirmed bookings for time slot (30-minute slots)
        @Query("SELECT COUNT(b) FROM Booking b WHERE b.fittingDate = :fittingDate AND b.fittingTime = :fittingTime AND b.status = 'CONFIRMED'")
        long countConfirmedByFittingDateAndTime(@Param("fittingDate") String fittingDate,
                        @Param("fittingTime") String fittingTime);

        @Query("SELECT COUNT(b) FROM Booking b WHERE b.fittingDate = :fittingDate AND b.fittingTime = :fittingTime AND b.status = 'CONFIRMED' AND b.id != :excludeId")
        long countConfirmedByFittingDateAndTimeExcludingId(@Param("fittingDate") String fittingDate,
                        @Param("fittingTime") String fittingTime, @Param("excludeId") String excludeId);

        @Query("SELECT COUNT(b) > 0 FROM Booking b WHERE b.itemId = :itemId AND b.customerEmail = :email AND b.status = 'CONFIRMED' AND b.fittingDate >= :today")
        boolean existsActiveBookingByItemAndCustomer(@Param("itemId") String itemId, @Param("email") String email,
                        @Param("today") String today);

        // Check if user has completed fitting for an item
        @Query("SELECT COUNT(b) > 0 FROM Booking b WHERE b.itemId = :itemId AND b.customerEmail = :email AND b.status = 'COMPLETED'")
        boolean existsCompletedFittingByItemAndCustomer(@Param("itemId") String itemId, @Param("email") String email,
                        @Param("customerEmail") String customerEmail);

        // Get all available time slots for a date (not fully booked)
        @Query("SELECT DISTINCT b.fittingTime FROM Booking b WHERE b.fittingDate = :fittingDate AND b.status = 'CONFIRMED' GROUP BY b.fittingTime HAVING COUNT(b) < :maxSlots")
        List<String> findAvailableTimeSlots(@Param("fittingDate") String fittingDate, @Param("maxSlots") int maxSlots);

        @Modifying
        @Query("UPDATE Booking b SET b.leaseStarted = true, b.leaseBookingId = :leaseBookingId WHERE b.id = :bookingId")
        void markLeaseStarted(@Param("bookingId") String bookingId, @Param("leaseBookingId") String leaseBookingId);
}