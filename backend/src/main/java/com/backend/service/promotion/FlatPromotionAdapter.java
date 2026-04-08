package com.backend.service.promotion;

import org.springframework.stereotype.Component;

@Component
public class FlatPromotionAdapter implements PromotionCalculator {

    @Override
    public Double calculate(Double originalPrice, Double value) {
        double discounted = originalPrice - value;
        return Math.max(discounted, 0);
    }

    @Override
    public String getDescription(String code, Double value) {
        return String.format("%s: $%.2f off", code, value);
    }

    @Override
    public String getType() {
        return "flat";
    }
}