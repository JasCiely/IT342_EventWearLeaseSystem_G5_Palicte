package com.backend.features.attendance.dto.request;

import lombok.Data;

@Data
public class EditAttendanceRequest {

    private String status; // "On Duty" or "Off Duty"
    private Boolean isLate;
    private Integer lateMinutes;
}