package com.backend.features.booking.settings;

import com.backend.features.booking.settings.dto.BookingTimeSettingsDto;
import com.backend.shared.entity.BookingTimeSettings;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingTimeSettingsService {

    private static final long SINGLETON_ID = 1L;

    private final BookingTimeSettingsRepository repository;

    /** Fetch settings. Creates defaults if the row doesn't exist yet. */
    @Transactional
    public BookingTimeSettingsDto getSettings() {
        BookingTimeSettings entity = repository.findById(SINGLETON_ID)
                .orElseGet(this::createDefaults);
        return toDto(entity);
    }

    /** Update the singleton row (upsert). */
    @Transactional
    public BookingTimeSettingsDto updateSettings(BookingTimeSettingsDto dto) {
        BookingTimeSettings entity = repository.findById(SINGLETON_ID)
                .orElseGet(this::createDefaults);

        entity.setEnableTimeRestrictions(dto.isEnableTimeRestrictions());
        entity.setShopOpenTime(dto.getShopOpenTime());
        entity.setShopCloseTime(dto.getShopCloseTime());
        entity.setWorkingDays(serializeDays(dto.getWorkingDays()));
        entity.setTimezone(dto.getTimezone());
        entity.setAutoApproveThreshold(dto.getAutoApproveThreshold());
        entity.setFittingDurationMinutes(
                dto.getFittingDurationMinutes() > 0 ? dto.getFittingDurationMinutes() : 30);

        BookingTimeSettings saved = repository.save(entity);
        log.info("Booking time settings updated: {}", saved.getId());
        return toDto(saved);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private BookingTimeSettings createDefaults() {
        BookingTimeSettings defaults = new BookingTimeSettings();
        defaults.setEnableTimeRestrictions(true);
        defaults.setShopOpenTime("09:00");
        defaults.setShopCloseTime("17:00");
        defaults.setWorkingDays("1,2,3,4,5");
        defaults.setTimezone("Asia/Manila");
        defaults.setAutoApproveThreshold(java.math.BigDecimal.valueOf(500));
        defaults.setFittingDurationMinutes(30);
        return repository.save(defaults);
    }

    private BookingTimeSettingsDto toDto(BookingTimeSettings e) {
        return new BookingTimeSettingsDto(
                e.isEnableTimeRestrictions(),
                e.getShopOpenTime(),
                e.getShopCloseTime(),
                deserializeDays(e.getWorkingDays()),
                e.getTimezone(),
                e.getAutoApproveThreshold(),
                e.getFittingDurationMinutes());
    }

    private String serializeDays(List<Integer> days) {
        if (days == null || days.isEmpty())
            return "";
        return days.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    private List<Integer> deserializeDays(String csv) {
        if (csv == null || csv.isBlank())
            return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Integer::parseInt)
                .collect(Collectors.toList());
    }
}