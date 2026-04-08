package com.backend.service.promotion;

import org.springframework.stereotype.Component;

@Component
public class PercentagePromotionAdapter implements PromotionCalculator {

    @Override
    public Double calculate(Double originalPrice, Double value) {
        return originalPrice * (1 - (value / 100));
    }

    @Override
    public String getDescription(String code, Double value) {
        return String.format("%s: %.0f%% off", code, value);
    }

    @Override
    public String getType() {
        return "percentage";
    }
}