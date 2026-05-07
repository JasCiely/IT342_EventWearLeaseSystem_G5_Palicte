package com.backend.service;

import com.backend.dto.request.SalarySettingsRequest;
import com.backend.dto.response.SettingsResponse;

public interface SettingsService {

    SettingsResponse getCurrentSettings();

    SettingsResponse updateSalarySettings(SalarySettingsRequest request);
}
