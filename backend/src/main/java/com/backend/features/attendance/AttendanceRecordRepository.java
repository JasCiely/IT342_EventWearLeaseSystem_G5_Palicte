package com.backend.features.attendance;

import com.backend.shared.entity.AttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, String> {

    boolean existsByAttendanceDate(LocalDate date);

    List<AttendanceRecord> findAllByAttendanceDate(LocalDate date);

    Optional<AttendanceRecord> findByStaffIdAndAttendanceDate(String staffId, LocalDate date);

    List<AttendanceRecord> findAllByStaffId(String staffId);

    // ✅ Uses "ar.date" to match the actual DB column name
    @Query(value = "SELECT * FROM attendance_records ar WHERE " +
            "(:date IS NULL OR ar.date = CAST(:date AS date)) AND " +
            "(:staffId IS NULL OR ar.staff_id = :staffId) AND " +
            "(:isLate IS NULL OR ar.is_late = :isLate) AND " +
            "(:status IS NULL OR lower(ar.status) = lower(CAST(:status AS text))) " +
            "ORDER BY ar.date DESC, ar.recorded_at DESC", nativeQuery = true)
    List<AttendanceRecord> findFilteredHistory(
            @Param("date") String date,
            @Param("staffId") String staffId,
            @Param("isLate") Boolean isLate,
            @Param("status") String status);
}