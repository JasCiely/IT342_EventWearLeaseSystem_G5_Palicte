package com.backend.service;

import com.backend.dto.response.UserPageResponse;
import com.backend.dto.response.UserSummaryResponse;

public interface AdminUserService {
    UserPageResponse getUsers(int page, int size, String search, String status);

    UserSummaryResponse updateStatus(String id, boolean active);
}