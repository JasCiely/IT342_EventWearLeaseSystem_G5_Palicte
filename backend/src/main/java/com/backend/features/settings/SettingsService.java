package com.backend.features.settings;

import com.backend.features.settings.dto.request.SalarySettingsRequest;
import com.backend.features.settings.dto.response.SettingsResponse;

public interface SettingsService {

    SettingsResponse getCurrentSettings();

    SettingsResponse updateSalarySettings(SalarySettingsRequest request);
}
