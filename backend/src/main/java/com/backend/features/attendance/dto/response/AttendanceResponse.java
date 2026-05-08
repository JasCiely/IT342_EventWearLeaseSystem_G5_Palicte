package com.backend.features.attendance.dto.response;

import com.backend.shared.entity.AttendanceSession;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class AttendanceResponse {

    private String id;
    private LocalDate date;
    private String recordedBy;
    private LocalDateTime recordedAt;
    private boolean isLocked;
    private LocalDateTime editedAt;
    private String editedBy;
    private List<AttendanceHistoryResponse> records;

    public static AttendanceResponse from(AttendanceSession session, List<AttendanceHistoryResponse> records) {
        AttendanceResponse response = new AttendanceResponse();
        response.setId(session.getId());
        response.setDate(session.getAttendanceDate());
        response.setRecordedBy(session.getRecordedBy());
        response.setRecordedAt(session.getRecordedAt());
        response.setLocked(session.isLocked());
        response.setEditedAt(session.getEditedAt());
        response.setEditedBy(session.getEditedBy());
        response.setRecords(records);
        return response;
    }
}