package com.backend.service.promotion;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class PromotionCalculatorFactory {

    private final Map<String, PromotionCalculator> calculatorMap = new HashMap<>();

    @Autowired
    private List<PromotionCalculator> calculators;

    @PostConstruct
    public void init() {
        for (PromotionCalculator calculator : calculators) {
            calculatorMap.put(calculator.getType().toLowerCase(), calculator);
        }
    }

    public PromotionCalculator getCalculator(String type) {
        PromotionCalculator calculator = calculatorMap.get(type.toLowerCase());
        if (calculator == null) {
            throw new IllegalArgumentException("No calculator found for type: " + type);
        }
        return calculator;
    }
}