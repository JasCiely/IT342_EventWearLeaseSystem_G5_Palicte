package com.backend.features.settings;

import com.backend.features.settings.dto.request.SalarySettingsRequest;
import com.backend.features.settings.dto.response.SettingsResponse;
import com.backend.shared.entity.SalarySettings;
import com.backend.shared.repository.SalarySettingsRepository;
import com.backend.features.settings.SettingsService;
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
