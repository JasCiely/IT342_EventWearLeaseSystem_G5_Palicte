package com.backend.dto.response;

import com.backend.entity.Staff;
import lombok.Data;

@Data
public class StaffResponse {

    private String id;
    private String fullName;
    private String email;
    private String role;
    private String status;
    private int daysWorked;
    private Double customRate;
    private int effectiveDailyRate;
    private double totalSalary;

    public static StaffResponse from(Staff staff, int dailyRate) {
        StaffResponse response = new StaffResponse();
        response.setId(staff.getId());
        response.setFullName(staff.getFullName());
        response.setEmail(staff.getEmail());
        response.setRole(staff.getRole());
        response.setStatus(staff.getStatus());
        response.setDaysWorked(staff.getDaysWorked());
        response.setCustomRate(staff.getCustomRate());
        int effective = staff.getCustomRate() != null ? staff.getCustomRate().intValue() : dailyRate;
        response.setEffectiveDailyRate(effective);
        response.setTotalSalary(
                staff.getDaysWorked() * (staff.getCustomRate() != null ? staff.getCustomRate() : dailyRate));
        return response;
    }
}
