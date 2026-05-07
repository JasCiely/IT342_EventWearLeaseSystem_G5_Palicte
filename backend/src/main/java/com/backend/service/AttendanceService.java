package com.backend.service;

import com.backend.dto.request.EditAttendanceRequest;
import com.backend.dto.response.AttendanceHistoryResponse;
import com.backend.dto.response.AttendanceResponse;

import java.time.LocalDate;
import java.util.List;

public interface AttendanceService {

    void recordTodayAttendance(String recordedByAdminId);

    AttendanceResponse getTodayAttendance();

    void resetTodayAttendance();

    boolean attendanceExistsForDate(LocalDate date);

    // Unlocks a session so records can be edited
    void unlockAttendance(LocalDate date, String adminId);

    // Edits a single attendance record (only when unlocked)
    void editAttendanceRecord(String recordId, EditAttendanceRequest request, String adminId);

    // Filtered history across all dates
    List<AttendanceHistoryResponse> getAttendanceHistory(
            String date, String staffId, Boolean isLate, String status);
}