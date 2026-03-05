package com.backend.service.impl;

import com.backend.dto.request.UpdateProfileRequest;
import com.backend.dto.response.ProfileResponse;
import com.backend.entity.User;
import com.backend.exception.InvalidCredentialsException;
import com.backend.exception.ResourceAlreadyExistsException;
import com.backend.repository.UserRepository;
import com.backend.service.UserService;
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

    // ── Supabase config — injected from application.properties ──
    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.service-role-key}")
    private String supabaseServiceRoleKey;

    @Value("${supabase.storage.bucket}")
    private String bucket;

    // ── Allowed image MIME types ──
    private static final List<String> ALLOWED_TYPES = List.of("image/jpeg", "image/png", "image/webp", "image/gif");

    // ── Max file size: 5 MB ──
    private static final long MAX_SIZE = 5 * 1024 * 1024;

    /*
     * ────────────────────────────────────────────────────────
     * GET PROFILE
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
     * ────────────────────────────────────────────────────────
     */
    @Override
    public ProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        log.info("Updating profile for: {}", email);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("User not found"));

        // Check email not taken by a DIFFERENT user
        String newEmail = request.getEmail().toLowerCase().trim();
        if (userRepository.existsByEmailAndIdNot(newEmail, user.getId())) {
            throw new ResourceAlreadyExistsException("User", "email", newEmail);
        }

        // Check phone not taken by a DIFFERENT user
        String newPhone = request.getPhone() != null ? request.getPhone().trim() : null;
        if (newPhone != null && !newPhone.isEmpty()
                && userRepository.existsByPhoneAndIdNot(newPhone, user.getId())) {
            throw new ResourceAlreadyExistsException("User", "phone", newPhone);
        }

        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setEmail(newEmail);
        user.setPhone(newPhone != null && newPhone.isEmpty() ? null : newPhone);

        User saved = userRepository.save(user);
        log.info("Profile updated successfully for: {}", saved.getEmail());
        return mapToProfileResponse(saved);
    }

    /*
     * ────────────────────────────────────────────────────────
     * UPLOAD PROFILE PHOTO — Supabase Storage
     * 
     * Flow:
     * 1. Validate file type + size
     * 2. Delete old photo from Supabase (if any)
     * 3. Upload new file to Supabase Storage bucket
     * 4. Build the public CDN URL and save to DB
     * 5. Return updated ProfileResponse
     * ────────────────────────────────────────────────────────
     */
    @Override
    public ProfileResponse uploadProfilePhoto(String email, MultipartFile file) {
        log.info("Uploading profile photo for: {}", email);

        // 1. Validate
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file provided");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException(
                    "Invalid file type. Allowed: JPEG, PNG, WEBP, GIF");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new IllegalArgumentException("File too large. Maximum size is 5 MB");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("User not found"));

        // 2. Delete old photo from Supabase Storage (if exists)
        if (user.getProfilePhotoUrl() != null && !user.getProfilePhotoUrl().isEmpty()) {
            deleteOldPhotoFromSupabase(user.getProfilePhotoUrl());
        }

        // 3. Upload to Supabase Storage
        String ext = getExtension(file.getOriginalFilename(), contentType);
        String fileName = UUID.randomUUID() + "." + ext;
        String uploadPath = fileName; // stored at root of bucket

        try {
            uploadToSupabase(uploadPath, file.getBytes(), contentType);
        } catch (IOException e) {
            log.error("Failed to read file bytes: {}", e.getMessage());
            throw new RuntimeException("Could not process photo. Please try again.");
        }

        // 4. Build the Supabase public CDN URL
        // Format:
        // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<filename>
        String publicUrl = supabaseUrl
                + "/storage/v1/object/public/"
                + bucket + "/"
                + uploadPath;

        user.setProfilePhotoUrl(publicUrl);
        User saved = userRepository.save(user);

        log.info("Profile photo uploaded to Supabase: {}", publicUrl);
        return mapToProfileResponse(saved);
    }

    /* ── Upload bytes to Supabase Storage via REST API ── */
    private void uploadToSupabase(String path, byte[] bytes, String contentType) {
        RestTemplate restTemplate = new RestTemplate();

        // Supabase Storage upload endpoint
        String url = supabaseUrl + "/storage/v1/object/" + bucket + "/" + path;

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
        headers.set("x-upsert", "true"); // overwrite if same name exists
        headers.setContentType(MediaType.parseMediaType(contentType));

        HttpEntity<byte[]> entity = new HttpEntity<>(bytes, headers);

        ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.POST, entity, String.class);

        if (!response.getStatusCode().is2xxSuccessful()) {
            log.error("Supabase upload failed: {}", response.getBody());
            throw new RuntimeException("Failed to upload photo to storage");
        }

        log.info("Supabase upload successful: {}", path);
    }

    /* ── Delete old photo from Supabase Storage ── */
    private void deleteOldPhotoFromSupabase(String oldPublicUrl) {
        try {
            // Extract filename from full public URL
            // URL format:
            // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<filename>
            String prefix = supabaseUrl + "/storage/v1/object/public/" + bucket + "/";
            if (!oldPublicUrl.startsWith(prefix))
                return;

            String fileName = oldPublicUrl.substring(prefix.length());
            String deleteUrl = supabaseUrl + "/storage/v1/object/" + bucket + "/" + fileName;

            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);

            HttpEntity<Void> entity = new HttpEntity<>(headers);
            restTemplate.exchange(deleteUrl, HttpMethod.DELETE, entity, String.class);

            log.info("Deleted old photo from Supabase: {}", fileName);
        } catch (Exception e) {
            // Non-fatal — log and continue even if delete fails
            log.warn("Could not delete old photo from Supabase: {}", e.getMessage());
        }
    }

    /* ── helpers ── */
    private String getExtension(String originalFilename, String contentType) {
        if (originalFilename != null && originalFilename.contains(".")) {
            return originalFilename.substring(
                    originalFilename.lastIndexOf('.') + 1).toLowerCase();
        }
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