package com.backend.service.impl;

import com.backend.dto.request.SalarySettingsRequest;
import com.backend.dto.response.SettingsResponse;
import com.backend.entity.SalarySettings;
import com.backend.repository.SalarySettingsRepository;
import com.backend.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class SettingsServiceImpl implements SettingsService {

    private static final int DEFAULT_DAILY_RATE = 300;

    private final SalarySettingsRepository salarySettingsRepository;

    @Override
    public SettingsResponse getCurrentSettings() {
        SalarySettings settings = salarySettingsRepository.findFirstByOrderByCreatedAtDesc()
                .orElseGet(() -> salarySettingsRepository.save(defaultSettings()));

        return SettingsResponse.from(settings);
    }

    @Override
    public SettingsResponse updateSalarySettings(SalarySettingsRequest request) {
        SalarySettings settings = new SalarySettings();
        settings.setDefaultDailyRate(request.getDefaultDailyRate());
        SalarySettings saved = salarySettingsRepository.save(settings);
        return SettingsResponse.from(saved);
    }

    private SalarySettings defaultSettings() {
        SalarySettings settings = new SalarySettings();
        settings.setDefaultDailyRate(DEFAULT_DAILY_RATE);
        return settings;
    }
}
