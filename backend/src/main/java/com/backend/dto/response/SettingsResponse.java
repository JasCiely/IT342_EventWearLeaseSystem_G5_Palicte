package com.backend.dto.response;

import com.backend.entity.SalarySettings;
import lombok.Data;

@Data
public class SettingsResponse {

    private String id;
    private int defaultDailyRate;

    public static SettingsResponse from(SalarySettings settings) {
        SettingsResponse response = new SettingsResponse();
        response.setId(settings.getId());
        response.setDefaultDailyRate(settings.getDefaultDailyRate());
        return response;
    }
}
