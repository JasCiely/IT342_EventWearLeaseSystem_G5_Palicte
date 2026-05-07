package com.backend.repository;

import com.backend.entity.AttendanceSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface AttendanceSessionRepository extends JpaRepository<AttendanceSession, String> {

    Optional<AttendanceSession> findByAttendanceDate(LocalDate attendanceDate);

    boolean existsByAttendanceDate(LocalDate attendanceDate);
}
