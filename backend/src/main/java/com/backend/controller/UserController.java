package com.backend.controller;

import com.backend.dto.request.UpdateProfileRequest;
import com.backend.dto.response.ProfileResponse;
import com.backend.security.JwtService;
import com.backend.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final JwtService jwtService;

    /* ── helper: pull email from Bearer token ── */
    private String extractEmail(HttpServletRequest httpRequest) {
        String authHeader = httpRequest.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Missing or invalid Authorization header");
        }
        return jwtService.extractUsername(authHeader.substring(7));
    }

    /*
     * ────────────────────────────────────────────────────────
     * GET /api/user/profile
     * Returns the authenticated user's full profile.
     * ────────────────────────────────────────────────────────
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(HttpServletRequest httpRequest) {
        try {
            String email = extractEmail(httpRequest);
            ProfileResponse profile = userService.getProfile(email);
            return ResponseEntity.ok(profile);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error fetching profile: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Could not fetch profile"));
        }
    }

    /*
     * ────────────────────────────────────────────────────────
     * PUT /api/user/profile
     * Updates firstName, lastName, email, phone.
     * ────────────────────────────────────────────────────────
     */
    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            HttpServletRequest httpRequest) {
        try {
            String email = extractEmail(httpRequest);
            ProfileResponse updated = userService.updateProfile(email, request);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error updating profile: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    /*
     * ────────────────────────────────────────────────────────
     * POST /api/user/profile/photo
     * Multipart upload — field name: "photo"
     * Allowed types: JPEG, PNG, WEBP, GIF | Max: 5 MB
     * Returns updated ProfileResponse with new profilePhotoUrl.
     * ────────────────────────────────────────────────────────
     */
    @PostMapping(value = "/profile/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadProfilePhoto(
            @RequestParam("photo") MultipartFile photo,
            HttpServletRequest httpRequest) {
        try {
            String email = extractEmail(httpRequest);
            ProfileResponse updated = userService.uploadProfilePhoto(email, photo);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error uploading profile photo: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Could not upload photo. Please try again."));
        }
    }
}