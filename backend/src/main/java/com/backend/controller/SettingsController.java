package com.backend.controller;

import com.backend.dto.request.SalarySettingsRequest;
import com.backend.dto.response.SettingsResponse;
import com.backend.service.SettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/settings")
@CrossOrigin(origins = "http://localhost:5173", methods = {
        RequestMethod.GET,
        RequestMethod.POST,
        RequestMethod.PUT,
        RequestMethod.DELETE,
        RequestMethod.OPTIONS
})
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SettingsController {

    private final SettingsService settingsService;

    @GetMapping
    public ResponseEntity<SettingsResponse> getSettings() {
        SettingsResponse response = settingsService.getCurrentSettings();
        return ResponseEntity.ok(response);
    }

    @PutMapping("/salary")
    public ResponseEntity<SettingsResponse> updateSalarySettings(
            @Valid @RequestBody SalarySettingsRequest request) {
        SettingsResponse response = settingsService.updateSalarySettings(request);
        return ResponseEntity.ok(response);
    }
}
