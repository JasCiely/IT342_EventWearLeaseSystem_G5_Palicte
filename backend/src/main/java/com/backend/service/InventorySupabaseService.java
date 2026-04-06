package com.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.client.RestTemplate;

import java.util.UUID;

@Slf4j
@Service
public class InventorySupabaseService {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.service-role-key}")
    private String serviceRoleKey;

    @Value("${supabase.storage.bucket}")
    private String bucket;

    private final RestTemplate restTemplate = new RestTemplate();

    public String uploadFile(MultipartFile file, String folder) {
        try {
            String ext = getExtension(file.getOriginalFilename());
            String fileName = folder + "/" + UUID.randomUUID() + "." + ext;
            String uploadUrl = supabaseUrl + "/storage/v1/object/" + bucket + "/" + fileName;

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + serviceRoleKey);
            headers.setContentType(MediaType.parseMediaType(
                    file.getContentType() != null ? file.getContentType() : "application/octet-stream"));
            headers.set("x-upsert", "true");

            HttpEntity<byte[]> entity = new HttpEntity<>(file.getBytes(), headers);
            restTemplate.exchange(uploadUrl, HttpMethod.POST, entity, String.class);

            // Return full CDN URL (same pattern as your profile photo)
            return supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + fileName;

        } catch (Exception e) {
            log.error("Supabase upload failed: {}", e.getMessage());
            throw new RuntimeException("Failed to upload file to Supabase: " + e.getMessage());
        }
    }

    public void deleteFile(String fullUrl) {
        try {
            // Extract path after /public/{bucket}/
            String marker = "/object/public/" + bucket + "/";
            int idx = fullUrl.indexOf(marker);
            if (idx == -1)
                return;
            String filePath = fullUrl.substring(idx + marker.length());

            String deleteUrl = supabaseUrl + "/storage/v1/object/" + bucket + "/" + filePath;

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + serviceRoleKey);

            restTemplate.exchange(deleteUrl, HttpMethod.DELETE,
                    new HttpEntity<>(headers), String.class);
        } catch (Exception e) {
            log.warn("Could not delete file from Supabase: {}", e.getMessage());
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains("."))
            return "bin";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}