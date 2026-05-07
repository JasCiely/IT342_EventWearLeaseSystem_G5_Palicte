package com.backend.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SalarySettingsRequest {

    @NotNull(message = "Default daily rate is required")
    @Min(value = 1, message = "Default daily rate must be a positive number")
    private Integer defaultDailyRate;
}
