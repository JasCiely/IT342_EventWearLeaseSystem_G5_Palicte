package com.backend.features.admin.users;

import com.backend.features.admin.users.dto.response.UserPageResponse;
import com.backend.features.admin.users.dto.response.UserSummaryResponse;

public interface AdminUserService {
    UserPageResponse getUsers(int page, int size, String search, String status);

    UserSummaryResponse updateStatus(String id, boolean active);

    /**
     * Get a single user by ID
     * 
     * @param id the user ID
     * @return UserSummaryResponse with all user details
     * @throws ResourceAlreadyExistsException if user not found
     */
    UserSummaryResponse getUserById(String id);
}