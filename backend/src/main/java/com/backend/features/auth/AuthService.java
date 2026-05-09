package com.backend.features.auth;

import com.backend.features.auth.dto.request.LoginRequest;
import com.backend.features.auth.dto.request.RegisterRequest;
import com.backend.features.auth.dto.request.ChangePasswordRequest;
import com.backend.features.auth.dto.response.AuthResponse;

public interface AuthService {
    AuthResponse register(RegisterRequest request);

    AuthResponse login(LoginRequest request);

    void changePassword(String email, ChangePasswordRequest request);

    void sendPasswordResetOtp(String email);

    void verifyOtp(String email, String otp);

    void resetPassword(String email, String otp, String newPassword);
}