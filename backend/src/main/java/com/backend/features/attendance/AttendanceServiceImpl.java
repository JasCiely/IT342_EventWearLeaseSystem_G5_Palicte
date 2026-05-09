package com.backend.features.attendance;

import com.backend.features.attendance.dto.request.EditAttendanceRequest;
import com.backend.features.attendance.dto.response.AttendanceHistoryResponse;
import com.backend.features.attendance.dto.response.AttendanceResponse;
import com.backend.features.staff.StaffService;
import com.backend.shared.entity.AttendanceRecord;
import com.backend.shared.entity.AttendanceSession;
import com.backend.shared.entity.Staff;
import com.backend.features.attendance.AttendanceRecordRepository;
import com.backend.features.attendance.AttendanceSessionRepository;
import com.backend.features.attendance.AttendanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class AttendanceServiceImpl implements AttendanceService {

    private static final String ON_DUTY = "On Duty";

    private final AttendanceRecordRepository attendanceRecordRepository;
    private final AttendanceSessionRepository attendanceSessionRepository;
    private final StaffService staffService;

    /*
     * ─────────────────────────────────────────────────────────
     * Record today's attendance
     * ─────────────────────────────────────────────────────────
     */
    @Override
    public void recordTodayAttendance(String recordedByAdminId) {
        LocalDate today = LocalDate.now();

        if (attendanceSessionRepository.existsByAttendanceDate(today)) {
            throw new IllegalStateException("Attendance already recorded for today: " + today);
        }

        List<Staff> staffList = staffService.getActiveStaff();

        // Create one AttendanceRecord per active staff
        List<AttendanceRecord> records = staffList.stream().map(staff -> {
            AttendanceRecord record = new AttendanceRecord();
            record.setStaffId(staff.getId());
            record.setAttendanceDate(today);
            record.setStatus(staff.getStatus()); // snapshot current status
            record.setRecordedAt(LocalDateTime.now());
            record.setLocked(true);
            record.setLate(false);

            // Increment daysWorked for On Duty staff only
            if (ON_DUTY.equalsIgnoreCase(staff.getStatus())) {
                staff.setDaysWorked(staff.getDaysWorked() + 1);
            }

            return record;
        }).collect(Collectors.toList());

        staffService.saveAll(staffList);
        attendanceRecordRepository.saveAll(records);

        // Create the session (one per day, locked by default)
        AttendanceSession session = new AttendanceSession();
        session.setAttendanceDate(today);
        session.setRecordedBy(recordedByAdminId);
        session.setRecordedAt(LocalDateTime.now());
        session.setLocked(true);
        attendanceSessionRepository.save(session);
    }

    /*
     * ─────────────────────────────────────────────────────────
     * Get today's attendance session + all staff records
     * ─────────────────────────────────────────────────────────
     */
    @Override
    @Transactional(readOnly = true)
    public AttendanceResponse getTodayAttendance() {
        LocalDate today = LocalDate.now();
        AttendanceSession session = attendanceSessionRepository.findByAttendanceDate(today)
                .orElseThrow(() -> new IllegalStateException(
                        "Attendance has not been recorded for today"));

        List<AttendanceRecord> records = attendanceRecordRepository.findAllByAttendanceDate(today);
        List<AttendanceHistoryResponse> recordResponses = mapWithStaffNames(records);

        return AttendanceResponse.from(session, recordResponses);
    }

    /*
     * ─────────────────────────────────────────────────────────
     * Unlock attendance session so records can be edited
     * ─────────────────────────────────────────────────────────
     */
    @Override
    public void unlockAttendance(LocalDate date, String adminId) {
        AttendanceSession session = attendanceSessionRepository.findByAttendanceDate(date)
                .orElseThrow(() -> new IllegalStateException(
                        "No attendance session found for date: " + date));

        session.setLocked(false);
        session.setEditedAt(LocalDateTime.now());
        session.setEditedBy(adminId);
        attendanceSessionRepository.save(session);

        // Unlock all individual records for that date too
        List<AttendanceRecord> records = attendanceRecordRepository.findAllByAttendanceDate(date);
        records.forEach(r -> r.setLocked(false));
        attendanceRecordRepository.saveAll(records);
    }

    /*
     * ─────────────────────────────────────────────────────────
     * Edit a single staff attendance record (session must be unlocked)
     * ─────────────────────────────────────────────────────────
     */
    @Override
    public void editAttendanceRecord(String recordId, EditAttendanceRequest request, String adminId) {
        AttendanceRecord record = attendanceRecordRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Attendance record not found: " + recordId));

        if (record.isLocked()) {
            throw new IllegalStateException(
                    "Attendance is locked. Unlock it first before editing.");
        }

        LocalDate recordDate = record.getAttendanceDate();
        boolean isToday = recordDate.equals(LocalDate.now());

        // If status is changing, adjust daysWorked AND potentially sync staff status
        if (request.getStatus() != null
                && !request.getStatus().equalsIgnoreCase(record.getStatus())) {

            staffService.adjustDaysWorked(record.getStaffId(), record.getStatus(), request.getStatus());

            // For today's records, also update the staff's live status
            if (isToday) {
                staffService.updateStaffLiveStatus(record.getStaffId(), request.getStatus());
            }

            record.setStatus(request.getStatus());
        }

        if (request.getIsLate() != null) {
            record.setLate(request.getIsLate());
        }

        if (request.getLateMinutes() != null) {
            record.setLateMinutes(request.getLateMinutes());
        }

        record.setEditedAt(LocalDateTime.now());
        record.setEditedBy(adminId);
        attendanceRecordRepository.save(record);
    }

    /*
     * ─────────────────────────────────────────────────────────
     * Filtered attendance history across all dates
     * ─────────────────────────────────────────────────────────
     */
    @Override
    @Transactional(readOnly = true)
    public List<AttendanceHistoryResponse> getAttendanceHistory(
            String date, String staffId, Boolean isLate, String status) {

        List<AttendanceRecord> records = attendanceRecordRepository.findFilteredHistory(date, staffId, isLate, status);
        return mapWithStaffNames(records);
    }

    /*
     * ─────────────────────────────────────────────────────────
     * Reset today's attendance (reverses daysWorked + deletes records)
     * ─────────────────────────────────────────────────────────
     */
    @Override
    public void resetTodayAttendance() {
        LocalDate today = LocalDate.now();
        AttendanceSession session = attendanceSessionRepository.findByAttendanceDate(today)
                .orElseThrow(() -> new IllegalStateException(
                        "No attendance session found for today"));

        List<AttendanceRecord> records = attendanceRecordRepository.findAllByAttendanceDate(today);

        // Reverse daysWorked for staff who were On Duty today
        records.stream()
                .filter(r -> ON_DUTY.equalsIgnoreCase(r.getStatus()))
                .forEach(r -> staffService.findActiveById(r.getStaffId())
                        .ifPresent(staff -> staffService.decrementDaysWorked(staff)));

        attendanceRecordRepository.deleteAll(records);
        attendanceSessionRepository.delete(session);
    }

    @Override
    public boolean attendanceExistsForDate(LocalDate date) {
        return attendanceSessionRepository.existsByAttendanceDate(date);
    }

    /* ── private helpers ── */

    /**
     * Batch-loads staff names to avoid N+1 queries.
     */
    private List<AttendanceHistoryResponse> mapWithStaffNames(List<AttendanceRecord> records) {
        List<String> staffIds = records.stream()
                .map(AttendanceRecord::getStaffId)
                .distinct()
                .collect(Collectors.toList());

        Map<String, String> nameMap = staffService.getStaffNameMap(staffIds);

        return records.stream()
                .map(r -> AttendanceHistoryResponse.from(r, nameMap.getOrDefault(r.getStaffId(), "Unknown")))
                .collect(Collectors.toList());
    }
}