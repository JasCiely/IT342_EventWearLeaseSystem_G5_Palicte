package com.backend.features.staff;

import com.backend.features.staff.dto.request.CreateStaffRequest;
import com.backend.features.staff.dto.request.UpdateStaffRequest;
import com.backend.features.staff.dto.response.StaffPageResponse;
import com.backend.features.staff.dto.response.StaffResponse;

public interface StaffService {

    StaffResponse createStaff(CreateStaffRequest request);

    StaffPageResponse getStaff(int page, int size, String search, String status);

    StaffResponse getStaffById(String id);

    StaffResponse updateStaff(String id, UpdateStaffRequest request);

    void deleteStaff(String id);
}
