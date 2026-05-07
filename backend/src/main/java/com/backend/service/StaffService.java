package com.backend.service;

import com.backend.dto.request.CreateStaffRequest;
import com.backend.dto.request.UpdateStaffRequest;
import com.backend.dto.response.StaffPageResponse;
import com.backend.dto.response.StaffResponse;

public interface StaffService {

    StaffResponse createStaff(CreateStaffRequest request);

    StaffPageResponse getStaff(int page, int size, String search, String status);

    StaffResponse getStaffById(String id);

    StaffResponse updateStaff(String id, UpdateStaffRequest request);

    void deleteStaff(String id);
}
