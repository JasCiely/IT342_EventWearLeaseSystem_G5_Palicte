package com.backend.service;

import com.backend.dto.request.UpdateProfileRequest;
import com.backend.dto.response.ProfileResponse;
import org.springframework.web.multipart.MultipartFile;

public interface UserService {

    ProfileResponse getProfile(String email);

    ProfileResponse updateProfile(String email, UpdateProfileRequest request);

    ProfileResponse uploadProfilePhoto(String email, MultipartFile file);
}