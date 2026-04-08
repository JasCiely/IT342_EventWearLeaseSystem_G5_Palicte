package com.backend.strategy;

import com.backend.entity.Item;
import com.backend.entity.User;
import org.springframework.stereotype.Component;

@Component
public class MonthlyPricingStrategy implements PricingStrategy {

    private static final double MONTHLY_DISCOUNT = 0.70;

    @Override
    public Double calculatePrice(Item item, User user, Integer rentalDays) {
        int months = rentalDays / 30;
        int remainingDays = rentalDays % 30;
        double monthlyRate = item.getPrice() * 30 * MONTHLY_DISCOUNT;
        return (months * monthlyRate) + (remainingDays * item.getPrice());
    }

    @Override
    public String getStrategyName() {
        return "Monthly Rate (30% off)";
    }
}