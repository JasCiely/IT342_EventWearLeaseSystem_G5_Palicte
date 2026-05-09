package com.backend.features.booking.settings;

import com.backend.features.booking.settings.dto.BookingTimeSettingsDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/admin/booking-settings")
@RequiredArgsConstructor
public class BookingTimeSettingsController {

    private final BookingTimeSettingsService service;

    /**
     * GET /api/admin/booking-settings
     * Returns the current booking time settings.
     * Accessible by ADMIN only.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BookingTimeSettingsDto> getSettings() {
        return ResponseEntity.ok(service.getSettings());
    }

    /**
     * PUT /api/admin/booking-settings
     * Replaces/updates booking time settings.
     * Accessible by ADMIN only.
     */
    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BookingTimeSettingsDto> updateSettings(
            @RequestBody BookingTimeSettingsDto dto) {
        return ResponseEntity.ok(service.updateSettings(dto));
    }
}