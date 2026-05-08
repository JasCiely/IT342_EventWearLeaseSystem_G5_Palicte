package com.backend.features.attendance.dto.response;

import com.backend.shared.entity.AttendanceRecord;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class AttendanceHistoryResponse {

    private String id;
    private String staffId;
    private String staffName;
    private LocalDate attendanceDate;
    private LocalDateTime recordedAt;
    private LocalDateTime editedAt;
    private String editedBy;
    private String status;
    private boolean isLate;
    private Integer lateMinutes;
    private boolean isLocked;

    public static AttendanceHistoryResponse from(AttendanceRecord record, String staffName) {
        AttendanceHistoryResponse response = new AttendanceHistoryResponse();
        response.setId(record.getId());
        response.setStaffId(record.getStaffId());
        response.setStaffName(staffName);
        response.setAttendanceDate(record.getAttendanceDate());
        response.setRecordedAt(record.getRecordedAt());
        response.setEditedAt(record.getEditedAt());
        response.setEditedBy(record.getEditedBy());
        response.setStatus(record.getStatus());
        response.setLate(record.isLate());
        response.setLateMinutes(record.getLateMinutes());
        response.setLocked(record.isLocked());
        return response;
    }
}