package com.backend.service.promotion;

import com.backend.entity.Promotion;
import com.backend.repository.PromotionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class PromotionService {

    private final PromotionRepository promotionRepository;
    private final PromotionCalculatorFactory calculatorFactory;

    public Double applyPromotion(String promotionCode, Double originalPrice) {
        Promotion promotion = promotionRepository.findByCode(promotionCode)
                .orElseThrow(() -> new RuntimeException("Promotion not found: " + promotionCode));

        if (!isPromotionValid(promotion)) {
            return originalPrice;
        }

        PromotionCalculator calculator = calculatorFactory.getCalculator(promotion.getType());
        return calculator.calculate(originalPrice, promotion.getValue());
    }

    public String getPromotionDescription(String promotionCode) {
        Promotion promotion = promotionRepository.findByCode(promotionCode)
                .orElseThrow(() -> new RuntimeException("Promotion not found: " + promotionCode));

        PromotionCalculator calculator = calculatorFactory.getCalculator(promotion.getType());
        return calculator.getDescription(promotion.getCode(), promotion.getValue());
    }

    private boolean isPromotionValid(Promotion promotion) {
        LocalDate today = LocalDate.now();
        return promotion.isActive() &&
                !today.isBefore(promotion.getStartDate()) &&
                !today.isAfter(promotion.getEndDate());
    }
}