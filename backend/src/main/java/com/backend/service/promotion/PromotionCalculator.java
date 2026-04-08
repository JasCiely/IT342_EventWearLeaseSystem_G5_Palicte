package com.backend.service.promotion;

public interface PromotionCalculator {
    Double calculate(Double originalPrice, Double value);

    String getDescription(String code, Double value);

    String getType();
}