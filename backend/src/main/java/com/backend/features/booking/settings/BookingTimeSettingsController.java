package com.backend.features.booking.settings;

import com.backend.features.booking.settings.dto.BookingTimeSettingsDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequiredArgsConstructor
public class BookingTimeSettingsController {

    private final BookingTimeSettingsService service;

    // ────────────────────────── Admin endpoints ──────────────────────────

    @GetMapping("/api/admin/booking-settings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BookingTimeSettingsDto> getSettings() {
        return ResponseEntity.ok(service.getSettings());
    }

    @PutMapping("/api/admin/booking-settings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BookingTimeSettingsDto> updateSettings(
            @RequestBody BookingTimeSettingsDto dto) {
        return ResponseEntity.ok(service.updateSettings(dto));
    }

    @GetMapping("/api/public/booking-settings")
    public ResponseEntity<BookingTimeSettingsDto> getPublicSettings() {
        return ResponseEntity.ok(service.getSettings());
    }
}