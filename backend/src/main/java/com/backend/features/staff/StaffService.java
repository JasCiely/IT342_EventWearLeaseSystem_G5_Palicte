package com.backend.features.staff;

import com.backend.features.staff.dto.request.CreateStaffRequest;
import com.backend.features.staff.dto.request.UpdateStaffRequest;
import com.backend.features.staff.dto.response.StaffPageResponse;
import com.backend.features.staff.dto.response.StaffResponse;
import com.backend.shared.entity.Staff;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface StaffService {

    StaffResponse createStaff(CreateStaffRequest request);

    StaffPageResponse getStaff(int page, int size, String search, String status);

    StaffResponse getStaffById(String id);

    StaffResponse updateStaff(String id, UpdateStaffRequest request);

    void deleteStaff(String id);

    // ── Cross-feature access (Attendance feature only) ────────────────────
    List<Staff> getActiveStaff();

    Map<String, String> getStaffNameMap(List<String> staffIds);

    void incrementDaysWorked(Staff staff);

    void decrementDaysWorked(Staff staff);

    void updateStaffLiveStatus(String staffId, String newStatus);

    void adjustDaysWorked(String staffId, String oldStatus, String newStatus);

    void saveAll(List<Staff> staffList);

    Optional<Staff> findActiveById(String staffId);
}
