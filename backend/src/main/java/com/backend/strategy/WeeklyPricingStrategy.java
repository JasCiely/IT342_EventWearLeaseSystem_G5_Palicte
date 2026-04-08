package com.backend.strategy;

import com.backend.entity.Item;
import com.backend.entity.User;
import org.springframework.stereotype.Component;

@Component
public class WeeklyPricingStrategy implements PricingStrategy {

    private static final double WEEKLY_DISCOUNT = 0.85;

    @Override
    public Double calculatePrice(Item item, User user, Integer rentalDays) {
        int weeks = rentalDays / 7;
        int remainingDays = rentalDays % 7;
        double weeklyRate = item.getPrice() * 7 * WEEKLY_DISCOUNT;
        return (weeks * weeklyRate) + (remainingDays * item.getPrice());
    }

    @Override
    public String getStrategyName() {
        return "Weekly Rate (15% off)";
    }
}