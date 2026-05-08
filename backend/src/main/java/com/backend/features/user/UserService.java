package com.backend.features.user;

import com.backend.features.user.dto.request.UpdateProfileRequest;
import com.backend.features.user.dto.response.ProfileResponse;
import org.springframework.web.multipart.MultipartFile;

public interface UserService {

    ProfileResponse getProfile(String email);

    ProfileResponse updateProfile(String email, UpdateProfileRequest request);

    ProfileResponse uploadProfilePhoto(String email, MultipartFile file);
}