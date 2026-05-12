package com.backend.features.inventory;

import com.backend.features.inventory.dto.request.InventorySettingsRequest;
import com.backend.features.inventory.dto.response.InventorySettingsResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequiredArgsConstructor
public class InventorySettingsController {

    private final InventorySettingsService settingsService;

    // ─── Public endpoint (no auth required) ─────────────────────────────────
    @GetMapping("/api/inventory-settings")
    public ResponseEntity<InventorySettingsResponse> getPublicSettings() {
        return ResponseEntity.ok(settingsService.getSettings());
    }

    // ─── Admin endpoints (require ADMIN role) ──────────────────────────────
    @GetMapping("/api/admin/inventory-settings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<InventorySettingsResponse> getSettings() {
        return ResponseEntity.ok(settingsService.getSettings());
    }

    @PutMapping("/api/admin/inventory-settings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<InventorySettingsResponse> updateSettings(
            @Valid @RequestBody InventorySettingsRequest request) {
        return ResponseEntity.ok(settingsService.updateSettings(request));
    }
}