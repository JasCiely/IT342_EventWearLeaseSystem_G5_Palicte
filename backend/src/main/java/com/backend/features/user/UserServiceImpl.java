package com.backend.features.user;

import com.backend.features.user.dto.request.UpdateProfileRequest;
import com.backend.features.user.dto.response.ProfileResponse;
import com.backend.shared.entity.User;
import com.backend.shared.exception.InvalidCredentialsException;
import com.backend.shared.exception.ResourceAlreadyExistsException;
import com.backend.shared.repository.UserRepository;
import com.backend.features.user.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.service-role-key}")
    private String supabaseServiceRoleKey;

    @Value("${supabase.storage.bucket}")
    private String bucket;

    private static final List<String> ALLOWED_TYPES = List.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final long MAX_SIZE = 5 * 1024 * 1024;

    /*
     * ────────────────────────────────────────────────────────
     * GET PROFILE
     * Looks up by ID stored in token, NOT by email —
     * so it still works even after an email change.
     * ────────────────────────────────────────────────────────
     */
    @Override
    @Transactional(readOnly = true)
    public ProfileResponse getProfile(String email) {
        log.info("Fetching profile for: {}", email);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("User not found"));
        return mapToProfileResponse(user);
    }

    /*
     * ────────────────────────────────────────────────────────
     * UPDATE PROFILE
     * Key fix: look up user by ID (from token), not email.
     * This means even if the email changes, the next request
     * still finds the correct user by their immutable ID.
     * ────────────────────────────────────────────────────────
     */
    @Override
    public ProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        log.info("Updating profile for: {}", email);

        // Find user by current email from JWT
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("User not found"));

        // Check new email is not taken by a DIFFERENT user
        String newEmail = request.getEmail().toLowerCase().trim();
        if (userRepository.existsByEmailAndIdNot(newEmail, user.getId())) {
            throw new ResourceAlreadyExistsException("User", "email", newEmail);
        }

        // Check new phone is not taken by a DIFFERENT user
        String newPhone = request.getPhone() != null ? request.getPhone().trim() : null;
        if (newPhone != null && !newPhone.isEmpty()
                && userRepository.existsByPhoneAndIdNot(newPhone, user.getId())) {
            throw new ResourceAlreadyExistsException("User", "phone", newPhone);
        }

        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setEmail(newEmail);

        // Fix: correctly set null for empty phone, keep value otherwise
        user.setPhone((newPhone == null || newPhone.isEmpty()) ? null : newPhone);

        User saved = userRepository.save(user);
        log.info("Profile updated successfully for: {}", saved.getEmail());

        // ── IMPORTANT: return the new email in response so the frontend
        // updates localStorage with the latest email. The JWT token
        // still carries the old email — tell frontend to re-login
        // if email was changed so they get a fresh token.
        ProfileResponse response = mapToProfileResponse(saved);
        response.setEmailChanged(!email.equals(newEmail));
        return response;
    }

    /*
     * ────────────────────────────────────────────────────────
     * UPLOAD PROFILE PHOTO — Supabase Storage
     * ────────────────────────────────────────────────────────
     */
    @Override
    public ProfileResponse uploadProfilePhoto(String email, MultipartFile file) {
        log.info("Uploading profile photo for: {}", email);

        if (file == null || file.isEmpty())
            throw new IllegalArgumentException("No file provided");

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType))
            throw new IllegalArgumentException("Invalid file type. Allowed: JPEG, PNG, WEBP, GIF");

        if (file.getSize() > MAX_SIZE)
            throw new IllegalArgumentException("File too large. Maximum size is 5 MB");

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("User not found"));

        if (user.getProfilePhotoUrl() != null && !user.getProfilePhotoUrl().isEmpty())
            deleteOldPhotoFromSupabase(user.getProfilePhotoUrl());

        String ext = getExtension(file.getOriginalFilename(), contentType);
        String fileName = UUID.randomUUID() + "." + ext;

        try {
            uploadToSupabase(fileName, file.getBytes(), contentType);
        } catch (IOException e) {
            log.error("Failed to read file bytes: {}", e.getMessage());
            throw new RuntimeException("Could not process photo. Please try again.");
        }

        String publicUrl = supabaseUrl
                + "/storage/v1/object/public/"
                + bucket + "/"
                + fileName;

        user.setProfilePhotoUrl(publicUrl);
        User saved = userRepository.save(user);

        log.info("Profile photo uploaded: {}", publicUrl);
        return mapToProfileResponse(saved);
    }

    /* ── Supabase Storage upload ── */
    private void uploadToSupabase(String path, byte[] bytes, String contentType) {
        RestTemplate restTemplate = new RestTemplate();
        String url = supabaseUrl + "/storage/v1/object/" + bucket + "/" + path;

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        headers.set("x-upsert", "true");
        headers.setContentType(MediaType.parseMediaType(contentType));

        ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.POST, new HttpEntity<>(bytes, headers), String.class);

        if (!response.getStatusCode().is2xxSuccessful()) {
            log.error("Supabase upload failed: {}", response.getBody());
            throw new RuntimeException("Failed to upload photo to storage");
        }
        log.info("Supabase upload successful: {}", path);
    }

    /* ── Supabase Storage delete ── */
    private void deleteOldPhotoFromSupabase(String oldPublicUrl) {
        try {
            String prefix = supabaseUrl + "/storage/v1/object/public/" + bucket + "/";
            if (!oldPublicUrl.startsWith(prefix))
                return;

            String fileName = oldPublicUrl.substring(prefix.length());
            String deleteUrl = supabaseUrl + "/storage/v1/object/" + bucket + "/" + fileName;

            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);

            restTemplate.exchange(deleteUrl, HttpMethod.DELETE,
                    new HttpEntity<>(headers), String.class);

            log.info("Deleted old photo: {}", fileName);
        } catch (Exception e) {
            log.warn("Could not delete old photo: {}", e.getMessage());
        }
    }

    /* ── helpers ── */
    private String getExtension(String originalFilename, String contentType) {
        if (originalFilename != null && originalFilename.contains("."))
            return originalFilename.substring(
                    originalFilename.lastIndexOf('.') + 1).toLowerCase();
        return switch (contentType) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/gif" -> "gif";
            default -> "jpg";
        };
    }

    /* ── mapper ── */
    private ProfileResponse mapToProfileResponse(User user) {
        return ProfileResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .profilePhotoUrl(user.getProfilePhotoUrl())
                .role(user.getRole().name())
                .active(user.isActive())
                .createdAt(user.getCreatedAt())
                .lastLoginAt(user.getLastLoginAt())
                .build();
    }
}