package com.backend.strategy;

import com.backend.entity.Item;
import com.backend.entity.User;
import lombok.Setter;
import org.springframework.stereotype.Component;

@Component
public class PricingContext {

    @Setter
    private PricingStrategy strategy;

    public PricingContext() {
        this.strategy = new DailyPricingStrategy();
    }

    public Double calculatePrice(Item item, User user, Integer rentalDays) {
        if (strategy == null) {
            throw new IllegalStateException("Pricing strategy not set");
        }
        return strategy.calculatePrice(item, user, rentalDays);
    }

    public String getCurrentStrategyName() {
        return strategy != null ? strategy.getStrategyName() : "None";
    }
}