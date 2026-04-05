package com.backend.controller;

import com.backend.dto.request.ChangePasswordRequest;
import com.backend.dto.request.LoginRequest;
import com.backend.dto.request.RegisterRequest;
import com.backend.dto.response.AuthResponse;
import com.backend.security.JwtService;
import com.backend.service.AuthService;
import com.backend.service.TokenBlacklistService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;
    private final TokenBlacklistService tokenBlacklistService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest httpRequest) {

        try {
            log.info("=== CHANGE PASSWORD REQUEST RECEIVED ===");

            String authHeader = httpRequest.getHeader("Authorization");
            log.info("Auth header present: {}", authHeader != null);

            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.warn("Missing or invalid Authorization header");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "Missing or invalid Authorization header"));
            }

            String token = authHeader.substring(7);
            log.info("Token extracted, length: {}", token.length());

            String email = jwtService.extractUsername(token);
            log.info("Email extracted from token: {}", email);

            authService.changePassword(email, request);
            log.info("Password changed successfully for: {}", email);

            return ResponseEntity.ok(Map.of("message", "Password changed successfully"));

        } catch (Exception e) {
            log.error("=== CHANGE PASSWORD ERROR ===");
            log.error("Exception type: {}", e.getClass().getName());
            log.error("Exception message: {}", e.getMessage());
            log.error("Stack trace: ", e);
            throw e;
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest httpRequest) {
        String authHeader = httpRequest.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            tokenBlacklistService.blacklistToken(token);
            log.info("User logged out — token blacklisted");
        }

        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    // ── Forgot Password Endpoints ──────────────────────────────────────────────
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required"));
        }
        authService.sendPasswordResetOtp(email.trim().toLowerCase());
        // Always return success to prevent email enumeration
        return ResponseEntity.ok(Map.of("message", "If that email is registered, an OTP has been sent."));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<Map<String, String>> verifyOtp(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String otp = body.get("otp");
        try {
            authService.verifyOtp(email, otp);
            return ResponseEntity.ok(Map.of("message", "OTP verified successfully."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String otp = body.get("otp");
        String newPassword = body.get("newPassword");
        try {
            authService.resetPassword(email, otp, newPassword);
            return ResponseEntity.ok(Map.of("message", "Password reset successfully."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}